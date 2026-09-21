import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardHref } from "@/lib/auth/dal";
import { TopNav } from "@/components/site/top-nav";
import { SiteFooter } from "@/components/site/footer";
import { LEGAL_DOCS, getLegalDoc } from "@/lib/legal/documents";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { formatCampDateShort } from "@/lib/format";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) return { title: "Not found", robots: { index: false, follow: false } };
  return pageMetadata({ title: doc.title, description: doc.summary, path: `/legal/${doc.slug}` });
}

export default async function LegalPage({ params }: Params) {
  const { slug } = await params;
  const [doc, dashboardHref] = await Promise.all([
    Promise.resolve(getLegalDoc(slug)),
    getDashboardHref(),
  ]);
  if (!doc) notFound();

  return (
    <>
      <main className="relative z-10 flex flex-1 flex-col bg-background">
        <TopNav activeIndex={null} dashboardHref={dashboardHref} />

        <article className="mx-auto w-full max-w-2xl px-6 py-14 sm:py-20">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Legal</p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-balance">{doc.title}</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Last updated {formatCampDateShort(doc.updated)}
          </p>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{doc.summary}</p>

          <div className="mt-12 flex flex-col gap-10">
            {doc.sections.map((s) => (
              <section key={s.heading}>
                <h2 className="text-xl font-bold tracking-tight">{s.heading}</h2>
                <div className="mt-4 flex flex-col gap-4">
                  {s.body.map((p, i) => (
                    <p key={i} className="leading-relaxed text-muted-foreground">
                      {p}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <nav className="mt-14 flex flex-wrap gap-3 border-t border-border pt-8">
            {LEGAL_DOCS.filter((d) => d.slug !== doc.slug).map((d) => (
              <Link
                key={d.slug}
                href={`/legal/${d.slug}`}
                className="press rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                {d.title}
              </Link>
            ))}
          </nav>
        </article>
      </main>

      <SiteFooter />
    </>
  );
}
