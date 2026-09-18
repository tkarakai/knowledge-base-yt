"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function TabsShowcase() {
  return (
    <>
      <DemoSection title="Basic Tabs">
        <Tabs defaultValue="tab1" className="max-w-md">
          <TabsList>
            <TabsTrigger value="tab1">Account</TabsTrigger>
            <TabsTrigger value="tab2">Password</TabsTrigger>
            <TabsTrigger value="tab3">Notifications</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">
            <p className="text-sm text-muted-foreground">
              Manage your account settings and preferences.
            </p>
          </TabsContent>
          <TabsContent value="tab2">
            <p className="text-sm text-muted-foreground">
              Change your password and security settings.
            </p>
          </TabsContent>
          <TabsContent value="tab3">
            <p className="text-sm text-muted-foreground">
              Configure how and when you receive notifications.
            </p>
          </TabsContent>
        </Tabs>
      </DemoSection>

      <DemoSection title="Tabs with Cards">
        <Tabs defaultValue="account" className="max-w-lg">
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
          </TabsList>
          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription>Update your account information.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tabs-name">Name</Label>
                  <Input id="tabs-name" defaultValue="John Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tabs-email">Email</Label>
                  <Input id="tabs-email" defaultValue="john@example.com" />
                </div>
                <Button>Save Changes</Button>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="password">
            <Card>
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>Change your password.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tabs-current">Current Password</Label>
                  <Input id="tabs-current" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tabs-new">New Password</Label>
                  <Input id="tabs-new" type="password" />
                </div>
                <Button>Update Password</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DemoSection>
    </>
  );
}
