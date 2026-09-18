import type { Metadata } from "next";
import { headers } from "next/headers";
import { Raleway } from "next/font/google";
import { ThemeProvider } from "next-themes";

import "./globals.css";
import { ConvexClientProvider } from "@repo/auth/provider";
import { EnvironmentBannerWrapper, OfflineBanner } from "@repo/design-system";
import { getToken } from "@repo/auth/server";
import { ConvexErrorToast } from "@/components/convex-error-toast";

const raleway = Raleway({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Admin - Web App Starter",
  description: "Administration panel for Web App Starter.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [token, nonce] = await Promise.all([
    getToken(),
    headers().then((h) => h.get("x-nonce") ?? undefined),
  ]);

  return (
    <html lang="en" className={raleway.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem nonce={nonce}>
          <EnvironmentBannerWrapper appName="admin" />
          <OfflineBanner />
          <ConvexClientProvider initialToken={token}>
            <ConvexErrorToast />
            {children}
          </ConvexClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
