# Buy One Gram - Design System Documentation

Welcome to the living design documentation for the **Buy One Gram** premium e-commerce platform. This document outlines our design system tokens, utility classes, and components used to maintain consistency across the storefront and admin panels.

---

## 1. Color Tokens

Our color palette is split into semantic groupings. All variables are available as CSS custom properties under `:root` and bound to Tailwind CSS directives.

### Brand & Primary Colors
* `--color-primary`: `#5A3A22` (Rich Brown anchor)
* `--color-primary-light`: `#7A5A3A` (Lighter warm brown)
* `--color-primary-dark`: `#3E2714` (Deep brown)

### Accent Colors
* `--color-accent`: `#FF8C42` (Warm Orange)
* `--color-accent-light`: `#FFA96B`
* `--color-accent-dark`: `#E07530`

### Semantic / Status Colors
* `--color-success`: `#1F7A63` (Health Green)
* `--color-warning`: `#F5A623` (Warm Amber)
* `--color-error`: `#D44638` (Warm Red)
* `--color-info`: `#3B82F6` (Info Blue)

### Backgrounds & Neutrals
* `--color-bg-primary`: `#ffffff`
* `--color-bg-secondary`: `#F8F6F2` (Soft warm off-white)
* `--color-bg-tertiary`: `#F0EDE8`
* `--color-bg-accent`: `#FFF9F0`

### Borders
* `--color-border-light`: `rgba(90, 58, 34, 0.08)`
* `--color-border-medium`: `rgba(90, 58, 34, 0.15)`
* `--color-border-dark`: `rgba(90, 58, 34, 0.25)`

---

## 2. Typography

* **Body Font:** `"Inter", system-ui, -apple-system, sans-serif`
* **Heading Font:** `"Poppins", "Inter", system-ui, -apple-system, sans-serif`

### Font Scale
* `var(--text-xs)`: `0.75rem` (12px)
* `var(--text-sm)`: `0.875rem` (14px)
* `var(--text-base)`: `1rem` (16px)
* `var(--text-lg)`: `1.125rem` (18px)
* `var(--text-xl)`: `1.25rem` (20px)
* `var(--text-2xl)`: `1.5rem` (24px)
* `var(--text-3xl)`: `1.875rem` (30px)

---

## 3. Spacing & Borders

### Spacing Scale
* `var(--spacing-xs)`: `0.25rem`
* `var(--spacing-sm)`: `0.5rem`
* `var(--spacing-md)`: `1rem`
* `var(--spacing-lg)`: `1.5rem`
* `var(--spacing-xl)`: `2rem`

### Border Radii
* `var(--radius-sm)`: `0.5rem` (8px)
* `var(--radius-md)`: `0.75rem` (12px)
* `var(--radius-lg)`: `1rem` (16px)
* `var(--radius-xl)`: `1.25rem` (20px)
* `var(--radius-2xl)`: `1.5rem` (24px)

---

## 4. Components & Utilities

These utility classes are registered globally in the design system and should be used on all native and customized framework components.

### Buttons (`btn-*`)

* **Primary Button (`.btn-primary`):** Bold brand-primary background with transition hover offsets and shadow tokens.
* **Secondary Button (`.btn-secondary`):** Accent warm-orange background.
* **Outline Button (`.btn-outline`):** Transparent background with primary brand border.

### Inputs (`input-premium`, `textarea-premium`, `select-premium`)

* **Text Input (`.input-premium`):** Standard text boxes (height 48px, padded, rounded-md, border-medium color) with soft highlight outline ring on focus.
* **Textarea (`.textarea-premium`):** Padded multiline boxes conforming to input borders and radius.
* **Dropdown Select (`.select-premium`):** Dropdown inputs matching input height and radii.

### Cards (`card-premium`)

* **Premium Card (`.card-premium`):** Uses shadow-card, border-light, and background tokens. Scales border transitions on hover.

### Badges (`badge-*`)

* **Premium Badge (`.badge-premium`):** Uppercase, letter-spaced labels with round radii.
* **Semantic Badges:** `.badge-success`, `.badge-warning`, `.badge-error` containing color-mix transparencies.

---

## 5. Dialogs & Modals

All overlay dialogs must inherit standard radii and pad properties:
* Modal Paper: `borderRadius: "24px"`, `padding: "10px"` (via MUI PaperProps or equivalent CSS).
* Dialog Action Buttons: Must use `.btn-primary` / `.btn-outline` wrappers rather than ad-hoc inline overrides.

---

## 6. Motion & Transitions

Standard cubic-beziers defined for micro-interactions:
* **Fast Transition:** `150ms cubic-bezier(0.4, 0, 0.2, 1)` (used for hover highlights, focus rings).
* **Normal Transition:** `300ms cubic-bezier(0.4, 0, 0.2, 1)` (used for card shifts, dropdowns).
* **Spring Transition:** `500ms cubic-bezier(0.34, 1.56, 0.64, 1)` (used for entry animations, cart slide-outs).

---

## 7. Accessibility (A11y) Rules

1. **Label Association:** Every input MUST have an associated `<label>` or `aria-label` reference.
2. **Keyboard Focus:** Highlighting focused elements via outlines/rings is mandatory; do not suppress outline indicators.
3. **Contrast Standards:** Ensure text-on-background combinations satisfy WCAG AA standards (minimum contrast ratio 4.5:1).
4. **Placeholders:** Never use placeholders as the sole identifier for input fields.
