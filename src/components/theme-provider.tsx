"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Light only.
 *
 * `forcedTheme` pins the class on <html> to "light" whatever the OS or a
 * previously saved choice says, so there is exactly one set of colours to
 * design against and review.
 *
 * The dark tokens are still in globals.css, deliberately: they are written
 * (dark is not the light values dimmed — the blooms carry more chroma, the
 * panels are lighter than their ground rather than darker, the hairlines
 * invert), and throwing them away would mean writing them again. To turn dark
 * mode back on: drop `forcedTheme` here, set `defaultTheme="system"` with
 * `enableSystem`, and put a three-way Light / Dark / System control back in the
 * header. Nothing else needs to change.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
