"use client";

import { useActionState, useEffect, useState } from "react";
import { Eye, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { saveTemplateCopy, resetTemplateCopy, type ActionState } from "@/lib/admin/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Panel } from "@/components/shell/page-header";

const field =
  "w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

/**
 * One template's copy, with its variables and a preview.
 *
 * Three fields only. The layout, the branding and every block that carries data
 * — the code itself, the camp card, the eligibility notice — stay in the code
 * where a form cannot break them. See 0012 for the full reasoning; the short
 * version is that these messages go to someone's inbox carrying a sign-in code,
 * and an editable HTML body is a way to put arbitrary markup in front of a
 * person who trusts the sender.
 *
 * The preview is rendered on the server from the *saved* copy and handed down
 * as a string, so what is shown is what would actually be sent rather than a
 * client-side approximation of it.
 */
export function TemplateEditor({
  templateKey,
  label,
  description,
  tokens,
  current,
  previewHtml,
  previewSubject,
  updatedAt,
}: {
  templateKey: string;
  label: string;
  description: string;
  tokens: { token: string; means: string }[];
  current: { subject: string | null; heading: string | null; lead: string | null } | null;
  previewHtml: string;
  previewSubject: string;
  updatedAt: string | null;
}) {
  const [saveState, save, saving] = useActionState<ActionState, FormData>(saveTemplateCopy, {});
  const [resetState, reset, resetting] = useActionState<ActionState, FormData>(
    resetTemplateCopy,
    {},
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (saveState.error) toast.error(saveState.error);
    else if (saveState.ok) toast.success(saveState.message ?? "Saved.");
  }, [saveState]);

  useEffect(() => {
    if (resetState.error) toast.error(resetState.error);
    else if (resetState.ok) toast.success(resetState.message ?? "Reset.");
  }, [resetState]);

  const customised = !!(current?.subject || current?.heading || current?.lead);

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold tracking-tight">{label}</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
        </div>
        <span
          className={
            customised
              ? "shrink-0 rounded-full bg-primary/12 px-2.5 py-1 text-[0.625rem] font-semibold text-primary uppercase"
              : "shrink-0 rounded-full bg-muted px-2.5 py-1 text-[0.625rem] font-semibold text-muted-foreground uppercase"
          }
        >
          {customised ? "Customised" : "Built-in wording"}
        </span>
      </div>

      <form action={save} className="mt-5 flex flex-col gap-3">
        <input type="hidden" name="key" value={templateKey} />

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Subject</span>
          <input
            name="subject"
            defaultValue={current?.subject ?? ""}
            placeholder="Leave blank to use the built-in subject"
            className={field}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Heading</span>
          <input
            name="heading"
            defaultValue={current?.heading ?? ""}
            placeholder="Leave blank to use the built-in heading"
            className={field}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Opening paragraph
          </span>
          <textarea
            name="lead"
            rows={3}
            defaultValue={current?.lead ?? ""}
            placeholder="Leave blank to use the built-in wording"
            className={`${field} resize-y`}
          />
        </label>

        {/* The variables live beside the fields rather than in a help page:
            a token that exists in the code and nowhere on screen is one
            nobody can discover. */}
        <div className="rounded-xl border border-app-line-soft bg-muted/40 p-3">
          <p className="text-xs font-semibold">Variables you can use</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {tokens.map((t) => (
              <li key={t.token} className="text-xs text-muted-foreground">
                <code className="rounded border border-app-line-soft bg-card px-1.5 py-0.5 font-mono text-[0.6875rem] text-foreground">
                  {t.token}
                </code>{" "}
                {t.means}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.6875rem] text-muted-foreground">
            A variable you spell wrong is left on the page as you typed it, so a
            test send shows you the mistake instead of a blank gap.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="press inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground"
          >
            {saving && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            Save copy
          </button>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="press inline-flex h-9 items-center gap-2 rounded-lg border border-app-line px-3.5 text-sm font-medium"
          >
            <Eye className="size-4" strokeWidth={1.9} aria-hidden />
            Preview
          </button>

          {customised && (
            <button
              type="submit"
              formAction={reset}
              formNoValidate
              className="press inline-flex h-9 items-center gap-2 rounded-lg border border-app-line px-3.5 text-sm font-medium text-muted-foreground"
            >
              {resetting ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <RotateCcw className="size-3.5" strokeWidth={1.9} aria-hidden />
              )}
              Reset
            </button>
          )}

          {updatedAt && (
            <span className="text-xs text-muted-foreground">
              Edited {new Date(updatedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </form>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base">{previewSubject}</DialogTitle>
            <DialogDescription className="text-xs">
              Rendered with sample values, from the copy currently saved.
            </DialogDescription>
          </DialogHeader>
          {/* Sandboxed for the same reason the email log's preview is: this is
              HTML being shown inside an admin session, and it must not be able
              to reach that session. */}
          <iframe
            title={`Preview of ${label}`}
            srcDoc={previewHtml}
            sandbox=""
            className="h-[60vh] w-full rounded-lg border border-app-line-soft bg-white"
          />
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
