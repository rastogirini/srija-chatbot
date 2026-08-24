import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import FloatingChatbot from '../../components/FloatingChatbot';
import ProductDetail from '../../components/ProductDetail';
import CartPage from '../../components/CartPage';
import QtyStepper from '../../components/QtyStepper';

// Classic Indian menu veg/non-veg mark: a green or red square with a filled
// dot inside, same convention used in the chatbot and the product detail page.
const VegIndicator = ({ isVeg, size = 16 }) => (
  <span
    title={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: `${size}px`,
      height: `${size}px`,
      border: `2px solid ${isVeg ? '#0ca678' : '#c92a2a'}`,
      borderRadius: '3px',
      flexShrink: 0,
    }}
  >
    <span style={{
      width: `${Math.round(size * 0.45)}px`,
      height: `${Math.round(size * 0.45)}px`,
      borderRadius: '50%',
      background: isVeg ? '#0ca678' : '#c92a2a',
    }} />
  </span>
);

const Chat = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showShopDropdown, setShowShopDropdown] = useState(false);
  const [activeCuisine, setActiveCuisine] = useState('all');
  const [activeDiet, setActiveDiet] = useState('all');
  const [activeProtein, setActiveProtein] = useState('all');
  const [activeMakeupCategory, setActiveMakeupCategory] = useState('all');
  const [viewingProduct, setViewingProduct] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  // Persisted to localStorage below so a page refresh doesn't silently wipe
  // the cart - it previously only lived in this component's in-memory state.
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('srigen_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showCartPage, setShowCartPage] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderConfirmation, setOrderConfirmation] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const selectedPersona = location.state?.persona;

  useEffect(() => {
    try {
      localStorage.setItem('srigen_cart', JSON.stringify(cart));
    } catch {
      // Storage full/unavailable (private browsing, quota) - cart just
      // won't survive a refresh this time, same as before this change.
    }
  }, [cart]);

  // Shared cart - items added from the chatbot's "Add to cart" or the main
  // site's product cards both land here, matched by kind+name.
  const addToCart = (item) => {
    if (!item) return;
    setCart(prev => {
      const existing = prev.find(c => c.name === item.name && c.kind === item.kind);
      if (existing) {
        return prev.map(c => c === existing ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeFromCart = (name, kind) => {
    setCart(prev => prev.filter(c => !(c.name === name && c.kind === kind)));
  };

  // "-" button: decrements, or removes the line entirely once it would hit 0.
  const decreaseQty = (name, kind) => {
    setCart(prev => prev.flatMap(c => {
      if (c.name === name && c.kind === kind) {
        return c.qty > 1 ? [{ ...c, qty: c.qty - 1 }] : [];
      }
      return [c];
    }));
  };

  const getCartQty = (name, kind) => cart.find(c => c.name === name && c.kind === kind)?.qty || 0;

  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0);
  const cartTotal = cart.reduce((sum, c) => sum + (parseInt(String(c.price).replace(/[^\d]/g, ''), 10) || 0) * c.qty, 0);

  // Checks out the cart against the backend, which persists it as a real
  // order row - closing the gap where the cart previously had no endpoint
  // at all and items just sat in memory forever.
  const placeOrder = async () => {
    if (cart.length === 0 || placingOrder) return;
    setPlacingOrder(true);
    try {
      const response = await fetch('http://localhost:5000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          total: cartTotal,
          customer_name: selectedPersona,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setOrderConfirmation({ id: data.order.id, total: data.order.total });
        setCart([]);
      } else {
        setOrderConfirmation({ error: true });
      }
    } catch (error) {
      setOrderConfirmation({ error: true });
    } finally {
      setPlacingOrder(false);
    }
  };

  // nutrition values are approximate, per 100g - illustrative, not lab-tested
  const foodMenu = [
    // ITALIAN
    {
      id: 1,
      name: 'Grilled Salmon',
      price: '₹650',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop',
      description: 'Fresh Atlantic salmon with lemon butter sauce',
      category: 'MAIN COURSE',
      cuisine: 'italian',
      protein: 'high',
      nutrition: { protein: 20, calories: 180, carbs: 1 },
      diet: ['gluten-free', 'low-calorie']
    },
    {
      id: 2,
      name: 'Pasta Carbonara',
      price: '₹550',
      image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=300&fit=crop',
      description: 'Creamy Italian pasta with pancetta and parmesan',
      category: 'MAIN COURSE',
      cuisine: 'italian',
      protein: 'high',
      nutrition: { protein: 10, calories: 250, carbs: 28 },
      diet: []
    },
    {
      id: 3,
      name: 'Bruschetta',
      price: '₹300',
      image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop',
      description: 'Toasted bread with tomatoes, garlic and basil',
      category: 'APPETIZER',
      cuisine: 'italian',
      protein: 'low',
      nutrition: { protein: 6, calories: 150, carbs: 22 },
      diet: ['vegan']
    },
    {
      id: 4,
      name: 'Tiramisu',
      price: '₹250',
      image: 'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=400&h=300&fit=crop',
      description: 'Classic Italian dessert with mascarpone',
      category: 'DESSERT',
      cuisine: 'italian',
      protein: 'low',
      nutrition: { protein: 5, calories: 280, carbs: 30 },
      diet: ['vegetarian']
    },
    {
      id: 5,
      name: 'Ribeye Steak',
      price: '₹750',
      image: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400&h=300&fit=crop',
      description: 'Prime cut aged 28 days with garlic butter',
      category: 'MAIN COURSE',
      cuisine: 'italian',
      protein: 'high',
      nutrition: { protein: 25, calories: 220, carbs: 0 },
      diet: ['gluten-free', 'low-calorie']
    },
    {
      id: 6,
      name: 'Chocolate Cake',
      price: '₹280',
      image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop',
      description: 'Rich dark chocolate cake with ganache',
      category: 'DESSERT',
      cuisine: 'italian',
      protein: 'low',
      nutrition: { protein: 5, calories: 370, carbs: 50 },
      diet: ['vegetarian']
    },

    // INDIAN
    {
      id: 7,
      name: 'Butter Chicken',
      price: '₹550',
      image: 'https://images.unsplash.com/photo-1742599361498-79824d24e355?w=400&h=300&fit=crop',
      description: 'Tender chicken in creamy tomato sauce with spices',
      category: 'MAIN COURSE',
      cuisine: 'indian',
      protein: 'high',
      nutrition: { protein: 16, calories: 230, carbs: 7 },
      diet: ['gluten-free']
    },
    {
      id: 8,
      name: 'Paneer Tikka',
      price: '₹400',
      image: 'https://images.unsplash.com/photo-1755090154677-87e7aa5487ff?w=400&h=300&fit=crop',
      description: 'Grilled cottage cheese with yogurt and spices',
      category: 'APPETIZER',
      cuisine: 'indian',
      protein: 'high',
      nutrition: { protein: 18, calories: 220, carbs: 6 },
      diet: ['vegetarian', 'gluten-free', 'low-calorie']
    },
    {
      id: 9,
      name: 'Biryani',
      price: '₹500',
      image: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400&h=300&fit=crop',
      description: 'Fragrant rice with meat and aromatic spices',
      category: 'MAIN COURSE',
      cuisine: 'indian',
      protein: 'low',
      nutrition: { protein: 9, calories: 200, carbs: 28 },
      diet: []
    },
    {
      id: 10,
      name: 'Samosa',
      price: '₹75',
      image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop',
      description: 'Crispy pastry with spiced potato filling',
      category: 'APPETIZER',
      cuisine: 'indian',
      protein: 'low',
      nutrition: { protein: 4, calories: 260, carbs: 30 },
      fried: true,
      diet: ['vegan']
    },
    {
      id: 11,
      name: 'Chana Masala',
      price: '₹380',
      image: 'https://images.unsplash.com/photo-1716535232842-d10da4eb33d5?w=400&h=300&fit=crop',
      description: 'Chickpeas in aromatic tomato curry',
      category: 'MAIN COURSE',
      cuisine: 'indian',
      protein: 'low',
      nutrition: { protein: 7, calories: 140, carbs: 18 },
      diet: ['vegetarian', 'vegan', 'gluten-free', 'low-calorie']
    },
    {
      id: 12,
      name: 'Gulab Jamun',
      price: '₹220',
      image: 'https://images.unsplash.com/photo-1595608010652-d8bf1103a1c5?w=400&h=300&fit=crop',
      description: 'Sweet dumplings in rose syrup',
      category: 'DESSERT',
      cuisine: 'indian',
      protein: 'low',
      nutrition: { protein: 4, calories: 320, carbs: 45 },
      fried: true,
      diet: ['vegetarian']
    },

    // CHINESE
    {
      id: 13,
      name: 'General Tso Chicken',
      price: '₹500',
      image: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400&h=300&fit=crop',
      description: 'Crispy chicken in spicy tangy sauce',
      category: 'MAIN COURSE',
      cuisine: 'chinese',
      protein: 'high',
      nutrition: { protein: 14, calories: 280, carbs: 20 },
      fried: true,
      diet: ['gluten-free', 'low-calorie']
    },
    {
      id: 14,
      name: 'Kung Pao Tofu',
      price: '₹420',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop',
      description: 'Tofu with peanuts in savory sauce',
      category: 'MAIN COURSE',
      cuisine: 'chinese',
      protein: 'high',
      nutrition: { protein: 10, calories: 180, carbs: 10 },
      diet: ['vegetarian', 'vegan', 'low-calorie']
    },
    {
      id: 15,
      name: 'Spring Rolls',
      price: '₹280',
      image: 'https://images.unsplash.com/photo-1695712641569-05eee7b37b6d?w=400&h=300&fit=crop',
      description: 'Crispy rolls with vegetables and meat',
      category: 'APPETIZER',
      cuisine: 'chinese',
      protein: 'low',
      nutrition: { protein: 5, calories: 230, carbs: 25 },
      fried: true,
      diet: []
    },
    {
      id: 16,
      name: 'Vegetable Fried Rice',
      price: '₹350',
      image: 'https://images.unsplash.com/photo-1751618646882-4221d5e3b1c2?w=400&h=300&fit=crop',
      description: 'Rice stir-fried with fresh vegetables',
      category: 'MAIN COURSE',
      cuisine: 'chinese',
      protein: 'low',
      nutrition: { protein: 4, calories: 170, carbs: 28 },
      fried: true,
      diet: ['vegetarian', 'vegan', 'gluten-free']
    },
    {
      id: 17,
      name: 'Mapo Tofu',
      price: '₹400',
      image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=400&h=300&fit=crop',
      description: 'Soft tofu in spicy sauce with minced meat',
      category: 'MAIN COURSE',
      cuisine: 'chinese',
      protein: 'low',
      nutrition: { protein: 9, calories: 150, carbs: 6 },
      diet: ['gluten-free']
    },
    {
      id: 18,
      name: 'Mango Pudding',
      price: '₹240',
      image: 'https://images.unsplash.com/photo-1617075355766-3b6c68938165?w=400&h=300&fit=crop',
      description: 'Smooth mango dessert with coconut milk',
      category: 'DESSERT',
      cuisine: 'chinese',
      protein: 'low',
      nutrition: { protein: 3, calories: 150, carbs: 28 },
      diet: ['vegetarian', 'low-calorie']
    },

    // INDIAN VEGETARIAN — HIGH/LOW PROTEIN & CALORIE PICKS
    {
      id: 19,
      name: 'Paneer Butter Masala',
      price: '₹480',
      image: 'https://images.unsplash.com/photo-1567529854338-fc097b962123?w=400&h=300&fit=crop',
      description: 'Paneer cubes in a rich, creamy tomato gravy',
      category: 'MAIN COURSE',
      cuisine: 'indian',
      protein: 'high',
      nutrition: { protein: 15, calories: 250, carbs: 9 },
      diet: ['vegetarian', 'gluten-free', 'high-calorie']
    },
    {
      id: 20,
      name: 'Rajma Chawal',
      price: '₹420',
      image: 'https://images.unsplash.com/photo-1668236534990-73c4ed23043c?w=400&h=300&fit=crop',
      description: 'Kidney bean curry served over steamed rice',
      category: 'MAIN COURSE',
      cuisine: 'indian',
      protein: 'high',
      nutrition: { protein: 11, calories: 210, carbs: 24 },
      diet: ['vegetarian', 'gluten-free', 'high-calorie']
    },
    {
      id: 21,
      name: 'Masoor Dal',
      price: '₹280',
      image: 'https://plus.unsplash.com/premium_photo-1699293238624-819cfcfa1de3?w=400&h=300&fit=crop',
      description: 'Red lentils simmered with mild aromatic spices',
      category: 'MAIN COURSE',
      cuisine: 'indian',
      protein: 'high',
      nutrition: { protein: 10, calories: 110, carbs: 16 },
      diet: ['vegetarian', 'vegan', 'gluten-free', 'low-calorie']
    },
    {
      id: 22,
      name: 'Moong Sprouts Chaat',
      price: '₹180',
      image: 'https://images.unsplash.com/photo-1622732777601-e744c3401d44?w=400&h=300&fit=crop',
      description: 'Sprouted moong beans tossed with lemon and spices',
      category: 'APPETIZER',
      cuisine: 'indian',
      protein: 'high',
      nutrition: { protein: 10, calories: 90, carbs: 12 },
      diet: ['vegetarian', 'vegan', 'gluten-free', 'low-calorie']
    },
    {
      id: 23,
      name: 'Aloo Paratha',
      price: '₹220',
      image: 'https://images.unsplash.com/photo-1708782343717-be4ea260249a?w=400&h=300&fit=crop',
      description: 'Whole wheat flatbread stuffed with spiced potato',
      category: 'MAIN COURSE',
      cuisine: 'indian',
      protein: 'low',
      nutrition: { protein: 5, calories: 270, carbs: 35 },
      fried: true,
      diet: ['vegetarian', 'high-calorie']
    },
    {
      id: 24,
      name: 'Aloo Tikki',
      price: '₹200',
      image: 'https://images.unsplash.com/photo-1755090155112-16fe70d49ca3?w=400&h=300&fit=crop',
      description: 'Crispy pan-fried potato patties with green chutney',
      category: 'APPETIZER',
      cuisine: 'indian',
      protein: 'low',
      nutrition: { protein: 4, calories: 220, carbs: 28 },
      fried: true,
      diet: ['vegetarian', 'gluten-free', 'high-calorie']
    },
    {
      id: 25,
      name: 'Jeera Rice',
      price: '₹180',
      image: 'https://indianspice.ca/wp-content/uploads/2022/12/Indian_Spice_Jeera_Rice.jpg',
      description: 'Basmati rice tempered with roasted cumin seeds',
      category: 'MAIN COURSE',
      cuisine: 'indian',
      protein: 'low',
      nutrition: { protein: 3, calories: 150, carbs: 30 },
      diet: ['vegetarian', 'vegan', 'gluten-free', 'low-calorie']
    },
    {
      id: 26,
      name: 'Tandoori Roti',
      price: '₹40',
      image: 'https://images.unsplash.com/photo-1780907084884-ded9fddbb474?w=400&h=300&fit=crop',
      description: 'Whole wheat flatbread roasted fresh on the tandoor',
      category: 'APPETIZER',
      cuisine: 'indian',
      protein: 'low',
      nutrition: { protein: 6, calories: 120, carbs: 24 },
      diet: ['vegetarian', 'vegan', 'low-calorie']
    },
    {
      id: 27,
      name: 'Butter Naan',
      price: '₹70',
      image: 'https://images.unsplash.com/photo-1756821752957-00bfcadc3748?w=400&h=300&fit=crop',
      description: 'Soft leavened flatbread brushed with butter',
      category: 'APPETIZER',
      cuisine: 'indian',
      protein: 'low',
      nutrition: { protein: 7, calories: 260, carbs: 40 },
      diet: ['vegetarian', 'high-calorie']
    },
    {
      id: 28,
      name: 'Garden Salad',
      price: '₹150',
      image: 'https://images.unsplash.com/photo-1757596057470-19d36962705d?w=400&h=300&fit=crop',
      description: 'Crisp shredded cabbage and carrot tossed with herbs',
      category: 'APPETIZER',
      cuisine: 'indian',
      protein: 'low',
      nutrition: { protein: 2, calories: 60, carbs: 10 },
      diet: ['vegetarian', 'vegan', 'gluten-free', 'low-calorie']
    }
  ];

  const makeupItems = [
    // LIPSTICK
    {
      id: 101,
      name: 'Velvet Matte Lipstick',
      price: '₹899',
      image: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=400&h=300&fit=crop',
      description: 'Long-lasting matte finish in classic red',
      category: 'LIPSTICK'
    },
    {
      id: 102,
      name: 'Glossy Tint Lip Balm',
      price: '₹499',
      image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&h=300&fit=crop',
      description: 'Sheer, hydrating tint with a glossy finish',
      category: 'LIPSTICK'
    },

    // FOUNDATION
    {
      id: 103,
      name: 'Silk Finish Foundation',
      price: '₹1299',
      image: 'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=400&h=300&fit=crop',
      description: 'Lightweight, buildable coverage for all-day wear',
      category: 'FOUNDATION'
    },
    {
      id: 104,
      name: 'BB Cream SPF 30',
      price: '₹799',
      image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&h=300&fit=crop',
      description: 'Sheer coverage with sun protection',
      category: 'FOUNDATION'
    },

    // SKINCARE
    {
      id: 105,
      name: 'Hydrating Serum',
      price: '₹1499',
      image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&h=300&fit=crop',
      description: 'Hyaluronic acid serum for deep hydration',
      category: 'SKINCARE'
    },
    {
      id: 106,
      name: 'Vitamin C Face Cream',
      price: '₹1099',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&h=300&fit=crop',
      description: 'Brightening daily moisturizer',
      category: 'SKINCARE'
    },

    // FRAGRANCE
    {
      id: 107,
      name: 'Floral Eau de Parfum',
      price: '₹2499',
      image: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&h=300&fit=crop',
      description: 'A delicate floral scent with hints of jasmine',
      category: 'FRAGRANCE'
    },
    {
      id: 108,
      name: 'Citrus Body Mist',
      price: '₹699',
      image: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=400&h=300&fit=crop',
      description: 'Light, refreshing citrus fragrance',
      category: 'FRAGRANCE'
    }
  ];

  const cuisines = [
    { id: 'all', label: 'All Cuisines', icon: '🍽️' },
    { id: 'italian', label: 'Italian', icon: '🇮🇹' },
    { id: 'indian', label: 'Indian', icon: '🇮🇳' },
    { id: 'chinese', label: 'Chinese', icon: '🇨🇳' }
  ];

  const diets = [
    { id: 'all', label: 'All Diets', icon: '✨' },
    { id: 'vegetarian', label: 'Vegetarian', icon: '🥬' },
    { id: 'vegan', label: 'Vegan', icon: '🌱' },
    { id: 'gluten-free', label: 'Gluten-Free', icon: '🌾' },
    { id: 'low-calorie', label: 'Low-Calorie', icon: '🔥' },
    { id: 'high-calorie', label: 'High-Calorie', icon: '🍔' }
  ];

  const proteins = [
    { id: 'all', label: 'Any Protein', icon: '✨' },
    { id: 'high', label: 'High Protein', icon: '💪' },
    { id: 'low', label: 'Low Protein', icon: '🌾' }
  ];

  const filteredMenu = foodMenu.filter(dish => {
    const cuisineMatch = activeCuisine === 'all' || dish.cuisine === activeCuisine;
    const dietMatch = activeDiet === 'all' || dish.diet.includes(activeDiet);
    const proteinMatch = activeProtein === 'all' || dish.protein === activeProtein;
    return cuisineMatch && dietMatch && proteinMatch;
  });

  const makeupCategories = [
    { id: 'all', label: 'All Products', icon: '💄' },
    { id: 'LIPSTICK', label: 'Lipstick', icon: '💋' },
    { id: 'FOUNDATION', label: 'Foundation', icon: '🧴' },
    { id: 'SKINCARE', label: 'Skincare', icon: '🧖' },
    { id: 'FRAGRANCE', label: 'Fragrance', icon: '🌸' }
  ];

  const filteredMakeup = makeupItems.filter(item => {
    return activeMakeupCategory === 'all' || item.category === activeMakeupCategory;
  });

  const handleExplore = () => {
    const chatInput = document.querySelector('input[placeholder="Type your message..."]');
    if (chatInput) {
      chatInput.value = 'Show me the menu';
      chatInput.focus();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    navigate(-1);
  };

  const scrollToSection = (sectionId) => {
    setShowShopDropdown(false);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5f5',
      paddingRight: chatOpen ? '420px' : '0',
      transition: 'padding-right 0.3s ease',
      boxSizing: 'border-box',
      overflowX: 'hidden',
    }}>
      {/* Top Navigation Bar */}
      <nav style={{
        background: 'white',
        padding: '15px 40px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ justifySelf: 'start' }}>
          <img src="/images/logo/srigen-logo-2.svg" alt="Srigen.ai" style={{ height: '48px' }} />
        </div>

        <div style={{ display: 'flex', gap: '30px', alignItems: 'center', justifySelf: 'center' }}>
          <a href="#" style={{ textDecoration: 'none', color: '#333', fontWeight: '500' }}>Home</a>

          {/* Shop Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowShopDropdown(!showShopDropdown)}
              style={{
                background: 'none',
                border: 'none',
                color: '#333',
                fontWeight: '500',
                fontSize: '16px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                padding: 0
              }}
            >
              Shop ▾
            </button>

            {showShopDropdown && (
              <div style={{
                position: 'absolute',
                top: '30px',
                left: 0,
                background: 'white',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                minWidth: '160px',
                zIndex: 200,
                overflow: 'hidden'
              }}>
                <button
                  onClick={() => scrollToSection('food-section')}
                  style={{
                    width: '100%',
                    padding: '12px 20px',
                    textAlign: 'left',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: '#333',
                    fontWeight: '500',
                    fontSize: '14px'
                  }}
                  onMouseEnter={(e) => { e.target.style.background = '#f5f5f5'; }}
                  onMouseLeave={(e) => { e.target.style.background = 'none'; }}
                >
                  🍽️ Food
                </button>
                <button
                  onClick={() => scrollToSection('makeup-section')}
                  style={{
                    width: '100%',
                    padding: '12px 20px',
                    textAlign: 'left',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: '#333',
                    fontWeight: '500',
                    fontSize: '14px'
                  }}
                  onMouseEnter={(e) => { e.target.style.background = '#f5f5f5'; }}
                  onMouseLeave={(e) => { e.target.style.background = 'none'; }}
                >
                  💄 Makeup
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Cart + Account */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifySelf: 'end' }}>
          {/* Cart */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setViewingProduct(null); setOrderConfirmation(null); setShowCartPage(true); }}
              title="Cart"
              style={{
                position: 'relative',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '22px',
                padding: '4px',
                lineHeight: 1,
              }}
            >
              🛒
              {cartCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-6px',
                  background: '#d6336c',
                  color: 'white',
                  fontSize: '11px',
                  fontWeight: '700',
                  borderRadius: '999px',
                  minWidth: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                }}>
                  {cartCount}
                </span>
              )}
            </button>
          </div>

          {/* Account Dropdown */}
          <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
          >
            👤 Account ▼
          </button>

          {showDropdown && (
            <div style={{
              position: 'absolute',
              top: '45px',
              right: 0,
              background: 'white',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              minWidth: '200px',
              zIndex: 200
            }}>
              <div style={{
                padding: '12px 20px',
                borderBottom: '1px solid #e0e0e0',
                color: '#666',
                fontSize: '12px'
              }}>
                👤 {selectedPersona || 'Guest'}
              </div>

              <button
                onClick={() => {
                  setShowDropdown(false);
                  handleLogout();
                }}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  textAlign: 'left',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: '#d32f2f',
                  fontWeight: '500',
                  fontSize: '14px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#ffebee';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'none';
                }}
              >
                🚪 Logout
              </button>
            </div>
          )}
          </div>
        </div>
      </nav>

      {viewingProduct ? (
        <ProductDetail
          product={viewingProduct}
          onBack={() => setViewingProduct(null)}
          onAddToCart={addToCart}
          onDecreaseQty={decreaseQty}
          qtyInCart={getCartQty(viewingProduct.name, viewingProduct.kind)}
        />
      ) : showCartPage ? (
        <CartPage
          cart={cart}
          cartTotal={cartTotal}
          onBack={() => { setShowCartPage(false); setOrderConfirmation(null); }}
          onAddToCart={addToCart}
          onDecreaseQty={decreaseQty}
          onRemoveFromCart={removeFromCart}
          onPlaceOrder={placeOrder}
          placingOrder={placingOrder}
          orderConfirmation={orderConfirmation}
          onDismissConfirmation={() => setOrderConfirmation(null)}
        />
      ) : (
      <>
      {/* Hero Banner - editorial split layout, category-agnostic so it
          doesn't need rework as more personas (clothing, travel, ...) are added */}
      <div style={{
        minHeight: '560px',
        background: 'linear-gradient(135deg, #f5f0ff 0%, #fdf1f7 50%, #fff6f0 100%)',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: '0 40px'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '1.1fr 0.9fr',
          gap: '40px',
          alignItems: 'center'
        }}>
          {/* Left: editorial headline */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px'
            }}>
              <span style={{ width: '28px', height: '2px', background: '#d6336c' }}></span>
              <span style={{
                fontSize: '13px',
                fontWeight: '700',
                letterSpacing: '1.5px',
                color: '#d6336c',
                textTransform: 'uppercase'
              }}>
                One Place, Every Interest
              </span>
            </div>

            <h1 style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: '76px',
              lineHeight: '1.05',
              letterSpacing: '-1.5px',
              margin: '0 0 28px 0',
              color: '#1a1a2e'
            }}>
              Made For You.
              <br />
              <span style={{
                fontStyle: 'italic',
                fontWeight: '600',
                background: 'linear-gradient(90deg, #4361ee 0%, #7209b7 50%, #d6336c 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                Every Time You Visit.
              </span>
            </h1>

            <p style={{ fontSize: '19px', color: '#555', lineHeight: '1.7', maxWidth: '480px', marginBottom: '16px' }}>
              From your first favorite to your next one — all curated, all yours.
            </p>

            <button
              onClick={handleExplore}
              style={{
                padding: '16px 40px',
                fontSize: '18px',
                fontWeight: '600',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '30px',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
              }}
            >
              ✨ Explore Picks Made For You
            </button>
          </div>

          {/* Right: colorful flower visual - the variety of color represents
              the variety of categories/interests this experience is built around */}
          <div style={{
            position: 'relative',
            height: '420px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              position: 'absolute',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,182,193,0.35) 0%, rgba(173,216,230,0.2) 50%, rgba(255,255,255,0) 75%)',
              filter: 'blur(8px)'
            }}></div>
            <div style={{
              position: 'relative',
              width: '360px',
              height: '360px',
              borderRadius: '24px',
              overflow: 'hidden',
              background: 'white',
              boxShadow: '0 25px 50px rgba(114, 9, 183, 0.2), 0 8px 20px rgba(0,0,0,0.08)',
              transform: 'rotate(-3deg)'
            }}>
              <img
                src="https://images.unsplash.com/photo-1464820453369-31d2c0b651af?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb&w=500"
                alt="A colorful, multi-hued flower representing every interest you have"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div style={{ padding: '60px 40px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Menu Section */}
        <div id="food-section" style={{ marginBottom: '60px' }}>
          <h3 style={{ fontSize: '32px', margin: '0 0 30px 0', color: '#333' }}>
            Food & Dining
          </h3>

          {/* Cuisine Filter */}
          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#666', fontSize: '14px' }}>
              FILTER BY CUISINE
            </h4>
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              {cuisines.map(cuisine => (
                <button
                  key={cuisine.id}
                  onClick={() => setActiveCuisine(cuisine.id)}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '25px',
                    border: activeCuisine === cuisine.id ? 'none' : '2px solid #ddd',
                    background: activeCuisine === cuisine.id 
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : 'white',
                    color: activeCuisine === cuisine.id ? 'white' : '#333',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={(e) => {
                    if (activeCuisine !== cuisine.id) {
                      e.target.style.borderColor = '#667eea';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeCuisine !== cuisine.id) {
                      e.target.style.borderColor = '#ddd';
                    }
                  }}
                >
                  {cuisine.icon} {cuisine.label}
                </button>
              ))}
            </div>
          </div>

          {/* Diet Filter */}
          <div style={{ marginBottom: '40px' }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#666', fontSize: '14px' }}>
              FILTER BY DIET
            </h4>
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              {diets.map(diet => (
                <button
                  key={diet.id}
                  onClick={() => setActiveDiet(diet.id)}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '25px',
                    border: activeDiet === diet.id ? 'none' : '2px solid #ddd',
                    background: activeDiet === diet.id 
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : 'white',
                    color: activeDiet === diet.id ? 'white' : '#333',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={(e) => {
                    if (activeDiet !== diet.id) {
                      e.target.style.borderColor = '#667eea';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeDiet !== diet.id) {
                      e.target.style.borderColor = '#ddd';
                    }
                  }}
                >
                  {diet.icon} {diet.label}
                </button>
              ))}
            </div>
          </div>

          {/* Protein Filter */}
          <div style={{ marginBottom: '40px' }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#666', fontSize: '14px' }}>
              FILTER BY PROTEIN
            </h4>
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              {proteins.map(protein => (
                <button
                  key={protein.id}
                  onClick={() => setActiveProtein(protein.id)}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '25px',
                    border: activeProtein === protein.id ? 'none' : '2px solid #ddd',
                    background: activeProtein === protein.id
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : 'white',
                    color: activeProtein === protein.id ? 'white' : '#333',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={(e) => {
                    if (activeProtein !== protein.id) {
                      e.target.style.borderColor = '#667eea';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeProtein !== protein.id) {
                      e.target.style.borderColor = '#ddd';
                    }
                  }}
                >
                  {protein.icon} {protein.label}
                </button>
              ))}
            </div>
          </div>

          {/* Food Menu Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '30px'
          }}>
            {filteredMenu.map((dish) => (
              <div key={dish.id}
              onClick={() => setViewingProduct({
                kind: 'food',
                name: dish.name,
                image: dish.image,
                description: dish.description,
                category: dish.category,
                cuisine: dish.cuisine,
                diet: dish.diet,
                nutrition: dish.nutrition,
                price: dish.price,
              })}
              style={{
                background: 'white',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';
              }}>
                {/* Image */}
                <div style={{
                  height: '250px',
                  backgroundImage: `url("${dish.image}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    background: '#d32f2f',
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>
                    {dish.category}
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: '20px' }}>
                  <h4 style={{
                    margin: '0 0 8px 0',
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#333',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <VegIndicator isVeg={dish.diet.includes('vegetarian') || dish.diet.includes('vegan')} />
                    <span>{dish.name}</span>
                  </h4>
                  <p style={{
                    margin: '0 0 12px 0',
                    fontSize: '14px',
                    color: '#666',
                    lineHeight: '1.5'
                  }}>
                    {dish.description}
                  </p>
                  {(dish.protein || dish.diet.includes('high-calorie') || dish.diet.includes('low-calorie')) && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '15px' }}>
                      {dish.protein && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          background: dish.protein === 'high' ? '#e6f7ee' : '#f3f0ff',
                          color: dish.protein === 'high' ? '#0ca678' : '#7048e8'
                        }}>
                          {dish.protein === 'high' ? '💪 High Protein' : '🌾 Low Protein'}
                        </span>
                      )}
                      {dish.diet.includes('high-calorie') && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          background: '#fff0e6',
                          color: '#e8590c'
                        }}>
                          🍔 High Calorie
                        </span>
                      )}
                      {dish.diet.includes('low-calorie') && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          background: '#fff5e6',
                          color: '#f08c00'
                        }}>
                          🔥 Low Calorie
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      color: '#667eea'
                    }}>
                      {dish.price}
                    </span>
                    {(() => {
                      const dishCartItem = {
                        kind: 'food',
                        name: dish.name,
                        image: dish.image,
                        description: dish.description,
                        category: dish.category,
                        cuisine: dish.cuisine,
                        diet: dish.diet,
                        nutrition: dish.nutrition,
                        price: dish.price,
                      };
                      const dishQty = getCartQty(dish.name, 'food');
                      if (dishQty > 0) {
                        return (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '120px', padding: '6px 10px', border: '1.5px solid #667eea', borderRadius: '6px' }}
                          >
                            <QtyStepper
                              qty={dishQty}
                              accent="#667eea"
                              variant="compact"
                              onIncrease={() => addToCart(dishCartItem)}
                              onDecrease={() => decreaseQty(dish.name, 'food')}
                            />
                          </div>
                        );
                      }
                      return (
                        <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(dishCartItem);
                        }}
                        style={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          border: 'none',
                          padding: '10px 20px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '12px',
                          transition: 'all 0.3s'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'scale(1)';
                        }}>
                          🛒 Add to Cart
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredMenu.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#999'
            }}>
              <p style={{ fontSize: '18px' }}>No dishes match your filters. Try different options!</p>
            </div>
          )}
        </div>

        {/* Beauty & Makeup Section */}
        <div id="makeup-section" style={{ marginBottom: '60px' }}>
          <h3 style={{ fontSize: '32px', margin: '0 0 30px 0', color: '#333' }}>
            Beauty & Makeup
          </h3>

          {/* Category Filter */}
          <div style={{ marginBottom: '40px' }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#666', fontSize: '14px' }}>
              FILTER BY CATEGORY
            </h4>
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              {makeupCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveMakeupCategory(cat.id)}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '25px',
                    border: activeMakeupCategory === cat.id ? 'none' : '2px solid #ddd',
                    background: activeMakeupCategory === cat.id
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : 'white',
                    color: activeMakeupCategory === cat.id ? 'white' : '#333',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={(e) => {
                    if (activeMakeupCategory !== cat.id) {
                      e.target.style.borderColor = '#667eea';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeMakeupCategory !== cat.id) {
                      e.target.style.borderColor = '#ddd';
                    }
                  }}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Makeup Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '30px'
          }}>
            {filteredMakeup.map((item) => (
              <div key={item.id}
              onClick={() => setViewingProduct({
                kind: 'makeup',
                name: item.name,
                image: item.image,
                description: item.description,
                category: item.category,
                price: item.price,
              })}
              style={{
                background: 'white',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';
              }}>
                {/* Image */}
                <div style={{
                  height: '250px',
                  backgroundImage: `url("${item.image}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    background: '#d32f2f',
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>
                    {item.category}
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: '20px' }}>
                  <h4 style={{
                    margin: '0 0 8px 0',
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    {item.name}
                  </h4>
                  <p style={{
                    margin: '0 0 15px 0',
                    fontSize: '14px',
                    color: '#666',
                    lineHeight: '1.5'
                  }}>
                    {item.description}
                  </p>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      color: '#667eea'
                    }}>
                      {item.price}
                    </span>
                    {(() => {
                      const itemCartItem = {
                        kind: 'makeup',
                        name: item.name,
                        image: item.image,
                        description: item.description,
                        category: item.category,
                        price: item.price,
                      };
                      const itemQty = getCartQty(item.name, 'makeup');
                      if (itemQty > 0) {
                        return (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '120px', padding: '6px 10px', border: '1.5px solid #d6336c', borderRadius: '6px' }}
                          >
                            <QtyStepper
                              qty={itemQty}
                              accent="#d6336c"
                              variant="compact"
                              onIncrease={() => addToCart(itemCartItem)}
                              onDecrease={() => decreaseQty(item.name, 'makeup')}
                            />
                          </div>
                        );
                      }
                      return (
                        <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(itemCartItem);
                        }}
                        style={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          border: 'none',
                          padding: '10px 20px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '12px',
                          transition: 'all 0.3s'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'scale(1)';
                        }}>
                          🛒 Add to Cart
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredMakeup.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#999'
            }}>
              <p style={{ fontSize: '18px' }}>No products match your filter. Try a different category!</p>
            </div>
          )}
        </div>

        {/* Features Section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '30px',
          marginTop: '50px'
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '10px',
            textAlign: 'center',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '15px' }}>🎯</div>
            <h3 style={{ margin: '0 0 10px 0' }}>Personalized Picks</h3>
            <p style={{ color: '#666', margin: 0 }}>
              Matched to your interests
            </p>
          </div>

          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '10px',
            textAlign: 'center',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '15px' }}>🌱</div>
            <h3 style={{ margin: '0 0 10px 0' }}>Always Growing</h3>
            <p style={{ color: '#666', margin: 0 }}>
              New categories added regularly
            </p>
          </div>

          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '10px',
            textAlign: 'center',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '15px' }}>⭐</div>
            <h3 style={{ margin: '0 0 10px 0' }}>Trusted Quality</h3>
            <p style={{ color: '#666', margin: 0 }}>
              Reliable picks, every time
            </p>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Floating Chatbot */}
      <FloatingChatbot
        initialPersona={selectedPersona}
        onViewProduct={setViewingProduct}
        onOpenChange={setChatOpen}
        cart={cart}
        onAddToCart={addToCart}
        onDecreaseQty={decreaseQty}
        onShowCart={() => { setViewingProduct(null); setOrderConfirmation(null); setShowCartPage(true); }}
      />
    </div>
  );
};

export default Chat;