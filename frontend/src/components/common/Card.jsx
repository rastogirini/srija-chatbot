import Badge from "../elements/Badge";
import { Dropdown } from "../elements/Dropdown";
import { DropdownItem } from "../elements/DropdownItem";
import { ArrowRightIcon, MoreDotIcon } from "../icons";

const Card = ({
  cardIcon,
  isOpen,
  toggleDropdown,
  closeDropdown,
  cardTitle,
  cardSubTitle,
  dropdownValues,
}) => {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
          {cardIcon}
          {/* <GroupIcon className="text-gray-800 size-6 dark:text-white/90" /> */}
        </div>
        <div className="relative inline-block">
          <button className="dropdown-toggle" onClick={toggleDropdown}>
            <MoreDotIcon className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 size-6" />
          </button>
          <Dropdown
            isOpen={isOpen}
            onClose={closeDropdown}
            className="w-50 p-2"
          >
            <DropdownItem
              onItemClick={closeDropdown}
              className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              {dropdownValues[0]}
            </DropdownItem>
            <DropdownItem
              onItemClick={closeDropdown}
              className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              {dropdownValues[1]}
            </DropdownItem>
            {dropdownValues[2] && (
              <DropdownItem
                onItemClick={closeDropdown}
                className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
              >
                {dropdownValues[2]}
              </DropdownItem>
            )}
          </Dropdown>
        </div>
      </div>

      <div className="flex items-end justify-between mt-5">
        <div>
          <span className="text-lg font-semibold text-gray-800 dark:text-gray-400">
            {cardTitle}
          </span>
          <h4 className="mt-2 text-gray-500 text-base dark:text-white/90">
            {cardSubTitle}
          </h4>
        </div>
      </div>
      <div className="mt-2 -ml-1">
        <Badge color="success">
          Explore <ArrowRightIcon />
        </Badge>
      </div>
    </div>
  );
};

export default Card;
