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


def insert_product(cur, data, image_url, created_at=None, import_batch_id=None):
    """The products INSERT itself, on a caller-owned cursor - save_product
    wraps it in its own connection for one-off adds; bulk_import runs it
    once per row inside a single transaction, so a failed upload leaves
    nothing half-imported. Returns the new product id."""
    cur.execute("""
        INSERT INTO products (
            category, name, price, description, image, cuisine, diet, course, subcategory,
            protein, nutrition, meal_time, fried, curry, stock, import_batch_id, created_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, COALESCE(%s, CURRENT_TIMESTAMP))
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
        data.get("stock"),
        import_batch_id,
        created_at,
    ))
    return cur.fetchone()[0]


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
        product_id = insert_product(cur, data, image_url, created_at)
        conn.commit()
        cur.close()
        print(f"✅ Product saved: {data.get('name')} (id={product_id})")
        return product_id
    except Exception as e:
        print(f"❌ Error saving product: {e}")
        return None
    finally:
        conn.close()


def get_product(product_id):
    """One live product by id, for the admin Edit form. None if it doesn't
    exist or was deleted."""
    conn = get_db_connection()
    if not conn:
        return None

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM products WHERE id = %s AND is_deleted = FALSE", (product_id,))
        row = cur.fetchone()
        cur.close()
        return row
    except Exception as e:
        print(f"❌ Error getting product: {e}")
        return None
    finally:
        conn.close()


def name_taken(name, exclude_id=None):
    """True if another live product already uses `name` (case-insensitive)
    as its current OR a former name. Former names count because old orders
    still carry them - letting a new product take one would credit the old
    product's past sales to it as well."""
    conn = get_db_connection()
    if not conn:
        return None

    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT 1 FROM products
            WHERE is_deleted = FALSE AND id IS DISTINCT FROM %s
              AND (LOWER(name) = LOWER(%s)
                   OR EXISTS (SELECT 1 FROM unnest(former_names) f WHERE LOWER(f) = LOWER(%s)))
            LIMIT 1
        """, (exclude_id, name, name))
        taken = cur.fetchone() is not None
        cur.close()
        return taken
    except Exception as e:
        print(f"❌ Error checking product name: {e}")
        return None
    finally:
        conn.close()


_KEEP_IMAGE = object()


def update_product(product_id, data, image_url=_KEEP_IMAGE):
    """Overwrite the admin-editable fields of a live product - the same
    fields the Add Product form collects. The food enrichment fields only
    the menu migration sets (protein/nutrition/meal_time/fried/curry) are
    deliberately left untouched, so editing a migrated dish never wipes them.

    `image_url` is the new photo path, None to remove the photo, or omitted
    to keep the current one. On a rename, the old name is remembered in
    former_names (see db.py) so the product keeps its sales history.

    Returns (True, replaced_image) - the old image path if it was replaced
    or removed, so the caller can delete the file - (False, None) if the
    product doesn't exist or was deleted, or None on a database error."""
    conn = get_db_connection()
    if not conn:
        return None

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT name, image FROM products WHERE id = %s AND is_deleted = FALSE FOR UPDATE", (product_id,))
        current = cur.fetchone()
        if not current:
            conn.rollback()
            return (False, None)

        keep_image = image_url is _KEEP_IMAGE
        new_image = current["image"] if keep_image else image_url
        old_name = current["name"]
        cur.execute("""
            UPDATE products SET
                category = %s, name = %s, price = %s, description = %s,
                cuisine = %s, diet = %s, course = %s, subcategory = %s,
                stock = %s, image = %s,
                -- Remember the old name on a rename; drop the new name from
                -- the list if it's being renamed back to an earlier one.
                former_names = array_remove(
                    CASE WHEN %s <> %s AND NOT (%s = ANY(COALESCE(former_names, '{}')))
                         THEN array_append(COALESCE(former_names, '{}'), %s)
                         ELSE COALESCE(former_names, '{}') END,
                    %s)
            WHERE id = %s
        """, (
            data.get("category"), data.get("name"), data.get("price"), data.get("description"),
            data.get("cuisine"), data.get("diet"), data.get("course"), data.get("subcategory"),
            data.get("stock"), new_image,
            old_name, data.get("name"), old_name, old_name,
            data.get("name"),
            product_id,
        ))
        conn.commit()
        cur.close()
        print(f"✅ Product updated: {data.get('name')} (id={product_id})")
        replaced = None if keep_image or current["image"] == new_image else current["image"]
        return (True, replaced)
    except Exception as e:
        conn.rollback()
        print(f"❌ Error updating product: {e}")
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

    Also flags `is_dead_stock` and `on_sale_candidate` - two distinct,
    mutually exclusive signals split out of what used to be one broad
    "not selling well" flag, since they call for different fixes. Both
    require at least MIN_DAYS_LIVE days live, so a 2-day-old product with 0
    sales is never flagged either way - it just hasn't had a chance yet.
    `is_dead_stock` is zero sales at all (a discount won't fix zero
    demand - the real option is pulling the item). `on_sale_candidate` is
    1 to MAX_UNITS_FOR_FLAG units sold (selling, just barely - a discount
    candidate).

    Also flags `is_top_seller`: the TOP_SELLER_COUNT highest units_sold
    products WITHIN EACH CATEGORY, as long as they've actually sold at
    least one unit - if fewer than TOP_SELLER_COUNT products in that
    category have any sales at all, only those with real sales get the
    flag rather than padding it out with zero-sale rows. Ranked per
    category (not globally) because food and beauty aren't comparable by
    raw units sold - a ₹75 samosa selling 14 times and a ₹899 lipstick
    selling twice aren't really "underperforming" relative to each other,
    they're different businesses with different price points and volumes;
    a global top-3 would always be dominated by whichever category has
    higher natural order volume.

    Also includes `stock` and flags `is_low_stock` (stock at or below
    LOW_STOCK_THRESHOLD) - physical inventory, unrelated to is_dead_stock
    above (that's about sales history, this is about units on hand)."""
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
            -- Summed across the current name and any former names (a
            -- renamed product's older orders still carry the old name).
            SELECT
                p.id, p.name, p.category, p.price, p.image, p.created_at, p.stock, p.course, p.subcategory,
                p.former_names,
                COALESCE(SUM(s.units_sold), 0)::int AS units_sold,
                COALESCE(SUM(s.revenue), 0) AS revenue,
                EXTRACT(DAY FROM NOW() - p.created_at)::int AS days_live
            FROM products p
            LEFT JOIN sales s ON s.product_name = p.name OR s.product_name = ANY(p.former_names)
            WHERE p.is_deleted = FALSE
            GROUP BY p.id
            ORDER BY units_sold DESC, p.created_at DESC
        """)
        rows = cur.fetchall()
        cur.close()

        for row in rows:
            # Dead stock (zero sales at all) is split out from "consider a
            # sale" (selling, just barely) rather than overlapping with it -
            # they're different problems with different fixes: a discount
            # might revive something that's sold 1-2 units, but won't fix
            # zero demand, where pulling the item is the real option.
            row["is_dead_stock"] = row["days_live"] >= MIN_DAYS_LIVE and row["units_sold"] == 0
            row["on_sale_candidate"] = (
                row["days_live"] >= MIN_DAYS_LIVE
                and 1 <= row["units_sold"] <= MAX_UNITS_FOR_FLAG
            )
            row["is_top_seller"] = False
            # Inventory stock (physical units on hand), separate from
            # is_dead_stock above (that's a sales-performance signal, zero
            # sales ever - this is a different thing, running low on actual
            # stock). Only meaningful for a product an admin has actually
            # turned tracking on for - untracked (stock IS NULL) never flags.
            row["is_low_stock"] = row["stock"] is not None and row["stock"] <= LOW_STOCK_THRESHOLD

        # Rows already come back ordered by units_sold DESC, so grouping by
        # category preserves that order within each group - the first
        # TOP_SELLER_COUNT rows per category are its top sellers.
        by_category = {}
        for row in rows:
            by_category.setdefault(row["category"], []).append(row)
        for category_rows in by_category.values():
            for row in category_rows[:TOP_SELLER_COUNT]:
                if row["units_sold"] > 0:
                    row["is_top_seller"] = True

        return rows
    except Exception as e:
        print(f"❌ Error getting product performance: {e}")
        return None
    finally:
        conn.close()


def get_public_bestsellers():
    """Top-seller products across all categories, safe to show customers -
    reuses get_product_performance()'s per-category top-3-by-units-sold
    logic (so "best seller" means the same thing here as on the admin Best
    Sellers page), but strips out business-sensitive fields (revenue,
    units_sold, stock) that function returns for admin only."""
    performance = get_product_performance()
    if performance is None:
        return None
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "category": row["category"],
            "subcategory": row.get("subcategory"),
            "price": row["price"],
            "image": row["image"],
        }
        for row in performance if row["is_top_seller"]
    ]


def find_unavailable_names(names):
    """Given a list of cart item names, return the subset that match a
    now-deleted product - used at checkout so an order can be blocked with a
    clear reason instead of silently succeeding with a discontinued item.
    A name with no matching row at all (deleted or not) is a hardcoded
    catalog item, which can never be deleted, so it's always available.

    Names are matched against former names too (a cart saved before a
    rename still holds the old one), and a name that also belongs to a
    live product isn't blocked - deleting "Samosa" and re-adding it as a
    new product shouldn't make the new one unbuyable."""
    if not names:
        return []

    conn = get_db_connection()
    if not conn:
        return []

    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT n FROM unnest(%s::text[]) AS n
            WHERE EXISTS (SELECT 1 FROM products
                          WHERE is_deleted = TRUE AND (name = n OR n = ANY(former_names)))
              AND NOT EXISTS (SELECT 1 FROM products
                              WHERE is_deleted = FALSE AND (name = n OR n = ANY(former_names)))
        """, (list(names),))
        return [row[0] for row in cur.fetchall()]
    except Exception as e:
        print(f"❌ Error checking product availability: {e}")
        return []
    finally:
        conn.close()


LOW_STOCK_THRESHOLD = 5


def update_product_stock(product_id, stock):
    """Set a product's stock count - `stock` of None switches it back to
    untracked/unlimited (the default for every product today), any other
    value turns tracking on for it. Admin-only, via the Products page."""
    conn = get_db_connection()
    if not conn:
        return False

    try:
        cur = conn.cursor()
        cur.execute("UPDATE products SET stock = %s WHERE id = %s", (stock, product_id))
        updated = cur.rowcount > 0
        conn.commit()
        cur.close()
        return updated
    except Exception as e:
        print(f"❌ Error updating stock: {e}")
        return False
    finally:
        conn.close()


def find_insufficient_stock(items):
    """Given cart items ([{name, qty}, ...]), return the subset that ask for
    more than a tracked product currently has in stock - same checkout-time
    blocking pattern as find_unavailable_names. A product with NULL stock
    (untracked - the default) or no matching row at all never blocks here,
    same reasoning as find_unavailable_names: nothing to check it against."""
    if not items:
        return []

    names = [item.get("name") for item in items if item.get("name")]
    if not names:
        return []

    conn = get_db_connection()
    if not conn:
        return []

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT name, former_names, stock FROM products
            WHERE is_deleted = FALSE AND stock IS NOT NULL
              AND (name = ANY(%s) OR former_names && %s::text[])
        """, (names, names))
        stock_by_name = {}
        for row in cur.fetchall():
            for known_name in [*(row["former_names"] or []), row["name"]]:
                stock_by_name[known_name] = row["stock"]
        cur.close()

        insufficient = []
        for item in items:
            name = item.get("name")
            if name in stock_by_name:
                requested = item.get("qty") or 1
                available = stock_by_name[name]
                if requested > available:
                    insufficient.append({"name": name, "requested": requested, "available": available})
        return insufficient
    except Exception as e:
        print(f"❌ Error checking stock: {e}")
        return []
    finally:
        conn.close()


def decrement_stock(items):
    """After an order is placed, reduce stock for any tracked product in it
    by the quantity ordered - floored at 0 as a safety net against a race
    between two near-simultaneous orders slipping past find_insufficient_stock
    (there's no real concurrency control here, just a sane floor)."""
    if not items:
        return

    conn = get_db_connection()
    if not conn:
        return

    try:
        cur = conn.cursor()
        for item in items:
            name = item.get("name")
            qty = item.get("qty") or 1
            if not name:
                continue
            cur.execute("""
                UPDATE products SET stock = GREATEST(0, stock - %s)
                WHERE (name = %s OR %s = ANY(former_names)) AND stock IS NOT NULL AND is_deleted = FALSE
            """, (qty, name, name))
        conn.commit()
        cur.close()
    except Exception as e:
        print(f"❌ Error decrementing stock: {e}")
    finally:
        conn.close()
