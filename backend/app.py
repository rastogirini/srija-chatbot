"""
Restaurant Chatbot API - Flask Backend
POSTGRESQL + OLLAMA AI + CUSTOMER RECOGNITION (Phone + Email)
"""

from datetime import datetime

from flask import Flask, request, jsonify
from flask_cors import CORS

from db import init_database
from customers import list_customers, find_customer_by_login, find_customer_by_email, save_customer
from reservations import list_reservations
from orders import place_order, list_orders
from chatbot_graph import run_chat

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "http://localhost:5173"]}})

conversation = []


def _parse_interests(interests_str):
    """`interests` is stored comma-joined in the DB - split back to a list
    for the frontend, dropping any empty entries."""
    if not interests_str:
        return []
    return [i for i in interests_str.split(",") if i]

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check"""
    return jsonify({'status': 'ok', 'message': 'API running'})

@app.route('/api/chat', methods=['POST'])
def handle_chat():
    """Chat endpoint with customer recognition (phone + email)"""
    print("\n🟢 CHAT ENDPOINT CALLED")
    try:
        data = request.get_json()
        user_message = data.get('message', '').strip()
        print(f"📩 User message: {user_message}")

        if not user_message:
            return jsonify({'error': 'No message', 'success': False}), 400

        global conversation
        conversation.append({"role": "user", "content": user_message})

        # Optional hints from the client about a customer already recognized
        # earlier in this conversation, so returning customers aren't asked
        # to repeat details they've already given in a prior message.
        result = run_chat(
            user_message,
            hint_name=data.get('customer_name'),
            hint_phone=data.get('customer_phone'),
            hint_email=data.get('customer_email'),
            already_greeted=bool(data.get('already_greeted')),
            history=data.get('history', []),
            interests=data.get('interests'),
        )
        final_response = result["final_response"]

        conversation.append({"role": "assistant", "content": final_response})

        print(f"📤 Response generated\n")

        return jsonify({
            'response': final_response,
            'success': True,
            'timestamp': datetime.now().isoformat(),
            'is_returning_customer': result["is_returning_customer"],
            'customer_name': result["customer"]["name"] if result.get("customer") else None,
            'extracted': {
                'name': result["extracted_name"],
                'phone': result["extracted_phone"],
                'email': result["extracted_email"],
            },
            'makeup_products': result.get("makeup_products", []),
        }), 200

    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/login', methods=['POST'])
def login():
    """Validate a real sign-in against the customers table - name and email
    must both match an existing customer row. Replaces the old fixed-3-
    persona demo matching, which silently fell back to the first persona
    (Sita) for any unrecognized name."""
    try:
        data = request.get_json()
        name = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip()

        if not name or not email:
            return jsonify({'error': 'Name and email are required', 'success': False}), 400

        customer = find_customer_by_login(name, email)
        if not customer:
            return jsonify({
                'error': "We couldn't find an account with that name and email. Check your details, or sign up.",
                'success': False,
            }), 404

        return jsonify({
            'success': True,
            'customer': {
                'name': customer['name'],
                'email': customer['email'],
                'phone': customer['phone'],
                'interests': _parse_interests(customer.get('interests')),
            },
        }), 200

    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/signup', methods=['POST'])
def signup():
    """Create a new customer account (name + email + interests)."""
    try:
        data = request.get_json()
        name = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip()
        interests = data.get('interests') or []

        if not name or not email:
            return jsonify({'error': 'Name and email are required', 'success': False}), 400

        existing = find_customer_by_email(email)
        if existing and existing['name'].strip().lower() != name.lower():
            return jsonify({
                'error': 'That email is already registered under a different name. Try signing in instead.',
                'success': False,
            }), 409

        customer_id = save_customer(name, email, interests=interests)
        if not customer_id:
            return jsonify({'error': 'Could not create account', 'success': False}), 500

        return jsonify({'success': True, 'customer': {'name': name, 'email': email, 'interests': interests}}), 200

    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/reservations', methods=['GET'])
def get_reservations():
    """Get all reservations"""
    reservations = list_reservations()
    if reservations is None:
        return jsonify({'error': 'Database error', 'success': False}), 500
    return jsonify({'reservations': reservations, 'success': True}), 200

@app.route('/api/customers', methods=['GET'])
def get_customers():
    """Get all customers (for admin)"""
    customers = list_customers()
    if customers is None:
        return jsonify({'error': 'Database error', 'success': False}), 500
    return jsonify({'customers': customers, 'success': True}), 200

@app.route('/api/orders', methods=['POST'])
def create_order():
    """Place an order from the cart"""
    try:
        data = request.get_json()
        items = data.get('items', [])
        total = data.get('total', 0)

        if not items:
            return jsonify({'error': 'No items', 'success': False}), 400

        order = place_order(
            items,
            total,
            customer_name=data.get('customer_name'),
            customer_phone=data.get('customer_phone'),
            customer_email=data.get('customer_email'),
        )
        if not order:
            return jsonify({'error': 'Could not place order', 'success': False}), 500

        return jsonify({'order': order, 'success': True}), 200

    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/orders', methods=['GET'])
def get_orders():
    """Get all orders (for admin)"""
    orders = list_orders()
    if orders is None:
        return jsonify({'error': 'Database error', 'success': False}), 500
    return jsonify({'orders': orders, 'success': True}), 200

@app.route('/api/chat/reset', methods=['POST'])
def reset_chat():
    """Reset conversation"""
    global conversation
    conversation = []
    return jsonify({'message': 'Reset', 'success': True})

# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found', 'success': False}), 404

@app.errorhandler(500)
def server_error(error):
    return jsonify({'error': 'Server error', 'success': False}), 500

# ============================================================================
# MAIN
# ============================================================================

if __name__ == '__main__':
    print("\n" + "="*70)
    print("🍽️  RESTAURANT CHATBOT API")
    print("POSTGRESQL + OLLAMA + PHONE + EMAIL RECOGNITION")
    print("="*70 + "\n")

    init_database()

    print("🚀 Starting Flask API...")
    print("📍 API URL: http://localhost:5000")
    print("📍 Using OLLAMA AI on port 11434")
    print("📍 Using PostgreSQL for database\n")

    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)
