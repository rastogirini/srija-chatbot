"""Static beauty/makeup catalog responses, AI-enhanced when possible."""

from config import MAKEUP_DATA
from ai import get_ollama_response, format_history

# Words a customer might use to ask about a specific category, mapped to
# the actual category key in MAKEUP_DATA["categories"].
CATEGORY_ALIASES = {
    "lipstick": "lipstick",
    "lip balm": "lipstick",
    "lip": "lipstick",
    "foundation": "foundation",
    "bb cream": "foundation",
    "skincare": "skincare",
    "skin care": "skincare",
    "skin": "skincare",
    "serum": "skincare",
    "moisturizer": "skincare",
    "fragrance": "fragrance",
    "perfume": "fragrance",
    "body mist": "fragrance",
}


def _matching_categories(message):
    """Return the category keys mentioned in the message, if any."""
    message_lower = message.lower()
    matched = {
        category
        for alias, category in CATEGORY_ALIASES.items()
        if alias in message_lower
    }
    return [c for c in MAKEUP_DATA["categories"] if c in matched]


def _categories_to_show(message):
    """Categories specifically named in the message, or the full catalog if
    the question was generic - shared by the text reply and the product
    cards so they always agree on what's being shown."""
    return _matching_categories(message) or list(MAKEUP_DATA["categories"])


def _build_catalog_text(categories):
    catalog_text = f"{MAKEUP_DATA['brand']} - CATALOG:\n"
    for category in categories:
        items = MAKEUP_DATA["categories"][category]
        catalog_text += f"\n{category.upper()}:\n"
        for item in items:
            catalog_text += f"  • {item['name']} - {item['price']}: {item['description']}\n"
    return catalog_text


def get_matching_products(message):
    """Return the flat list of products to show as cards - categories
    specifically named in the message, or the full catalog if the question
    was generic (mirrors handle_makeup_request's text fallback)."""
    products = []
    for category in _categories_to_show(message):
        for item in MAKEUP_DATA["categories"][category]:
            products.append({**item, "category": category})
    return products


def handle_makeup_request(message, history=None):
    """Return a short, conversational beauty reply. Product details (name,
    price, image) are shown separately as cards via get_matching_products,
    so this text should stay brief instead of repeating them."""
    catalog_text = _build_catalog_text(_categories_to_show(message))
    history_transcript = format_history(history)

    prompt = f"""You are Srija, a warm beauty assistant for {MAKEUP_DATA['brand']}.

Our catalog:
{catalog_text}
{history_transcript}
Customer just said: "{message}"

The matching products are already being shown to the customer as cards with photos, names and prices - so DO NOT list product names, prices or descriptions yourself. Just reply in ONE short, warm sentence (max ~15 words): react to what they said, or ask one quick follow-up (skin type, budget, preferred shade) if that would help narrow it down. Don't repeat a question you already asked earlier in this conversation."""

    response = get_ollama_response(prompt, max_tokens=60)
    if response:
        return response
    else:
        return catalog_text
