import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { BRAND_ALTERNATE_NAMES } from "@/lib/seo/structured-data";
import { OG_IMAGE, SITE_NAME } from "@/lib/seo/page-metadata";
import { SITE_URL } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const siteUrl = SITE_URL;

// `interactive-widget=resizes-content` shrinks the layout viewport (and dvh
// units) when the on-screen keyboard opens, so the registration dialog
// repositions above the keyboard instead of hiding behind it — which is most of
// the form, on a phone.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  viewportFit: "cover",
  // The site is light only, so the browser's own chrome is told to be white
  // too. Without this, Chrome and Safari on a phone in dark mode tint the
  // address bar and the status area dark above a white page, which is the
  // thing that reads as "the site half-supports dark mode".
  colorScheme: "light",
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "BlooDoc: blood donation camps, done properly",
    template: `%s · ${SITE_NAME}`,
  },
  description:
    "Register for a blood donation camp in two minutes. BlooDoc keeps your blood group, your donation history and your screening record, so every camp after the first is just turning up.",
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  // Branded variants first: those are the queries this site can realistically
  // own. The category terms follow, and are a long game rather than a promise.
  keywords: [
    ...BRAND_ALTERNATE_NAMES,
    "blood donation camp",
    "blood donation camp Guwahati",
    "blood donation Assam",
    "blood donor registration",
    "donate blood India",
    "blood donation eligibility",
    "blood camp registration form",
    "blood donor management software",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/apple-icon.svg" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "BlooDoc: roll up a sleeve, save three lives",
    description:
      "Blood donation camps, from the sign-up form to the roster. Register in two minutes.",
    url: siteUrl,
    locale: "en_IN",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "BlooDoc: roll up a sleeve, save three lives",
    description:
      "Blood donation camps, from the sign-up form to the roster. Register in two minutes.",
    images: [OG_IMAGE.url],
  },
  // `max-snippet: -1` and `max-image-preview: large` are what permit Google to
  // quote the page at length in AI Overviews and show a large thumbnail.
  // Without them it defaults to a short snippet, which is the single most
  // common reason a well-marked-up page is skipped by answer engines.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-IN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        {/* One provider for the whole app so the delay-skip window is shared:
            moving between tooltips anywhere in a toolbar stays instant. */}
        <TooltipProvider>
          {children}
          <Toaster position="top-center" />
        </TooltipProvider>
      </body>
    </html>
  );
}
