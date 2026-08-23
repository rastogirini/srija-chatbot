"""Environment configuration and static restaurant data."""

import os
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    'host': os.getenv('DB_HOST'),
    'port': os.getenv('DB_PORT'),
    'database': os.getenv('DB_NAME'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD')
}

OLLAMA_URL = "http://localhost:11434/api/chat"

RESTAURANT_DATA = {
    "name": "Srija's Taste",
    "phone": "+1-123-0123",
    "email": "support@srija.com",
    "address": "123 Main Street, Downtown",
    "max_party_size": 50,
    "hours": {
        "Monday": "10:00 AM - 10:00 PM",
        "Tuesday": "10:00 AM - 10:00 PM",
        "Wednesday": "10:00 AM - 10:00 PM",
        "Thursday": "10:00 AM - 10:00 PM",
        "Friday": "10:00 AM - 11:00 PM",
        "Saturday": "11:00 AM - 11:00 PM",
        "Sunday": "11:00 AM - 10:00 PM",
    },
    "menu": {
        "appetizers": [
            {"name": "Bruschetta", "price": "$8.99", "description": "Toasted bread with tomatoes and garlic"},
            {"name": "Calamari", "price": "$10.99", "description": "Fried squid with marinara sauce"},
        ],
        "mains": [
            {"name": "Grilled Salmon", "price": "$18.99", "description": "Fresh salmon with lemon butter sauce"},
            {"name": "Pasta Carbonara", "price": "$14.99", "description": "Classic Italian pasta with bacon and cream"},
            {"name": "Ribeye Steak", "price": "$22.99", "description": "12oz USDA Prime cut with vegetables"},
        ],
        "desserts": [
            {"name": "Tiramisu", "price": "$7.99", "description": "Italian coffee-flavored dessert"},
            {"name": "Chocolate Cake", "price": "$6.99", "description": "Rich dark chocolate cake with frosting"},
        ],
    }
}

MAKEUP_DATA = {
    "brand": "Srigen Beauty",
    "categories": {
        "lipstick": [
            {"name": "Velvet Matte Lipstick", "price": "₹899", "description": "Long-lasting matte finish in classic red", "image": "https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=400&h=300&fit=crop"},
            {"name": "Glossy Tint Lip Balm", "price": "₹499", "description": "Sheer, hydrating tint with a glossy finish", "image": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&h=300&fit=crop"},
        ],
        "foundation": [
            {"name": "Silk Finish Foundation", "price": "₹1299", "description": "Lightweight, buildable coverage for all-day wear", "image": "https://images.unsplash.com/photo-1571875257727-256c39da42af?w=400&h=300&fit=crop"},
            {"name": "BB Cream SPF 30", "price": "₹799", "description": "Sheer coverage with sun protection", "image": "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&h=300&fit=crop"},
        ],
        "skincare": [
            {"name": "Hydrating Serum", "price": "₹1499", "description": "Hyaluronic acid serum for deep hydration", "image": "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&h=300&fit=crop"},
            {"name": "Vitamin C Face Cream", "price": "₹1099", "description": "Brightening daily moisturizer", "image": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&h=300&fit=crop"},
        ],
        "fragrance": [
            {"name": "Floral Eau de Parfum", "price": "₹2499", "description": "A delicate floral scent with hints of jasmine", "image": "https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&h=300&fit=crop"},
            {"name": "Citrus Body Mist", "price": "₹699", "description": "Light, refreshing citrus fragrance", "image": "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=400&h=300&fit=crop"},
        ],
    }
}
