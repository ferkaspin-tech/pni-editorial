# CLAUDE.md

Guidance for AI assistants (Claude Code and others) working in this repository.

## What this is

A **static marketing website** for **Renacer en Digital** — Fer Kaspin's brand
for applying AI to small businesses. There is **no build step, no framework, no
package manager, and no backend**. Every page is a hand-authored HTML file at the
repository root, styled with shared CSS and enhanced with a little vanilla JS.

The site is deployed via **GitHub Pages** to the custom domain in `CNAME`
(`www.renacerendigital.com`). Pushing to the deployment branch publishes the
site — there is nothing to compile.

Content is in **Spanish (Argentina/LatAm voice)** — use "vos" form and keep the
warm, editorial, professional tone of the existing copy.

## Layout

All pages live at the repo root (this matters: see `image-slot.js` note below).

```
index.html                  Home — Renacer en Digital (hero, pillars, Fer bio, method, testimonials)
PNI.html                    Landing for the PNI program (Programa de Negocios Inteligentes)
diagnostico.html            Interactive multi-step quiz that ends in a prefilled WhatsApp message
recursos.html               Index of educational resource articles
recurso-*.html              Individual resource articles (7 of them, Claude/AI explainers)

styles.css                  Global design system — used by EVERY page
pni.css                     PNI-only styles; extends styles.css (loaded after it on PNI.html)
image-slot.js               <image-slot> web component — fillable image placeholder (PNI.html only)

CNAME                       GitHub Pages custom domain
*.jpg / *.png / assets/     Brand images (Fer portraits, logos)
```

The `recurso-*.html` set: `ahorrar-tokens`, `conectores-claude`,
`empezar-negocio`, `estructura-claude`, `modos-claude`, `proyectos-claude`,
`que-es-un-skill`. They share the same article shell — when adding a new one,
copy an existing resource page and update content + link it from `recursos.html`.

## Design system (`styles.css`)

This is the single source of truth for the brand. **Always reuse its tokens and
component classes instead of hardcoding values.**

- **CSS custom properties** in `:root` define the palette and scale. Key colors:
  `--navy:#0E1B2D`, `--teal:#0F4C5C`, `--lavender:#ACA2C9`, `--mist`, `--sage`,
  plus tints (`--lav-tint`, `--teal-tint`, `--sage-tint`) and neutrals
  (`--ink`, `--muted`, `--line`). Spacing/shape tokens: `--maxw:1180px`,
  `--gutter`, `--r:14px`, `--shadow`, `--shadow-sm`, `--ease`.
- **Typography**: `--serif` = "Playfair Display" (headings, `.display`),
  `--sans` = "Montserrat" (body). Loaded from Google Fonts in each page `<head>`.
- **Layout helpers**: `.wrap` (max-width container), `.center`, `.eyebrow`,
  `.lead`, `.measure`, `.btn` (variants `.navy`, `.lg`), `.reveal` (scroll-in
  animation hook).
- Use `clamp()` for responsive sizing — the codebase does this consistently
  rather than relying on many breakpoints.

`pni.css` adds PNI-specific components (`.pni-hero`, `.pni-seal`, `.pni-stat`,
etc.) on top of the globals. It is only loaded by `PNI.html`.

## Shared page conventions

Every page follows the same `<head>`/structure pattern. When creating or editing
a page, keep these in sync:

1. `<html lang="es">`, viewport meta, `<link rel="stylesheet" href="styles.css">`.
2. `<script>document.documentElement.classList.add('reveal-on')</script>` early
   in `<head>` — primes the scroll-reveal animation.
3. **Meta Pixel** (Facebook) snippet with id `230704174608041` — present in the
   `<head>` of pages that track. Don't change the id without reason.
4. An inline SVG sprite (`<svg ...><defs><symbol id="...">`) near the top of
   `<body>` defining the logo `#mark` and `#i-*` icons, referenced via
   `<use href="#i-...">`. Reuse existing symbols; add new ones to the sprite.
5. Nav + mobile-menu markup (`#nav`, `#navToggle`, `#navlinks`).

### Inline JS patterns (no framework)

JavaScript is small, vanilla, and inlined at the bottom of `<body>` (plus the
`image-slot.js` file on PNI). Reuse these established patterns:

- **Nav scroll state**: toggles `.scrolled` on `#nav` past 10px scroll.
- **Mobile menu**: `#navToggle` toggles `.open` on `#navlinks`.
- **Accordion** (`#phases` on the home method section): one open at a time,
  animates via inline `maxHeight`.
- **Scroll reveal**: an `IntersectionObserver` adds `.in` to `.reveal` elements,
  with a failsafe timeout that forces them visible (so content can never stay
  stuck at `opacity:0` inside throttled iframes/preview frames).

### `diagnostico.html`

A self-contained multi-step quiz driven by a JS step array. It collects answers
and, on completion, builds a **prefilled WhatsApp message** to `WA_NUMBER`
(`https://wa.me/...?text=...`). There is no form POST and no server.

### `image-slot.js`

Defines the `<image-slot>` web component (a drag-to-fill image placeholder used
in `PNI.html`). It persists dropped images to a `.image-slots.state.json`
sidecar **at the project root** via a host "omelette" runtime bridge — this is
why the HTML using it must live at the root. Outside that runtime the slot is
read-only and just shows its placeholder/`src`. Read the header comment block in
the file before touching it.

## Primary CTAs

These recur across the site — keep them consistent when editing:

- **Offer / signup**: `https://www.ferkaspin.com/negociosinteligentesoferta`
  (the "Quiero mi lugar" buttons all point here).
- **WhatsApp**: `https://wa.me/50764147770`.

## Working in this repo

- **Run / preview**: open the HTML files directly in a browser, or serve the
  root statically (e.g. `python3 -m http.server`). No install, no build.
- **No tests, no linters, no CI** are configured. Verify changes by eye in a
  browser across desktop and mobile widths.
- **Editing copy**: keep Spanish voice and the editorial tone. Headlines use the
  serif (`.display`); don't introduce new fonts or raw hex colors when a token
  exists.
- **Cross-page consistency**: nav links, the Meta Pixel id, CTA URLs, and the
  SVG sprite are duplicated per page. A change to one usually needs to be applied
  to the others.
- **Assets**: large images already exist; reuse them. Optimize new images before
  committing (this is a static site served as-is).

## Git & deployment workflow

- Default/deploy branch is `main`; GitHub Pages serves from it onto the `CNAME`
  domain. Pushing to `main` publishes the live site.
- Do feature work on a branch and open a PR rather than committing straight to
  `main` for non-trivial changes.
- Commit messages in history are short and in Spanish, describing the visible
  change (e.g. "Fix: badge del hero en mobile"). Match that style.
