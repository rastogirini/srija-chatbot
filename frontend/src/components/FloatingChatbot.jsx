import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './FloatingChatbot.css';
import srijaChatBubble from '../assets/Srija_ChatBubble.png';
import QtyStepper from './QtyStepper';

// Products-table row -> the item shape the chatbot's cards and flows use.
// Shared by the menus (loaded on mount) and the picks (whose rows come back
// with the /api/picks response itself).
const productImage = (p) => (p.image ? (p.image.startsWith('http') ? p.image : `http://localhost:5000${p.image}`) : '');

const toFoodItem = (p) => ({
  name: p.name,
  price: Number(p.price),
  cuisine: p.cuisine || 'indian',
  type: p.course || 'main',
  course: p.course || undefined,
  protein: p.protein || 'medium',
  diet: p.diet ? p.diet.split(',').filter(Boolean) : [],
  time: p.meal_time ? p.meal_time.split(',').filter(Boolean) : ['lunch', 'dinner'],
  fried: p.fried || false,
  curry: p.curry || false,
  image: productImage(p),
  description: p.description || '',
  nutrition: p.nutrition || null,
});

const toMakeupItem = (p) => ({
  name: p.name,
  price: Number(p.price),
  category: p.subcategory || 'skincare',
  description: p.description || '',
  image: productImage(p),
});

const toToyItem = (p) => ({
  name: p.name,
  price: Number(p.price),
  category: p.subcategory || 'building-blocks',
  description: p.description || '',
  image: productImage(p),
});

export default function FloatingChatbot({ initialPersona, initialEmail, initialInterests, onViewProduct, onOpenChange, cart, onAddToCart, onDecreaseQty, onShowCart, picksRequest }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [usedQuickActions, setUsedQuickActions] = useState([]);
  const [thinkingMessage, setThinkingMessage] = useState('Hold on...');
  // The most recently composed meal (from a "meal"/"combo"/"thali" request),
  // so a later follow-up like "add some paneer items" can offer to edit that
  // meal interactively instead of just dumping an unrelated card list.
  const [lastMeal, setLastMeal] = useState(null);
  // Per-candidate quantity chosen in the "which item would you like to add"
  // step, keyed by `${messageIndex}-${itemName}` so multiple such prompts
  // in the same conversation don't clash.
  const [candidateQty, setCandidateQty] = useState({});
  // Shopkeeper-uploaded products from the database (via the admin "Add
  // Product" form) - merged into the menus below so a newly added item is
  // actually findable through suggestions, not just stored. Beauty/toys
  // used to be a separate hardcoded array here (pre-dating the DB
  // migration) just for this component's local budget-only suggestions -
  // that meant an admin-added or admin-deleted beauty product never showed
  // up correctly here even though every other beauty flow was already
  // DB-driven, and toys was never added to it at all.
  const [dbFoodItems, setDbFoodItems] = useState([]);
  const [dbBeautyItems, setDbBeautyItems] = useState([]);
  const [dbToysItems, setDbToysItems] = useState([]);
  // Top sellers across all categories (public, business-numbers-stripped
  // version of the admin Best Sellers data) - for the "⭐ Best Sellers"
  // quick action. Just the (category, name) pairs; the full item details
  // come from foodMenu/makeupMenu/toysMenu below by matching on name, so
  // the cards render with the same shape as everywhere else instead of a
  // thinner one built from this endpoint's stripped-down fields.
  const [bestSellers, setBestSellers] = useState([]);
  // "Picks Made For You" (the page's hero button): every product name shown
  // so far this session, so "Show me more" brings fresh ones; and a flag
  // that holds the picks until the welcome greeting has landed, so they
  // appear below it rather than being overwritten by it.
  const [shownPicks, setShownPicks] = useState([]);
  const [pendingPicks, setPendingPicks] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetch('http://localhost:5000/api/products?category=food')
      .then(res => res.json())
      .then(data => { if (data.success) setDbFoodItems(data.products); })
      .catch(err => console.error('Could not load uploaded food products:', err));
    fetch('http://localhost:5000/api/products?category=beauty')
      .then(res => res.json())
      .then(data => { if (data.success) setDbBeautyItems(data.products); })
      .catch(err => console.error('Could not load uploaded beauty products:', err));
    fetch('http://localhost:5000/api/products?category=toys')
      .then(res => res.json())
      .then(data => { if (data.success) setDbToysItems(data.products); })
      .catch(err => console.error('Could not load uploaded toys products:', err));
    fetch('http://localhost:5000/api/products/bestsellers')
      .then(res => res.json())
      .then(data => { if (data.success) setBestSellers(data.products); })
      .catch(err => console.error('Could not load best sellers:', err));
  }, []);

  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0);

  // The full menu - original dishes and anything a shopkeeper has since
  // added via the admin "Add Product" form - now lives in the products
  // table (the original dishes were migrated in once, so the admin
  // Products/Best-Sellers page can see and track them like anything else).
  // Nutrition/protein/time/fried/curry are only real for the
  // originally-migrated dishes; admin-added items don't collect them yet,
  // so those come back null/default - renderFoodCard and the meal composer
  // already tolerate that (missing nutrition line, medium-protein default,
  // no curry-only bread pairing).
  const foodMenu = dbFoodItems.map(toFoodItem);

  // A distinct icon per dish, rather than the same fork-and-knife everywhere
  const FOOD_ICONS = {
    'Bruschetta': '🍞',
    'Paneer Tikka': '🧀',
    'Samosa': '🥟',
    'Spring Rolls': '🌯',
    'Grilled Salmon': '🐟',
    'Pasta Carbonara': '🍝',
    'Ribeye Steak': '🥩',
    'Butter Chicken': '🍛',
    'Biryani': '🍚',
    'Chana Masala': '🫘',
    'General Tso Chicken': '🍗',
    'Kung Pao Tofu': '🥡',
    'Vegetable Fried Rice': '🍚',
    'Mapo Tofu': '🌶️',
    'Tiramisu': '🍰',
    'Chocolate Cake': '🎂',
    'Gulab Jamun': '🍡',
    'Mango Pudding': '🥭',
    'Tandoori Roti': '🫓',
    'Butter Naan': '🫓',
  };

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-recognize the persona picked at sign-in so the bot greets by name
  // immediately, without the user having to type it in.
  const fetchPersonaGreeting = async (personaName, personaEmail, personaInterests) => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'hi', customer_name: personaName, customer_email: personaEmail, interests: personaInterests })
      });
      const data = await response.json();
      setMessages([{
        role: 'bot',
        content: data.success ? data.response : `Welcome, ${personaName}! 🍽️ How can I help you today?`
      }]);
      setCustomer({
        customer_name: personaName,
        extracted: { name: personaName, phone: data.extracted?.phone, email: data.extracted?.email || personaEmail },
      });
    } catch (error) {
      setMessages([{ role: 'bot', content: `Welcome, ${personaName}! 🍽️ How can I help you today?` }]);
      setCustomer({ customer_name: personaName, extracted: { name: personaName } });
    } finally {
      setLoading(false);
    }
  };

  // Let the parent page know when the chat opens/closes so it can make
  // room for it (matches the docked side-by-side layout, not an overlay).
  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen]);

  // Show welcome message when chat opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      if (initialPersona) {
        fetchPersonaGreeting(initialPersona, initialEmail, initialInterests);
      } else {
        setMessages([
          {
            role: 'bot',
            content: 'Welcome! 👋 Ask me about food — like "suggest dishes under 500rs" or "dinner options" — or beauty picks — like "show lipstick options" or "skincare for dry skin". How can I help?'
          }
        ]);
      }
    }
  }, [isOpen]);

  // The page's "Explore Picks Made For You" button bumps picksRequest:
  // open the chat, then show picks once the greeting (if any) has arrived.
  useEffect(() => {
    if (!picksRequest) return;
    setIsOpen(true);
    setPendingPicks(true);
  }, [picksRequest]);

  useEffect(() => {
    if (pendingPicks && isOpen && !loading && messages.length > 0) {
      setPendingPicks(false);
      showPicks();
    }
  }, [pendingPicks, isOpen, loading, messages.length]);

  // Thinking message rotation
  useEffect(() => {
    if (!loading) return;

    const thinkingMessages = [
      'Hold on...',
      'Checking...',
      'Finding ...',
      'Almost there...',
      'Preparing suggestions...'
    ];

    let messageIndex = 0;
    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % thinkingMessages.length;
      setThinkingMessage(thinkingMessages[messageIndex]);
    }, 3000);

    return () => clearInterval(interval);
  }, [loading]);

  // Common words to ignore when matching a message against live product
  // names by shared word ("show only ice-cream" shouldn't let "show" or
  // "only" spuriously match some unrelated product that happens to share
  // one of those words).
  const SUGGESTION_STOPWORDS = new Set([
    'the', 'a', 'an', 'to', 'of', 'for', 'and', 'or', 'is', 'it', 'me', 'my',
    'we', 'want', 'order', 'show', 'only', 'some', 'any', 'get', 'give',
    'please', 'with', 'have', 'has', 'are', 'you', 'your', 'can', 'could',
    'like', 'need', 'would', 'today', 'now', 'options', 'option',
  ]);

  // Ingredient/dish-name mentions ("paneer options", "any chicken dishes?")
  // that don't contain an explicit "suggest"/"budget"-style trigger word -
  // matching one of these routes the message to the instant, image-carrying
  // card response instead of falling through to the slow, occasionally
  // rambling/hallucinating backend chat model.
  const FOOD_KEYWORDS = {
    paneer: d => d.name.toLowerCase().includes('paneer'),
    chicken: d => d.name.toLowerCase().includes('chicken'),
    salmon: d => d.name.toLowerCase().includes('salmon'),
    steak: d => d.name.toLowerCase().includes('steak'),
    tofu: d => d.name.toLowerCase().includes('tofu'),
    dal: d => d.name.toLowerCase().includes('dal'),
    biryani: d => d.name.toLowerCase().includes('biryani'),
    pasta: d => d.name.toLowerCase().includes('pasta'),
    roti: d => d.name.toLowerCase().includes('roti'),
    naan: d => d.name.toLowerCase().includes('naan'),
    bread: d => d.course === 'bread',
    rice: d => d.name.toLowerCase().includes('rice'),
    salad: d => d.course === 'salad' || d.name.toLowerCase().includes('salad'),
    dessert: d => d.course === 'dessert' || d.type === 'dessert',
    sweet: d => d.course === 'dessert' || d.type === 'dessert',
    cake: d => d.name.toLowerCase().includes('cake'),
    paratha: d => d.name.toLowerCase().includes('paratha'),
    tikki: d => d.name.toLowerCase().includes('tikki'),
    rajma: d => d.name.toLowerCase().includes('rajma'),
    chaat: d => d.name.toLowerCase().includes('chaat'),
    samosa: d => d.name.toLowerCase().includes('samosa'),
  };

  // Parse user message for suggestions
  const parseFoodSuggestion = (message) => {
    const lowerMsg = message.toLowerCase();

    // "s?" so a plural mention ("desserts", "parathas", "rotis") still
    // matches - a strict \bdessert\b fails against "desserts" since the
    // trailing "s" blocks the word boundary right after "dessert", which
    // silently dropped the keyword filter entirely and fell back to
    // showing the first 5 menu items unfiltered.
    let dishKeyword = null;
    for (const kw of Object.keys(FOOD_KEYWORDS)) {
      if (new RegExp(`\\b${kw}s?\\b`, 'i').test(message)) { dishKeyword = kw; break; }
    }

    // FOOD_KEYWORDS above is a fixed, hand-maintained list - it has no idea
    // about a shopkeeper-uploaded product (e.g. "ice-cream"), so a message
    // naming one used to fall through to the ungrounded AI chat, which just
    // invented an answer instead of showing the real product. Falls back to
    // matching by shared *words*, not the whole name - "show me ice-cream"
    // should find "Ice-cream sundae" too, since "ice-cream" genuinely is
    // part of that name; requiring the full phrase was too strict and
    // missed exactly this case.
    let matchedProducts = [];
    if (!dishKeyword) {
      // Also add each token's simple singular form ("ice-creams" ->
      // "ice-cream") so a plural mention still matches a singular product
      // name - the raw token set alone requires an exact match, and a
      // hyphenated word like "ice-cream" doesn't go through FOOD_KEYWORDS'
      // own "s?" plural handling above since it isn't a fixed keyword.
      const tokenize = (text) => {
        const raw = (text.toLowerCase().match(/[a-z0-9-]+/g) || [])
          .filter(t => t.length >= 3 && !SUGGESTION_STOPWORDS.has(t));
        const expanded = new Set(raw);
        raw.forEach(t => { if (t.length > 3 && t.endsWith('s')) expanded.add(t.slice(0, -1)); });
        return [...expanded];
      };
      const messageTokens = new Set(tokenize(message));
      if (messageTokens.size > 0) {
        matchedProducts = foodMenu.filter(item =>
          tokenize(item.name).some(t => messageTokens.has(t))
        );
      }
    }

    // A message that's clearly about toys or beauty (e.g. "suggest me some
    // toys", "suggest a lipstick"), but didn't actually match any real food
    // dish/keyword, isn't a food suggestion request - without this check,
    // isSuggestionRequest below would still fire on words like "suggest",
    // and suggestDishes() always returns *something* regardless of
    // category, so the customer would see random desserts instead of toys
    // or beauty picks. Returning null here lets the message fall through to
    // the real backend chat call, which routes it to the correct intent
    // (toys_info.py / beauty_info.py) instead.
    const mentionsOtherCategory = !dishKeyword && matchedProducts.length === 0 &&
      /\b(toys?|lego|board game|puzzles?|action figures?|building blocks?|rubik|playset|lipstick|makeup|make-up|skincare|skin care|foundation|fragrance|perfume|cosmetics?|beauty)\b/i.test(message);
    if (mentionsOtherCategory) return null;

    // Check if user is asking for suggestions
    const isSuggestionRequest = lowerMsg.includes('suggest') ||
                                lowerMsg.includes('recommendation') ||
                                lowerMsg.includes('what should') ||
                                lowerMsg.includes('order') ||
                                lowerMsg.includes('recommend') ||
                                lowerMsg.includes('budget') ||
                                lowerMsg.includes('provide') ||
                                lowerMsg.includes('give me') ||
                                lowerMsg.includes('healthy') ||
                                lowerMsg.includes('fried') ||
                                lowerMsg.includes('diet') ||
                                lowerMsg.includes('protein') ||
                                lowerMsg.includes('carb') ||
                                lowerMsg.includes('keto') ||
                                /\b(meal|combo|thali)\b/i.test(message) ||
                                dishKeyword !== null || matchedProducts.length > 0;

    if (!isSuggestionRequest) return null;

    let budget = null;
    let mealTime = null;
    let diet = null;
    let cuisine = null;

    // Extract budget - handles "500rs"/"₹500"/"rs500"/"under Rs 500", and also
    // bare "under/within/below/for 500" with no currency word attached, since
    // that's how people naturally phrase a budget ("a meal under 800").
    const budgetMatch = message.match(/(?:rs\.?|₹)\s*(\d+)|(\d+)\s*(?:rs\b|rupees?|₹)|(?:under|within|below|for)\s+(?:rs\.?|₹)?\s*(\d+)/i);
    if (budgetMatch) {
      budget = parseInt(budgetMatch[1] || budgetMatch[2] || budgetMatch[3]);
    }

    // Extract meal time
    if (lowerMsg.includes('breakfast')) mealTime = 'breakfast';
    else if (lowerMsg.includes('lunch')) mealTime = 'lunch';
    else if (lowerMsg.includes('dinner')) mealTime = 'dinner';

    // "non-veg" contains the standalone word "veg" too ("-" counts as a word
    // boundary same as a space), so it must be checked before the plain
    // "veg" match below - otherwise it would be read as a vegetarian request,
    // the exact opposite of what was asked.
    const wantsNonVeg = /non[- ]?veg(etarian)?\b/i.test(message);

    // Extract diet preference (dietary restriction only - vegetarian/vegan/
    // gluten-free). "veg" is checked as a whole word (\b boundaries) so it
    // catches the common shorthand ("veg items", "any veg options?") without
    // matching as a false-positive substring inside "vegan" or "vegetable".
    if (!wantsNonVeg && (lowerMsg.includes('vegetarian') || /\b(veg|veggie|veggies)\b/i.test(message))) diet = 'vegetarian';
    else if (lowerMsg.includes('vegan')) diet = 'vegan';
    else if (lowerMsg.includes('gluten')) diet = 'gluten-free';

    // Extract calorie preference SEPARATELY from diet - a request like "veg
    // healthy meal with low calorie" needs both to apply at once, so this
    // can't be another branch in the diet if/else chain above (that would
    // silently drop the calorie preference whenever a diet was also given).
    // "high calorie" is checked before the plain "calorie" branch - otherwise
    // "high calorie options" would match the generic .includes('calorie')
    // check and get treated as low-calorie, the exact opposite of what was asked.
    let calorieLevel = null;
    if (/high[- ]?cal(orie)?\b/i.test(message)) calorieLevel = 'high-calorie';
    else if (lowerMsg.includes('calorie') || lowerMsg.includes('diet') || lowerMsg.includes('healthy')) calorieLevel = 'low-calorie';

    // Extract protein preference (same high/low distinction as calorie).
    // "protein rich" / "protein-rich" is treated the same as "high protein".
    let protein = null;
    if (/high[- ]?protein|protein[- ]?rich/i.test(message)) protein = 'high';
    else if (/low[- ]?protein/i.test(message)) protein = 'low';

    // Extract carb preference - not covered by the diet/calorie checks above.
    let lowCarb = false;
    if (/low[- ]?carb|keto/i.test(message)) lowCarb = true;

    // "non-fried" / "healthy" / "on a diet" should actually exclude fried
    // items (samosa, aloo tikki, ...) instead of being ignored entirely.
    // Only trips on a bare "diet" mention, not "high calorie" style requests.
    const excludeFried = /non[- ]?fried|not fried|no fried|avoid(?:ing)? fried|healthy|\bdiet\b/i.test(message)
      && calorieLevel !== 'high-calorie';

    // Extract cuisine preference
    if (lowerMsg.includes('italian')) cuisine = 'italian';
    else if (lowerMsg.includes('indian')) cuisine = 'indian';
    else if (lowerMsg.includes('chinese')) cuisine = 'chinese';

    // A full-meal request ("suggest a veg meal under 800", "non-veg thali",
    // "combo for dinner") should compose a complete plate - main(s) + bread +
    // salad + dessert - instead of just returning a flat list of matches.
    const wantsFullMeal = /\b(meal|combo|thali)\b/i.test(message);

    // "suggest"/"recommend"/"give me" are food-domain words on their own,
    // but they also show up in perfectly normal beauty requests ("suggest
    // something for my dry skin") - if the message clearly points at
    // skin/beauty and nothing food-specific was actually found, this isn't
    // a food request. Without this, it fell through to suggestDishes()
    // with every filter empty, which returned an arbitrary unfiltered dish
    // instead of ever reaching the backend's (correct) beauty routing.
    const mentionsBeautyDomain = /\b(skin|hair|shade|makeup|lipstick|foundation|skincare|perfume|fragrance)\b/i.test(message);
    const hasFoodSignal = budget !== null || mealTime !== null || diet !== null || cuisine !== null ||
      calorieLevel !== null || protein !== null || lowCarb || wantsNonVeg || wantsFullMeal || excludeFried ||
      dishKeyword !== null || matchedProducts.length > 0;
    if (mentionsBeautyDomain && !hasFoodSignal) return null;

    return { budget, mealTime, diet, calorieLevel, cuisine, excludeFried, protein, lowCarb, wantsNonVeg, wantsFullMeal, dishKeyword, matchedProducts };
  };

  // A short, natural acknowledgment of what was asked, sent as its own chat
  // bubble BEFORE the suggestion cards - so a request like "I'm hungry and
  // on a diet" lands as a two-turn conversation ("got it, here's what I'd
  // suggest") instead of jumping straight from the user's message to a card
  // dump with no reply in between.
  const buildConversationalReply = (criteria, { isMeal = false } = {}) => {
    if (criteria.matchedProducts?.length === 1) {
      return `Here's what I found for "${criteria.matchedProducts[0].name}":`;
    }
    if (criteria.matchedProducts?.length > 1) {
      return `Here's what I found:`;
    }
    if (criteria.dishKeyword) {
      return `Sure! Here are some ${criteria.dishKeyword} options for you:`;
    }

    const traits = [];
    if (criteria.wantsNonVeg) traits.push('non-veg');
    else if (criteria.diet === 'vegetarian') traits.push('vegetarian');
    else if (criteria.diet === 'vegan') traits.push('vegan');
    if (criteria.diet === 'gluten-free') traits.push('gluten-free');
    if (criteria.calorieLevel === 'low-calorie') traits.push('lighter');
    if (criteria.calorieLevel === 'high-calorie') traits.push('indulgent');
    if (criteria.protein === 'high') traits.push('high-protein');
    if (criteria.lowCarb) traits.push('low-carb');
    if (criteria.excludeFried) traits.push('non-fried');
    if (criteria.cuisine) traits.push(criteria.cuisine);

    const descriptor = traits.length > 0 ? `${traits.join(', ')} ` : '';
    const budgetPart = criteria.budget ? ` under ₹${criteria.budget}` : '';
    const mealTimePart = criteria.mealTime ? ` for ${criteria.mealTime}` : '';

    if (isMeal) {
      const openers = [
        `Got it! Let's put together a ${descriptor}meal${budgetPart}${mealTimePart} for you:`,
        `On it 😊 Here's a ${descriptor}meal${budgetPart}${mealTimePart} I'd suggest:`,
      ];
      return openers[Math.floor(Math.random() * openers.length)];
    }

    const openers = [
      `Got it! Here are some ${descriptor}options${budgetPart}${mealTimePart} for you:`,
      `I hear you 😊 A few ${descriptor}picks${budgetPart}${mealTimePart} that should work:`,
      `On it! These ${descriptor}dishes${budgetPart}${mealTimePart} should hit the spot:`,
    ];
    return openers[Math.floor(Math.random() * openers.length)];
  };

  // A closing nudge sent as its own chat bubble after the suggestion cards,
  // so the exchange doesn't just end with a card dump - it invites the
  // customer to actually act on what was shown.
  const pickOrderPrompt = ({ isMeal = false } = {}) => {
    const prompts = isMeal
      ? [
          "Want the whole meal, or should I swap something out?",
          "Which of these would you like to order?",
        ]
      : [
          "Which of these would you like to order?",
          "Let me know which one catches your eye, or I can add a few to your cart!",
          "Want me to add any of these to your cart?",
        ];
    return prompts[Math.floor(Math.random() * prompts.length)];
  };

  // Filter dishes based on criteria
  const suggestDishes = (criteria) => {
    let suggestions = foodMenu;

    // Filter by a mentioned ingredient/dish name ("paneer options", "any
    // chicken dishes?") first - it's the most specific signal, and applying
    // it before the softer preference filters below keeps results relevant
    // even if a criteria matcher weren't set. A live-product word match
    // (matchedProducts) is even more specific than a fixed keyword.
    if (criteria.matchedProducts?.length > 0) {
      suggestions = criteria.matchedProducts;
    } else if (criteria.dishKeyword) {
      suggestions = suggestions.filter(FOOD_KEYWORDS[criteria.dishKeyword]);
    }

    // Filter by budget
    if (criteria.budget) {
      suggestions = suggestions.filter(dish => dish.price <= criteria.budget);
    }

    // Filter by meal time
    if (criteria.mealTime) {
      suggestions = suggestions.filter(dish => dish.time.includes(criteria.mealTime));
    }

    // Filter by diet
    if (criteria.diet) {
      suggestions = suggestions.filter(dish => dish.diet.includes(criteria.diet));
    }

    // Filter by calorie level - independent of diet, so "veg + low calorie"
    // applies both instead of one silently overriding the other.
    if (criteria.calorieLevel) {
      suggestions = suggestions.filter(dish => dish.diet.includes(criteria.calorieLevel));
    }

    // Filter to non-vegetarian dishes (anything not tagged vegetarian/vegan)
    if (criteria.wantsNonVeg) {
      suggestions = suggestions.filter(dish => !dish.diet.includes('vegetarian') && !dish.diet.includes('vegan'));
    }

    // Filter by cuisine
    if (criteria.cuisine) {
      suggestions = suggestions.filter(dish => dish.cuisine === criteria.cuisine);
    }

    // Filter out fried items when the customer asked for non-fried/healthy food
    if (criteria.excludeFried) {
      suggestions = suggestions.filter(dish => !dish.fried);
    }

    // Filter by protein level
    if (criteria.protein) {
      suggestions = suggestions.filter(dish => dish.protein === criteria.protein);
    }

    // Filter by low-carb (<=15g carbs per 100g)
    if (criteria.lowCarb) {
      suggestions = suggestions.filter(dish => dish.nutrition && dish.nutrition.carbs <= 15);
    }

    return suggestions.slice(0, 5); // Return top 5
  };

  // Compose a full plate (main(s) + bread + salad + dessert) instead of a
  // flat list, for "meal"/"combo"/"thali" requests - e.g. "healthy meal
  // under 800" should come back as a vegetable/dal main with rice or bread,
  // a salad, and an optional dessert, not just a pile of matching mains.
  const buildMeal = (criteria) => {
    const budget = criteria.budget || 1500;
    let pool = foodMenu.filter(dish => dish.course);

    // Veg/non-veg, protein level, and calorie level all describe the MAIN
    // course, not every item on the plate - this menu's breads, salads and
    // desserts are always low-protein and not all tagged low-calorie, so
    // applying these as a hard filter across the whole pool (like an earlier
    // version of this function did) wiped out every bread/salad/dessert
    // option whenever a "high protein" or veg/non-veg meal was requested.
    // Only budget-agnostic, course-agnostic properties (time, cuisine, fried)
    // apply to the whole pool; protein/calorie/carb preferences are applied
    // to the main course as a hard filter, and to the sides as a soft
    // preference (only narrows the choice if it doesn't eliminate it).
    if (criteria.mealTime) pool = pool.filter(dish => dish.time.includes(criteria.mealTime));
    if (criteria.cuisine) pool = pool.filter(dish => dish.cuisine === criteria.cuisine);
    if (criteria.excludeFried) pool = pool.filter(dish => !dish.fried);

    let mains = pool.filter(d => d.course === 'main');
    if (criteria.wantsNonVeg) {
      mains = mains.filter(d => !d.diet.includes('vegetarian') && !d.diet.includes('vegan'));
    } else if (criteria.diet === 'vegetarian' || criteria.diet === 'vegan') {
      mains = mains.filter(d => d.diet.includes(criteria.diet));
    } else {
      // A meal should be built around a vegetable/dal main by default - only
      // non-veg mains are used when the customer explicitly asked for them.
      const vegMains = mains.filter(d => d.diet.includes('vegetarian') || d.diet.includes('vegan'));
      if (vegMains.length > 0) mains = vegMains;
    }
    if (criteria.protein) mains = mains.filter(d => d.protein === criteria.protein);
    if (criteria.calorieLevel) mains = mains.filter(d => d.diet.includes(criteria.calorieLevel));
    if (criteria.lowCarb) mains = mains.filter(d => d.nutrition && d.nutrition.carbs <= 15);

    const softFilter = (list, pred) => {
      const filtered = list.filter(pred);
      return filtered.length > 0 ? filtered : list;
    };

    let breads = pool.filter(d => d.course === 'bread');
    let salads = pool.filter(d => d.course === 'salad');
    let desserts = pool.filter(d => d.course === 'dessert');
    if (criteria.calorieLevel) {
      const matchesCalorie = d => d.diet.includes(criteria.calorieLevel);
      breads = softFilter(breads, matchesCalorie);
      salads = softFilter(salads, matchesCalorie);
      desserts = softFilter(desserts, matchesCalorie);
    }

    const cheapest = (list) => list.length ? list.reduce((a, b) => (a.price < b.price ? a : b)) : null;
    const pickRandom = (list) => list.length ? list[Math.floor(Math.random() * list.length)] : null;

    const picks = [];
    let remaining = budget;

    // Reserve enough for a bread + salad + dessert before committing to the
    // first main, so a pricier main doesn't eat the whole budget and leave
    // nothing for the rest of the plate.
    const reserve = (cheapest(breads)?.price || 0) + (cheapest(salads)?.price || 0) + (cheapest(desserts)?.price || 0);
    const firstMain = pickRandom(mains.filter(d => d.price <= remaining - reserve)) || pickRandom(mains.filter(d => d.price <= remaining));
    // A "meal" without a main isn't a meal - if nothing fits the budget at
    // all, fail out rather than returning a lone salad or dessert.
    if (!firstMain) return [];
    picks.push(firstMain);
    remaining -= firstMain.price;

    // Bread only makes sense alongside an actual curry/gravy dish - a rice
    // dish like biryani or a dry stir-fry doesn't traditionally come with
    // naan/roti, so don't include one just because it fits the budget.
    const hasCurry = firstMain?.curry === true;
    if (hasCurry) {
      const bread = pickRandom(breads.filter(d => d.price <= remaining));
      if (bread) { picks.push(bread); remaining -= bread.price; }
    }

    const salad = pickRandom(salads.filter(d => d.price <= remaining));
    if (salad) { picks.push(salad); remaining -= salad.price; }

    const dessert = pickRandom(desserts.filter(d => d.price <= remaining));
    if (dessert) { picks.push(dessert); remaining -= dessert.price; }

    // A second main (e.g. a dal alongside a vegetable) only goes in if there's
    // comfortable room left in the budget after the rest of the plate.
    const secondMain = pickRandom(mains.filter(d => d.name !== firstMain?.name && d.price <= remaining));
    if (secondMain) picks.push(secondMain);

    return picks;
  };

  // Beauty and toys catalogs, DB-driven (same products table every other
  // beauty/toys flow already reads from) so budget-only suggestions can
  // combine food + beauty + toys instantly, without a backend round trip -
  // same reasoning as foodMenu being built from dbFoodItems above.
  const makeupMenu = dbBeautyItems.map(toMakeupItem);
  const toysMenu = dbToysItems.map(toToyItem);

  const suggestMakeup = (criteria) => {
    if (!criteria.budget) return [];
    return makeupMenu.filter(item => item.price <= criteria.budget);
  };

  const suggestToys = (criteria) => {
    if (!criteria.budget) return [];
    return toysMenu.filter(item => item.price <= criteria.budget);
  };

  // "⭐ Best Sellers" quick action: look up each top-seller's full details
  // (nutrition, diet, subcategory, etc.) in the already-loaded menus by
  // name, rather than rendering straight off the bestSellers endpoint's
  // stripped-down fields - keeps the cards identical in shape to every
  // other suggestion list, not a thinner one-off format.
  const suggestBestSellers = () => {
    const results = [];
    for (const item of bestSellers) {
      if (item.category === 'food') {
        const match = foodMenu.find(f => f.name === item.name);
        if (match) results.push({ ...match, kind: 'food' });
      } else if (item.category === 'beauty') {
        const match = makeupMenu.find(m => m.name === item.name);
        if (match) results.push({ ...match, kind: 'makeup' });
      } else if (item.category === 'toys') {
        const match = toysMenu.find(t => t.name === item.name);
        if (match) results.push({ ...match, kind: 'toys' });
      }
    }
    return results;
  };

  // "Picks Made For You": the backend (picks.py) chooses the products and
  // why, and sends each product's full row along - converted with the same
  // to*Item functions the menus use, so the cards look like every other one.
  const PICK_GROUPS = {
    food: { label: '🍽️ Food', kind: 'food', toItem: toFoodItem },
    beauty: { label: '💄 Beauty', kind: 'makeup', toItem: toMakeupItem },
    toys: { label: '🧸 Toys', kind: 'toys', toItem: toToyItem },
  };

  const showPicks = async (more = false) => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: initialPersona,
          customer_email: initialEmail,
          interests: initialInterests,
          exclude: more ? shownPicks : [],
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      const groups = data.groups
        .map(group => {
          const meta = PICK_GROUPS[group.category];
          if (!meta) return null;
          const items = group.picks
            .map(pick => pick.product
              ? { ...meta.toItem(pick.product), kind: meta.kind, reason: pick.reason, reasonType: pick.reason_type }
              : null)
            .filter(Boolean);
          return items.length ? { category: group.category, label: meta.label, items } : null;
        })
        .filter(Boolean);

      if (groups.length === 0) {
        setMessages(prev => [...prev, { role: 'bot', content: "I couldn't find picks for you right now - try the quick actions below!" }]);
        return;
      }

      setShownPicks(prev => [...prev, ...groups.flatMap(g => g.items.map(i => i.name))]);
      const intro = more
        ? '🔄 Here are a few more:'
        : data.name ? `✨ Here's what I picked for you, ${data.name}:` : "✨ Here are our most-loved picks:";
      setMessages(prev => [...prev, { role: 'bot', content: 'picks', intro, groups, guest: data.guest }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', content: "Sorry, I couldn't load your picks just now. Please try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };

  // Follow-up chips under the picks - the matching interactive flow for
  // each category shown (shade quiz, Gift Finder, meal builder).
  const PICK_FOLLOW_UPS = {
    food: { label: '🍽️ Build my meal', message: 'Suggest a meal for me' },
    beauty: { label: '💄 Find my shade', message: 'Find my shade' },
    toys: { label: '🎁 Gift Finder', message: 'Gift finder' },
  };

  // "🎁 Gift Ideas" quick action: one giftable pick per category - a
  // dessert (food), a fragrance (beauty, a classic gift pick), and
  // whatever's first in the toys catalog. Not data-driven like Best
  // Sellers, just a simple honest "here's one of each" - same spirit as
  // beauty's quiz picks, which are also first-match, not a ranking.
  const suggestGiftIdeas = () => {
    const results = [];
    const foodGift = foodMenu.find(d => d.course === 'dessert') || foodMenu[0];
    if (foodGift) results.push({ ...foodGift, kind: 'food' });
    const beautyGift = makeupMenu.find(m => m.category === 'fragrance') || makeupMenu[0];
    if (beautyGift) results.push({ ...beautyGift, kind: 'makeup' });
    const toyGift = toysMenu[0];
    if (toyGift) results.push({ ...toyGift, kind: 'toys' });
    return results;
  };

  // Product card with real image + View/Add to cart, used for makeup items
  // in both the combined suggestions list and the dedicated makeup block.
  // Shared product card (real image thumbnail + View/Add to cart) used for
  // both food dishes and makeup products in the chatbot's suggestion lists.
  // Classic Indian menu veg/non-veg mark: a green or red/brown square with a
  // filled dot inside, same convention shoppers already recognize.
  const VegIndicator = ({ isVeg }) => (
    <span
      title={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '13px',
        height: '13px',
        border: `1.5px solid ${isVeg ? '#0ca678' : '#c92a2a'}`,
        borderRadius: '2px',
        flexShrink: 0,
      }}
    >
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: isVeg ? '#0ca678' : '#c92a2a',
      }} />
    </span>
  );

  const renderProductCard = (item, idx, { accent, accentDark, categoryLabel, icon, descriptionText, priceDisplay, viewProduct, nutritionText, isVeg }) => (
    <div key={idx} style={{
      background: 'white',
      borderRadius: '10px',
      overflow: 'hidden',
      marginBottom: '10px',
      border: `1px solid ${accent}33`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <div style={{
          width: '56px',
          height: '56px',
          overflow: 'hidden',
          background: '#f5f5f5',
          borderRadius: '6px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Products added without a photo get their icon instead of an
              empty <img> (which renders as a blank box). */}
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', flexShrink: 0, minWidth: '100%', maxWidth: 'none' }}
            />
          ) : (
            <span style={{ fontSize: '24px', opacity: 0.7 }}>{icon || '📦'}</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '10px',
            fontWeight: '700',
            color: accent,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: '3px',
          }}>
            {categoryLabel}
          </div>
          <div style={{ fontWeight: '600', color: '#333', fontSize: '13px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isVeg !== undefined && <VegIndicator isVeg={isVeg} />}
            <span>{item.name}</span>
          </div>
          <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px', display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0 }}>{icon}</span>
            <span>{descriptionText}</span>
          </div>
          {nutritionText && (
            <div style={{
              fontSize: '10px',
              fontWeight: '600',
              color: accent,
              background: `${accent}14`,
              display: 'inline-block',
              padding: '2px 6px',
              borderRadius: '4px',
              marginBottom: '6px',
            }}>
              {nutritionText}
            </div>
          )}
          <div style={{ fontWeight: '700', color: '#333', fontSize: '14px' }}>
            {priceDisplay}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <button
            type="button"
            onClick={() => onViewProduct?.(viewProduct)}
            style={{
              flex: 1,
              padding: '6px 0',
              fontSize: '12px',
              fontWeight: '600',
              color: accent,
              background: 'white',
              border: `1.5px solid ${accent}`,
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            View
          </button>
          {(cart.find(c => c.name === viewProduct.name && c.kind === viewProduct.kind)?.qty || 0) > 0 ? (
            <div style={{ flex: 1, padding: '2px 8px', border: `1.5px solid ${accent}`, borderRadius: '6px' }}>
              <QtyStepper
                qty={cart.find(c => c.name === viewProduct.name && c.kind === viewProduct.kind)?.qty || 0}
                accent={accent}
                variant="compact"
                onIncrease={() => onAddToCart(viewProduct)}
                onDecrease={() => onDecreaseQty(viewProduct.name, viewProduct.kind)}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onAddToCart(viewProduct)}
              style={{
                flex: 1,
                padding: '6px 0',
                fontSize: '12px',
                fontWeight: '600',
                color: 'white',
                background: `linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%)`,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              🛒 Add to cart
            </button>
          )}
      </div>
    </div>
  );

  const renderMakeupCard = (item, idx, priceDisplay) => renderProductCard(item, idx, {
    accent: '#d6336c',
    accentDark: '#ae2f5c',
    categoryLabel: item.category || 'beauty',
    icon: '✨',
    descriptionText: item.description,
    priceDisplay,
    viewProduct: {
      kind: 'makeup',
      name: item.name,
      image: item.image,
      description: item.description,
      category: item.category || 'beauty',
      price: priceDisplay,
    },
  });

  const renderToyCard = (item, idx, priceDisplay) => renderProductCard(item, idx, {
    accent: '#8b5cf6',
    accentDark: '#6d28d9',
    categoryLabel: item.category || 'toys',
    icon: '🧸',
    descriptionText: item.description,
    priceDisplay,
    viewProduct: {
      kind: 'toys',
      name: item.name,
      image: item.image,
      description: item.description,
      category: item.category || 'toys',
      price: priceDisplay,
    },
  });

  const renderFoodCard = (item, idx) => renderProductCard(item, idx, {
    accent: '#667eea',
    accentDark: '#4c51bf',
    categoryLabel: item.type,
    icon: FOOD_ICONS[item.name] || '🍴',
    descriptionText: `${item.cuisine.charAt(0).toUpperCase() + item.cuisine.slice(1)}${item.diet.length > 0 ? ' • ' + item.diet.join(', ') : ''}`,
    priceDisplay: `₹${item.price}`,
    nutritionText: item.nutrition
      ? `${item.nutrition.protein}g protein • ${item.nutrition.calories} cal • ${item.nutrition.carbs}g carb /100g`
      : null,
    isVeg: item.diet.includes('vegetarian') || item.diet.includes('vegan'),
    viewProduct: {
      kind: 'food',
      name: item.name,
      image: item.image,
      description: item.description,
      category: item.type,
      cuisine: item.cuisine,
      diet: item.diet,
      nutrition: item.nutrition,
      price: `₹${item.price}`,
    },
  });

  // `text` lets a button send a message in one click (the picks follow-up
  // chips); the Send button/Enter key pass nothing (or an event) and send
  // whatever is typed in the box.
  const handleSend = async (text) => {
    const userMessage = typeof text === 'string' ? text : input;
    if (!userMessage.trim()) return;

    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');

    // Check if it's a greeting. Matches whole words only (\b boundaries) -
    // a plain .includes() check here used to false-positive on any message
    // containing "hi" as a substring, e.g. "nothing" or "chicken".
    const greetings = ['hi', 'hello', 'hey', 'what\'s up', 'how are you', 'thanks', 'bye', 'goodbye'];
    const messageLower = userMessage.toLowerCase();
    const isGreeting = greetings.some(g => {
      const escaped = g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`).test(messageLower);
    });

    // Shade/skin-type quiz trigger - checked before anything food-related
    // since it's unambiguous and unrelated to meal/dish parsing. Starts a
    // 2-question interactive flow entirely in the widget; the backend is
    // only called once, at the end, with both answers.
    const wantsMakeupQuiz = /\b(find my (shade|match)|skin quiz|help me (choose|pick)|not sure what (suits|works for) me|recommend.*for my skin)\b/i.test(userMessage);
    if (wantsMakeupQuiz) {
      setMessages(prev => [...prev,
        { role: 'bot', content: "Let's find your match! Two quick questions:" },
        { role: 'bot', content: 'makeup_quiz', step: 'skin_type' },
      ]);
      return;
    }

    // Gift Finder quiz trigger - same 2-question-flow-in-the-widget pattern
    // as the shade quiz above, just for toys instead of beauty. The second
    // half (mentions both "gift" and "toy(s)" somewhere, in either order)
    // catches natural phrasings like "I have to gift toys, suggest some" or
    // "need a toy as a gift" - without it, a message like that fell through
    // to the backend's generic toys catalog (every item, no filtering)
    // instead of the actual quiz the customer was describing.
    const wantsGiftFinder = /\b(gift finder|find a gift|help me (choose|pick) a (toy|gift)|toy quiz|gift idea)\b/i.test(userMessage) ||
      (/\bgift(s|ing)?\b/i.test(userMessage) && /\btoys?\b/i.test(userMessage));
    if (wantsGiftFinder) {
      setMessages(prev => [...prev,
        { role: 'bot', content: "Let's find the perfect gift! Two quick questions:" },
        { role: 'bot', content: 'toys_quiz', step: 'age_range' },
      ]);
      return;
    }

    // "⭐ Best Sellers" and "🎁 Gift Ideas" quick actions - instant,
    // cross-category suggestion lists (same card renderer as the
    // Budget Friendly flow further below), gated by interest the same way
    // so a food-only customer doesn't get beauty/toys pushed unprompted.
    const knowsInterestsForPills = initialInterests && initialInterests.length > 0;
    const wantsBeautyForPills = !knowsInterestsForPills || initialInterests.includes('beauty');
    const wantsToysForPills = !knowsInterestsForPills || initialInterests.includes('toys');
    const matchesInterestGate = (item) =>
      item.kind === 'food' || (item.kind === 'makeup' && wantsBeautyForPills) || (item.kind === 'toys' && wantsToysForPills);

    const wantsBestSellers = /\b(best sellers?|bestsellers?|top sellers?|popular (items|picks|products))\b/i.test(userMessage);
    if (wantsBestSellers) {
      const results = suggestBestSellers().filter(matchesInterestGate);
      if (results.length === 0) {
        setMessages(prev => [...prev, { role: 'bot', content: "I don't have enough sales data yet to show best sellers - check back soon!" }]);
        return;
      }
      setMessages(prev => [...prev, { role: 'bot', content: 'suggestions', suggestions: results, intro: '⭐ Best Sellers:' }]);
      return;
    }

    const wantsGiftIdeas = /\bgift ideas\b/i.test(userMessage);
    if (wantsGiftIdeas) {
      const results = suggestGiftIdeas().filter(matchesInterestGate);
      if (results.length === 0) {
        setMessages(prev => [...prev, { role: 'bot', content: "I don't have gift ideas to show right now - try again in a moment!" }]);
        return;
      }
      setMessages(prev => [...prev, { role: 'bot', content: 'suggestions', suggestions: results, intro: '🎁 Gift Ideas:' }]);
      return;
    }

    // Check if it's a food suggestion request
    const suggestionCriteria = parseFoodSuggestion(userMessage);

    // Instant reply for greetings. "thanks"/"bye"/"goodbye" are farewells,
    // not openers - they get a short closing line instead of a time-of-day
    // greeting plus follow-up question, which would read as broken ("Good
    // evening! Craving something?" in reply to "bye").
    if (isGreeting && !suggestionCriteria) {
      const isThanks = /\bthanks\b/.test(messageLower);
      const isFarewell = /\b(bye|goodbye)\b/.test(messageLower);
      let reply;

      if (isThanks) {
        const thanksResponses = [
          "You're welcome! 😊 Anything else I can help with?",
          "Anytime! 👋 Let me know if you need anything else.",
          "My pleasure! 🍽️ Happy to help further if you need it.",
        ];
        reply = thanksResponses[Math.floor(Math.random() * thanksResponses.length)];
      } else if (isFarewell) {
        const farewellResponses = [
          "Bye! 👋 Come back whenever you're hungry (or need a beauty pick).",
          "Take care! 🍽️ See you next time.",
          "See you soon! 😊 Have a great one!",
        ];
        reply = farewellResponses[Math.floor(Math.random() * farewellResponses.length)];
      } else if (customer && messages.length === 1) {
        // The only bot message so far is the initial named welcome (e.g.
        // "Welcome, Sita! ..."), so this "hi" is the customer's very first
        // reply to it - repeating a full "Good afternoon, Sita!" salutation
        // here would just echo that same welcome back-to-back. Skip straight
        // to a follow-up nudge instead.
        const nudges = [
          "😊 What can I get started for you — food, beauty, or a table?",
          "😊 Menu, beauty picks, or a reservation — where should we start?",
          "😊 What are you in the mood for today?",
        ];
        reply = nudges[Math.floor(Math.random() * nudges.length)];
      } else {
        const hour = new Date().getHours();
        const name = customer?.customer_name || customer?.extracted?.name;
        const namePart = name ? `, ${name}` : '';

        let salutation;
        if (hour < 5) salutation = `Up late${namePart}? 🌙`;
        else if (hour < 12) salutation = `Good morning${namePart}! ☀️`;
        else if (hour < 17) salutation = `Good afternoon${namePart}! 👋`;
        else if (hour < 21) salutation = `Good evening${namePart}! 🌆`;
        else salutation = `Hey${namePart}, night owl! 🌙`;

        const followUps = [
          "Craving something specific, or should I suggest a meal for your budget?",
          "Looking for a dish, a beauty pick, or a table for tonight?",
          "Should I recommend something, or do you already have a dish in mind?",
          "Want today's specials, or are you after something in particular?",
        ];
        const followUp = followUps[Math.floor(Math.random() * followUps.length)];
        reply = `${salutation} ${followUp}`;
      }

      setMessages(prev => [...prev, { role: 'bot', content: reply }]);
      return;
    }

    // A literal "add X (to my cart)" naming an exact menu/product item
    // should really add it - unlike the general backend chat model, which
    // has no way to touch the frontend cart and would otherwise just
    // hallucinate a false "I've added it!" reply with nothing actually
    // happening (e.g. "yup add tiramisu" after seeing a Tiramisu card).
    if (/\b(add|order|get me|i'll take|i want)\b/i.test(userMessage)) {
      const allItems = [
        ...foodMenu.map(item => ({ ...item, kind: 'food' })),
        ...makeupMenu.map(item => ({ ...item, kind: 'makeup' })),
        ...toysMenu.map(item => ({ ...item, kind: 'toys' })),
      ];
      const matchedItem = allItems.find(item => {
        const escaped = item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escaped}\\b`, 'i').test(userMessage);
      });

      if (matchedItem) {
        const cartItem = matchedItem.kind === 'food'
          ? {
              kind: 'food',
              name: matchedItem.name,
              image: matchedItem.image,
              description: matchedItem.description,
              category: matchedItem.type,
              cuisine: matchedItem.cuisine,
              diet: matchedItem.diet,
              nutrition: matchedItem.nutrition,
              price: `₹${matchedItem.price}`,
            }
          : {
              kind: matchedItem.kind === 'toys' ? 'toys' : 'makeup',
              name: matchedItem.name,
              image: matchedItem.image,
              description: matchedItem.description,
              category: matchedItem.category || (matchedItem.kind === 'toys' ? 'toys' : 'beauty'),
              price: `₹${matchedItem.price}`,
            };

        onAddToCart(cartItem);
        setMessages(prev => [...prev, { role: 'bot', content: `Added ${matchedItem.name} to your cart! 🛒` }]);
        return;
      }
    }

    // Handle a full-meal composition ("meal"/"combo"/"thali") separately -
    // it assembles a plate (main(s) + bread + salad + dessert) instead of
    // just returning a flat filtered list.
    if (suggestionCriteria?.wantsFullMeal) {
      const mealPicks = buildMeal(suggestionCriteria).map(item => ({ ...item, kind: 'food' }));

      if (mealPicks.length === 0) {
        setMessages(prev => [...prev, {
          role: 'bot',
          content: '😔 Sorry, I couldn\'t put together a full meal within that budget. Try raising it a bit!'
        }]);
        return;
      }

      setLastMeal(mealPicks);
      setMessages(prev => [...prev, {
        role: 'bot',
        content: buildConversationalReply(suggestionCriteria, { isMeal: true })
      }, {
        role: 'bot',
        content: 'meal_suggestions',
        meal: mealPicks,
        criteria: suggestionCriteria
      }, {
        role: 'bot',
        content: pickOrderPrompt({ isMeal: true })
      }]);
      return;
    }

    // A dish/ingredient mention while there's already a composed meal on the
    // table ("add some paneer items") is a request to edit that meal, not a
    // cold suggestion request - offer the matching dishes and ask which one
    // to add and which current item it should replace, instead of just
    // dumping an unrelated card list.
    if ((suggestionCriteria?.dishKeyword || suggestionCriteria?.matchedProducts?.length > 0) && !suggestionCriteria.wantsFullMeal && lastMeal && lastMeal.length > 0) {
      const candidates = suggestionCriteria.matchedProducts?.length > 0
        ? suggestionCriteria.matchedProducts.slice(0, 4)
        : foodMenu.filter(FOOD_KEYWORDS[suggestionCriteria.dishKeyword]).slice(0, 4);
      if (candidates.length > 0) {
        setMessages(prev => [...prev, {
          role: 'bot',
          content: 'meal_addition_prompt',
          candidates,
          keyword: suggestionCriteria.matchedProducts?.[0]?.name || suggestionCriteria.dishKeyword
        }]);
        return;
      }
    }

    // Handle food (and, for budget-only asks with no food-specific
    // qualifier, beauty + toys) suggestions
    if (suggestionCriteria) {
      const isBudgetOnly = suggestionCriteria.budget && !suggestionCriteria.mealTime && !suggestionCriteria.diet && !suggestionCriteria.cuisine;

      // Don't proactively surface beauty/toys for a customer who never said
      // they're interested in that category (e.g. "Budget Friendly" for a
      // food+travel customer shouldn't come back with a lipstick). Unknown
      // interests (guest, no sign-up) keeps the old behavior of showing all.
      const knowsInterests = initialInterests && initialInterests.length > 0;
      const wantsBeautySuggestions = !knowsInterests || initialInterests.includes('beauty');
      const wantsToysSuggestions = !knowsInterests || initialInterests.includes('toys');

      const foodResults = suggestDishes(suggestionCriteria).map(item => ({ ...item, kind: 'food' }));
      const makeupResults = (isBudgetOnly && wantsBeautySuggestions)
        ? suggestMakeup(suggestionCriteria).map(item => ({ ...item, kind: 'makeup' }))
        : [];
      const toysResults = (isBudgetOnly && wantsToysSuggestions)
        ? suggestToys(suggestionCriteria).map(item => ({ ...item, kind: 'toys' }))
        : [];
      const suggestions = [...foodResults, ...makeupResults, ...toysResults];

      if (suggestions.length === 0) {
        setMessages(prev => [...prev, {
          role: 'bot',
          content: '😔 Sorry, nothing matches your criteria. Try adjusting your budget or preferences!'
        }]);
        return;
      }

      setMessages(prev => [...prev, {
        role: 'bot',
        content: buildConversationalReply(suggestionCriteria)
      }, {
        role: 'bot',
        content: 'suggestions',
        suggestions: suggestions,
        criteria: suggestionCriteria
      }, {
        role: 'bot',
        content: pickOrderPrompt()
      }]);
      return;
    }

    // Default API call for other queries
    setLoading(true);

    try {
      // Give the backend the last few plain-text turns so it can hold an
      // actual conversation instead of answering each message cold. Skips
      // structured messages (suggestion cards) since they aren't text.
      const history = messages
        .filter(m => typeof m.content === 'string' && m.content !== 'suggestions' && m.content !== 'makeup_suggestions' && m.content !== 'toys_suggestions' && m.content !== 'meal_suggestions' && m.content !== 'reservation_preferences' && m.content !== 'makeup_quiz' && m.content !== 'makeup_quiz_results' && m.content !== 'toys_quiz' && m.content !== 'toys_quiz_results' && m.content !== 'picks')
        .slice(-10)
        .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));

      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history,
          interests: initialInterests,
          // Once we've recognized who we're talking to, keep telling the
          // backend on later messages so it doesn't have to be re-told
          // name/phone/email that were already given earlier.
          ...(customer ? {
            customer_name: customer.customer_name,
            customer_phone: customer.extracted?.phone,
            customer_email: customer.extracted?.email,
            already_greeted: true,
          } : {})
        })
      });

      const data = await response.json();

      if (data.success) {
        const newMessages = [];
        // Show Srija's actual reply (the follow-up question, acknowledgement,
        // etc.) even when product cards are also being shown below it -
        // dropping the text here would silence the conversational half.
        if (data.response && data.response.trim()) {
          newMessages.push({ role: 'bot', content: data.response });
        }
        if (data.makeup_products && data.makeup_products.length > 0) {
          newMessages.push({ role: 'bot', content: 'makeup_suggestions', products: data.makeup_products });
        }
        if (data.toys_products && data.toys_products.length > 0) {
          newMessages.push({ role: 'bot', content: 'toys_suggestions', products: data.toys_products });
        }
        // All required reservation details are in but nothing's saved yet -
        // ask the two preference questions, then finalize. `pending` holds
        // the collected details to carry through both steps.
        if (data.reservation_pending) {
          newMessages.push({ role: 'bot', content: 'reservation_preferences', step: 'seating', pending: data.reservation_pending });
        }
        setMessages(prev => [...prev, ...newMessages]);
      }

      if (data.is_returning_customer) {
        setCustomer(data);
      }

    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { role: 'bot', content: 'Connection error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  // Step 1 of the interactive meal edit: the customer picked which new dish
  // they want - now ask which item currently in the meal it should replace.
  const handleSelectMealCandidate = (candidate, qty = 1) => {
    setMessages(prev => [...prev, { role: 'user', content: `Add ${qty > 1 ? `${qty}x ` : ''}${candidate.name}` }, {
      role: 'bot',
      content: 'meal_replace_prompt',
      candidate,
      qty,
      currentMeal: lastMeal
    }]);
  };

  // Step 2: apply the swap (or a plain addition) and re-render the updated
  // meal, same as the original composed-meal message. The chosen quantity
  // rides along as a `qty` field on the item object (not duplicated array
  // entries) - the Total line, the "order this meal" button, and the card
  // itself all read it to stay consistent.
  const handleReplaceMealItem = (candidate, oldItem, qty = 1) => {
    const newItem = { ...candidate, kind: 'food', course: oldItem ? oldItem.course : (candidate.course || 'main'), qty };
    const newMeal = oldItem
      ? lastMeal.map(item => (item === oldItem ? newItem : item))
      : [...lastMeal, newItem];

    setLastMeal(newMeal);
    const qtyLabel = qty > 1 ? `${qty}x ` : '';
    setMessages(prev => [...prev, { role: 'user', content: oldItem ? `Replace ${oldItem.name}` : 'Just add it' }, {
      role: 'bot',
      content: 'meal_suggestions',
      meal: newMeal,
      intro: oldItem
        ? `Done! Swapped in ${qtyLabel}${candidate.name} for ${oldItem.name} 🎉`
        : `Added ${qtyLabel}${candidate.name} to your meal! 🎉`
    }]);
  };

  // Pre-confirmation, step 1 of 2: seating preference. The booking is NOT
  // saved yet - `pending` carries the collected details forward, and this
  // choice just rides along to the dietary step.
  const handleSeatingChoice = (pending, choice) => {
    const labels = { window: '🪟 Window seat', quiet: '🤫 Somewhere quiet', none: 'No preference' };
    const seating = choice === 'none' ? null : (choice === 'window' ? 'Window' : 'Quiet');
    setMessages(prev => [...prev,
      { role: 'user', content: labels[choice] },
      { role: 'bot', content: 'reservation_preferences', step: 'dietary', pending: { ...pending, seating } },
    ]);
  };

  // Step 2 of 2: veg/non-veg preference. This is where the reservation is
  // finally written - POST /api/reservations with every collected field -
  // and the confirmation message is whatever the server sends back.
  const handleDietaryChoice = async (pending, choice) => {
    const labels = { veg: '🥦 Vegetarian', nonveg: '🍗 Non-vegetarian', none: 'No preference' };
    const dietary = choice === 'none' ? null : (choice === 'veg' ? 'Vegetarian' : 'Non-vegetarian');
    setMessages(prev => [...prev, { role: 'user', content: labels[choice] }]);
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pending, dietary }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, { role: 'bot', content: data.text }]);
      } else {
        setMessages(prev => [...prev, { role: 'bot', content: data.error || 'Sorry, I could not confirm that booking. Please try again.' }]);
      }
    } catch (error) {
      console.error('Error confirming reservation:', error);
      setMessages(prev => [...prev, { role: 'bot', content: 'Connection error while confirming your booking. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  // Shade/skin-type quiz, step 1 of 2: skin type. Nothing is fetched yet -
  // the answer just rides forward to the second question.
  const handleSkinTypeChoice = (skinType) => {
    const labels = { dry: '🌵 Dry, needs hydration', oily: '☀️ Oily or combination' };
    setMessages(prev => [...prev,
      { role: 'user', content: labels[skinType] },
      { role: 'bot', content: 'makeup_quiz', step: 'look', skinType },
    ]);
  };

  // Step 2 of 2: the look they're going for. This is where the backend is
  // finally called - once, with both answers - to turn them into real
  // catalog picks with a reason each.
  const handleLookChoice = async (skinType, look) => {
    const labels = { bold: '💋 Bold & long-lasting', natural: '🌷 Natural & glowy' };
    setMessages(prev => [...prev, { role: 'user', content: labels[look] }]);
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/makeup/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skin_type: skinType, look }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev,
          { role: 'bot', content: "Here's what I'd suggest for you:" },
          { role: 'bot', content: 'makeup_quiz_results', picks: data.picks },
        ]);
      } else {
        setMessages(prev => [...prev, { role: 'bot', content: data.error || 'Sorry, I could not put that together. Please try again.' }]);
      }
    } catch (error) {
      console.error('Error fetching quiz results:', error);
      setMessages(prev => [...prev, { role: 'bot', content: 'Connection error while finding your match. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  // Gift Finder quiz, step 1 of 2: recipient's age range. Nothing is
  // fetched yet - the answer just rides forward to the second question.
  const handleAgeRangeChoice = (ageRange) => {
    const labels = { toddler: '🧸 Toddler (1-3)', kid: '🎈 Kid (4-9)', tween: '🎮 Tween (10-12)' };
    setMessages(prev => [...prev,
      { role: 'user', content: labels[ageRange] },
      { role: 'bot', content: 'toys_quiz', step: 'occasion', ageRange },
    ]);
  };

  // Step 2 of 2: the occasion. This is where the backend is finally
  // called - once, with both answers - to turn them into real catalog
  // picks with a reason each.
  const handleOccasionChoice = async (ageRange, occasion) => {
    const labels = { birthday: '🎂 Birthday', 'just-because': '💝 Just because' };
    setMessages(prev => [...prev, { role: 'user', content: labels[occasion] }]);
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/toys/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ age_range: ageRange, occasion }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev,
          { role: 'bot', content: "Here's what I'd suggest:" },
          { role: 'bot', content: 'toys_quiz_results', picks: data.picks },
        ]);
      } else {
        setMessages(prev => [...prev, { role: 'bot', content: data.error || 'Sorry, I could not put that together. Please try again.' }]);
      }
    } catch (error) {
      console.error('Error fetching gift finder results:', error);
      setMessages(prev => [...prev, { role: 'bot', content: 'Connection error while finding a gift. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return createPortal(
    <div className="floating-chatbot">
      {/* Chat Bubble Button */}
      {!isOpen && (
        <>
          <div className="bubble-tag">
            <strong>Ask Srija</strong> · find anything
          </div>
          <button
            className="chat-bubble"
            onClick={() => setIsOpen(true)}
            title="Open Chat"
            aria-label="Open chat"
            style={{ backgroundImage: `url(${srijaChatBubble})` }}
          />
        </>
      )}

      {/* Chat Widget */}
      {isOpen && (
        <div className="chat-widget">
          {/* Header */}
          <div className="chat-header">
            <div
              className="header-avatar"
              role="img"
              aria-label="Srija"
              style={{ backgroundImage: `url(${srijaChatBubble})` }}
            />
            <div className="header-content">
              <div className="header-title-row">
                <h3>Srija</h3>
                <span className="ai-agent-badge">AI AGENT</span>
              </div>
              <span className="status">
                <span className="status-dot"></span>
                Online
              </span>
            </div>
            <button
              onClick={() => onShowCart?.()}
              title="Cart"
              style={{
                position: 'relative',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '0 4px',
                lineHeight: 1,
              }}
            >
              🛒
              {cartCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  background: '#d6336c',
                  color: 'white',
                  fontSize: '10px',
                  fontWeight: '700',
                  borderRadius: '999px',
                  minWidth: '16px',
                  height: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px',
                }}>
                  {cartCount}
                </span>
              )}
            </button>
            <button
              className="close-btn"
              onClick={() => setIsOpen(false)}
              title="Close Chat"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {messages.map((msg, i) => (
              <div key={i}>
                {/* Regular messages */}
                {msg.role === 'user' && (
                  <div className="message user">
                    <div className="message-content">
                      {msg.content}
                    </div>
                  </div>
                )}

                {msg.role === 'bot' && msg.content !== 'suggestions' && msg.content !== 'makeup_suggestions' && msg.content !== 'toys_suggestions' && msg.content !== 'meal_suggestions' &&
                  msg.content !== 'meal_addition_prompt' && msg.content !== 'meal_replace_prompt' && msg.content !== 'reservation_preferences' &&
                  msg.content !== 'makeup_quiz' && msg.content !== 'makeup_quiz_results' && msg.content !== 'toys_quiz' && msg.content !== 'toys_quiz_results' &&
                  msg.content !== 'picks' && (
                  <div className="message bot">
                    <div className="message-content">
                      {msg.content}
                    </div>
                  </div>
                )}

                {/* Food + Beauty Suggestions */}
                {msg.role === 'bot' && msg.content === 'suggestions' && (
                  <div style={{
                    margin: '10px 0',
                    padding: '12px',
                    background: '#f0f4ff',
                    borderRadius: '8px'
                  }}>
                    <h4 style={{
                      margin: '0 0 10px 0',
                      color: '#667eea',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      {msg.intro || `🎯 ${msg.suggestions.some(s => s.kind === 'makeup' || s.kind === 'toys') ? 'Suggested Picks:' : 'Suggested Dishes:'}`}
                    </h4>
                    {msg.suggestions.map((item, idx) =>
                      item.kind === 'makeup'
                        ? renderMakeupCard(item, idx, `₹${item.price}`)
                        : item.kind === 'toys'
                        ? renderToyCard(item, idx, `₹${item.price}`)
                        : renderFoodCard(item, idx)
                    )}
                  </div>
                )}

                {/* Picks Made For You - grouped by interest, each card with
                    the reason it was picked, then follow-up chips */}
                {msg.role === 'bot' && msg.content === 'picks' && (
                  <div style={{
                    margin: '10px 0',
                    padding: '12px',
                    background: 'linear-gradient(135deg, #f0f4ff 0%, #fdf2f8 100%)',
                    borderRadius: '8px'
                  }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#667eea', fontSize: '14px', fontWeight: '600' }}>
                      {msg.intro}
                    </h4>
                    {msg.groups.map(group => (
                      <div key={group.category} style={{ marginBottom: '8px' }}>
                        {msg.groups.length > 1 && (
                          <div style={{ fontSize: '11px', fontWeight: '800', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '6px 0 4px' }}>
                            {group.label}
                          </div>
                        )}
                        {group.items.map((item, idx) => (
                          <div key={item.name}>
                            <div style={{
                              fontSize: '11.5px', fontWeight: '600', lineHeight: 1.4, padding: '5px 9px', borderRadius: '8px', margin: '6px 0 4px',
                              color: item.reasonType === 'loved' ? '#be185d' : item.reasonType === 'new' ? '#0f766e' : '#b45309',
                              background: item.reasonType === 'loved' ? '#fdf2f8' : item.reasonType === 'new' ? '#f0fdfa' : '#fffbeb',
                              border: `1px solid ${item.reasonType === 'loved' ? '#fbcfe8' : item.reasonType === 'new' ? '#99f6e4' : '#fde68a'}`,
                            }}>
                              {item.reasonType === 'loved' ? '🔁' : item.reasonType === 'new' ? '🆕' : item.reasonType === 'best' ? '⭐' : '👀'} {item.reason}
                            </div>
                            {item.kind === 'makeup'
                              ? renderMakeupCard(item, idx, `₹${item.price}`)
                              : item.kind === 'toys'
                              ? renderToyCard(item, idx, `₹${item.price}`)
                              : renderFoodCard(item, idx)}
                          </div>
                        ))}
                      </div>
                    ))}
                    {msg.guest && (
                      <div style={{ fontSize: '12px', color: '#666', margin: '6px 0 2px' }}>
                        💡 Sign up to get picks made just for you, based on what you love.
                      </div>
                    )}
                    {/* Chips only on the latest picks message, so older ones
                        don't leave a trail of duplicate buttons. */}
                    {i === messages.map(m => m.content).lastIndexOf('picks') && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                        {msg.groups.map(group => PICK_FOLLOW_UPS[group.category]).filter(Boolean).map(chip => (
                          <button key={chip.label} onClick={() => handleSend(chip.message)} disabled={loading} style={{
                            background: 'white', border: '1px solid #c7cbf5', color: '#4c51bf', borderRadius: '999px',
                            padding: '6px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                          }}>
                            {chip.label}
                          </button>
                        ))}
                        <button onClick={() => showPicks(true)} disabled={loading} style={{
                          background: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none', color: 'white', borderRadius: '999px',
                          padding: '6px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                        }}>
                          🔄 Show me more
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Composed Meal (main + bread + salad + dessert) */}
                {msg.role === 'bot' && msg.content === 'meal_suggestions' && (
                  <div style={{
                    margin: '10px 0',
                    padding: '12px',
                    background: '#f0f4ff',
                    borderRadius: '8px'
                  }}>
                    <h4 style={{
                      margin: '0 0 10px 0',
                      color: '#667eea',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      {msg.intro || '🍽️ Your Meal:'}
                    </h4>
                    {[
                      { course: 'main', label: '🍛 Main' },
                      { course: 'bread', label: '🫓 Bread' },
                      { course: 'salad', label: '🥗 Salad' },
                      { course: 'dessert', label: '🍰 Dessert' },
                    ].map(({ course, label }) => {
                      const items = msg.meal.filter(item => item.course === course);
                      if (items.length === 0) return null;
                      return (
                        <div key={course} style={{ marginBottom: '8px' }}>
                          <div style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#4c51bf',
                            letterSpacing: '0.04em',
                            marginBottom: '6px',
                          }}>
                            {label}
                          </div>
                          {items.map((item, idx) => (
                            <div key={idx} style={{ position: 'relative' }}>
                              {item.qty > 1 && (
                                <div style={{
                                  position: 'absolute', top: '8px', right: '8px', zIndex: 1,
                                  background: '#667eea', color: 'white', fontSize: '11px', fontWeight: '700',
                                  padding: '2px 8px', borderRadius: '999px',
                                }}>
                                  ×{item.qty}
                                </div>
                              )}
                              {renderFoodCard(item, `${course}-${idx}`)}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#333', marginTop: '4px', marginBottom: '10px' }}>
                      Total: ₹{msg.meal.reduce((sum, item) => sum + item.price * (item.qty || 1), 0)}
                    </div>
                    <button
                      type="button"
                      onClick={() => msg.meal.forEach(item => {
                        for (let n = 0; n < (item.qty || 1); n++) onAddToCart(item);
                      })}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '9px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #667eea 0%, #4c51bf 100%)',
                        color: 'white',
                        fontWeight: '700',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                      }}
                    >
                      🛒 I want to order this meal
                    </button>
                  </div>
                )}

                {/* Interactive meal edit, step 1: which new dish to add */}
                {msg.role === 'bot' && msg.content === 'meal_addition_prompt' && (
                  <div style={{ margin: '10px 0', padding: '12px', background: '#f0f4ff', borderRadius: '8px' }}>
                    <div style={{ fontSize: '13px', color: '#333', marginBottom: '10px', lineHeight: '1.4' }}>
                      Which {msg.keyword} item would you like to add to your meal?
                    </div>
                    {msg.candidates.map((item, idx) => {
                      const qtyKey = `${i}-${item.name}`;
                      const qty = candidateQty[qtyKey] || 1;
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                            padding: '10px 12px', marginBottom: '6px', background: 'white', border: '1.5px solid #667eea55',
                            borderRadius: '8px',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectMealCandidate(item, qty)}
                            style={{
                              flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: '13px', fontWeight: '600', color: '#333', padding: 0,
                            }}
                          >
                            {FOOD_ICONS[item.name] || '🍴'} {item.name}
                          </button>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                            <QtyStepper
                              qty={qty}
                              accent="#667eea"
                              variant="compact"
                              onIncrease={() => setCandidateQty(prev => ({ ...prev, [qtyKey]: qty + 1 }))}
                              onDecrease={() => setCandidateQty(prev => ({ ...prev, [qtyKey]: Math.max(1, qty - 1) }))}
                            />
                            <span style={{ color: '#667eea', fontWeight: '700', minWidth: '48px', textAlign: 'right' }}>₹{item.price}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Interactive meal edit, step 2: which current item to replace */}
                {msg.role === 'bot' && msg.content === 'meal_replace_prompt' && (
                  <div style={{ margin: '10px 0', padding: '12px', background: '#f0f4ff', borderRadius: '8px' }}>
                    <div style={{ fontSize: '13px', color: '#333', marginBottom: '10px', lineHeight: '1.4' }}>
                      Got it — {msg.qty > 1 ? `${msg.qty}x ` : ''}{msg.candidate.name}! Which item should it replace?
                    </div>
                    {msg.currentMeal.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleReplaceMealItem(msg.candidate, item, msg.qty)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                          padding: '10px 12px', marginBottom: '6px', background: 'white', border: '1.5px solid #667eea55',
                          borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#333',
                        }}
                      >
                        <span>{FOOD_ICONS[item.name] || '🍴'} Replace {item.name}</span>
                        <span style={{ color: '#667eea', fontWeight: '700' }}>₹{item.price}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleReplaceMealItem(msg.candidate, null, msg.qty)}
                      style={{
                        display: 'flex', alignItems: 'center', width: '100%',
                        padding: '10px 12px', background: 'white', border: '1.5px solid #0ca67855',
                        borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#0ca678',
                      }}
                    >
                      ➕ Just add it, don't replace anything
                    </button>
                  </div>
                )}

                {/* Makeup Suggestions */}
                {msg.role === 'bot' && msg.content === 'makeup_suggestions' && (
                  <div style={{
                    margin: '10px 0',
                    padding: '12px',
                    background: '#fdf1f7',
                    borderRadius: '8px'
                  }}>
                    <h4 style={{
                      margin: '0 0 10px 0',
                      color: '#d6336c',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      💄 Suggested Products:
                    </h4>
                    {msg.products.map((product, idx) => renderMakeupCard(product, idx, product.price))}
                  </div>
                )}

                {/* Toys Suggestions */}
                {msg.role === 'bot' && msg.content === 'toys_suggestions' && (
                  <div style={{
                    margin: '10px 0',
                    padding: '12px',
                    background: '#f5f3ff',
                    borderRadius: '8px'
                  }}>
                    <h4 style={{
                      margin: '0 0 10px 0',
                      color: '#6d28d9',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      🧸 Suggested Toys:
                    </h4>
                    {msg.products.map((product, idx) => renderToyCard(product, idx, product.price))}
                  </div>
                )}

                {/* Pre-confirmation preference steps: seating, then dietary.
                    The booking isn't saved until both are answered. */}
                {msg.role === 'bot' && msg.content === 'reservation_preferences' && msg.step === 'seating' && (
                  <div style={{ margin: '10px 0', padding: '12px', background: '#f0f4ff', borderRadius: '8px' }}>
                    <div style={{ fontSize: '13px', color: '#333', marginBottom: '10px', lineHeight: '1.4' }}>
                      Any seating preference?
                    </div>
                    {[
                      { key: 'window', label: '🪟 Window seat' },
                      { key: 'quiet', label: '🤫 Somewhere quiet' },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSeatingChoice(msg.pending, key)}
                        style={{
                          display: 'flex', alignItems: 'center', width: '100%',
                          padding: '10px 12px', marginBottom: '6px', background: 'white', border: '1.5px solid #667eea55',
                          borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#333',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleSeatingChoice(msg.pending, 'none')}
                      style={{
                        display: 'flex', alignItems: 'center', width: '100%',
                        padding: '10px 12px', background: 'white', border: '1.5px solid #ccc',
                        borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#888',
                      }}
                    >
                      No preference
                    </button>
                  </div>
                )}

                {msg.role === 'bot' && msg.content === 'reservation_preferences' && msg.step === 'dietary' && (
                  <div style={{ margin: '10px 0', padding: '12px', background: '#f0f4ff', borderRadius: '8px' }}>
                    <div style={{ fontSize: '13px', color: '#333', marginBottom: '10px', lineHeight: '1.4' }}>
                      One more thing - vegetarian or non-vegetarian?
                    </div>
                    {[
                      { key: 'veg', label: '🥦 Vegetarian' },
                      { key: 'nonveg', label: '🍗 Non-vegetarian' },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleDietaryChoice(msg.pending, key)}
                        style={{
                          display: 'flex', alignItems: 'center', width: '100%',
                          padding: '10px 12px', marginBottom: '6px', background: 'white', border: '1.5px solid #667eea55',
                          borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#333',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleDietaryChoice(msg.pending, 'none')}
                      style={{
                        display: 'flex', alignItems: 'center', width: '100%',
                        padding: '10px 12px', background: 'white', border: '1.5px solid #ccc',
                        borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#888',
                      }}
                    >
                      No preference
                    </button>
                  </div>
                )}

                {/* Shade/skin-type quiz, step 1: skin type */}
                {msg.role === 'bot' && msg.content === 'makeup_quiz' && msg.step === 'skin_type' && (
                  <div style={{ margin: '10px 0', padding: '12px', background: '#fdf1f7', borderRadius: '8px' }}>
                    <div style={{ fontSize: '13px', color: '#333', marginBottom: '10px', lineHeight: '1.4' }}>
                      How would you describe your skin?
                    </div>
                    {[
                      { key: 'dry', label: '🌵 Dry, needs hydration' },
                      { key: 'oily', label: '☀️ Oily or combination' },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSkinTypeChoice(key)}
                        style={{
                          display: 'flex', alignItems: 'center', width: '100%',
                          padding: '10px 12px', marginBottom: '6px', background: 'white', border: '1.5px solid #d6336c55',
                          borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#333',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Step 2: the look they're going for */}
                {msg.role === 'bot' && msg.content === 'makeup_quiz' && msg.step === 'look' && (
                  <div style={{ margin: '10px 0', padding: '12px', background: '#fdf1f7', borderRadius: '8px' }}>
                    <div style={{ fontSize: '13px', color: '#333', marginBottom: '10px', lineHeight: '1.4' }}>
                      What look are you going for?
                    </div>
                    {[
                      { key: 'bold', label: '💋 Bold & long-lasting' },
                      { key: 'natural', label: '🌷 Natural & glowy' },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleLookChoice(msg.skinType, key)}
                        style={{
                          display: 'flex', alignItems: 'center', width: '100%',
                          padding: '10px 12px', marginBottom: '6px', background: 'white', border: '1.5px solid #d6336c55',
                          borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#333',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Quiz results - reuses the makeup product card, with each
                    item's `reason` shown in place of its catalog description
                    so the pick reads as personalized, not generic. */}
                {msg.role === 'bot' && msg.content === 'makeup_quiz_results' && (
                  <div style={{ margin: '10px 0', padding: '12px', background: '#fdf1f7', borderRadius: '8px' }}>
                    {msg.picks.map((item, idx) => renderMakeupCard({ ...item, description: item.reason }, idx, item.price))}
                  </div>
                )}

                {/* Gift Finder quiz, step 1: recipient's age range */}
                {msg.role === 'bot' && msg.content === 'toys_quiz' && msg.step === 'age_range' && (
                  <div style={{ margin: '10px 0', padding: '12px', background: '#f5f3ff', borderRadius: '8px' }}>
                    <div style={{ fontSize: '13px', color: '#333', marginBottom: '10px', lineHeight: '1.4' }}>
                      Who's this gift for?
                    </div>
                    {[
                      { key: 'toddler', label: '🧸 Toddler (1-3)' },
                      { key: 'kid', label: '🎈 Kid (4-9)' },
                      { key: 'tween', label: '🎮 Tween (10-12)' },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleAgeRangeChoice(key)}
                        style={{
                          display: 'flex', alignItems: 'center', width: '100%',
                          padding: '10px 12px', marginBottom: '6px', background: 'white', border: '1.5px solid #8b5cf655',
                          borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#333',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Step 2: the occasion */}
                {msg.role === 'bot' && msg.content === 'toys_quiz' && msg.step === 'occasion' && (
                  <div style={{ margin: '10px 0', padding: '12px', background: '#f5f3ff', borderRadius: '8px' }}>
                    <div style={{ fontSize: '13px', color: '#333', marginBottom: '10px', lineHeight: '1.4' }}>
                      What's the occasion?
                    </div>
                    {[
                      { key: 'birthday', label: '🎂 Birthday' },
                      { key: 'just-because', label: '💝 Just because' },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleOccasionChoice(msg.ageRange, key)}
                        style={{
                          display: 'flex', alignItems: 'center', width: '100%',
                          padding: '10px 12px', marginBottom: '6px', background: 'white', border: '1.5px solid #8b5cf655',
                          borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#333',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Gift Finder results - reuses the toy product card, with
                    each item's `reason` shown in place of its catalog
                    description so the pick reads as personalized. */}
                {msg.role === 'bot' && msg.content === 'toys_quiz_results' && (
                  <div style={{ margin: '10px 0', padding: '12px', background: '#f5f3ff', borderRadius: '8px' }}>
                    {msg.picks.map((item, idx) => renderToyCard({ ...item, description: item.reason }, idx, item.price))}
                  </div>
                )}
              </div>
            ))}

            {/* Question cards for a returning customer's first entry only - each
                one disappears once used, and the whole group disappears for good
                the moment the customer sends their own first message (their
                message is appended to `messages` before any reply is added, so
                `messages.length` moves past 1 right away) - not just after
                specific reply types. */}
            {customer && messages.length === 1 && usedQuickActions.length < 2 && !loading && (
              <div className="question-cards">
                {!usedQuickActions.includes('salad') && (
                  <button className="question-card" onClick={() => { setInput('Want to order some salads?'); setUsedQuickActions(prev => [...prev, 'salad']); }}>
                    <span className="q-icon">🥗</span>
                    <span className="q-text">Want to order some salads?</span>
                  </button>
                )}
                {!usedQuickActions.includes('specialty') && (
                  <button className="question-card" onClick={() => { setInput('Order our specialty dishes'); setUsedQuickActions(prev => [...prev, 'specialty']); }}>
                    <span className="q-icon">⭐</span>
                    <span className="q-text">Order our specialty dishes?</span>
                  </button>
                )}
              </div>
            )}

            {loading && (
              <div className="message bot">
                <div className="message-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{thinkingMessage}</span>
                    <span className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
            
          {/* Input Area */}
          <div className="chat-input-area">
            <input
              type="text"
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
            />
            <button 
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="send-btn"
            >
              Send
            </button>
          </div>

          {/* Quick Actions - 3 fixed pills, each one a cross-category ask
              (price / popularity / giftability) rather than a single-
              category shortcut, so every pill is relevant to any customer
              regardless of which interests they picked at sign-up. Interest
              gating (e.g. not pushing beauty on a food-only customer) still
              happens inside each pill's own handler, same as before. */}
          <div className="quick-actions">
            {(() => {
              const PILLS = [
                { key: 'budget', icon: '💰', label: 'Budget Friendly', input: 'Budget friendly under Rs500' },
                { key: 'bestsellers', icon: '⭐', label: 'Best Sellers', input: 'Show me best sellers' },
                { key: 'giftideas', icon: '🎁', label: 'Gift Ideas', input: 'Gift ideas' },
              ];
              return PILLS.map(pill => (
                <button key={pill.key} onClick={() => setInput(pill.input)}>{pill.icon} {pill.label}</button>
              ));
            })()}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
