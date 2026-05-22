import { useState } from "react";
import { useNavigate } from "react-router";
import template_three from "../../assets/template_three.png";
import { NAVIGATION } from "../../constants/navigation";

export default function PlanSelector({ initial = "free" }) {
  const navigate = useNavigate();
  const [plan, setPlan] = useState(initial);

  function handleKey(e, value) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setPlan(value);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-linear-to-br from-green-600 to-green-800">
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-xl p-12 pt-8">
        <div className="text-center text-sm text-gray-500 mb-6">
          Step 4 of 5
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-lg font-medium">Plan Options:</label>
            <div className="mt-3 flex gap-4">
              {/* Free */}
              <div
                role="radio"
                aria-checked={plan === "free"}
                tabIndex={0}
                onClick={() => setPlan("free")}
                onKeyDown={(e) => handleKey(e, "free")}
                className={`w-30 h-20 rounded-md cursor-pointer flex items-center justify-center p-2 text-sm text-center select-none transition-shadow focus:outline-none focus:ring-2 ${
                  plan === "free"
                    ? "border-2 border-green-600 ring-2 ring-green-200"
                    : "border border-gray-300"
                }`}
              >
                <div>
                  <div className="font-semibold">Free</div>
                  <div className="text-xs text-gray-500">
                    (for 10 Days only)
                  </div>
                </div>
              </div>

              {/* Paid */}
              <div
                role="radio"
                aria-checked={plan === "paid"}
                tabIndex={0}
                onClick={() => setPlan("paid")}
                onKeyDown={(e) => handleKey(e, "paid")}
                className={`w-30 h-20 rounded-md cursor-pointer flex items-center justify-center p-2 text-sm text-center select-none transition-shadow focus:outline-none focus:ring-2 ${
                  plan === "paid"
                    ? "border-2 border-green-600 ring-2 ring-green-200"
                    : "border border-gray-300"
                }`}
              >
                <div className="font-semibold">Paid</div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-lg font-medium">Template Preview</label>
            <div className="mt-4 w-72 h-64 p-3 border border-gray-200 rounded-md shadow-sm bg-white">
              <img
                src={template_three}
                alt="template preview"
                className="w-full h-full object-cover rounded"
              />
            </div>
          </div>
        </div>
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => navigate(NAVIGATION.THIRD)}
            className="btn btn-ghost border"
          >
            Back
          </button>

          <button
            type="button"
            onClick={() => navigate(NAVIGATION.FIFTH)}
            className="btn btn-outline"
            aria-label="Proceed with selected plan"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
