"""Customer recognition, profile enrichment, and persistence."""

import re

from psycopg2.extras import RealDictCursor

from db import get_db_connection


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


def list_customers():
    """Get all customers (for admin)"""
    conn = get_db_connection()
    if not conn:
        return None

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM customers ORDER BY visits DESC")
        customers = cur.fetchall()
        cur.close()
        return customers
    except Exception as e:
        print(f"❌ Error listing customers: {e}")
        return None
    finally:
        conn.close()
