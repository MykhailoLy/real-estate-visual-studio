# PicchuSpot Brand Palette

This file is the design-system contract for PicchuSpot. The four brand colors below are fixed and should not be replaced by ad-hoc alternatives in components.

| Role | HEX | Use |
| --- | --- | --- |
| Deep Navy | `#071A2B` | Primary dark background, primary text on light surfaces |
| Warm Ivory | `#F4EFE8` | Primary light background, text on dark surfaces |
| PicchuSpot Gold | `#C7A94E` | Brand mark, decorative accents, arrows, dividers, highlighted words |
| Soft Line | `#DED3C6` | Decorative borders and secondary dividers |

## Accessibility rules

- Deep Navy on Warm Ivory is the default text pairing.
- Warm Ivory on Deep Navy is the default inverse pairing.
- PicchuSpot Gold must **not** be used for normal-size text on Warm Ivory. Its contrast is too low. Use the semantic `secondary-dark` token for readable gold-adjacent text on light surfaces.
- Soft Line is decorative and must not be the only visual boundary for a control when stronger non-text contrast is required. Use `border-strong` for that case.
- Red, green and amber are reserved for semantic error, success and warning states. They are not part of the brand palette.
- Do not introduce new hard-coded navy, beige or gold values in components. Use the shared Tailwind tokens.

## Shared tokens

The source of truth for CSS/Tailwind is `src/app/globals.css`.

- `primary` → Deep Navy
- `secondary` → PicchuSpot Gold
- `background` / `white` → Warm Ivory
- `border` / `line` → Soft Line
- `foreground` → Deep Navy
- `muted`, `muted-light`, `secondary-dark`, `surface`, and `border-strong` are accessibility-safe derivatives of the fixed palette.
- Tailwind stone/gray/slate/zinc/neutral ramps are harmonised to the same palette so legacy utilities do not reintroduce unrelated cool grays.

## Contrast reference

Approximate WCAG contrast ratios:

- Deep Navy / Warm Ivory: **15.4:1**
- PicchuSpot Gold / Deep Navy: **7.7:1**
- PicchuSpot Gold / Warm Ivory: **2.0:1** — decorative only
- `secondary-dark` / Warm Ivory: **5.4:1**
- `muted-light` / Warm Ivory: **4.6:1**
