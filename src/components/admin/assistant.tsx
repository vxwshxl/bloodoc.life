"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, ChevronRight, Loader2, SquarePen } from "lucide-react";
import { DropMark } from "@/components/brand";
import { Markdown } from "@/components/ai/markdown";
import { askAssistant, askDonorAssistant } from "@/lib/ai/actions";
import type { ChatMessage } from "@/lib/ai/chat";

const DONOR_SUGGESTIONS = [
  "When is the next camp and where?",
  "Have I donated with BlooDoc before?",
  "Do I have a certificate I can download?",
  "How soon can I donate again?",
];

const SUGGESTIONS = [
  "How many donors do we have in each blood group?",
  "Who is O-negative and has donated before?",
  "Summarise the roster for the next camp.",
  "Which departments have the fewest registered donors?",
];

export function Assistant({
  configured,
  /**
   * Which assistant this is. The donor one runs through a different action
   * with a narrower brief — and, more importantly, a different session, so RLS
   * is what actually limits it.
   */
  audience = "admin",
}: {
  configured: boolean;
  audience?: "admin" | "donor";
}) {
  const ask = audience === "donor" ? askDonorAssistant : askAssistant;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the newest turn in view. `block: "end"` rather than scrolling the
  // window, so the composer stays put while the transcript moves under it.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, pending]);

  function send(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    setError(null);
    setValue("");
    // The question is shown immediately and the history sent is the one from
    // *before* it — the server appends it itself, and sending it twice would
    // have the model answer its own echo.
    const history = messages;
    setMessages((m) => [...m, { role: "user", content: q }]);

    startTransition(async () => {
      const res = await ask(history, q);
      if (res.ok)
        setMessages((m) => [
          ...m,
          { role: "assistant", content: res.reply, reasoning: res.reasoning },
        ]);
      else setError(res.error);
    });
  }

  if (!configured) {
    return (
      <div className="rounded-2xl border border-app-line-soft bg-card p-8 text-center shadow-card">
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

  // `h-full` alongside the minimum, so this works in both places it is used.
  // In the side panel the parent is a flex column with a real height, so the
  // card fills it and the composer sits on the bottom edge. On the standalone
  // page the parent has no height, `h-full` resolves to auto, and the minimum
  // governs as before.
  //
  // It was `min-h-[60vh]` alone, which inside a full-height panel left the
  // composer floating in the middle with dead space under it.
  return (
    <div className="flex h-full min-h-[60vh] flex-col rounded-2xl border border-app-line-soft bg-card shadow-card">
      {/* The mark rather than a generic sparkle: this assistant answers from
          *these* records, and the brand is what says so. "New chat" sits with
          it because starting over is the only control that applies to the
          whole transcript rather than to one message in it. */}
      <div className="flex items-center gap-2.5 border-b border-app-line-soft px-5 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12">
          <DropMark className="size-4.5" />
        </span>
        {/* Title only. The subtitle repeated what the empty state already says
            two lines below it, and in a narrow panel it wrapped to two lines
            and pushed "New chat" out of reach. */}
        <span className="min-w-0 flex-1 text-sm font-semibold">BlooDoc Assistant</span>
        <button
          type="button"
          onClick={() => {
            setMessages([]);
            setError(null);
            setValue("");
          }}
          disabled={messages.length === 0 && !error}
          className="press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-app-line px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <SquarePen className="size-3.5" strokeWidth={1.9} aria-hidden />
          New chat
        </button>
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
                  {/* The model's working-out, behind a disclosure. Collapsed by
                      default: it is how the answer was reached, not the answer,
                      and nobody reading a roster count wants a paragraph of
                      deliberation first. `<details>` rather than state, so it
                      opens without JavaScript and is findable by Ctrl+F. */}
                  {m.reasoning && (
                    <details className="group/think mb-1.5 rounded-xl border border-app-line-soft bg-muted/40 px-3 py-2 text-xs">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold text-muted-foreground outline-none marker:content-none [&::-webkit-details-marker]:hidden">
                        <ChevronRight
                          aria-hidden
                          className="size-3.5 transition-transform group-open/think:rotate-90"
                          strokeWidth={2.2}
                        />
                        Thought it through
                      </summary>
                      <div className="mt-2 border-t border-app-line-soft pt-2 leading-relaxed whitespace-pre-wrap text-muted-foreground">
                        {m.reasoning}
                      </div>
                    </details>
                  )}
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
            {pending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Reading the records…
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
          placeholder="Ask about donors, camps or groups…"
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
