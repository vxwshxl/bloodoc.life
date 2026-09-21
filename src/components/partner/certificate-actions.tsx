"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  approveCertificate,
  revokeCertificate,
  type ActionState,
} from "@/lib/partners/actions";
import type { CertificateStatus } from "@/lib/db/types";

/**
 * Approve or withdraw one certificate.
 *
 * Two separate forms rather than one with a hidden intent field: they post to
 * different actions with different validation, and a single form would have to
 * carry a reason input that only one of the two branches ever reads.
 *
 * Withdrawing asks for a reason inline and does not confirm twice. The reason
 * box IS the confirmation — it cannot be submitted empty, so there is no way to
 * revoke by a stray double-tap.
 */
export function CertificateActions({
  certificateId,
  status,
  canApprove,
}: {
  certificateId: string;
  status: CertificateStatus;
  canApprove: boolean;
}) {
  const [approveState, approve, approving] = useActionState<ActionState, FormData>(
    approveCertificate,
    {},
  );
  const [revokeState, revoke, revoking] = useActionState<ActionState, FormData>(
    revokeCertificate,
    {},
  );
  const [askReason, setAskReason] = useState(false);

  // An organisation member sees the state and no controls — the sign-off is
  // the blood bank's, and the database agrees.
  if (!canApprove) return null;

  const error = approveState.error ?? revokeState.error;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {(approving || revoking) && (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        )}

        {status !== "approved" && (
          <form action={approve}>
            <input type="hidden" name="certificateId" value={certificateId} />
            <button
              type="submit"
              className="press h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
            >
              {status === "revoked" ? "Reinstate" : "Approve"}
            </button>
          </form>
        )}

        {status === "approved" && !askReason && (
          <button
            type="button"
            onClick={() => setAskReason(true)}
            className="press h-8 rounded-md border border-app-line px-3 text-xs font-medium text-muted-foreground"
          >
            Withdraw
          </button>
        )}
      </div>

      {askReason && (
        <form action={revoke} className="flex items-center gap-2">
          <input type="hidden" name="certificateId" value={certificateId} />
          <input
            name="reason"
            required
            minLength={3}
            autoFocus
            placeholder="Why withdrawn?"
            className="h-8 w-48 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <button
            type="submit"
            className="press h-8 rounded-md bg-destructive px-3 text-xs font-semibold text-white"
          >
            Withdraw
          </button>
          <button
            type="button"
            onClick={() => setAskReason(false)}
            className="h-8 px-1 text-xs text-muted-foreground"
          >
            Cancel
          </button>
        </form>
      )}

      {error && <p className="max-w-56 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
