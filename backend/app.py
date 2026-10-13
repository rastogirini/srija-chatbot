"""
Restaurant Chatbot API - Flask Backend
POSTGRESQL + OLLAMA AI + CUSTOMER RECOGNITION (Phone + Email)
"""

import os
from datetime import datetime
from functools import wraps

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

from db import init_database
from customers import list_customers, find_customer_by_login, find_customer_by_email, find_customer_by_id, find_admin_by_password, save_customer, update_customer
from reservations import list_reservations, get_reservations_by_customer_id, save_reservation, update_reservation_status, RESERVATION_STATUSES
from orders import place_order, list_orders, get_orders_by_customer_id, get_revenue_summary, get_revenue_by_category, get_top_spender_ids, update_order_status, ORDER_STATUSES
from chatbot_graph import run_chat
from beauty_info import recommend_by_quiz
from toys_info import recommend_by_gift_finder
from picks import build_picks
from products import save_uploaded_image, save_product, get_product, name_taken, update_product, list_products, soft_delete_product, find_unavailable_names, get_product_performance, get_public_bestsellers, update_product_stock, find_insufficient_stock, decrement_stock
from bulk_import import SpreadsheetError, read_spreadsheet, validate_rows, summarize, import_rows, list_import_batches, get_batch_products, build_template_xlsx, export_products_xlsx

XLSX_MIMETYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

app = Flask(__name__)
# Content-Disposition is exposed so the admin's spreadsheet downloads
# (fetched with the admin header, not a plain link) can read the filename.
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "http://localhost:5173"]}},
     expose_headers=["Content-Disposition"])

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
            'toys_products': result.get("toys_products", []),
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

@app.route('/api/toys/quiz', methods=['POST'])
def toys_gift_finder():
    """Turn the chatbot's 2-question Gift Finder quiz (recipient's age
    range, occasion) into a small set of real catalog picks, each with a
    one-line reason tied to the answer."""
    try:
        data = request.get_json() or {}
        age_range = data.get('age_range')
        occasion = data.get('occasion')
        if age_range not in ('toddler', 'kid', 'tween') or occasion not in ('birthday', 'just-because'):
            return jsonify({'error': 'Invalid quiz answers', 'success': False}), 400
        picks = recommend_by_gift_finder(age_range, occasion)
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

    by_category = get_revenue_by_category()
    if by_category is None:
        return jsonify({'error': 'Database error', 'success': False}), 500

    return jsonify({
        'weekly': [{'bucket': row['bucket'].isoformat(), 'total': float(row['total'] or 0)} for row in summary['weekly']],
        'monthly': [{'bucket': row['bucket'].isoformat(), 'total': float(row['total'] or 0)} for row in summary['monthly']],
        'by_category': [{'category': row['category'], 'total': float(row['revenue'] or 0)} for row in by_category],
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

@app.route('/api/products/bestsellers', methods=['GET'])
def get_bestsellers():
    """Top sellers across food/beauty/toys, for the customer-facing 'Best
    Sellers' quick action - public (no admin gate), unlike
    /api/products/performance which also exposes revenue/stock."""
    bestsellers = get_public_bestsellers()
    if bestsellers is None:
        return jsonify({'error': 'Database error', 'success': False}), 500
    return jsonify({'products': bestsellers, 'success': True}), 200

def _product_form_data():
    """Validate the Add/Edit Product form fields (multipart form data).
    Returns (data, None), or (None, error message). Only the fields that
    apply to the category are kept - switching a product from food to toys
    on edit clears its cuisine/diet/course rather than leaving them behind."""
    category = (request.form.get('category') or '').strip()
    name = (request.form.get('name') or '').strip()

    if category not in ('food', 'beauty', 'toys'):
        return None, 'Category must be food, beauty, or toys'
    if not name:
        return None, 'Name is required'

    try:
        price = float(request.form.get('price', ''))
    except (TypeError, ValueError):
        return None, 'Price must be a number'
    if price <= 0:
        return None, 'Price must be greater than 0'

    stock = None
    stock_raw = (request.form.get('stock') or '').strip()
    if stock_raw:
        try:
            stock = int(stock_raw)
        except ValueError:
            return None, 'Stock must be a whole number'
        if stock < 0:
            return None, 'Stock cannot be negative'

    is_food = category == 'food'
    return {
        'category': category,
        'name': name,
        'price': price,
        'description': (request.form.get('description') or '').strip(),
        'cuisine': (request.form.get('cuisine') or None) if is_food else None,
        'diet': (request.form.get('diet') or None) if is_food else None,
        'course': (request.form.get('course') or None) if is_food else None,
        'subcategory': None if is_food else (request.form.get('subcategory') or None),
        'stock': stock,
    }, None


def _remove_uploaded_image(image_path):
    """Delete a product photo file from disk - only ones this app uploaded
    (/static/uploads/...), never an external URL."""
    if not image_path or not image_path.startswith('/static/uploads/'):
        return
    full_path = os.path.join(os.path.dirname(__file__), image_path.lstrip('/'))
    try:
        if os.path.exists(full_path):
            os.remove(full_path)
    except OSError as e:
        print(f"⚠️ Could not remove image file {full_path}: {e}")


@app.route('/api/picks', methods=['POST'])
def get_picks():
    """Picks Made For You for the chatbot - see picks.py. Public, like the
    rest of the customer-facing chat: a signed-in customer is identified by
    the same name+email pair the chat already sends, and the response only
    holds product names and reasons, never order details."""
    data = request.get_json() or {}
    exclude = data.get('exclude') or []
    if not isinstance(exclude, list):
        exclude = []
    result = build_picks(
        customer_name=data.get('customer_name'),
        customer_email=data.get('customer_email'),
        interests=data.get('interests') or [],
        exclude=[str(name) for name in exclude[:200]],
    )
    if result is None:
        return jsonify({'error': 'Database error', 'success': False}), 500
    return jsonify({'success': True, **result}), 200

@app.route('/api/products', methods=['POST'])
@require_admin
def create_product():
    """Add a new product from the admin "Add Product" form - multipart form
    data (an image file plus the product's text fields), so a shopkeeper can
    add a real product without a developer editing config.py."""
    try:
        data, error = _product_form_data()
        if error:
            return jsonify({'error': error, 'success': False}), 400

        taken = name_taken(data['name'])
        if taken is None:
            return jsonify({'error': 'Database error', 'success': False}), 500
        if taken:
            return jsonify({'error': f'A product named "{data["name"]}" already exists', 'success': False}), 409

        image_url = save_uploaded_image(request.files.get('image'))
        product_id = save_product(data, image_url)
        if not product_id:
            return jsonify({'error': 'Could not save product', 'success': False}), 500

        return jsonify({'success': True, 'product_id': product_id, 'image': image_url}), 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/products/bulk', methods=['POST'])
@require_admin
def bulk_import_products():
    """Bulk Upload: multipart form with `spreadsheet` (.csv/.xlsx) and any
    number of `images`. ?mode=preview (the default) only validates and
    returns a per-row report; ?mode=commit re-validates (never trusting an
    earlier preview) and saves the importable rows as one batch."""
    try:
        mode = request.args.get('mode', 'preview')
        if mode not in ('preview', 'commit'):
            return jsonify({'error': 'mode must be preview or commit', 'success': False}), 400

        spreadsheet = request.files.get('spreadsheet')
        try:
            rows = read_spreadsheet(spreadsheet)
        except SpreadsheetError as e:
            return jsonify({'error': str(e), 'success': False}), 400

        images_by_name = {}
        for image in request.files.getlist('images'):
            if image and image.filename:
                images_by_name.setdefault(os.path.basename(image.filename).lower(), image)

        results = validate_rows(rows, set(images_by_name))
        if results is None:
            return jsonify({'error': 'Database error', 'success': False}), 500

        # The internal parsed values aren't needed client-side - the preview
        # shows the shopkeeper's own `raw` cells plus the status/messages.
        report = [{k: v for k, v in r.items() if k != 'data'} for r in results]
        summary = summarize(results)

        if mode == 'preview':
            return jsonify({'success': True, 'rows': report, 'summary': summary}), 200

        if summary['ok'] + summary['warning'] == 0:
            return jsonify({'error': 'No rows can be imported - fix the errors and try again', 'success': False}), 400

        imported = import_rows(spreadsheet.filename, results, images_by_name)
        if not imported:
            return jsonify({'error': 'Import failed - nothing was saved', 'success': False}), 500

        batch_id, added = imported
        return jsonify({'success': True, 'batch_id': batch_id, 'added': added, 'rows': report, 'summary': summary}), 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/products/bulk/template', methods=['GET'])
@require_admin
def download_bulk_template():
    return send_file(build_template_xlsx(), mimetype=XLSX_MIMETYPE, as_attachment=True,
                     download_name='product_upload_template.xlsx')

@app.route('/api/products/import-batches', methods=['GET'])
@require_admin
def get_import_batches():
    batches = list_import_batches()
    if batches is None:
        return jsonify({'error': 'Database error', 'success': False}), 500
    return jsonify({'success': True, 'batches': [
        {**b, 'created_at': b['created_at'].isoformat()} for b in batches
    ]}), 200

@app.route('/api/products/import-batches/<int:batch_id>/export', methods=['GET'])
@require_admin
def export_import_batch(batch_id):
    """Re-download an old bulk upload, rebuilt from the products it created
    (the original file was never stored) - current price/stock, with
    products deleted since marked as such."""
    batch, products = get_batch_products(batch_id)
    if batch is None:
        return jsonify({'error': 'Import not found', 'success': False}), 404
    base = os.path.splitext(batch['filename'] or 'upload')[0]
    return send_file(export_products_xlsx(products, request.host_url.rstrip('/'), title=f"Import {batch_id}"), mimetype=XLSX_MIMETYPE,
                     as_attachment=True, download_name=f"{base}_import{batch_id}_{batch['created_at']:%Y-%m-%d}.xlsx")

@app.route('/api/products/export', methods=['GET'])
@require_admin
def export_all_products():
    products = list_products()
    if products is None:
        return jsonify({'error': 'Database error', 'success': False}), 500
    return send_file(export_products_xlsx(products, request.host_url.rstrip('/')), mimetype=XLSX_MIMETYPE, as_attachment=True,
                     download_name=f"all_products_{datetime.now():%Y-%m-%d}.xlsx")

@app.route('/api/products/<int:product_id>', methods=['GET'])
@require_admin
def get_single_product(product_id):
    """One product's current fields, to pre-fill the admin Edit form."""
    product = get_product(product_id)
    if not product:
        return jsonify({'error': 'Product not found', 'success': False}), 404
    return jsonify({'product': product, 'success': True}), 200

@app.route('/api/products/<int:product_id>', methods=['PUT'])
@require_admin
def edit_product(product_id):
    """Save the admin Edit form - same multipart fields as Add Product.
    Photo: a new `image` file replaces the current one, `remove_image=true`
    clears it, neither keeps it. A replaced/removed uploaded photo is
    deleted from disk only after the database update succeeds."""
    try:
        data, error = _product_form_data()
        if error:
            return jsonify({'error': error, 'success': False}), 400

        taken = name_taken(data['name'], exclude_id=product_id)
        if taken is None:
            return jsonify({'error': 'Database error', 'success': False}), 500
        if taken:
            return jsonify({'error': f'Another product is already named "{data["name"]}"', 'success': False}), 409

        new_image = request.files.get('image')
        if new_image and new_image.filename:
            image_url = save_uploaded_image(new_image)
            if not image_url:
                return jsonify({'error': 'Photo must be a PNG, JPG, WEBP or GIF', 'success': False}), 400
            result = update_product(product_id, data, image_url)
        elif request.form.get('remove_image') == 'true':
            image_url = None
            result = update_product(product_id, data, None)
        else:
            image_url = None
            result = update_product(product_id, data)

        if result is None or not result[0]:
            # The new photo was written before the update - don't leave it orphaned.
            _remove_uploaded_image(image_url)
            if result is None:
                return jsonify({'error': 'Could not save changes', 'success': False}), 500
            return jsonify({'error': 'Product not found', 'success': False}), 404

        _remove_uploaded_image(result[1])
        return jsonify({'success': True, 'product': get_product(product_id)}), 200
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

        _remove_uploaded_image(image_path)
        return jsonify({'success': True}), 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/products/<int:product_id>/stock', methods=['PATCH'])
@require_admin
def patch_product_stock(product_id):
    """Set a product's stock count, or clear it back to untracked/unlimited
    by passing stock: null."""
    try:
        data = request.get_json() or {}
        stock = data.get('stock')
        if stock is not None:
            try:
                stock = int(stock)
            except (TypeError, ValueError):
                return jsonify({'error': 'Stock must be a whole number or null', 'success': False}), 400
            if stock < 0:
                return jsonify({'error': 'Stock cannot be negative', 'success': False}), 400

        updated = update_product_stock(product_id, stock)
        if not updated:
            return jsonify({'error': 'Product not found', 'success': False}), 404

        return jsonify({'success': True, 'stock': stock}), 200
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

        # Same checkout-time blocking pattern as the unavailable-items check
        # above, for products an admin has turned stock tracking on for.
        insufficient = find_insufficient_stock(items)
        if insufficient:
            return jsonify({
                'error': 'Some items in your cart are no longer in stock',
                'insufficient_stock': insufficient,
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

        decrement_stock(items)

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
