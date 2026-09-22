"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, Loader2, SquarePen } from "lucide-react";
import { DropMark } from "@/components/brand";
import { askAssistant } from "@/lib/ai/actions";
import type { ChatMessage } from "@/lib/ai/chat";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "How many donors do we have in each blood group?",
  "Who is O-negative and has donated before?",
  "Summarise the roster for the next camp.",
  "Which departments have the fewest registered donors?",
];

export function Assistant({ configured }: { configured: boolean }) {
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
      const res = await askAssistant(history, q);
      if (res.ok) setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
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

  return (
    <div className="flex min-h-[60vh] flex-col rounded-2xl border border-app-line-soft bg-card shadow-card">
      {/* The mark rather than a generic sparkle: this assistant answers from
          *these* records, and the brand is what says so. "New chat" sits with
          it because starting over is the only control that applies to the
          whole transcript rather than to one message in it. */}
      <div className="flex items-center gap-2.5 border-b border-app-line-soft px-5 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12">
          <DropMark className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-tight">BlooDoc Assistant</span>
          <span className="block text-xs text-muted-foreground">
            Reads your donors, camps and rosters.
          </span>
        </span>
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
              Ask about your own records.
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              It reads the donors and camps you can already see, and nothing else.
              It does not give medical advice.
            </p>
            <div className="mt-7 flex max-w-lg flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
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
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                  m.role === "user"
                    ? "ml-auto rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md bg-muted",
                )}
              >
                {m.content}
              </div>
            ))}
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
