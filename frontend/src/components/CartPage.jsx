// Full-page cart view shown on the main screen when the nav cart icon is
// clicked - mirrors ProductDetail's full-page pattern instead of a small
// dropdown, so the whole cart (and checkout) is visible on the main screen.
import QtyStepper from './QtyStepper';

export default function CartPage({
  cart,
  cartTotal,
  onBack,
  onAddToCart,
  onDecreaseQty,
  onRemoveFromCart,
  onPlaceOrder,
  placingOrder,
  orderConfirmation,
  onDismissConfirmation,
}) {
  if (orderConfirmation) {
    return (
      <div style={{ padding: '60px 40px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        {orderConfirmation.error ? (
          <>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>😔</div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a2e', margin: '0 0 8px' }}>
              Something went wrong
            </h1>
            <p style={{ color: '#666', marginBottom: '24px' }}>
              We couldn't place your order. Please try again.
            </p>
            <button
              onClick={onDismissConfirmation}
              style={{
                padding: '12px 28px',
                borderRadius: '10px',
                border: '2px solid #667eea',
                background: 'white',
                color: '#667eea',
                fontWeight: '700',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Back to Cart
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a1a2e', margin: '0 0 8px' }}>
              Order placed!
            </h1>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '4px' }}>
              Order ID: {orderConfirmation.id}
            </p>
            <p style={{ color: '#333', fontSize: '18px', fontWeight: '700', marginBottom: '28px' }}>
              Total: ₹{orderConfirmation.total}
            </p>
            <button
              onClick={onBack}
              style={{
                padding: '12px 28px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                fontWeight: '700',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Continue Shopping
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '18px 40px 60px', maxWidth: '900px', margin: '0 auto' }}>
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
          marginBottom: '16px',
        }}
      >
        ← Back to Shop
      </button>

      <h1 style={{ fontSize: '34px', fontWeight: '700', color: '#1a1a2e', margin: '0 0 24px' }}>
        Cart
      </h1>

      {cart.length === 0 ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#888' }}>
          Your cart is empty.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
            {cart.map((item, i) => {
              const accent = item.kind === 'makeup' ? '#d6336c' : '#667eea';
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px',
                    border: '1px solid #eee',
                    borderRadius: '12px',
                    background: 'white',
                  }}
                >
                  <div style={{ width: '64px', height: '64px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: '#f5f5f5' }}>
                    <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.06em', color: accent, textTransform: 'uppercase', marginBottom: '2px' }}>
                      {(item.category || item.kind || '').toString().toUpperCase()} · QTY {item.qty}
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>
                      {item.name}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <QtyStepper
                      qty={item.qty}
                      accent={accent}
                      variant="pill"
                      onIncrease={() => onAddToCart(item)}
                      onDecrease={() => onDecreaseQty(item.name, item.kind)}
                    />
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: '700', color: '#1a1a2e', minWidth: '80px', textAlign: 'right', flexShrink: 0 }}>
                    {item.price}
                  </div>
                  <button
                    onClick={() => onRemoveFromCart(item.name, item.kind)}
                    title="Remove"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#999',
                      fontSize: '18px',
                      flexShrink: 0,
                      padding: '4px',
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            marginBottom: '20px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #f5f0ff 0%, #fdf1f7 100%)',
            border: '1px solid #ece3ff',
          }}>
            <span style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '0.08em', color: '#667eea', textTransform: 'uppercase' }}>
              Subtotal
            </span>
            <span style={{ fontSize: '26px', fontWeight: '700', color: '#1a1a2e' }}>
              ₹{cartTotal}
            </span>
          </div>

          <button
            onClick={onPlaceOrder}
            disabled={placingOrder}
            style={{
              width: '100%',
              padding: '18px',
              borderRadius: '12px',
              border: 'none',
              background: placingOrder ? '#b3b8f0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 60%, #d6336c 100%)',
              color: 'white',
              fontWeight: '700',
              fontSize: '16px',
              letterSpacing: '0.03em',
              cursor: placingOrder ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
            }}
          >
            {placingOrder ? 'PLACING ORDER...' : `PLACE ORDER — ₹${cartTotal}`}
            {!placingOrder && <span>→</span>}
          </button>
        </>
      )}
    </div>
  );
}
