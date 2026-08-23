"""Reservation extraction, persistence, and lookup."""

import re
from datetime import datetime, timedelta

from psycopg2.extras import RealDictCursor

from config import RESTAURANT_DATA
from customers import extract_phone_from_message, extract_email_from_message, save_customer
from db import get_db_connection
from ai import get_ollama_response


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
            SELECT id, date, time, party_size
            FROM reservations
            WHERE name = %s
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


def handle_reservation_request(message, customer=None, info=None):
    """Handle reservation with AI and extraction"""
    if not info:
        info = extract_reservation_info(message)

    # Fall back to the recognized customer's stored profile for anything
    # not present in the current message, instead of re-asking for it
    if customer:
        info["name"] = info.get("name") or customer.get("name")
        info["phone"] = info.get("phone") or customer.get("phone")
        info["email"] = info.get("email") or customer.get("email")

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

    # Save customer WITH preferences; also gives us the customer_id to link the reservation to
    customer_id = save_customer(name, email, phone, favorite_table, favorite_dishes, favorite_time)

    conn = get_db_connection()
    if conn:
        try:
            cur = conn.cursor()

            # Insert reservation - column names match the real `reservations` schema
            cur.execute("""
                INSERT INTO reservations
                    (id, name, party_size, date, time, allergies, dietary, occasion, seating, instructions, customer_id)
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
                customer_id,
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


def list_reservations():
    """Get all reservations"""
    conn = get_db_connection()
    if not conn:
        return None

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT id, name, party_size, date, time, customer_id
            FROM reservations
            ORDER BY created_at DESC
        """)
        reservations = cur.fetchall()
        cur.close()
        return reservations
    except Exception as e:
        print(f"❌ Error listing reservations: {e}")
        return None
    finally:
        conn.close()
