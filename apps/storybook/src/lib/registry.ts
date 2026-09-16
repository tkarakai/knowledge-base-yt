export type ComponentCategory =
  | "Actions"
  | "Data Display"
  | "Feedback"
  | "Form"
  | "Layout"
  | "Overlay";

export interface ComponentEntry {
  /** Display name shown in sidebar and headings */
  name: string;
  /** URL slug used in /components/<slug> routes */
  slug: string;
  /** Grouping category for sidebar navigation */
  category: ComponentCategory;
  /** Short description for overview cards */
  description: string;
}

export const componentRegistry: ComponentEntry[] = [
  // Actions
  {
    name: "Button",
    slug: "button",
    category: "Actions",
    description: "Trigger actions and events with multiple variants.",
  },
  {
    name: "Dropdown Menu",
    slug: "dropdown-menu",
    category: "Actions",
    description: "Contextual menu with actions and submenus.",
  },
  {
    name: "Toggle",
    slug: "toggle",
    category: "Actions",
    description: "Two-state toggle button.",
  },

  // Data Display
  {
    name: "Avatar",
    slug: "avatar",
    category: "Data Display",
    description: "User profile images with fallbacks.",
  },
  {
    name: "Badge",
    slug: "badge",
    category: "Data Display",
    description: "Status indicators and labels.",
  },
  {
    name: "Card",
    slug: "card",
    category: "Data Display",
    description: "Container for grouped content.",
  },
  {
    name: "Copyable Field",
    slug: "copyable-field",
    category: "Data Display",
    description: "Read-only field with an inline copy-to-clipboard button.",
  },
  {
    name: "Styled QR Code",
    slug: "styled-qr-code",
    category: "Data Display",
    description: "Modern QR code with dot modules, custom colors, and optional center icon.",
  },
  {
    name: "Table",
    slug: "table",
    category: "Data Display",
    description: "Structured data in rows and columns.",
  },

  // Feedback
  {
    name: "Alert",
    slug: "alert",
    category: "Feedback",
    description: "Important messages and callouts.",
  },
  {
    name: "Announcement Banner",
    slug: "announcement-banner",
    category: "Feedback",
    description: "Product announcement strip with optional CTA and learn-more modal.",
  },
  {
    name: "Progress",
    slug: "progress",
    category: "Feedback",
    description: "Show completion progress.",
  },
  {
    name: "Skeleton",
    slug: "skeleton",
    category: "Feedback",
    description: "Placeholder for loading content.",
  },
  {
    name: "Environment Banner",
    slug: "environment-banner",
    category: "Feedback",
    description: "Deployment environment indicator for dev and staging.",
  },
  {
    name: "Offline Banner",
    slug: "offline-banner",
    category: "Feedback",
    description: "Network status banner with frosted-glass backdrop blur.",
  },
  {
    name: "Passkey Unsupported Alert",
    slug: "passkey-unsupported-alert",
    category: "Feedback",
    description: "Amber info block for browsers that do not support passkeys.",
  },
  {
    name: "Tooltip",
    slug: "tooltip",
    category: "Feedback",
    description: "Informational popup on hover.",
  },

  // Form
  {
    name: "Checkbox",
    slug: "checkbox",
    category: "Form",
    description: "Toggle a single option on or off.",
  },
  {
    name: "Input",
    slug: "input",
    category: "Form",
    description: "Single-line text input field.",
  },
  {
    name: "OTP Input",
    slug: "otp-input",
    category: "Form",
    description: "Individual digit boxes for one-time password entry with auto-advance.",
  },
  {
    name: "Password Strength Meter",
    slug: "password-strength-meter",
    category: "Form",
    description: "Real-time password strength feedback with crack time estimation.",
  },
  {
    name: "Radio Group",
    slug: "radio-group",
    category: "Form",
    description: "Select one option from a set.",
  },
  {
    name: "Select",
    slug: "select",
    category: "Form",
    description: "Pick an option from a dropdown list.",
  },
  {
    name: "Switch",
    slug: "switch",
    category: "Form",
    description: "Toggle between on and off states.",
  },
  {
    name: "Textarea",
    slug: "textarea",
    category: "Form",
    description: "Multi-line text input field.",
  },

  // Layout
  {
    name: "Breadcrumb",
    slug: "breadcrumb",
    category: "Layout",
    description: "Navigation trail showing page hierarchy.",
  },
  {
    name: "Separator",
    slug: "separator",
    category: "Layout",
    description: "Visual divider between content.",
  },
  {
    name: "Sidebar",
    slug: "sidebar",
    category: "Layout",
    description: "Collapsible side navigation panel.",
  },
  {
    name: "Tabs",
    slug: "tabs",
    category: "Layout",
    description: "Organize content into switchable panels.",
  },

  // Overlay
  {
    name: "Alert Dialog",
    slug: "alert-dialog",
    category: "Overlay",
    description: "Confirmation before destructive actions.",
  },
  {
    name: "Dialog",
    slug: "dialog",
    category: "Overlay",
    description: "Modal dialog for focused interactions.",
  },
  {
    name: "Popover",
    slug: "popover",
    category: "Overlay",
    description: "Floating content anchored to a trigger.",
  },
  {
    name: "Sheet",
    slug: "sheet",
    category: "Overlay",
    description: "Slide-out panel from screen edge.",
  },
];

/** Categories in display order */
export const categoryOrder: ComponentCategory[] = [
  "Actions",
  "Data Display",
  "Feedback",
  "Form",
  "Layout",
  "Overlay",
];

/** Convert a category name to a URL-friendly slug */
export function categoryToSlug(category: ComponentCategory): string {
  return category.toLowerCase().replace(/\s+/g, "-");
}

/** Resolve a URL slug back to a category name */
export function slugToCategory(slug: string): ComponentCategory | undefined {
  return categoryOrder.find((c) => categoryToSlug(c) === slug);
}

/** Group registry entries by category */
export function getComponentsByCategory(): Record<
  ComponentCategory,
  ComponentEntry[]
> {
  const grouped = {} as Record<ComponentCategory, ComponentEntry[]>;
  for (const cat of categoryOrder) {
    grouped[cat] = componentRegistry.filter((c) => c.category === cat);
  }
  return grouped;
}
