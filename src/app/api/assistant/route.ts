import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/auth/dal";
import { chatStream, type ChatEvent, type ChatMessage } from "@/lib/ai/chat";

/**
 * The assistant turn, streamed.
 *
 * This was a server action, and the trade is worth stating. An action has no
 * public URL to find, which was the reason for choosing one; what it cannot do
 * is hand back a partial answer, so the thinking only appeared once the whole
 * turn was over and the panel sat on a spinner for ten seconds saying nothing.
 * Watching the model work is most of what makes it feel answerable.
 *
 * The gate is unchanged in substance: `getProfile()` is the same check
 * `requireAdmin()` makes, and the tools underneath still run on the caller's
 * own Supabase session, so RLS decides what can be read. What this endpoint
 * adds over the action is a URL — and an unauthenticated request to it gets a
 * 401 before a single token is spent.
 */

export const runtime = "nodejs";
/** Never cached, never prerendered: every answer is about live records. */
export const dynamic = "force-dynamic";

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

const bodySchema = z.object({
  question: z.string().trim().min(1, "Ask something.").max(2000, "That question is too long."),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .max(20)
    .default([]),
  /**
   * The console path the question was asked from.
   *
   * A hint, not an authorisation: it only picks which paragraph of page notes
   * goes into the prompt. Somebody posting `/admin/users` from a donor account
   * gets the description of a page they still cannot read a single row of.
   * Capped and required to look like a path so it cannot be used to append
   * arbitrary text to the system prompt.
   */
  pathname: z
    .string()
    .max(200)
    .regex(/^\/[\w\-/[\]]*$/, "Not a path.")
    .nullish(),
});

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ask something." },
      { status: 400 },
    );
  }
  const { question, history, pathname } = parsed.data;

  // Which brief, decided from the role in the database rather than from
  // anything the page claimed about itself.
  const brief = profile.role === "admin" ? undefined : DONOR_BRIEF;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: ChatEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        for await (const event of chatStream(history as ChatMessage[], question, {
          brief,
          pathname,
        })) {
          send(event);
        }
      } catch (e) {
        console.error("[assistant] stream failed", e);
        send({ type: "error", message: "The assistant stopped part way through." });
      } finally {
        controller.close();
      }
    },
  });

  // NDJSON rather than `text/event-stream`: the client reads it with a plain
  // reader and a line split, and there is no reconnection semantics here worth
  // inheriting — a dropped turn is re-asked, not resumed.
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      // Proxies that buffer are what turn a streamed answer back into a wait.
      "X-Accel-Buffering": "no",
    },
  });
}
