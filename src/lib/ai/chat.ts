import "server-only";

import { TOOL_DEFS, runTool } from "@/lib/ai/tools";

/**
 * Assistant configuration.
 *
 * Read from the environment on every call rather than captured at module load,
 * so rotating the key does not need a redeploy. `SARVAM_API_KEY` is never
 * referenced outside this file and is not prefixed `NEXT_PUBLIC_`, so it cannot
 * reach a client bundle, and nothing exported here lets a caller read it back.
 *
 * The endpoint is OpenAI-compatible, so any such provider works by pointing
 * `SARVAM_BASE_URL` elsewhere; the variable names match the sibling console so
 * one `.env` serves both.
 *
 * `SARVAM_SYSTEM_MESSAGE` is deliberately **not** read. The instructions below
 * carry rules about not giving medical advice and not telling anyone they are
 * eligible to donate, and those are not an environment knob — a value copied
 * across from another project would silently replace them, and the first sign
 * would be the assistant telling a donor they are cleared to give blood.
 */
function config() {
  const apiKey = process.env.SARVAM_API_KEY?.trim() ?? "";
  return {
    apiKey,
    configured: apiKey.length > 0,
    baseUrl: process.env.SARVAM_BASE_URL?.trim() || "https://api.sarvam.ai/v1",
    model: process.env.SARVAM_MODEL_ID?.trim() || "sarvam-105b",
    temperature: Number(process.env.SARVAM_TEMPERATURE ?? 0.4),
    topP: Number(process.env.SARVAM_TOP_P ?? 1),
    maxTokens: Number(process.env.SARVAM_MAX_TOKENS ?? 2048),
  };
}

export function isAssistantConfigured(): boolean {
  return config().configured;
}

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  /**
   * The model's own working-out, when it reports any.
   *
   * Kept apart from `content` rather than concatenated: it is not the answer,
   * it is how the answer was reached, and it belongs behind a disclosure the
   * reader opens only when they want to check the reasoning. Never sent back
   * in the history either — the model does not need to re-read its own
   * scratchpad, and it would double the cost of every subsequent turn.
   */
  reasoning?: string;
};

type WireMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

/**
 * The instructions above every conversation.
 *
 * Worth being clear about what this does and does not achieve. It shapes tone
 * and stops the model volunteering things. It is not what keeps donor data
 * safe — that is the tool layer, which runs under the caller's own RLS session.
 * Treat every line here as a preference the model may ignore under a determined
 * prompt, and never move a security property into it.
 */
const SYSTEM = `You are the BlooDoc console assistant. You help the people running blood donation camps read their own records.

Rules:
- Answer only from the tools. If a tool returns nothing, say so. Never estimate a number.
- Be brief. A count is a sentence, not a paragraph.
- Never give medical advice and never say whether a person is eligible to donate. That is the medical officer's decision at the camp, and you say so if asked.
- Donor details are confidential. Give names and contacts when the organiser asks for them, and do not volunteer a phone number that was not asked for.
- You can draft an email, but you cannot send one. Say that the organiser sends it from the Camps page.
- Today's date is ${new Date().toISOString().slice(0, 10)}.`;

const MAX_TOOL_ROUNDS = 4;

export type ChatResult =
  | { ok: true; reply: string; reasoning?: string }
  | { ok: false; error: string };

/**
 * One turn, including any tool calls it needs.
 *
 * The loop is bounded at four rounds. A model that keeps asking for one more
 * tool result is a model that has misunderstood the question, and the honest
 * outcome is a short apology rather than a request that runs until it times out.
 */
export async function chat(
  history: ChatMessage[],
  question: string,
  /**
   * Appended to the system prompt when the asker is not an administrator.
   * It sets tone and expectations only — what can actually be read is decided
   * by RLS against the caller's session, not by anything written here.
   */
  brief?: string,
): Promise<ChatResult> {
  const c = config();
  if (!c.configured) {
    return { ok: false, error: "The assistant is not configured (SARVAM_API_KEY)." };
  }

  const messages: WireMessage[] = [
    { role: "system", content: brief ? `${SYSTEM}\n\n${brief}` : SYSTEM },
    // Only the last few turns. The whole point of this assistant is short
    // factual exchanges, and an unbounded history is how a cheap request
    // becomes an expensive one without anybody noticing.
    ...history.slice(-8).map((m) =>
      m.role === "assistant"
        ? ({ role: "assistant", content: m.content } as WireMessage)
        : ({ role: "user", content: m.content } as WireMessage),
    ),
    { role: "user", content: question },
  ];

  const reasoning: string[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let res: Response;
    try {
      res = await fetch(`${c.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${c.apiKey}`,
        },
        body: JSON.stringify({
          model: c.model,
          messages,
          tools: TOOL_DEFS,
          // Low by default. This assistant reports counts and names out of a
          // database; a creative one invents a donor.
          temperature: c.temperature,
          top_p: c.topP,
          max_tokens: c.maxTokens,
        }),
      });
    } catch {
      return { ok: false, error: "Could not reach the assistant." };
    }

    if (!res.ok) {
      // The provider's body can carry the API key back in an echoed request;
      // it never reaches the browser. The status is enough to act on.
      return { ok: false, error: `The assistant returned ${res.status}.` };
    }

    const data = (await res.json().catch(() => null)) as {
      choices?: {
        message?: {
          content?: string | null;
          tool_calls?: ToolCall[];
          // Reasoning models return their scratchpad under one of two names
          // depending on the provider; neither is in the OpenAI spec, so both
          // are read and a model that sends neither simply has none.
          reasoning_content?: string | null;
          reasoning?: string | null;
        };
      }[];
    } | null;

    const message = data?.choices?.[0]?.message;
    if (!message) return { ok: false, error: "The assistant sent back nothing usable." };

    // Accumulated across rounds: a tool-using turn reasons before each call,
    // and showing only the last round's thinking would hide the step where it
    // decided which records to look at.
    const thought = message.reasoning_content ?? message.reasoning;
    if (thought?.trim()) reasoning.push(thought.trim());

    const calls = message.tool_calls ?? [];
    if (!calls.length) {
      const reply = (message.content ?? "").trim();
      return reply
        ? { ok: true, reply, reasoning: reasoning.join("\n\n") || undefined }
        : { ok: false, error: "The assistant sent back an empty answer." };
    }

    messages.push({ role: "assistant", content: message.content ?? null, tool_calls: calls });

    for (const call of calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        // A model that emits malformed JSON gets told so and can retry, which
        // is better than failing the whole turn on a stray comma.
        args = {};
      }
      const result = await runTool(call.function.name, args);
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }

  return {
    ok: false,
    error: "That took too many steps. Try asking for one thing at a time.",
  };
}
