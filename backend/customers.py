"""
Customer Recognition Module for Restaurant Chatbot
Handles: Customer Profiles, Personalized Greetings, Reservation History
"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()


def get_db_connection():
    return psycopg2.connect(
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT")
    )

# ============================================================================
# 1. CUSTOMER DATA STORE
# ============================================================================
# In-memory customer profile store, keyed by name.
# Reservation history itself lives in Postgres (see get_history below) and
# is linked back to a customer via customer_id, not stored here.

CUSTOMERS = {
    "Kabir": {
        "customer_id": "CUST-1001",
        "name": "Kabir",
        "email": "kabir@email.com",
        "phone": None,
        "visits": 3,
        "favorite_table": "corner",
        "favorite_dishes": ["Pasta Carbonara"],
    }
}


def _generate_customer_id():
    """Generate the next unique customer ID, e.g. CUST-1002."""
    return f"CUST-{len(CUSTOMERS) + 1001}"

# ============================================================================
# 2. CUSTOMER RECOGNITION
# ============================================================================

def recognize_customer(name):
    """
    Look up a customer by name and return their profile if they are a
    returning customer.

    Args:
        name (str): Customer name as provided by the chatbot user.

    Returns:
        dict | None: The customer profile if found, otherwise None.
    """
    if not name:
        return None

    # Match case-insensitively against stored customer names
    for stored_name, profile in CUSTOMERS.items():
        if stored_name.lower() == name.strip().lower():
            return profile

    return None

# ============================================================================
# 3. PERSONALIZED GREETING
# ============================================================================

def get_greeting(customer):
    """
    Build a personalized greeting message for a recognized customer.

    Args:
        customer (dict | None): Customer profile as returned by
            recognize_customer(). If None, a generic greeting is returned.

    Returns:
        str: A personalized (or generic) greeting message.
    """
    if not customer:
        return "Welcome to Srija's Taste! 🍽️ How can I help you today?"

    name = customer.get("name", "Guest")
    visits = customer.get("visits", 0)
    favorite_table = customer.get("favorite_table")
    favorite_dishes = customer.get("favorite_dishes", [])

    greeting = f"Welcome back, {name}! 😊 "

    if visits >= 3:
        greeting += f"It's great to see you again — this will be visit #{visits + 1}. "
    elif visits > 0:
        greeting += "Great to see you again! "

    if favorite_table:
        greeting += f"Would you like your usual {favorite_table} table? "

    if favorite_dishes:
        dishes = ", ".join(favorite_dishes)
        greeting += f"Can I tempt you with {dishes} again today?"

    return greeting.strip()

# ============================================================================
# 4. RESERVATION HISTORY
# ============================================================================

def get_history(customer_name):
    """
    Retrieve a customer's past reservations from the reservations table.

    Args:
        customer_name (str): Name of the customer to look up.

    Returns:
        list: List of reservation dicts (id, party_size, date, time),
            ordered most recent first. Empty list if the customer is
            not recognized or has no linked reservations.
    """
    customer = recognize_customer(customer_name)

    if not customer:
        return []

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, party_size, date, time
            FROM reservations
            WHERE customer_id = %s
            ORDER BY created_at DESC
        """, (customer["customer_id"],))

        rows = cur.fetchall()
        cur.close()
        conn.close()

        return [
            {"id": row[0], "party_size": row[1], "date": row[2], "time": row[3]}
            for row in rows
        ]

    except Exception as e:
        print(f"❌ Database error while fetching history: {e}")
        return []

# ============================================================================
# 5. SAVE NEW CUSTOMER
# ============================================================================

def save_customer(name, email, phone, preferences=None):
    """
    Save a new customer to the customer data store.

    Args:
        name (str): Customer's full name.
        email (str): Customer's email address.
        phone (str): Customer's phone number.
        preferences (dict, optional): Optional preferences dict with keys
            "favorite_table" (str) and "favorite_dishes" (list).

    Returns:
        dict: The newly created customer profile.
    """
    preferences = preferences or {}

    customer = {
        "customer_id": _generate_customer_id(),
        "name": name,
        "email": email,
        "phone": phone,
        "visits": 1,
        "favorite_table": preferences.get("favorite_table"),
        "favorite_dishes": preferences.get("favorite_dishes", []),
    }

    CUSTOMERS[name] = customer

    print(f"✅ New customer saved: {name}")

    return customer

# ============================================================================
# 6. MAIN (quick manual test)
# ============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("CUSTOMER RECOGNITION MODULE — QUICK TEST")
    print("=" * 70)

    returning = recognize_customer("kabir")
    print(get_greeting(returning))
    print("History:", get_history("Kabir"))

    new_customer = save_customer(
        "Ananya",
        "ananya@email.com",
        "+1-555-0199",
        {"favorite_table": "window", "favorite_dishes": ["Tiramisu"]},
    )
    print(get_greeting(new_customer))
    print("History:", get_history("Ananya"))
