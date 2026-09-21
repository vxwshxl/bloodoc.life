"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { requestSignInCode, verifySignInCode, type AuthState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RESEND_SECONDS = 45;

/**
 * Sign in with a code, in two steps.
 *
 * Two separate actions rather than one that branches on which fields are
 * present: the second step needs the email that the first step validated, and
 * threading that through a single action means the "which step am I on" state
 * lives in the returned object, where a failed verify and a fresh request
 * become indistinguishable.
 *
 * There is no password anywhere in this component, and no "create an account"
 * link. Registering for a camp creates the record; typing your email here is
 * how you get back to it. A donor should never be asked to remember a second
 * thing about a site they use twice a year.
 */
export function SignInForm() {
  const [reqState, reqAction, reqPending] = useActionState<AuthState, FormData>(
    requestSignInCode,
    {},
  );
  const [verState, verAction, verPending] = useActionState<AuthState, FormData>(
    verifySignInCode,
    {},
  );

  // The email that was actually accepted, from whichever action last ran.
  const email = verState.email ?? reqState.email ?? "";
  const sent = reqState.sent || verState.sent;

  const codeRef = useRef<HTMLInputElement>(null);

  // The resend countdown.
  //
  // `sentAt` is adjusted during render when a *new* action result arrives —
  // React's documented way to derive state from changing props, and the reason
  // there is no effect here. Setting it from an effect would mean a second
  // render pass every time a code goes out, for a value the render already
  // knows.
  //
  // The ticking half is a genuine external system (a clock), so it stays in an
  // effect, and it only runs while a countdown is actually in flight.
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [seen, setSeen] = useState<AuthState | null>(null);
  const [now, setNow] = useState(() => Date.now());

  if (seen !== reqState) {
    setSeen(reqState);
    if (reqState.sent) {
      setSentAt(Date.now());
      setNow(Date.now());
    }
  }

  const cooldown = sentAt
    ? Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000))
    : 0;

  // Move the caret to the code box the moment the step changes. Without it the
  // focus stays on a submit button that is no longer on screen, and a keyboard
  // user has to tab back into the form they were already filling.
  useEffect(() => {
    if (sent) codeRef.current?.focus();
  }, [sent]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  if (!sent) {
    return (
      <form action={reqAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            placeholder="you@example.com"
            className="h-11"
            aria-invalid={!!reqState.error || undefined}
          />
        </div>

        {reqState.error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {reqState.error}
          </p>
        )}

        <Button type="submit" disabled={reqPending} className="h-11 w-full rounded-full">
          {reqPending ? (
            <>
              <Loader2 className="animate-spin" /> Sending…
            </>
          ) : (
            <>
              <Mail /> Email me a code
            </>
          )}
        </Button>
      </form>
    );
  }

  return (
    <form action={verAction} className="flex flex-col gap-4">
      <input type="hidden" name="email" value={email} />

      <p className="text-sm text-muted-foreground">
        We sent a six-digit code to <span className="font-medium text-foreground">{email}</span>.
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code" className="text-xs font-medium text-muted-foreground">
          Code
        </Label>
        <Input
          ref={codeRef}
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          placeholder="000000"
          // `tabular-nums` and wide tracking for the same reason the email
          // renders it in a monospace face: this is a string a person is
          // copying by eye, digit by digit, from one window into another.
          className="h-14 text-center text-2xl font-semibold tracking-[0.5em] [font-variant-numeric:tabular-nums]"
          aria-invalid={!!verState.error || undefined}
        />
      </div>

      {verState.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {verState.error}
        </p>
      )}

      <Button type="submit" disabled={verPending} className="h-11 w-full rounded-full">
        {verPending ? (
          <>
            <Loader2 className="animate-spin" /> Checking…
          </>
        ) : (
          "Sign in"
        )}
      </Button>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Use a different email
        </button>
        <button
          type="submit"
          formAction={reqAction}
          disabled={cooldown > 0 || reqPending}
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}
