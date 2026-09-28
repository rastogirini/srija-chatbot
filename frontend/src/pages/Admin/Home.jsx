import { useNavigate } from "react-router";

const SECTIONS = [
  {
    key: "customers",
    icon: "👥",
    title: "Manage Customers & Revenue",
    description: "Search and sort every customer, see who's spending the most, and track revenue by week and month.",
    path: "/admin/customers",
    gradient: "linear-gradient(135deg, #667eea, #764ba2)",
  },
  {
    key: "products",
    icon: "📦",
    title: "Manage Products",
    description: "Add a new product with a real photo, or view and remove anything currently live on the menu.",
    path: "/admin/products",
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
  },
  {
    key: "orders",
    icon: "🧾",
    title: "Manage Orders",
    description: "See every order placed through the site and update its status as it moves through the kitchen.",
    path: "/admin/orders",
    gradient: "linear-gradient(135deg, #0ca678, #087f5b)",
  },
  {
    key: "reservations",
    icon: "📅",
    title: "Manage Reservations",
    description: "See every table booking, its contact details and preferences, and track it through to seating.",
    path: "/admin/reservations",
    gradient: "linear-gradient(135deg, #e64980, #c2255c)",
  },
];

export default function AdminHome() {
  const navigate = useNavigate();

  const handleLogout = () => {
    sessionStorage.removeItem("admin_password");
    navigate("/");
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
        <button onClick={handleLogout} style={{
          background: "none", border: "1px solid #e2e2ea", borderRadius: "8px", padding: "8px 16px",
          fontSize: "13px", fontWeight: "600", color: "#666", cursor: "pointer",
        }}>
          Log out
        </button>
      </nav>

      <div style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "22px 40px", color: "white",
      }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <h1 style={{ fontSize: "20px", fontWeight: "800", margin: 0 }}>👋 Welcome back, Admin</h1>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "12.5px", margin: "2px 0 0" }}>
            What would you like to do?
          </p>
        </div>
      </div>

      <div style={{ padding: "36px 40px 60px", maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "22px" }}>
          {SECTIONS.map(section => (
            <div
              key={section.key}
              onClick={() => navigate(section.path)}
              style={{
                background: "white", borderRadius: "18px", padding: "0", overflow: "hidden",
                boxShadow: "0 4px 20px rgba(30,30,60,0.07)", border: "1px solid #eee",
                cursor: "pointer", transition: "transform 0.18s ease, box-shadow 0.18s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 14px 32px rgba(30,30,60,0.14)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 20px rgba(30,30,60,0.07)";
              }}
            >
              <div style={{ background: section.gradient, height: "6px" }} />
              <div style={{ padding: "28px" }}>
                <div style={{
                  width: "56px", height: "56px", borderRadius: "14px", background: section.gradient,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px",
                  marginBottom: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                }}>
                  {section.icon}
                </div>
                <div style={{ fontSize: "17px", fontWeight: "800", color: "#1a1a2e", marginBottom: "6px" }}>
                  {section.title}
                </div>
                <div style={{ fontSize: "13px", color: "#888", lineHeight: "1.5", marginBottom: "16px" }}>
                  {section.description}
                </div>
                <div style={{ fontSize: "12.5px", fontWeight: "700", color: "#667eea", display: "flex", alignItems: "center", gap: "4px" }}>
                  Open <span>→</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
