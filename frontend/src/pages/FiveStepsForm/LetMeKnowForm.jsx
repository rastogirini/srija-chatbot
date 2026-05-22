/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/incompatible-library */
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { NAVIGATION } from "../../constants/navigation";

export default function LetMeKnowForm() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({
    defaultValues: {
      dailyTraffic: "",
      organisationType: "",
      integrationDate: "",
      integrationPreference: "Shopify",
      services: [],
    },
  });

  const services = watch("services") || [];

  const submit = (data) => {
    // normalize services: react-hook-form returns [] of checked values
    console.log("Form submit", data);
    navigate(NAVIGATION.THIRD);
    // if (onNext) onNext(data);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: `linear-gradient(180deg, #2f855a 0%, #1f7a4a 100%)`,
      }}
    >
      <div className="w-full max-w-3xl p-4 mx-auto">
        <form
          onSubmit={handleSubmit(submit)}
          className="bg-white rounded-md shadow-xl px-20 py-4 relative ring-2 ring-transparent"
          aria-label="Let me know you form"
        >
          <div className="text-center text-sm text-gray-500 mb-4">
            Step 2 of 5
          </div>

          <h2 className="text-2xl font-semibold text-center mb-1">
            Let me know you
          </h2>
          <p className="text-center text-sm text-gray-500 mb-6">
            Provide me some basic information
          </p>

          <div className="grid grid-cols-1 gap-4">
            <label className="flex flex-col">
              <span className="text-sm font-medium mb-1">Daily Traffic</span>
              <input
                type="text"
                placeholder="100 Users"
                className={`input input-bordered border border-gray-200 rounded-md w-full ${
                  errors.dailyTraffic ? "input-error" : ""
                }`}
                {...register("dailyTraffic", {
                  required: "Daily traffic is required",
                })}
                aria-invalid={errors.dailyTraffic ? "true" : "false"}
              />
              {errors.dailyTraffic && (
                <span className="text-xs text-error mt-1">
                  {errors.dailyTraffic.message}
                </span>
              )}
            </label>

            <label className="flex flex-col">
              <span className="text-sm font-medium mb-1">
                Organisation Type
              </span>
              <select
                className={`select select-bordered border border-gray-200 rounded-md w-full ${
                  errors.organisationType ? "select-error" : ""
                }`}
                {...register("organisationType", {
                  required: "Organisation type is required",
                })}
                aria-invalid={errors.organisationType ? "true" : "false"}
              >
                <option value="">Organisation Type</option>
                <option>Startup</option>
                <option>SMB</option>
                <option>Enterprise</option>
                <option>Agency</option>
              </select>
              {errors.organisationType && (
                <span className="text-xs text-error mt-1">
                  {errors.organisationType.message}
                </span>
              )}
            </label>

            <label className="flex flex-col ">
              <span className="text-sm font-medium mb-1">Integration Date</span>
              <input
                type="date"
                className={`input input-bordered w-full border border-gray-200 rounded-md ${
                  errors.integrationDate ? "input-error" : ""
                }`}
                {...register("integrationDate", {
                  required: "Integration date required",
                })}
              />
              {errors.integrationDate && (
                <span className="text-xs text-error mt-1">
                  {errors.integrationDate.message}
                </span>
              )}
            </label>

            <fieldset className="">
              <legend className="text-sm font-medium mb-2">
                Integration Preferences:
              </legend>
              <div className="flex gap-4 items-center">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="Shopify"
                    {...register("integrationPreference", { required: true })}
                    className="radio border border-gray-200 rounded-full"
                  />
                  <span className="text-sm">Shopify</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="ServiceNow"
                    {...register("integrationPreference")}
                    className="radio border border-gray-200 rounded-full"
                  />
                  <span className="text-sm">Service Now</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="SalesForce"
                    {...register("integrationPreference")}
                    className="radio border border-gray-200 rounded-full"
                  />
                  <span className="text-sm">SalesForce</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="Others"
                    {...register("integrationPreference")}
                    className="radio border border-gray-200 rounded-full"
                  />
                  <span className="text-sm">Others</span>
                </label>
              </div>
            </fieldset>

            <fieldset className="">
              <legend className="text-sm font-medium mb-2">
                Service Required :
              </legend>

              <div className="flex gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    value="WhatsappBot"
                    {...register("services")}
                    className="checkbox border border-gray-200 rounded-md"
                    defaultChecked
                  />
                  <span className="text-sm">WatsApp Bot</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    value="WebsiteBot"
                    {...register("services")}
                    className="checkbox border border-gray-200 rounded-md"
                  />
                  <span className="text-sm">Website Bot</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    value="Others"
                    {...register("services")}
                    className="checkbox border border-gray-200 rounded-md"
                  />
                  <span className="text-sm">Others</span>
                </label>
              </div>
            </fieldset>
          </div>

          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => navigate(NAVIGATION.FIRST)}
              className="btn btn-ghost border"
            >
              Back
            </button>
            <button type="submit" className="btn btn-outline">
              Next
            </button>
          </div>

          {/* Decorative/brand image shown as an absolutely positioned element to mimic the design */}
          {/* <img
            src={"/mnt/data/eaa08fd8-51c8-4108-9c6d-9f081ebdad2b.png"}
            alt="decorative hero"
            className="pointer-events-none select-none absolute -top-12 right-6 w-48 opacity-80 hidden md:block"
            aria-hidden
          /> */}
        </form>
      </div>
    </div>
  );
}
