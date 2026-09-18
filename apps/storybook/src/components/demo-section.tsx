interface DemoSectionProps {
  title: string;
  description?: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}

export function DemoSection({
  title,
  description,
  toolbar,
  children,
}: DemoSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {description}
            </p>
          )}
        </div>
        {toolbar && <div className="shrink-0">{toolbar}</div>}
      </div>
      <div className="overflow-hidden rounded-lg border border-border/60 bg-card/50 p-6">
        {children}
      </div>
    </div>
  );
}
