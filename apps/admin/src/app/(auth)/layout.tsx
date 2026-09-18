import { ForceSystemTheme } from "@/components/auth/force-system-theme";
import { GuestGuard } from "@/components/auth/guest-guard";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GuestGuard>
      <ForceSystemTheme />
      {children}
    </GuestGuard>
  );
}
