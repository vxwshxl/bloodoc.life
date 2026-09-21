import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { Assistant } from "@/components/admin/assistant";
import { isAssistantConfigured } from "@/lib/ai/chat";

export const metadata: Metadata = { title: "Assistant" };

export default function AssistantPage() {
  return (
    <>
      <PageHeader
        title="Assistant"
        subtitle="Asks your roster, not the internet. Read-only: it can draft an email, you send it."
      />
      <Assistant configured={isAssistantConfigured()} />
    </>
  );
}
