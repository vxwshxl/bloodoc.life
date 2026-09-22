import "server-only";

import { TOOL_DEFS, runTool } from "@/lib/ai/tools";
import { pageBrief } from "@/lib/ai/pages";

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
    /**
     * Thinking mode, on by default.
     *
     * Sarvam's reasoning models answer far better on "how many O-negative
     * donors have given before" when they are allowed to work it out, and the
     * working-out is the thing the panel shows. `SARVAM_REASONING_EFFORT=off`
     * turns it off; anything else is passed through as `reasoning_effort`.
     *
     * The variable was already in `.env.local` and was not being read at all,
     * which is why the thinking disclosure almost never appeared.
     */
    reasoningEffort: (process.env.SARVAM_REASONING_EFFORT?.trim() || "high").toLowerCase(),
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
const SYSTEM = `You are the BlooDoc console assistant. You help the people running blood donation camps read their own records, and you know your way around the console itself.

Rules:
- Answer facts about the records only from the tools. If a tool returns nothing, say so. Never estimate a number.
- Questions about the console — what a page is for, what a status means, what a control does — you answer from the page notes below, without calling a tool.
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
 * One piece of a turn, as it happens.
 *
 * `reset` is the interesting one. A model may emit a sentence of preamble and
 * *then* decide to call a tool; that sentence is not the answer, and leaving it
 * on screen above the real reply reads like the assistant said something twice.
 * When a round turns out to have been a tool round, the server says so and the
 * client throws away the text it has drawn so far. Reasoning is never reset —
 * deciding which records to look at is exactly the part worth keeping.
 */
export type ChatEvent =
  | { type: "reasoning"; delta: string }
  | { type: "content"; delta: string }
  | { type: "tool"; name: string }
  | { type: "reset" }
  | { type: "error"; message: string };

export type ChatOptions = {
  /**
   * Appended to the system prompt when the asker is not an administrator.
   * It sets tone and expectations only — what can actually be read is decided
   * by RLS against the caller's session, not by anything written here.
   */
  brief?: string;
  /** The console path the question was asked from, for the page notes. */
  pathname?: string | null;
};

/**
 * Whether this provider accepted `reasoning_effort`.
 *
 * Module-level and deliberately not reset: if the endpoint rejects the
 * parameter once it will reject it every time, and re-learning that on every
 * question would cost a wasted round trip per turn. A restart re-tries it,
 * which is the right cadence for a provider adding support.
 */
let reasoningSupported = true;

function buildMessages(
  history: ChatMessage[],
  question: string,
  opts: ChatOptions,
): WireMessage[] {
  const page = pageBrief(opts.pathname);
  const system = [SYSTEM, opts.brief, page && `Page notes:\n${page}`]
    .filter(Boolean)
    .join("\n\n");

  return [
    { role: "system", content: system },
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
}

async function callProvider(
  c: ReturnType<typeof config>,
  messages: WireMessage[],
  stream: boolean,
): Promise<Response> {
  const send = (withReasoning: boolean) =>
    fetch(`${c.baseUrl}/chat/completions`, {
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
        ...(withReasoning ? { reasoning_effort: c.reasoningEffort } : {}),
        ...(stream ? { stream: true } : {}),
      }),
    });

  const wantsReasoning = reasoningSupported && c.reasoningEffort !== "off";
  const res = await send(wantsReasoning);

  // A provider that does not know the parameter answers 400. Retrying once
  // without it is the difference between "thinking mode is unsupported here"
  // and "the assistant is broken".
  if (res.status === 400 && wantsReasoning) {
    reasoningSupported = false;
    return send(false);
  }
  return res;
}

/**
 * One turn, streamed, including any tool calls it needs.
 *
 * The loop is bounded at four rounds. A model that keeps asking for one more
 * tool result is a model that has misunderstood the question, and the honest
 * outcome is a short apology rather than a request that runs until it times out.
 */
export async function* chatStream(
  history: ChatMessage[],
  question: string,
  opts: ChatOptions = {},
): AsyncGenerator<ChatEvent> {
  const c = config();
  if (!c.configured) {
    yield { type: "error", message: "The assistant is not configured (SARVAM_API_KEY)." };
    return;
  }

  const messages = buildMessages(history, question, opts);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let res: Response;
    try {
      res = await callProvider(c, messages, true);
    } catch {
      yield { type: "error", message: "Could not reach the assistant." };
      return;
    }

    if (!res.ok || !res.body) {
      // The provider's body can carry the API key back in an echoed request;
      // it never reaches the browser. The status is enough to act on.
      yield { type: "error", message: `The assistant returned ${res.status}.` };
      return;
    }

    let content = "";
    const calls: ToolCall[] = [];
    /** Whether anything has been drawn for this round that a tool call invalidates. */
    let drew = false;

    for await (const chunk of sseChunks(res.body)) {
      const delta = chunk?.choices?.[0]?.delta;
      if (!delta) continue;

      // Reasoning models return their scratchpad under one of two names
      // depending on the provider; neither is in the OpenAI spec, so both are
      // read and a model that sends neither simply has none.
      const thought = delta.reasoning_content ?? delta.reasoning;
      if (thought) yield { type: "reasoning", delta: thought };

      if (delta.content) {
        content += delta.content;
        // Leading whitespace only is not an answer. `sarvam-105b` emits a
        // single space before a tool call, and drawing it would flash an empty
        // bubble and then take it back with a reset.
        if (content.trim()) {
          drew = true;
          yield { type: "content", delta: delta.content };
        }
      }

      for (const tc of delta.tool_calls ?? []) {
        const i = tc.index ?? 0;
        const call = (calls[i] ??= {
          id: "",
          type: "function",
          function: { name: "", arguments: "" },
        });
        if (tc.id) call.id = tc.id;
        if (tc.function?.name) call.function.name += tc.function.name;
        if (tc.function?.arguments) call.function.arguments += tc.function.arguments;
      }
    }

    const wanted = calls.filter((c) => c?.function.name);
    if (!wanted.length) {
      if (!content.trim()) {
        yield { type: "error", message: "The assistant sent back an empty answer." };
      }
      return;
    }

    // The text so far was preamble to a tool call, not an answer. Take it back.
    if (drew) yield { type: "reset" };

    messages.push({ role: "assistant", content: content || null, tool_calls: wanted });

    for (const call of wanted) {
      yield { type: "tool", name: call.function.name };
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

  yield {
    type: "error",
    message: "That took too many steps. Try asking for one thing at a time.",
  };
}

type StreamChunk = {
  choices?: {
    delta?: {
      content?: string | null;
      reasoning_content?: string | null;
      reasoning?: string | null;
      tool_calls?: {
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
  }[];
};

/**
 * Server-sent events, one parsed JSON object at a time.
 *
 * Written out rather than pulled from a library because the only thing needed
 * is "split on blank lines, drop the `data: ` prefix, stop at `[DONE]`", and a
 * dependency that decodes the whole OpenAI event taxonomy would be more code
 * to audit than this is to read. The buffer matters: a chunk boundary lands in
 * the middle of a JSON object often enough that parsing per-chunk drops
 * roughly one token in fifty.
 */
async function* sseChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          yield JSON.parse(payload) as StreamChunk;
        } catch {
          // A malformed frame is one lost token, not a failed answer.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * The same turn, collected rather than streamed.
 *
 * Kept for callers that have nowhere to put a partial answer — and it shares
 * the streaming path rather than duplicating the tool loop, so there is one
 * place where a round is decided.
 */
export async function chat(
  history: ChatMessage[],
  question: string,
  opts: ChatOptions = {},
): Promise<ChatResult> {
  let reply = "";
  const reasoning: string[] = [];
  for await (const event of chatStream(history, question, opts)) {
    if (event.type === "content") reply += event.delta;
    else if (event.type === "reasoning") reasoning.push(event.delta);
    else if (event.type === "reset") reply = "";
    else if (event.type === "error") return { ok: false, error: event.message };
  }
  return reply.trim()
    ? { ok: true, reply: reply.trim(), reasoning: reasoning.join("").trim() || undefined }
    : { ok: false, error: "The assistant sent back an empty answer." };
}
