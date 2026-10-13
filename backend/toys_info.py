"""Toy catalog responses, AI-enhanced when possible - mirrors beauty_info.py's
shape exactly, fully database-backed from the start (no hardcoded fallback
catalog to dedupe against, unlike beauty's original MAKEUP_DATA)."""

import re

from ai import get_ollama_response, format_history
from products import list_products

TOYS_BRAND = "Srigen Toys"

# Words a customer might use to ask about a specific subcategory, mapped to
# the actual subcategory value stored on the product row.
CATEGORY_ALIASES = {
    "building blocks": "building-blocks",
    "building block": "building-blocks",
    "lego": "building-blocks",
    "bricks": "building-blocks",
    "blocks": "building-blocks",
    "action figure": "action-figures",
    "action figures": "action-figures",
    "figures": "action-figures",
    "robot": "action-figures",
    "board game": "board-games",
    "board games": "board-games",
    "game": "board-games",
    "games": "board-games",
    "puzzle": "puzzles",
    "puzzles": "puzzles",
    "cube": "puzzles",
    "outdoor": "outdoor",
    "sailboat": "outdoor",
    "boat": "outdoor",
}


def _combined_categories():
    """The toys catalog, grouped by subcategory - fully database-backed, the
    same pattern beauty_info.py now uses. Computed fresh per request - cheap
    (one query) and always reflects the latest state, no caching to
    invalidate."""
    combined = {}
    for product in (list_products(category="toys") or []):
        subcategory = product.get("subcategory") or "building-blocks"
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
    client-side for food. Without this, a budget-only ask like "toys under
    500" matched products by subcategory alone and ignored price entirely,
    so a ₹599 item could show up under a reply that says "under ₹500"."""
    match = _BUDGET_PATTERN.search(message)
    if not match:
        return None
    for group in match.groups():
        if group:
            return int(group)
    return None


def _filter_by_budget(categories, budget):
    """Drop any item over the budget ceiling, and any subcategory left with
    nothing in it - applied to the same `categories` dict both the card
    list and the AI's catalog text are built from, so the two can never
    disagree about what's actually affordable."""
    if budget is None:
        return categories
    filtered = {}
    for subcategory, items in categories.items():
        kept = [item for item in items if int(re.sub(r'[^\d]', '', item['price']) or 0) <= budget]
        if kept:
            filtered[subcategory] = kept
    return filtered


def _matching_categories(message, categories):
    """Return the subcategory keys mentioned in the message, if any."""
    message_lower = message.lower()
    matched = {
        category
        for alias, category in CATEGORY_ALIASES.items()
        if alias in message_lower
    }
    return [c for c in categories if c in matched]


def _categories_to_show(message, categories):
    """Subcategories specifically named in the message, or the full catalog
    if the question was generic - shared by the text reply and the product
    cards so they always agree on what's being shown."""
    return _matching_categories(message, categories) or list(categories)


def _build_catalog_text(categories_to_show, categories):
    catalog_text = f"{TOYS_BRAND} - CATALOG:\n"
    for category in categories_to_show:
        items = categories[category]
        catalog_text += f"\n{category.upper()}:\n"
        for item in items:
            catalog_text += f"  • {item['name']} - {item['price']}: {item['description']}\n"
    return catalog_text


def get_matching_products(message):
    """Return the flat list of products to show as cards - subcategories
    specifically named in the message, or the full catalog if the question
    was generic (mirrors handle_toys_request's text fallback). Also honors
    a budget mentioned in the message, if any."""
    categories = _filter_by_budget(_combined_categories(), _extract_budget(message))
    products = []
    for category in _categories_to_show(message, categories):
        for item in categories[category]:
            products.append({**item, "category": category})
    return products


# Age ranges and occasions the Gift Finder quiz asks about, each mapped to
# the subcategories considered a good fit - a simple, honest pairing (like
# recommend_by_quiz for beauty), not a rigorous recommendation engine.
AGE_SUBCATEGORY_FIT = {
    "toddler": ["building-blocks", "outdoor"],
    "kid": ["action-figures", "puzzles"],
    "tween": ["board-games", "puzzles"],
}


def recommend_by_gift_finder(age_range, occasion):
    """Turn the chatbot's 2-question Gift Finder quiz into real picks from
    the catalog - age range narrows down to 2 subcategories judged a
    reasonable fit, occasion picks which of those two to lead with. Not a
    rigorous recommendation engine, same honesty as beauty's quiz."""
    categories = _combined_categories()
    fit_subcategories = AGE_SUBCATEGORY_FIT.get(age_range, ["building-blocks", "action-figures"])
    lead_subcategory = fit_subcategories[0] if occasion == "birthday" else fit_subcategories[-1]
    other_subcategory = fit_subcategories[-1] if lead_subcategory == fit_subcategories[0] else fit_subcategories[0]

    age_reason = {
        "toddler": "safe, sturdy play for little hands",
        "kid": "the kind of toy that holds a kid's attention",
        "tween": "enough of a challenge to actually engage a tween",
    }.get(age_range, "a solid all-around pick")

    picks = []
    for subcategory in [lead_subcategory, other_subcategory]:
        items = categories.get(subcategory) or []
        if items:
            picks.append({**items[0], "category": subcategory, "reason": age_reason})
    return picks


def handle_toys_request(message, history=None):
    """Return a short, conversational toys reply. Product details (name,
    price, image) are shown separately as cards via get_matching_products,
    so this text should stay brief instead of repeating them."""
    categories = _filter_by_budget(_combined_categories(), _extract_budget(message))
    catalog_text = _build_catalog_text(_categories_to_show(message, categories), categories)
    history_transcript = format_history(history)

    prompt = f"""You are Srija, a warm assistant for {TOYS_BRAND}.

Our catalog:
{catalog_text}
{history_transcript}
Customer just said: "{message}"

The matching products are already being shown to the customer as cards with photos, names and prices - so DO NOT list product names, prices or descriptions yourself. Just reply in ONE short, warm sentence (max ~15 words): react to what they said, or ask one quick follow-up (who it's for, their age, budget) if that would help narrow it down. Don't repeat a question you already asked earlier in this conversation."""

    response = get_ollama_response(prompt, max_tokens=60)
    if response:
        return response
    # The product cards (get_matching_products) already show every name,
    # price and description from this same catalog - falling back to
    # catalog_text here would dump that whole thing a second time, as a
    # single wall-of-text chat bubble, whenever the AI reply gets cut off
    # mid-sentence and discarded (common with a long catalog in the
    # prompt). A short generic line is honest and lets the cards do the
    # actual work, same as the equivalent fallback in beauty_info.py.
    return "Here's what I found for you! 🧸"
