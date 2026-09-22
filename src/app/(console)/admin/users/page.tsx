import type { Metadata } from "next";
import { listUsers } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/dal";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { SearchBox } from "@/components/shell/search-box";
import { FilterMenu } from "@/components/shell/filter-menu";
import {
  Pagination,
  DEFAULT_PAGE_SIZE,
  pageFromParams,
} from "@/components/shell/pagination";
import { UserRow } from "@/components/admin/user-row";
import { ROLES } from "@/lib/roles";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; role?: string }>;
}) {
  const { q, page: pageParam, role } = await searchParams;
  const page = pageFromParams(pageParam);

  const [me, { rows, total }] = await Promise.all([
    requireAdmin(),
    listUsers(q, page, DEFAULT_PAGE_SIZE, role),
  ]);

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={`${total} account${total === 1 ? "" : "s"} — everybody who can sign in`}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <SearchBox
          placeholder="Name or email"
          defaultValue={q}
          keep={{ role }}
          clearHref="/admin/users"
        />
        {/* Built from the same ROLES list the row dropdown uses, so the filter
            can never offer a role the control cannot set. */}
        <FilterMenu
          label="Role"
          paramName="role"
          active={role}
          options={ROLES.map((r) => ({ value: r.value, label: r.label, hint: r.hint }))}
        />
      </div>

      {total === 0 ? (
        <Panel>
          <EmptyState
            title="Nobody yet"
            body="An account is created the first time somebody signs in — by registering for a camp, or by being invited as a partner."
          />
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead>
                <tr className="border-b border-app-line-soft">
                  {["Person", "Group", "Partner access", "Joined", "Role", ""].map((h, i) => (
                    <th
                      key={h || i}
                      className="px-5 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <UserRow key={u.id} user={u} isSelf={u.id === me.id} />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={total}
            basePath="/admin/users"
            params={{ q, role }}
            unit="account"
          />
        </Panel>
      )}

      <p className="mt-6 max-w-2xl text-xs leading-relaxed text-muted-foreground">
        Changing a role takes effect on that person&rsquo;s next request — the
        role is read from the database on every check rather than baked into
        their session, so a demotion is immediate rather than waiting for a
        token to expire.
      </p>
    </>
  );
}
