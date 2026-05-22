import { useNavigate } from "react-router";
import LandingPageBot from "../assets/landingPageBot.png";
import Srigen_logo from "../assets/srigen_logo.png";
import { NAVIGATION } from "../constants/navigation";

export default function LandingHero() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-green-600 to-green-800">
      <div className="w-full max-w-5xl">
        <div
          className="relative bg-white rounded-lg shadow-2xl overflow-hidden ring-4 ring-blue-300"
          role="region"
          aria-label="Hero section"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Left column: text */}
            <div className="md:col-span-7 p-8 md:p-12">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl" aria-hidden>
                  👋
                </span>
                <h2 className="text-xl font-semibold">Hey !!</h2>
              </div>

              <h1 className="text-3xl md:text-4xl font-extrabold leading-tight mb-4">
                I’m <span className="text-green-700">Srija</span>, your AI
                assistant for every need!
              </h1>

              <p className="text-gray-600 mb-6">
                Friendly Conversations. Professional Solutions.
              </p>

              <div className="flex items-center gap-4">
                <button
                  className="btn text-white rounded-md bg-linear-to-br from-green-600 to-green-800"
                  aria-label="Connect with Srija"
                  onClick={() => navigate(NAVIGATION.SECOND)}
                >
                  Connect with Srija
                </button>
              </div>
            </div>

            {/* Right column: illustration */}
            <div className="md:col-span-5 p-8 flex items-center justify-center">
              <div className="w-56 h-56 md:w-72 md:h-72 flex items-center justify-center">
                <img
                  src={LandingPageBot}
                  alt="Cute robot illustration"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>

          {/* bottom-right small brand */}
          <div className="absolute h-7 bottom-4 right-6 flex items-center gap-2 text-sm text-gray-500">
            <img
              src={Srigen_logo}
              alt="Srigen logo"
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
