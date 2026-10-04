"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Mail, MessageCircle } from "lucide-react";
import {
  requestPhoneCode,
  requestSignInCode,
  verifyPhoneCode,
  verifySignInCode,
  type AuthState,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, mobileInputProps } from "@/lib/utils";

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
 * link. Any address can sign in; the donor record is created the first time
 * they apply to a camp, from here or from the public form. A donor should never be asked to remember a second
 * thing about a site they use twice a year.
 */
export function SignInForm({ phoneEnabled = false }: { phoneEnabled?: boolean }) {
  const [method, setMethod] = useState<"email" | "phone">("email");
  if (!phoneEnabled) return <EmailSignIn />;
  return (
    <div className="flex flex-col gap-5">
      {/* Two ways in, to the same account: the phone path signs into the
          account of the donor record that carries the number. */}
      <div role="tablist" aria-label="Sign in with" className="grid grid-cols-2 rounded-full border border-input p-1">
        {(
          [
            ["email", "Email", Mail],
            ["phone", "WhatsApp", MessageCircle],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={method === value}
            onClick={() => setMethod(value)}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors",
              method === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      {method === "email" ? <EmailSignIn /> : <PhoneSignIn />}
    </div>
  );
}

/**
 * Sign in with the mobile number on a donor record; the code arrives on
 * WhatsApp. Same two steps as email.
 */
function PhoneSignIn() {
  const [reqState, reqAction, reqPending] = useActionState<AuthState, FormData>(
    requestPhoneCode,
    {},
  );
  const [verState, verAction, verPending] = useActionState<AuthState, FormData>(
    verifyPhoneCode,
    {},
  );
  const phone = verState.phone ?? reqState.phone ?? "";
  const sent = reqState.sent || verState.sent;
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sent) codeRef.current?.focus();
  }, [sent]);

  if (!sent) {
    return (
      <form action={reqAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone" className="text-xs font-medium text-muted-foreground">
            Mobile number
          </Label>
          <Input
            id="phone"
            name="phone"
            {...mobileInputProps}
            required
            autoFocus
            placeholder="10 digits"
            className="h-11"
            aria-invalid={!!reqState.error || undefined}
          />
          <p className="text-xs text-muted-foreground">
            The number you gave when you registered to donate.
          </p>
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
              <MessageCircle /> Send code on WhatsApp
            </>
          )}
        </Button>
      </form>
    );
  }

  return (
    <form action={verAction} className="flex flex-col gap-4">
      <input type="hidden" name="phone" value={phone} />

      {/* Worded as "if", because the server answers the same way for a number
          it does not know — see `requestPhoneCode`. */}
      <p className="text-sm text-muted-foreground">
        If <span className="font-medium text-foreground">{phone}</span> is on a BlooDoc donor
        record, a code is on its way on WhatsApp. Nothing within a minute? Sign in with
        your email instead.
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone-code" className="text-xs font-medium text-muted-foreground">
          Code
        </Label>
        <Input
          ref={codeRef}
          id="phone-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          placeholder="000000"
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
          <ArrowLeft className="size-3.5" /> Change number
        </button>
        <ResendButton key={reqState.sentAt ?? 0} action={reqAction} busy={reqPending} />
      </div>
    </form>
  );
}

function EmailSignIn() {
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

  // Move the caret to the code box the moment the step changes. Without it the
  // focus stays on a submit button that is no longer on screen, and a keyboard
  // user has to tab back into the form they were already filling.
  useEffect(() => {
    if (sent) codeRef.current?.focus();
  }, [sent]);


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
        Code sent to <span className="font-medium text-foreground">{email}</span>.
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
          <ArrowLeft className="size-3.5" /> Change email
        </button>
        {/* Keyed on the send nonce, so each new code remounts this and the
            countdown starts again from a clean state. That is what lets the
            timer live entirely inside the component, with no state derived
            from a prop and no clock read during render. */}
        <ResendButton key={reqState.sentAt ?? 0} action={reqAction} busy={reqPending} />
      </div>
    </form>
  );
}

/**
 * "Resend code", with its own countdown.
 *
 * The countdown is local and starts at mount. The parent remounts it with a
 * `key` whenever a new code is sent, which is both simpler and more accurate
 * than deriving the remaining seconds from a server timestamp — the two clocks
 * do not have to agree about anything.
 */
function ResendButton({
  action,
  busy,
}: {
  action: (formData: FormData) => void;
  busy: boolean;
}) {
  const [left, setLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    const id = setInterval(() => setLeft((l) => (l <= 1 ? 0 : l - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <button
      type="submit"
      formAction={action}
      // This button lives inside the *verify* form, whose code input is
      // `required`. Without `formNoValidate` the browser refuses to submit
      // while that box is empty — which is exactly the state someone is in
      // when they want a new code — so Resend did nothing at all and gave no
      // hint why. The resend action only ever reads `email`, so skipping this
      // form's validation costs nothing.
      formNoValidate
      disabled={left > 0 || busy}
      className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
    >
      {left > 0 ? `Resend in ${left}s` : "Resend code"}
    </button>
  );
}
