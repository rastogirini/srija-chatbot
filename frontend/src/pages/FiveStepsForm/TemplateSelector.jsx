import { useState } from "react";
import { useNavigate } from "react-router";
import template_one from "../../assets/template_one.png";
import template_two from "../../assets/template_two.png";
import { NAVIGATION } from "../../constants/navigation";

export default function TemplateSelector({ initial = 1 }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(initial);

  const templates = [
    {
      id: 1,
      title: "Template A",
      img: template_one,
    },
    {
      id: 2,
      title: "Template B",
      img: template_two,
    },
  ];

  function handleKeySelect(e, id) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelected(id);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-linear-to-br from-green-600 to-green-800">
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-xl p-8">
        <div className="text-center text-sm text-gray-500 mb-6">
          Step 3 of 5
        </div>
        <div className="flex items-center mb-6 px-10">
          <h3 className="text-lg font-semibold text-gray-800 me-6">
            Organization Type
          </h3>
          <div className="">
            <input
              type="text"
              readOnly
              value="Restaurant"
              className="input input-bordered border border-gray-200 rounded-md w-80 text-green-600 font-semibold"
              aria-label="Organization Type"
            />
          </div>
        </div>

        <h4 className="text-lg font-medium mb-8 px-10">Template Options</h4>

        <div
          role="radiogroup"
          aria-label="Template options"
          className="flex flex-col md:flex-row gap-6 items-center justify-center"
        >
          {templates.map((t) => {
            const isSelected = selected === t.id;
            return (
              <div
                key={t.id}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onKeyDown={(e) => handleKeySelect(e, t.id)}
                onClick={() => setSelected(t.id)}
                className={`relative w-72 h-56 rounded-lg p-3 cursor-pointer transition-shadow focus:outline-none focus:ring-2 ${
                  isSelected
                    ? "ring-2 ring-green-700 border-2 border-green-600"
                    : "ring-2 ring-transparent border-2 border-gray-800"
                }`}
              >
                <div className="absolute -top-5 left-3 bg-white px-3 py-1 rounded-full text-sm font-medium shadow">
                  {t.title}
                </div>

                <div className="w-full h-full bg-white rounded-md overflow-hidden flex items-center justify-center">
                  <img
                    src={t.img}
                    alt={`${t.title} preview`}
                    className="object-cover w-full h-full"
                  />
                </div>

                {/* Visible focus ring for keyboard users */}
                <span className="sr-only">
                  {isSelected
                    ? `${t.title} selected`
                    : `${t.title} not selected`}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => navigate(NAVIGATION.SECOND)}
            className="btn btn-ghost border"
          >
            Back
          </button>
          <button
            onClick={() => navigate(NAVIGATION.FOURTH)}
            className="btn btn-outline px-10 py-3 text-lg"
            aria-label="Proceed with selected template"
          >
            Proceed
          </button>
        </div>
      </div>
    </div>
  );
}
