# Denta Cure Dental Clinic — website

A single-page, static marketing site for **Denta Cure Dental Clinic** in San Fernando City, La Union.

No build step, no framework, no dependencies. Open it, or serve the folder with any static host.

---

## Preview locally

```powershell
cd DentaCure-Website
python -m http.server 4173
```

Then open <http://localhost:4173/>.

Opening `index.html` directly from disk also works, but the Google Maps embed needs an internet connection. All clinic photos and fonts are bundled locally.

---

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | All page content, SVG icon sprite, metadata and structured data |
| `styles.css` | Design system, layout and every responsive breakpoint |
| `script.js` | Mobile menu, smile matcher, gallery lightbox, FAQ, booking wizard, live open/closed status |
| `assets/img/` | Clinic photography, logo and before/after sample (7 photos + 2 logo files) |
| `assets/fonts/` | Self-hosted Clash Display (headings) and Cabinet Grotesk (text), plus `fonts.css` |
| `assets/favicon.svg` | Sage-and-slate tooth favicon |
| `404.html` | Branded not-found page |
| `robots.txt`, `sitemap.xml` | Crawler and indexing hints |

---

## Typography & colour

- **Clash Display** for headlines and numbers; **Cabinet Grotesk** for body and UI. Both are self-hosted
  `.woff2` files, subset-free, with a `font-display: swap` fallback - no Google Fonts request.
- The palette is sampled from the clinic's logo: sage `#99AC86` and slate `#737D84`, over warm paper
  `#F5FAF0`. Slate `#2A3A44` is the ink and top-bar colour; deep sage `#5B6E4A` is the accessible
  accent on light backgrounds.
- Change the two font stacks in `styles.css` (`--font-display`, `--font-body`) and the preload in
  `index.html` when swapping typefaces.

---

## Where the content came from

Verified from the clinic's public Facebook page and its Google Site:

- Facebook: <https://www.facebook.com/profile.php?id=61559999121667>
- Google Site: `sites.google.com/student.dmmmsu.edu.ph/dentacuredentalclinic` (services, about, FAQs)

**Address:** Unit A, 2nd Floor, Grand Plaza Building, Brgy. Sevilla, McArthur Highway, San Fernando City, La Union (beside Ilaw Atbp)
**Phone / text:** 0976 485 7648 — **Email:** my.dentacure@gmail.com
**Founder:** Pauline Trinidad-Acosta, DMD

The 7 services, mission, vision, founder quote and FAQs are based on publicly posted clinic material.

### Photos

All photos come from the clinic's own public Facebook posts. Overlaid promo text and the DentaCure watermark strip were cropped off; the images were not otherwise altered.

These include photos of children. **Get written permission from the clinic (and ideally the parents) before publishing.** If permission is not available, swap them for the treatment-room and staff photos.

---

## ⚠️ Opening hours need confirmation

The clinic's public sources disagree:

| Source | Mon–Sat | Sunday |
| --- | --- | --- |
| Facebook "Clinic Hours" graphic | 9:00 AM – 5:30 PM | 1:00 – 5:00 PM |
| Older Facebook footer graphic | 9:00 AM – 6:00 PM | By appointment |
| Google Site | 9:00 AM – 6:00 PM | By appointment |

The clinic confirms it is open **7 days a week: Mon–Sat 9:00 AM – 5:30 PM, Sunday 1:00 PM – 6:00 PM**.

If the clinic confirms different hours, update **all three** places:

1. `index.html` → the hours table in `#visit` (`data-days="1,2,3,4,5"` etc.)
2. `index.html` → `openingHoursSpecification` in the JSON-LD block
3. `script.js` → `openStatus()` and the `times` / `timesSunday` slot arrays

The "Open now / Closed" pill is calculated live in `Asia/Manila`, so it follows those numbers automatically.

---

## Booking form

The 3-step wizard posts JSON to `/api/book`, a Cloudflare Pages Function in
`functions/api/book.js`:

- Step 1 — treatment + first visit/returning
- Step 2 — date + time (Sunday shows only 1:00–5:00 PM slots; a "flexible" option skips both)
- Step 3 — name, phone, optional email and notes, consent
- Success panel — "Request sent", or a pre-filled email fallback when delivery is unavailable

The function re-validates everything server-side (treatment, date window in
`Asia/Manila`, weekday/Sunday slots, phone, consent), drops honeypot and
too-fast submissions, and rate-limits to 3 requests per IP per 2 minutes when a
KV binding is available. Nothing is stored unless the optional archive below is
bound.

### Email delivery (Resend)

Requests are emailed with [Resend](https://resend.com). Until a key is added,
the endpoint answers `503 not_configured` and the form automatically falls back
to the pre-filled mailto flow — the site never dead-ends.

1. Create a free Resend account using `my.dentacure@gmail.com`.
2. Create an API key.
3. Add it to the Pages project:

   ```powershell
   npx wrangler pages secret put RESEND_API_KEY --project-name dentacure-dental-clinic
   ```

4. Optional variables:
   - `BOOKING_TO` — recipient(s), comma separated. Defaults to `my.dentacure@gmail.com`.
   - `BOOKING_FROM` — sender. Leave the default `onboarding@resend.dev` until a
     domain is verified in Resend.

### Optional archive (KV)

Bind a KV namespace as `BOOKINGS` to keep a copy of every delivered request for
180 days (`booking:<timestamp>:<id>`). The same binding enables rate limiting.
Without it, requests are emailed only.

### Local development

```powershell
npx wrangler pages dev . --port 8788
```

Put local-only values in `.dev.vars` (git-ignored), never in the repo:

```
RESEND_API_KEY=re_test
```

The plain static preview (`python -m http.server`) has no Functions, so
`/api/book` returns 404 there and the form exercises its email fallback.

---

## Deploying

The site is live on Cloudflare Pages, connected to GitHub, so every push to `main` deploys automatically.

- **Live:** <https://dentacure-dental-clinic.pages.dev/>
- **Repo:** <https://github.com/RammyJo/dentacure-dental-clinic>
- **Cloudflare project:** `dentacure-dental-clinic` — build command empty, output directory `/`, production branch `main`

To ship a change:

```powershell
cd DentaCure-Website
git add -A
git commit -m "Update opening hours"
git push
```

Cloudflare builds and promotes it in about a minute. Every other branch and pull request gets its own preview URL.

The folder also works unchanged on any other static host:

- **Netlify / Vercel / Cloudflare Pages** — drag the folder in, no build command
- **GitHub Pages** — publish the folder as the site root
- **cPanel / shared hosting** — upload the contents to `public_html`

If you attach a custom domain, update `og:url`, `og:image`, `twitter:image` and `<link rel="canonical">` in `index.html` to the new absolute URLs, or social previews will point at the `.pages.dev` address.

Social preview images must be **absolute URLs**. They currently point at `https://dentacure-dental-clinic.pages.dev/assets/img/dr-acosta-portrait.jpg`.

---

## Accessibility & performance notes

- Semantic landmarks, skip link, visible focus rings, labelled form controls
- `prefers-reduced-motion` disables reveals, counters, parallax and smooth scrolling
- Keyboard support for the FAQ, lightbox (`←` / `→` / `Esc`) and the mobile menu (`Esc`)
- No horizontal overflow from 320 px to 1920 px
- Photos and fonts are bundled; only the optional map embed loads from the network
- Every image has intrinsic `width`/`height` (no layout shift); below-the-fold photos are lazy-loaded
- Logos are WebP (23 KB + 5 KB) instead of the original 99 KB + 182 KB PNGs
- `robots.txt`, `sitemap.xml` and a branded `404.html` are included; the map iframe is lazy and titled
- JSON-LD covers address, phone, geo, hours, map and social profile; HSTS is enabled in `_headers`
