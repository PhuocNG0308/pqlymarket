# Design System Specification: The Kinetic Engine

## 1. Overview & Creative North Star
**Creative North Star: The Kinetic Vault**
In the volatile world of crypto prediction, clarity is the ultimate luxury. This design system moves away from the "template-heavy" look of traditional fintech to embrace **The Kinetic Vault**—a philosophy of digital precision, high-contrast intentionality, and structural depth. 

We are not building a website; we are building a high-performance instrument. The aesthetic is "Digital Brutalism Refined": sharp, sleek, and unapologetically digital. We bypass the "painterly" softness of shadows for a system rooted in tonal layering and typographic authority. By utilizing intentional asymmetry and radical whitespace, we guide the user’s eye through complex data sets with surgical precision.

## 2. Colors & Chromatic Hierarchy
Our palette is anchored by the tension between the void (`#0e0e0e`) and the spark (`#faa324`).

### The "No-Line" Rule
To achieve a high-end editorial feel, **1px solid borders are strictly prohibited for sectioning.** Boundaries must be defined solely through background color shifts. Use `surface_container_low` against `surface` to define regions. This forces a cleaner, more sophisticated UI that feels integrated rather than boxed-in.

### Surface Hierarchy & Nesting
Treat the interface as a series of physical layers. Use the following hierarchy to define depth:
*   **Base Layer:** `surface` (#0e0e0e) - The canvas.
*   **Sectional Layer:** `surface_container_low` (#131313) - Large content areas.
*   **Interactive Layer:** `surface_container_highest` (#262626) - Hover states and active cards.
*   **The "Glass" Rule:** For floating elements (modals, dropdowns), use `surface_bright` at 80% opacity with a `24px` backdrop-blur. This allows the primary energy of the background to bleed through, maintaining a sense of place.

### Signature Textures
Main CTAs should not be flat. Apply a subtle linear gradient from `primary` (#faa324) to `primary_container` (#e18e03) at a 135-degree angle. This provides a "machine-polished" finish that flat hex codes cannot replicate.

## 3. Typography: The Manrope Scale
We use **Manrope** exclusively. It is a modern, geometric sans-serif that balances technical precision with high readability.

*   **Display (lg/md):** Reserved for high-impact numbers and market outcomes. Letter spacing should be set to `-0.02em` to feel "tight" and engineered.
*   **Headline (sm/md):** Used for section headers. Always use `on_surface` (#ffffff) to maximize contrast against the dark background.
*   **Title (sm/md):** Used for card titles and prediction names.
*   **Label (md/sm):** These are the workhorses for data labels (e.g., "Volume," "24h Change"). Use `on_surface_variant` (#adaaaa) to create a secondary visual tier.

**Hierarchy Note:** Use weight over color. A `Title-md` in Bold is more authoritative than a `Title-lg` in Regular.

## 4. Elevation & Depth
In a "No-Line" system, elevation is communicated through **Tonal Layering.**

*   **The Layering Principle:** Place a `surface_container_lowest` (#000000) card on a `surface_container_low` (#131313) section to create a "recessed" look. Conversely, place a `surface_container_high` (#201f1f) card on a `surface` base for a "lifted" look.
*   **Ambient Shadows:** If a floating effect is required (e.g., a prediction slip), use a shadow with a `48px` blur, `0%` spread, and `8%` opacity. The shadow color should be `#000000`, never grey.
*   **The "Ghost Border":** If a border is required for accessibility in complex data grids, use `outline_variant` (#494847) at **15% opacity**. It should be felt, not seen.

## 5. Components

### Buttons
*   **Primary:** `primary` background, `on_primary` text. No border. `md` (0.375rem) roundedness.
*   **Secondary:** `surface_container_highest` background. No border. This creates a "stealth" look that doesn't compete with the primary action.
*   **Tertiary:** Transparent background, `primary` text. Used for low-priority actions like "Cancel" or "View More."

### Input Fields
*   **Default:** `surface_container_highest` background. 
*   **Focus:** No glow. Instead, change the background to `surface_bright` and add a `1px` `primary` "Ghost Border" (20% opacity).
*   **Error:** Use `error` (#ff7351) for the label and a subtle `error_container` (#b92902) background shift.

### Cards & Prediction Slips
*   **Constraint:** Zero dividers. Use vertical whitespace (Spacing Scale `6` or `8`) to separate content.
*   **Interaction:** On hover, shift the background from `surface_container_low` to `surface_container_high`.

### Specialized Crypto Components
*   **The Odds Toggle:** A segmented control using `surface_container_lowest` as the track and `primary` as the active indicator.
*   **Data Sparklines:** Pure `primary` (#faa324) strokes at `1.5px` width. No fills. Keep the data "naked" and sleek.

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical layouts. A sidebar that doesn't reach the bottom of the screen creates a sophisticated, editorial vibe.
*   **Do** embrace the "True Black" (`#000000`) for the lowest-level containers to ground the UI.
*   **Do** use the Spacing Scale religiously. Consistent gaps of `1.1rem` (5) and `1.75rem` (8) create the "rhythm" of the engine.

### Don't
*   **Don't** use 100% white text for everything. Reserve `#ffffff` for titles; use `on_surface_variant` (#adaaaa) for body text to reduce eye strain.
*   **Don't** use "Atelier" gradients (soft pinks, purples, or blurs). We stay within the yellow-to-charcoal spectrum.
*   **Don't** add roundedness to everything. Use `none` (0px) for large section containers to keep the "Brutalist" edge, and `md` (0.375rem) only for interactive elements like buttons and chips.