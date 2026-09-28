import { useState, useEffect } from "react";
import { useNavigate } from "react-router";

const STATUS_META = {
  confirmed: { label: "Confirmed", bg: "#eff6ff", text: "#1d4ed8" },
  seated: { label: "Seated", bg: "#fffbeb", text: "#b45309" },
  completed: { label: "Completed", bg: "#f0fdf4", text: "#15803d" },
  cancelled: { label: "Cancelled", bg: "#fef2f2", text: "#b91c1c" },
  "no-show": { label: "No-show", bg: "#f3f4f6", text: "#4b5563" },
};

// The order a status naturally moves forward through - drives which
// "Next" button shows. Cancel/No-show are offered separately since they
// can happen from confirmed directly, not just at the end of a sequence.
const NEXT_STATUS = {
  confirmed: "seated",
  seated: "completed",
};

const formatDate = (dateStr, timeStr) => {
  if (!dateStr) return timeStr || "—";
  const date = new Date(dateStr);
  const dateLabel = isNaN(date) ? dateStr : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return timeStr ? `${dateLabel} · ${timeStr}` : dateLabel;
};

export default function AdminReservations() {
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:5000/api/reservations", {
        headers: { "X-Admin-Password": sessionStorage.getItem("admin_password") || "" },
      });
      const data = await response.json();
      if (data.success) {
        setReservations(data.reservations);
      } else {
        setError(data.error || "Could not load reservations.");
      }
    } catch (err) {
      setError("Connection error. Please make sure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReservations(); }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("admin_password");
    navigate("/");
  };

  const updateStatus = async (reservationId, status) => {
    setUpdatingId(reservationId);
    try {
      const response = await fetch(`http://localhost:5000/api/reservations/${reservationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": sessionStorage.getItem("admin_password") || "",
        },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (data.success) {
        setReservations(prev => prev.map(r => r.id === reservationId ? { ...r, status } : r));
      } else {
        setError(data.error || "Could not update reservation status.");
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
        background: "linear-gradient(135deg, #e64980 0%, #c2255c 100%)",
        padding: "18px 40px", color: "white",
      }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <h1 style={{ fontSize: "19px", fontWeight: "800", margin: 0 }}>📅 Reservations</h1>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "12.5px", margin: "2px 0 0" }}>
            Every table booking made through the site, most recent first.
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
        ) : reservations.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#aaa", fontSize: "13px", background: "white", borderRadius: "16px", border: "1px solid #eee" }}>
            No reservations yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {reservations.map(res => {
              const meta = STATUS_META[res.status] || STATUS_META.confirmed;
              const nextStatus = NEXT_STATUS[res.status];
              const isFinal = res.status === "completed" || res.status === "cancelled" || res.status === "no-show";
              const prefs = [res.seating, res.dietary, res.occasion, res.allergies ? `Allergies: ${res.allergies}` : null].filter(Boolean);
              return (
                <div key={res.id} style={{
                  background: "white", borderRadius: "16px", padding: "18px 22px",
                  boxShadow: "0 4px 20px rgba(30,30,60,0.07)", border: "1px solid #eee",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "14px", fontWeight: "800", color: "#1a1a2e", textTransform: "capitalize" }}>
                          {res.name || "Guest"}
                        </span>
                        <span style={{
                          background: meta.bg, color: meta.text,
                          fontSize: "11px", fontWeight: "700", padding: "3px 9px", borderRadius: "999px",
                        }}>
                          {meta.label}
                        </span>
                      </div>
                      <div style={{ fontSize: "12.5px", color: "#888", marginTop: "4px" }}>
                        {res.id} · {formatDate(res.date, res.time)}
                      </div>
                      <div style={{ fontSize: "12px", color: "#aaa", marginTop: "2px" }}>
                        {[res.phone, res.email].filter(Boolean).join(" · ") || "No contact on file"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "15px", fontWeight: "800", color: "#333" }}>
                        👥 {res.party_size ?? "—"}
                      </span>
                      {!isFinal && (
                        <>
                          {nextStatus && (
                            <button
                              onClick={() => updateStatus(res.id, nextStatus)}
                              disabled={updatingId === res.id}
                              style={{
                                background: "linear-gradient(135deg, #e64980, #c2255c)", border: "none", borderRadius: "6px",
                                padding: "6px 12px", fontSize: "11.5px", fontWeight: "700", color: "white", cursor: "pointer",
                              }}
                            >
                              {updatingId === res.id ? "..." : `Mark ${STATUS_META[nextStatus].label}`}
                            </button>
                          )}
                          {res.status === "confirmed" && (
                            <button
                              onClick={() => updateStatus(res.id, "no-show")}
                              disabled={updatingId === res.id}
                              style={{
                                background: "none", border: "1px solid #e2e2ea", color: "#666", borderRadius: "6px",
                                padding: "6px 12px", fontSize: "11.5px", fontWeight: "700", cursor: "pointer",
                              }}
                            >
                              No-show
                            </button>
                          )}
                          <button
                            onClick={() => updateStatus(res.id, "cancelled")}
                            disabled={updatingId === res.id}
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

                  {prefs.length > 0 && (
                    <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #f3f3f6", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {prefs.map((pref, i) => (
                        <span key={i} style={{
                          fontSize: "12px", color: "#555", background: "#faf9fc", border: "1px solid #eee",
                          padding: "4px 10px", borderRadius: "999px",
                        }}>
                          {pref}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p style={{ fontSize: "12px", color: "#aaa", marginTop: "16px" }}>
          Showing {reservations.length} reservation{reservations.length === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}
