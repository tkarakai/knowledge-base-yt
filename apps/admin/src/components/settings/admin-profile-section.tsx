"use client";

import * as React from "react";

import { authClient } from "@repo/auth/client";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  toast,
} from "@repo/design-system";
import { useAuthUser } from "@/components/auth/auth-guard";

export function AdminProfileSection() {
  const authUser = useAuthUser();
  const [name, setName] = React.useState(authUser?.name ?? "");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setName(authUser?.name ?? "");
  }, [authUser?.name]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const result = await authClient.updateUser({ name: name.trim() });
      if (result.error) {
        toast.error(result.error.message ?? "Failed to update profile");
        return;
      }
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Manage your admin profile information.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <div className="space-y-2">
          <Label>Email</Label>
          <p className="text-sm">{authUser?.email ?? ""}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="admin-display-name">Display name</Label>
          <Input
            id="admin-display-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Admin User"
          />
        </div>

        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </CardContent>
    </Card>
  );
}
