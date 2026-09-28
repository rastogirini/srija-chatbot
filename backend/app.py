"""
Restaurant Chatbot API - Flask Backend
POSTGRESQL + OLLAMA AI + CUSTOMER RECOGNITION (Phone + Email)
"""

import os
from datetime import datetime
from functools import wraps

from flask import Flask, request, jsonify
from flask_cors import CORS

from db import init_database
from customers import list_customers, find_customer_by_login, find_customer_by_email, find_customer_by_id, find_admin_by_password, save_customer, update_customer
from reservations import list_reservations, get_reservations_by_customer_id, save_reservation, update_reservation_status, RESERVATION_STATUSES
from orders import place_order, list_orders, get_orders_by_customer_id, get_revenue_summary, get_top_spender_ids, update_order_status, ORDER_STATUSES
from chatbot_graph import run_chat
from beauty_info import recommend_by_quiz
from products import save_uploaded_image, save_product, list_products, soft_delete_product, find_unavailable_names, get_product_performance

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "http://localhost:5173"]}})

conversation = []


def require_admin(fn):
    """Gate a route behind the X-Admin-Password header, checked against a
    real customer row with role='admin' - not a separate hardcoded secret.
    Protects the admin listing endpoints (orders/customers/reservations)
    from being read by anyone who just knows the URL."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not find_admin_by_password(request.headers.get('X-Admin-Password')):
            return jsonify({'error': 'Unauthorized', 'success': False}), 401
        return fn(*args, **kwargs)
    return wrapper


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
            # Set only when every required reservation detail is in and the
            # booking is ready for its final two preference questions. Holds
            # the collected details; the widget carries them through the
            # seating + dietary steps and posts them back to finalize.
            'reservation_pending': result.get("reservation_pending"),
        }), 200

    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/login', methods=['POST'])
def login():
    """Validate a real sign-in against the customers table - name and email
    must both match an existing customer row. Replaces the old fixed-3-
    persona demo matching, which silently fell back to the first persona
    (Sita) for any unrecognized name.

    A password is only ever checked for an admin account (role='admin') -
    regular customers still just need a matching name+email, no password
    collected or enforced for them today."""
    try:
        data = request.get_json()
        name = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip()
        password = data.get('password') or ''

        if not name or not email:
            return jsonify({'error': 'Name and email are required', 'success': False}), 400

        customer = find_customer_by_login(name, email)
        if not customer:
            return jsonify({
                'error': "We couldn't find an account with that name and email. Check your details, or sign up.",
                'success': False,
            }), 404

        if customer.get('role') == 'admin' and password != customer.get('password'):
            return jsonify({'error': 'Incorrect password', 'success': False}), 401

        return jsonify({
            'success': True,
            'customer': {
                'name': customer['name'],
                'email': customer['email'],
                'phone': customer['phone'],
                'interests': _parse_interests(customer.get('interests')),
                'role': customer.get('role') or 'customer',
            },
        }), 200

    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/signup', methods=['POST'])
def signup():
    """Create a new customer account (name + email + phone + interests).
    Phone is optional - not everyone will fill it in."""
    try:
        data = request.get_json()
        name = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip()
        phone = (data.get('phone') or '').strip() or None
        interests = data.get('interests') or []

        if not name or not email:
            return jsonify({'error': 'Name and email are required', 'success': False}), 400

        existing = find_customer_by_email(email)
        if existing:
            return jsonify({
                'error': 'User already exists. Try a different name or email.',
                'success': False,
            }), 409

        customer_id = save_customer(name, email, phone=phone, interests=interests)
        if not customer_id:
            return jsonify({'error': 'Could not create account', 'success': False}), 500

        return jsonify({'success': True, 'customer': {'name': name, 'email': email, 'phone': phone, 'interests': interests}}), 200

    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/reservations', methods=['GET'])
@require_admin
def get_reservations():
    """Get all reservations"""
    reservations = list_reservations()
    if reservations is None:
        return jsonify({'error': 'Database error', 'success': False}), 500
    return jsonify({'reservations': reservations, 'success': True}), 200

@app.route('/api/reservations/<reservation_id>', methods=['PATCH'])
@require_admin
def patch_reservation_status(reservation_id):
    """Move a reservation to its next status (seated/completed), or mark
    it cancelled/a no-show."""
    try:
        status = (request.get_json() or {}).get('status')
        if status not in RESERVATION_STATUSES:
            return jsonify({'error': f'Status must be one of {RESERVATION_STATUSES}', 'success': False}), 400

        updated = update_reservation_status(reservation_id, status)
        if not updated:
            return jsonify({'error': 'Reservation not found', 'success': False}), 404

        return jsonify({'success': True}), 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/reservations', methods=['POST'])
def create_reservation():
    """Finalize a reservation once the chatbot has collected every detail,
    including the seating and dietary preferences. The row is written here -
    not mid-conversation - so a booking is never saved until the customer
    has answered every question."""
    try:
        data = request.get_json() or {}
        if not data.get('party_size') or not data.get('date') or not data.get('time'):
            return jsonify({'error': 'Missing reservation details', 'success': False}), 400
        result = save_reservation(data)
        if not result:
            return jsonify({'error': 'Could not save reservation', 'success': False}), 500
        return jsonify({'success': True, **result}), 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/makeup/quiz', methods=['POST'])
def makeup_quiz():
    """Turn the chatbot's 2-question shade/skin-type quiz into a small set
    of real catalog picks, each with a one-line reason tied to the answer."""
    try:
        data = request.get_json() or {}
        skin_type = data.get('skin_type')
        look = data.get('look')
        if skin_type not in ('dry', 'oily') or look not in ('bold', 'natural'):
            return jsonify({'error': 'Invalid quiz answers', 'success': False}), 400
        picks = recommend_by_quiz(skin_type, look)
        return jsonify({'success': True, 'picks': picks}), 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/analytics/revenue', methods=['GET'])
@require_admin
def get_revenue():
    """Weekly and monthly revenue for the admin dashboard chart. This is
    revenue, not profit - the schema has no cost-of-goods data to subtract."""
    summary = get_revenue_summary()
    if summary is None:
        return jsonify({'error': 'Database error', 'success': False}), 500
    return jsonify({
        'weekly': [{'bucket': row['bucket'].isoformat(), 'total': float(row['total'] or 0)} for row in summary['weekly']],
        'monthly': [{'bucket': row['bucket'].isoformat(), 'total': float(row['total'] or 0)} for row in summary['monthly']],
        'success': True,
    }), 200

@app.route('/api/products/performance', methods=['GET'])
@require_admin
def get_products_performance():
    """Every live product with units sold, revenue, and whether it's a
    candidate for a sale (long-live, low-sales) - admin-only, since it's
    business data, unlike the plain product list customers also read."""
    performance = get_product_performance()
    if performance is None:
        return jsonify({'error': 'Database error', 'success': False}), 500
    return jsonify({'products': performance, 'success': True}), 200

@app.route('/api/products', methods=['GET'])
def get_products():
    """Public list of shopkeeper-uploaded products, optionally filtered by
    ?category=food|beauty - no admin gate, since customers/guests need to
    see these too. This is what lets a newly-added product actually show up
    on the live menu and in the chatbot's suggestions."""
    category = request.args.get('category')
    products = list_products(category)
    if products is None:
        return jsonify({'error': 'Database error', 'success': False}), 500
    return jsonify({'products': products, 'success': True}), 200

@app.route('/api/products', methods=['POST'])
@require_admin
def create_product():
    """Add a new product from the admin "Add Product" form - multipart form
    data (an image file plus the product's text fields), so a shopkeeper can
    add a real product without a developer editing config.py."""
    try:
        category = (request.form.get('category') or '').strip()
        name = (request.form.get('name') or '').strip()

        if category not in ('food', 'beauty'):
            return jsonify({'error': 'Category must be food or beauty', 'success': False}), 400
        if not name:
            return jsonify({'error': 'Name is required', 'success': False}), 400

        try:
            price = float(request.form.get('price', ''))
        except (TypeError, ValueError):
            return jsonify({'error': 'Price must be a number', 'success': False}), 400

        image_url = save_uploaded_image(request.files.get('image'))

        data = {
            'category': category,
            'name': name,
            'price': price,
            'description': (request.form.get('description') or '').strip(),
            'cuisine': request.form.get('cuisine') or None,
            'diet': request.form.get('diet') or None,
            'course': request.form.get('course') or None,
            'subcategory': request.form.get('subcategory') or None,
        }
        product_id = save_product(data, image_url)
        if not product_id:
            return jsonify({'error': 'Could not save product', 'success': False}), 500

        return jsonify({'success': True, 'product_id': product_id, 'image': image_url}), 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
@require_admin
def delete_product(product_id):
    """Remove a product from the live catalog. Soft-deletes (see
    soft_delete_product) rather than physically erasing the row - the
    checkout-availability check depends on that tombstone still existing.
    The uploaded image file itself IS actually removed from disk, since
    that's just reclaiming space, not something anything else depends on."""
    try:
        found, image_path = soft_delete_product(product_id)
        if not found:
            return jsonify({'error': 'Product not found', 'success': False}), 404

        if image_path and image_path.startswith('/static/'):
            full_path = os.path.join(os.path.dirname(__file__), image_path.lstrip('/'))
            try:
                if os.path.exists(full_path):
                    os.remove(full_path)
            except OSError as e:
                print(f"⚠️ Could not remove image file {full_path}: {e}")

        return jsonify({'success': True}), 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/customers', methods=['GET'])
@require_admin
def get_customers():
    """Get all customers (for admin), plus which ones are the top spenders
    so the dashboard can mark them with a star without a separate request."""
    customers = list_customers()
    if customers is None:
        return jsonify({'error': 'Database error', 'success': False}), 500
    return jsonify({
        'customers': customers,
        'top_spender_ids': get_top_spender_ids(),
        'success': True,
    }), 200

@app.route('/api/customers/<int:customer_id>', methods=['GET'])
@require_admin
def get_customer_detail(customer_id):
    """Full detail for one customer (admin detail view): personal info plus
    their complete order and reservation history, matched by customer_id
    for correctness (two customers could share a name)."""
    customer = find_customer_by_id(customer_id)
    if not customer:
        return jsonify({'error': 'Customer not found', 'success': False}), 404

    orders = get_orders_by_customer_id(customer_id)
    reservations = get_reservations_by_customer_id(customer_id)

    return jsonify({
        'success': True,
        'customer': customer,
        'is_top_spender': customer_id in get_top_spender_ids(),
        'orders': orders,
        'reservations': reservations,
    }), 200

@app.route('/api/customers/<int:customer_id>', methods=['PATCH'])
@require_admin
def edit_customer(customer_id):
    """Admin edit of a customer's own details (name/email/phone/interests) -
    fixes the view-only gap that previously needed a raw SQL command for
    something as small as a typo'd phone number or a wrong interest tag."""
    try:
        data = request.get_json() or {}
        name = (data.get('name') or '').strip() or None
        email = (data.get('email') or '').strip() or None
        phone = (data.get('phone') or '').strip() or None
        interests = data.get('interests') if 'interests' in data else None

        updated = update_customer(customer_id, name=name, email=email, phone=phone, interests=interests)
        if not updated:
            return jsonify({'error': 'Customer not found', 'success': False}), 404

        customer = find_customer_by_id(customer_id)
        return jsonify({'success': True, 'customer': customer}), 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/orders', methods=['POST'])
def create_order():
    """Place an order from the cart"""
    try:
        data = request.get_json()
        items = data.get('items', [])
        total = data.get('total', 0)

        if not items:
            return jsonify({'error': 'No items', 'success': False}), 400

        # Block the order (rather than silently accepting a discontinued
        # item) if anything in the cart was deleted from the catalog since
        # it was added - same pattern as an out-of-stock check at checkout
        # on a real e-commerce site.
        unavailable = find_unavailable_names([item.get('name') for item in items if item.get('name')])
        if unavailable:
            return jsonify({
                'error': 'Some items in your cart are no longer available',
                'unavailable_items': unavailable,
                'success': False,
            }), 409

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
@require_admin
def get_orders():
    """Get all orders (for admin)"""
    orders = list_orders()
    if orders is None:
        return jsonify({'error': 'Database error', 'success': False}), 500
    return jsonify({'orders': orders, 'success': True}), 200

@app.route('/api/orders/<order_id>', methods=['PATCH'])
@require_admin
def patch_order_status(order_id):
    """Move an order to its next fulfillment status (or cancel it)."""
    try:
        status = (request.get_json() or {}).get('status')
        if status not in ORDER_STATUSES:
            return jsonify({'error': f'Status must be one of {ORDER_STATUSES}', 'success': False}), 400

        updated = update_order_status(order_id, status)
        if not updated:
            return jsonify({'error': 'Order not found', 'success': False}), 404

        return jsonify({'success': True}), 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

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
