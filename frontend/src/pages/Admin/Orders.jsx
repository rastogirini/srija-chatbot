import { useState, useEffect } from "react";
import { useNavigate } from "react-router";

const STATUS_META = {
  placed: { label: "Placed", bg: "#eff6ff", text: "#1d4ed8" },
  preparing: { label: "Preparing", bg: "#fffbeb", text: "#b45309" },
  ready: { label: "Ready", bg: "#f0fdf4", text: "#15803d" },
  delivered: { label: "Delivered", bg: "#f3f4f6", text: "#4b5563" },
  cancelled: { label: "Cancelled", bg: "#fef2f2", text: "#b91c1c" },
};

// The order a status naturally moves forward through - drives which
// "Next" button shows for a given order. Cancelling is always offered
// separately, since it can happen from any state, not just the end.
const NEXT_STATUS = {
  placed: "preparing",
  preparing: "ready",
  ready: "delivered",
};

const formatTime = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

export default function AdminOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:5000/api/orders", {
        headers: { "X-Admin-Password": sessionStorage.getItem("admin_password") || "" },
      });
      const data = await response.json();
      if (data.success) {
        setOrders(data.orders);
      } else {
        setError(data.error || "Could not load orders.");
      }
    } catch (err) {
      setError("Connection error. Please make sure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("admin_password");
    navigate("/");
  };

  const updateStatus = async (orderId, status) => {
    setUpdatingId(orderId);
    try {
      const response = await fetch(`http://localhost:5000/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": sessionStorage.getItem("admin_password") || "",
        },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (data.success) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      } else {
        setError(data.error || "Could not update order status.");
      }
    } catch (err) {
      setError("Connection error while updating.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7fb", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <nav style={{
        background: "white", padding: "16px 40px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ fontWeight: "800", fontSize: "18px", color: "#1a1a2e", letterSpacing: "-0.01em" }}>
          Srigen.ai <span style={{
            background: "linear-gradient(135deg, #667eea, #764ba2)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>Admin</span>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => navigate("/admin")} style={{
            background: "none", border: "1px solid #e2e2ea", borderRadius: "8px", padding: "8px 16px",
            fontSize: "13px", fontWeight: "700", color: "#666", cursor: "pointer",
          }}>
            🏠 Home
          </button>
          <button onClick={handleLogout} style={{
            background: "none", border: "1px solid #e2e2ea", borderRadius: "8px", padding: "8px 16px",
            fontSize: "13px", fontWeight: "600", color: "#666", cursor: "pointer",
          }}>
            Log out
          </button>
        </div>
      </nav>

      <div style={{
        background: "linear-gradient(135deg, #0ca678 0%, #087f5b 100%)",
        padding: "18px 40px", color: "white",
      }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <h1 style={{ fontSize: "19px", fontWeight: "800", margin: 0 }}>🧾 Orders</h1>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "12.5px", margin: "2px 0 0" }}>
            Every order placed through the site, most recent first.
          </p>
        </div>
      </div>

      <div style={{ padding: "28px 40px 60px", maxWidth: "1100px", margin: "0 auto" }}>
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "12px", padding: "14px 18px", marginBottom: "20px", fontSize: "13.5px", color: "#b91c1c" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#aaa", fontSize: "13px" }}>Loading...</div>
        ) : orders.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#aaa", fontSize: "13px", background: "white", borderRadius: "16px", border: "1px solid #eee" }}>
            No orders yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {orders.map(order => {
              const meta = STATUS_META[order.status] || STATUS_META.placed;
              const nextStatus = NEXT_STATUS[order.status];
              const isFinal = order.status === "delivered" || order.status === "cancelled";
              return (
                <div key={order.id} style={{
                  background: "white", borderRadius: "16px", padding: "18px 22px",
                  boxShadow: "0 4px 20px rgba(30,30,60,0.07)", border: "1px solid #eee",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "14px", fontWeight: "800", color: "#1a1a2e" }}>{order.id}</span>
                        <span style={{
                          background: meta.bg, color: meta.text,
                          fontSize: "11px", fontWeight: "700", padding: "3px 9px", borderRadius: "999px",
                        }}>
                          {meta.label}
                        </span>
                      </div>
                      <div style={{ fontSize: "12.5px", color: "#888", marginTop: "4px" }}>
                        {order.customer_name || "Guest"} · {formatTime(order.created_at)}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "15px", fontWeight: "800", color: "#333" }}>
                        ₹{Math.round(Number(order.total))}
                      </span>
                      {!isFinal && (
                        <>
                          {nextStatus && (
                            <button
                              onClick={() => updateStatus(order.id, nextStatus)}
                              disabled={updatingId === order.id}
                              style={{
                                background: "linear-gradient(135deg, #0ca678, #087f5b)", border: "none", borderRadius: "6px",
                                padding: "6px 12px", fontSize: "11.5px", fontWeight: "700", color: "white", cursor: "pointer",
                              }}
                            >
                              {updatingId === order.id ? "..." : `Mark ${STATUS_META[nextStatus].label}`}
                            </button>
                          )}
                          <button
                            onClick={() => updateStatus(order.id, "cancelled")}
                            disabled={updatingId === order.id}
                            style={{
                              background: "none", border: "1px solid #fca5a5", color: "#dc2626", borderRadius: "6px",
                              padding: "6px 12px", fontSize: "11.5px", fontWeight: "700", cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #f3f3f6", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {(order.items || []).map((item, i) => (
                      <span key={i} style={{
                        fontSize: "12px", color: "#555", background: "#faf9fc", border: "1px solid #eee",
                        padding: "4px 10px", borderRadius: "999px",
                      }}>
                        {item.qty > 1 ? `${item.qty}× ` : ""}{item.name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p style={{ fontSize: "12px", color: "#aaa", marginTop: "16px" }}>
          Showing {orders.length} order{orders.length === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}
