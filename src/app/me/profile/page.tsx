import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser, getDashboardHref } from "@/lib/auth/dal";
import { getEffectiveProfile, getEffectiveRecord } from "@/lib/auth/impersonation";
import { TopNav } from "@/components/site/top-nav";
import { SiteFooter } from "@/components/site/footer";
import { ViewAsBanner } from "@/components/shell/view-as-banner";
import { Panel } from "@/components/shell/page-header";
import { ProfileForm } from "@/components/me/profile-form";
import type { Donor } from "@/lib/db/types";

export const metadata: Metadata = {
  title: "Your profile",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  await requireUser();
  const [effective, record, dashboardHref] = await Promise.all([
    getEffectiveProfile(),
    getEffectiveRecord(),
    getDashboardHref(),
  ]);

  const donor = (record.donor ?? null) as Donor | null;
  const email = effective?.profile.email ?? "";

  return (
    <>
      <ViewAsBanner />
      <main className="relative z-10 flex flex-1 flex-col bg-background">
        <TopNav activeIndex={null} dashboardHref={dashboardHref} />

        <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
          <Link
            href="/me"
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden />
            Your record
          </Link>

          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Your profile
          </p>
          <h1 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {donor?.full_name ?? "Fill in your details"}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {donor
              ? "This is what the desk reads when you arrive. Keeping it current means the screening is quicker and nothing has to be asked twice."
              : "You do not have a donor record yet. Filling this in once means every camp after this one already knows you."}
          </p>

          <Panel className="mt-8 p-5 sm:p-6">
            <ProfileForm donor={donor} email={email} />
          </Panel>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
