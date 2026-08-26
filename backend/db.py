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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(name, phone, email)
            )
        """)

        # Existing databases from before `interests` existed won't get it from
        # CREATE TABLE IF NOT EXISTS above - add it separately so upgrades work.
        cur.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS interests VARCHAR(200)")

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
