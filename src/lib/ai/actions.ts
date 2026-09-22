"use server";

import { requireAdmin, requireUser } from "@/lib/auth/dal";
import { chat, type ChatMessage, type ChatResult } from "@/lib/ai/chat";

/**
 * What the assistant is told when a donor is asking rather than an
 * administrator. It cannot widen what they can read — RLS decides that — so
 * this only sets the tone and stops the model offering console actions the
 * person has no way to perform.
 */
const DONOR_BRIEF = [
  "You are helping a blood donor with their own record on BlooDoc.",
  "You can only see this donor's own details and the publicly listed camps.",
  "Answer about their registrations, their certificates, and when and where the next camps are.",
  "Never give medical advice; eligibility is decided by the medical officer at the camp.",
  "If you are asked about other donors or about running the camps, say that is not something you can see.",
].join(" ");

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

/**
 * The donor's own assistant.
 *
 * Same model, same tools, different gate and a different brief. The tools all
 * query through the caller's session, so RLS is what scopes them — a donor
 * asking "find donors" gets their own row and nothing else, because
 * `donors_select_self` is the only policy that matches them. The separation is
 * therefore real rather than a prompt asking the model to behave.
 */
export async function askDonorAssistant(
  history: ChatMessage[],
  question: string,
): Promise<ChatResult> {
  await requireUser();
  const q = question.trim();
  if (!q) return { ok: false, error: "Ask something." };
  if (q.length > 2000) return { ok: false, error: "That question is too long." };
  return chat(history, q, DONOR_BRIEF);
}
