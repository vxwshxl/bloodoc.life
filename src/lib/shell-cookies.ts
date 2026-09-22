/**
 * Cookie names shared between the console shell and the layouts that read them.
 *
 * Here rather than in `console-shell.tsx` for the same reason `ROLES` moved out
 * of `user-row.tsx`: that file carries `"use client"`, and a Server Component
 * importing a value from a client module gets a client *reference proxy* rather
 * than the value.
 *
 * This one failed silently, which is worse than the crash that exposed it.
 * `cookies().get(proxy)` does not throw — it simply finds nothing — so the rail
 * preference was written correctly by the browser and then ignored on every
 * reload, and the sidebar always came back expanded.
 */
export const RAIL_COOKIE = "bloodoc-rail";
