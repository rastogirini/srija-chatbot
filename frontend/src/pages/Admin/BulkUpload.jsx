import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";

const API = "http://localhost:5000";
const TEMPLATE_COLUMNS = ["category", "name", "price", "description", "subcategory", "cuisine", "diet", "course", "stock", "image_file"];

const STATUS_STYLES = {
  ok: { label: "✅ Ready", color: "#15803d", bg: "#f0fdf4", border: "#86efac" },
  warning: { label: "⚠️ Warning", color: "#b45309", bg: "#fffbeb", border: "#fcd34d" },
  duplicate: { label: "⏭️ Duplicate", color: "#6b7280", bg: "#f3f4f6", border: "#d1d5db" },
  error: { label: "❌ Error", color: "#b91c1c", bg: "#fef2f2", border: "#fca5a5" },
};

const cardStyle = {
  background: "white", borderRadius: "16px", padding: "22px 24px", marginBottom: "20px",
  boxShadow: "0 4px 20px rgba(30,30,60,0.07)", border: "1px solid #eee",
};

const stepTitleStyle = { fontSize: "14.5px", fontWeight: "800", color: "#1a1a2e", margin: "0 0 4px" };
const stepHintStyle = { fontSize: "12.5px", color: "#888", margin: "0 0 14px" };

const secondaryButton = {
  background: "white", border: "1px solid #e2e2ea", borderRadius: "8px", padding: "8px 14px",
  fontSize: "13px", fontWeight: "700", color: "#4c51bf", cursor: "pointer",
};

const primaryButton = (disabled) => ({
  border: "none", borderRadius: "10px", padding: "11px 20px", fontSize: "13.5px", fontWeight: "700",
  color: "white", cursor: disabled ? "default" : "pointer",
  background: disabled ? "#c7cbf5" : "linear-gradient(135deg, #667eea, #4c51bf)",
});

const adminHeaders = () => ({ "X-Admin-Password": sessionStorage.getItem("admin_password") || "" });

// Spreadsheet downloads go through fetch (not a plain <a href>) because
// the endpoints need the admin header - then hand the blob to the browser.
export async function downloadFile(path, fallbackName) {
  const response = await fetch(`${API}${path}`, { headers: adminHeaders() });
  if (!response.ok) throw new Error("Download failed");
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/);
  saveBlob(await response.blob(), match ? match[1] : fallbackName);
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function FilePickBox({ icon, title, subtitle, accept, multiple, onFiles, inputRef }) {
  const [isDragging, setIsDragging] = useState(false);
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        onFiles(Array.from(e.dataTransfer.files || []));
      }}
      style={{
        flex: 1, border: `2px dashed ${isDragging ? "#667eea" : "#d8d8e6"}`, borderRadius: "12px",
        background: isDragging ? "#f5f6fe" : "#faf9fc", padding: "22px 16px", textAlign: "center",
        cursor: "pointer", transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <div style={{ fontSize: "26px", marginBottom: "6px" }}>{icon}</div>
      <div style={{ fontSize: "13px", fontWeight: "700", color: "#444" }}>{title}</div>
      <div style={{ fontSize: "12px", color: "#888", marginTop: "3px" }}>{subtitle}</div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => { onFiles(Array.from(e.target.files || [])); e.target.value = ""; }}
        style={{ display: "none" }}
      />
    </div>
  );
}

export default function AdminBulkUpload() {
  const navigate = useNavigate();
  const sheetInputRef = useRef(null);
  const imagesInputRef = useRef(null);

  const [spreadsheet, setSpreadsheet] = useState(null);
  const [images, setImages] = useState([]);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [batches, setBatches] = useState([]);

  const handleLogout = () => {
    sessionStorage.removeItem("admin_password");
    navigate("/");
  };

  const loadBatches = () => {
    fetch(`${API}/api/products/import-batches`, { headers: adminHeaders() })
      .then(r => r.json())
      .then(data => { if (data.success) setBatches(data.batches); })
      .catch(() => {});
  };

  useEffect(loadBatches, []);

  // Local thumbnails for the preview table, keyed the same way the backend
  // matches photos to rows (lowercased filename) - so what the shopkeeper
  // sees here is exactly the photo that will be saved with that row.
  const thumbnails = useMemo(() => {
    const map = {};
    images.forEach(file => {
      const key = file.name.toLowerCase();
      if (!map[key]) map[key] = URL.createObjectURL(file);
    });
    return map;
  }, [images]);

  useEffect(() => () => Object.values(thumbnails).forEach(URL.revokeObjectURL), [thumbnails]);

  const pickSpreadsheet = (files) => {
    const file = files.find(f => /\.(csv|xlsx)$/i.test(f.name));
    if (!file) {
      setError("Please choose a .csv or .xlsx file.");
      return;
    }
    setError("");
    setSpreadsheet(file);
    setPreview(null);
    setResult(null);
  };

  const pickImages = (files) => {
    const picked = files.filter(f => f.type.startsWith("image/"));
    // Adding more photos merges with what's already selected (a second
    // folder, a forgotten photo) rather than replacing it.
    setImages(prev => {
      const names = new Set(prev.map(f => f.name.toLowerCase()));
      return [...prev, ...picked.filter(f => !names.has(f.name.toLowerCase()))];
    });
    setPreview(null);
    setResult(null);
  };

  const submit = async (mode) => {
    setError("");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("spreadsheet", spreadsheet);
      images.forEach(file => formData.append("images", file));
      const response = await fetch(`${API}/api/products/bulk?mode=${mode}`, {
        method: "POST",
        headers: adminHeaders(),
        body: formData,
      });
      const data = await response.json();
      if (!data.success) {
        setError(data.error || "Something went wrong.");
        return;
      }
      if (mode === "preview") {
        setPreview(data);
      } else {
        setResult(data);
        setPreview(null);
        loadBatches();
      }
    } catch (err) {
      setError("Connection error. Please make sure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setSpreadsheet(null);
    setImages([]);
    setPreview(null);
    setResult(null);
    setError("");
  };

  // The skipped rows exactly as the shopkeeper wrote them, plus why each was
  // skipped - fix them in Excel and upload just this file again.
  const downloadSkipped = (rows) => {
    const skipped = rows.filter(r => r.status === "error" || r.status === "duplicate");
    const lines = [
      [...TEMPLATE_COLUMNS, "problem"].join(","),
      ...skipped.map(r => [...TEMPLATE_COLUMNS.map(c => csvCell(r.raw[c])), csvCell(r.messages.join("; "))].join(",")),
    ];
    saveBlob(new Blob(["﻿" + lines.join("\n")], { type: "text/csv" }), "skipped_rows.csv");
  };

  const tryDownload = (path, name) => downloadFile(path, name).catch(() => setError("Download failed - is the server running?"));

  const importable = preview ? preview.summary.ok + preview.summary.warning : 0;
  const skippedCount = (summary) => summary.error + summary.duplicate;

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
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <button onClick={() => navigate("/admin/products")} style={{
            background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: "999px", color: "white", fontSize: "12px", fontWeight: "700",
            cursor: "pointer", padding: "5px 12px", marginBottom: "10px",
          }}>
            ← Back to Products
          </button>
          <h1 style={{ fontSize: "19px", fontWeight: "800", margin: 0 }}>⬆️ Bulk Upload</h1>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "12.5px", margin: "2px 0 0" }}>
            Add a whole shipment at once - one spreadsheet row per product, plus all the photos.
          </p>
        </div>
      </div>

      <div style={{ padding: "28px 40px 60px", maxWidth: "1000px", margin: "0 auto" }}>
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "12px", padding: "14px 18px", marginBottom: "20px", fontSize: "13.5px", color: "#b91c1c" }}>
            {error}
          </div>
        )}

        {result ? (
          <div style={{ ...cardStyle, background: "#f0fdf4", border: "1px solid #86efac" }}>
            <div style={{ fontSize: "16px", fontWeight: "800", color: "#15803d", marginBottom: "4px" }}>
              ✅ {result.added} product{result.added === 1 ? "" : "s"} added
            </div>
            <div style={{ fontSize: "13px", color: "#166534", marginBottom: "14px" }}>
              {skippedCount(result.summary) > 0
                ? `${skippedCount(result.summary)} row${skippedCount(result.summary) === 1 ? " was" : "s were"} skipped - download them to fix and upload again.`
                : "Every row was imported. They're live on the site now."}
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button onClick={() => navigate("/admin/products")} style={primaryButton(false)}>View Products</button>
              {skippedCount(result.summary) > 0 && (
                <button onClick={() => downloadSkipped(result.rows)} style={secondaryButton}>⬇ Download skipped rows</button>
              )}
              <button onClick={startOver} style={secondaryButton}>Upload another file</button>
            </div>
          </div>
        ) : (
          <>
            <div style={cardStyle}>
              <h2 style={stepTitleStyle}>1. Get the template</h2>
              <p style={stepHintStyle}>
                One row per product. The second sheet, "Allowed values", lists the exact spellings for
                category, subcategory, cuisine, diet and course. Put each photo's filename in the image_file column.
              </p>
              <button onClick={() => tryDownload("/api/products/bulk/template", "product_upload_template.xlsx")} style={secondaryButton}>
                ⬇ Download template (.xlsx)
              </button>
            </div>

            <div style={cardStyle}>
              <h2 style={stepTitleStyle}>2. Upload the spreadsheet and photos</h2>
              <p style={stepHintStyle}>Nothing is saved yet - you'll see a check of every row first.</p>
              <div style={{ display: "flex", gap: "14px" }}>
                <FilePickBox
                  icon="📄"
                  title={spreadsheet ? spreadsheet.name : "Choose spreadsheet"}
                  subtitle={spreadsheet ? "Click to choose a different file" : ".csv or .xlsx - drag here or click"}
                  accept=".csv,.xlsx"
                  multiple={false}
                  onFiles={pickSpreadsheet}
                  inputRef={sheetInputRef}
                />
                <FilePickBox
                  icon="🖼️"
                  title={images.length ? `${images.length} photo${images.length === 1 ? "" : "s"} selected` : "Choose photos"}
                  subtitle={images.length ? "Click to add more" : "Select them all at once (Ctrl+A in the folder)"}
                  accept="image/*"
                  multiple
                  onFiles={pickImages}
                  inputRef={imagesInputRef}
                />
              </div>
              {images.length > 0 && (
                <button onClick={() => { setImages([]); setPreview(null); }} style={{ ...secondaryButton, color: "#888", marginTop: "10px", fontSize: "12px", padding: "6px 12px" }}>
                  Clear photos
                </button>
              )}
              <div style={{ marginTop: "16px" }}>
                <button onClick={() => submit("preview")} disabled={!spreadsheet || loading} style={primaryButton(!spreadsheet || loading)}>
                  {loading && !preview ? "Checking..." : "Check file"}
                </button>
              </div>
            </div>

            {preview && (
              <div style={cardStyle}>
                <h2 style={stepTitleStyle}>3. Review and import</h2>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "10px 0 16px" }}>
                  {[
                    ["ok", `${preview.summary.ok} ready`],
                    ["warning", `${preview.summary.warning} with warnings (will import)`],
                    ["duplicate", `${preview.summary.duplicate} duplicate${preview.summary.duplicate === 1 ? "" : "s"} (skipped)`],
                    ["error", `${preview.summary.error} error${preview.summary.error === 1 ? "" : "s"} (skipped)`],
                  ].filter(([key]) => preview.summary[key] > 0).map(([key, text]) => (
                    <span key={key} style={{
                      fontSize: "12.5px", fontWeight: "700", padding: "5px 12px", borderRadius: "999px",
                      color: STATUS_STYLES[key].color, background: STATUS_STYLES[key].bg, border: `1px solid ${STATUS_STYLES[key].border}`,
                    }}>
                      {text}
                    </span>
                  ))}
                </div>

                <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: "10px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: "#faf9fc", textAlign: "left", color: "#888", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {["Row", "Photo", "Name", "Category", "Price", "Stock", "Status"].map(h => (
                          <th key={h} style={{ padding: "10px 12px", fontWeight: "700" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map(row => {
                        const style = STATUS_STYLES[row.status];
                        const thumb = row.image_file && thumbnails[row.image_file];
                        return (
                          <tr key={row.row} style={{ borderTop: "1px solid #f0f0f4", verticalAlign: "top" }}>
                            <td style={{ padding: "10px 12px", color: "#aaa" }}>{row.row}</td>
                            <td style={{ padding: "8px 12px" }}>
                              {thumb ? (
                                <img src={thumb} alt="" style={{ width: "40px", height: "40px", borderRadius: "6px", objectFit: "cover" }} />
                              ) : (
                                <div style={{ width: "40px", height: "40px", borderRadius: "6px", background: "#f3f3f7", display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc" }}>—</div>
                              )}
                            </td>
                            <td style={{ padding: "10px 12px", fontWeight: "600", color: "#333" }}>{row.raw.name || <span style={{ color: "#ccc" }}>(blank)</span>}</td>
                            <td style={{ padding: "10px 12px", color: "#666" }}>{row.raw.category}</td>
                            <td style={{ padding: "10px 12px", color: "#666" }}>{row.raw.price}</td>
                            <td style={{ padding: "10px 12px", color: "#666" }}>{row.raw.stock || "∞"}</td>
                            <td style={{ padding: "10px 12px", minWidth: "220px" }}>
                              <span style={{ fontSize: "11.5px", fontWeight: "700", color: style.color }}>{style.label}</span>
                              {row.messages.map((m, i) => (
                                <div key={i} style={{ fontSize: "12px", color: style.color, marginTop: "3px", opacity: 0.9 }}>{m}</div>
                              ))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "18px", flexWrap: "wrap", alignItems: "center" }}>
                  <button onClick={() => submit("commit")} disabled={importable === 0 || loading} style={primaryButton(importable === 0 || loading)}>
                    {loading ? "Importing..." : `Import ${importable} product${importable === 1 ? "" : "s"}`}
                  </button>
                  {skippedCount(preview.summary) > 0 && (
                    <button onClick={() => downloadSkipped(preview.rows)} style={secondaryButton}>⬇ Download skipped rows</button>
                  )}
                  <button onClick={startOver} style={{ ...secondaryButton, color: "#888" }}>Start over</button>
                </div>
              </div>
            )}
          </>
        )}

        <div style={cardStyle}>
          <h2 style={stepTitleStyle}>🕘 Import History</h2>
          <p style={stepHintStyle}>
            Uploaded files aren't stored - Download rebuilds each one from its products, with today's price and stock.
          </p>
          {batches.length === 0 ? (
            <div style={{ fontSize: "13px", color: "#aaa", padding: "8px 0" }}>No bulk uploads yet.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#888", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {["Date", "File", "Added", "Skipped", "Still live", ""].map(h => (
                    <th key={h} style={{ padding: "8px 10px", fontWeight: "700" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batches.map(batch => (
                  <tr key={batch.id} style={{ borderTop: "1px solid #f0f0f4" }}>
                    <td style={{ padding: "10px", color: "#666", whiteSpace: "nowrap" }}>
                      {new Date(batch.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td style={{ padding: "10px", fontWeight: "600", color: "#333" }}>{batch.filename}</td>
                    <td style={{ padding: "10px", color: "#15803d", fontWeight: "700" }}>{batch.added_count}</td>
                    <td style={{ padding: "10px", color: batch.skipped_count ? "#b91c1c" : "#aaa" }}>{batch.skipped_count}</td>
                    <td style={{ padding: "10px", color: "#666" }}>{batch.live_count} / {batch.added_count}</td>
                    <td style={{ padding: "10px", textAlign: "right" }}>
                      <button
                        onClick={() => tryDownload(`/api/products/import-batches/${batch.id}/export`, `import_${batch.id}.xlsx`)}
                        style={{ ...secondaryButton, padding: "6px 12px", fontSize: "12px" }}
                      >
                        ⬇ Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
