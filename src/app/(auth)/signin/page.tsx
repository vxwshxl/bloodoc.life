import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/signin-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your BlooDoc donor record with a code sent to your email.",
  // Nothing to rank for, and an indexed sign-in page competes with the pages
  // that do have something to say.
  robots: { index: false, follow: true },
};

export default function SignInPage() {
  return (
    <AuthShell
      title="Sign in"
      subtitle="No password. We email you a six-digit code and that is the whole of it."
      footer={
        <>
          Never donated with us before?{" "}
          <Link href="/#camp" className="font-medium text-foreground underline underline-offset-4">
            Register for the next camp
          </Link>{" "}
          — that creates your record.
        </>
      }
    >
      <SignInForm />
    </AuthShell>
  );
}
