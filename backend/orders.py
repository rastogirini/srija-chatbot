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


def get_orders_by_customer_id(customer_id):
    """Full order history for one customer (admin detail view) - matched by
    customer_id rather than name, since names aren't guaranteed unique."""
    if not customer_id:
        return []

    conn = get_db_connection()
    if not conn:
        return []

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT id, items, total, status, created_at
            FROM orders
            WHERE customer_id = %s
            ORDER BY created_at DESC
        """, (customer_id,))
        history = cur.fetchall()
        cur.close()
        return history
    except Exception as e:
        print(f"❌ Error getting orders by customer id: {e}")
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


ORDER_STATUSES = ['placed', 'preparing', 'ready', 'delivered', 'cancelled']


def update_order_status(order_id, status):
    """Move an order along its fulfillment lifecycle (or cancel it) - the
    `status` column has existed since the orders table was created but
    nothing ever wrote to it until now, so every order just sat at its
    default 'placed' value forever."""
    if status not in ORDER_STATUSES:
        return False

    conn = get_db_connection()
    if not conn:
        return False

    try:
        cur = conn.cursor()
        cur.execute("UPDATE orders SET status = %s WHERE id = %s", (status, order_id))
        updated = cur.rowcount > 0
        conn.commit()
        cur.close()
        return updated
    except Exception as e:
        print(f"❌ Error updating order status: {e}")
        return False
    finally:
        conn.close()


def get_revenue_summary(weeks=8, months=6):
    """Revenue (not profit - there's no cost-of-goods data anywhere in this
    schema, only what each order sold for) grouped by week and by month, for
    the admin dashboard's chart. date_trunc buckets created_at into calendar
    weeks/months; the WHERE clause caps how far back each series goes."""
    conn = get_db_connection()
    if not conn:
        return None

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT date_trunc('week', created_at) AS bucket, SUM(total) AS total
            FROM orders
            WHERE created_at >= date_trunc('week', NOW()) - (%s || ' weeks')::interval
            GROUP BY bucket
            ORDER BY bucket
        """, (weeks,))
        weekly = cur.fetchall()

        cur.execute("""
            SELECT date_trunc('month', created_at) AS bucket, SUM(total) AS total
            FROM orders
            WHERE created_at >= date_trunc('month', NOW()) - (%s || ' months')::interval
            GROUP BY bucket
            ORDER BY bucket
        """, (months,))
        monthly = cur.fetchall()

        cur.close()
        return {"weekly": weekly, "monthly": monthly}
    except Exception as e:
        print(f"❌ Error getting revenue summary: {e}")
        return None
    finally:
        conn.close()


def get_revenue_by_category():
    """Revenue split across 'food' and 'beauty', for the dashboard's
    category breakdown - same name-matching limitation as
    get_product_performance (orders link to a product by name, not id).
    An order-item name with no matching product row at all (e.g. a since-
    renamed or never-migrated item) falls into 'unknown' rather than being
    silently dropped or misattributed. DISTINCT ON picks one category per
    product name in case a name was ever reused across two rows."""
    conn = get_db_connection()
    if not conn:
        return None

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            WITH sales AS (
                SELECT
                    elem->>'name' AS product_name,
                    SUM(
                        COALESCE((elem->>'qty')::int, 1)
                        * COALESCE(NULLIF(REGEXP_REPLACE(elem->>'price', '[^0-9.]', '', 'g'), '')::numeric, 0)
                    ) AS revenue
                FROM orders, jsonb_array_elements(items) AS elem
                GROUP BY elem->>'name'
            ),
            -- Every name a product has gone by (current + former), so a
            -- renamed product's older orders still land in its category.
            product_categories AS (
                SELECT DISTINCT ON (known_name) known_name AS name, category
                FROM products, unnest(array_prepend(name, COALESCE(former_names, '{}'))) AS known_name
                ORDER BY known_name, created_at DESC
            )
            SELECT COALESCE(pc.category, 'unknown') AS category, SUM(s.revenue) AS revenue
            FROM sales s
            LEFT JOIN product_categories pc ON pc.name = s.product_name
            GROUP BY COALESCE(pc.category, 'unknown')
            ORDER BY revenue DESC
        """)
        rows = cur.fetchall()
        cur.close()
        return rows
    except Exception as e:
        print(f"❌ Error getting revenue by category: {e}")
        return None
    finally:
        conn.close()


def get_top_spender_ids(limit=3):
    """The `limit` customers who have spent the most across all their
    orders - used to mark "star" customers on the admin dashboard. Only
    customers with at least one order can appear (INNER JOIN via GROUP BY),
    which is correct - someone with zero orders hasn't spent anything."""
    conn = get_db_connection()
    if not conn:
        return []

    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT customer_id
            FROM orders
            WHERE customer_id IS NOT NULL
            GROUP BY customer_id
            ORDER BY SUM(total) DESC
            LIMIT %s
        """, (limit,))
        ids = [row[0] for row in cur.fetchall()]
        cur.close()
        return ids
    except Exception as e:
        print(f"❌ Error getting top spenders: {e}")
        return []
    finally:
        conn.close()
