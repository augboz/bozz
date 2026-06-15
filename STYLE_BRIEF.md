# BOZZ visual redesign brief — "calm glass"

## Mission
Restyle the entire BOZZ app to one coherent, premium, calm aesthetic. This is a
**visual/styling pass only**: do NOT change any functionality, data flow, routing,
component logic, sync behaviour, or layout structure (what widgets/sections exist
and where) unless a style change strictly requires a tiny structural tweak.
Everything must keep working exactly as it does today, for both desktop (Tauri)
and browser, in dark AND light mode.

## References being synthesized
1. **Weather dashboard (mindinventory)** — deep charcoal canvas, frosted
   translucent cards floating on it, hairline borders, soft inner glow, big light
   numerals (28°c) with tiny uppercase labels, slim icon-only left rail, muted
   data-viz accents (soft blue arcs, warm amber), layered depth, everything calm.
2. **Genie mental-health app (dribbble)** — gentle "breathing" motion design:
   slow eased transitions, soft springs, elements that float in unhurriedly,
   generous whitespace, nothing snaps or jumps. Calm over flashy.
3. **fora.so + the BOZZ landing page (website/index.html)** — gradient mesh
   backgrounds, pill shapes, Geist typography, lilac `#cdbfff` accent, masked
   text reveals, `cubic-bezier(0.16,1,0.3,1)` easing everywhere.

One sentence to rule every decision: **a quiet, frosted control room — not a
neon SaaS toy.**

---

## Design tokens

### Colour — dark mode (default)
| Token | Value | Use |
|---|---|---|
| bg | `#0c0d10` | page canvas |
| bg gradient | radial lilac `rgba(205,191,255,0.07)` top-left, dusty blue `rgba(127,168,224,0.05)` top-right, sage `rgba(127,200,169,0.04)` bottom — fixed attachment | depth behind glass |
| glass surface | `rgba(255,255,255,0.045)` + `backdrop-filter: blur(20px) saturate(150%)` | widgets, sidebar, panels, modals |
| border | `rgba(255,255,255,0.07)` hairline (1px max) | all card edges |
| border hover | `rgba(255,255,255,0.14)` | interactive cards |
| inset highlight | `inset 0 1px 0 rgba(255,255,255,0.07)` | top edge of every glass card |
| shadow | `0 10px 32px rgba(0,0,0,0.5)` | card elevation |
| text | `#ededed` | primary |
| text muted | `#8c8d91` | labels, secondary |
| text dim | `#6b6c70` | timestamps, hints |
| accent | `#cdbfff` (lilac) | active states, key numbers, links, focus rings |
| positive | `#7fc8a9` (sage) | done states, success |
| warm | `#e0a16b` (amber) | warnings, highlights |
| info | `#7fa8e0` (dusty blue) | charts, calendar |
| danger | `#ff6b6b` muted red, never saturated | destructive only |

### Colour — light mode
Same structure, inverted: canvas `#f2f2f0` with the same gradient tints at
~2× opacity, glass `rgba(255,255,255,0.62)` + blur, borders `rgba(0,0,0,0.07)`,
text `#1a1a1a`, accent shifts to `#7c6cd4` (deeper lilac for contrast).
Light mode must feel like the same product, not a different app.

### Typography
- **Geist Variable** everywhere (already bundled via `@fontsource-variable/geist`).
- Big values (clock, temperature-style numbers, counts): weight 300–400, large,
  tight letter-spacing (−0.02em). Numbers are the heroes, like "28°c" in the ref.
- Card/section labels: 11–12px, weight 500, uppercase, letter-spacing 0.1em,
  colour = text muted. Every widget gets exactly one such label.
- Body: 13–15px, weight 400. Headings: weight 600, −0.03em.
- Never bold-700 walls of text; weight contrast comes from size, not heaviness.

### Shape & spacing
- Radius: 16px cards, 10px inner elements, 999px pills/buttons.
- Hairline borders only — never 2px+.
- Padding inside cards: 1.25–1.5rem; gaps between cards ≥ 12px.
- Sidebar: floating rounded card (16px radius) detached from the window edge
  with ~10px margin, exactly like the current implementation — keep it.

### Motion ("Genie rules")
- Single easing curve app-wide: `cubic-bezier(0.16, 1, 0.3, 1)`, durations
  0.3–0.6s for UI state, up to 1s for entrances. Define once as a CSS var
  `--ease` and use it everywhere.
- Page/section mounts: children fade-rise 16–24px with 40–60ms stagger.
- Hover on interactive cards: translateY(−2 to −4px) + border brighten +
  shadow deepen. Never scale-jumps.
- Active nav item: background pill slides/fades in, not instant swap.
- Modals (QuickAddModal etc.): backdrop fades, panel rises 24px with slight
  overshoot. Esc/close reverses it.
- Numbers that change (counts, stats): brief 0.3s opacity crossfade, no layout shift.
- Respect `prefers-reduced-motion` — disable all of the above.
- NOTHING bounces hard, spins, or flashes. If an animation is noticeable as
  "an animation", soften it.

---

## Where things live in this codebase
- `src/lib/themes.ts` — the two `Theme` objects (dark/light) + `sectionAccents`.
  Adjust token values here first; most of the app reads colours from `t.*`.
- `src/lib/appearance.ts` — `applyAppearanceVars()` writes the CSS custom
  properties: `--glass-bg`, `--glass-blur`, `--widget-shadow`, `--app-gradient`,
  `--widget-radius`, fonts. The glass recipe lives here. Add `--ease` here.
- `src/components/shared/Widget.tsx` — base card every widget uses (glass fill,
  border, accent line, hover). The accent line is the 2px vertical bar; keep it
  subtle (opacity 0.6, full on hover).
- `src/components/Dashboard.tsx` — sidebar (floating glass card), nav rows,
  bottom row (mic/settings/quicks), main content width/padding.
- `src/components/sections/*` — each page; they read `t.*` so token changes
  propagate. Sweep for hardcoded hex values that bypass the theme and migrate
  them to tokens.
- `src/index.css` — global scrollbars, grid styles, base CSS. Good home for
  shared keyframes + the stagger/entrance utility classes.
- `src/components/AuthGate.tsx` — login screen; align its glass panel + type to
  these tokens too (it currently uses Syne font — switch to Geist).

## Specific passes to make
1. **Token sweep**: align `themes.ts` + `appearance.ts` exactly to the tables
   above; hunt down hardcoded colours in sections/widgets and replace with
   theme tokens.
2. **Typography pass**: Geist everywhere (kill the Syne import in AuthGate),
   apply the big-light-numbers + tiny-uppercase-labels pattern inside widgets
   (ClockWidget, WeatherWidget, BudgetWidget, SummaryWidget are the main ones).
3. **Motion pass**: add the `--ease` var + entrance stagger for the home grid
   and section mounts; soften every existing `transition: all 0.2s` to the
   shared curve; modal enter/exit animation.
4. **Glass consistency pass**: every floating surface (dropdowns, pickers,
   ChoicePicker, DatePicker, color bank popovers, search modal, quick add
   modal) gets the same glass recipe — currently some are opaque `t.panel`.
5. **Light mode QA**: flip to light and verify every surface/border/text reads
   correctly; no dark-mode hex leaking through.

## Don'ts
- No new fonts, no gradients on text except the landing page, no neon.
- No layout/IA changes: same sidebar contents, same widgets, same pages.
- No new dependencies (no framer-motion etc. — CSS + the existing stack only).
- Don't touch sync/auth/storage logic in any way.
- Don't remove the user-facing customisation (colour bank, widget shapes,
  per-widget colours) — restyle the controls, keep the features.

## Acceptance checklist
- [ ] Dark + light both match the token tables; switching feels like one product.
- [ ] Home grid, every section page, settings, login, modals all use glass + Geist.
- [ ] All entrances/hovers use `--ease`; nothing snaps; reduced-motion respected.
- [ ] No hardcoded hex outside `themes.ts`/`appearance.ts` (except deliberate
      data-viz accents).
- [ ] `npx tsc --noEmit` clean; app runs in browser and Tauri with zero
      functional regressions.
