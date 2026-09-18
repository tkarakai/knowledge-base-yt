"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@repo/auth/client";
import { ThemeToggle } from "@repo/design-patterns";
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system";
import { LogOut } from "lucide-react";

export function OnboardingProfileMenu() {
  const router = useRouter();
  const [session, setSession] = React.useState<{
    name: string;
    email: string;
  } | null>(null);

  React.useEffect(() => {
    authClient.getSession().then((res) => {
      if (res.data?.session) {
        const user = res.data.user as Record<string, unknown>;
        setSession({
          name: (user?.name as string) ?? (user?.email as string) ?? "",
          email: (user?.email as string) ?? "",
        });
      }
    });
  }, []);

  if (!session) return null;

  const initials = session.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => router.push("/sign-in"),
      },
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-2">
          <Avatar className="h-6 w-6 border border-border/60">
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium hidden sm:inline">{session.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
          {session.email}
        </div>
        <DropdownMenuSeparator />
        <ThemeToggle className="mx-1 my-1" />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={handleSignOut}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
