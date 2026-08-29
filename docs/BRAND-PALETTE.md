# PicchuSpot Brand Palette

This file is the design-system contract for PicchuSpot. The four brand colors below are fixed and should not be replaced by ad-hoc alternatives in components.

| Role | HEX | Use |
| --- | --- | --- |
| Deep Navy | `#071A2B` | Primary dark background, primary text on light surfaces |
| Warm Ivory | `#F4EFE8` | Selective warm brand surface/section; **not** the global page background |
| PicchuSpot Gold | `#C7A94E` | Brand mark, decorative accents, arrows, dividers, highlighted words |
| Soft Line | `#DED3C6` | Decorative borders and secondary dividers |

## Surface rule

PicchuSpot uses **clean white (`#FFFFFF`) as the default website background and standard card/lightbox surface**.

Warm Ivory remains one of the four fixed brand colors, but it is opt-in. Use it only where a deliberately warm editorial section helps the composition. Do not map Tailwind `white`, the global `background`, or the complete neutral ramp to Warm Ivory.

This keeps the site crisp and photographic while the Ivory/Gold pair remains available as a controlled brand accent.

## Accessibility rules

- Deep Navy on white is the default text pairing.
- White on Deep Navy is the default inverse pairing.
- PicchuSpot Gold must **not** be used for normal-size text on white or Warm Ivory. Use the semantic `secondary-dark` token for readable gold-adjacent text on light surfaces.
- Soft Line is decorative and must not be the only visual boundary for a control when stronger non-text contrast is required. Use `border-strong` for that case.
- Red, green and amber are reserved for semantic error, success and warning states. They are not part of the brand palette.
- Do not introduce new hard-coded navy, beige or gold values in components. Use the shared Tailwind tokens.

## Shared tokens

The source of truth for CSS/Tailwind is `src/app/globals.css`.

- `primary` → Deep Navy
- `secondary` → PicchuSpot Gold
- `ivory` → Warm Ivory
- `background` / `white` / `surface` → clean white
- `border` / `line` → Soft Line
- `foreground` → Deep Navy
- `muted`, `muted-light`, `secondary-dark`, and `border-strong` are accessibility-safe supporting colors.
- Tailwind stone/gray/slate/zinc/neutral 50/100 stay clean and near-white; the darker steps are harmonised supporting neutrals.

## Contrast reference

Approximate WCAG contrast ratios:

- Deep Navy / Warm Ivory: **15.4:1**
- PicchuSpot Gold / Deep Navy: **7.7:1**
- PicchuSpot Gold / Warm Ivory: **2.0:1** — decorative only
- Gold on white is also decorative only.
- `secondary-dark` is used when a gold-adjacent text treatment needs readable contrast on a light surface.
