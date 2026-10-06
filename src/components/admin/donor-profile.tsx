import { DetailList, type DetailItem } from "@/components/shell/detail-list";
import { formatCampDate } from "@/lib/format";
import { relationLine } from "@/lib/validations/donor";
import type { Donor } from "@/lib/db/types";

/**
 * Everything on file about one donor, as the console's popups show it.
 *
 * One component for the Donors page and the Certificates page, so the two
 * never disagree about what a donor's record says or where to find a field.
 * Laid out three to a row with the long values given the width they need,
 * rather than one per line — the donor popup used to scroll past a screen of
 * mostly empty space to reach the phone number.
 *
 * No hooks: rendered by Server Components.
 */
export function DonorProfile({ donor: d }: { donor: Donor }) {
  const sameAddress = !!d.permanent_address && d.permanent_address === d.address;
  return (
    <div className="flex flex-col gap-3">
      <DetailList
        heading="About"
        items={[
          ["Sex", <span key="s" className="capitalize">{d.sex}</span>],
          ["Age", d.age],
          ["Date of birth", d.date_of_birth ? formatCampDate(d.date_of_birth) : null],
          ["Father / mother / spouse", relationLine(d), { span: 2 }],
          ["Blood group", d.blood_group === "unknown" ? "Not known" : d.blood_group],
        ]}
      />
      <DetailList
        heading="Work"
        items={
          d.kind === "other"
            ? [
                ["They are", "Other"],
                ["Occupation", d.occupation, { span: 2 }],
              ]
            : ([
                ["They are", <span key="k" className="capitalize">{d.kind}</span>],
                ["School", d.school, { span: 2 }],
                ["Department", d.department, { wide: true }],
              ] as DetailItem[])
        }
      />
      <DetailList
        heading="Contact"
        items={[
          ["Phone", d.phone],
          ["Alternate phone", d.alt_phone],
          ["Email", d.email],
          ["Residential address", d.address, { wide: true }],
          ["Permanent address", sameAddress ? "Same as residential" : d.permanent_address, { wide: true }],
        ]}
      />
      <DetailList
        heading="As a donor"
        items={[
          ["Donations before BlooDoc", d.prior_donations],
          ["Account", d.profile_id ? "Signed in at least once" : "No account (paper slip)"],
          ["On file since", formatCampDate(d.created_at)],
          ...(d.notes ? ([["Notes", d.notes, { wide: true }]] as DetailItem[]) : []),
        ]}
      />
    </div>
  );
}
