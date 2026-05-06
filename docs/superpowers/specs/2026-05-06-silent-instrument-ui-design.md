# Silent Instrument UI Redesign Spec

## Purpose

The current mini program already has the core practice loop: home, tuner detection, score practice, results, and history. The redesign should make the product feel like a quiet, reliable violin practice instrument rather than a generic utility page.

The primary user is a serious beginner or adult learner who wants low-friction feedback while practicing pitch. The UI should reduce visual noise, make the current pitch state immediately readable, and keep every page focused on the next useful action.

## Aesthetic Direction

Chosen direction: **Luxury/refined**, expressed as a hybrid of **Paper Tuner** and **Ebony & Ivory**.

The system should feel like warm practice paper with fine musical notation lines. Key listening moments should borrow from black-and-white instrument materials: high contrast, restrained surfaces, and one memorable reading area.

This direction intentionally avoids a colorful gamified style, dashboard density, and generic centered cards. The interface should feel calm, precise, and mature.

## Visual System

### Color Palette

- `#FBFAF4` warm paper background for most pages.
- `#171614` near-black ink for primary text, lines, and key controls.
- `#F5EFE3` ivory surface for elevated or inverted reading zones.
- `#92764A` muted gold-brown for calibration, metadata, and quiet emphasis.
- `#9A4D38` restrained red-brown for pitch deviation and corrective feedback.
- `#D8D0C0` paper line color for dividers, staff-like separators, and history rows.

### Typography

- Display and large reading labels: `Songti SC`, `STSong`, serif fallback.
- Numeric pitch readouts: Georgia-style serif or mini-program-safe monospace fallback where alignment matters.
- Body text: WeChat mini program platform Chinese font fallback, with tighter hierarchy and less explanatory copy.

The design should use fewer text blocks and stronger scale contrast: large note names, compact metadata, and concise next-action labels.

### Layout Strategy

- Use asymmetrical whitespace and fine line divisions instead of stacked panels.
- Keep one dominant readout per screen.
- Avoid nested cards and repeated boxed sections.
- Use full-width paper surfaces and thin rule lines to separate information.
- Reserve dark or high-contrast treatment for active detection and final result moments only.

## Page Design

### Home

The home page becomes a practice console instead of a feature menu.

Primary content:
- Today's practice target.
- A single main action: start pitch practice.
- Secondary actions for score practice and history as quiet text or line buttons.
- Small status strip for privacy/local detection and supported open strings.

Visual behavior:
- Warm paper background.
- Large refined title area with asymmetric spacing.
- No heavy card stack.
- Thin bottom or side rule suggesting a practice sheet.

### Pitch Detection

This is the visual anchor of the redesign.

Primary content:
- Large current note name.
- Cent deviation as the second most important value.
- Fine vertical or horizontal pitch reference line.
- G/D/A/E selector as minimal segmented text or line tabs.
- One primary recording control.

Visual behavior:
- Use the Ebony & Ivory treatment for the active listening area.
- Keep surrounding controls on the warm paper surface.
- Use muted gold for calibrated/ready states.
- Use red-brown only for meaningful deviation or correction, not decorative emphasis.

### Score Practice

Score practice should inherit the paper language rather than become a separate visual product.

Primary content:
- Piece title, BPM, current practice stage.
- Minimal progress indicator.
- One clear start/continue action.
- Current measure or phrase guidance where available.

Visual behavior:
- Staff-like fine lines can appear here, but should remain subtle.
- Use editorial spacing and small labels rather than dense cards.

### Results

The result page should feel like a practice annotation.

Primary content:
- Score as a large refined number.
- Most important correction: one note, one deviation, one advice line.
- Stability and accuracy as compact measurements.
- Save or retry as the only actions.

Visual behavior:
- White/ivory paper base.
- Red-brown markup for the key correction.
- Optional black-and-ivory emphasis for the final score, used sparingly.

### History

History should read like a quiet practice ledger.

Primary content:
- Date and session type.
- Score or stability summary.
- One highlighted improvement or recurring issue.

Visual behavior:
- Thin ruled rows.
- No large repeated cards.
- Compact scan-friendly list.

## Interaction Rules

- Each screen should expose one primary action.
- Secondary actions should be quieter and visually subordinate.
- Recording states must be readable without relying only on color.
- Empty, loading, permission-denied, and no-signal states should keep the same refined voice and avoid long instructional blocks.
- The UI should not add decorative animation. If motion is used, it should support listening state, pitch stabilization, or page transition clarity.

## Component Boundaries

The implementation should keep the existing mini program page structure and avoid introducing a parallel UI framework.

Suggested reusable style primitives:
- Paper page container.
- Fine rule divider.
- Primary circular or pill action control.
- Pitch readout block.
- Quiet metadata label.
- Ledger row.
- Markup/correction callout.

These primitives should be expressed through shared `app.wxss` tokens and page-level classes, not a new component architecture unless duplication becomes substantial during implementation.

## Data Flow

The redesign does not require new backend or CloudBase data.

Existing data should continue to drive:
- Live pitch and cent deviation on the detection page.
- Practice session score and stability on result pages.
- Saved practice sessions on history.
- Score practice metadata for piece selection and evaluation.

The UI should not change stored data shape unless implementation reveals a specific missing display field.

## Error And Edge States

- Microphone permission denied: show a quiet paper-state message with a single action to reopen settings.
- No pitch detected: keep the main readout area stable and show a short "listening" state rather than reshuffling layout.
- Recording unsupported or frame unavailable: show a compact fallback explanation and keep navigation actions visible.
- Empty history: show a ledger-style first-row prompt to start practice.
- Save failure: show a short inline failure state and keep retry available.

## Testing And Review

Implementation should be verified with:
- `npm run check:js` for syntax coverage of existing page scripts.
- `npm test` for existing pitch utility coverage.
- WeChat Developer Tools preview of home, detect, result, history, score list, score practice, and score result pages.
- Manual visual review on at least one narrow mobile viewport, checking text fit, button tap targets, and no overlapping readouts.

Visual acceptance criteria:
- Home reads as a practice console, not a generic menu.
- Detection page has one dominant note readout and stable recording controls.
- Result page gives one clear correction without clutter.
- History is scan-friendly and does not look like a stack of generic cards.
- The color system remains warm paper plus black/ivory, with gold-brown and red-brown used only for meaning.

## Out Of Scope

- New backend features.
- New practice data schema.
- New score evaluation behavior.
- New onboarding, subscription, social, or teacher-account flows.
- Full animation system beyond small state transitions needed for listening and feedback clarity.
