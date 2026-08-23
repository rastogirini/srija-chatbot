// Small +/- quantity control, reused wherever a cart item's quantity can be
// adjusted: product cards (replaces "Add to cart" once qty > 0) and cart
// panel rows.
export default function QtyStepper({ qty, onIncrease, onDecrease, accent, variant = 'pill' }) {
  const isPill = variant === 'pill';

  const buttonStyle = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: accent,
    fontWeight: '700',
    fontSize: isPill ? '15px' : '13px',
    width: isPill ? '28px' : '20px',
    height: isPill ? '28px' : '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    padding: 0,
    flexShrink: 0,
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flex: isPill ? 1 : undefined,
      gap: isPill ? 0 : '4px',
      border: isPill ? `1.5px solid ${accent}` : 'none',
      borderRadius: isPill ? '6px' : '0',
      padding: isPill ? '0 2px' : '0',
    }}>
      <button type="button" onClick={onDecrease} style={buttonStyle} title="Decrease quantity">−</button>
      <span style={{
        fontSize: isPill ? '13px' : '12px',
        fontWeight: '700',
        color: isPill ? accent : '#333',
        minWidth: isPill ? undefined : '14px',
        textAlign: 'center',
      }}>
        {qty}
      </span>
      <button type="button" onClick={onIncrease} style={buttonStyle} title="Increase quantity">+</button>
    </div>
  );
}
