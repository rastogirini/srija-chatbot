"""Order placement and history."""

from datetime import datetime

from psycopg2.extras import RealDictCursor, Json

from customers import save_customer
from db import get_db_connection


def place_order(items, total, customer_name=None, customer_phone=None, customer_email=None):
    """Save a placed order and return its confirmation details, or None on failure."""
    if not items:
        return None

    order_id = f"ORD-{int(datetime.now().timestamp() % 100000)}"

    # Reuse the same customer record reservations link to, so an order and a
    # reservation from the same person end up under one customer_id.
    customer_id = None
    if customer_name:
        customer_id = save_customer(customer_name, customer_email, customer_phone)

    conn = get_db_connection()
    if not conn:
        return None

    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO orders (id, customer_name, customer_phone, customer_email, items, total, customer_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            order_id,
            customer_name,
            customer_phone,
            customer_email,
            Json(items),
            total,
            customer_id,
        ))
        conn.commit()
        cur.close()
        print(f"✅ Order saved: {order_id}")
        return {'id': order_id, 'total': total, 'items': items}
    except Exception as e:
        print(f"❌ Error saving order: {e}")
        return None
    finally:
        conn.close()


def get_order_history(customer_name, limit=5):
    """Get a customer's past orders, most recent first."""
    if not customer_name:
        return []

    conn = get_db_connection()
    if not conn:
        return []

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT id, items, total, status, created_at
            FROM orders
            WHERE LOWER(customer_name) = LOWER(%s)
            ORDER BY created_at DESC
            LIMIT %s
        """, (customer_name, limit))
        history = cur.fetchall()
        cur.close()
        return history
    except Exception as e:
        print(f"❌ Error getting order history: {e}")
        return []
    finally:
        conn.close()


def list_orders():
    """Get all orders (for admin)."""
    conn = get_db_connection()
    if not conn:
        return None

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM orders ORDER BY created_at DESC")
        orders = cur.fetchall()
        cur.close()
        return orders
    except Exception as e:
        print(f"❌ Error listing orders: {e}")
        return None
    finally:
        conn.close()
