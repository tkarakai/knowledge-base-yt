import { ForceSystemTheme } from "@/components/auth/force-system-theme";

export default function OnboardingLayout({
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
