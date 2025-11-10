# PWA Icons

This directory contains PWA icon files for the M3W music player.

## Generated Files

✅ **Icons are automatically generated from** `assets/image/fav.png`

- `pwa-192x192.png` - Small icon for mobile (192x192)
- `pwa-512x512.png` - Large icon for splash screen (512x512)
- `apple-touch-icon.png` - Apple devices icon (180x180)
- `favicon.png` - Standard favicon

## Regenerate Icons

If you update the source image (`assets/image/fav.png`), run:

```bash
npm run icons:generate
```

This will regenerate all PWA icons with the correct sizes and formats.

## Icon Requirements

- Use simple, recognizable design
- Ensure good contrast for visibility
- Test on light and dark backgrounds
- Include brand colors

### Technical Requirements

- PNG format with transparent background
- SVG for mask icon (monochrome)
- Sharp edges and clear details
- Proper padding (10% margin recommended)

## Generation Tools

You can generate PWA icons from a single source image using:

- [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator)
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [Favicon.io](https://favicon.io/)

## Quick Generate Command

```bash
npx pwa-asset-generator source-logo.svg public --icon-only --padding "10%" --background "#000000"
```

This will generate all required sizes automatically.
