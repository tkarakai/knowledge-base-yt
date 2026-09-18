import type { Metadata } from "next";
import { headers } from "next/headers";
import "./kb.css";
import "./explorations.css";

export const metadata: Metadata = {
  title: "Commonplace · Your knowledge, considered",
  description: "A local workspace for the things worth remembering.",
  robots: { index: false, follow: false },
};

export default async function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Nonce-based CSP needs request-time rendering for Next's bootstrap scripts.
  await headers();
  return (
    <html lang="en">
      <body className="kb-body">{children}</body>
    </html>
  );
}
