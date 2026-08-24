# 🍽️ Srigen.ai — Srija Chatbot

A persona-based shopping assistant for a combined restaurant + beauty storefront ("Srigen.ai"). The AI assistant, **Srija**, chats with customers, suggests food and beauty products, composes full meals within a budget, and manages a shared cart and checkout across both the chatbot and the main site.

Built with **React** (frontend), **Flask** (backend API), **PostgreSQL** (persistence), and **Ollama** (local LLM, `phi3`) via a **LangGraph** intent router.

---

## 🚀 Features

- Persona-based flow: sign in → pick a persona → personalized chat greeting
- Floating chatbot widget (Srija) alongside a full storefront (food + beauty)
- Client-side food suggestion engine — instant, image-backed replies filtered by budget, diet, protein, calories, cuisine, meal time, or a mentioned dish/ingredient
- Meal composer: assembles a full plate (main + bread + salad + dessert) within a budget, with an interactive add/replace flow and per-item quantity control
- Shared cart between the chatbot and the main site, with a unified full-page checkout and quantity steppers
- Real order placement, persisted to PostgreSQL (not just a UI mock)
- Cart persisted to `localStorage` so a page refresh doesn't lose it
- Customer recognition (by name/phone/email) with returning-customer greetings and personalized recommendations
- Table reservations (extraction from natural language, storage, cancellation/update)
- Restaurant hours/menu and beauty catalog lookups
- Veg/non-veg indicators, nutrition info, and product detail pages
- Conversational polish: time-of-day-aware greetings, chat-before-suggest responses, follow-up prompts, and a hard cap on LLM reply length to avoid rambling/hallucinated responses

---

## 🛠️ Technologies Used

### Frontend
- React + Vite
- React Router
- Plain CSS / inline styles

### Backend
- Python + Flask (REST API)
- LangGraph (intent routing pipeline)
- Ollama (local LLM inference, `phi3` model)
- PostgreSQL via `psycopg2`

---

## 📂 Project Structure

```
Srija_Integration/
│
├── backend/
│   ├── app.py               # Flask app & API routes
│   ├── chatbot_graph.py     # LangGraph intent-routing pipeline
│   ├── intent.py            # Message → intent classification
│   ├── ai.py                # Ollama call wrapper
│   ├── customers.py         # Customer recognition & persistence
│   ├── reservations.py      # Reservation extraction & persistence
│   ├── restaurant_info.py   # Hours/menu responses
│   ├── beauty_info.py       # Makeup/beauty catalog & responses
│   ├── orders.py            # Order placement & history
│   ├── db.py                # PostgreSQL connection & schema init
│   ├── config.py            # Env config & static menu/catalog data
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── FloatingChatbot.jsx  # Srija chat widget
│   │   │   ├── ProductDetail.jsx    # Full-page product view
│   │   │   ├── CartPage.jsx         # Full-page cart & checkout
│   │   │   └── QtyStepper.jsx
│   │   └── pages/
│   │       ├── AuthPages/           # Sign in / sign up
│   │       ├── PersonaSelect/       # Persona picker
│   │       └── Chat/                # Main storefront + cart + nav
│   └── package.json
│
└── README.md
```

---

## ⚙️ How To Run

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL running locally (or reachable), with credentials in `backend/.env` (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`)
- [Ollama](https://ollama.com) installed, with the model pulled: `ollama pull phi3`

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
python app.py
```

Runs at `http://localhost:5000`. Tables are created automatically on first run.

### Ollama

```bash
ollama serve
```

(Usually already running in the background after install.) The backend expects it at `http://localhost:11434`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:5173`.
