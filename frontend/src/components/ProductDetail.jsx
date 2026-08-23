// Full-page product view shown on the main screen when the chatbot's
// "View" button is clicked, mirroring the compact chat card's data.
// Sized to fit within one screen (no page scroll) alongside the nav bar.
import QtyStepper from './QtyStepper';

export default function ProductDetail({ product, onBack, onAddToCart, onDecreaseQty, qtyInCart = 0 }) {
  if (!product) return null;

  const accent = product.kind === 'makeup' ? '#d6336c' : '#667eea';
  const accentDark = product.kind === 'makeup' ? '#ae2f5c' : '#4c51bf';
  const brand = product.kind === 'makeup' ? 'Srigen Beauty' : "Srija's Taste";
  const sku = `SRG-${product.name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

  const isVeg = product.kind === 'food' && product.diet
    ? product.diet.includes('vegetarian') || product.diet.includes('vegan')
    : null;

  const specs = [['Category', product.category]];
  if (product.cuisine) specs.push(['Cuisine', product.cuisine]);
  if (product.diet && product.diet.length > 0) specs.push(['Dietary', product.diet.join(', ')]);
  if (product.nutrition) {
    specs.push(['Protein', `${product.nutrition.protein}g / 100g`]);
    specs.push(['Calories', `${product.nutrition.calories} / 100g`]);
    specs.push(['Carbs', `${product.nutrition.carbs}g / 100g`]);
  }

  return (
    <div style={{ padding: '18px 40px', maxWidth: '1200px', margin: '0 auto' }}>
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: '#666',
          fontSize: '13px',
          fontWeight: '600',
          cursor: 'pointer',
          padding: 0,
          marginBottom: '10px',
        }}
      >
        ← Back to Shop
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.15fr', gap: '32px', alignItems: 'start' }}>
        <div style={{ borderRadius: '14px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}>
          <img
            src={product.image}
            alt={product.name}
            style={{ width: '100%', height: '320px', objectFit: 'cover', display: 'block' }}
          />
        </div>

        <div>
          <div style={{
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '0.08em',
            color: accent,
            textTransform: 'uppercase',
            marginBottom: '4px',
          }}>
            {brand} · SKU {sku}
          </div>

          <h1 style={{ fontSize: '23px', fontWeight: '700', color: '#1a1a2e', margin: '0 0 6px', lineHeight: '1.2', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isVeg !== null && (
              <span
                title={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '18px',
                  height: '18px',
                  border: `2px solid ${isVeg ? '#0ca678' : '#c92a2a'}`,
                  borderRadius: '3px',
                  flexShrink: 0,
                }}
              >
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: isVeg ? '#0ca678' : '#c92a2a',
                }} />
              </span>
            )}
            <span>{product.name}</span>
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '12px' }}>
            <span style={{ color: '#f5a623' }}>★★★★★</span>
            <span style={{ fontWeight: '600', color: '#333' }}>4.8</span>
            <span style={{ color: '#999' }}>(128 reviews)</span>
          </div>

          <div style={{ fontSize: '21px', fontWeight: '700', color: '#1a1a2e', marginBottom: '6px' }}>
            {product.price}
          </div>

          <p style={{
            fontSize: '12px',
            color: '#555',
            lineHeight: '1.4',
            marginBottom: '8px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {product.description}
          </p>

          <div style={{ marginBottom: '8px' }}>
            <h4 style={{ fontSize: '10px', letterSpacing: '0.08em', color: '#999', textTransform: 'uppercase', margin: '0 0 4px' }}>
              Specifications
            </h4>
            <div style={{ border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>
              {specs.map(([label, value], i) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '4px 12px',
                    borderTop: i === 0 ? 'none' : '1px solid #f0f0f0',
                    fontSize: '12px',
                  }}
                >
                  <span style={{ color: '#888' }}>{label}</span>
                  <span style={{ color: '#333', fontWeight: '600', textTransform: 'capitalize' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            background: '#f3fbf6',
            border: '1px solid #d5f0e0',
            borderRadius: '8px',
            color: '#1e8a4c',
            fontSize: '12px',
            fontWeight: '600',
            marginBottom: '10px',
          }}>
            ✅ In stock — {product.kind === 'makeup' ? 'ships within 2-3 days' : 'ready to prepare fresh'}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button style={{
              flex: 1,
              padding: '9px',
              borderRadius: '9px',
              border: `2px solid ${accent}`,
              background: 'white',
              color: accent,
              fontWeight: '700',
              fontSize: '12px',
              cursor: 'pointer',
            }}>
              View Similar
            </button>
            {qtyInCart > 0 ? (
              <div style={{ flex: 1, padding: '5px 12px', border: `2px solid ${accent}`, borderRadius: '9px' }}>
                <QtyStepper
                  qty={qtyInCart}
                  accent={accent}
                  variant="compact"
                  onIncrease={() => onAddToCart?.(product)}
                  onDecrease={() => onDecreaseQty?.(product.name, product.kind)}
                />
              </div>
            ) : (
              <button
              onClick={() => onAddToCart?.(product)}
              style={{
                flex: 1,
                padding: '9px',
                borderRadius: '9px',
                border: 'none',
                background: `linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%)`,
                color: 'white',
                fontWeight: '700',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}>
                🛒 Add to cart
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
