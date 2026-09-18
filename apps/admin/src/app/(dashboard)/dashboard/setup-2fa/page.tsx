import { redirect } from "next/navigation";

export default function LegacySetup2faPage() {
  redirect("/configure/setup-2fa");
}
