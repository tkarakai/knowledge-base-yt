import {
  renderTemplate,
  renderTemplateGeneric,
  type TemplateVariables,
} from "@repo/backend";

// Re-export for convenience
export { TEMPLATE_VARIABLES, VERIFICATION_TEMPLATE_VARIABLES } from "@repo/backend";
export type { EmailTemplate } from "@repo/backend";

/** Sample values used when rendering invitation email previews in the admin UI. */
const SAMPLE_VALUES: TemplateVariables = {
  invitation_link: "https://example.com/signup-with-invitation?token=abc123",
  recipient_name: "Alex",
  expiry_days: "7",
};

/** Replace `{{variable}}` placeholders with sample values for preview. */
export function renderPreview(template: string): string {
  return renderTemplate(template, SAMPLE_VALUES);
}

/** Sample values used when rendering verification email previews in the admin UI. */
const VERIFICATION_SAMPLE_VALUES: Record<string, string> = {
  verification_link: "https://example.com/verify-email?token=abc123",
  link_expiry: "1 hour",
};

/** Replace `{{variable}}` placeholders with sample values for verification email preview. */
export function renderVerificationPreview(template: string): string {
  return renderTemplateGeneric(template, VERIFICATION_SAMPLE_VALUES);
}
