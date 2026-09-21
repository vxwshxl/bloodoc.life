import "server-only";

import { createClient } from "@/lib/supabase/server";
import { formatCampDate, formatTimeRange } from "@/lib/format";
import { BLOOD_GROUPS, DONOR_KINDS } from "@/lib/validations/donor";
import type { BloodGroup, DonorKind } from "@/lib/db/types";

/**
 * What the assistant is allowed to do.
 *
 * This is the security boundary, and it is worth being exact about why. The
 * system prompt shapes tone and stops the model volunteering things; it is a
 * preference the model may ignore under a determined prompt. What keeps the
 * assistant inside the data it should see is that every tool below runs on the
 * *caller's* Supabase session, so RLS answers each query as the signed-in
 * admin — there is no parameter any prompt could supply that would address
 * another organiser's rows, because no tool takes one.
 *
 * Read-only on purpose. A model that can send email is a model that can send
 * three hundred emails; drafting is the useful half and the send stays a human
 * click.
 */
export const TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "count_donors_by_group",
      description:
        "Count donors on file, grouped by blood group. Use for questions about stock, coverage or which groups are under-represented.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_donors",
      description:
        "Find donors matching a filter. Returns at most 25, newest first. Use for questions like 'who is O-negative', 'which faculty members have donated before'.",
      parameters: {
        type: "object",
        properties: {
          blood_group: {
            type: "string",
            enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"],
          },
          kind: { type: "string", enum: ["student", "faculty", "staff", "other"] },
          department: { type: "string", description: "Partial match, case-insensitive." },
          min_prior_donations: { type: "integer", minimum: 0 },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_camps",
      description: "List camps with their date, venue, status and how many people registered.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "camp_roster_summary",
      description:
        "Counts for one camp broken down by registration status and blood group. Pass the camp title or part of it.",
      parameters: {
        type: "object",
        properties: { camp: { type: "string", description: "Camp title, or part of it." } },
        required: ["camp"],
      },
    },
  },
];

type Args = Record<string, unknown>;

const KINDS = DONOR_KINDS.map((k) => k.value);

function isBloodGroup(v: unknown): v is BloodGroup {
  return typeof v === "string" && (BLOOD_GROUPS as readonly string[]).includes(v);
}

function isDonorKind(v: unknown): v is DonorKind {
  return typeof v === "string" && (KINDS as readonly string[]).includes(v);
}

export async function runTool(name: string, args: Args): Promise<string> {
  const supabase = await createClient();

  switch (name) {
    case "count_donors_by_group": {
      const { data } = await supabase.from("donors").select("blood_group");
      const counts = new Map<string, number>();
      for (const r of data ?? []) {
        const g = (r as { blood_group: string }).blood_group;
        counts.set(g, (counts.get(g) ?? 0) + 1);
      }
      return JSON.stringify({
        total: data?.length ?? 0,
        by_group: [...counts.entries()]
          .map(([group, count]) => ({ group, count }))
          .sort((a, b) => b.count - a.count),
      });
    }

    case "find_donors": {
      let q = supabase
        .from("donors")
        .select("full_name, blood_group, kind, department, prior_donations, phone, email")
        .order("created_at", { ascending: false })
        .limit(25);
      // The tool schema declares the enums, but a model's arguments are still
      // untrusted input — they arrive as whatever the provider sent. Narrowing
      // against the same lists the form uses is what stops a hallucinated
      // "O positive" reaching the query as a filter that silently matches
      // nothing and gets reported as "no donors found".
      if (isBloodGroup(args.blood_group)) q = q.eq("blood_group", args.blood_group);
      if (isDonorKind(args.kind)) q = q.eq("kind", args.kind);
      if (typeof args.department === "string" && args.department.trim())
        q = q.ilike("department", `%${args.department.trim()}%`);
      if (typeof args.min_prior_donations === "number")
        q = q.gte("prior_donations", args.min_prior_donations);
      const { data, error } = await q;
      if (error) return JSON.stringify({ error: "Could not read the donor list." });
      return JSON.stringify({ count: data?.length ?? 0, donors: data ?? [] });
    }

    case "list_camps": {
      const { data } = await supabase
        .from("camps")
        .select("id, title, venue, city, starts_at, ends_at, status, capacity")
        .order("starts_at", { ascending: false })
        .limit(25);
      const camps = data ?? [];
      const withCounts = await Promise.all(
        camps.map(async (c) => {
          const { count } = await supabase
            .from("registrations")
            .select("id", { count: "exact", head: true })
            .eq("camp_id", c.id);
          return {
            title: c.title,
            when: `${formatCampDate(c.starts_at)}, ${formatTimeRange(c.starts_at, c.ends_at)}`,
            venue: [c.venue, c.city].filter(Boolean).join(", "),
            status: c.status,
            capacity: c.capacity,
            registered: count ?? 0,
          };
        }),
      );
      return JSON.stringify({ camps: withCounts });
    }

    case "camp_roster_summary": {
      const term = String(args.camp ?? "").trim();
      if (!term) return JSON.stringify({ error: "Name a camp." });
      const { data: camps } = await supabase
        .from("camps")
        .select("id, title, starts_at")
        .ilike("title", `%${term}%`)
        .order("starts_at", { ascending: false })
        .limit(1);
      const camp = camps?.[0];
      if (!camp) return JSON.stringify({ error: `No camp matching "${term}".` });

      const { data: rows } = await supabase
        .from("registrations")
        .select("status, first_time, donor:donors(blood_group)")
        .eq("camp_id", camp.id);

      const byStatus = new Map<string, number>();
      const byGroup = new Map<string, number>();
      let firstTimers = 0;
      for (const r of (rows ?? []) as unknown as {
        status: string;
        first_time: boolean;
        donor: { blood_group: string } | null;
      }[]) {
        byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
        if (r.first_time) firstTimers += 1;
        const g = r.donor?.blood_group ?? "unknown";
        byGroup.set(g, (byGroup.get(g) ?? 0) + 1);
      }

      return JSON.stringify({
        camp: camp.title,
        date: formatCampDate(camp.starts_at),
        total: rows?.length ?? 0,
        first_timers: firstTimers,
        by_status: Object.fromEntries(byStatus),
        by_group: Object.fromEntries(byGroup),
      });
    }

    default:
      return JSON.stringify({ error: `Unknown tool ${name}.` });
  }
}
