import { Route, Routes } from "react-router";
import "./App.css";
import { NAVIGATION } from "./constants/navigation";
import AppLayout from "./layout/AppLayout";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import PersonaSelect from "./pages/PersonaSelect";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import LetMeKnowForm from "./pages/FiveStepsForm/LetMeKnowForm";
import PlanSelector from "./pages/FiveStepsForm/PlanSelector";
import SignUpForm from "./pages/FiveStepsForm/SignUpForm";
import TemplateSelector from "./pages/FiveStepsForm/TemplateSelector";
import LandingHero from "./pages/LandingHero";
import NotFound from "./pages/OtherPage/NotFound";
import FloatingChatbot from "./components/FloatingChatbot";

function App() {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0 -z-10 h-full w-full items-center px-5 py-24" />
        <Routes>
            <Route index path="/" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/select-persona" element={<PersonaSelect />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
            </Route>
            
            {/* Chat without sidebar */}
            <Route path="/chat" element={<Chat />} />
            
            <Route path={NAVIGATION.FIRST} element={<LandingHero />} />
            {/* ... rest of routes ... */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </div>
  );
}

export default App;
