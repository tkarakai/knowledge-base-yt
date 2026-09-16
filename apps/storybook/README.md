# Component Storybook (@repo/storybook)

> **This is NOT [@storybook/react](https://storybook.js.org/).** This is a custom Next.js app
> that showcases the components in `@repo/design-system`. Think of it as a lightweight, zero-config
> alternative tailored to this monorepo's design system.

## Keeping the showcase in sync with the design system

Every component in `@repo/design-system` should have a corresponding showcase entry here.
When you add, change, or remove a component from the design system, update this
app to match.

### Adding a component

1. **Create a showcase file** at `src/showcase/<slug>.tsx`

   Export a default React component that renders live, interactive demos of the
   new component. Look at any existing showcase file for the pattern — they use
   the `DemoSection` wrapper from `src/components/demo-section.tsx`.

2. **Register it** in `src/lib/registry.ts`

   Add an entry to the `componentRegistry` array:

   ```ts
   {
     name: "My Component",
     slug: "my-component",
     category: "Form",              // one of the ComponentCategory values
     description: "Short summary.",  // shown on the category overview cards
   },
   ```

3. **Wire up the showcase** in `src/showcase/index.ts`

   Import your showcase component and add it to `showcaseMap`:

   ```ts
   import MyComponentShowcase from "./my-component";
   // …
   "my-component": MyComponentShowcase,
   ```

That's it — the sidebar, routes, breadcrumbs, and category pages are all
generated from the registry automatically.

### Changing a component

If a component's API or visuals change in `@repo/design-system`, update its showcase file
in `src/showcase/` to reflect the new behavior. No registry changes needed
unless the name, slug, category, or description should change.

### Removing a component

1. Remove the entry from `componentRegistry` in `src/lib/registry.ts`
2. Remove the import and map entry from `src/showcase/index.ts`
3. Delete the showcase file from `src/showcase/`

## Development

```bash
# From the project root
bun run dev:storybook    # starts on port 3003

# Or directly
cd apps/storybook && bun run dev
```

## Testing

```bash
cd apps/storybook && bun run test:e2e       # headless
cd apps/storybook && bun run test:e2e:ui    # interactive Playwright UI
```
