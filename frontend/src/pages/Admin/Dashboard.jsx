import { useState, useEffect } from "react";
import { useNavigate } from "react-router";

// Same icon/label convention used on the main site (Chat/index.jsx) and the
// persona-select card, kept in sync so an interest reads the same way
// everywhere a customer sees or an admin reviews it. Each entry also carries
// a color identity (chip background/text + a two-stop gradient) used to give
// every card and avatar a bit of personality instead of flat gray-on-white.
// Gradients are intentionally soft/pastel (not fully saturated) - they're
// used on every card's avatar and accent bar, so a loud color there would
// dominate the whole grid rather than just identifying the interest.
const INTEREST_META = {
  food: { icon: '🍽️', label: 'Food', bg: '#fff7ed', text: '#c2410c', gradient: 'linear-gradient(135deg, #fdba74, #fb923c)' },
  beauty: { icon: '💄', label: 'Makeup', bg: '#fdf2f8', text: '#be185d', gradient: 'linear-gradient(135deg, #f9a8d4, #f472b6)' },
  toys: { icon: '🧸', label: 'Toys', bg: '#f5f3ff', text: '#6d28d9', gradient: 'linear-gradient(135deg, #c4b5fd, #8b5cf6)' },
  travel: { icon: '✈️', label: 'Travel', bg: '#eff6ff', text: '#1d4ed8', gradient: 'linear-gradient(135deg, #93c5fd, #60a5fa)' },
  fitness: { icon: '💪', label: 'Fitness', bg: '#f0fdf4', text: '#15803d', gradient: 'linear-gradient(135deg, #86efac, #4ade80)' },
};
const DEFAULT_GRADIENT = 'linear-gradient(135deg, #c7d2fe, #a5b4fc)';

const SORT_COLUMNS = {
  name: { label: "Customer", get: (c) => (c.name || "").toLowerCase() },
  visits: { label: "Visits", get: (c) => c.visits || 0 },
};

const sortHeaderStyle = {
  background: "none", border: "none", padding: 0, cursor: "pointer",
  font: "inherit", color: "inherit", textAlign: "left",
};

const formatWeekLabel = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const formatMonthLabel = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", year: "2-digit" });

// Hand-drawn bars, not a charting library - this is revenue, not profit
// (the schema has no cost data), so the label matters as much as the chart.
// A gradient fill, a soft tinted panel behind the bars, and a per-bar hover
// state (dims the others, brightens the value label) give it some life
// without implying the bars do anything on click - they don't.
const RevenueBarChart = ({ data, formatLabel, color, gradientId, panelBg }) => {
  const [hovered, setHovered] = useState(null);

  if (!data || data.length === 0) {
    return <div style={{ padding: "30px 0", textAlign: "center", color: "#aaa", fontSize: "13px" }}>No revenue data yet.</div>;
  }
  const max = Math.max(...data.map(d => d.total), 1);
  const barWidth = 44;
  const gap = 18;
  const chartHeight = 110;
  const width = data.length * (barWidth + gap) + gap;
  const height = chartHeight + 50;

  return (
    <div style={{ background: panelBg, borderRadius: "12px", padding: "14px 8px 4px" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", maxWidth: `${width}px`, display: "block" }}
        role="img"
        aria-label={`Revenue bar chart across ${data.length} periods, values in rupees`}
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.7" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>
        <line x1="0" y1={chartHeight + 26} x2={width} y2={chartHeight + 26} stroke="#e5e5ea" strokeWidth="1" />
        {data.map((d, i) => {
          const barHeight = Math.max((d.total / max) * chartHeight, 2);
          const x = gap + i * (barWidth + gap);
          const y = chartHeight - barHeight + 26;
          const isHovered = hovered === i;
          const isDimmed = hovered !== null && !isHovered;
          return (
            <g key={i} onMouseEnter={() => setHovered(i)} style={{ transition: "opacity 0.15s" }} opacity={isDimmed ? 0.45 : 1}>
              <text
                x={x + barWidth / 2} y={y - 8} textAnchor="middle"
                fontSize={isHovered ? "12.5" : "11"} fontWeight="800"
                fill={isHovered ? color : "#333"}
              >
                ₹{Math.round(d.total)}
              </text>
              <rect x={x} y={y} width={barWidth} height={barHeight} rx="6" fill={`url(#${gradientId})`} />
              <text x={x + barWidth / 2} y={chartHeight + 44} textAnchor="middle" fontSize="10.5" fontWeight={isHovered ? "700" : "400"} fill={isHovered ? "#555" : "#999"}>
                {formatLabel(d.bucket)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [topSpenderIds, setTopSpenderIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [revenue, setRevenue] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(true);

  useEffect(() => {
    const authHeaders = { "X-Admin-Password": sessionStorage.getItem("admin_password") || "" };

    const fetchCustomers = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/customers", { headers: authHeaders });
        const data = await response.json();
        if (data.success) {
          setCustomers(data.customers);
          setTopSpenderIds(data.top_spender_ids || []);
        } else {
          setError(data.error || "Could not load customers.");
        }
      } catch (err) {
        setError("Connection error. Please make sure the server is running.");
      } finally {
        setLoading(false);
      }
    };

    const fetchRevenue = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/analytics/revenue", { headers: authHeaders });
        const data = await response.json();
        if (data.success) setRevenue(data);
      } catch (err) {
        // Revenue is a secondary section - a failure here shouldn't block
        // the customer table from loading, so it's silent beyond the console.
        console.error("Could not load revenue:", err);
      } finally {
        setRevenueLoading(false);
      }
    };

    fetchCustomers();
    fetchRevenue();
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("admin_password");
    navigate("/");
  };

  const totalVisits = customers.reduce((sum, c) => sum + (c.visits || 0), 0);
  const mostActive = customers.reduce((top, c) => (c.visits || 0) > (top?.visits || 0) ? c : top, null);

  const query = search.trim().toLowerCase();
  const filtered = customers.filter(c =>
    !query ||
    (c.name || "").toLowerCase().includes(query) ||
    (c.email || "").toLowerCase().includes(query) ||
    (c.phone || "").toLowerCase().includes(query)
  );

  const sorted = [...filtered].sort((a, b) => {
    const av = SORT_COLUMNS[sortKey].get(a);
    const bv = SORT_COLUMNS[sortKey].get(b);
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

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
        <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={() => navigate("/admin")}
          style={{
            background: "none",
            border: "1px solid #e2e2ea",
            borderRadius: "8px",
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: "700",
            color: "#666",
            cursor: "pointer",
          }}
        >
          🏠 Home
        </button>
        <button
          onClick={handleLogout}
          style={{
            background: "none",
            border: "1px solid #e2e2ea",
            borderRadius: "8px",
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: "600",
            color: "#666",
            cursor: "pointer",
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#f7f7fb"; e.currentTarget.style.borderColor = "#ccc"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "#e2e2ea"; }}
        >
          Log out
        </button>
        </div>
      </nav>

      {/* Header band - compact single row instead of a tall hero, so the
          gradient reads as a bar of context rather than a wall of color. */}
      <div style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "18px 40px",
        color: "white",
      }}>
        <div style={{
          maxWidth: "1100px", margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "16px", flexWrap: "wrap",
        }}>
          <div>
            <h1 style={{ fontSize: "19px", fontWeight: "800", margin: 0, letterSpacing: "-0.01em" }}>
              👥 Meet Your Customers
            </h1>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "12.5px", margin: "2px 0 0" }}>
              A quick look at who's using Srigen.ai and what they're into.
            </p>
          </div>

          {!loading && !error && (
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {[
                { label: "Customers", value: customers.length },
                { label: "Visits", value: totalVisits },
                { label: "Most Active", value: mostActive ? mostActive.name : "—", capitalize: true },
              ].map((stat) => (
                <div key={stat.label} style={{
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: "10px",
                  padding: "6px 14px",
                  textAlign: "center",
                  minWidth: "84px",
                }}>
                  <div style={{ fontSize: "15px", fontWeight: "800", textTransform: stat.capitalize ? "capitalize" : "none" }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.8)", fontWeight: "600" }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "28px 40px 60px", maxWidth: "1100px", margin: "0 auto" }}>
        {loading && (
          <div style={{ background: "white", borderRadius: "16px", padding: "40px", textAlign: "center", color: "#888", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
            Loading...
          </div>
        )}
        {error && (
          <div style={{ background: "white", borderRadius: "16px", padding: "24px", color: "#c92a2a", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
            {error}
          </div>
        )}

        {/* Revenue - not profit, the schema has no cost-of-goods data to
            subtract from what an order sold for. */}
        <div style={{
          background: "white", borderRadius: "16px", padding: "20px 22px", marginBottom: "22px",
          boxShadow: "0 4px 20px rgba(30,30,60,0.07)", border: "1px solid #eee",
        }}>
          <h2 style={{ fontSize: "15px", fontWeight: "800", color: "#1a1a2e", margin: "0 0 4px" }}>
            💵 Revenue
          </h2>
          <p style={{ fontSize: "12px", color: "#999", margin: "0 0 14px" }}>
            What came in from orders - not profit, there's no cost data on file to subtract.
          </p>
          {revenueLoading ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "#aaa", fontSize: "13px" }}>Loading...</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "22px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#999", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Last 8 weeks
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: "800", color: "#667eea" }}>
                    ₹{Math.round((revenue?.weekly || []).reduce((sum, d) => sum + d.total, 0)).toLocaleString()} total
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <RevenueBarChart data={revenue?.weekly} formatLabel={formatWeekLabel} color="#667eea" gradientId="weeklyGradient" panelBg="#f5f6fe" />
                </div>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#999", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Last 6 months
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: "800", color: "#d6336c" }}>
                    ₹{Math.round((revenue?.monthly || []).reduce((sum, d) => sum + d.total, 0)).toLocaleString()} total
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <RevenueBarChart data={revenue?.monthly} formatLabel={formatMonthLabel} color="#d6336c" gradientId="monthlyGradient" panelBg="#fdf1f7" />
                </div>
              </div>
            </div>
          )}

          {!revenueLoading && revenue?.by_category?.length > 0 && (() => {
            const total = revenue.by_category.reduce((sum, c) => sum + c.total, 0);
            return (
              <div style={{ marginTop: "20px", paddingTop: "18px", borderTop: "1px solid #f3f3f6" }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "#999", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "10px" }}>
                  By Category (all-time)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
                  {revenue.by_category.map(c => {
                    const meta = INTEREST_META[c.category] || { icon: "❔", label: c.category, bg: "#f5f5f5", text: "#666" };
                    const pct = total > 0 ? Math.round((c.total / total) * 100) : 0;
                    return (
                      <div key={c.category} style={{
                        background: meta.bg, borderRadius: "12px", padding: "14px 16px",
                        display: "flex", alignItems: "center", gap: "12px",
                      }}>
                        <span style={{ fontSize: "20px" }}>{meta.icon}</span>
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: "700", color: meta.text }}>
                            {meta.label} · {pct}%
                          </div>
                          <div style={{ fontSize: "15px", fontWeight: "800", color: "#1a1a2e" }}>
                            ₹{Math.round(c.total).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {!loading && !error && (
          <>
            {/* Search */}
            <div style={{ position: "relative", marginBottom: "18px" }}>
              <span style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", color: "#aaa" }}>🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or phone..."
                style={{
                  width: "100%",
                  padding: "12px 16px 12px 40px",
                  borderRadius: "12px",
                  border: "1px solid #e2e2ea",
                  fontSize: "14px",
                  color: "#333",
                  background: "white",
                  boxShadow: "0 2px 10px rgba(30,30,60,0.05)",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            {/* Table */}
            <div style={{
              background: "white", borderRadius: "16px", overflow: "hidden",
              boxShadow: "0 4px 20px rgba(30,30,60,0.07)", border: "1px solid #eee",
            }}>
              <div style={{
                display: "grid", gridTemplateColumns: "2.2fr 1.6fr 1.6fr 0.8fr 24px",
                padding: "12px 22px", background: "#faf9fc", borderBottom: "1px solid #eee",
                fontSize: "11px", fontWeight: "800", color: "#999", textTransform: "uppercase", letterSpacing: "0.04em",
              }}>
                <button onClick={() => handleSort("name")} style={sortHeaderStyle}>
                  {SORT_COLUMNS.name.label} {sortKey === "name" && (sortDir === "asc" ? "↑" : "↓")}
                </button>
                <span>Interests</span>
                <span>Contact</span>
                <button onClick={() => handleSort("visits")} style={sortHeaderStyle}>
                  {SORT_COLUMNS.visits.label} {sortKey === "visits" && (sortDir === "asc" ? "↑" : "↓")}
                </button>
                <span />
              </div>

              {sorted.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#aaa", fontSize: "13px" }}>
                  No customers match "{search}".
                </div>
              ) : (
                sorted.map(customer => {
                  const interests = customer.interests ? customer.interests.split(",").filter(Boolean) : [];
                  const primaryGradient = interests.length > 0
                    ? (INTEREST_META[interests[0]]?.gradient || DEFAULT_GRADIENT)
                    : DEFAULT_GRADIENT;
                  const initial = customer.name ? customer.name.trim()[0].toUpperCase() : "?";
                  const isTopSpender = topSpenderIds.includes(customer.id);
                  const restingBg = isTopSpender ? "#fffbeb" : "transparent";
                  const hoverBg = isTopSpender ? "#fef3c7" : "#faf9fc";

                  return (
                    <div
                      key={customer.id}
                      data-testid={`customer-row-${customer.id}`}
                      onClick={() => navigate(`/admin/customers/${customer.id}`)}
                      style={{
                        display: "grid", gridTemplateColumns: "2.2fr 1.6fr 1.6fr 0.8fr 24px",
                        alignItems: "center", padding: "14px 22px",
                        borderBottom: "1px solid #f3f3f6",
                        borderLeft: isTopSpender ? "3px solid #f59e0b" : "3px solid transparent",
                        background: restingBg,
                        cursor: "pointer",
                        transition: "background 0.12s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = restingBg; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                        <div style={{
                          width: "38px", height: "38px", borderRadius: "50%", background: primaryGradient,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "15px", fontWeight: "800", color: "white", flexShrink: 0,
                        }}>
                          {initial}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "14px", fontWeight: "700", color: "#1a1a2e", textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {customer.name}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                            {isTopSpender && (
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: "3px",
                                background: "#f59e0b", color: "white", fontSize: "10px", fontWeight: "800",
                                padding: "2px 7px", borderRadius: "999px", flexShrink: 0,
                              }}>
                                ⭐ TOP SPENDER
                              </span>
                            )}
                            {customer.role === "admin" && (
                              <span style={{ fontSize: "10.5px", fontWeight: "700", color: "#764ba2" }}>ADMIN</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {interests.length > 0 ? interests.map(interest => {
                          const meta = INTEREST_META[interest];
                          return (
                            <span key={interest} style={{
                              display: "inline-flex", alignItems: "center", gap: "3px",
                              background: meta?.bg || "#f5f5f5", color: meta?.text || "#666",
                              fontSize: "10.5px", fontWeight: "700", padding: "3px 8px", borderRadius: "999px",
                            }}>
                              <span>{meta?.icon || "✨"}</span>
                              {meta?.label || interest}
                            </span>
                          );
                        }) : (
                          <span style={{ fontSize: "12px", color: "#ccc", fontStyle: "italic" }}>—</span>
                        )}
                      </div>

                      <div style={{ fontSize: "12.5px", color: "#666", minWidth: 0 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer.email || "—"}</div>
                        <div style={{ color: "#999" }}>{customer.phone || "—"}</div>
                      </div>

                      <div style={{ fontSize: "13px", fontWeight: "700", color: "#333" }}>
                        {customer.visits}
                      </div>

                      <div style={{ color: "#c3c3d0", fontSize: "14px" }}>→</div>
                    </div>
                  );
                })
              )}
            </div>

            <p style={{ fontSize: "12px", color: "#aaa", marginTop: "12px" }}>
              Showing {sorted.length} of {customers.length} customer{customers.length === 1 ? "" : "s"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
