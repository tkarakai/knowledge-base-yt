import { redirect } from "next/navigation";

export default function LegacySessionsPage() {
  redirect("/manage/users");
}
