import { ForceSystemTheme } from "@/components/auth/force-system-theme";

export default function InvitationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ForceSystemTheme />
      {children}
    </>
  );
}
