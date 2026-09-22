import { PageSkeleton } from "@/components/shell/skeleton";

/**
 * Shown the instant a link in the dashboard section is clicked, while the page's
 * own data is fetched. It is the difference between a console that answers a
 * click and one that appears to have ignored it.
 */
export default function Loading() {
  return <PageSkeleton />;
}
