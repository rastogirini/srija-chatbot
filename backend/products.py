"""Product creation for the admin "Add Product" form - lets a shopkeeper
upload a real product (with a real image file) instead of a developer
hand-editing the hardcoded catalogs in config.py."""

import os
import uuid

from psycopg2.extras import Json, RealDictCursor

from db import get_db_connection

# Flask serves anything under backend/static/ automatically at /static/... -
# saving here means no extra route is needed to serve the uploaded images.
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "static", "uploads")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}


def _allowed_image(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def save_uploaded_image(file_storage):
    """Save an uploaded image to disk under a random name (so two shopkeepers
    uploading "photo.jpg" don't overwrite each other) and return its public
    URL path. Returns None if no file was given or it's not an allowed type."""
    if not file_storage or not file_storage.filename:
        return None
    if not _allowed_image(file_storage.filename):
        return None

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = file_storage.filename.rsplit(".", 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    file_storage.save(os.path.join(UPLOAD_DIR, filename))
    return f"/static/uploads/{filename}"


def save_product(data, image_url, created_at=None):
    """Insert a new product row. Food-only fields (cuisine/diet/course/
    protein/nutrition/meal_time/fried) and the beauty-only field
    (subcategory) are left NULL for the other category - one table, two
    shapes, same pattern as customers.interests. The admin "Add Product"
    form doesn't collect protein/nutrition/meal_time/fried, so those stay
    NULL for anything it creates; only the menu-migration script sets them.
    `created_at` is optional and only used by that same migration script, to
    backdate long-standing menu items instead of them all appearing "new"."""
    conn = get_db_connection()
    if not conn:
        return None

    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO products (
                category, name, price, description, image, cuisine, diet, course, subcategory,
                protein, nutrition, meal_time, fried, curry, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, COALESCE(%s, CURRENT_TIMESTAMP))
            RETURNING id
        """, (
            data.get("category"),
            data.get("name"),
            data.get("price"),
            data.get("description"),
            image_url,
            data.get("cuisine"),
            data.get("diet"),
            data.get("course"),
            data.get("subcategory"),
            data.get("protein"),
            Json(data["nutrition"]) if data.get("nutrition") else None,
            data.get("meal_time"),
            data.get("fried", False),
            data.get("curry", False),
            created_at,
        ))
        product_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        print(f"✅ Product saved: {data.get('name')} (id={product_id})")
        return product_id
    except Exception as e:
        print(f"❌ Error saving product: {e}")
        return None
    finally:
        conn.close()


def list_products(category=None, include_deleted=False):
    """Products, optionally filtered to one category. Deleted products are
    excluded by default - this is what makes a deleted product actually
    disappear from customers (the main site's menu and the chatbot's
    suggestions), not just hidden in the admin panel. `include_deleted` is
    used by the admin Products list and the checkout-availability check,
    which both need to see deleted rows too."""
    conn = get_db_connection()
    if not conn:
        return None

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        clauses = [] if include_deleted else ["is_deleted = FALSE"]
        params = []
        if category:
            clauses.append("category = %s")
            params.append(category)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        cur.execute(f"SELECT * FROM products {where} ORDER BY created_at DESC", params)
        rows = cur.fetchall()
        cur.close()
        return rows
    except Exception as e:
        print(f"❌ Error listing products: {e}")
        return None
    finally:
        conn.close()


def soft_delete_product(product_id):
    """Mark a product deleted (never physically remove the row - keeping it
    as a tombstone is what lets checkout later recognize "this exact name
    used to exist and was removed" instead of confusing it with a hardcoded
    catalog item that was never in the database at all).

    Returns (True, image_path) if a row was actually deleted - image_path
    may legitimately be None if the product had no photo - or (False, None)
    if the id doesn't exist (or was already deleted). Returning a plain
    image_path alone would make "deleted, no photo" and "not found"
    indistinguishable, since both would be None."""
    conn = get_db_connection()
    if not conn:
        return (False, None)

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            UPDATE products SET is_deleted = TRUE
            WHERE id = %s AND is_deleted = FALSE
            RETURNING image
        """, (product_id,))
        row = cur.fetchone()
        conn.commit()
        cur.close()
        return (True, row["image"]) if row else (False, None)
    except Exception as e:
        print(f"❌ Error deleting product: {e}")
        return (False, None)
    finally:
        conn.close()


def get_product_performance():
    """Every live product with how many units it's actually sold and how
    much revenue it's generated - answers "which of my products is actually
    working?" (the underlying question behind the "Top Spender" feature,
    just grouped by product instead of customer). Orders link to a product
    by NAME, not id (same limitation as the checkout-availability check),
    so sales are aggregated by matching order-item names against live
    product names.

    Also flags `on_sale_candidate`: a product that's been live a while with
    barely any sales - a real signal something's not working, as opposed to
    a brand-new item that just hasn't had a chance yet. A product needs to
    have been live at least MIN_DAYS_LIVE days AND sold at most
    MAX_UNITS_FOR_FLAG units to get flagged; a 2-day-old product with 0
    sales is not flagged, a 30-day-old one is.

    Also flags `is_top_seller`: the TOP_SELLER_COUNT highest units_sold
    products, as long as they've actually sold at least one unit - if fewer
    than TOP_SELLER_COUNT products have any sales at all, only those with
    real sales get the flag rather than padding it out with zero-sale rows."""
    MIN_DAYS_LIVE = 14
    MAX_UNITS_FOR_FLAG = 2
    TOP_SELLER_COUNT = 3

    conn = get_db_connection()
    if not conn:
        return None

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            WITH sales AS (
                SELECT
                    elem->>'name' AS product_name,
                    SUM(COALESCE((elem->>'qty')::int, 1)) AS units_sold,
                    SUM(
                        COALESCE((elem->>'qty')::int, 1)
                        * COALESCE(NULLIF(REGEXP_REPLACE(elem->>'price', '[^0-9.]', '', 'g'), '')::numeric, 0)
                    ) AS revenue
                FROM orders, jsonb_array_elements(items) AS elem
                GROUP BY elem->>'name'
            )
            SELECT
                p.id, p.name, p.category, p.price, p.image, p.created_at,
                COALESCE(s.units_sold, 0) AS units_sold,
                COALESCE(s.revenue, 0) AS revenue,
                EXTRACT(DAY FROM NOW() - p.created_at)::int AS days_live
            FROM products p
            LEFT JOIN sales s ON s.product_name = p.name
            WHERE p.is_deleted = FALSE
            ORDER BY units_sold DESC, p.created_at DESC
        """)
        rows = cur.fetchall()
        cur.close()

        for row in rows:
            row["on_sale_candidate"] = row["days_live"] >= MIN_DAYS_LIVE and row["units_sold"] <= MAX_UNITS_FOR_FLAG
            row["is_top_seller"] = False

        # Rows already come back ordered by units_sold DESC, so the first
        # TOP_SELLER_COUNT rows are the top sellers - just need to stop
        # short if there aren't that many products with real sales.
        for row in rows[:TOP_SELLER_COUNT]:
            if row["units_sold"] > 0:
                row["is_top_seller"] = True

        return rows
    except Exception as e:
        print(f"❌ Error getting product performance: {e}")
        return None
    finally:
        conn.close()


def find_unavailable_names(names):
    """Given a list of cart item names, return the subset that match a
    now-deleted product - used at checkout so an order can be blocked with a
    clear reason instead of silently succeeding with a discontinued item.
    A name with no matching row at all (deleted or not) is a hardcoded
    catalog item, which can never be deleted, so it's always available."""
    if not names:
        return []

    conn = get_db_connection()
    if not conn:
        return []

    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT name FROM products
            WHERE is_deleted = TRUE AND name = ANY(%s)
        """, (list(names),))
        return [row[0] for row in cur.fetchall()]
    except Exception as e:
        print(f"❌ Error checking product availability: {e}")
        return []
    finally:
        conn.close()
