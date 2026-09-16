import "./globals.css";
import { EnvironmentBannerWrapper } from "@repo/design-system";

/**
 * Root layout — provides the required html/body shell for Next.js 16 static export.
 * Locale-specific lang and dir attributes are applied by [locale]/layout.tsx
 * via an inline script that runs synchronously before paint.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <EnvironmentBannerWrapper appName="landing-static" />
        {children}
      </body>
    </html>
  );
}
