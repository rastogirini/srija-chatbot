import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { downloadFile } from "./BulkUpload";

const CATEGORY_META = {
  food: { icon: "🍽️", label: "Food", bg: "#fff7ed", text: "#c2410c", gradient: "linear-gradient(135deg, #fdba74, #fb923c)" },
  beauty: { icon: "💄", label: "Beauty", bg: "#fdf2f8", text: "#be185d", gradient: "linear-gradient(135deg, #f9a8d4, #f472b6)" },
  toys: { icon: "🧸", label: "Toys", bg: "#f5f3ff", text: "#6d28d9", gradient: "linear-gradient(135deg, #c4b5fd, #8b5cf6)" },
};

// No Category column within a section (it's already filtered to one), but
// still enough columns for Sub-category/Units/Revenue/Price/Stock/Edit+Delete.
const GRID_COLUMNS = "56px 2fr 1fr 90px 90px 90px 90px 170px";

// Food's sub-category is "course" (appetizer/main/dessert/...), beauty's is
// "subcategory" (lipstick/foundation/...) - one column showing whichever
// applies, since a product is only ever one category at a time.
const getSubcategory = (product) => product.course || product.subcategory || null;

function StockCell({ product, isEditing, draft, onStartEdit, onDraftChange, onSave, onCancel, saving }) {
  if (isEditing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <input
          type="number"
          min="0"
          autoFocus
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
          style={{
            width: "48px", padding: "4px 6px", borderRadius: "6px", border: "1px solid #cbd5e1",
            fontSize: "12.5px", outline: "none",
          }}
        />
        <button onClick={onSave} disabled={saving} title="Save" style={{
          background: "#0ca678", border: "none", borderRadius: "5px", color: "white",
          width: "22px", height: "22px", fontSize: "12px", cursor: "pointer", lineHeight: 1,
        }}>✓</button>
        <button onClick={onCancel} title="Cancel" style={{
          background: "none", border: "1px solid #e2e2ea", borderRadius: "5px", color: "#888",
          width: "22px", height: "22px", fontSize: "11px", cursor: "pointer", lineHeight: 1,
        }}>✕</button>
      </div>
    );
  }

  return (
    <div onClick={onStartEdit} title="Click to set stock" style={{ cursor: "pointer" }}>
      <div style={{ fontSize: "13px", fontWeight: "600", color: product.stock === null ? "#bbb" : "#333" }}>
        {product.stock === null ? "∞" : product.stock}
      </div>
      {product.is_low_stock && (
        <div style={{ fontSize: "10px", color: "#b45309", fontWeight: "700", marginTop: "1px" }}>
          ⚠️ Low
        </div>
      )}
    </div>
  );
}

function ProductRow({ product, isConfirming, deletingId, onConfirm, onCancel, onDelete, onEdit, stockEdit, onStockEdit }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: GRID_COLUMNS,
      alignItems: "center", padding: "12px 22px", borderBottom: "1px solid #f3f3f6",
    }}>
      <div style={{
        width: "40px", height: "40px", borderRadius: "8px", overflow: "hidden",
        background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {product.image
          ? <img src={product.image.startsWith("http") ? product.image : `http://localhost:5000${product.image}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: "18px" }}>{CATEGORY_META[product.category]?.icon || "📦"}</span>}
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
            display: "inline-flex", alignItems: "center", gap: "3px", marginTop: "3px", marginRight: "5px",
            background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a",
            fontSize: "10.5px", fontWeight: "700", padding: "2px 7px", borderRadius: "999px",
          }}>
            🏷️ Consider a sale
          </span>
        )}
        {product.is_dead_stock && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "3px", marginTop: "3px",
            background: "#f3f4f6", color: "#4b5563", border: "1px solid #d1d5db",
            fontSize: "10.5px", fontWeight: "700", padding: "2px 7px", borderRadius: "999px",
          }}>
            💀 Dead Stock
          </span>
        )}
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
      <StockCell
        product={product}
        isEditing={stockEdit.editingId === product.id}
        draft={stockEdit.draft}
        saving={stockEdit.savingId === product.id}
        onStartEdit={() => onStockEdit.start(product)}
        onDraftChange={onStockEdit.setDraft}
        onSave={() => onStockEdit.save(product.id)}
        onCancel={onStockEdit.cancel}
      />
      <div style={{ textAlign: "right" }}>
        {isConfirming ? (
          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
            <button
              onClick={() => onDelete(product.id)}
              disabled={deletingId === product.id}
              style={{
                background: "#dc2626", color: "white", border: "none", borderRadius: "6px",
                padding: "5px 10px", fontSize: "11.5px", fontWeight: "700", cursor: "pointer",
              }}
            >
              {deletingId === product.id ? "..." : "Confirm"}
            </button>
            <button
              onClick={onCancel}
              style={{
                background: "white", color: "#666", border: "1px solid #e2e2ea", borderRadius: "6px",
                padding: "5px 10px", fontSize: "11.5px", fontWeight: "600", cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
            <button
              onClick={onEdit}
              title={`Edit ${product.name}`}
              style={{
                background: "none", border: "1px solid #c7cbf5", color: "#4c51bf", borderRadius: "6px",
                padding: "5px 10px", fontSize: "11.5px", fontWeight: "700", cursor: "pointer",
              }}
            >
              ✏️ Edit
            </button>
            <button
              onClick={onConfirm}
              title={`Delete ${product.name}`}
              style={{
                background: "none", border: "1px solid #fca5a5", color: "#dc2626", borderRadius: "6px",
                padding: "5px 10px", fontSize: "11.5px", fontWeight: "700", cursor: "pointer",
              }}
            >
              🗑️ Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CategorySection({ category, products, confirmingId, deletingId, setConfirmingId, onDelete, onEdit, searchValue, onSearchChange, stockEdit, onStockEdit }) {
  const meta = CATEGORY_META[category] || { icon: "📦", label: category };
  // Header totals reflect the whole category, not just the search results -
  // searching narrows what's shown in the table below, it shouldn't make
  // the category's own revenue/units numbers look smaller.
  const totalRevenue = products.reduce((sum, p) => sum + (Number(p.revenue) || 0), 0);
  const totalUnits = products.reduce((sum, p) => sum + (p.units_sold ?? 0), 0);

  const visibleProducts = searchValue.trim()
    ? products.filter(p => p.name.toLowerCase().includes(searchValue.trim().toLowerCase()))
    : products;

  return (
    <div style={{ marginBottom: "28px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{
            width: "30px", height: "30px", borderRadius: "9px", background: meta.gradient,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px",
          }}>
            {meta.icon}
          </span>
          <span style={{ fontSize: "15.5px", fontWeight: "800", color: "#1a1a2e" }}>{meta.label}</span>
          <span style={{ fontSize: "12px", color: "#aaa" }}>({products.length} item{products.length === 1 ? "" : "s"})</span>
        </div>
        <div style={{ fontSize: "12.5px", color: "#888" }}>
          {totalUnits} units sold · <span style={{ fontWeight: "700", color: "#333" }}>₹{Math.round(totalRevenue).toLocaleString()}</span> revenue
        </div>
      </div>

      <div style={{ position: "relative", marginBottom: "12px" }}>
        <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "13px", color: "#aaa" }}>🔍</span>
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={`Search ${meta.label.toLowerCase()} products...`}
          style={{
            width: "100%", padding: "9px 14px 9px 36px", borderRadius: "10px",
            border: "1px solid #e2e2ea", fontSize: "13px", color: "#333",
            background: "white", boxSizing: "border-box", outline: "none",
          }}
        />
      </div>

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
          <span>Sub-category</span>
          <span>Units Sold</span>
          <span>Revenue</span>
          <span>Price</span>
          <span>Stock</span>
          <span />
        </div>

        {products.length === 0 ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#aaa", fontSize: "13px" }}>
            No {meta.label.toLowerCase()} products yet.
          </div>
        ) : visibleProducts.length === 0 ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#aaa", fontSize: "13px" }}>
            No {meta.label.toLowerCase()} products matching "{searchValue.trim()}".
          </div>
        ) : (
          visibleProducts.map(product => (
            <ProductRow
              key={product.id}
              product={product}
              isConfirming={confirmingId === product.id}
              deletingId={deletingId}
              onConfirm={() => setConfirmingId(product.id)}
              onCancel={() => setConfirmingId(null)}
              onDelete={onDelete}
              onEdit={() => onEdit(product.id)}
              stockEdit={stockEdit}
              onStockEdit={onStockEdit}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function AdminProducts() {
  const navigate = useNavigate();
  // Set by the Edit form after a save ("... was updated.").
  const flash = useLocation().state?.flash;
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmingId, setConfirmingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchByCategory, setSearchByCategory] = useState({ food: "", beauty: "", toys: "" });
  const [editingStockId, setEditingStockId] = useState(null);
  const [stockDraft, setStockDraft] = useState("");
  const [savingStockId, setSavingStockId] = useState(null);

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

  const handleExportAll = () => {
    downloadFile("/api/products/export", "all_products.xlsx")
      .catch(() => setError("Could not export products. Please make sure the server is running."));
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

  const stockEdit = { editingId: editingStockId, draft: stockDraft, savingId: savingStockId };
  const onStockEdit = {
    start: (product) => {
      setEditingStockId(product.id);
      setStockDraft(product.stock === null ? "" : String(product.stock));
    },
    setDraft: setStockDraft,
    cancel: () => setEditingStockId(null),
    save: async (id) => {
      // Blank input means "clear it" - back to untracked/unlimited, not 0.
      const stock = stockDraft.trim() === "" ? null : parseInt(stockDraft, 10);
      if (stock !== null && (isNaN(stock) || stock < 0)) {
        setError("Stock must be a whole number, 0 or higher.");
        return;
      }
      setSavingStockId(id);
      try {
        const response = await fetch(`http://localhost:5000/api/products/${id}/stock`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Password": sessionStorage.getItem("admin_password") || "",
          },
          body: JSON.stringify({ stock }),
        });
        const data = await response.json();
        if (data.success) {
          setProducts(prev => prev.map(p => p.id === id
            ? { ...p, stock, is_low_stock: stock !== null && stock <= 5 }
            : p));
          setEditingStockId(null);
        } else {
          setError(data.error || "Could not update stock.");
        }
      } catch (err) {
        setError("Connection error while updating stock.");
      } finally {
        setSavingStockId(null);
      }
    },
  };

  const foodProducts = products.filter(p => p.category === "food");
  const beautyProducts = products.filter(p => p.category === "beauty");
  const toysProducts = products.filter(p => p.category === "toys");

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
          <button onClick={() => navigate("/admin/products/bulk")} style={{
            background: "white", border: "1px solid #c7cbf5", borderRadius: "8px", padding: "8px 16px",
            fontSize: "13px", fontWeight: "700", color: "#4c51bf", cursor: "pointer",
          }}>
            ⬆️ Bulk Upload
          </button>
          <button onClick={handleExportAll} style={{
            background: "none", border: "1px solid #e2e2ea", borderRadius: "8px", padding: "8px 16px",
            fontSize: "13px", fontWeight: "700", color: "#666", cursor: "pointer",
          }}>
            ⬇ Export all
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
            Food, beauty, and toys shown separately, since they're not comparable by raw units sold or revenue.
          </p>
        </div>
      </div>

      <div style={{ padding: "28px 40px 60px", maxWidth: "1000px", margin: "0 auto" }}>
        {flash && (
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "12px", padding: "14px 18px", marginBottom: "20px", fontSize: "13.5px", color: "#15803d", fontWeight: "600" }}>
            ✅ {flash}
          </div>
        )}
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "12px", padding: "14px 18px", marginBottom: "20px", fontSize: "13.5px", color: "#b91c1c" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#aaa", fontSize: "13px" }}>Loading...</div>
        ) : products.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#aaa", fontSize: "13px", background: "white", borderRadius: "16px", border: "1px solid #eee" }}>
            No products yet. <a href="/admin/products/new" style={{ color: "#667eea", fontWeight: "600" }}>Add your first one →</a>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: "22px" }}>
              <label style={{ fontSize: "11px", fontWeight: "700", color: "#999", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "6px" }}>
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  padding: "9px 14px", borderRadius: "10px", border: "1px solid #e2e2ea",
                  fontSize: "13.5px", fontWeight: "600", color: "#333", background: "white",
                  outline: "none", cursor: "pointer", minWidth: "200px",
                }}
              >
                <option value="all">All ({products.length})</option>
                <option value="food">🍽️ Food ({foodProducts.length})</option>
                <option value="beauty">💄 Beauty ({beautyProducts.length})</option>
                <option value="toys">🧸 Toys ({toysProducts.length})</option>
              </select>
            </div>

            {(categoryFilter === "all" || categoryFilter === "food") && (
              <CategorySection
                category="food"
                products={foodProducts}
                confirmingId={confirmingId}
                deletingId={deletingId}
                setConfirmingId={setConfirmingId}
                onDelete={handleDelete}
                onEdit={(id) => navigate(`/admin/products/${id}/edit`)}
                searchValue={searchByCategory.food}
                onSearchChange={(value) => setSearchByCategory(prev => ({ ...prev, food: value }))}
                stockEdit={stockEdit}
                onStockEdit={onStockEdit}
              />
            )}
            {(categoryFilter === "all" || categoryFilter === "beauty") && (
              <CategorySection
                category="beauty"
                products={beautyProducts}
                confirmingId={confirmingId}
                deletingId={deletingId}
                setConfirmingId={setConfirmingId}
                onDelete={handleDelete}
                onEdit={(id) => navigate(`/admin/products/${id}/edit`)}
                searchValue={searchByCategory.beauty}
                onSearchChange={(value) => setSearchByCategory(prev => ({ ...prev, beauty: value }))}
                stockEdit={stockEdit}
                onStockEdit={onStockEdit}
              />
            )}
            {(categoryFilter === "all" || categoryFilter === "toys") && (
              <CategorySection
                category="toys"
                products={toysProducts}
                confirmingId={confirmingId}
                deletingId={deletingId}
                setConfirmingId={setConfirmingId}
                onDelete={handleDelete}
                onEdit={(id) => navigate(`/admin/products/${id}/edit`)}
                searchValue={searchByCategory.toys}
                onSearchChange={(value) => setSearchByCategory(prev => ({ ...prev, toys: value }))}
                stockEdit={stockEdit}
                onStockEdit={onStockEdit}
              />
            )}
          </>
        )}

        <p style={{ fontSize: "12px", color: "#aaa", marginTop: "12px" }}>
          Showing {products.length} product{products.length === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}
