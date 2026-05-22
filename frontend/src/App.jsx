import { Route, Routes } from "react-router";
import "./App.css";
import { NAVIGATION } from "./constants/navigation";
import AppLayout from "./layout/AppLayout";
import SignIn from "./pages/AuthPages/SignIn";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import LetMeKnowForm from "./pages/FiveStepsForm/LetMeKnowForm";
import PlanSelector from "./pages/FiveStepsForm/PlanSelector";
import SignUpForm from "./pages/FiveStepsForm/SignUpForm";
import TemplateSelector from "./pages/FiveStepsForm/TemplateSelector";
import LandingHero from "./pages/LandingHero";
import NotFound from "./pages/OtherPage/NotFound";

function App() {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0 -z-10 h-full w-full items-center px-5 py-24" />
      <Routes>
        {/* Auth signin Layout */}
        <Route index path="/" element={<SignIn />} />
        {/* Dashboard Layout */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
        </Route>
        {/* Demo Connect Pages */}
        <Route path={NAVIGATION.FIRST} element={<LandingHero />} />
        <Route path={NAVIGATION.SECOND} element={<LetMeKnowForm />} />
        <Route path={NAVIGATION.THIRD} element={<TemplateSelector />} />
        <Route path={NAVIGATION.FOURTH} element={<PlanSelector />} />
        <Route path={NAVIGATION.FIFTH} element={<SignUpForm />} />
        {/* <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          {/* Add more protected routes here 
        </Route> */}

        {/* Fallback Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

export default App;
