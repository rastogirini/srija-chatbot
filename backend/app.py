"""
Restaurant Chatbot API - Flask Backend
POSTGRESQL + OLLAMA AI + CUSTOMER RECOGNITION (Phone + Email)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
from datetime import datetime, timedelta
import re
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "http://localhost:5173"]}})

conversation = []
OLLAMA_URL = "http://localhost:11434/api/generate"

# ============================================================================
# DATABASE CONFIG
# ============================================================================

DB_CONFIG = {
    'host': os.getenv('DB_HOST'),
    'port': os.getenv('DB_PORT'),
    'database': os.getenv('DB_NAME'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD')
}

def get_db_connection():
    """Get PostgreSQL connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        return None

# Restaurant data
RESTAURANT_DATA = {
    "name": "Srija's Taste",
    "phone": "+1-123-0123",
    "email": "support@srija.com",
    "address": "123 Main Street, Downtown",
    "max_party_size": 50,
    "hours": {
        "Monday": "10:00 AM - 10:00 PM",
        "Tuesday": "10:00 AM - 10:00 PM",
        "Wednesday": "10:00 AM - 10:00 PM",
        "Thursday": "10:00 AM - 10:00 PM",
        "Friday": "10:00 AM - 11:00 PM",
        "Saturday": "11:00 AM - 11:00 PM",
        "Sunday": "11:00 AM - 10:00 PM",
    },
    "menu": {
        "appetizers": [
            {"name": "Bruschetta", "price": "$8.99", "description": "Toasted bread with tomatoes and garlic"},
            {"name": "Calamari", "price": "$10.99", "description": "Fried squid with marinara sauce"},
        ],
        "mains": [
            {"name": "Grilled Salmon", "price": "$18.99", "description": "Fresh salmon with lemon butter sauce"},
            {"name": "Pasta Carbonara", "price": "$14.99", "description": "Classic Italian pasta with bacon and cream"},
            {"name": "Ribeye Steak", "price": "$22.99", "description": "12oz USDA Prime cut with vegetables"},
        ],
        "desserts": [
            {"name": "Tiramisu", "price": "$7.99", "description": "Italian coffee-flavored dessert"},
            {"name": "Chocolate Cake", "price": "$6.99", "description": "Rich dark chocolate cake with frosting"},
        ],
    }
}

# ============================================================================
# DATABASE INITIALIZATION
# ============================================================================

def init_database():
    """Initialize PostgreSQL tables"""
    conn = get_db_connection()
    if not conn:
        print("❌ Cannot connect to database!")
        return
    
    try:
        cur = conn.cursor()
        
        # Create customers table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100),
                phone VARCHAR(20),
                visits INTEGER DEFAULT 1,
                favorite_table VARCHAR(50),
                favorite_time VARCHAR(20),
                favorite_dishes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(name, phone, email)
            )
        """)
        
        # Create reservations table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS reservations (
                id SERIAL PRIMARY KEY,
                reservation_id VARCHAR(20) UNIQUE NOT NULL,
                customer_name VARCHAR(100),
                email VARCHAR(100),
                phone VARCHAR(20),
                party_size INTEGER,
                reservation_date DATE,
                reservation_time VARCHAR(20),
                dietary_restrictions TEXT,
                allergies TEXT,
                special_occasion VARCHAR(100),
                seating_preference VARCHAR(50),
                special_instructions TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_name) REFERENCES customers(name) ON DELETE CASCADE
            )
        """)
        
        # Create chat_history table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS chat_history (
                id SERIAL PRIMARY KEY,
                customer_name VARCHAR(100),
                user_message TEXT,
                bot_response TEXT,
                intent VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.commit()
        print("✅ Database tables initialized")
        cur.close()
        
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
    finally:
        conn.close()

# ============================================================================
# CUSTOMER RECOGNITION FUNCTIONS
# ============================================================================

def extract_name_from_message(message):
    """Extract customer name from message"""
    
    # Try to find "i am XXX" first
    match = re.search(r'i\s+am\s+([A-Za-z]+)', message, re.IGNORECASE)
    if match:
        return match.group(1).capitalize()
    
    # Try to find "name: XXX"
    match = re.search(r'name\s*:\s*([A-Za-z]+)', message, re.IGNORECASE)
    if match:
        return match.group(1).capitalize()
    
    # Try "by the name of XXX" or "for the name of XXX"
    match = re.search(r'(?:by|for)\s+the\s+name\s+of\s+([A-Za-z]+)', message, re.IGNORECASE)
    if match:
        return match.group(1).capitalize()
    
    # Try "under the name of XXX"
    match = re.search(r'under\s+the\s+name\s+of\s+([A-Za-z]+)', message, re.IGNORECASE)
    if match:
        return match.group(1).capitalize()
    
    return None

def extract_phone_from_message(message):
    """Extract phone number from message"""
    # Matches: +91-9876543210, 9876543210, +1-234-5678, etc.
    patterns = [
        r'(?:phone|mobile|number|call)[\s:]+(\+?[\d\-\s]{10,})',
        r'(\+?[\d\-]{10,})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    
    return None

def extract_email_from_message(message):
    """Extract email from message"""
    match = re.search(r'(\w+@\w+\.\w+)', message, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return None

def recognize_customer(name, phone=None, email=None):
    """Check if customer is returning by email (unique identifier)"""
    if not name:
        return None
    
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Priority 1: Search by email (most reliable)
        if email:
            print(f"🔍 Searching by: email only")
            cur.execute("SELECT * FROM customers WHERE LOWER(email) = LOWER(%s)", (email,))
            customer = cur.fetchone()
            if customer:
                cur.close()
                conn.close()
                return customer
        
        # Priority 2: Search by phone + name
        if phone:
            print(f"🔍 Searching by: name + phone")
            cur.execute(
                "SELECT * FROM customers WHERE LOWER(name) = LOWER(%s) AND phone = %s", 
                (name, phone)
            )
            customer = cur.fetchone()
            if customer:
                cur.close()
                conn.close()
                return customer
        
        # Priority 3: Search by name only
        print(f"🔍 Searching by: name only")
        cur.execute("SELECT * FROM customers WHERE LOWER(name) = LOWER(%s)", (name,))
        customer = cur.fetchone()
        cur.close()
        conn.close()
        return customer
        
    except Exception as e:
        print(f"❌ Error recognizing customer: {e}")
        return None
    
def get_greeting(customer):
    """Generate personalized greeting"""
    if customer:
        visits = customer.get('visits', 1)
        favorite_table = customer.get('favorite_table', 'a table')
        
        if visits == 1:
            return f"Hi, {customer['name']}! 👋"
        else:
            return f"Welcome back, {customer['name']}! 👋\nIt's great to see you again — this will be visit #{visits + 1}!\nI remember you love our {favorite_table} tables!"
    return "Welcome to Srija's Taste! 🍽️"

def get_history(customer_name):
    """Get customer's reservation history"""
    if not customer_name:
        return []
    
    conn = get_db_connection()
    if not conn:
        return []
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT reservation_id, reservation_date, reservation_time, party_size
            FROM reservations
            WHERE customer_name = %s
            ORDER BY created_at DESC
            LIMIT 5
        """, (customer_name,))
        history = cur.fetchall()
        cur.close()
        return history
    except Exception as e:
        print(f"❌ Error getting history: {e}")
        return []
    finally:
        conn.close()

def get_recommendations(customer):
    """Get personalized recommendations"""
    if not customer:
        return None
    
    favorites = customer.get('favorite_dishes', '')
    fav_text = favorites if favorites else "our menu"
    
    recommendations = f"""
💡 Personalized Recommendations:
• You loved {fav_text} last time!
• Your favorite {customer.get('favorite_table', 'table')} is available
• Try our new seasonal specials"""
    
    return recommendations

def save_customer(name, email=None, phone=None, favorite_table=None, favorite_dishes=None, favorite_time=None):
    """Save or update customer and return customer_id"""
    if not name:
        return None
    
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        cur = conn.cursor()
        
        # Check if customer exists
        cur.execute(
            "SELECT id FROM customers WHERE name = %s AND phone = %s AND email = %s",
            (name, phone, email)
        )
        existing = cur.fetchone()
        
        if existing:
            # Update visits AND preferences
            customer_id = existing[0]
            cur.execute("""
                UPDATE customers 
                SET visits = visits + 1, 
                    favorite_table = %s,
                    favorite_dishes = %s,
                    favorite_time = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (favorite_table, favorite_dishes, favorite_time, customer_id))
        else:
            # Add new customer WITH preferences
            cur.execute("""
                INSERT INTO customers (name, email, phone, favorite_table, favorite_dishes, favorite_time)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (name, email, phone, favorite_table, favorite_dishes, favorite_time))
            customer_id = cur.fetchone()[0]
        
        conn.commit()
        cur.close()
        conn.close()
        
        print(f"✅ Customer saved: {name}, ID: {customer_id}")
        return customer_id
        
    except Exception as e:
        print(f"❌ Error saving customer: {e}")
        return None
    
# ============================================================================
# OLLAMA AI FUNCTIONS
# ============================================================================

def get_ollama_response(prompt):
    """Get response from Ollama"""
    try:
        print(f"🤖 Calling Ollama...")
        
        payload = {
            "model": "phi3",
            "prompt": prompt,
            "stream": False,
            "temperature": 0.7
        }
        
        response = requests.post(OLLAMA_URL, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            ai_response = data.get('response', '').strip()
            print(f"✅ Ollama responded!")
            return ai_response
        else:
            print(f"❌ Ollama error: {response.status_code}")
            return None
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to Ollama! Make sure it's running (ollama serve)")
        return None
    except Exception as e:
        print(f"❌ Ollama error: {e}")
        return None

def extract_reservation_info(message):
    """Extract reservation details including phone and email"""
    extracted = {
        "party_size": None,
        "date": None,
        "time": None,
        "name": None,
        "phone": None,
        "email": None,
        "allergies": None,
        "dietary": None,
        "occasion": None,
        "seating": None,
    }
    
    # Extract party size
    people_match = re.search(r'(\d+)\s+(people|person|guests?)', message, re.IGNORECASE)
    if people_match:
        extracted["party_size"] = int(people_match.group(1))
    
    # Extract time
    time_match = re.search(r'at\s+(\d{1,2}):?(\d{2})?\s*(pm|am|PM|AM)?', message, re.IGNORECASE)
    if time_match:
        extracted["time"] = time_match.group(0).replace('at ', '').strip()
    
    # Extract date
    if "today" in message.lower():
        extracted["date"] = datetime.now().strftime("%Y-%m-%d")
    elif "tomorrow" in message.lower():
        extracted["date"] = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    
    # Extract name
    match = re.search(r'name\s*:\s*([A-Za-z]+)', message, re.IGNORECASE)
    if match:
        extracted["name"] = match.group(1).capitalize()
    
    # Extract phone
    extracted["phone"] = extract_phone_from_message(message)
    
    # Extract email
    extracted["email"] = extract_email_from_message(message)
    
    # Extract allergies
    allergy_match = re.search(r'(?:allergic to|allergies?)\s*:\s*([A-Za-z\s,]+?)(?:\s+dietary|$)', message, re.IGNORECASE)
    if allergy_match:
        extracted["allergies"] = allergy_match.group(1).strip()
    
    # Extract dietary
    dietary_match = re.search(r'dietary\s*:\s*([A-Za-z\s,]+?)(?:\s+occasion|$)', message, re.IGNORECASE)
    if dietary_match:
        extracted["dietary"] = dietary_match.group(1).strip()
    
    # Extract occasion
    occasion_match = re.search(r'occasion\s*:\s*([A-Za-z\s,]+?)(?:\s+seating|$)', message, re.IGNORECASE)
    if occasion_match:
        extracted["occasion"] = occasion_match.group(1).strip()
    
    # Extract seating - TRY MULTIPLE PATTERNS
    # Pattern 1: "corner table" or "window table"
    seating_match = re.search(r'(?:book\s+a\s+)?(\w+)\s+table', message, re.IGNORECASE)
    if seating_match:
        extracted["seating"] = seating_match.group(1).capitalize()
    else:
        # Pattern 2: "seating: corner"
        seating_match = re.search(r'seating\s*:\s*([A-Za-z\s]+?)(?:\s+$|$)', message, re.IGNORECASE)
        if seating_match:
            extracted["seating"] = seating_match.group(1).strip()
    
    return extracted
GREETING_PATTERN = re.compile(r'^(hi+|hello+|hey+|good (morning|afternoon|evening)|greetings|yo)[\s!.,]*$')

def detect_intent(message):
    """Detect if greeting, reservation, hours, menu, or general"""
    message_lower = message.lower().strip()

    if GREETING_PATTERN.fullmatch(message_lower):
        return "greeting"

    if any(word in message_lower for word in ["book", "table", "reservation", "reserve", "party", "people"]):
        return "reservation"
    elif any(word in message_lower for word in ["hours", "open", "close", "time", "available"]):
        return "hours"
    elif any(word in message_lower for word in ["menu", "food", "dish", "price"]):
        return "menu"
    else:
        return "general"

def handle_reservation_request(message, customer=None, info=None):
    """Handle reservation with AI and extraction"""
    if not info:
        info = extract_reservation_info(message)
    
    # Check if we have all required info
    missing = []
    if not info.get("party_size"):
        missing.append("party size")
    if not info.get("date"):
        missing.append("date")
    if not info.get("time"):
        missing.append("time")
    if not info.get("name"):
        missing.append("your name")
    if not info.get("phone"):
        missing.append("your phone number")
    if not info.get("email"):
        missing.append("your email")
    
    if missing:
        # Ask AI to ask for missing info
        missing_str = ", ".join(missing)
        prompt = f"""You are a helpful restaurant assistant for {RESTAURANT_DATA['name']}.
Customer wants to make a reservation.
Their message: "{message}"
We have: Party size: {info.get('party_size')}, Date: {info.get('date')}, Time: {info.get('time')}, 
Name: {info.get('name')}, Phone: {info.get('phone')}, Email: {info.get('email')}

We're missing: {missing_str}

Ask them politely for the missing information in a friendly way (1-2 sentences)."""
        
        response = get_ollama_response(prompt)
        if response:
            return response
        else:
            return f"I'd be happy to help with a reservation! Please provide: {missing_str}"
    
    # Valid reservation - all info present!
    reservation_id = f"RES-{int(datetime.now().timestamp() % 10000)}"
    name = info.get("name")
    phone = info.get("phone")
    email = info.get("email")
    favorite_table = info.get("seating", "")  # Use seating as favorite table
    favorite_time = info.get("time", "")
    favorite_dishes = ""  # Can add logic to extract from message if needed

    # Save customer WITH preferences
    customer_id = save_customer(name, email, phone, favorite_table, favorite_dishes, favorite_time)
    #customer_id = save_customer(name, email, phone)
    print(f"🔵 Customer ID from save_customer: {customer_id}")
    
    conn = get_db_connection()
    if conn:
        try:
            cur = conn.cursor()
            
            print(f"🔵 Attempting INSERT with: {reservation_id}, {name}, {info.get('party_size')}, {info.get('date')}, {info.get('time')}, customer_id: {customer_id}")
            
            # Insert reservation with customer_id
            cur.execute("""
                INSERT INTO reservations (id, name, party_size, date, time, allergies, dietary, occasion, seating, instructions, customer_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                reservation_id,
                name,
                info.get("party_size"),
                info.get("date"),
                info.get("time"),
                info.get("allergies", ""),
                info.get("dietary", ""),
                info.get("occasion", ""),
                info.get("seating", ""),
                "",  # instructions
                customer_id
            ))
            
            conn.commit()
            cur.close()
            print(f"✅ Reservation saved: {reservation_id}, customer_id: {customer_id}")
            
        except Exception as e:
            print(f"❌ Database error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            conn.close()
    
    # ✅ MOVED OUTSIDE if block
    response = f"""✅ RESERVATION CONFIRMED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Reservation ID: {reservation_id}
Restaurant: {RESTAURANT_DATA['name']}
Phone: {RESTAURANT_DATA['phone']}

👤 Name: {name}
📧 Email: {email}
📱 Phone: {phone}
👥 Party Size: {info.get('party_size')} people
📅 Date: {info.get('date')}
⏰ Time: {info.get('time')}

📍 Address: {RESTAURANT_DATA['address']}

Thank you for choosing {RESTAURANT_DATA['name']}! 🍽️"""
    
    return response

def handle_hours_request():
    """Return hours with AI enhancement"""
    hours_text = "\n".join([f"{day}: {hours}" for day, hours in RESTAURANT_DATA["hours"].items()])
    
    prompt = f"""You are a helpful restaurant assistant.
A customer asked about restaurant hours.
Here are our hours:
{hours_text}

Phone: {RESTAURANT_DATA['phone']}

Give a friendly response about our hours (2-3 sentences)."""
    
    response = get_ollama_response(prompt)
    if response:
        return response
    else:
        return f"📋 {RESTAURANT_DATA['name']} Hours:\n{hours_text}\n\nPhone: {RESTAURANT_DATA['phone']}"

def handle_menu_request(message):
    """Return menu with AI enhancement"""
    menu_text = "MENU:\n"
    for category, items in RESTAURANT_DATA["menu"].items():
        menu_text += f"\n{category.upper()}:\n"
        for item in items:
            menu_text += f"  • {item['name']} - {item['price']}: {item['description']}\n"
    
    prompt = f"""You are a helpful restaurant assistant.
Customer asked: "{message}"

Our menu:
{menu_text}

Give a helpful response about our menu (2-4 sentences)."""
    
    response = get_ollama_response(prompt)
    if response:
        return response
    else:
        return menu_text

def process_message_with_ai(user_message, customer=None):
    """Process message using AI"""
    print(f"📝 Message: {user_message}")
    
    intent = detect_intent(user_message)
    print(f"🎯 Intent: {intent}")
    
    info = extract_reservation_info(user_message)
    
    if intent == "greeting":
        # Skip the AI call for plain greetings - instant reply
        response = "How can I help you today? I can book a table, share our hours, or walk you through the menu."
    elif intent == "reservation":
        response = handle_reservation_request(user_message, customer, info)
    elif intent == "hours":
        response = handle_hours_request()
    elif intent == "menu":
        response = handle_menu_request(user_message)
    else:
        # General question - use AI
        prompt = f"""You are a helpful assistant for {RESTAURANT_DATA['name']} restaurant.
Customer asked: "{user_message}"

Our details:
- Phone: {RESTAURANT_DATA['phone']}
- Email: {RESTAURANT_DATA['email']}
- Address: {RESTAURANT_DATA['address']}

Help them! Keep response short (2-3 sentences)."""
        
        response = get_ollama_response(prompt)
        if not response:
            response = f"I'm here to help! Call us at {RESTAURANT_DATA['phone']} for more information."
    
    return response

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check"""
    return jsonify({'status': 'ok', 'message': 'API running'})

@app.route('/api/chat', methods=['POST'])
def handle_chat():
    """Chat endpoint with customer recognition (phone + email)"""
    print("\n🟢 CHAT ENDPOINT CALLED")
    try:
        data = request.get_json()
        user_message = data.get('message', '').strip()
        print(f"📩 User message: {user_message}")
        
        if not user_message:
            return jsonify({'error': 'No message', 'success': False}), 400
        
        global conversation
        conversation.append({"role": "user", "content": user_message})

        # ✅ CUSTOMER RECOGNITION (Phone + Email)
        name = extract_name_from_message(user_message)
        phone = extract_phone_from_message(user_message)
        email = extract_email_from_message(user_message)
        
        print(f"👤 Extracted name: {name}")
        print(f"📱 Extracted phone: {phone}")
        print(f"📧 Extracted email: {email}")
        
        # Recognize customer by name + phone + email
        customer = recognize_customer(name, phone, email)
        
        greeting_text = ""
        recommendations_text = ""
        history_text = ""
        
        if customer:
            # ✅ RETURNING CUSTOMER
            print(f"✅ Returning customer: {customer['name']}")
            greeting_text = get_greeting(customer) + "\n\n"
            
            # Add history
            history = get_history(customer['name'])
            if history:
                history_text = "📋 Your Past Reservations:\n"
                for res in history:
                    history_text += f"  • {res['reservation_date']} at {res['reservation_time']} - Party of {res['party_size']}\n"
                history_text += "\n"
            
            # Add recommendations
            recommendations_text = get_recommendations(customer) + "\n\n"
        else:
            # ✅ NEW CUSTOMER
            if name:
                print(f"ℹ️ New customer: {name}")
                greeting_text = f"Welcome, {name}! 👋 Welcome to Srija's Taste! 🍽️\n\n"
            else:
                greeting_text = "Welcome to Srija's Taste! 🍽️\n\n"
        
        # Process message with AI
        response = process_message_with_ai(user_message, customer)
        
        # Combine greeting/recommendations/history with AI response
        final_response = greeting_text + recommendations_text + history_text + response

        conversation.append({"role": "assistant", "content": final_response})

        # ✅ SAVE TO CHAT_HISTORY TABLE
        try:
            conn = get_db_connection()
            if conn:
                cur = conn.cursor()
                intent = detect_intent(user_message)
                cur.execute("""
                    INSERT INTO chat_history (customer_name, user_message, bot_response, intent)
                    VALUES (%s, %s, %s, %s)
                """, (name, user_message, final_response, intent))
                conn.commit()
                cur.close()
                print("✅ Chat history saved!")
                conn.close()
        except Exception as e:
            print(f"❌ Error saving chat history: {e}")

        print(f"📤 Response generated\n")
        
        return jsonify({
            'response': final_response,
            'success': True,
            'timestamp': datetime.now().isoformat(),
            'is_returning_customer': customer is not None,
            'customer_name': customer['name'] if customer else None,
            'extracted': {
                'name': name,
                'phone': phone,
                'email': email
            }
        }), 200
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/reservations', methods=['GET'])
def get_reservations():
    """Get all reservations"""
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database error', 'success': False}), 500
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT reservation_id, customer_name, email, phone, party_size, reservation_date, reservation_time
            FROM reservations
            ORDER BY created_at DESC
        """)
        reservations = cur.fetchall()
        cur.close()
        
        return jsonify({'reservations': reservations, 'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500
    finally:
        conn.close()

@app.route('/api/customers', methods=['GET'])
def get_customers():
    """Get all customers (for admin)"""
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database error', 'success': False}), 500
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM customers ORDER BY visits DESC")
        customers = cur.fetchall()
        cur.close()
        
        return jsonify({'customers': customers, 'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500
    finally:
        conn.close()

@app.route('/api/chat/reset', methods=['POST'])
def reset_chat():
    """Reset conversation"""
    global conversation
    conversation = []
    return jsonify({'message': 'Reset', 'success': True})

# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found', 'success': False}), 404

@app.errorhandler(500)
def server_error(error):
    return jsonify({'error': 'Server error', 'success': False}), 500

# ============================================================================
# MAIN
# ============================================================================

if __name__ == '__main__':
    print("\n" + "="*70)
    print("🍽️  RESTAURANT CHATBOT API")
    print("POSTGRESQL + OLLAMA + PHONE + EMAIL RECOGNITION")
    print("="*70 + "\n")
    
    init_database()
    
    print("🚀 Starting Flask API...")
    print("📍 API URL: http://localhost:5000")
    print("📍 Using OLLAMA AI on port 11434")
    print("📍 Using PostgreSQL for database\n")
    
    app.run(host='0.0.0.0', port=5000, debug=True)