import { useState, useRef } from "react";
import { useNavigate } from "react-router";

const CUISINES = ["italian", "indian", "chinese"];
const DIET_TAGS = ["vegetarian", "vegan", "gluten-free"];
const COURSES = ["appetizer", "main", "dessert", "bread", "salad"];
const SUBCATEGORIES = ["lipstick", "foundation", "skincare", "fragrance"];

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #e2e2ea",
  fontSize: "13.5px",
  color: "#333",
  boxSizing: "border-box",
  outline: "none",
  fontFamily: "inherit",
};

const labelStyle = {
  fontSize: "12px",
  fontWeight: "700",
  color: "#555",
  marginBottom: "5px",
  display: "block",
};

export default function AdminAddProduct() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [category, setCategory] = useState("food");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [dietTags, setDietTags] = useState([]);
  const [course, setCourse] = useState("");
  const [subcategory, setSubcategory] = useState("");

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  const handleLogout = () => {
    sessionStorage.removeItem("admin_password");
    navigate("/");
  };

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const toggleDiet = (tag) => {
    setDietTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const resetForm = () => {
    setName(""); setPrice(""); setDescription("");
    setCuisine(""); setDietTags([]); setCourse(""); setSubcategory("");
    setImageFile(null); setImagePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(null);

    if (!name.trim() || !price) {
      setError("Name and price are required.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("category", category);
      formData.append("name", name.trim());
      formData.append("price", price);
      formData.append("description", description.trim());
      if (category === "food") {
        if (cuisine) formData.append("cuisine", cuisine);
        if (dietTags.length > 0) formData.append("diet", dietTags.join(","));
        if (course) formData.append("course", course);
      } else {
        if (subcategory) formData.append("subcategory", subcategory);
      }
      if (imageFile) formData.append("image", imageFile);

      const response = await fetch("http://localhost:5000/api/products", {
        method: "POST",
        headers: { "X-Admin-Password": sessionStorage.getItem("admin_password") || "" },
        body: formData,
      });
      const data = await response.json();

      if (data.success) {
        setSuccess({ name: name.trim(), image: data.image });
        resetForm();
      } else {
        setError(data.error || "Could not save the product.");
      }
    } catch (err) {
      setError("Connection error. Please make sure the server is running.");
    } finally {
      setLoading(false);
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
        <button onClick={handleLogout} style={{
          background: "none", border: "1px solid #e2e2ea", borderRadius: "8px", padding: "8px 16px",
          fontSize: "13px", fontWeight: "600", color: "#666", cursor: "pointer",
        }}>
          Log out
        </button>
      </nav>

      <div style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "18px 40px", color: "white",
      }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <button onClick={() => navigate("/admin/products")} style={{
            background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: "999px", color: "white", fontSize: "12px", fontWeight: "700",
            cursor: "pointer", padding: "5px 12px", marginBottom: "10px",
          }}>
            ← Back to Products
          </button>
          <h1 style={{ fontSize: "19px", fontWeight: "800", margin: 0 }}>📦 Add a New Product</h1>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "12.5px", margin: "2px 0 0" }}>
            Upload a photo and the details - it'll be saved for real.
          </p>
        </div>
      </div>

      <div style={{ padding: "28px 40px 60px", maxWidth: "900px", margin: "0 auto" }}>
        {success && (
          <div style={{
            background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "12px",
            padding: "14px 18px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "12px",
          }}>
            {success.image && (
              <img src={`http://localhost:5000${success.image}`} alt="" style={{ width: "44px", height: "44px", borderRadius: "8px", objectFit: "cover" }} />
            )}
            <div style={{ fontSize: "13.5px", color: "#15803d", fontWeight: "600" }}>
              ✅ "{success.name}" was saved successfully.
            </div>
          </div>
        )}
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "12px", padding: "14px 18px", marginBottom: "20px", fontSize: "13.5px", color: "#b91c1c" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{
          background: "white", borderRadius: "16px", padding: "26px",
          boxShadow: "0 4px 20px rgba(30,30,60,0.07)", border: "1px solid #eee",
          display: "grid", gridTemplateColumns: "260px 1fr", gap: "28px",
        }}>
          {/* Image upload */}
          <div>
            <label style={labelStyle}>Product Photo</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFile(e.dataTransfer.files?.[0]);
              }}
              style={{
                border: `2px dashed ${isDragging ? "#667eea" : "#d8d8e6"}`,
                borderRadius: "12px",
                background: isDragging ? "#f5f6fe" : "#faf9fc",
                aspectRatio: "1 / 1",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                textAlign: "center",
                padding: "16px",
                overflow: "hidden",
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "8px" }} />
              ) : (
                <>
                  <div style={{ fontSize: "28px", marginBottom: "8px" }}>🖼️</div>
                  <div style={{ fontSize: "12.5px", color: "#888", fontWeight: "600" }}>
                    Drag an image here,<br />or click to browse
                  </div>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e.target.files?.[0])}
              style={{ display: "none" }}
            />
            {imagePreview && (
              <button
                type="button"
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                style={{
                  marginTop: "8px", width: "100%", background: "none", border: "1px solid #e2e2ea",
                  borderRadius: "8px", padding: "6px", fontSize: "12px", fontWeight: "600", color: "#888", cursor: "pointer",
                }}
              >
                Remove photo
              </button>
            )}
          </div>

          {/* Details */}
          <div>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Category</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {[{ key: "food", label: "🍽️ Food" }, { key: "beauty", label: "💄 Beauty" }].map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setCategory(opt.key)}
                    style={{
                      flex: 1, padding: "10px", borderRadius: "9px", cursor: "pointer",
                      fontSize: "13.5px", fontWeight: "700",
                      border: category === opt.key ? "2px solid #667eea" : "1px solid #e2e2ea",
                      background: category === opt.key ? "#f5f6fe" : "white",
                      color: category === opt.key ? "#4c51bf" : "#666",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={labelStyle}>Product Name</label>
                <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Paneer Tikka" />
              </div>
              <div>
                <label style={labelStyle}>Price (₹)</label>
                <input style={inputStyle} type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="299" />
              </div>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle}>Description</label>
              <textarea
                style={{ ...inputStyle, resize: "vertical", minHeight: "60px" }}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short, appealing description customers will see"
              />
            </div>

            {category === "food" ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                  <div>
                    <label style={labelStyle}>Cuisine</label>
                    <select style={inputStyle} value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
                      <option value="">Select...</option>
                      {CUISINES.map(c => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Course</label>
                    <select style={inputStyle} value={course} onChange={(e) => setCourse(e.target.value)}>
                      <option value="">Select...</option>
                      {COURSES.map(c => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Diet</label>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {DIET_TAGS.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleDiet(tag)}
                        style={{
                          padding: "6px 12px", borderRadius: "999px", cursor: "pointer", fontSize: "12px", fontWeight: "700",
                          border: dietTags.includes(tag) ? "1.5px solid #0ca678" : "1px solid #e2e2ea",
                          background: dietTags.includes(tag) ? "#e6fcf5" : "white",
                          color: dietTags.includes(tag) ? "#0ca678" : "#888",
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label style={labelStyle}>Product Type</label>
                <select style={inputStyle} value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
                  <option value="">Select...</option>
                  {SUBCATEGORIES.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "20px", width: "100%", padding: "12px", borderRadius: "10px", border: "none",
                background: loading ? "#c7cbf5" : "linear-gradient(135deg, #667eea, #4c51bf)",
                color: "white", fontWeight: "700", fontSize: "14px", cursor: loading ? "default" : "pointer",
              }}
            >
              {loading ? "Saving..." : "Save Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
