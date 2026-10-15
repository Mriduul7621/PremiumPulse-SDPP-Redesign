# Premium Pulse — SDPP-inspired redesign

Updated the application shell, navigation, typography, backgrounds, forms, cards, buttons and tables to follow the light SDPP visual language. Removed the decorative remote background imagery. Retained Premium Pulse product selection, calculations, rate tables, comparison, quotation and PDF workflows. No calculation formula or rate data was modified.

Run `npm install` then `npm run dev`. Validate product-specific quotations against your approved reference values before production use.

## Quotation report redesign (October 2026)

Reviewed the supplied two-page SDPP illustration and five-page MetLife quote.
The downloaded quotation now combines the SDPP summary / projection structure
with the MetLife personalization and coverage hierarchy, without the large
marketing cover or a screenshot of the calculator.

- `src/lib/quotationModel.ts`: visible, typed report data mapping; uses existing
  calculation results, not a second calculation engine.
- `src/lib/quotationPdf.ts`: A4 layout, selectable report text, restrained olive /
  deep-green branding, repeated headers, page numbers, row-aware tables and notes.
- The example Elite / age 47 / 12-year report fits two pages. Longer schedules and
  combinations continue at a readable size instead of shrinking or clipping.
- All SDPP variants, regular / single-payment plans, staged plans, child stipends,
  combination policies, rider expiry, custom rates and optional surrender scenarios
  are handled. Combination policies retain separate premiums / obligations.
- SDPP engine assumptions are unchanged: the legacy `maturity7` / `maturity9`
  fields actually use **6.5% / 8.5%**; labels now reflect this. Yearly account
  projections use 8%, clearly distinguished from cash surrender value.
- Currency uses explicit BDT. Bengali personal details use a locally bundled
  OFL-licensed Noto Sans Bengali font and browser shaping; those personal lines
  are rasterized, while the rest of the PDF remains searchable. No external
  font service is required for PDF export.
- The on-screen calculator, detailed preview, print action and comparison tools
  remain available. PDF schedules are included even where the embedded preview
  omits them. Native Android still uses the existing filesystem / share workflow.
- Offline cache revision is bumped and the local Bengali font is precached.
  Production builds continue to use hashed JS/CSS assets. Same-origin static
  asset cache lookups tolerate Origin/Vary differences so offline module and
  font requests work after precaching.
- Lockfile repaired for reproducible `npm ci`; dependencies patched and a `qs`
  security override applied. Existing Capacitor / Vite type-check errors fixed.

### Verification

```sh
npm ci
npm run lint
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
npm audit
```

Browser regression tests cover generated text, financial figures, media-box
bounds, page numbering, long schedules, Bengali names, desktop / mobile download
buttons, zoom independence, failure / retry and the complete calculation journey.
A production-build regression also verifies Bengali-name exports and app reloads
with the browser offline. Test-only HTML entries are not referenced by the production build. Generated
reports and screenshots stay in ignored `test-results/`, not source control.

These checks do not constitute actuarial certification. Confirm financial rules
and approved policy wording with the insurer, and verify native save/share on a
physical Android device before a public release.
