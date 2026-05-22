import {
  BadgeQuestionMark,
  ChartNoAxesCombined,
  Logs,
  UserRoundCog,
} from "lucide-react";
import { useState } from "react";
import Card from "../../components/common/Card";

const UserManagement = () => {
  const [isOpen, setIsOpen] = useState(false);

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }
  return (
    <>
      <div>
        <h1 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Your Services
        </h1>
        <p className="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
          Manage and organize your services data
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 md:gap-6">
        <Card
          cardIcon={
            <UserRoundCog className="text-gray-800 size-6 dark:text-white/90" />
          }
          isOpen={isOpen}
          toggleDropdown={toggleDropdown}
          closeDropdown={closeDropdown}
          cardTitle="User Management"
          cardSubTitle="3782"
          dropdownValues={[
            "View Users",
            "View Users Info",
            "View User Conversational History",
          ]}
        />
        <Card
          cardIcon={
            <Logs className="text-gray-800 size-6 dark:text-white/90" />
          }
          isOpen={isOpen}
          toggleDropdown={toggleDropdown}
          closeDropdown={closeDropdown}
          cardTitle="Conversational Logs"
          cardSubTitle="Our history together"
          dropdownValues={[
            "View Past Chats",
            "Filter by User/Date",
            "Export Chats",
          ]}
        />
        <Card
          cardIcon={
            <ChartNoAxesCombined className="text-gray-800 size-6 dark:text-white/90" />
          }
          isOpen={isOpen}
          toggleDropdown={toggleDropdown}
          closeDropdown={closeDropdown}
          cardTitle="Performance Monitoring"
          cardSubTitle="Check the analytics"
          dropdownValues={[
            "Daily/Weekly usage count",
            "Number of Queries answered/unanswered",
          ]}
        />
        <Card
          cardIcon={
            <BadgeQuestionMark className="text-gray-800 size-6 dark:text-white/90" />
          }
          isOpen={isOpen}
          toggleDropdown={toggleDropdown}
          closeDropdown={closeDropdown}
          cardTitle="FAQ Management"
          cardSubTitle="Config faq here"
          dropdownValues={["Add/Edit/Delete Q&A pair", "Update Bot Response"]}
        />
      </div>
    </>
  );
};

export default UserManagement;
