import "server-only";

import { createHash, randomInt } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Short-lived numeric codes for email sign-in.
//
// The plaintext code is only ever emailed; what is persisted is a SHA-256 hash,
// so a dump of `email_otps` does not let anyone sign in as anybody. Every read
// and write here runs on the service-role client because the table has RLS
// enabled with no policies at all — it is unreachable from a browser session.

/**
 * How long a code stays usable.
 *
 * Expiry is enforced on read, in `consumeOtp` below — the row is stamped with
 * `expires_at` when it is issued and refused the moment that timestamp is past,
 * so a code goes dead on its own with nothing scheduled and nothing to run.
 *
 * This constant is also what the email says ("expires in N minutes"), because
 * `requestSignInCode` passes it straight into the template. Changing it here
 * changes the promise and the enforcement together, which is the point.
 */
export const OTP_TTL_MINUTES = 5;
const MAX_VERIFY_ATTEMPTS = 5;
/** Matches the "Resend code" countdown on the sign-in page. */
export const RESEND_COOLDOWN_SECONDS = 45;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/**
 * A zero-padded 6-digit code.
 *
 * `randomInt` rather than `Math.random`: this is the entire secret protecting
 * an account, and a predictable PRNG makes a million-guess space a one-guess
 * space for anyone who can observe a single earlier code.
 */
function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type IssueResult =
  | { status: "issued"; code: string }
  | { status: "cooldown" }
  | { status: "error" };

/**
 * Mint a code for `email`, invalidating any earlier unconsumed one so only the
 * newest works. Returns `cooldown` when one was already sent inside the
 * window — the caller reports success either way, because telling a stranger
 * "a code was already sent to this address" confirms the address exists.
 */
export async function issueOtp(email: string, purpose = "signin"): Promise<IssueResult> {
  try {
    const admin = createAdminClient();
    const at = normaliseEmail(email);

    const cutoff = new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000).toISOString();
    const { data: recent } = await admin
      .from("email_otps")
      .select("id")
      .eq("email", at)
      .eq("purpose", purpose)
      .is("consumed_at", null)
      .gt("created_at", cutoff)
      .limit(1)
      .maybeSingle();
    if (recent) return { status: "cooldown" };

    await admin
      .from("email_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("email", at)
      .eq("purpose", purpose)
      .is("consumed_at", null);

    const code = generateCode();
    const { error } = await admin.from("email_otps").insert({
      email: at,
      code_hash: hashCode(code),
      purpose,
      expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString(),
    });
    if (error) return { status: "error" };
    return { status: "issued", code };
  } catch {
    return { status: "error" };
  }
}

/**
 * Verify and consume a code. True only for a matching, unexpired, unconsumed
 * code inside the attempt limit — and it is consumed on success, so it cannot
 * be replayed by anyone who saw it over someone's shoulder.
 */
export async function consumeOtp(email: string, code: string, purpose = "signin"): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const at = normaliseEmail(email);

    const { data: row } = await admin
      .from("email_otps")
      .select("id, code_hash, attempts, expires_at")
      .eq("email", at)
      .eq("purpose", purpose)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return false;
    if (new Date(row.expires_at).getTime() < Date.now()) return false;
    if (row.attempts >= MAX_VERIFY_ATTEMPTS) return false;

    if (hashCode(code.trim()) !== row.code_hash) {
      // Count the miss, and lock the code out once the limit is reached. Five
      // guesses against a million-value space is the whole rate limit; without
      // it, a script exhausts the space in an afternoon.
      await admin.from("email_otps").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return false;
    }

    await admin
      .from("email_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);
    return true;
  } catch {
    return false;
  }
}
