import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import FloatingChatbot from '../../components/FloatingChatbot';
import ProductDetail from '../../components/ProductDetail';
import CartPage from '../../components/CartPage';
import QtyStepper from '../../components/QtyStepper';

// Display metadata for sign-up interests that don't have a real section
// built yet - used to label their "Coming Soon" placeholder.
const UNBUILT_INTEREST_META = {
  travel: { icon: '✈️', label: 'Travel' },
  fitness: { icon: '💪', label: 'Fitness' },
};

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
  const [activeToyCategory, setActiveToyCategory] = useState('all');
  // Shopkeeper-uploaded products (via the admin "Add Product" form) - merged
  // into the hardcoded catalogs below so a newly added item actually shows
  // up on this page, not just in the database.
  const [dbFoodItems, setDbFoodItems] = useState([]);
  const [dbBeautyItems, setDbBeautyItems] = useState([]);
  const [dbToysItems, setDbToysItems] = useState([]);
  const [viewingProduct, setViewingProduct] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [picksRequest, setPicksRequest] = useState(0);
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
  const selectedEmail = location.state?.email;
  const selectedInterests = location.state?.interests;

  // Unknown interests (guest, no sign-up) shows everything, same as before
  // interests existed. Known interests hide whatever category wasn't picked,
  // and any *other* picked interest with no real section yet (travel,
  // fitness) gets a "Coming Soon" placeholder instead of just vanishing.
  const knowsInterests = selectedInterests && selectedInterests.length > 0;
  const wantsFood = !knowsInterests || selectedInterests.includes('food');
  const wantsBeauty = !knowsInterests || selectedInterests.includes('beauty');
  const wantsToys = !knowsInterests || selectedInterests.includes('toys');
  const unbuiltInterests = knowsInterests ? selectedInterests.filter(i => i !== 'food' && i !== 'beauty' && i !== 'toys') : [];

  useEffect(() => {
    try {
      localStorage.setItem('srigen_cart', JSON.stringify(cart));
    } catch {
      // Storage full/unavailable (private browsing, quota) - cart just
      // won't survive a refresh this time, same as before this change.
    }
  }, [cart]);

  useEffect(() => {
    fetch('http://localhost:5000/api/products')
      .then(res => res.json())
      .then(data => {
        if (!data.success) return;
        setDbFoodItems(data.products.filter(p => p.category === 'food'));
        setDbBeautyItems(data.products.filter(p => p.category === 'beauty'));
        setDbToysItems(data.products.filter(p => p.category === 'toys'));
      })
      .catch(err => console.error('Could not load uploaded products:', err));
  }, []);

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
          customer_email: selectedEmail,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setOrderConfirmation({ id: data.order.id, total: data.order.total });
        setCart([]);
      } else if (data.unavailable_items) {
        // A shopkeeper deleted something that's sitting in this cart - block
        // the order (same as an out-of-stock check at checkout on a real
        // site) and remove just those items, instead of losing the whole
        // cart or silently placing an order for a discontinued item.
        setCart(prev => prev.filter(c => !data.unavailable_items.includes(c.name)));
        setOrderConfirmation({ unavailable: data.unavailable_items });
      } else if (data.insufficient_stock) {
        // Cap each short item down to what's actually in stock (remove it
        // entirely if that's 0) rather than dropping it outright - some of
        // it may still be purchasable, just not the full quantity asked for.
        const shortages = new Map(data.insufficient_stock.map(i => [i.name, i.available]));
        setCart(prev => prev.flatMap(c => {
          if (!shortages.has(c.name)) return [c];
          const available = shortages.get(c.name);
          return available > 0 ? [{ ...c, qty: available }] : [];
        }));
        setOrderConfirmation({ insufficientStock: data.insufficient_stock });
      } else {
        setOrderConfirmation({ error: true });
      }
    } catch (error) {
      setOrderConfirmation({ error: true });
    } finally {
      setPlacingOrder(false);
    }
  };

  // The full menu - original dishes and anything a shopkeeper has since
  // added via the admin "Add Product" form - now lives in the products
  // table (the original dishes were migrated in once, so the admin
  // Products/Best-Sellers page can see and track them like anything else).
  // Nutrition/protein are only present for the originally-migrated dishes;
  // admin-added items don't collect them yet, so those fields come back
  // null and the UI already tolerates that (renderFoodCard skips a missing
  // nutrition line, and the protein badge just doesn't render).
  const foodMenu = dbFoodItems.map(p => ({
    id: `db-${p.id}`,
    name: p.name,
    price: `₹${Math.round(Number(p.price))}`,
    image: p.image ? (p.image.startsWith('http') ? p.image : `http://localhost:5000${p.image}`) : '',
    description: p.description || '',
    category: (p.course || 'main').toUpperCase(),
    cuisine: p.cuisine || 'indian',
    protein: p.protein || null,
    nutrition: p.nutrition || null,
    diet: p.diet ? p.diet.split(',').filter(Boolean) : [],
  }));

  const makeupItems = dbBeautyItems.map(p => ({
    id: `db-${p.id}`,
    name: p.name,
    price: `₹${Math.round(Number(p.price))}`,
    image: p.image ? (p.image.startsWith('http') ? p.image : `http://localhost:5000${p.image}`) : '',
    description: p.description || '',
    category: (p.subcategory || 'skincare').toUpperCase(),
  }));

  const toysItems = dbToysItems.map(p => ({
    id: `db-${p.id}`,
    name: p.name,
    price: `₹${Math.round(Number(p.price))}`,
    image: p.image ? (p.image.startsWith('http') ? p.image : `http://localhost:5000${p.image}`) : '',
    description: p.description || '',
    category: (p.subcategory || 'building-blocks').toUpperCase(),
  }));

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

  const toyCategories = [
    { id: 'all', label: 'All Products', icon: '🧸' },
    { id: 'BUILDING-BLOCKS', label: 'Building Blocks', icon: '🧱' },
    { id: 'ACTION-FIGURES', label: 'Action Figures', icon: '🤖' },
    { id: 'BOARD-GAMES', label: 'Board Games', icon: '🎲' },
    { id: 'PUZZLES', label: 'Puzzles', icon: '🧩' },
    { id: 'OUTDOOR', label: 'Outdoor', icon: '⛵' },
  ];

  const filteredToys = toysItems.filter(item => {
    return activeToyCategory === 'all' || item.category === activeToyCategory;
  });

  // "Explore Picks Made For You": opens the chatbot straight into a
  // personalised set of picks (FloatingChatbot watches this counter).
  const handleExplore = () => setPicksRequest(n => n + 1);

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
                minWidth: '180px',
                zIndex: 200,
                overflow: 'hidden'
              }}>
                {(() => {
                  // Food, Makeup, and Toys have a real section on the page -
                  // Travel/Fitness are sign-up interests with nothing built
                  // yet, so they show as a disabled "Coming Soon" entry
                  // instead of a dead link, only when actually picked as an
                  // interest (no point showing them unprompted).
                  const SHOP_MENU_ITEMS = [
                    { key: 'food', icon: '🍽️', label: 'Food', sectionId: 'food-section' },
                    { key: 'beauty', icon: '💄', label: 'Makeup', sectionId: 'makeup-section' },
                    { key: 'toys', icon: '🧸', label: 'Toys', sectionId: 'toys-section' },
                    { key: 'travel', icon: '✈️', label: 'Travel', comingSoon: true },
                    { key: 'fitness', icon: '💪', label: 'Fitness', comingSoon: true },
                  ];
                  const knowsInterests = selectedInterests && selectedInterests.length > 0;
                  const items = knowsInterests
                    ? SHOP_MENU_ITEMS.filter(item => selectedInterests.includes(item.key))
                    : SHOP_MENU_ITEMS.filter(item => !item.comingSoon);

                  return items.map(item => (
                    <button
                      key={item.key}
                      onClick={() => !item.comingSoon && scrollToSection(item.sectionId)}
                      disabled={item.comingSoon}
                      style={{
                        width: '100%',
                        padding: '12px 20px',
                        textAlign: 'left',
                        border: 'none',
                        background: 'none',
                        cursor: item.comingSoon ? 'default' : 'pointer',
                        color: item.comingSoon ? '#aaa' : '#333',
                        fontWeight: '500',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                      onMouseEnter={(e) => { if (!item.comingSoon) e.currentTarget.style.background = '#f5f5f5'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                    >
                      <span>{item.icon} {item.label}</span>
                      {item.comingSoon && (
                        <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          Soon
                        </span>
                      )}
                    </button>
                  ));
                })()}
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
        {wantsFood && (
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
        )}

        {/* Interests picked at sign-up with no real section built yet
            (Travel, Fitness, ...) - a placeholder instead of just vanishing,
            so the interest is at least acknowledged. */}
        {unbuiltInterests.map(interest => {
          const meta = UNBUILT_INTEREST_META[interest] || { icon: '✨', label: interest };
          return (
            <div key={interest} style={{ marginBottom: '60px' }}>
              <h3 style={{ fontSize: '32px', margin: '0 0 30px 0', color: '#333' }}>
                {meta.icon} {meta.label}
              </h3>
              <div style={{
                padding: '80px 20px',
                textAlign: 'center',
                background: 'white',
                borderRadius: '12px',
                border: '2px dashed #ddd',
                color: '#999',
              }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚧</div>
                <p style={{ fontSize: '20px', fontWeight: '700', color: '#666', margin: '0 0 6px' }}>
                  Coming Soon
                </p>
                <p style={{ fontSize: '14px', margin: 0 }}>
                  We're working on {meta.label.toLowerCase()} picks made just for you.
                </p>
              </div>
            </div>
          );
        })}

        {wantsBeauty && (
        <>
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
        </>
        )}

        {wantsToys && (
        <>
        {/* Toys & Games Section */}
        <div id="toys-section" style={{ marginBottom: '60px' }}>
          <h3 style={{ fontSize: '32px', margin: '0 0 30px 0', color: '#333' }}>
            Toys & Games
          </h3>

          {/* Category Filter */}
          <div style={{ marginBottom: '40px' }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#666', fontSize: '14px' }}>
              FILTER BY CATEGORY
            </h4>
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              {toyCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveToyCategory(cat.id)}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '25px',
                    border: activeToyCategory === cat.id ? 'none' : '2px solid #ddd',
                    background: activeToyCategory === cat.id
                      ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
                      : 'white',
                    color: activeToyCategory === cat.id ? 'white' : '#333',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={(e) => {
                    if (activeToyCategory !== cat.id) {
                      e.target.style.borderColor = '#8b5cf6';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeToyCategory !== cat.id) {
                      e.target.style.borderColor = '#ddd';
                    }
                  }}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toys Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '30px'
          }}>
            {filteredToys.map((item) => (
              <div key={item.id}
              onClick={() => setViewingProduct({
                kind: 'toys',
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
                    background: '#6d28d9',
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
                      color: '#8b5cf6'
                    }}>
                      {item.price}
                    </span>
                    {(() => {
                      const itemCartItem = {
                        kind: 'toys',
                        name: item.name,
                        image: item.image,
                        description: item.description,
                        category: item.category,
                        price: item.price,
                      };
                      const itemQty = getCartQty(item.name, 'toys');
                      if (itemQty > 0) {
                        return (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '120px', padding: '6px 10px', border: '1.5px solid #8b5cf6', borderRadius: '6px' }}
                          >
                            <QtyStepper
                              qty={itemQty}
                              accent="#8b5cf6"
                              variant="compact"
                              onIncrease={() => addToCart(itemCartItem)}
                              onDecrease={() => decreaseQty(item.name, 'toys')}
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
                          background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
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

          {filteredToys.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#999'
            }}>
              <p style={{ fontSize: '18px' }}>No products match your filter. Try a different category!</p>
            </div>
          )}
        </div>
        </>
        )}

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
        initialEmail={selectedEmail}
        initialInterests={selectedInterests}
        picksRequest={picksRequest}
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