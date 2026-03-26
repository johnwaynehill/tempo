# Design System Documentation: The Quiet Rhythm

## 1. Overview & Creative North Star
**Creative North Star: The Mindful Editor**
This design system is a rejection of the "hustle-culture" productivity aesthetic. Instead of high-contrast alerts and rigid grids that induce anxiety, we embrace a high-end editorial approach that prioritizes cognitive ease. We move beyond "flat design" into a philosophy of **Tonal Architecture**.

The system utilizes intentional asymmetry and expansive whitespace to guide the eye without the use of aggressive structural markers. By treating the interface as a series of stacked, premium paper stocks rather than a digital screen, we create a sanctuary for focus. This is a system that breathes, allowing users with ADHD to find clarity through "The Quiet Rhythm."

## 2. Colors & Surface Philosophy
The palette is rooted in organic, muted tones that mimic the natural world. We avoid pure blacks and clinical whites in favor of a sophisticated, low-stimulation environment.

### The "No-Line" Rule
**Explicit Instruction:** You are prohibited from using 1px solid borders to define sections or containers.
In this design system, boundaries are created through **Background Color Shifts**. To separate a sidebar from a main feed, use a shift from `surface` to `surface-container-low`. To highlight a focused task, place a `surface-container-lowest` card on a `surface-container` background.

### Surface Hierarchy & Nesting
Treat the UI as a physical desk.
- **Base Layer:** `surface` (#f9f9f8).
- **Secondary Areas:** `surface-container-low` (#f3f4f3) for less critical utility zones.
- **Active Focus Zones:** `surface-container-lowest` (#ffffff) for the highest prominence.
- **Nesting:** Never stack more than three levels of depth. A `surface-container-highest` element should only exist to draw immediate, singular attention.

### Glass & Signature Textures
To escape the "generic" look, use Glassmorphism for floating UI (like navigation bars or action menus). Use `surface-container-lowest` at 80% opacity with a `24px` backdrop blur.
**Signature CTA:** For primary actions, use a subtle linear gradient from `primary` (#4f645b) to `primary_dim` (#43574f) at a 135-degree angle. This adds a "soul" to the button that flat color cannot achieve.

## 3. Typography
We use a dual-typeface system to balance editorial authority with functional clarity.

- **Display & Headlines (Manrope):** Chosen for its geometric but warm character. Use these for "Momentum Moments"—large headers that celebrate progress or set the tone of a page.
- **Body & Labels (Inter):** The workhorse. Inter provides the legibility required for high-density information without causing eye strain.

**Hierarchy as Brand Identity:**
- **The Whisper:** Use `label-sm` in `on_surface_variant` (#5b605f) for secondary metadata.
- **The Statement:** Use `display-md` with `primary` color for daily goals to create a sense of calm importance.
- **Line Height:** Maintain a minimum of 1.6x for body text to ensure users with ADHD don't "lose their place" in long blocks of text.

## 4. Elevation & Depth
Traditional drop shadows are too "digital." We use **Tonal Layering** to convey hierarchy.

- **The Layering Principle:** Depth is achieved by "stacking." A card is not "raised" by a shadow; it is "lifted" by being the lightest color in the stack (`surface-container-lowest`).
- **Ambient Shadows:** Only use shadows on floating elements (modals, menus). Use a 16px to 32px blur at 6% opacity. The shadow color must be a tint of `on_surface` (#2f3333), never pure black.
- **The Ghost Border:** If a form field or container requires a boundary for accessibility, use a `1px` stroke of `outline_variant` (#afb3b2) at **15% opacity**. It should be felt, not seen.

## 5. Components

### Buttons
- **Primary:** `primary` background, `on_primary` text. Use `xl` (1.5rem) rounding. No shadows.
- **Secondary:** `surface-container-high` background. Feels like an integrated part of the page.
- **Interaction:** On hover, shift background to `primary_dim`. Movements must be slow (300ms ease-out).

### Progressive Disclosure Chips
- Use `secondary_container` for inactive states.
- Upon interaction, secondary info "slides" out from behind the chip. Avoid "popping" animations; use fluid, spring-based transitions.

### Lists & Tasks
- **The Anti-Divider Rule:** Never use lines to separate list items. Use **Spacing Scale 4** (1.4rem) between items.
- **Checkboxes:** When checked, the checkbox should transition to `primary` with a soft fade. Avoid "vibrant" green; use our muted Sage.

### Input Fields
- Use `surface-container-low` as the field background.
- **No Red Alerts:** For error states, do not turn the whole box red. Use a subtle `error` (#a83836) underline and `label-sm` helper text. The goal is to inform, not to alarm.

### Cards
- Use `lg` (1rem) or `xl` (1.5rem) corner radius.
- Cards should never have borders. Use the `surface-container-lowest` shift to create the "card" effect.

## 6. Do's and Don'ts

### Do
- **Embrace Asymmetry:** Align text to the left but allow imagery or secondary widgets to float offset to the right to create a sophisticated, editorial rhythm.
- **Use "Tempo" Spacing:** Use `Spacing 16` (5.5rem) and `Spacing 20` (7rem) for page margins. Large margins reduce the "noise" for ADHD users.
- **Progressive Disclosure:** Hide "Delete," "Edit," and "Settings" behind a "Ghost Border" icon that only reaches full opacity on hover.

### Don't
- **Don't use pure red (#FF0000):** It triggers a fight-or-flight response. Use our `error` (#a83836) token.
- **Don't use 100% black text:** It creates "visual vibration" against off-white backgrounds. Use `on_surface` (#2f3333).
- **Don't use tight grids:** If a layout feels "crowded," double the whitespace. If it still feels crowded, remove a feature.
- **Don't use 1px borders:** Rely on the `surface-container` hierarchy. Lines are clutter.