import {
  Info,
  Settings,
  SquarePen,
  SquareX,
  ToolCase,
  Users,
} from "lucide-react";
import Badge from "../../components/elements/Badge";
import { Dropdown } from "../../components/elements/Dropdown";
import { DropdownItem } from "../../components/elements/DropdownItem";
import { ArrowRightIcon, MoreDotIcon } from "../../components/icons";

const WorkSpaceCard = ({
  workspace,
  isDropdownOpen,
  onDropdownToggle,
  onDropdownClose,
  onGoToService,
  onViewDetails,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3 md:p-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center font-medium dark:text-gray-400">
          {workspace.title}
        </div>
        <div className="relative inline-block">
          <button className="dropdown-toggle" onClick={onDropdownToggle}>
            <MoreDotIcon className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 size-6" />
          </button>
          <Dropdown
            isOpen={isDropdownOpen}
            onClose={onDropdownClose}
            className="w-50 p-2"
          >
            <DropdownItem
              onItemClick={() => {
                onViewDetails();
              }}
              className="px-2! flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              <Info className="me-2" size={20} />
              View Details
            </DropdownItem>
            <DropdownItem
              onItemClick={() => {
                onEdit();
              }}
              className="px-2! flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              <SquarePen className="me-2" size={20} /> Edit Workspace
            </DropdownItem>
            <DropdownItem
              onItemClick={() => {
                onDelete();
              }}
              className="px-2! flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              <SquareX className="me-2 text-red-500" size={20} />
              <span className="text-red-500">Delete Workspace</span>
            </DropdownItem>
          </Dropdown>
        </div>
      </div>

      <div className="flex items-end justify-between mt-2">
        <span className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
          {workspace.description}
        </span>
      </div>

      <div className="flex items-center justify-between mt-4 text-gray-800 text-sm dark:text-white/90">
        <div className="flex items-center justify-between">
          <Settings className="inline me-2 text-success-500" size={16} />
          <span className="text-xs">{workspace.serviceCount} Service</span>
        </div>
        <div className="flex items-center justify-between">
          <ToolCase className="inline me-2 text-success-500" size={16} />
          <span className="text-xs">{workspace.toolCount} Tool</span>
        </div>
        <div className="flex items-center justify-between">
          <Users className="inline me-2 text-success-500" size={16} />
          <span className="text-xs">{workspace.userCount} User</span>
        </div>
      </div>

      <div className="mt-4 -ml-1.5 cursor-pointer" onClick={onGoToService}>
        <Badge color="primary" size="md">
          Go to service
          <ArrowRightIcon size={18} />
        </Badge>
      </div>
    </div>
  );
};

export default WorkSpaceCard;
