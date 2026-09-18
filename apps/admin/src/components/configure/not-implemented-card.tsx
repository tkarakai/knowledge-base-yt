import type { LucideIcon } from "lucide-react";

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system";

type NotImplementedCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  note?: string;
};

export function NotImplementedCard({
  icon: Icon,
  title,
  description,
  note = "Not implemented yet",
}: NotImplementedCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Badge variant="outline">{note}</Badge>
      </CardContent>
    </Card>
  );
}
