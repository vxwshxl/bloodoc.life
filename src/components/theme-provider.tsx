"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Light / dark / system, system by default, with an explicit choice persisted
 * to localStorage. next-themes writes the resolved class onto <html> from a
 * blocking inline script, so the first paint is already the right theme — which
 * is why the root layout carries `suppressHydrationWarning` on <html>.
 *
 * `disableTransitionOnChange` suppresses transitions for the single frame in
 * which the class flips. Without it every colour transition in the tree fires
 * at once on toggle, and a switch reads as a smear.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
