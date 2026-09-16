import { AuditTrailDataTable } from "@/components/audit-trail/audit-trail-data-table";

export default function AuditTrailPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Trail</h1>
        <p className="text-sm text-muted-foreground">
          View authentication events and admin actions across the system.
        </p>
      </div>
      <AuditTrailDataTable />
    </div>
  );
}
