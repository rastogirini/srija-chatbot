import { Navigate } from "react-router";

// Wraps a protected admin route - redirects to the main sign-in page (the
// same form customers use) if no admin password is stashed in this tab's
// sessionStorage. This alone doesn't make the *data* safe (that's
// require_admin on the backend) - it just keeps a logged-out visitor from
// landing on the dashboard UI itself.
export default function RequireAdmin({ children }) {
  const hasAdminPassword = !!sessionStorage.getItem("admin_password");

  if (!hasAdminPassword) {
    return <Navigate to="/" replace />;
  }

  return children;
}
