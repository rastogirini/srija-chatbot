import AuthLayout from "./AuthPageLayout";
import SignInForm from "./SignInForm";

export default function SignIn() {
  return (
    <>
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
