import "./globals.css";

/**
 * Root layout — delegates to [locale]/layout.tsx for the actual html/body shell.
 * This file exists because Next.js requires a root layout.
 * Keep it minimal; all providers and the <html>/<body> tags live in the locale layout.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
