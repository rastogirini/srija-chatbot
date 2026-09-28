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
    if not customer:
        return "Welcome to Srija's Taste! 🍽️"

    visits = customer.get('visits', 1)
    if visits == 1:
        return f"Hi, {customer['name']}! 👋"

    greeting = (
        f"Welcome back, {customer['name']}! 👋\n"
        f"It's great to see you again — this will be visit #{visits + 1}!"
    )
    # `customer.get('favorite_table', default)` returns None (not the
    # default) for a NULL column - psycopg2 always includes the key - and an
    # f-string then prints that as the literal "None". Only add this line
    # when there's an actual seating preference on file to "remember".
    favorite_table = customer.get('favorite_table') or None
    if favorite_table:
        greeting += f"\nI remember you love our {favorite_table} tables!"
    return greeting


def get_recommendations(customer):
    """Personalized recommendations - only bullets we can back with data
    actually on file. Returns None when there's nothing real to say, so the
    caller drops the whole block instead of showing generic filler under a
    "Personalized" header for a customer we don't really know yet."""
    if not customer:
        return None

    favorite_dishes = customer.get('favorite_dishes') or None
    favorite_table = customer.get('favorite_table') or None

    if not favorite_dishes and not favorite_table:
        return None

    lines = ["💡 Personalized Recommendations:"]
    if favorite_dishes:
        lines.append(f"• You loved {favorite_dishes} last time!")
    if favorite_table:
        lines.append(f"• Your favorite {favorite_table} table is available")
    lines.append("• Try our new seasonal specials")
    return "\n".join(lines)


def save_customer(name, email=None, phone=None, favorite_table=None, favorite_dishes=None, favorite_time=None, interests=None):
    """Save or update customer and return customer_id. `interests` is a list
    of strings (e.g. ['food', 'beauty']), stored comma-joined."""
    if not name:
        return None

    interests_str = ",".join(interests) if interests else None

    conn = get_db_connection()
    if not conn:
        return None

    try:
        cur = conn.cursor()

        # Email is the most reliable identifier for a customer (same
        # philosophy as recognize_customer's search priority) - match on it
        # alone, case-insensitively, whenever it's given. Requiring phone to
        # also match (the old behavior) meant the same person calling in
        # with no phone one time and a phone the next got split into two
        # rows under the identical name+email - exactly how "sita"/"Sita"
        # duplicated even though both had the same email on file.
        # Only fall back to name+phone matching when there's no email at
        # all (e.g. a bare persona greeting with just a name).
        if email:
            cur.execute("SELECT id FROM customers WHERE LOWER(email) = LOWER(%s)", (email,))
        else:
            cur.execute(
                "SELECT id FROM customers WHERE LOWER(name) = LOWER(%s) AND phone IS NOT DISTINCT FROM %s AND email IS NULL",
                (name, phone)
            )
        existing = cur.fetchone()

        if existing:
            # Update visits AND preferences. `COALESCE(%s, interests)` so a
            # call that doesn't know about interests (e.g. from placing an
            # order) doesn't wipe out what was captured at sign-up.
            customer_id = existing[0]
            cur.execute("""
                UPDATE customers
                SET visits = visits + 1,
                    favorite_table = %s,
                    favorite_dishes = %s,
                    favorite_time = %s,
                    interests = COALESCE(%s, interests),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (favorite_table, favorite_dishes, favorite_time, interests_str, customer_id))
        else:
            # Add new customer WITH preferences
            cur.execute("""
                INSERT INTO customers (name, email, phone, favorite_table, favorite_dishes, favorite_time, interests)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (name, email, phone, favorite_table, favorite_dishes, favorite_time, interests_str))
            customer_id = cur.fetchone()[0]

        conn.commit()
        cur.close()
        conn.close()

        print(f"✅ Customer saved: {name}, ID: {customer_id}")
        return customer_id

    except Exception as e:
        print(f"❌ Error saving customer: {e}")
        return None


def find_customer_by_id(customer_id):
    """Look up one customer by id, for the admin detail view. Explicit
    column list (not SELECT *) so `password` never leaves the server."""
    if not customer_id:
        return None

    conn = get_db_connection()
    if not conn:
        return None

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT id, name, email, phone, visits, favorite_table, favorite_time,
                   favorite_dishes, interests, role, created_at, updated_at
            FROM customers
            WHERE id = %s
        """, (customer_id,))
        customer = cur.fetchone()
        cur.close()
        return customer
    except Exception as e:
        print(f"❌ Error finding customer by id: {e}")
        return None
    finally:
        conn.close()


def update_customer(customer_id, name=None, email=None, phone=None, interests=None):
    """Admin edit of an existing customer's own details - the one gap the
    admin panel had until now was view-only, so fixing a typo'd phone number
    or a wrong interest (like Sita's "makeup" vs "beauty" mix-up, fixed by
    hand via SQL before this existed) required a raw database command.
    `interests` is a list of strings, stored comma-joined - same convention
    as save_customer(). Role/visits/password are intentionally never
    touched here; this only edits what a customer could have entered themselves."""
    if not customer_id:
        return False

    conn = get_db_connection()
    if not conn:
        return False

    try:
        cur = conn.cursor()
        interests_str = ",".join(interests) if interests is not None else None
        cur.execute("""
            UPDATE customers
            SET name = COALESCE(%s, name),
                email = COALESCE(%s, email),
                phone = %s,
                interests = COALESCE(%s, interests),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (name, email, phone, interests_str, customer_id))
        updated = cur.rowcount > 0
        conn.commit()
        cur.close()
        return updated
    except Exception as e:
        print(f"❌ Error updating customer: {e}")
        return False
    finally:
        conn.close()


def find_customer_by_login(name, email):
    """Look up a customer by an exact name+email pair - used to validate a
    real sign-in, as opposed to recognize_customer's best-effort matching
    used mid-conversation."""
    if not name or not email:
        return None

    conn = get_db_connection()
    if not conn:
        return None

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "SELECT * FROM customers WHERE LOWER(name) = LOWER(%s) AND LOWER(email) = LOWER(%s)",
            (name, email)
        )
        customer = cur.fetchone()
        cur.close()
        return customer
    except Exception as e:
        print(f"❌ Error finding customer by login: {e}")
        return None
    finally:
        conn.close()


def find_admin_by_password(password):
    """Check a password against the admin account(s) - used to guard the
    admin listing endpoints, tied to the real customer record (role='admin')
    instead of a separate hardcoded secret."""
    if not password:
        return None

    conn = get_db_connection()
    if not conn:
        return None

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM customers WHERE role = 'admin' AND password = %s", (password,))
        admin = cur.fetchone()
        cur.close()
        return admin
    except Exception as e:
        print(f"❌ Error checking admin password: {e}")
        return None
    finally:
        conn.close()


def find_customer_by_email(email):
    """Look up a customer by email alone - used at sign-up time to detect
    an email already registered under a different name."""
    if not email:
        return None

    conn = get_db_connection()
    if not conn:
        return None

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM customers WHERE LOWER(email) = LOWER(%s)", (email,))
        customer = cur.fetchone()
        cur.close()
        return customer
    except Exception as e:
        print(f"❌ Error finding customer by email: {e}")
        return None
    finally:
        conn.close()


def list_customers():
    """Get all customers (for admin). Explicit column list so `password`
    never leaves the server, even to the admin UI - no legitimate reason
    for it to appear in this response."""
    conn = get_db_connection()
    if not conn:
        return None

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT id, name, email, phone, visits, favorite_table, favorite_time,
                   favorite_dishes, interests, role, created_at, updated_at
            FROM customers
            ORDER BY visits DESC
        """)
        customers = cur.fetchall()
        cur.close()
        return customers
    except Exception as e:
        print(f"❌ Error listing customers: {e}")
        return None
    finally:
        conn.close()
