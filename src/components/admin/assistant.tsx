"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp, ChevronRight, Loader2, SquarePen, X } from "lucide-react";
import { DropMark } from "@/components/brand";
import { Markdown } from "@/components/ai/markdown";
import { useAssistantPanel } from "@/components/shell/assistant-context";
import { pageKnowledge } from "@/lib/ai/pages";
import type { ChatMessage } from "@/lib/ai/chat";
import { cn } from "@/lib/utils";

const DONOR_SUGGESTIONS = [
  "What is this page for?",
  "When is the next camp and where?",
  "Do I have a certificate I can download?",
  "How soon can I donate again?",
];

const SUGGESTIONS = [
  "What is this page for?",
  "What changed here recently?",
  "How many donors do we have in each blood group?",
  "Summarise the roster for the next camp.",
];

/** What to say while a tool runs, so the wait names what is happening. */
const TOOL_LABEL: Record<string, string> = {
  count_donors_by_group: "Counting blood groups…",
  find_donors: "Looking through the donors…",
  list_camps: "Reading the camps…",
  camp_roster_summary: "Adding up the roster…",
  recent_changes: "Reading the audit log…",
};

type Live = {
  reasoning: string;
  content: string;
  /** The tool running right now, or null between calls. */
  tool: string | null;
};

const EMPTY_LIVE: Live = { reasoning: "", content: "", tool: null };

export function Assistant({
  configured,
  /**
   * Which assistant this is. It changes the suggestions and the empty state
   * only — the brief the model gets, and what it can actually read, are both
   * decided on the server from the role in the database.
   */
  audience = "admin",
}: {
  configured: boolean;
  audience?: "admin" | "donor";
}) {
  const panel = useAssistantPanel();
  const pathname = usePathname();
  const page = pageKnowledge(pathname);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [live, setLive] = useState<Live | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const pending = live !== null;

  // Keep the newest turn in view. `block: "end"` rather than scrolling the
  // window, so the composer stays put while the transcript moves under it.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, live]);

  // A turn in flight belongs to the panel that started it. Leaving the fetch
  // running after the component goes away means writing state into nothing.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    setError(null);
    setValue("");

    // The question is shown immediately and the history sent is the one from
    // *before* it — the server appends it itself, and sending it twice would
    // have the model answer its own echo.
    const history = messages;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setLive({ ...EMPTY_LIVE });

    const controller = new AbortController();
    abortRef.current = controller;

    // Accumulated here as well as in state: a React state update is not
    // readable on the next line, and the final message has to be assembled
    // from everything that arrived, not from whatever the last render saw.
    let reasoning = "";
    let content = "";
    let failed: string | null = null;

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          history: history.map((m) => ({ role: m.role, content: m.content })),
          question: q,
          // What the person is looking at. The server turns this into a
          // paragraph of page notes; it grants nothing.
          pathname,
        }),
      });

      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        failed = body?.error ?? "The assistant could not answer that.";
      } else {
        for await (const event of ndjson(res.body)) {
          switch (event.type) {
            case "reasoning":
              reasoning += event.delta;
              setLive((l) => (l ? { ...l, reasoning, tool: null } : l));
              break;
            case "content":
              content += event.delta;
              setLive((l) => (l ? { ...l, content, tool: null } : l));
              break;
            case "reset":
              // That text was preamble to a tool call, not the answer.
              content = "";
              setLive((l) => (l ? { ...l, content: "" } : l));
              break;
            case "tool":
              setLive((l) => (l ? { ...l, tool: event.name } : l));
              break;
            case "error":
              failed = event.message;
              break;
          }
        }
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      failed = "Lost the connection to the assistant.";
    }

    abortRef.current = null;
    setLive(null);

    // A turn that produced an answer before erroring keeps the answer — the
    // stream dropping on the last token should not throw away the reply.
    if (content.trim()) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: content.trim(), reasoning: reasoning.trim() || undefined },
      ]);
    }
    if (failed && !content.trim()) setError(failed);
  }

  function reset() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLive(null);
    setMessages([]);
    setError(null);
    setValue("");
  }

  if (!configured) {
    return (
      <div className={cn("p-8 text-center", !panel && "rounded-2xl border border-app-line-soft bg-card shadow-card")}>
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted opacity-50">
          <DropMark className="size-6" />
        </span>
        <p className="mt-5 font-display text-lg font-semibold tracking-tight">
          The assistant is not switched on.
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Set <code className="font-mono text-xs">SARVAM_API_KEY</code> (and optionally{" "}
          <code className="font-mono text-xs">SARVAM_BASE_URL</code> /{" "}
          <code className="font-mono text-xs">SARVAM_MODEL_ID</code>) and restart. Any
          OpenAI-compatible endpoint works.
        </p>
      </div>
    );
  }

  return (
    // One card, not two. In the panel the `<aside>` around this is already a
    // bordered card with a rounded edge and a shadow; drawing another one
    // inside it put a line a few pixels in from every side and a header above
    // a header. Here the border comes off and the panel *is* the card, while
    // the standalone page keeps it because there is nothing else to be one.
    //
    // `h-full` alongside the minimum, so this works in both places: in the
    // panel the parent is a flex column with a real height, so the card fills
    // it and the composer sits on the bottom edge; on the page the parent has
    // no height, `h-full` resolves to auto, and the minimum governs.
    <div
      className={cn(
        "flex h-full min-h-[60vh] flex-col",
        !panel && "rounded-2xl border border-app-line-soft bg-card shadow-card",
      )}
    >
      {/* One header for the whole thing. The mark rather than a generic
          sparkle: this assistant answers from *these* records, and the brand is
          what says so. The close button sits with "New chat" because both act
          on the panel rather than on any one message. */}
      <div className="flex items-center gap-2.5 border-b border-app-line-soft px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12">
          <DropMark className="size-5" />
        </span>
        <span className="min-w-0 flex-1 truncate font-display text-base font-semibold tracking-tight">
          BlooDoc Assistant
        </span>
        <button
          type="button"
          onClick={reset}
          disabled={messages.length === 0 && !error && !pending}
          className="press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-app-line px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <SquarePen className="size-3.5" strokeWidth={1.9} aria-hidden />
          New chat
        </button>
        {panel && (
          <button
            type="button"
            onClick={panel.close}
            aria-label="Close the assistant"
            className="press flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/12">
              <DropMark className="size-6" />
            </span>
            <p className="mt-5 font-display text-lg font-semibold tracking-tight">
              {audience === "donor" ? "Ask about your record." : "Ask about your own records."}
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              It reads the donors and camps you can already see, and nothing else.
              It does not give medical advice.
            </p>
            {/* It knows where you are. Saying so is what makes "what is this
                page for?" a question somebody thinks to ask. */}
            {page && (
              <p className="mt-3 text-xs text-muted-foreground">
                It can also see you are on{" "}
                <span className="font-medium text-foreground">{page.title}</span>.
              </p>
            )}
            <div className="mt-7 flex max-w-lg flex-wrap justify-center gap-2">
              {(audience === "donor" ? DONOR_SUGGESTIONS : SUGGESTIONS).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="press rounded-full border border-app-line px-3.5 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div
                  key={i}
                  className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-primary-foreground"
                >
                  {m.content}
                </div>
              ) : (
                <div key={i} className="max-w-[85%]">
                  <Thinking text={m.reasoning} />
                  {/* Markdown, not raw text. The model is asked for short
                      markdown and answers with tables and lists; rendering
                      those as literal pipes and asterisks was the reason the
                      replies looked broken. The renderer builds React nodes
                      and never touches dangerouslySetInnerHTML, which matters
                      because these replies echo donor names out of the
                      database. */}
                  <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                    <Markdown source={m.content} />
                  </div>
                </div>
              ),
            )}

            {live && (
              <div className="max-w-[85%]">
                {/* Open while it thinks, closed the moment the answer starts.
                    Watching it work is worth seeing once; re-reading it above
                    every answer is not. */}
                <Thinking text={live.reasoning} live={!live.content} />
                {live.content ? (
                  <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                    <Markdown source={live.content} />
                  </div>
                ) : (
                  !live.reasoning && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      {live.tool ? (TOOL_LABEL[live.tool] ?? "Reading the records…") : "Thinking…"}
                    </div>
                  )
                )}
                {live.tool && live.reasoning && !live.content && (
                  <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    {TOOL_LABEL[live.tool] ?? "Reading the records…"}
                  </p>
                )}
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(value);
        }}
        className="flex items-end gap-2 border-t border-app-line-soft p-3 sm:p-4"
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks the line. The questions here are
            // one sentence long; making the common case need a mouse would be
            // the wrong trade.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(value);
            }
          }}
          rows={1}
          placeholder={page ? `Ask about ${page.title.toLowerCase()}…` : "Ask about donors, camps or groups…"}
          className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-input bg-transparent px-3 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button
          type="submit"
          disabled={pending || !value.trim()}
          aria-label="Send"
          className="press flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
        >
          <ArrowUp className="size-4.5" strokeWidth={2.4} />
        </button>
      </form>
    </div>
  );
}

/**
 * The model's working-out, behind a disclosure.
 *
 * Open while it is still thinking and closed once the answer arrives, because
 * those are two different things to want: the first is reassurance that
 * something is happening, the second is a paragraph of deliberation sitting
 * between you and a roster count. A click either way is remembered for that
 * turn — `touched` — so it never snaps shut under somebody who is reading it.
 */
function Thinking({ text, live = false }: { text?: string; live?: boolean }) {
  // Derived, not synced: null means "whatever the turn is doing", and a click
  // pins it. Mirroring `live` into state through an effect would be a second
  // copy of the same fact and one render behind it.
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? live;
  const bodyRef = useRef<HTMLDivElement>(null);

  // Keep the newest line of reasoning visible inside its own little box, so
  // the thinking scrolls rather than pushing the whole transcript down.
  useEffect(() => {
    if (open && live && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [text, open, live]);

  if (!text) return null;

  return (
    <div className="mb-1.5 rounded-xl border border-app-line-soft bg-muted/40 px-3 py-2 text-xs">
      <button
        type="button"
        onClick={() => setOverride(!open)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-1.5 text-left font-semibold text-muted-foreground outline-none"
      >
        <ChevronRight
          aria-hidden
          className={cn("size-3.5 transition-transform", open && "rotate-90")}
          strokeWidth={2.2}
        />
        {live ? (
          // Not a spinner: the text itself is moving, which says "working"
          // better than an icon does.
          <span className="animate-pulse">Thinking…</span>
        ) : (
          "Thought it through"
        )}
      </button>
      {open && (
        <div
          ref={bodyRef}
          className="mt-2 max-h-56 overflow-y-auto border-t border-app-line-soft pt-2 leading-relaxed whitespace-pre-wrap text-muted-foreground"
        >
          {text}
        </div>
      )}
    </div>
  );
}

type StreamEvent =
  | { type: "reasoning"; delta: string }
  | { type: "content"; delta: string }
  | { type: "tool"; name: string }
  | { type: "reset" }
  | { type: "error"; message: string };

/**
 * One JSON object per line, as they arrive.
 *
 * The buffer is the whole trick: a network chunk boundary lands in the middle
 * of a line often enough that parsing per-chunk drops tokens, and a dropped
 * token in the middle of a sentence is invisible until somebody reads the
 * answer twice.
 */
async function* ndjson(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
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
        if (!line) continue;
        try {
          yield JSON.parse(line) as StreamEvent;
        } catch {
          // A truncated frame is one lost token, not a failed answer.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
