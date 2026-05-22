import { useState } from "react";
import { useNavigate } from "react-router";
import WorkSpaceCard from "./WorkSpaceCard";

const ServicesList = () => {
  const navigate = useNavigate();
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const workspaces = [
    {
      id: 1,
      title: "Astra Tech",
      description:
        "A cutting-edge technology consulting firm specializing in cloud modernization and enterprise automation.",
      serviceCount: 2,
      toolCount: 4,
      userCount: 10,
    },
    {
      id: 2,
      title: "Blue Peak",
      description:
        "A cutting-edge technology consulting firm specializing in cloud modernization and enterprise automation.",
      serviceCount: 4,
      toolCount: 2,
      userCount: 15,
    },
    {
      id: 3,
      title: "Nova Core",
      description:
        "A cutting-edge technology consulting firm specializing in cloud modernization and enterprise automation.",
      serviceCount: 3,
      toolCount: 3,
      userCount: 19,
    },
    {
      id: 4,
      title: "Silver Line",
      description:
        "A cutting-edge technology consulting firm specializing in cloud modernization and enterprise automation.",
      serviceCount: 1,
      toolCount: 1,
      userCount: 5,
    },
  ];

  const handleDropdownToggle = (workspaceId) => {
    setOpenDropdownId(openDropdownId === workspaceId ? null : workspaceId);
  };
  const closeAllDropdowns = () => {
    setOpenDropdownId(null);
  };
  const handleViewDetails = (workspaceId) => {
    console.log("View details for workspace:", workspaceId);
  };

  const handleEdit = (workspaceId) => {
    console.log("Edit workspace:", workspaceId);
  };

  const handleDelete = (workspaceId) => {
    console.log("Delete workspace:", workspaceId);
  };

  const handleGoToService = (workspaceId) => {
    navigate("/chat");
    console.log("Go to service for workspace:", workspaceId);
  };
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 md:gap-6">
      {workspaces.map((workspace) => (
        <WorkSpaceCard
          key={workspace.id}
          workspace={workspace}
          isDropdownOpen={openDropdownId === workspace.id}
          onDropdownToggle={() => handleDropdownToggle(workspace.id)}
          onDropdownClose={closeAllDropdowns}
          onViewDetails={() => handleViewDetails(workspace.id)}
          onEdit={() => handleEdit(workspace.id)}
          onDelete={() => handleDelete(workspace.id)}
          onGoToService={() => handleGoToService(workspace.id)}
        />
      ))}
    </div>
  );
};

export default ServicesList;
