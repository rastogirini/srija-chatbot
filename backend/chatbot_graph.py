"""LangGraph-based chat pipeline: recognition -> intent routing -> response."""

from typing import Optional, TypedDict

from langgraph.graph import StateGraph, START, END

from config import RESTAURANT_DATA
from customers import (
    extract_name_from_message,
    extract_phone_from_message,
    extract_email_from_message,
    recognize_customer,
    get_greeting,
    get_recommendations,
)
from reservations import extract_reservation_info, get_history, handle_reservation_request
from restaurant_info import handle_hours_request, handle_menu_request
from beauty_info import handle_makeup_request, get_matching_products
from intent import detect_intent
from ai import get_ollama_response, format_history
from db import save_chat_history


class ChatState(TypedDict, total=False):
    user_message: str
    history: list
    hint_name: Optional[str]
    hint_phone: Optional[str]
    hint_email: Optional[str]
    already_greeted: bool
    interests: Optional[list]
    extracted_name: Optional[str]
    extracted_phone: Optional[str]
    extracted_email: Optional[str]
    customer: Optional[dict]
    is_returning_customer: bool
    greeting_text: str
    history_text: str
    recommendations_text: str
    intent: str
    reservation_info: dict
    makeup_products: list
    ai_response: str
    final_response: str


def extract_identity(state: ChatState) -> ChatState:
    message = state["user_message"]
    # Prefer whatever's said in this message; fall back to the customer
    # already recognized earlier in the conversation (sent by the client
    # as a hint) so returning customers aren't re-asked for their details.
    return {
        "extracted_name": extract_name_from_message(message) or state.get("hint_name"),
        "extracted_phone": extract_phone_from_message(message) or state.get("hint_phone"),
        "extracted_email": extract_email_from_message(message) or state.get("hint_email"),
    }


def recognize_customer_node(state: ChatState) -> ChatState:
    customer = recognize_customer(
        state.get("extracted_name"),
        state.get("extracted_phone"),
        state.get("extracted_email"),
    )
    return {
        "customer": customer,
        "is_returning_customer": customer is not None,
    }


def build_customer_context(state: ChatState) -> ChatState:
    customer = state.get("customer")
    name = state.get("extracted_name")

    if state.get("already_greeted"):
        # Already introduced ourselves earlier in this conversation - don't
        # repeat the greeting/history/recommendations every turn, whether or
        # not this person has a real DB row (e.g. a persona with no history yet).
        return {"greeting_text": "", "history_text": "", "recommendations_text": ""}

    # A customer row existing doesn't make someone a "returning" customer for
    # greeting purposes - `visits` is the real signal (get_greeting already
    # keys its "Hi, {name}!" vs "Welcome back...!" split off the same
    # number). Without this check, a brand-new signup with a matching row
    # (or old leftover reservation from prior testing under that name) would
    # get shown fabricated-feeling "Personalized Recommendations" and past
    # history on their very first hello - which reads as untrustworthy,
    # especially when it's generic filler like "You loved None last time!".
    is_returning_visitor = bool(customer) and customer.get("visits", 1) > 1

    if customer:
        print(f"✅ Recognized customer: {customer['name']} (visits={customer.get('visits', 1)})")
        greeting_text = get_greeting(customer) + "\n\n"

        history_text = ""
        recommendations_text = ""
        if is_returning_visitor:
            history = get_history(customer["name"])
            if history:
                history_text = "📋 Your Past Reservations:\n"
                for res in history:
                    history_text += f"  • {res['date']} at {res['time']} - Party of {res['party_size']}\n"
                history_text += "\n"

            recommendations_text = get_recommendations(customer) + "\n\n"
    else:
        if name:
            print(f"ℹ️ New customer: {name}")
            greeting_text = f"Welcome, {name}! 👋\n\n"
        else:
            greeting_text = "Welcome! 👋\n\n"
        history_text = ""
        recommendations_text = ""

    return {
        "greeting_text": greeting_text,
        "history_text": history_text,
        "recommendations_text": recommendations_text,
    }


def detect_intent_node(state: ChatState) -> ChatState:
    intent = detect_intent(state["user_message"])
    print(f"🎯 Intent: {intent}")
    return {"intent": intent}


def extract_reservation_info_node(state: ChatState) -> ChatState:
    return {"reservation_info": extract_reservation_info(state["user_message"])}


def route_by_intent(state: ChatState) -> str:
    return state["intent"]


def handle_greeting_node(state: ChatState) -> ChatState:
    # No interests on file (guest, "Continue as Guest", legacy account) -
    # offer everything, same as before interests existed. Known interests
    # narrow the pitch to what the customer actually opted into at sign-up,
    # so a food+travel customer isn't pitched beauty products they never
    # asked about.
    interests = state.get("interests")
    knows_interests = bool(interests)
    wants_food = (not knows_interests) or ("food" in interests)
    wants_beauty = (not knows_interests) or ("beauty" in interests)

    offerings = []
    if wants_food:
        offerings.append("book a table or explore the menu")
    if wants_beauty:
        offerings.append("find your next favorite beauty pick, from lipstick to skincare")
    if not offerings:
        # Interests known but none of them map to anything we actually
        # offer (e.g. only travel/fitness picked) - fall back to food.
        offerings.append("book a table or explore the menu")

    return {"ai_response": f"How can I help you today? I can help you {' — or '.join(offerings)}."}


def handle_reservation_node(state: ChatState) -> ChatState:
    response = handle_reservation_request(
        state["user_message"],
        state.get("customer"),
        state.get("reservation_info"),
    )
    return {"ai_response": response}


def handle_hours_node(state: ChatState) -> ChatState:
    return {"ai_response": handle_hours_request()}


def handle_menu_node(state: ChatState) -> ChatState:
    return {"ai_response": handle_menu_request(state["user_message"])}


def handle_makeup_node(state: ChatState) -> ChatState:
    message = state["user_message"]
    return {
        "ai_response": handle_makeup_request(message, state.get("history")),
        "makeup_products": get_matching_products(message),
    }


def handle_general_node(state: ChatState) -> ChatState:
    user_message = state["user_message"]
    history_transcript = format_history(state.get("history"))

    prompt = f"""You are Srija, a warm and conversational AI assistant for {RESTAURANT_DATA['name']} restaurant and Srigen Beauty.

Our details:
- Phone: {RESTAURANT_DATA['phone']}
- Email: {RESTAURANT_DATA['email']}
- Address: {RESTAURANT_DATA['address']}
{history_transcript}
Customer just said: "{user_message}"

Reply in 1-2 short, simple sentences - no rambling, no invented details about them or their surroundings. If you don't have enough to give a genuinely useful answer (their budget, taste, dietary needs, what they're in the mood for, etc.), ask one short, friendly follow-up question instead of guessing. Don't repeat a question you already asked earlier in this conversation."""

    response = get_ollama_response(prompt, max_tokens=70)
    if not response:
        response = f"I'm here to help! Call us at {RESTAURANT_DATA['phone']} for more information."
    return {"ai_response": response}


def combine_response(state: ChatState) -> ChatState:
    final_response = (
        state.get("greeting_text", "")
        + state.get("recommendations_text", "")
        + state.get("history_text", "")
        + state.get("ai_response", "")
    )
    return {"final_response": final_response}


def persist_chat_history(state: ChatState) -> ChatState:
    save_chat_history(
        state.get("extracted_name"),
        state["user_message"],
        state["final_response"],
        state["intent"],
    )
    return {}


def _build_graph():
    graph = StateGraph(ChatState)

    graph.add_node("extract_identity", extract_identity)
    graph.add_node("recognize_customer_node", recognize_customer_node)
    graph.add_node("build_customer_context", build_customer_context)
    graph.add_node("detect_intent_node", detect_intent_node)
    graph.add_node("extract_reservation_info_node", extract_reservation_info_node)
    graph.add_node("handle_greeting_node", handle_greeting_node)
    graph.add_node("handle_reservation_node", handle_reservation_node)
    graph.add_node("handle_hours_node", handle_hours_node)
    graph.add_node("handle_menu_node", handle_menu_node)
    graph.add_node("handle_makeup_node", handle_makeup_node)
    graph.add_node("handle_general_node", handle_general_node)
    graph.add_node("combine_response", combine_response)
    graph.add_node("persist_chat_history", persist_chat_history)

    graph.add_edge(START, "extract_identity")
    graph.add_edge("extract_identity", "recognize_customer_node")
    graph.add_edge("recognize_customer_node", "build_customer_context")
    graph.add_edge("build_customer_context", "detect_intent_node")
    graph.add_edge("detect_intent_node", "extract_reservation_info_node")

    graph.add_conditional_edges(
        "extract_reservation_info_node",
        route_by_intent,
        {
            "greeting": "handle_greeting_node",
            "reservation": "handle_reservation_node",
            "hours": "handle_hours_node",
            "menu": "handle_menu_node",
            "makeup": "handle_makeup_node",
            "general": "handle_general_node",
        },
    )

    for handler_node in (
        "handle_greeting_node",
        "handle_reservation_node",
        "handle_hours_node",
        "handle_menu_node",
        "handle_makeup_node",
        "handle_general_node",
    ):
        graph.add_edge(handler_node, "combine_response")

    graph.add_edge("combine_response", "persist_chat_history")
    graph.add_edge("persist_chat_history", END)

    return graph.compile()


_graph = _build_graph()


def run_chat(user_message: str, hint_name: str = None, hint_phone: str = None, hint_email: str = None, already_greeted: bool = False, history: list = None, interests: list = None) -> ChatState:
    return _graph.invoke({
        "user_message": user_message,
        "hint_name": hint_name,
        "hint_phone": hint_phone,
        "hint_email": hint_email,
        "already_greeted": already_greeted,
        "history": history or [],
        "interests": interests,
    })
