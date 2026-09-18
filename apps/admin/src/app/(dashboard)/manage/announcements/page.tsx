import { AnnouncementsFeatureCard } from "@/components/features/announcements-feature-card";

export default function AnnouncementsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Announcements</h1>
        <p className="text-sm text-muted-foreground">
          Manage banner announcements for landing and web apps.
        </p>
      </div>
      <AnnouncementsFeatureCard />
    </div>
  );
}
