"use server";

import { requireAdmin } from "@/lib/auth/dal";
import { chat, type ChatMessage, type ChatResult } from "@/lib/ai/chat";

/**
 * One assistant turn.
 *
 * A server action rather than a route handler: the tools underneath read the
 * caller's Supabase session from cookies, and an action already has it. It also
 * means there is no public endpoint to find — the only way in is through a page
 * that `requireAdmin` has already gated.
 */
export async function askAssistant(
  history: ChatMessage[],
  question: string,
): Promise<ChatResult> {
  await requireAdmin();
  const q = question.trim();
  if (!q) return { ok: false, error: "Ask something." };
  if (q.length > 2000) return { ok: false, error: "That question is too long." };
  return chat(history, q);
}
