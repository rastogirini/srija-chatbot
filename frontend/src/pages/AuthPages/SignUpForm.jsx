import { useState } from "react";
import { Link, useNavigate } from "react-router";
import Input from "../../components/elements/InputField";

const INTERESTS = [
  {
    id: "food",
    icon: "🍽️",
    title: "Food",
    subtitle: "DINING, RECIPES, RESERVATIONS",
  },
  {
    id: "beauty",
    icon: "💄",
    title: "Beauty & Makeup",
    subtitle: "SKINCARE, COSMETICS, FRAGRANCE",
  },
  {
    id: "travel",
    icon: "✈️",
    title: "Travel",
    subtitle: "FLIGHTS, HOTELS, GETAWAYS",
  },
  {
    id: "fitness",
    icon: "💪",
    title: "Fitness",
    subtitle: "WORKOUTS, GEAR, NUTRITION",
  },
];

export default function SignUpForm() {
  const navigate = useNavigate();
  const [selectedInterests, setSelectedInterests] = useState(["food"]);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleInterest = (id) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");

    if (!firstName.trim() || !email.trim()) {
      setError("Please enter your name and email.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("http://localhost:5000/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: firstName.trim(), email: email.trim(), interests: selectedInterests }),
      });
      const data = await response.json();

      if (data.success) {
        navigate("/select-persona", { state: { name: data.customer.name, email: data.customer.email, interests: data.customer.interests } });
      } else {
        setError(data.error || "Could not create your account. Please try again.");
      }
    } catch (err) {
      setError("Connection error. Please make sure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full overflow-y-auto">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto py-6">
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span style={{ width: '18px', height: '2px', background: '#d6336c', display: 'inline-block' }}></span>
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#d6336c' }}>
              Get Started
            </span>
          </div>
          <h1 className="mb-1.5 font-bold text-gray-800 dark:text-white/90" style={{ fontSize: '30px' }}>
            Create Your{' '}
            <span style={{
              background: 'linear-gradient(135deg, #4361ee 0%, #d6336c 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Account
            </span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            We'll personalize your experience from the first click.
          </p>
        </div>

        <form onSubmit={handleSignUp}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <Input placeholder="Last name" />
          </div>

          <div className="mb-4">
            <Input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
            What are you interested in?
          </div>

          <div className="flex flex-col gap-2 mb-5">
            {INTERESTS.map((interest) => {
              const isSelected = selectedInterests.includes(interest.id);
              return (
                <button
                  key={interest.id}
                  type="button"
                  onClick={() => toggleInterest(interest.id)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left transition-all ${
                    isSelected
                      ? "border-2 border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                      : "border border-gray-200 bg-white dark:border-gray-700 dark:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-center w-8 h-8 text-base bg-gray-100 rounded-full shrink-0 dark:bg-white/5">
                    {interest.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-800 dark:text-white/90">
                      {interest.title}
                    </div>
                    <div className="text-[10px] tracking-wide text-gray-400 dark:text-gray-500">
                      {interest.subtitle}
                    </div>
                  </div>
                  {isSelected && (
                    <span className="text-lg font-bold text-brand-500">✓</span>
                  )}
                </button>
              );
            })}
          </div>

          {error && (
            <p className="mb-3 text-sm text-error-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-full text-white font-bold text-sm tracking-wide uppercase flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #4361ee 0%, #d6336c 100%)" }}
          >
            {loading ? "Creating account..." : (<>Create Account <span>→</span></>)}
          </button>
        </form>

        <div className="mt-4">
          <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
            Already have an account? {""}
            <Link
              to="/"
              className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
