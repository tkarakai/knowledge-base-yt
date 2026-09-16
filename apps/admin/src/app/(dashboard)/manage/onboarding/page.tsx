"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system";
import { WaitlistDataTable } from "@/components/waitlist/waitlist-data-table";
import { OnboardingModeNote } from "@/components/onboarding/onboarding-mode-note";
import { AdminsDataTable } from "@/components/onboarding/admins-data-table";

export default function OnboardingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Onboarding Queue
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage waitlist entries, invitations, and admin accounts.
        </p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="admins">Admins</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-4">
          <OnboardingModeNote />
          <WaitlistDataTable />
        </TabsContent>

        <TabsContent value="admins" className="mt-4">
          <AdminsDataTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
