const Label = ({ htmlFor, children, className }) => {
  return (
    <label
      htmlFor={htmlFor}
      className={`${className} mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400`}
    >
      {children}
    </label>
  );
};

export default Label;
