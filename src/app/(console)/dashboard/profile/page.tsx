import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/shell/page-header";
import { ProfileForm } from "@/components/me/profile-form";
import { getEffectiveProfile, getEffectiveRecord } from "@/lib/auth/impersonation";
import type { Donor } from "@/lib/db/types";

export const metadata: Metadata = { title: "Profile" };

export default async function DashboardProfile() {
  const [e, record] = await Promise.all([getEffectiveProfile(), getEffectiveRecord()]);
  const donor = (record.donor ?? null) as Donor | null;

  return (
    <>
      <PageHeader
        title="Profile"
        subtitle={
          donor
            ? "This is what the desk reads when you arrive. Keeping it current means the screening is quicker and nothing has to be asked twice."
            : "You do not have a donor record yet. Filling this in once means every camp after this one already knows you."
        }
      />
      <Panel className="p-5 sm:p-6">
        <ProfileForm donor={donor} email={e?.profile.email ?? ""} />
      </Panel>
    </>
  );
}
