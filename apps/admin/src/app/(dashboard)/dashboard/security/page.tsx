import { redirect } from "next/navigation";

export default function LegacySecurityPage() {
  redirect("/settings?tab=security");
}
