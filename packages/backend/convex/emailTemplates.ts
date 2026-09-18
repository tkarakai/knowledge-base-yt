// ---------------------------------------------------------------------------
// Email template types, defaults, and rendering
// ---------------------------------------------------------------------------

/** Shape of a stored email template (subject + HTML + plain text). */
export type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

/** Variables available for substitution in invitation email templates. */
export type TemplateVariables = {
  invitation_link: string;
  recipient_name: string;
  expiry_days: string;
};

/** Metadata about each invitation template variable (for admin UI reference). */
export const TEMPLATE_VARIABLES: {
  name: keyof TemplateVariables;
  description: string;
}[] = [
  {
    name: "invitation_link",
    description: "The unique signup URL for this invitation",
  },
  {
    name: "recipient_name",
    description: "The recipient's display name (or \"there\" if unknown)",
  },
  {
    name: "expiry_days",
    description: "Number of days until the invitation expires",
  },
];

/** Variables available for substitution in verification email templates. */
export type VerificationTemplateVariables = {
  verification_link: string;
  link_expiry: string;
};

/** Metadata about each verification template variable (for admin UI reference). */
export const VERIFICATION_TEMPLATE_VARIABLES: {
  name: keyof VerificationTemplateVariables;
  description: string;
}[] = [
  {
    name: "verification_link",
    description: "The link the user clicks to verify their email address",
  },
  {
    name: "link_expiry",
    description:
      "How long the verification link is valid for (e.g. \"1 hour\")",
  },
];

/**
 * Convert a duration in seconds to a human-readable string.
 * Examples: 3600 → "1 hour", 7200 → "2 hours", 1800 → "30 minutes", 86400 → "24 hours".
 */
export function formatDurationHuman(seconds: number): string {
  if (seconds < 60) {
    return seconds === 1 ? "1 second" : `${seconds} seconds`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  const hourPart = hours === 1 ? "1 hour" : `${hours} hours`;
  const minutePart =
    remainingMinutes === 1 ? "1 minute" : `${remainingMinutes} minutes`;
  return `${hourPart} and ${minutePart}`;
}

/** Escape HTML special characters to prevent XSS in email templates. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Default invitation email template
// ---------------------------------------------------------------------------

export const DEFAULT_EMAIL_TEMPLATE: EmailTemplate = {
  subject: "You're invited — let's get you set up",
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header accent -->
          <tr>
            <td style="height: 4px; background: linear-gradient(135deg, #18181b 0%, #3f3f46 100%);"></td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 36px 32px;">
              <h1 style="margin: 0 0 24px; font-size: 22px; font-weight: 700; color: #18181b; line-height: 1.3;">
                You're invited!
              </h1>
              <p style="margin: 0 0 16px; font-size: 15px; color: #3f3f46; line-height: 1.6;">
                Hi {{recipient_name}},
              </p>
              <p style="margin: 0 0 28px; font-size: 15px; color: #3f3f46; line-height: 1.6;">
                We're excited to have you on board. Click the button below to create your account and get started.
              </p>
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 28px;">
                <tr>
                  <td style="border-radius: 8px; background-color: #18181b;">
                    <a href="{{invitation_link}}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                      Accept invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; font-size: 13px; color: #71717a; line-height: 1.5;">
                This invitation expires in {{expiry_days}} days. If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding: 0 36px;">
              <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 0;">
            </td>
          </tr>
          <!-- Fallback URL -->
          <tr>
            <td style="padding: 20px 36px 32px;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; line-height: 1.5;">
                If the button doesn't work, copy and paste this URL into your browser:
              </p>
              <p style="margin: 6px 0 0; font-size: 12px; color: #a1a1aa; line-height: 1.5; word-break: break-all;">
                {{invitation_link}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  text: `You're invited!

Hi {{recipient_name}},

We're excited to have you on board. Visit the link below to create your account and get started:

{{invitation_link}}

This invitation expires in {{expiry_days}} days. If you didn't request this, you can safely ignore this email.`,
};

// ---------------------------------------------------------------------------
// Default verification email template
// ---------------------------------------------------------------------------

export const DEFAULT_VERIFICATION_EMAIL_TEMPLATE: EmailTemplate = {
  subject: "Verify your email address",
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header accent -->
          <tr>
            <td style="height: 4px; background: linear-gradient(135deg, #18181b 0%, #3f3f46 100%);"></td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 36px 32px;">
              <h1 style="margin: 0 0 24px; font-size: 22px; font-weight: 700; color: #18181b; line-height: 1.3;">
                Verify your email
              </h1>
              <p style="margin: 0 0 28px; font-size: 15px; color: #3f3f46; line-height: 1.6;">
                Thanks for signing up! Please verify your email address by clicking the button below:
              </p>
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 28px;">
                <tr>
                  <td style="border-radius: 8px; background-color: #18181b;">
                    <a href="{{verification_link}}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                      Verify email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; font-size: 13px; color: #71717a; line-height: 1.5;">
                This link is valid for {{link_expiry}}. If you didn't create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding: 0 36px;">
              <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 0;">
            </td>
          </tr>
          <!-- Fallback URL -->
          <tr>
            <td style="padding: 20px 36px 32px;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; line-height: 1.5;">
                If the button doesn't work, copy and paste this URL into your browser:
              </p>
              <p style="margin: 6px 0 0; font-size: 12px; color: #a1a1aa; line-height: 1.5; word-break: break-all;">
                {{verification_link}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  text: `Verify your email address

Thanks for signing up! Please verify your email address by visiting:

{{verification_link}}

This link is valid for {{link_expiry}}. If you didn't create an account, you can safely ignore this email.`,
};

// ---------------------------------------------------------------------------
// Template rendering
// ---------------------------------------------------------------------------

/**
 * Replace `{{variable_name}}` placeholders with actual values.
 * Unknown variables are left as-is.
 */
export function renderTemplate(
  template: string,
  variables: TemplateVariables
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (key in variables) {
      return variables[key as keyof TemplateVariables];
    }
    return match;
  });
}

/**
 * Replace `{{variable_name}}` placeholders with actual values (generic version).
 * Unknown variables are left as-is.
 */
export function renderTemplateGeneric(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (key in variables) {
      return variables[key];
    }
    return match;
  });
}

/**
 * Render all three fields of an email template.
 * HTML-escapes variable values for subject/html; leaves them raw for text.
 */
export function renderEmailTemplate(
  template: EmailTemplate,
  variables: TemplateVariables
): EmailTemplate {
  const escaped = Object.fromEntries(
    Object.entries(variables).map(([k, v]) => [k, escapeHtml(v)])
  ) as TemplateVariables;
  return {
    subject: renderTemplate(template.subject, escaped),
    html: renderTemplate(template.html, escaped),
    text: renderTemplate(template.text, variables),
  };
}

/**
 * Render a verification email template with the given verification link.
 * HTML-escapes the link for html/subject; leaves it raw for text.
 */
export function renderVerificationEmailTemplate(
  template: EmailTemplate,
  variables: VerificationTemplateVariables
): EmailTemplate {
  const escaped: Record<string, string> = {
    verification_link: escapeHtml(variables.verification_link),
    link_expiry: escapeHtml(variables.link_expiry),
  };
  const raw: Record<string, string> = {
    verification_link: variables.verification_link,
    link_expiry: variables.link_expiry,
  };
  return {
    subject: renderTemplateGeneric(template.subject, escaped),
    html: renderTemplateGeneric(template.html, escaped),
    text: renderTemplateGeneric(template.text, raw),
  };
}