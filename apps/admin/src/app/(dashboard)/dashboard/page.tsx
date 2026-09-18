import Link from "next/link";
import {
  ArrowRight,
  ListChecks,
  Megaphone,
  PlugZap,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/design-system";

const dashboardSections = [
  {
    title: "Configure",
    items: [
      {
        title: "Features",
        description: "Manage feature controls for the application.",
        href: "/configure/features",
        icon: SlidersHorizontal,
      },
      {
        title: "Security",
        description: "Security policies and authentication requirements.",
        href: "/configure/security",
        icon: ShieldCheck,
      },
      {
        title: "Integrations",
        description: "Configure external provider integrations.",
        href: "/configure/integrations",
        icon: PlugZap,
      },
    ],
  },
  {
    title: "Manage",
    items: [
      {
        title: "Announcements",
        description: "Manage banner announcements for landing and web apps.",
        href: "/manage/announcements",
        icon: Megaphone,
      },
      {
        title: "Onboarding",
        description: "Manage onboarding mode, waitlist entries, and invitations.",
        href: "/manage/onboarding",
        icon: ListChecks,
      },
      {
        title: "Users",
        description: "Manage user accounts, session access, and role permissions.",
        href: "/manage/users",
        icon: Users,
      },
    ],
  },
  {
    title: "Monitor",
    items: [
      {
        title: "Audit Trail",
        description: "View authentication events and admin actions across the system.",
        href: "/monitor/audit-trail",
        icon: ScrollText,
      },
    ],
  },
] as const;

export default function DashboardPage() {
  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-semibold tracking-tight">Welcome back, Admin</h1>

      {dashboardSections.map((section) => (
        <section key={section.title} className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full border-border/70 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:bg-accent/60 group-hover:shadow-md group-hover:shadow-primary/10">
                  <CardHeader className="pb-2">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>{item.title}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
