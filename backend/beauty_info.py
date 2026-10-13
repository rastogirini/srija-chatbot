"""Static beauty/makeup catalog responses, AI-enhanced when possible."""

import re

from config import MAKEUP_DATA
from ai import get_ollama_response, format_history
from products import list_products

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


def _combined_categories():
    """The beauty catalog, grouped by subcategory - fully database-backed
    (MAKEUP_DATA's original 8 items were migrated into the products table,
    so admin edits/deletes there are reflected here too, the same as any
    shopkeeper-uploaded item). Computed fresh per request - cheap (one
    query) and always reflects the latest state, no caching to invalidate."""
    combined = {}
    for product in (list_products(category="beauty") or []):
        subcategory = product.get("subcategory") or "skincare"
        combined.setdefault(subcategory, [])
        combined[subcategory].append({
            "name": product["name"],
            "price": f"₹{int(product['price'])}",
            "description": product.get("description") or "",
            "image": product["image"] if (product.get("image") or "").startswith("http") else (f"http://localhost:5000{product['image']}" if product.get("image") else ""),
        })
    return combined


_BUDGET_PATTERN = re.compile(
    r'(?:rs\.?|₹)\s*(\d+)|(\d+)\s*(?:rs\b|rupees?|₹)|(?:under|within|below|for)\s+(?:rs\.?|₹)?\s*(\d+)',
    re.IGNORECASE,
)


def _extract_budget(message):
    """A rupee ceiling mentioned in the message ("under ₹500", "500 rs"),
    or None - mirrors the same regex the chatbot widget already uses
    client-side for food, and toys_info.py's identical helper. Without
    this, a budget-only ask matched products by subcategory alone and
    ignored price entirely."""
    match = _BUDGET_PATTERN.search(message)
    if not match:
        return None
    for group in match.groups():
        if group:
            return int(group)
    return None


def _filter_by_budget(categories, budget):
    """Drop any item over the budget ceiling, and any category left with
    nothing in it - applied to the same `categories` dict both the card
    list and the AI's catalog text are built from, so the two can never
    disagree about what's actually affordable."""
    if budget is None:
        return categories
    filtered = {}
    for category, items in categories.items():
        kept = [item for item in items if int(re.sub(r'[^\d]', '', item['price']) or 0) <= budget]
        if kept:
            filtered[category] = kept
    return filtered


def _matching_categories(message, categories):
    """Return the category keys mentioned in the message, if any."""
    message_lower = message.lower()
    matched = {
        category
        for alias, category in CATEGORY_ALIASES.items()
        if alias in message_lower
    }
    return [c for c in categories if c in matched]


def _categories_to_show(message, categories):
    """Categories specifically named in the message, or the full catalog if
    the question was generic - shared by the text reply and the product
    cards so they always agree on what's being shown."""
    return _matching_categories(message, categories) or list(categories)


def _build_catalog_text(categories_to_show, categories):
    catalog_text = f"{MAKEUP_DATA['brand']} - CATALOG:\n"
    for category in categories_to_show:
        items = categories[category]
        catalog_text += f"\n{category.upper()}:\n"
        for item in items:
            catalog_text += f"  • {item['name']} - {item['price']}: {item['description']}\n"
    return catalog_text


def get_matching_products(message):
    """Return the flat list of products to show as cards - categories
    specifically named in the message, or the full catalog if the question
    was generic (mirrors handle_makeup_request's text fallback). Also
    honors a budget mentioned in the message, if any."""
    categories = _filter_by_budget(_combined_categories(), _extract_budget(message))
    products = []
    for category in _categories_to_show(message, categories):
        for item in categories[category]:
            products.append({**item, "category": category})
    return products


def recommend_by_quiz(skin_type, look):
    """Turn the chatbot's 2-question shade/skin-type quiz into real picks
    from the catalog - picks the first/second item in each category as a
    simple, honest pairing with a one-line reason each, not a rigorous
    dermatology match. Reads the same database-backed catalog as everything
    else, so a deleted or admin-added item is reflected here too."""
    categories = _combined_categories()
    foundation = categories.get("foundation") or []
    skincare = categories.get("skincare") or []
    lipstick = categories.get("lipstick") or []
    fragrance = categories.get("fragrance") or []

    def pick(items, index, reason):
        if not items:
            return None
        chosen = items[index] if index < len(items) else items[0]
        return (chosen, reason)

    picked_foundation = pick(foundation, 0 if skin_type == "dry" else 1,
        "Buildable coverage that sits comfortably on dry skin" if skin_type == "dry" else "Sheer and lightweight, so it won't add extra shine")
    picked_skincare = pick(skincare, 0 if skin_type == "dry" else 1,
        "Hyaluronic acid gives dry skin the hydration it's after" if skin_type == "dry" else "A light daily brightener that won't feel heavy")
    picked_lipstick = pick(lipstick, 0 if look == "bold" else 1,
        "Long-lasting matte color for a bold look" if look == "bold" else "Sheer, glossy tint for an easy natural look")
    picked_fragrance = pick(fragrance, 0 if look == "bold" else 1,
        "A classic scent to match a bold look" if look == "bold" else "Light and fresh, matches a natural everyday look")

    picks = [
        (picked_foundation, "foundation"),
        (picked_skincare, "skincare"),
        (picked_lipstick, "lipstick"),
        (picked_fragrance, "fragrance"),
    ]
    return [
        {**picked[0], "category": category, "reason": picked[1]}
        for picked, category in picks if picked
    ]


def handle_makeup_request(message, history=None):
    """Return a short, conversational beauty reply. Product details (name,
    price, image) are shown separately as cards via get_matching_products,
    so this text should stay brief instead of repeating them."""
    categories = _filter_by_budget(_combined_categories(), _extract_budget(message))
    catalog_text = _build_catalog_text(_categories_to_show(message, categories), categories)
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
    # The product cards (get_matching_products) already show every name,
    # price and description from this same catalog - falling back to
    # catalog_text here would dump that whole thing a second time, as a
    # single wall-of-text chat bubble, whenever the AI reply gets cut off
    # mid-sentence and discarded (common with a long catalog in the
    # prompt). A short generic line is honest and lets the cards do the
    # actual work, same as the equivalent fallback in toys_info.py.
    return "Here's what I found for you! ✨"
