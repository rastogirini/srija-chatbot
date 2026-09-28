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

    # Extract party size - try "14 people" first, then fall back to the
    # reversed phrasing "people is 14" / "no. of people: 14" / "party of 14",
    # which the first pattern can't see since the number comes second there.
    people_match = re.search(r'(\d+)\s+(?:people|persons?|guests?)', message, re.IGNORECASE)
    if not people_match:
        people_match = re.search(r'(?:people|persons?|guests?|party)\D{0,15}?(\d+)', message, re.IGNORECASE)
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
    # Pattern 1: "corner table" or "window table". A negative lookahead
    # excludes "a"/"an"/"the" from being captured - without it, generic
    # phrasing like "book a table" matched "a" as the seating word and
    # stored the nonsense value "A".
    seating_match = re.search(r'\b(?!a\b|an\b|the\b)(\w+)\s+table\b', message, re.IGNORECASE)
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


def get_reservations_by_customer_id(customer_id):
    """Full reservation history for one customer (admin detail view) -
    matched by customer_id rather than name. reservations.customer_id is
    VARCHAR, so the id is cast to a string to match its type."""
    if not customer_id:
        return []

    conn = get_db_connection()
    if not conn:
        return []

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT id, date, time, party_size, occasion, seating, allergies, dietary, created_at
            FROM reservations
            WHERE customer_id = %s
            ORDER BY created_at DESC
        """, (str(customer_id),))
        history = cur.fetchall()
        cur.close()
        return history
    except Exception as e:
        print(f"❌ Error getting reservations by customer id: {e}")
        return []
    finally:
        conn.close()


_FAKE_CONFIRMATION_PHRASES = (
    "confirmed", "noted your reservation", "i've noted", "i have noted",
    "booked", "all set", "reservation is complete", "i've reserved",
    "i've made your reservation", "i've made a reservation",
    "reservation has been", "your table is",
)


def _sounds_like_a_confirmation(text):
    """True if a reply reads like a completed booking, even though this
    code path never actually saves one - used to catch a small model
    fabricating a confirmation instead of asking for what's still missing."""
    lowered = text.lower()
    return any(phrase in lowered for phrase in _FAKE_CONFIRMATION_PHRASES)


def save_reservation(info):
    """Write a fully-collected reservation to the database and return its
    confirmation text + id. Split out from handle_reservation_request so the
    row is only ever created once the customer has answered every question -
    the required details AND the seating/dietary preferences gathered via
    the chatbot's quick-reply buttons. A half-answered booking never reaches
    this function."""
    reservation_id = f"RES-{int(datetime.now().timestamp() % 10000)}"
    name = info.get("name")
    phone = info.get("phone")
    email = info.get("email")
    seating = info.get("seating") or ""
    dietary = info.get("dietary") or ""

    # Links the reservation to a customer row (and records the seating as
    # their favourite table for next time).
    customer_id = save_customer(name, email, phone, seating, "", info.get("time", ""))

    conn = get_db_connection()
    if not conn:
        return None
    try:
        cur = conn.cursor()
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
            dietary,
            info.get("occasion", ""),
            seating,
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
        return None
    finally:
        conn.close()

    seating_line = f"\n🪑 Seating: {seating}" if seating else ""
    dietary_line = f"\n🥗 Preference: {dietary}" if dietary else ""

    text = f"""✅ RESERVATION CONFIRMED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Reservation ID: {reservation_id}
Restaurant: {RESTAURANT_DATA['name']}
Phone: {RESTAURANT_DATA['phone']}

👤 Name: {name}
📧 Email: {email}
📱 Phone: {phone}
👥 Party Size: {info.get('party_size')} people
📅 Date: {info.get('date')}
⏰ Time: {info.get('time')}{seating_line}{dietary_line}

📍 Address: {RESTAURANT_DATA['address']}

Thank you for choosing {RESTAURANT_DATA['name']}! 🍽️"""

    return {"text": text, "reservation_id": reservation_id}


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

Ask them politely for ONLY the missing information in a friendly way (1-2
sentences). The reservation is NOT saved yet - do not say it is confirmed,
booked, noted, or complete, and do not invent or restate any values."""

        response = get_ollama_response(prompt)
        # Safety net: a small model can ignore the instruction above and
        # write a confirmation-shaped reply anyway (this is exactly what
        # happened - it "noted" a reservation for a made-up guest count
        # while party size was still genuinely missing). Nothing is saved
        # to the database in this branch, so never let a reply that SOUNDS
        # like a confirmation reach the customer - fall back to the plain,
        # honest ask instead.
        if response and not _sounds_like_a_confirmation(response):
            return response, None
        else:
            return f"I'd be happy to help with a reservation! Please provide: {missing_str}", None

    # All required details are in - but DON'T save yet. Hand the collected
    # info back so the chatbot can gather the seating + dietary preferences
    # first; the row is only written once those are answered, by
    # save_reservation() via POST /api/reservations. Returning the info as
    # the second element (in place of a reservation_id) signals "ready for
    # preferences" to the caller.
    return (
        "Perfect — I've got all your details. Just two quick preferences before I confirm it:",
        {
            "party_size": info.get("party_size"),
            "date": info.get("date"),
            "time": info.get("time"),
            "name": info.get("name"),
            "phone": info.get("phone"),
            "email": info.get("email"),
        },
    )


def list_reservations():
    """Get all reservations (for admin) - phone/email aren't columns on
    reservations itself (only name/date/time/preferences are), so they're
    pulled in via a join against the customer row each booking is linked
    to. customer_id is stored as text on reservations but numeric on
    customers, hence the explicit cast to join them."""
    conn = get_db_connection()
    if not conn:
        return None

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT
                r.id, r.name, r.party_size, r.date, r.time, r.allergies, r.dietary,
                r.occasion, r.seating, r.status, r.created_at, r.customer_id,
                c.phone, c.email
            FROM reservations r
            LEFT JOIN customers c ON c.id::text = r.customer_id
            ORDER BY r.created_at DESC
        """)
        reservations = cur.fetchall()
        cur.close()
        return reservations
    except Exception as e:
        print(f"❌ Error listing reservations: {e}")
        return None
    finally:
        conn.close()


RESERVATION_STATUSES = ['confirmed', 'seated', 'completed', 'cancelled', 'no-show']


def update_reservation_status(reservation_id, status):
    """Move a reservation through its lifecycle (or mark it cancelled/a
    no-show) - mirrors update_order_status in orders.py."""
    if status not in RESERVATION_STATUSES:
        return False

    conn = get_db_connection()
    if not conn:
        return False

    try:
        cur = conn.cursor()
        cur.execute("UPDATE reservations SET status = %s WHERE id = %s", (status, reservation_id))
        updated = cur.rowcount > 0
        conn.commit()
        cur.close()
        return updated
    except Exception as e:
        print(f"❌ Error updating reservation status: {e}")
        return False
    finally:
        conn.close()
