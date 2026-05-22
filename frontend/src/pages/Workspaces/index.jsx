import { ArrowRightIcon, PlusIcon } from "lucide-react";
import Button from "../../components/elements/Button";
import ServicesList from "./ServicesList";

const Workspaces = () => {
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            Your Workspaces (4)
          </h1>
          <p className="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
            Manage and organize your workspaces
          </p>
        </div>
        <div>
          <Button
            size="sm"
            variant="primary"
            className="text-[16px]! font-medium"
            startIcon={<PlusIcon className="size-5" />}
          >
            Create New Workspace
          </Button>
        </div>
      </div>
      <ServicesList />
      <div className="flex items-center mt-2">
        <button className="text-sm p-2 rounded-lg hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700">
          View All Services <ArrowRightIcon className="ms-1 size-5 inline" />
        </button>
      </div>
    </>
  );
};

export default Workspaces;
