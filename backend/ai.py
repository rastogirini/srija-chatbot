"""Ollama LLM call wrapper."""

import re

import requests

from config import OLLAMA_URL


def truncate_to_sentences(text, max_sentences=2):
    """Hard-cap a reply to its first N complete sentences. Prompts alone
    don't reliably keep phi3 to "1-2 sentences" - it sometimes rambles or
    invents unrelated details - so this guarantees short replies regardless
    of what the model actually produced. A trailing fragment with no
    terminal punctuation (cut off by the num_predict token cap) is dropped
    rather than kept, since it isn't a real sentence."""
    if not text:
        return text
    sentences = [s.strip() for s in re.findall(r'[^.!?]*[.!?]+', text.strip()) if s.strip()]
    if not sentences:
        return text.strip()
    return ' '.join(sentences[:max_sentences])


def format_history(history, limit=8):
    """Turn the last few {role, content} turns into a plain-text transcript
    block for embedding in a completion prompt (Ollama's /api/generate takes
    one string, not a role-based messages list like a chat API)."""
    if not history:
        return ""

    lines = []
    for turn in history[-limit:]:
        speaker = "Customer" if turn.get("role") == "user" else "Srija"
        content = (turn.get("content") or "").strip()
        if content:
            lines.append(f"{speaker}: {content}")

    if not lines:
        return ""

    return "\nConversation so far:\n" + "\n".join(lines) + "\n"


def get_ollama_response(prompt, max_tokens=150):
    """Get response from Ollama"""
    try:
        print(f"🤖 Calling Ollama...")

        payload = {
            "model": "phi3",
            # /api/chat (not /api/generate) applies phi3's chat template,
            # which both runs noticeably faster and - critically - actually
            # stops after one assistant turn instead of rambling on to
            # fabricate the customer's next reply too.
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "options": {
                "temperature": 0.7,
                # Hard cap so a rambling reply can't turn a 12s response into
                # a much longer one - phi3 runs CPU-only here and is slow per-token.
                "num_predict": max_tokens,
                # phi3 tends to answer cleanly for one paragraph, then drift
                # into an unrelated tangent or start fabricating the next
                # customer turn - cut it off before that happens.
                "stop": ["\n\n", "Customer:", "customer:"],
            },
        }

        response = requests.post(OLLAMA_URL, json=payload, timeout=60)

        if response.status_code == 200:
            data = response.json()
            ai_response = data.get('message', {}).get('content', '').strip()
            # phi3 sometimes echoes a speaker label at the start - strip it.
            for prefix in ('srija:', 'customer:'):
                if ai_response.lower().startswith(prefix):
                    ai_response = ai_response[len(prefix):].strip()
            print(f"✅ Ollama responded!")
            return truncate_to_sentences(ai_response)
        else:
            print(f"❌ Ollama error: {response.status_code}")
            return None

    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to Ollama! Make sure it's running (ollama serve)")
        return None
    except Exception as e:
        print(f"❌ Ollama error: {e}")
        return None
