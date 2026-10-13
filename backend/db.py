"""Database connection, schema initialization, and chat history persistence."""

import psycopg2

from config import DB_CONFIG


def get_db_connection():
    """Get PostgreSQL connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        return None


def init_database():
    """Initialize PostgreSQL tables"""
    conn = get_db_connection()
    if not conn:
        print("❌ Cannot connect to database!")
        return

    try:
        cur = conn.cursor()

        # Create customers table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100),
                phone VARCHAR(20),
                visits INTEGER DEFAULT 1,
                favorite_table VARCHAR(50),
                favorite_time VARCHAR(20),
                favorite_dishes TEXT,
                interests VARCHAR(200),
                password VARCHAR(100),
                role VARCHAR(20) DEFAULT 'customer',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(name, phone, email)
            )
        """)

        # Existing databases from before these columns existed won't get them
        # from CREATE TABLE IF NOT EXISTS above - add them separately so
        # upgrades work. `password` is only ever set for the admin account
        # today - regular customers still log in by name+email alone.
        cur.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS interests VARCHAR(200)")
        cur.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS password VARCHAR(100)")
        cur.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'customer'")

        # Create reservations table
        # NOTE: schema intentionally matches the columns handle_reservation_request
        # actually writes (id/name/date/time/customer_id, not reservation_id/
        # customer_name/reservation_date/reservation_time) - the live database
        # already has a table in this shape from before init_database()'s DDL
        # was introduced, so this keeps fresh installs consistent with it.
        cur.execute("""
            CREATE TABLE IF NOT EXISTS reservations (
                id VARCHAR(20) PRIMARY KEY,
                name VARCHAR(100),
                party_size INTEGER,
                date VARCHAR(20),
                time VARCHAR(20),
                allergies TEXT,
                dietary TEXT,
                occasion TEXT,
                seating TEXT,
                instructions TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                customer_id VARCHAR(20)
            )
        """)
        # Defaults to 'confirmed' (not 'placed' like orders) - a reservation
        # row is only ever created once save_reservation() runs, by which
        # point the booking is already fully confirmed, not pending.
        cur.execute("ALTER TABLE reservations ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'confirmed'")

        # Create chat_history table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS chat_history (
                id SERIAL PRIMARY KEY,
                customer_name VARCHAR(100),
                user_message TEXT,
                bot_response TEXT,
                intent VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Create orders table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id VARCHAR(20) PRIMARY KEY,
                customer_name VARCHAR(100),
                customer_phone VARCHAR(20),
                customer_email VARCHAR(100),
                items JSONB NOT NULL,
                total INTEGER NOT NULL,
                status VARCHAR(20) DEFAULT 'placed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                customer_id INTEGER
            )
        """)

        # Create products table - lets a shopkeeper add real products via the
        # admin "Add Product" form. cuisine/diet/course are food-only fields;
        # subcategory is beauty-only - nullable so either category leaves
        # the other's columns empty rather than needing separate tables.
        cur.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                category VARCHAR(20) NOT NULL,
                name VARCHAR(200) NOT NULL,
                price NUMERIC NOT NULL,
                description TEXT,
                image VARCHAR(500),
                cuisine VARCHAR(50),
                diet VARCHAR(100),
                course VARCHAR(50),
                subcategory VARCHAR(50),
                is_deleted BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE")

        # Food-only enrichment fields, food-side parity with the hardcoded
        # menu (protein level, macro estimates, meal-time tags, fried flag) -
        # nullable, since admin-added products don't collect these yet.
        cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS protein VARCHAR(20)")
        cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS nutrition JSONB")
        cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS meal_time VARCHAR(100)")
        cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS fried BOOLEAN DEFAULT FALSE")
        cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS curry BOOLEAN DEFAULT FALSE")

        # NULL (the default) means "untracked" - behaves exactly like today,
        # unlimited availability - since there's no real inventory data
        # behind any existing product. Tracking only turns on for a product
        # once an admin explicitly sets a real stock number on it.
        cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER")

        # One row per admin bulk upload (spreadsheet + photos). The uploaded
        # file itself is never stored - only this summary, plus each product
        # it created pointing back here via products.import_batch_id, which
        # is what lets an old upload be re-downloaded later (rebuilt from the
        # live product rows, so it shows current price/stock, not stale ones).
        cur.execute("""
            CREATE TABLE IF NOT EXISTS import_batches (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255),
                added_count INTEGER DEFAULT 0,
                skipped_count INTEGER DEFAULT 0,
                warning_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # NULL for anything added one at a time (the "Add Product" form, the
        # menu migration) - only bulk-imported products carry a batch id.
        cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS import_batch_id INTEGER")

        # Every name a product has had before an admin renamed it. Orders
        # (and customers' saved carts) store item NAMES, not ids, so sales
        # history, revenue-by-category and checkout stock checks match on
        # name OR any former name - otherwise fixing a typo would orphan a
        # product's whole sales history.
        cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS former_names TEXT[] DEFAULT '{}'")

        conn.commit()
        print("✅ Database tables initialized")
        cur.close()

    except Exception as e:
        print(f"❌ Error initializing database: {e}")
    finally:
        conn.close()


def save_chat_history(customer_name, user_message, bot_response, intent):
    """Persist one chat turn to the chat_history table"""
    try:
        conn = get_db_connection()
        if conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO chat_history (customer_name, user_message, bot_response, intent)
                VALUES (%s, %s, %s, %s)
            """, (customer_name, user_message, bot_response, intent))
            conn.commit()
            cur.close()
            print("✅ Chat history saved!")
            conn.close()
    except Exception as e:
        print(f"❌ Error saving chat history: {e}")
