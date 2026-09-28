import { useState, useEffect } from "react";
import { useNavigate } from "react-router";

const CATEGORY_META = {
  food: { icon: "🍽️", label: "Food", bg: "#fff7ed", text: "#c2410c" },
  beauty: { icon: "💄", label: "Beauty", bg: "#fdf2f8", text: "#be185d" },
};

const GRID_COLUMNS = "56px 1.6fr 0.8fr 0.8fr 90px 90px 100px 140px";

// Food's sub-category is "course" (appetizer/main/dessert/...), beauty's is
// "subcategory" (lipstick/foundation/...) - one column showing whichever
// applies, since a product is only ever one category at a time.
const getSubcategory = (product) => product.course || product.subcategory || null;

export default function AdminProducts() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmingId, setConfirmingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:5000/api/products/performance", {
        headers: { "X-Admin-Password": sessionStorage.getItem("admin_password") || "" },
      });
      const data = await response.json();
      if (data.success) {
        setProducts(data.products);
      } else {
        setError(data.error || "Could not load products.");
      }
    } catch (err) {
      setError("Connection error. Please make sure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("admin_password");
    navigate("/");
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const response = await fetch(`http://localhost:5000/api/products/${id}`, {
        method: "DELETE",
        headers: { "X-Admin-Password": sessionStorage.getItem("admin_password") || "" },
      });
      const data = await response.json();
      if (data.success) {
        setProducts(prev => prev.filter(p => p.id !== id));
      } else {
        setError(data.error || "Could not delete the product.");
      }
    } catch (err) {
      setError("Connection error while deleting.");
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
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
          <button onClick={() => navigate("/admin/products/new")} style={{
            background: "linear-gradient(135deg, #667eea, #4c51bf)", border: "none", borderRadius: "8px",
            padding: "8px 16px", fontSize: "13px", fontWeight: "700", color: "white", cursor: "pointer",
          }}>
            + Add Product
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
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "18px 40px", color: "white",
      }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <h1 style={{ fontSize: "19px", fontWeight: "800", margin: 0 }}>📦 Products</h1>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "12.5px", margin: "2px 0 0" }}>
            Everything currently live on the menu and in the beauty catalog, with units sold and revenue.
          </p>
        </div>
      </div>

      <div style={{ padding: "28px 40px 60px", maxWidth: "1000px", margin: "0 auto" }}>
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "12px", padding: "14px 18px", marginBottom: "20px", fontSize: "13.5px", color: "#b91c1c" }}>
            {error}
          </div>
        )}

        <div style={{
          background: "white", borderRadius: "16px", overflow: "hidden",
          boxShadow: "0 4px 20px rgba(30,30,60,0.07)", border: "1px solid #eee",
        }}>
          <div style={{
            display: "grid", gridTemplateColumns: GRID_COLUMNS,
            padding: "12px 22px", background: "#faf9fc", borderBottom: "1px solid #eee",
            fontSize: "11px", fontWeight: "800", color: "#999", textTransform: "uppercase", letterSpacing: "0.04em",
          }}>
            <span />
            <span>Product</span>
            <span>Category</span>
            <span>Sub-category</span>
            <span>Units Sold</span>
            <span>Revenue</span>
            <span>Price</span>
            <span />
          </div>

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#aaa", fontSize: "13px" }}>Loading...</div>
          ) : products.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#aaa", fontSize: "13px" }}>
              No products yet. <a href="/admin/products/new" style={{ color: "#667eea", fontWeight: "600" }}>Add your first one →</a>
            </div>
          ) : (
            products.map(product => {
              const meta = CATEGORY_META[product.category] || {};
              const isConfirming = confirmingId === product.id;
              return (
                <div key={product.id} style={{
                  display: "grid", gridTemplateColumns: GRID_COLUMNS,
                  alignItems: "center", padding: "12px 22px", borderBottom: "1px solid #f3f3f6",
                }}>
                  <div style={{
                    width: "40px", height: "40px", borderRadius: "8px", overflow: "hidden",
                    background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {product.image
                      ? <img src={product.image.startsWith("http") ? product.image : `http://localhost:5000${product.image}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: "18px" }}>{meta.icon || "📦"}</span>}
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#1a1a2e", textTransform: "capitalize" }}>
                      {product.name}
                    </div>
                    {product.is_top_seller && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: "3px", marginTop: "3px", marginRight: "5px",
                        background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe",
                        fontSize: "10.5px", fontWeight: "700", padding: "2px 7px", borderRadius: "999px",
                      }}>
                        ⭐ Star Product
                      </span>
                    )}
                    {product.on_sale_candidate && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: "3px", marginTop: "3px",
                        background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a",
                        fontSize: "10.5px", fontWeight: "700", padding: "2px 7px", borderRadius: "999px",
                      }}>
                        🏷️ Consider a sale
                      </span>
                    )}
                  </div>
                  <div>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: "4px",
                      background: meta.bg || "#f5f5f5", color: meta.text || "#666",
                      fontSize: "11px", fontWeight: "700", padding: "3px 9px", borderRadius: "999px",
                    }}>
                      {meta.icon} {meta.label || product.category}
                    </span>
                  </div>
                  <div style={{ fontSize: "12.5px", color: "#666", textTransform: "capitalize" }}>
                    {getSubcategory(product) || <span style={{ color: "#ccc", fontStyle: "italic" }}>—</span>}
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "#333" }}>
                    {product.units_sold ?? 0}
                  </div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#333" }}>
                      ₹{Math.round(Number(product.revenue) || 0)}
                    </div>
                    <div style={{ fontSize: "10.5px", color: "#aaa", marginTop: "1px" }}>
                      {product.units_sold ?? 0} × ₹{Math.round(Number(product.price))}
                    </div>
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "#333" }}>
                    ₹{Math.round(Number(product.price))}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {isConfirming ? (
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                        <button
                          onClick={() => handleDelete(product.id)}
                          disabled={deletingId === product.id}
                          style={{
                            background: "#dc2626", color: "white", border: "none", borderRadius: "6px",
                            padding: "5px 10px", fontSize: "11.5px", fontWeight: "700", cursor: "pointer",
                          }}
                        >
                          {deletingId === product.id ? "..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => setConfirmingId(null)}
                          style={{
                            background: "white", color: "#666", border: "1px solid #e2e2ea", borderRadius: "6px",
                            padding: "5px 10px", fontSize: "11.5px", fontWeight: "600", cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingId(product.id)}
                        title={`Delete ${product.name}`}
                        style={{
                          background: "none", border: "1px solid #fca5a5", color: "#dc2626", borderRadius: "6px",
                          padding: "5px 10px", fontSize: "11.5px", fontWeight: "700", cursor: "pointer",
                        }}
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <p style={{ fontSize: "12px", color: "#aaa", marginTop: "12px" }}>
          Showing {products.length} product{products.length === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}
