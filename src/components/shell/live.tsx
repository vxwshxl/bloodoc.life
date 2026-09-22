"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Live updates, for a page that is otherwise entirely server-rendered.
 *
 * Mount this anywhere in a route and the rows above it start updating
 * themselves when somebody else changes them — a registration marked donated at
 * the desk appears on the organiser's roster, a camp published in the console
 * appears on the home page, without anybody pressing reload.
 *
 * The trick is that it refreshes rather than patches. Supabase tells us *that*
 * `registrations` changed; `router.refresh()` then re-runs the Server Component
 * for the route we are on and swaps in new HTML. That keeps every list's
 * filtering, pagination and RLS exactly where they already are — on the server,
 * in one place — instead of reimplementing each of them again in the browser
 * against a row that arrived over a websocket. It also preserves scroll
 * position, focus and any open dialog, because React reconciles rather than
 * navigates.
 *
 * What it costs is one extra RSC fetch per burst of changes, which is why the
 * burst is coalesced below.
 *
 * Security: a change event is delivered only to subscribers whose own RLS
 * SELECT policies match the row, and the refresh it triggers re-reads
 * everything through the same session as before. Nothing here can show anybody
 * a row they could not have seen by pressing reload — the worst a forged event
 * could do is cause a redundant refresh.
 */
export function Live({
  tables,
  /**
   * Only react to changes to rows whose `camp_id` is this. The roster at a desk
   * has no use for a registration at a camp three weeks away, and refreshing
   * for one costs the same as refreshing for a real change.
   */
  campId,
  /** Shows a small pulsing dot while a refresh is in flight. */
  indicator = false,
}: {
  tables: string[];
  campId?: string;
  indicator?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // The array is a new identity on every render of the parent, so the effect
  // keys on its contents. Without this the channel is torn down and rebuilt on
  // every single refresh — and since a refresh re-renders the parent, that is a
  // loop that never settles.
  const key = tables.join(",");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const names = key.split(",").filter(Boolean);
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    /**
     * Coalesce. Saving a camp writes `camps` and `camp_partners` and an
     * `audit_log` row within a few milliseconds of each other; each is a
     * separate event, and refreshing three times for one save is three RSC
     * round trips to render the same thing.
     *
     * The delay is also a floor on how often a busy desk makes this fetch: six
     * people checked in during one second is one refresh, not six.
     */
    function bump() {
      if (timer.current) clearTimeout(timer.current);
      setBusy(true);
      timer.current = setTimeout(() => {
        timer.current = null;
        router.refresh();
        // Not tied to the refresh completing — `router.refresh()` returns
        // nothing to wait on. The dot is a sign of life, not a progress bar.
        setTimeout(() => setBusy(false), 500);
      }, 350);
    }

    async function connect() {
      // Hand the socket the access token *before* subscribing.
      //
      // This is the failure that makes realtime look broken rather than
      // absent: the browser client restores its session asynchronously, so a
      // channel opened on the first render authenticates as `anon`. RLS then
      // correctly refuses every event on `registrations` and `donors`, the
      // subscription succeeds, and nothing ever arrives — no error anywhere to
      // explain it. Public tables like `camps` work fine, which makes it look
      // intermittent rather than wrong.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);

      channel = supabase.channel(`live:${key}:${campId ?? "all"}`);

      for (const table of names) {
        channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            // Filtered server-side rather than in the callback: an unfiltered
            // subscription on a busy table ships every row change to every
            // open browser, and the ones it is not about are paid for in
            // bandwidth before they are discarded.
            ...(campId && table === "registrations" ? { filter: `camp_id=eq.${campId}` } : {}),
          },
          bump,
        );
      }

      channel.subscribe();
    }

    connect();

    /**
     * Disconnect a hidden tab, and catch up when it comes back.
     *
     * Both halves matter. A console left open on a second monitor overnight
     * holds a websocket open for no reader — and on a public page that is one
     * connection per idle visitor against a project-wide concurrent limit,
     * which is the one way this feature could take the site down rather than
     * speed it up.
     *
     * Coming back is the correctness half: events that happened while the tab
     * was away are gone, not queued, so returning to a stale page has to
     * refresh unconditionally rather than wait for the next change.
     */
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }
      } else if (!channel) {
        connect();
        router.refresh();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer.current) clearTimeout(timer.current);
      // `removeChannel` rather than `unsubscribe`: the latter leaves the
      // channel object registered on the client, and a route navigated back and
      // forth twenty times accumulates twenty of them.
      if (channel) supabase.removeChannel(channel);
    };
  }, [key, campId, router]);

  if (!indicator) return null;

  return (
    <span
      aria-hidden
      data-busy={busy || undefined}
      className="inline-block size-1.5 rounded-full bg-primary opacity-0 transition-opacity data-busy:animate-pulse data-busy:opacity-100"
    />
  );
}
