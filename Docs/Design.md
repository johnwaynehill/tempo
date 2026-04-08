# Design System Documentation: The Quiet Rhythm

## 1. Overview & Creative North Star
**Creative North Star: The Mindful Editor**
This design system is a rejection of the "hustle-culture" productivity aesthetic. Instead of high-contrast alerts and rigid grids that induce anxiety, we embrace a high-end editorial approach that prioritizes cognitive ease. We move beyond "flat design" into a philosophy of **Tonal Architecture**.

The system utilizes intentional asymmetry and expansive whitespace to guide the eye without the use of aggressive structural markers. By treating the interface as a series of stacked, premium paper stocks rather than a digital screen, we create a sanctuary for focus. This is a system that breathes, allowing users with ADHD to find clarity through "The Quiet Rhythm."

### Spatial Grid
All spacing, sizing, padding, and gaps use an **8px base grid**. Every measurement should be a multiple of 8 (8, 16, 24, 32, 40, 48...). For fine detail like chip padding or icon offsets, 4px (half-grid) is permitted. This creates visual rhythm without rigidity.

| Token | Value | Use |
|-------|-------|-----|
| `space-1` | 4px | Chip inner padding, icon gaps |
| `space-2` | 8px | Tight gaps between related items |
| `space-3` | 12px | Card gaps, chip row spacing |
| `space-4` | 16px | Card padding, section inner spacing |
| `space-5` | 24px | Section gaps |
| `space-6` | 32px | Page section separation |
| `space-8` | 48px | Large page margins |
| `space-10` | 64px | Hero spacing |

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

### Chip Color System
Metadata chips use tinted backgrounds with darker text from the same hue family. All colors are muted and desaturated to maintain the low-stimulation aesthetic. Chips use `space-1` (4px) vertical padding, `space-2` (8px) horizontal padding, and 8px corner radius.

#### Project Colors
Projects are assigned colors automatically via a hash of the project name, cycling through a fixed palette of 8 muted hues. Each color has a `bg` (background) and `fg` (text) pair.

| Slot | Name | Light bg | Light fg | Dark bg | Dark fg |
|------|------|----------|----------|---------|---------|
| 0 | Sage | `#c0d8d0` | `#3a5248` | `#2a3f37` | `#a0c4b6` |
| 1 | Sand | `#d8cec0` | `#5a4e3a` | `#3f3729` | `#c4b8a0` |
| 2 | Lavender | `#cfc8d8` | `#4a3e5a` | `#352e40` | `#b8aec4` |
| 3 | Sky | `#c0ced8` | `#3a4a58` | `#29353f` | `#a0b8c8` |
| 4 | Rose | `#d8c0c8` | `#5a3a44` | `#40292f` | `#c8a0ae` |
| 5 | Moss | `#c8d4c0` | `#44523a` | `#2f3d27` | `#b0c0a0` |
| 6 | Amber | `#d8d0c0` | `#585038` | `#3f3a28` | `#c8c0a0` |
| 7 | Slate | `#c8ccd0` | `#3e4448` | `#2d3236` | `#a8b0b8` |

Usage: `projectColorIndex = hashCode(projectName) % 8`

#### Energy Level Colors
Energy uses a cool-to-warm progression. Low energy is calm and muted; high energy is vivid.

| Level | Light bg | Light fg | Dark bg | Dark fg |
|-------|----------|----------|---------|---------|
| Low | `#e8e5e0` | `#7d7b78` | `#332f2b` | `#a8a5a0` |
| Med-Low | `#e0e5e2` | `#606860` | `#2b332e` | `#98a89c` |
| Medium | `#d8e4dc` | `#4a5e52` | `#283830` | `#90b0a0` |
| High | `#cce4d4` | `#2d6048` | `#1e3f2e` | `#80c8a0` |

#### Size Colors
Size uses a single neutral hue with increasing intensity to convey scale without drawing too much attention.

| Size | Light bg | Light fg | Dark bg | Dark fg |
|------|----------|----------|---------|---------|
| Small | `#e8e8e6` | `#6e706e` | `#30322f` | `#a0a2a0` |
| Medium | `#dde0dc` | `#585e58` | `#2c302c` | `#98a098` |
| Large | `#d0d6d0` | `#444e44` | `#262e26` | `#88a088` |

#### Impact Colors
Impact 1–5 maps to a subtle warm scale. Low impact blends in; high impact draws quiet attention.

| Impact | Light bg | Light fg | Dark bg | Dark fg |
|--------|----------|----------|---------|---------|
| 1 | `#e8e6e4` | `#787572` | `#33302e` | `#a8a5a2` |
| 2 | `#e4e0da` | `#6e6860` | `#302c26` | `#a89e94` |
| 3 | `#e0dace` | `#645a4a` | `#2e281e` | `#a89680` |
| 4 | `#dcd2c2` | `#5a4e38` | `#2c2418` | `#a89070` |
| 5 | `#d6cab4` | `#504228` | `#2a2014` | `#a88a60` |

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
- **The Anti-Divider Rule:** Never use lines to separate list items. Use `space-3` (12px) between card items.
- **Task Cards:** Use `surface-container-lowest` background with `space-4` (16px) padding and 16px corner radius. No borders.
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
- **Use "Tempo" Spacing:** Use `space-8` (48px) and `space-10` (64px) for page margins. Large margins reduce the "noise" for ADHD users. All spacing must be multiples of 8px (4px for fine detail).
- **Progressive Disclosure:** Hide "Delete," "Edit," and "Settings" behind a "Ghost Border" icon that only reaches full opacity on hover.

### Don't
- **Don't use pure red (#FF0000):** It triggers a fight-or-flight response. Use our `error` (#a83836) token.
- **Don't use 100% black text:** It creates "visual vibration" against off-white backgrounds. Use `on_surface` (#2f3333).
- **Don't break the 8px grid:** All spacing must be a multiple of 8 (or 4 for fine detail). If a layout feels "crowded," step up to the next grid increment. If it still feels crowded, remove a feature.
- **Don't use 1px borders:** Rely on the `surface-container` hierarchy. Lines are clutter.