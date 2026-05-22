"""
Restaurant Chatbot API - Flask Backend
SIMPLIFIED VERSION - KEYWORD MATCHING ONLY
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
from datetime import datetime
import re
import duckdb
import random
from datetime import timedelta

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "http://localhost:5173"]}})

conversation = []
"""DATABASE_FILE = 'restaurant_chatbot.duckdb'"""

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_FILE = os.path.join(BASE_DIR, 'restaurant_chatbot.duckdb')

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
            {"name": "Bruschetta", "price": "$8.99"},
            {"name": "Calamari", "price": "$10.99"},
        ],
        "mains": [
            {"name": "Grilled Salmon", "price": "$18.99"},
            {"name": "Pasta Carbonara", "price": "$14.99"},
            {"name": "Ribeye Steak", "price": "$22.99"},
        ],
        "desserts": [
            {"name": "Tiramisu", "price": "$7.99"},
            {"name": "Chocolate Cake", "price": "$6.99"},
        ],
    }
}

RESERVATIONS = {}

# ============================================================================
# DATABASE FUNCTIONS
# ============================================================================

def init_database():
    """Initialize database"""
    try:
        conn = duckdb.connect(DATABASE_FILE)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS reservations (
                id VARCHAR PRIMARY KEY,
                name VARCHAR NOT NULL,
                party_size INTEGER,
                date VARCHAR,
                time VARCHAR,
                allergies VARCHAR,
                dietary VARCHAR,
                occasion VARCHAR,
                seating VARCHAR,
                instructions VARCHAR,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        conn.close()
        print("✅ Database initialized")
    except Exception as e:
        print(f"❌ Database error: {e}")

# ============================================================================
# CHATBOT FUNCTIONS (KEYWORD MATCHING ONLY)
# ============================================================================

def detect_intent(message):
    """Detect intent using keywords"""
    message_lower = message.lower()
    
    if any(word in message_lower for word in ["book", "table", "reservation", "reserve", "party", "people"]):
        return "reservation"
    elif any(word in message_lower for word in ["hours", "open", "close", "time", "available"]):
        return "hours"
    elif any(word in message_lower for word in ["menu", "food", "dish", "price", "eat"]):
        return "menu"
    else:
        return "unknown"

def extract_reservation_info(message):
    """Extract reservation details"""
    extracted = {
        "party_size": None,
        "date": None,
        "time": None,
        "name": None,
    }
    
    # Extract party size
    people_match = re.search(
        r'(?:for\s+)?(\d+)\s*(people|person|guests?)?',
        message,
        re.IGNORECASE
    )
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
    name_patterns = [
        r'under the name of\s+([A-Za-z]+)',
        r'name (?:is|of)\s+([A-Za-z]+)',
    ]
    
    for pattern in name_patterns:
        name_match = re.search(pattern, message, re.IGNORECASE)
        if name_match:
            extracted["name"] = name_match.group(1).capitalize()
            break
    
    return extracted

def handle_reservation(info):
    """Handle reservation request"""
    party_size = info.get("party_size")
    date = info.get("date")
    time = info.get("time")
    name = info.get("name") or "Guest"
    
    if not party_size or not date or not time:
        return "I'd be happy to help with a reservation! Please provide: party size, date, and time."
    
    if party_size > RESTAURANT_DATA["max_party_size"]:
        return f"We can only accommodate up to {RESTAURANT_DATA['max_party_size']} people. Please call us at {RESTAURANT_DATA['phone']}"
    
    
    # Save reservation
    try:
        conn = duckdb.connect(DATABASE_FILE)

        reservation_id = f"RES-{random.randint(1000,9999)}"

        conn.execute("""
            INSERT INTO reservations (
                id, name, party_size, date, time,
                allergies, dietary, occasion, seating, instructions
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            reservation_id,
            name,
            party_size,
            date,
            time,
            "",
            "",
            "",
            "",
            ""
        ])

        conn.commit()
        conn.close()

        print(f"✅ Saved reservation: {reservation_id}")

    except Exception as e:
        print(f"❌ Database error: {e}")

    
    RESERVATIONS[reservation_id] = {
        "name": name,
        "party_size": party_size,
        "date": date,
        "time": time,
    }
    
    response = f"""✅ RESERVATION CONFIRMED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Reservation ID: {reservation_id}
Restaurant: {RESTAURANT_DATA['name']}
Phone: {RESTAURANT_DATA['phone']}

👤 Name: {name}
👥 Party Size: {party_size} people
📅 Date: {date}
⏰ Time: {time}

📍 Address: {RESTAURANT_DATA['address']}
📧 Email: {RESTAURANT_DATA['email']}

Thank you for choosing {RESTAURANT_DATA['name']}! 🍽️"""
    
    return response

def handle_hours():
    """Return restaurant hours"""
    hours_text = "\n".join([f"{day}: {hours}" for day, hours in RESTAURANT_DATA["hours"].items()])
    return f"📋 {RESTAURANT_DATA['name']} Hours:\n{hours_text}\n\nPhone: {RESTAURANT_DATA['phone']}"

def handle_menu():
    """Return menu"""
    menu_text = f"🍽️ {RESTAURANT_DATA['name']} Menu\n\n"
    for category, items in RESTAURANT_DATA["menu"].items():
        menu_text += f"{category.upper()}:\n"
        for item in items:
            menu_text += f"  • {item['name']} - {item['price']}\n"
        menu_text += "\n"
    return menu_text

def process_message(user_message):
    """Process user message and return response"""
    print(f"📝 Message received: {user_message}")
    
    intent = detect_intent(user_message)
    print(f"🤖 Intent detected: {intent}")
    
    if intent == "reservation":
        info = extract_reservation_info(user_message)
        print(f"📋 Extracted: {info}")
        response = handle_reservation(info)
    elif intent == "hours":
        response = handle_hours()
    elif intent == "menu":
        response = handle_menu()
    else:
        response = f"I can help with reservations, hours, or menu. Call us at {RESTAURANT_DATA['phone']} for other questions."
    
    print(f"📤 Response: {response[:100]}...")
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
    """Chat endpoint"""
    print("\n🟢 CHAT ENDPOINT CALLED")
    try:
        data = request.get_json()
        user_message = data.get('message', '').strip()
        print(f"📩 User message: {user_message}")
        
        if not user_message:
            return jsonify({'error': 'No message', 'success': False}), 400
        
        global conversation
        conversation.append({"role": "user", "content": user_message})
        
        # Process message
        response = process_message(user_message)
        
        conversation.append({"role": "assistant", "content": response})
        
        return jsonify({
            'response': response,
            'success': True,
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/reservations', methods=['GET'])
def get_reservations():
    """Get all reservations"""
    try:
        conn = duckdb.connect(DATABASE_FILE)
        result = conn.execute("SELECT * FROM reservations ORDER BY created_at DESC").fetchall()
        conn.close()
        
        reservations = [
            {
                'id': row[0],
                'name': row[1],
                'party_size': row[2],
                'date': row[3],
                'time': row[4],
            }
            for row in result
        ]
        
        return jsonify({'reservations': reservations, 'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500

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
    print("="*70 + "\n")
    
    init_database()
    
    print("🚀 Starting Flask API...")
    print("📍 API URL: http://localhost:5000")
    print("📍 Chat endpoint: POST http://localhost:5000/api/chat\n")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
