import { Link } from "react-router";
import GridShape from "../../components/widgets/GridShape";
import ThemeTogglerTwo from "../../components/widgets/ThemeTogglerTwo";

export default function AuthLayout({ children }) {
  return (
    <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <div className="relative flex flex-col justify-center w-full h-screen lg:flex-row dark:bg-gray-900 sm:p-0">
        {children}
        <div className="items-center hidden w-full h-full lg:w-1/2 bg-brand-950 dark:bg-white/5 lg:grid">
          <div className="relative flex items-center justify-center z-1">
            <GridShape />
            <div className="flex flex-col items-center max-w-xs">
              <Link to="/" className="block mb-4">
                <img
                  width={200}
                  height={40}
                  src="/images/logo/srigen-logo-2.svg"
                  alt="Logo"
                />
              </Link>
              <p className="text-center text-gray-300 dark:text-white/60">
                I’m Srija, your AI assistant for every need!
              </p>
            </div>
          </div>
        </div>
        <div className="fixed z-50 hidden bottom-6 right-6 sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </div>
  );
}
