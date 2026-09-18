import { redirect } from "next/navigation";

export default function LegacyAuditTrailPage() {
  redirect("/monitor/audit-trail");
}
