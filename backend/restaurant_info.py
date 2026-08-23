"""Static restaurant info responses (hours, menu), AI-enhanced when possible."""

from config import RESTAURANT_DATA
from ai import get_ollama_response


def handle_hours_request():
    """Return hours with AI enhancement"""
    hours_text = "\n".join([f"{day}: {hours}" for day, hours in RESTAURANT_DATA["hours"].items()])

    prompt = f"""You are a helpful restaurant assistant.
A customer asked about restaurant hours.
Here are our hours:
{hours_text}

Phone: {RESTAURANT_DATA['phone']}

Give a friendly response about our hours in 1-2 short, simple sentences."""

    response = get_ollama_response(prompt, max_tokens=70)
    if response:
        return response
    else:
        return f"📋 {RESTAURANT_DATA['name']} Hours:\n{hours_text}\n\nPhone: {RESTAURANT_DATA['phone']}"


def handle_menu_request(message):
    """Return menu with AI enhancement"""
    menu_text = "MENU:\n"
    for category, items in RESTAURANT_DATA["menu"].items():
        menu_text += f"\n{category.upper()}:\n"
        for item in items:
            menu_text += f"  • {item['name']} - {item['price']}: {item['description']}\n"

    prompt = f"""You are a helpful restaurant assistant.
Customer asked: "{message}"

Our menu:
{menu_text}

Give a helpful response about our menu in 1-2 short, simple sentences."""

    response = get_ollama_response(prompt, max_tokens=70)
    if response:
        return response
    else:
        return menu_text
