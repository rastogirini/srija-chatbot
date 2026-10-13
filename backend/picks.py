"""Picks Made For You - the hero button's personalised recommendations,
shown as cards in the chatbot. Each pick carries a sentence saying why it
was chosen, so it reads as curated rather than random:

  - "Because you loved X, you might also enjoy Y."  Y is the same type (food
        course / beauty+toys subcategory) as X, which the customer ordered
        LOVED_MIN_UNITS+ times ("You tried X..." if only once); for food
        also veg-compatible, ranked by cuisine/diet overlap. Never something
        they've already bought. Prefixed "New!" if Y also just arrived.
  - "Just arrived - ..."   added in the last NEW_ARRIVAL_DAYS days
  - "A best seller - ..."  sold well in that category

Only the categories the customer picked at sign-up are used (all three for
a guest). Anything out of stock is never suggested. Within each tier the
order is shuffled, so two visits in a row don't show exactly the same set,
and `exclude` (names already shown this session) powers "Show me more"."""

import random

from customers import find_customer_by_login
from orders import get_orders_by_customer_id
from products import get_product_performance, list_products

CATEGORIES = ("food", "beauty", "toys")
NEW_ARRIVAL_DAYS = 14
LOVED_MIN_UNITS = 2


def _product_type(product):
    """What "same kind of thing" means per category - a dish's course
    (dessert -> another dessert), a beauty/toy product's subcategory."""
    return product.get("course") if product["category"] == "food" else product.get("subcategory")


def _diet_tags(details):
    return {t for t in (details.get("diet") or "").split(",") if t}


def _similarity(source, candidate, details_by_id):
    """How good a "you loved X, try Y" pairing is - None if it isn't one.
    Always the same type (course/subcategory). For food, a vegetarian
    favourite never leads to a non-veg suggestion, and same cuisine plus
    shared diet tags rank higher - so a samosa lover is steered to another
    Indian veg starter before anything merely labelled "appetizer"."""
    if _product_type(source) != _product_type(candidate):
        return None
    if source["category"] != "food":
        return 0
    src, cand = details_by_id.get(source["id"], {}), details_by_id.get(candidate["id"], {})
    src_tags, cand_tags = _diet_tags(src), _diet_tags(cand)
    veg = {"vegetarian", "vegan"}
    if src_tags & veg and not cand_tags & veg:
        return None
    return (2 if src.get("cuisine") and src.get("cuisine") == cand.get("cuisine") else 0) + len(src_tags & cand_tags)


def _reason(kind, product_name, source_name=None, source_units=0, is_new=False):
    """The sentence shown above a pick, spelling out why it's there."""
    if kind == "loved":
        # "Loved" only for something ordered more than once - a single
        # order is just "tried", not a favourite.
        if source_units >= LOVED_MIN_UNITS:
            sentence = f"Because you loved {source_name}, you might also enjoy {product_name}."
        else:
            sentence = f"You tried {source_name}, so why not try {product_name} next?"
        return f"New! {sentence}" if is_new else sentence
    if kind == "new":
        return f"Just arrived - be one of the first to try {product_name}."
    if kind == "best":
        return f"A best seller - customers keep coming back for {product_name}."
    return f"Something different - {product_name} is worth a look."


def _loved_products(customer_id, by_known_name):
    """{product_id: units ordered} for this customer, resolving order-item
    names through current AND former product names (orders store names)."""
    loved = {}
    for order in get_orders_by_customer_id(customer_id):
        if order.get("status") == "cancelled":
            continue
        for item in order.get("items") or []:
            product = by_known_name.get(item.get("name"))
            if product:
                loved[product["id"]] = loved.get(product["id"], 0) + (item.get("qty") or 1)
    return loved


def build_picks(customer_name=None, customer_email=None, interests=None, exclude=None):
    """Returns {"name", "guest", "groups": [{"category", "picks": [{"name",
    "reason", "reason_type"}]}]}, or None on a database error."""
    products = get_product_performance()
    # Full rows (description, diet, nutrition, ...) ride along with each
    # pick so the chatbot can render cards without waiting on its own menu
    # fetches - a click right after page load used to find nothing to show.
    details = list_products()
    if products is None or details is None:
        return None
    details_by_id = {d["id"]: d for d in details}

    customer = find_customer_by_login(customer_name, customer_email) if customer_name and customer_email else None
    wanted = [c for c in CATEGORIES if interests and c in interests]
    categories = wanted or list(CATEGORIES)
    per_category = 3 if len(categories) == 1 else 2
    exclude = set(exclude or [])

    # Name -> product, including former names, for matching past orders.
    by_known_name = {}
    for product in products:
        for known in [*(product.get("former_names") or []), product["name"]]:
            by_known_name[known] = product
    by_id = {p["id"]: p for p in products}

    loved = _loved_products(customer["id"], by_known_name) if customer else {}
    # Most-ordered first, so "Because you loved" leads with real favourites.
    loved_ranked = sorted(loved, key=lambda pid: -loved[pid])

    groups = []
    for category in categories:
        in_stock = [p for p in products if p["category"] == category and p["stock"] != 0]
        fresh = [p for p in in_stock if p["name"] not in exclude and p["id"] not in loved]
        if not fresh:
            # Everything's been shown already ("Show me more" ran out) -
            # start the rotation over rather than returning nothing.
            fresh = [p for p in in_stock if p["id"] not in loved]

        # One candidate list per favourite, best match first (shuffled
        # within equal matches so visits differ)...
        per_source = []
        for loved_id in loved_ranked:
            source = by_id.get(loved_id)
            if not source or source["category"] != category or not _product_type(source):
                continue
            scored = [(p, _similarity(source, p, details_by_id)) for p in fresh]
            scored = [(p, s) for p, s in scored if s is not None]
            random.shuffle(scored)
            scored.sort(key=lambda ps: -ps[1])
            per_source.append([
                (p, _reason("loved", p["name"], source["name"], loved[loved_id], p["days_live"] < NEW_ARRIVAL_DAYS), "loved")
                for p, _ in scored
            ])
        # ...then taken round-robin, so two picks in a row come from two
        # different favourites instead of repeating "because you loved X".
        because, taken = [], set()
        for i in range(max((len(s) for s in per_source), default=0)):
            for candidates in per_source:
                if i < len(candidates) and candidates[i][0]["id"] not in taken:
                    taken.add(candidates[i][0]["id"])
                    because.append(candidates[i])

        new_arrivals = [(p, _reason("new", p["name"]), "new") for p in fresh if p["days_live"] < NEW_ARRIVAL_DAYS]
        random.shuffle(new_arrivals)

        # Top sellers first (shuffled among themselves), then anything else
        # that's sold at all, then the rest - so the slots always fill.
        top = [p for p in fresh if p["is_top_seller"]]
        selling = [p for p in fresh if not p["is_top_seller"] and p["units_sold"] > 0]
        rest = [p for p in fresh if p["units_sold"] == 0 and p["days_live"] >= NEW_ARRIVAL_DAYS]
        for tier in (top, selling, rest):
            random.shuffle(tier)
        best = [(p, _reason("best", p["name"]), "best") for p in top + selling]
        others = [(p, _reason("other", p["name"]), "other") for p in rest]

        # Past orders lead, but leave room for one new arrival so a returning
        # customer still discovers what's new; best sellers fill the gaps.
        lead = because[:per_category - 1]
        lead_ids = {p["id"] for p, _, _ in lead}
        new_first = [n for n in new_arrivals if n[0]["id"] not in lead_ids][:1]
        ordered = lead + new_first + because[per_category - 1:] + best + new_arrivals + others

        picks, seen = [], set()
        for product, reason, reason_type in ordered:
            if product["id"] in seen:
                continue
            seen.add(product["id"])
            picks.append({
                "name": product["name"],
                "reason": reason,
                "reason_type": reason_type,
                "product": details_by_id.get(product["id"]),
            })
            if len(picks) == per_category:
                break

        if picks:
            groups.append({"category": category, "picks": picks})

    return {
        "name": customer["name"] if customer else None,
        "guest": customer is None,
        "groups": groups,
    }
