# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Code might be useful
{/* <!-- Metric Item Start --> */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3 md:p-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center font-medium dark:text-gray-400">
            AstraTech
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
                className="px-2! flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
              >
                <Info className="me-2" size={20} />
                View Details
              </DropdownItem>
              <DropdownItem
                onItemClick={closeDropdown}
                className="px-2! flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
              >
                <SquarePen className="me-2" size={20} /> Edit Workspace
              </DropdownItem>
              <DropdownItem
                onItemClick={closeDropdown}
                className="px-2! flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
              >
                <SquareX className="me-2 text-red-500" size={20} />{" "}
                <span className="text-red-500">Delete Workspace</span>
              </DropdownItem>
            </Dropdown>
          </div>
        </div>
        <div className="flex items-end justify-between mt-2">
          <span className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
            A cutting-edge technology consulting firm specializing in cloud
            modernization and enterprise automation.
          </span>
        </div>
        <div className="flex items-center justify-between mt-4 text-gray-800 text-sm dark:text-white/90">
          <div className="flex items-center justify-between">
            <Settings className="inline me-2 text-success-500" size={16} />
            <span className="text-xs">2 Service</span>
          </div>
          <div className="flex items-center justify-between">
            <ToolCase className="inline me-2 text-success-500" size={16} />
            <span className="text-xs">4 Tool</span>
          </div>
          <div className="flex items-center justify-between">
            <Users className="inline me-2 text-success-500" size={16} />
            <span className="text-xs">10 User</span>
          </div>
        </div>
        <div
          className="mt-4 -ml-1.5 cursor-pointer"
          onClick={() => console.log("GotoServices")}
        >
          <Badge color="primary" size="md">
            Go to service
            <ArrowRightIcon size={18} />
          </Badge>
        </div>
      </div>
      {/* <!-- Metric Item End --> */}