import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './FloatingChatbot.css';
import srijaChatBubble from '../assets/Srija_ChatBubble.png';
import QtyStepper from './QtyStepper';

export default function FloatingChatbot({ initialPersona, initialEmail, initialInterests, onViewProduct, onOpenChange, cart, onAddToCart, onDecreaseQty, onShowCart }) {
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
  const messagesEndRef = useRef(null);

  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0);

  // Food Menu Data
  // nutrition values are approximate, per 100g - illustrative, not lab-tested
  const foodMenu = [
    { name: 'Bruschetta', price: 300, cuisine: 'italian', type: 'appetizer', protein: 'low', diet: ['vegan'], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop', description: 'Toasted bread with tomatoes, garlic and basil', nutrition: { protein: 6, calories: 150, carbs: 22 } },
    { name: 'Paneer Tikka', price: 400, cuisine: 'indian', type: 'appetizer', protein: 'high', diet: ['vegetarian', 'gluten-free'], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1755090154677-87e7aa5487ff?w=400&h=300&fit=crop', description: 'Grilled cottage cheese with yogurt and spices', nutrition: { protein: 18, calories: 220, carbs: 6 } },
    { name: 'Samosa', price: 75, cuisine: 'indian', type: 'appetizer', protein: 'low', diet: ['vegan'], time: ['breakfast', 'lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop', description: 'Crispy pastry with spiced potato filling', fried: true, nutrition: { protein: 4, calories: 260, carbs: 30 } },
    { name: 'Spring Rolls', price: 280, cuisine: 'chinese', type: 'appetizer', protein: 'low', diet: [], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1695712641569-05eee7b37b6d?w=400&h=300&fit=crop', description: 'Crispy rolls with vegetables and meat', fried: true, nutrition: { protein: 5, calories: 230, carbs: 25 } },

    { name: 'Grilled Salmon', price: 650, cuisine: 'italian', type: 'main', course: 'main', protein: 'high', diet: ['gluten-free', 'low-calorie'], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop', description: 'Fresh Atlantic salmon with lemon butter sauce', nutrition: { protein: 20, calories: 180, carbs: 1 } },
    { name: 'Pasta Carbonara', price: 550, cuisine: 'italian', type: 'main', course: 'main', protein: 'high', diet: [], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=300&fit=crop', description: 'Creamy Italian pasta with pancetta and parmesan', nutrition: { protein: 10, calories: 250, carbs: 28 } },
    { name: 'Ribeye Steak', price: 750, cuisine: 'italian', type: 'main', course: 'main', protein: 'high', diet: ['gluten-free', 'low-calorie'], time: ['dinner'], image: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400&h=300&fit=crop', description: 'Prime cut aged 28 days with garlic butter', nutrition: { protein: 25, calories: 220, carbs: 0 } },
    { name: 'Butter Chicken', price: 550, cuisine: 'indian', type: 'main', course: 'main', curry: true, protein: 'high', diet: ['gluten-free'], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1742599361498-79824d24e355?w=400&h=300&fit=crop', description: 'Tender chicken in creamy tomato sauce with spices', nutrition: { protein: 16, calories: 230, carbs: 7 } },
    { name: 'Biryani', price: 500, cuisine: 'indian', type: 'main', course: 'main', protein: 'low', diet: [], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400&h=300&fit=crop', description: 'Fragrant rice with meat and aromatic spices', nutrition: { protein: 9, calories: 200, carbs: 28 } },
    { name: 'Chana Masala', price: 380, cuisine: 'indian', type: 'main', course: 'main', curry: true, protein: 'low', diet: ['vegetarian', 'vegan', 'gluten-free', 'low-calorie'], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1716535232842-d10da4eb33d5?w=400&h=300&fit=crop', description: 'Chickpeas in aromatic tomato curry', nutrition: { protein: 7, calories: 140, carbs: 18 } },
    { name: 'General Tso Chicken', price: 500, cuisine: 'chinese', type: 'main', course: 'main', protein: 'high', diet: ['gluten-free', 'low-calorie'], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400&h=300&fit=crop', description: 'Crispy chicken in spicy tangy sauce', fried: true, nutrition: { protein: 14, calories: 280, carbs: 20 } },
    { name: 'Kung Pao Tofu', price: 420, cuisine: 'chinese', type: 'main', course: 'main', protein: 'high', diet: ['vegetarian', 'vegan', 'low-calorie'], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop', description: 'Tofu with peanuts in savory sauce', nutrition: { protein: 10, calories: 180, carbs: 10 } },
    { name: 'Vegetable Fried Rice', price: 350, cuisine: 'chinese', type: 'main', protein: 'low', diet: ['vegetarian', 'vegan', 'gluten-free'], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1751618646882-4221d5e3b1c2?w=400&h=300&fit=crop', description: 'Rice stir-fried with fresh vegetables', fried: true, nutrition: { protein: 4, calories: 170, carbs: 28 } },
    { name: 'Mapo Tofu', price: 400, cuisine: 'chinese', type: 'main', course: 'main', protein: 'low', diet: ['gluten-free'], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=400&h=300&fit=crop', description: 'Soft tofu in spicy sauce with minced meat', nutrition: { protein: 9, calories: 150, carbs: 6 } },

    { name: 'Tiramisu', price: 250, cuisine: 'italian', type: 'dessert', course: 'dessert', protein: 'low', diet: ['vegetarian'], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=400&h=300&fit=crop', description: 'Classic Italian dessert with mascarpone', nutrition: { protein: 5, calories: 280, carbs: 30 } },
    { name: 'Chocolate Cake', price: 280, cuisine: 'italian', type: 'dessert', course: 'dessert', protein: 'low', diet: ['vegetarian'], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop', description: 'Rich dark chocolate cake with ganache', nutrition: { protein: 5, calories: 370, carbs: 50 } },
    { name: 'Gulab Jamun', price: 220, cuisine: 'indian', type: 'dessert', course: 'dessert', protein: 'low', diet: ['vegetarian'], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1595608010652-d8bf1103a1c5?w=400&h=300&fit=crop', description: 'Sweet dumplings in rose syrup', fried: true, nutrition: { protein: 4, calories: 320, carbs: 45 } },
    { name: 'Mango Pudding', price: 240, cuisine: 'chinese', type: 'dessert', course: 'dessert', protein: 'low', diet: ['vegetarian', 'low-calorie'], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1617075355766-3b6c68938165?w=400&h=300&fit=crop', description: 'Smooth mango dessert with coconut milk', nutrition: { protein: 3, calories: 150, carbs: 28 } },

    { name: 'Paneer Butter Masala', price: 480, cuisine: 'indian', type: 'main', course: 'main', curry: true, protein: 'high', diet: ['vegetarian', 'gluten-free', 'high-calorie'], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1567529854338-fc097b962123?w=400&h=300&fit=crop', description: 'Paneer cubes in a rich, creamy tomato gravy', nutrition: { protein: 15, calories: 250, carbs: 9 } },
    { name: 'Rajma Chawal', price: 420, cuisine: 'indian', type: 'main', course: 'main', curry: true, protein: 'high', diet: ['vegetarian', 'gluten-free', 'high-calorie'], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1668236534990-73c4ed23043c?w=400&h=300&fit=crop', description: 'Kidney bean curry served over steamed rice', nutrition: { protein: 11, calories: 210, carbs: 24 } },
    { name: 'Masoor Dal', price: 280, cuisine: 'indian', type: 'main', course: 'main', curry: true, protein: 'high', diet: ['vegetarian', 'vegan', 'gluten-free', 'low-calorie'], time: ['lunch', 'dinner'], image: 'https://plus.unsplash.com/premium_photo-1699293238624-819cfcfa1de3?w=400&h=300&fit=crop', description: 'Red lentils simmered with mild aromatic spices', nutrition: { protein: 10, calories: 110, carbs: 16 } },
    { name: 'Moong Sprouts Chaat', price: 180, cuisine: 'indian', type: 'appetizer', course: 'salad', protein: 'high', diet: ['vegetarian', 'vegan', 'gluten-free', 'low-calorie'], time: ['breakfast', 'lunch'], image: 'https://images.unsplash.com/photo-1622732777601-e744c3401d44?w=400&h=300&fit=crop', description: 'Sprouted moong beans tossed with lemon and spices', nutrition: { protein: 10, calories: 90, carbs: 12 } },
    { name: 'Aloo Paratha', price: 220, cuisine: 'indian', type: 'main', course: 'bread', protein: 'low', diet: ['vegetarian', 'high-calorie'], time: ['breakfast', 'lunch'], image: 'https://images.unsplash.com/photo-1708782343717-be4ea260249a?w=400&h=300&fit=crop', description: 'Whole wheat flatbread stuffed with spiced potato', fried: true, nutrition: { protein: 5, calories: 270, carbs: 35 } },
    { name: 'Aloo Tikki', price: 200, cuisine: 'indian', type: 'appetizer', protein: 'low', diet: ['vegetarian', 'gluten-free', 'high-calorie'], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1755090155112-16fe70d49ca3?w=400&h=300&fit=crop', description: 'Crispy pan-fried potato patties with green chutney', fried: true, nutrition: { protein: 4, calories: 220, carbs: 28 } },
    { name: 'Jeera Rice', price: 180, cuisine: 'indian', type: 'main', protein: 'low', diet: ['vegetarian', 'vegan', 'gluten-free', 'low-calorie'], time: ['lunch', 'dinner'], image: 'https://indianspice.ca/wp-content/uploads/2022/12/Indian_Spice_Jeera_Rice.jpg', description: 'Basmati rice tempered with roasted cumin seeds', nutrition: { protein: 3, calories: 150, carbs: 30 } },

    { name: 'Tandoori Roti', price: 40, cuisine: 'indian', type: 'appetizer', course: 'bread', protein: 'low', diet: ['vegetarian', 'vegan', 'low-calorie'], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1780907084884-ded9fddbb474?w=400&h=300&fit=crop', description: 'Whole wheat flatbread roasted fresh on the tandoor', nutrition: { protein: 6, calories: 120, carbs: 24 } },
    { name: 'Butter Naan', price: 70, cuisine: 'indian', type: 'appetizer', course: 'bread', protein: 'low', diet: ['vegetarian', 'high-calorie'], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1756821752957-00bfcadc3748?w=400&h=300&fit=crop', description: 'Soft leavened flatbread brushed with butter', nutrition: { protein: 7, calories: 260, carbs: 40 } },
    { name: 'Garden Salad', price: 150, cuisine: 'indian', type: 'appetizer', course: 'salad', protein: 'low', diet: ['vegetarian', 'vegan', 'gluten-free', 'low-calorie'], time: ['lunch', 'dinner'], image: 'https://images.unsplash.com/photo-1757596057470-19d36962705d?w=400&h=300&fit=crop', description: 'Crisp shredded cabbage and carrot tossed with herbs', nutrition: { protein: 2, calories: 60, carbs: 10 } },
  ];

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
                                dishKeyword !== null;

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

    return { budget, mealTime, diet, calorieLevel, cuisine, excludeFried, protein, lowCarb, wantsNonVeg, wantsFullMeal, dishKeyword };
  };

  // A short, natural acknowledgment of what was asked, sent as its own chat
  // bubble BEFORE the suggestion cards - so a request like "I'm hungry and
  // on a diet" lands as a two-turn conversation ("got it, here's what I'd
  // suggest") instead of jumping straight from the user's message to a card
  // dump with no reply in between.
  const buildConversationalReply = (criteria, { isMeal = false } = {}) => {
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
    // even if a criteria matcher weren't set.
    if (criteria.dishKeyword) {
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

  // Beauty catalog, mirroring the backend's MAKEUP_DATA - kept client-side so
  // budget-only suggestions can combine food + makeup instantly, same as
  // how food suggestions already work without a backend round trip.
  const makeupMenu = [
    { name: 'Velvet Matte Lipstick', price: 899, category: 'lipstick', description: 'Long-lasting matte finish in classic red', image: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=400&h=300&fit=crop' },
    { name: 'Glossy Tint Lip Balm', price: 499, category: 'lipstick', description: 'Sheer, hydrating tint with a glossy finish', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&h=300&fit=crop' },
    { name: 'Silk Finish Foundation', price: 1299, category: 'foundation', description: 'Lightweight, buildable coverage for all-day wear', image: 'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=400&h=300&fit=crop' },
    { name: 'BB Cream SPF 30', price: 799, category: 'foundation', description: 'Sheer coverage with sun protection', image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&h=300&fit=crop' },
    { name: 'Hydrating Serum', price: 1499, category: 'skincare', description: 'Hyaluronic acid serum for deep hydration', image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&h=300&fit=crop' },
    { name: 'Vitamin C Face Cream', price: 1099, category: 'skincare', description: 'Brightening daily moisturizer', image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&h=300&fit=crop' },
    { name: 'Floral Eau de Parfum', price: 2499, category: 'fragrance', description: 'A delicate floral scent with hints of jasmine', image: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&h=300&fit=crop' },
    { name: 'Citrus Body Mist', price: 699, category: 'fragrance', description: 'Light, refreshing citrus fragrance', image: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=400&h=300&fit=crop' },
  ];

  const suggestMakeup = (criteria) => {
    if (!criteria.budget) return [];
    return makeupMenu.filter(item => item.price <= criteria.budget);
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
        }}>
          <img
            src={item.image}
            alt={item.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', flexShrink: 0, minWidth: '100%', maxWidth: 'none' }}
          />
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

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input;
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
              kind: 'makeup',
              name: matchedItem.name,
              image: matchedItem.image,
              description: matchedItem.description,
              category: matchedItem.category || 'beauty',
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
    if (suggestionCriteria?.dishKeyword && !suggestionCriteria.wantsFullMeal && lastMeal && lastMeal.length > 0) {
      const candidates = foodMenu.filter(FOOD_KEYWORDS[suggestionCriteria.dishKeyword]).slice(0, 4);
      if (candidates.length > 0) {
        setMessages(prev => [...prev, {
          role: 'bot',
          content: 'meal_addition_prompt',
          candidates,
          keyword: suggestionCriteria.dishKeyword
        }]);
        return;
      }
    }

    // Handle food (and, for budget-only asks with no food-specific
    // qualifier, makeup) suggestions
    if (suggestionCriteria) {
      const isBudgetOnly = suggestionCriteria.budget && !suggestionCriteria.mealTime && !suggestionCriteria.diet && !suggestionCriteria.cuisine;

      // Don't proactively surface makeup for a customer who never said
      // they're interested in beauty (e.g. "Budget Friendly" for a
      // food+travel customer shouldn't come back with a lipstick). Unknown
      // interests (guest, no sign-up) keeps the old behavior of showing both.
      const knowsInterests = initialInterests && initialInterests.length > 0;
      const wantsBeautySuggestions = !knowsInterests || initialInterests.includes('beauty');

      const foodResults = suggestDishes(suggestionCriteria).map(item => ({ ...item, kind: 'food' }));
      const makeupResults = (isBudgetOnly && wantsBeautySuggestions)
        ? suggestMakeup(suggestionCriteria).map(item => ({ ...item, kind: 'makeup' }))
        : [];
      const suggestions = [...foodResults, ...makeupResults];

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
        .filter(m => typeof m.content === 'string' && m.content !== 'suggestions' && m.content !== 'makeup_suggestions' && m.content !== 'meal_suggestions')
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

                {msg.role === 'bot' && msg.content !== 'suggestions' && msg.content !== 'makeup_suggestions' && msg.content !== 'meal_suggestions' &&
                  msg.content !== 'meal_addition_prompt' && msg.content !== 'meal_replace_prompt' && (
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
                      {msg.intro || `🎯 ${msg.suggestions.some(s => s.kind === 'makeup') ? 'Suggested Picks:' : 'Suggested Dishes:'}`}
                    </h4>
                    {msg.suggestions.map((item, idx) =>
                      item.kind === 'makeup'
                        ? renderMakeupCard(item, idx, `₹${item.price}`)
                        : renderFoodCard(item, idx)
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

          {/* Quick Actions - capped at 3 (that's all the row has room for),
              built by round-robin picking one pill per matched interest at a
              time so every interest the customer actually has gets fair
              representation, instead of just truncating a longer list and
              silently dropping some interests entirely. Unknown interests
              (guest, "Continue as Guest") default to food+beauty, same mix
              as before interests existed. */}
          <div className="quick-actions">
            {(() => {
              const BUDGET_PILL = { key: 'budget', icon: '💰', label: 'Budget Friendly', input: 'Budget friendly under Rs500' };
              const PILLS_BY_INTEREST = {
                food: [
                  { key: 'dinner', icon: '🍽️', label: 'Dinner', input: 'Dinner suggestions' },
                  { key: 'healthy', icon: '🥗', label: 'Healthy Picks', input: 'Healthy low calorie options' },
                ],
                beauty: [
                  { key: 'lipstick', icon: '💄', label: 'Lipstick', input: 'Show lipstick options' },
                  { key: 'skincare', icon: '✨', label: 'Skincare', input: 'Show skincare options' },
                ],
              };
              const knowsInterests = initialInterests && initialInterests.length > 0;
              const matchedCategories = knowsInterests
                ? initialInterests.filter(i => PILLS_BY_INTEREST[i])
                : ['food', 'beauty'];

              const pills = [BUDGET_PILL];
              for (let round = 0; pills.length < 3; round++) {
                const beforeCount = pills.length;
                for (const category of matchedCategories) {
                  if (pills.length >= 3) break;
                  const pill = PILLS_BY_INTEREST[category][round];
                  if (pill) pills.push(pill);
                }
                if (pills.length === beforeCount) break; // no category had anything left this round
              }

              return pills.map(pill => (
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
