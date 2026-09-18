import { IntegrationProviderCard } from "@/components/configure/integration-provider-card";

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Configure external providers for communication and monitoring.
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <IntegrationProviderCard
          title="Email Provider"
          description="Choose the provider used for transactional and authentication emails."
          tabs={[
            { value: "resend", label: "Resend" },
            { value: "mailgun", label: "Mailgun" },
            { value: "postmark", label: "Postmark" },
          ]}
        />
        <IntegrationProviderCard
          title="SMS Provider"
          description="Choose the provider used for SMS-based messaging."
          tabs={[{ value: "twilio", label: "Twilio" }]}
        />
        <IntegrationProviderCard
          title="Observability"
          description="Configure error monitoring, telemetry, and logging providers."
          tabs={[
            { value: "sentry", label: "Sentry" },
            { value: "datadog", label: "Datadog" },
            { value: "new-relic", label: "New Relic" },
            { value: "grafana", label: "Grafana" },
          ]}
        />
      </div>
    </div>
  );
}
