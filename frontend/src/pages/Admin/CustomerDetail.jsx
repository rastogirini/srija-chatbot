import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";

// Kept in sync with Dashboard.jsx's palette so a customer's colors/labels
// read identically whether you're looking at the grid or their profile.
const INTEREST_META = {
  food: { icon: '🍽️', label: 'Food', bg: '#fff7ed', text: '#c2410c', gradient: 'linear-gradient(135deg, #fb923c, #ea580c)' },
  beauty: { icon: '💄', label: 'Makeup', bg: '#fdf2f8', text: '#be185d', gradient: 'linear-gradient(135deg, #f472b6, #db2777)' },
  toys: { icon: '🧸', label: 'Toys', bg: '#f5f3ff', text: '#6d28d9', gradient: 'linear-gradient(135deg, #a78bfa, #7c3aed)' },
  travel: { icon: '✈️', label: 'Travel', bg: '#eff6ff', text: '#1d4ed8', gradient: 'linear-gradient(135deg, #60a5fa, #2563eb)' },
  fitness: { icon: '💪', label: 'Fitness', bg: '#f0fdf4', text: '#15803d', gradient: 'linear-gradient(135deg, #4ade80, #16a34a)' },
};
const DEFAULT_GRADIENT = 'linear-gradient(135deg, #a5b4fc, #667eea)';

const STATUS_META = {
  placed: { bg: '#eff6ff', text: '#1d4ed8' },
  confirmed: { bg: '#eff6ff', text: '#1d4ed8' },
  preparing: { bg: '#fffbeb', text: '#b45309' },
  delivered: { bg: '#f0fdf4', text: '#15803d' },
  completed: { bg: '#f0fdf4', text: '#15803d' },
  cancelled: { bg: '#fef2f2', text: '#b91c1c' },
};

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d) ? value : d.toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  });
};

export default function AdminCustomerDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [isTopSpender, setIsTopSpender] = useState(false);
  const [orders, setOrders] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editInterests, setEditInterests] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`http://localhost:5000/api/customers/${id}`, {
          headers: { "X-Admin-Password": sessionStorage.getItem("admin_password") || "" },
        });
        const data = await response.json();
        if (data.success) {
          setCustomer(data.customer);
          setIsTopSpender(!!data.is_top_spender);
          setOrders(data.orders || []);
          setReservations(data.reservations || []);
        } else {
          setError(data.error || "Could not load this customer.");
        }
      } catch (err) {
        setError("Connection error. Please make sure the server is running.");
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  const handleLogout = () => {
    sessionStorage.removeItem("admin_password");
    navigate("/");
  };

  const startEditing = () => {
    setEditName(customer.name || "");
    setEditEmail(customer.email || "");
    setEditPhone(customer.phone || "");
    setEditInterests(customer.interests ? customer.interests.split(",").filter(Boolean) : []);
    setSaveError("");
    setIsEditing(true);
  };

  const toggleEditInterest = (key) => {
    setEditInterests(prev => prev.includes(key) ? prev.filter(i => i !== key) : [...prev, key]);
  };

  const saveEdits = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch(`http://localhost:5000/api/customers/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": sessionStorage.getItem("admin_password") || "",
        },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim(),
          phone: editPhone.trim(),
          interests: editInterests,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setCustomer(data.customer);
        setIsEditing(false);
      } else {
        setSaveError(data.error || "Could not save changes.");
      }
    } catch (err) {
      setSaveError("Connection error while saving.");
    } finally {
      setSaving(false);
    }
  };

  const interests = customer?.interests ? customer.interests.split(",").filter(Boolean) : [];
  const primaryGradient = interests.length > 0
    ? (INTEREST_META[interests[0]]?.gradient || DEFAULT_GRADIENT)
    : DEFAULT_GRADIENT;
  const initial = customer?.name ? customer.name.trim()[0].toUpperCase() : "?";
  const totalSpent = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7fb", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <nav style={{
        background: "white",
        padding: "16px 40px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ fontWeight: "800", fontSize: "18px", color: "#1a1a2e", letterSpacing: "-0.01em" }}>
          Srigen.ai <span style={{
            background: "linear-gradient(135deg, #667eea, #764ba2)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>Admin</span>
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: "none", border: "1px solid #e2e2ea", borderRadius: "8px", padding: "8px 16px",
            fontSize: "13px", fontWeight: "600", color: "#666", cursor: "pointer",
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#f7f7fb"; e.currentTarget.style.borderColor = "#ccc"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "#e2e2ea"; }}
        >
          Log out
        </button>
      </nav>

      {loading && (
        <div style={{ padding: "60px 40px", textAlign: "center", color: "#888" }}>Loading...</div>
      )}
      {error && (
        <div style={{ padding: "40px", maxWidth: "900px", margin: "0 auto" }}>
          <div style={{ background: "white", borderRadius: "16px", padding: "24px", color: "#c92a2a", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
            {error}
          </div>
        </div>
      )}

      {!loading && !error && customer && (
        <>
          {/* Header band - the calm brand gradient (same as Dashboard's hero),
              not the customer's saturated interest color, which read as too
              bold/heavy for a full-width background. Interest color is kept
              just as a light accent on the avatar and name underline below. */}
          <div style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", padding: "20px 40px 22px", color: "white" }}>
            <div style={{ maxWidth: "900px", margin: "0 auto" }}>
              <button
                onClick={() => navigate("/admin/customers")}
                style={{
                  background: "rgba(255,255,255,0.14)",
                  border: "1px solid rgba(255,255,255,0.25)",
                  borderRadius: "999px",
                  color: "white",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer",
                  padding: "5px 12px",
                  marginBottom: "16px",
                }}
              >
                ← Back to Customers
              </button>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{
                    width: "56px", height: "56px", borderRadius: "50%",
                    background: primaryGradient, border: "2px solid rgba(255,255,255,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "22px", fontWeight: "800", color: "white", flexShrink: 0,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  }}>
                    {initial}
                  </div>
                  <div>
                    <div style={{ fontSize: "20px", fontWeight: "800", textTransform: "capitalize", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                      {customer.name}
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                      {isTopSpender && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: "4px",
                          background: "#f59e0b", color: "white",
                          fontSize: "11px", fontWeight: "800", padding: "3px 10px", borderRadius: "999px",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                        }}>
                          ⭐ TOP SPENDER
                        </span>
                      )}
                      {interests.length > 0 ? interests.map(interest => {
                        const meta = INTEREST_META[interest];
                        return (
                          <span key={interest} style={{
                            display: "inline-flex", alignItems: "center", gap: "4px",
                            background: "rgba(255,255,255,0.16)", color: "white",
                            fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "999px",
                          }}>
                            <span>{meta?.icon || "✨"}</span>
                            {meta?.label || interest}
                          </span>
                        );
                      }) : (
                        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.75)", fontStyle: "italic" }}>No interests set</span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {[
                    { label: "Orders", value: orders.length },
                    { label: "Spent", value: `₹${totalSpent}` },
                    { label: "Reservations", value: reservations.length },
                  ].map((stat) => (
                    <div key={stat.label} style={{
                      background: "rgba(255,255,255,0.12)",
                      border: "1px solid rgba(255,255,255,0.18)",
                      borderRadius: "10px",
                      padding: "8px 16px",
                      textAlign: "center",
                      minWidth: "84px",
                    }}>
                      <div style={{ fontSize: "16px", fontWeight: "800" }}>{stat.value}</div>
                      <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.8)", fontWeight: "600", marginTop: "1px" }}>
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: "28px 40px 60px", maxWidth: "900px", margin: "0 auto" }}>
            {/* Personal info card */}
            <div style={{
              background: "white", borderRadius: "16px", padding: "24px", marginBottom: "22px",
              boxShadow: "0 4px 20px rgba(30,30,60,0.08)", border: "1px solid #eee",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <h2 style={{ fontSize: "13px", fontWeight: "800", color: "#999", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
                  Contact & Account
                </h2>
                {!isEditing && (
                  <button
                    onClick={startEditing}
                    style={{
                      background: "none", border: "1px solid #e2e2ea", borderRadius: "7px",
                      padding: "5px 12px", fontSize: "12px", fontWeight: "700", color: "#667eea", cursor: "pointer",
                    }}
                  >
                    ✏️ Edit
                  </button>
                )}
              </div>

              {isEditing ? (
                <div>
                  {saveError && (
                    <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "10px 14px", marginBottom: "14px", fontSize: "13px", color: "#b91c1c" }}>
                      {saveError}
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: "700", color: "#888", display: "block", marginBottom: "4px" }}>Name</label>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: "7px", border: "1px solid #e2e2ea", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: "700", color: "#888", display: "block", marginBottom: "4px" }}>Email</label>
                      <input
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: "7px", border: "1px solid #e2e2ea", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: "700", color: "#888", display: "block", marginBottom: "4px" }}>Phone</label>
                      <input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: "7px", border: "1px solid #e2e2ea", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                  <label style={{ fontSize: "11px", fontWeight: "700", color: "#888", display: "block", marginBottom: "6px" }}>Interests</label>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "18px" }}>
                    {Object.entries(INTEREST_META).map(([key, meta]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleEditInterest(key)}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: "5px",
                          padding: "6px 12px", borderRadius: "999px", cursor: "pointer",
                          fontSize: "12px", fontWeight: "700",
                          border: editInterests.includes(key) ? `1.5px solid ${meta.text}` : "1px solid #e2e2ea",
                          background: editInterests.includes(key) ? meta.bg : "white",
                          color: editInterests.includes(key) ? meta.text : "#888",
                        }}
                      >
                        {meta.icon} {meta.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={saveEdits}
                      disabled={saving}
                      style={{
                        background: saving ? "#c7cbf5" : "linear-gradient(135deg, #667eea, #4c51bf)",
                        border: "none", borderRadius: "8px", padding: "8px 18px",
                        fontSize: "13px", fontWeight: "700", color: "white", cursor: saving ? "default" : "pointer",
                      }}
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      disabled={saving}
                      style={{
                        background: "white", border: "1px solid #e2e2ea", borderRadius: "8px", padding: "8px 18px",
                        fontSize: "13px", fontWeight: "600", color: "#666", cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 24px", fontSize: "13px", color: "#333" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span>📧</span> {customer.email || "—"}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span>📱</span> {customer.phone || "—"}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span>🛡️</span> <span style={{ textTransform: "capitalize" }}>{customer.role}</span></div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span>📅</span> Member since {formatDate(customer.created_at)}</div>
                </div>
              )}
            </div>

            {/* Order history */}
            <div style={{
              background: "white", borderRadius: "16px", padding: "24px", marginBottom: "22px",
              boxShadow: "0 4px 20px rgba(30,30,60,0.08)", border: "1px solid #eee",
            }}>
              <h2 style={{ fontSize: "16px", fontWeight: "800", color: "#1a1a2e", margin: "0 0 18px" }}>
                🧾 Order History <span style={{ color: "#aaa", fontWeight: "600" }}>({orders.length})</span>
              </h2>
              {orders.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "#aaa" }}>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>🧾</div>
                  <p style={{ fontSize: "13px", margin: 0 }}>No orders placed yet.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {orders.map((order) => {
                    const status = STATUS_META[(order.status || '').toLowerCase()] || { bg: '#f5f5f5', text: '#666' };
                    return (
                      <div key={order.id} style={{
                        border: "1px solid #f0f0f0", borderRadius: "12px", padding: "16px",
                        transition: "border-color 0.15s, background 0.15s",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <span style={{ fontWeight: "800", fontSize: "13px", color: "#1a1a2e" }}>{order.id}</span>
                          <span style={{ fontSize: "12px", color: "#999" }}>{formatDate(order.created_at)}</span>
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
                          {(order.items || []).map((item, i) => (
                            <span key={i} style={{
                              background: "#f7f7fb", color: "#555", fontSize: "12px",
                              padding: "4px 10px", borderRadius: "999px",
                            }}>
                              {item.name}
                            </span>
                          ))}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{
                            padding: "3px 10px", borderRadius: "999px", background: status.bg, color: status.text,
                            fontWeight: "700", fontSize: "11px", textTransform: "uppercase",
                          }}>
                            {order.status}
                          </span>
                          <span style={{ fontWeight: "800", color: "#1a1a2e", fontSize: "15px" }}>₹{order.total}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Reservation history */}
            <div style={{
              background: "white", borderRadius: "16px", padding: "24px",
              boxShadow: "0 4px 20px rgba(30,30,60,0.08)", border: "1px solid #eee",
            }}>
              <h2 style={{ fontSize: "16px", fontWeight: "800", color: "#1a1a2e", margin: "0 0 18px" }}>
                📅 Reservation History <span style={{ color: "#aaa", fontWeight: "600" }}>({reservations.length})</span>
              </h2>
              {reservations.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "#aaa" }}>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>📅</div>
                  <p style={{ fontSize: "13px", margin: 0 }}>No reservations made yet.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {reservations.map((res) => (
                    <div key={res.id} style={{ border: "1px solid #f0f0f0", borderRadius: "12px", padding: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontWeight: "800", fontSize: "13px", color: "#1a1a2e" }}>{res.id}</span>
                        <span style={{ fontSize: "12px", color: "#999" }}>{formatDate(res.created_at)}</span>
                      </div>
                      <div style={{ fontSize: "13px", color: "#333", marginBottom: (res.occasion || res.seating) ? "10px" : 0 }}>
                        📆 {res.date} at {res.time} &nbsp;·&nbsp; 👥 Party of {res.party_size}
                      </div>
                      {(res.occasion || res.seating) && (
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {res.occasion && (
                            <span style={{ background: "#f7f7fb", color: "#555", fontSize: "12px", padding: "4px 10px", borderRadius: "999px" }}>
                              🎉 {res.occasion}
                            </span>
                          )}
                          {res.seating && (
                            <span style={{ background: "#f7f7fb", color: "#555", fontSize: "12px", padding: "4px 10px", borderRadius: "999px" }}>
                              🪑 {res.seating}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
