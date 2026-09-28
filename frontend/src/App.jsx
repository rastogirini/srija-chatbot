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
import AdminHome from "./pages/Admin/Home";
import AdminDashboard from "./pages/Admin/Dashboard";
import AdminCustomerDetail from "./pages/Admin/CustomerDetail";
import AdminAddProduct from "./pages/Admin/AddProduct";
import AdminProducts from "./pages/Admin/Products";
import AdminOrders from "./pages/Admin/Orders";
import AdminReservations from "./pages/Admin/Reservations";
import RequireAdmin from "./pages/Admin/RequireAdmin";

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

            {/* Admin - signs in via the same "/" form as customers; role='admin'
                on the customer row routes here instead of persona-select.
                /admin is a hub of cards (Customers/Revenue, Products) rather
                than jumping straight to one section, now that there's more
                than one thing to manage. */}
            <Route path="/admin" element={<RequireAdmin><AdminHome /></RequireAdmin>} />
            <Route path="/admin/customers" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
            <Route path="/admin/customers/:id" element={<RequireAdmin><AdminCustomerDetail /></RequireAdmin>} />
            <Route path="/admin/products/new" element={<RequireAdmin><AdminAddProduct /></RequireAdmin>} />
            <Route path="/admin/products" element={<RequireAdmin><AdminProducts /></RequireAdmin>} />
            <Route path="/admin/orders" element={<RequireAdmin><AdminOrders /></RequireAdmin>} />
            <Route path="/admin/reservations" element={<RequireAdmin><AdminReservations /></RequireAdmin>} />

            <Route path={NAVIGATION.FIRST} element={<LandingHero />} />
            {/* ... rest of routes ... */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </div>
  );
}

export default App;
