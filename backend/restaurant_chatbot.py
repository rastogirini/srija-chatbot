"""
Restaurant Customer Support Chatbot using LangGraph
Handles: Reservations, Hours, Menu Info

✅ USES KEYWORD MATCHING - 100% FREE, NO AI NEEDED!
✅ WORKS OFFLINE
✅ FAST RESPONSES
"""

import os
from typing import TypedDict, Literal
from datetime import datetime
from langgraph.graph import StateGraph, START, END

DATABASE_FILE = "restaurant_chatbot.duckdb"
# ============================================================================
# 1. MOCK RESTAURANT DATA
# ============================================================================

RESTAURANT_DATA = {
    "name": "Srija's Taste",
    "hours": {
        "Monday": "10:00 AM - 10:00 PM",
        "Tuesday": "10:00 AM - 10:00 PM",
        "Wednesday": "10:00 AM - 10:00 PM",
        "Thursday": "10:00 AM - 10:00 PM",
        "Friday": "10:00 AM - 11:00 PM",
        "Saturday": "11:00 AM - 11:00 PM",
        "Sunday": "11:00 AM - 10:00 PM",
    },
    "phone": "+1-123-0123",
    "email": "support@srija.com",
    "address": "123 Main Street, Downtown",
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
    },
    "max_party_size": 50,
}

# Mock reservations database
RESERVATIONS = {}

# ============================================================================
# 2. DEFINE THE CHATBOT STATE
# ============================================================================

class ChatbotState(TypedDict):
    messages: list
    customer_intent: str
    extracted_info: dict
    response: str
    allergies: list
    diet_restrictions: list
    special_request: str
    special_occasion: str
    seating_preference: str
    special_instruction: str
    has_allergies: bool
    special_request_id: str
    awaiting_allergy_confirmation: bool

# ============================================================================
# 3. GET LLM - USES KEYWORD MATCHING (NO AI!)
# ============================================================================

def get_llm():
    """
    Using KEYWORD MATCHING (No AI needed!)
    - 100% FREE
    - Works offline
    - Perfect for restaurant bookings
    """
    return None  # This triggers keyword matching in all nodes

# ============================================================================
# 4. BASIC INTENT CLASSIFICATION (Keyword Matching)
# ============================================================================

def classify_intent_basic(message: str) -> str:
    """Classify intent using keyword matching"""
    message_lower = message.lower()
    
    reservation_keywords = ["reservation", "book", "table", "reserve", "booking", "party", "people", "booking"]
    hours_keywords = ["hours", "open", "close", "time", "when", "available", "opening"]
    menu_keywords = ["menu", "food", "dish", "item", "price", "eat", "drink", "appetizer", "main", "dessert"]
    
    for keyword in reservation_keywords:
        if keyword in message_lower:
            return "reservations"
    
    for keyword in hours_keywords:
        if keyword in message_lower:
            return "hours"
    
    for keyword in menu_keywords:
        if keyword in message_lower:
            return "menu"
    
    return "unknown"

# ============================================================================
# 5. BASIC INFO EXTRACTION (Keyword Matching)
# ============================================================================

def extract_info_basic(message: str) -> dict:
    """Extract information using regex patterns"""
    import re
    from datetime import datetime, timedelta
    
    extracted = {
        "party_size": None,
        "date": None,
        "time": None,
        "customer_name": None,
    }
    
    # Extract time
    time_pattern = r'at\s+(\d{1,2}):?(\d{2})?\s*(pm|am|PM|AM)?'
    time_match = re.search(time_pattern, message, re.IGNORECASE)
    if time_match:
        extracted["time"] = time_match.group(0).replace('at ', '').strip()
    
    # Extract party size
    people_pattern = r'(\d+)\s+(people|person|guests?)'
    people_match = re.search(people_pattern, message, re.IGNORECASE)
    if people_match:
        party_size = int(people_match.group(1))
        if 1 <= party_size <= 100:
            extracted["party_size"] = party_size
    
    # Extract date
    if "today" in message.lower():
        today = datetime.now()
        extracted["date"] = today.strftime("%Y-%m-%d")
    elif "tomorrow" in message.lower():
        tomorrow = datetime.now() + timedelta(days=1)
        extracted["date"] = tomorrow.strftime("%Y-%m-%d")
    
    # Extract customer name
    name_patterns = [
        r'under the name of\s+([A-Za-z]+)',
        r'name (?:is|of)\s+([A-Za-z]+)',
        r'book\s+(?:for|under)\s+([A-Za-z]+)',
    ]
    
    for pattern in name_patterns:
        name_match = re.search(pattern, message, re.IGNORECASE)
        if name_match:
            extracted["customer_name"] = name_match.group(1).capitalize()
            break
    
    return extracted

# ============================================================================
# 6. NODE FUNCTIONS
# ============================================================================

def understand_intent_node(state: ChatbotState) -> ChatbotState: 
    """Node-1, Understand what customer wants"""
    last_message = state["messages"][-1]["content"]
    intent = classify_intent_basic(last_message)
    state["customer_intent"] = intent
    print(f"🤖 Detected intent: {intent}")
    return state

def extract_info_node(state: ChatbotState) -> ChatbotState:
    """Node-2, Extract useful information"""
    last_message = state["messages"][-1]["content"]
    intent = state["customer_intent"]
    
    if intent == "reservations":
        state["extracted_info"] = extract_info_basic(last_message)
        print(f"📋 Extracted info: {state['extracted_info']}")
    else:
        state["extracted_info"] = {}
    
    return state

def handle_reservations_node(state: ChatbotState) -> ChatbotState:
    """Node-3, Handle reservation requests"""
    import duckdb
    
    extracted = state["extracted_info"]
    party_size = extracted.get("party_size")
    date = extracted.get("date")
    time = extracted.get("time")
    customer_name = extracted.get("customer_name")
    
    # Build response
    if not party_size or not date or not time:
        state["response"] = f"I'd be happy to help with a reservation! Could you please provide: party size, date, and time?"
    
    elif party_size > RESTAURANT_DATA["max_party_size"]:
        state["response"] = f"I appreciate the large party! However, we can only accommodate up to {RESTAURANT_DATA['max_party_size']} people. Please call us at {RESTAURANT_DATA['phone']} to discuss options."
    
    else:
        # ✅ Valid reservation - SAVE TO DUCKDB!
        try:
            conn = duckdb.connect(DATABASE_FILE)

            count = conn.execute(
                "SELECT COUNT(*) FROM reservations"
            ).fetchone()[0]

            reservation_id = f"RES-{count + 1001}"

            conn.execute("""
                INSERT INTO reservations (
                    id, name, party_size, date, time,
                    allergies, dietary, occasion, seating, instructions
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                reservation_id,
                customer_name or "Guest",
                party_size,
                date,
                time,
                "",
                "",
                "",
                "",
                ""
            ])

            conn.commit()
            conn.close()

            print(f"✅ Reservation {reservation_id} saved to DuckDB!")

        except Exception as e:
            print(f"❌ Error saving to DuckDB: {e}")

        RESERVATIONS[reservation_id] = {
            "name": customer_name or "Guest",
            "party_size": party_size,
            "date": date,
            "time": time,
        }

        confirmation = f"""
    ✅ RESERVATION CONFIRMED!
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    📋 RESERVATION DETAILS:
    Reservation ID: {reservation_id}
    Restaurant: {RESTAURANT_DATA['name']}
    Phone: {RESTAURANT_DATA['phone']}

    👤 Customer Name: {customer_name or 'Guest'}
    👥 Party Size: {party_size} people
    📅 Date: {date}
    ⏰ Time: {time}

    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    📍 Address: {RESTAURANT_DATA['address']}
    📧 Email: {RESTAURANT_DATA['email']}

    🎯 A confirmation email will be sent shortly.
    Thank you for choosing {RESTAURANT_DATA['name']}! 🍽️
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    """

        state["response"] = confirmation
        return state
def handle_hours_node(state: ChatbotState) -> ChatbotState:
    """Node-4, Handle hours inquiries"""
    hours_info = "\n".join([f"{day}: {hours}" for day, hours in RESTAURANT_DATA["hours"].items()])
    state["response"] = f"📋 {RESTAURANT_DATA['name']} Hours:\n{hours_info}\n\nPhone: {RESTAURANT_DATA['phone']}"
    return state

def handle_menu_node(state: ChatbotState) -> ChatbotState:
    """Node-5, Handle menu inquiries"""
    menu_text = f"Restaurant: {RESTAURANT_DATA['name']}\n\n"
    for category, items in RESTAURANT_DATA["menu"].items():
        menu_text += f"{category.upper()}:\n"
        for item in items:
            menu_text += f"  - {item['name']} ({item['price']}): {item['description']}\n"
    
    state["response"] = menu_text
    return state

def handle_unknown_node(state: ChatbotState) -> ChatbotState:
    """Node-6, Handle unknown questions"""
    state["response"] = f"I can help you with reservations, restaurant hours, or our menu. For other questions, please call us at {RESTAURANT_DATA['phone']}"
    return state

# ============================================================================
# 7. CONDITIONAL ROUTING
# ============================================================================

def route_intent(state: ChatbotState) -> Literal["reservations", "hours", "menu", "unknown"]:
    """Route to appropriate handler"""
    intent = state["customer_intent"]
    
    if intent == "reservations":
        return "reservations"
    elif intent == "hours":
        return "hours"
    elif intent == "menu":
        return "menu"
    else:
        return "unknown"

# ============================================================================
# 8. BUILD THE LANGGRAPH
# ============================================================================

def create_chatbot_graph():
    """Create the LangGraph workflow"""
    graph = StateGraph(ChatbotState)
    
    graph.add_node("understand_intent", understand_intent_node)
    graph.add_node("extract_info", extract_info_node)
    graph.add_node("reservations", handle_reservations_node)
    graph.add_node("hours", handle_hours_node)
    graph.add_node("menu", handle_menu_node)
    graph.add_node("unknown", handle_unknown_node)
    
    graph.add_edge(START, "understand_intent")
    graph.add_edge("understand_intent", "extract_info")
    
    graph.add_conditional_edges(
        "extract_info",
        route_intent,
        {
            "reservations": "reservations",
            "hours": "hours",
            "menu": "menu",
            "unknown": "unknown",
        }
    )
    
    graph.add_edge("reservations", END)
    graph.add_edge("hours", END)
    graph.add_edge("menu", END)
    graph.add_edge("unknown", END)
    
    return graph.compile()

# ============================================================================
# 9. MAIN CHATBOT FUNCTION
# ============================================================================

def chat_with_customer(user_message: str, conversation_history: list = None) -> str:
    """Main function to chat with a customer"""
    
    if conversation_history is None:
        conversation_history = []
    
    conversation_history.append({"role": "user", "content": user_message})
    
    state = ChatbotState(
        messages=conversation_history,
        customer_intent="unknown",
        extracted_info={},
        response="",
        allergies=[],
        diet_restrictions=[],
        special_request="",
        special_occasion="",
        seating_preference="",
        special_instruction="",
        has_allergies=False,
        special_request_id="",
        awaiting_allergy_confirmation=False,
    )
    
    chatbot = create_chatbot_graph()
    result = chatbot.invoke(state)
    
    response = result["response"]
    conversation_history.append({"role": "assistant", "content": response})
    
    return response, conversation_history

# ============================================================================
# 10. MAIN
# ============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("🍽️  RESTAURANT CUSTOMER SUPPORT CHATBOT")
    print("=" * 70)
    print(f"Restaurant: {RESTAURANT_DATA['name']}")
    print(f"Using: Keyword Matching (100% FREE!)")
    print("Type 'quit' to exit\n")
    
    conversation = []
    
    while True:
        user_input = input("You: ").strip()
        
        if user_input.lower() == "quit":
            print("\nThank you for using our chatbot! Goodbye! 👋")
            break
        
        if not user_input:
            continue
        
        print("\n🤔 Processing...\n")
        response, conversation = chat_with_customer(user_input, conversation)
        print(f"Bot: {response}\n")
        print("-" * 70 + "\n")
