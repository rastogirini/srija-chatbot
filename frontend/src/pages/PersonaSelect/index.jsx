import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const PERSONAS = [
  {
    name: 'Sita',
    tag: 'Food · Makeup',
    icons: ['🍽️', '💄'],
    accent: '#d6336c',
    bg: 'linear-gradient(135deg, #fdf1f7 0%, #fff6f0 100%)',
  },
  {
    name: 'Meera',
    tag: 'Parent · Two Kids',
    icons: ['👪', '🧸'],
    accent: '#0ca678',
    bg: 'linear-gradient(135deg, #f0fdf7 0%, #f5fdf1 100%)',
  },
  {
    name: 'Priya',
    tag: 'Fashion & Style',
    icons: ['👗', '👠'],
    accent: '#4361ee',
    bg: 'linear-gradient(135deg, #f0f4ff 0%, #f5f0ff 100%)',
  },
];

const AUTO_CONTINUE_DELAY_MS = 5000;

export default function PersonaSelect() {
  const navigate = useNavigate();
  const location = useLocation();
  const typedName = location.state?.name?.trim().toLowerCase();

  const matchedPersona =
    PERSONAS.find((p) => p.name.toLowerCase() === typedName) || PERSONAS[0];

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/chat', { state: { persona: matchedPersona.name }, replace: true });
    }, AUTO_CONTINUE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [matchedPersona.name, navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f0ff 0%, #fdf1f7 50%, #fff6f0 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes personaDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes personaCardIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Decorative blurred blobs, tinted to the matched persona's accent */}
      <div style={{
        position: 'absolute',
        top: '-120px',
        left: '-100px',
        width: '380px',
        height: '380px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${matchedPersona.accent}33 0%, transparent 70%)`,
        filter: 'blur(10px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-140px',
        right: '-120px',
        width: '420px',
        height: '420px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${matchedPersona.accent}26 0%, transparent 70%)`,
        filter: 'blur(10px)',
        pointerEvents: 'none',
      }} />

      <img
        src="/images/logo/srigen-logo-2.svg"
        alt="Srigen.ai"
        style={{ height: '64px', marginBottom: '28px', position: 'relative' }}
      />

      <p style={{ fontSize: '17px', color: '#555', marginBottom: '48px', textAlign: 'center', position: 'relative' }}>
        Welcome back, {matchedPersona.name}!
      </p>

      <div
        style={{
          maxWidth: '300px',
          width: '100%',
          position: 'relative',
          background: matchedPersona.bg,
          border: `1px solid ${matchedPersona.accent}33`,
          borderRadius: '16px',
          padding: '28px',
          textAlign: 'center',
          boxShadow: '0 8px 28px rgba(0,0,0,0.06)',
          animation: 'personaCardIn 0.4s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '16px' }}>
          {matchedPersona.icons.map((icon, i) => (
            <div
              key={i}
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
              }}
            >
              {icon}
            </div>
          ))}
        </div>
        <div style={{ fontSize: '20px', fontWeight: '700', color: '#1a1a2e', marginBottom: '4px' }}>
          {matchedPersona.name}
        </div>
        <div style={{
          fontSize: '12px',
          fontWeight: '600',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          color: matchedPersona.accent,
          marginBottom: '22px',
        }}>
          {matchedPersona.tag}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '13px',
          color: '#888',
        }}>
          <span>Setting up your experience</span>
          <span style={{ display: 'flex', gap: '3px' }}>
            {[0, 0.2, 0.4].map((delay) => (
              <span
                key={delay}
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: matchedPersona.accent,
                  animation: 'personaDot 1.2s infinite',
                  animationDelay: `${delay}s`,
                }}
              />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
