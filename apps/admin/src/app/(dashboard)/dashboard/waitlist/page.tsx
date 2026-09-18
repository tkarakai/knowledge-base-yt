import { redirect } from "next/navigation";

export default function LegacyWaitlistPage() {
  redirect("/manage/onboarding");
}
