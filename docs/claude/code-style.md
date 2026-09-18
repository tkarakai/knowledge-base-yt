# Code Style Guide

> Detailed guide for AI agents. See `CLAUDE.md` for the quick reference.

## TypeScript

- **Strict mode** is enabled - no implicit `any` types
- Use **explicit return types** for functions exported from modules
- Prefer **`const`** over `let`, never use `var`
- Use **template literals** for string concatenation

```typescript
// Good
export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// Bad
export function formatPrice(amount) {
  return "$" + amount.toFixed(2);
}
```

## React Components

- Use **function components** exclusively (no class components)
- Use **Radix UI primitives** from `@repo/design-system` for accessibility
- Shared components go in `packages/design-system/src/`, app-specific in `apps/<app>/src/components/`
- Use package imports for shared code, path aliases for app-internal code

```typescript
// App component: apps/web/src/components/launchpad/item-card.tsx
"use client";

import { Button } from "@repo/design-system";            // Shared UI
import { cn } from "@repo/design-system";                 // Utility from shared package
import { api } from "@repo/backend";           // Convex API
import { useMutation } from "convex/react";

interface ItemCardProps {
  className?: string;
  children: React.ReactNode;
}

export function ItemCard({ className, children }: ItemCardProps) {
  const deleteItem = useMutation(api.launchItems.remove);

  return (
    <div className={cn("base-styles", className)}>
      {children}
    </div>
  );
}
```

## Convex Backend

- **Schema** is defined in `packages/backend/convex/schema.ts`
- Use `v` validator for all fields
- Queries are read-only, mutations modify data
- Always validate inputs and handle errors

```typescript
// packages/backend/convex/myModule.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getItem = query({
  args: { id: v.id("items") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const createItem = mutation({
  args: { title: v.string(), priority: v.number() },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("items", {
      ...args,
      createdAt: Date.now(),
    });
    return id;
  },
});
```

## CSS / Styling

- Use **Tailwind CSS v4** utility classes
- Use `cn()` utility from `@repo/design-system` for conditional classes
- Follow **mobile-first** responsive design
- Use **CSS variables** for theming (`--foreground`, `--background`, etc.)

```typescript
import { cn } from "@repo/design-system";

<div className={cn(
  "flex items-center gap-2 p-4",
  isActive && "bg-primary text-primary-foreground",
  className
)}>
```
