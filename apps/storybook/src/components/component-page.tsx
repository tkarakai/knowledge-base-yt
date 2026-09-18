import { Separator } from "@repo/design-system";

interface ComponentPageProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function ComponentPage({
  title,
  description,
  children,
}: ComponentPageProps) {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-2 text-base text-muted-foreground leading-relaxed">
          {description}
        </p>
        <Separator className="mt-6" />
      </div>
      {children}
    </div>
  );
}
