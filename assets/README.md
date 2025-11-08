# Assets

This directory is the source of truth for design and media artifacts. Files stored here should not be imported directly in the application; export optimized derivatives to the runtime folders described below.

## Folder Layout

- `fonts/` – custom typefaces, licensing documents, original font files.
- `image/` – high-resolution artwork, logos, and favicon masters (`fav.png`).
- `raw/` – working design files grouped by feature (Figma exports, PSD, AI, etc.). Remove intermediates once optimized assets are checked in.

## Export Workflow

1. Prepare the master asset in `image/` (for example `fav.png`).
2. Generate optimized derivatives for the web using tools such as Squoosh CLI or ImageMagick. Capture the command sequence in this file when introducing new asset families.
3. Copy the optimized output into `public/` (for general static assets) or `src/app/*.png` for App Router icons like favicons and touch icons.
4. Verify the asset in the browser and remove unneeded temporary files from `raw/`.

## Favicons

- Update the master artwork in `assets/image/fav.png`.
- Export a 512×512 (or larger) optimized PNG and copy it to `src/app/icon.png` for Next.js App Router favicon handling.
- Copy the optimized asset to `public/favicon.png` for legacy favicon fallbacks.
- Clear browser caches when manually testing to ensure the latest icon is served.
