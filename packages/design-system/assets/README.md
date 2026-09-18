# Shared Assets

This directory contains shared assets that are used across all applications in the monorepo.

## App Icon

The brand icon assets used across all applications. The SVG is the single source of truth.

| File | Format | Size | Purpose |
|------|--------|------|---------|
| `icon.svg` | SVG | 32×32 | Primary favicon (modern browsers) |
| `favicon.ico` | ICO | 32×32 | Legacy browser fallback |
| `apple-touch-icon.png` | PNG | 180×180 | iOS home screen bookmark |

### How It Works

1. **Source:** Assets are stored here in `packages/design-system/assets/`
2. **Distribution:** During build (and before dev), assets are automatically copied to each app's `public/` directory via `scripts/copy-shared-assets.sh`
3. **Usage:** Apps reference them in their Next.js metadata configuration

### Updating the Icon

1. Edit `icon.svg` (the source of truth)
2. Regenerate the raster variants from the SVG (see below)
3. Run `bun run copy-assets` (or it will run automatically on next build/dev)

To regenerate raster variants from the SVG:

```bash
# apple-touch-icon.png (180×180)
npx @resvg/resvg-js-cli --fit-width 180 icon.svg apple-touch-icon.png

# favicon.ico — generate 32×32 PNG then wrap in ICO container
npx @resvg/resvg-js-cli --fit-width 32 icon.svg /tmp/favicon-32.png
node -e "
const fs = require('fs');
const png = fs.readFileSync('/tmp/favicon-32.png');
const h = Buffer.alloc(6); h.writeUInt16LE(1,2); h.writeUInt16LE(1,4);
const d = Buffer.alloc(16); d.writeUInt8(32,0); d.writeUInt8(32,1);
d.writeUInt16LE(1,4); d.writeUInt16LE(32,6);
d.writeUInt32LE(png.length,8); d.writeUInt32LE(22,12);
fs.writeFileSync('favicon.ico', Buffer.concat([h,d,png]));
"
```

### Build Integration

The copy script runs automatically:
- **Before dev:** `bun run dev` → `predev` hook → `copy-shared-assets.sh`
- **Before build:** `bun run build` → `prebuild` hook → `copy-shared-assets.sh`

The script skips copying files that are already up to date.

### Where It's Used

All app layout files reference these icons:
- `apps/web/src/app/[locale]/layout.tsx`
- `apps/admin/src/app/layout.tsx`
- `apps/landing/src/app/[locale]/layout.tsx`
- `apps/landing-static/src/app/[locale]/layout.tsx`
- `apps/storybook/src/app/layout.tsx`
- `apps/demo/src/app/layout.tsx`

### Showcase

View the icons at the Storybook app:
- **Local:** http://localhost:3003/foundations/icons
- **Section:** Foundations > Icons > App Icon

## Adding More Shared Assets

1. Add the file to this directory
2. Add the filename to the `ASSETS` array in `scripts/copy-shared-assets.sh`
3. Reference it in your apps as `/filename.ext`
