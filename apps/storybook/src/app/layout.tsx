import type { Metadata } from "next";
import { Raleway } from "next/font/google";
import { ThemeProvider } from "next-themes";

import "./globals.css";
import { EnvironmentBannerWrapper } from "@repo/design-system";

const raleway = Raleway({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Component Storybook",
  description: "Interactive component showcase for the @repo/design-system design system.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={raleway.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <EnvironmentBannerWrapper appName="storybook" />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
