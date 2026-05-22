import UserManagement from "../UserManagement";
import Workspaces from "../Workspaces";

export default function Dashboard() {
  return (
    <div className="grid grid-cols-12 gap-4 md:gap-2">
      <div className="col-span-12 xl:col-span-12">
        <Workspaces />
      </div>
      <div className="col-span-12 space-y-6 xl:col-span-12">
        <UserManagement />
      </div>
    </div>
  );
}
