import { useForm } from "react-hook-form";

export default function SignUpForm({ onFinish }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      organisationName: "",
      name: "",
      mobile: "",
      email: "",
      address: "",
    },
  });

  function onSubmit(data) {
    // simulate OTP/send step or call parent handler
    console.log("Form submitted", data);
    if (onFinish) onFinish(data);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-linear-to-br from-green-600 to-green-800">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-3xl bg-white rounded-md shadow-xl py-8 px-16"
        aria-label="Sign up form"
      >
        <div className="text-center text-sm text-gray-500 mb-4">
          Step 5 of 5
        </div>

        <h2 className="text-xl font-semibold text-center mb-6">Sign Up Form</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <label className="col-span-1 text-sm font-medium">
            Organisation Name
          </label>
          <div className="md:col-span-3">
            <input
              type="text"
              {...register("organisationName", {
                required: "Organisation name is required",
              })}
              className={`input input-bordered border border-gray-200 rounded-md w-full ${
                errors.organisationName ? "input-error" : ""
              }`}
              aria-invalid={errors.organisationName ? "true" : "false"}
            />
            {errors.organisationName && (
              <p className="text-xs text-error mt-1">
                {errors.organisationName.message}
              </p>
            )}
          </div>

          <label className="col-span-1 text-sm font-medium">Name</label>
          <div className="md:col-span-3">
            <input
              type="text"
              {...register("name", { required: "Your name is required" })}
              className={`input input-bordered border border-gray-200 rounded-md w-full ${
                errors.name ? "input-error" : ""
              }`}
              aria-invalid={errors.name ? "true" : "false"}
            />
            {errors.name && (
              <p className="text-xs text-error mt-1">{errors.name.message}</p>
            )}
          </div>

          <label className="col-span-1 text-sm font-medium">Mobile No.</label>
          <div className="md:col-span-3">
            <input
              type="tel"
              inputMode="tel"
              {...register("mobile", {
                required: "Mobile number is required",
                pattern: {
                  value: /^\+?[0-9]{6,15}$/,
                  message: "Enter a valid mobile number",
                },
              })}
              className={`input input-bordered border border-gray-200 rounded-md w-full ${
                errors.mobile ? "input-error" : ""
              }`}
              aria-invalid={errors.mobile ? "true" : "false"}
            />
            <p className="text-xs text-gray-400 mt-1">
              We will send you a OTP here to get started.
            </p>
            {errors.mobile && (
              <p className="text-xs text-error mt-1">{errors.mobile.message}</p>
            )}
          </div>

          <label className="col-span-1 text-sm font-medium">
            Email Address
          </label>
          <div className="md:col-span-3">
            <input
              type="email"
              {...register("email", {
                required: "Email is required",
                pattern: {
                  value: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
                  message: "Enter a valid email",
                },
              })}
              className={`input input-bordered border border-gray-200 rounded-md w-full ${
                errors.email ? "input-error" : ""
              }`}
              aria-invalid={errors.email ? "true" : "false"}
            />
            {errors.email && (
              <p className="text-xs text-error mt-1">{errors.email.message}</p>
            )}
          </div>

          <label className="col-span-1 text-sm font-medium">Address</label>
          <div className="md:col-span-3">
            <input
              type="text"
              {...register("address")}
              className="input input-bordered border border-gray-200 rounded-md w-full"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="submit"
            className="btn btn-outline px-6"
            disabled={isSubmitting}
          >
            Finish
          </button>
        </div>
      </form>
    </div>
  );
}
