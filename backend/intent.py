"""Intent classification for incoming chat messages."""

import re

GREETING_PATTERN = re.compile(r'^(hi+|hello+|hey+|good (morning|afternoon|evening)|greetings|yo)[\s!.,]*$')


def detect_intent(message):
    """Detect if greeting, reservation, makeup, hours, menu, or general"""
    message_lower = message.lower().strip()

    if GREETING_PATTERN.fullmatch(message_lower):
        return "greeting"

    if any(word in message_lower for word in ["book", "table", "reservation", "reserve", "party", "people", "person", "guest"]):
        return "reservation"
    elif any(word in message_lower for word in ["makeup", "make-up", "lipstick", "foundation", "skincare", "skin care", "skin", "fragrance", "perfume", "cosmetic", "cosmetics", "beauty"]):
        return "makeup"
    elif any(word in message_lower for word in ["hours", "open", "close", "time", "available"]):
        return "hours"
    elif any(word in message_lower for word in ["menu", "food", "dish", "price"]):
        return "menu"
    else:
        return "general"
