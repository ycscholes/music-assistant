# Silent Instrument UI Redesign Spec

## Purpose

The current mini program already has the core practice loop: home, tuner detection, score practice, results, and history. The redesign should make the product feel like a quiet, reliable violin practice instrument rather than a generic utility page.

The primary user is a serious beginner or adult learner who wants low-friction feedback while practicing pitch. The UI should reduce visual noise, make the current pitch state immediately readable, and keep every page focused on the next useful action.

## Review Resolution

This revision resolves the design review with the following implementation decisions:

- Global tokens should be replaced in one pass rather than adding a second warm palette beside the current cool palette.
- The current violin head interaction should remain because it is the most instrument-specific control in the app.
- The current gauge and needle should be visually simplified into a paper/instrument reference scale. The implementation may keep the live rotation behavior, but the asset treatment must stop reading as a decorative tuner illustration.
- Home "today's practice target" should be static product guidance in the first implementation, not a new recommendation system.
- The score practice pages are covered by this spec and should share the same visual system.
- Basic result and score-practice result pages should share the same design language while keeping separate page-specific content.
- Dark mode is out of scope for this redesign.

## Aesthetic Direction

Chosen direction: **Luxury/refined**, expressed as a hybrid of **Paper Tuner** and **Ebony & Ivory**.

The system should feel like warm practice paper with fine musical notation lines. Key listening moments should borrow from black-and-white instrument materials: high contrast, restrained surfaces, and one memorable reading area.

This direction intentionally avoids a colorful gamified style, dashboard density, and generic centered cards. The interface should feel calm, precise, and mature.

## Visual System

### Color Palette

Global tokens in `app.wxss` should migrate to the warm paper system in one pass:

- `--primary`: `#171614`, near-black ink for primary text, lines, and key controls.
- `--accent`: `#9A4D38`, restrained red-brown for pitch deviation, corrective feedback, and destructive emphasis.
- `--success`: `#5E6F4E`, muted olive for stable/in-tune states on warm paper.
- `--warning`: `#92764A`, muted gold-brown for calibration, metadata, and quiet emphasis.
- `--danger`: `#9A4D38`, same red-brown family as accent for strong deviation and save failures.
- `--ink`: `#171614`, primary text.
- `--muted`: `#756D61`, secondary copy on paper.
- `--line`: `#D8D0C0`, paper line color for dividers, staff-like separators, and history rows.
- `--surface`: `#F5EFE3`, ivory surface for elevated or inverted reading zones.
- `--background`: `#FBFAF4`, warm paper background for most pages.

The implementation should remove blue highlights from the active tuner state. Active string selection, calibration, and no-signal states should use muted gold-brown or olive; meaningful pitch correction should use red-brown.

### Typography

- Display and large reading labels: `Songti SC`, `STSong`, serif fallback.
- Numeric pitch readouts: Georgia-style serif or mini-program-safe monospace fallback where alignment matters.
- Body text: WeChat mini program platform Chinese font fallback, with tighter hierarchy and less explanatory copy.

The design should use fewer text blocks and stronger scale contrast: large note names, compact metadata, and concise next-action labels.

Recommended type scale:

- Hero title and emotional headings: `52-64rpx`, serif, bold.
- Primary readouts such as note names and final scores: `88-120rpx`, serif or Georgia-style numeric face, bold.
- Secondary readouts such as frequency, cent offset, and section score: `36-52rpx`, serif or monospace when alignment matters.
- Section titles: `30-36rpx`, serif, bold.
- Button labels and primary action text: `28-32rpx`, platform Chinese font, bold.
- Body and explanatory copy: `24-28rpx`, platform Chinese font.
- Metadata labels and small status text: `18-22rpx`, platform Chinese font with increased letter spacing only for short Latin labels.

Metric values count as readouts and should use the serif/numeric treatment when they carry pitch, score, frequency, or cent values. Button labels should use the platform Chinese font for legibility and tap clarity.

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
- A large practice title area with the product name and one short line of guidance.
- A static "today's practice" target for the first implementation: open strings plus long tones. This is product guidance, not personalized data.
- A single main action: start pitch practice.
- Secondary actions for score practice and history as quiet text links or fine line buttons.
- Small status strip for local detection/privacy and supported open strings.

Visual behavior:
- Warm paper background.
- Large refined title area with asymmetric spacing.
- No heavy card stack.
- Thin bottom or side rule suggesting a practice sheet.

Layout:
- Top third: asymmetrical title block aligned left with generous top spacing and a thin vertical or horizontal rule.
- Middle: a single practice target block showing "G D A E" and "long tone" as the primary warm-up prompt.
- Lower middle: primary start control, preferably a pill or circular action with strong black/ivory contrast.
- Bottom: score practice and history as quiet row links. They should not use the current full-width secondary button treatment.
- The existing guide text should be reduced to one concise line or moved below the fold. It should not compete with the primary practice action.

### Pitch Detection

This is the visual anchor of the redesign.

Primary content:
- Large current note name.
- Cent deviation as the second most important value.
- Fine vertical or horizontal pitch reference scale.
- Violin head string selector for G/D/A/E.
- One primary recording control.

Visual behavior:
- Use the Ebony & Ivory treatment for the active listening area.
- Keep surrounding controls on the warm paper surface.
- Use muted gold for calibrated/ready states.
- Use red-brown only for meaningful deviation or correction, not decorative emphasis.

Current element decisions:
- Keep the violin head image and string hit areas. It gives the page instrument specificity that text tabs cannot replace.
- Restyle active string labels away from blue. Use near-black, muted gold, or red-brown depending on state.
- Keep the `440Hz / 442Hz` reference pitch toggle, but restyle it as a small calibration control rather than a prominent switch.
- Replace the decorative gauge image with a quieter reference scale. If the current gauge/needle mechanics are retained, the visible treatment should become thin paper lines, black/ivory contrast, and a restrained red-brown deviation marker.
- The main note readout should sit visually above or inside the active listening zone, not be buried in metric chips.
- Metric chips should flatten into small ruled measurements. They should not look like separate cards.

Recommended layout:
- Top: compact calibration row.
- Center: large note name (`88-120rpx`) and cent deviation (`36-52rpx`) with a fine reference line.
- Middle/lower: violin head selector anchored as the tactile string-selection control.
- Bottom: three compact measurements for target string, detected frequency, and deviation.

### Score Practice Flow

Score practice should inherit the paper language rather than become a separate visual product. The four score-practice pages should not introduce a separate card-heavy interface.

#### Score List

Primary content:
- Piece title.
- Difficulty, BPM, estimated duration, and focus tip.
- One row-level action to select the piece.

Visual behavior:
- Use ledger rows or ruled paper rows instead of large cards.
- Each piece row can have one small serif title and compact metadata.
- The selected or recommended piece can use a left rule in muted gold-brown.

#### Score Prepare

Primary content:
- Piece title and practice focus.
- BPM, time signature, and expected duration.
- One primary action to start the count-in.
- Short fixed-speed evaluation note.

Visual behavior:
- Use an editorial practice sheet layout with title and metadata split by fine rules.
- Avoid lengthy instructions. Keep only one concise evaluation constraint.

#### Score Practice

Primary content:
- Current practice stage: ready, count-in, recording, complete.
- Current target note or phrase.
- Beat/progress indicator.
- Recording control state.

Visual behavior:
- Use a minimal metronome mark or progress rule, not a dense dashboard.
- Count-in should be visible through a large number or beat mark on the paper surface.
- Live pitch feedback should reuse the same red-brown/olive status language as the base detection page.

#### Score Result

Primary content:
- Total score.
- Accuracy score and rhythm score.
- Most important error location.
- One concise practice suggestion.
- Save and retry actions.

Visual behavior:
- Use the same annotation language as the base result page.
- Score practice results can add rhythm-specific markup, but should not create a separate visual system.

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

Result reuse:
- Basic practice result and score-practice result should share the same result shell: large score, correction markup, compact metrics, and quiet actions.
- Basic result emphasizes pitch accuracy and stability.
- Score-practice result emphasizes total score, pitch score, rhythm score, and the most important phrase or note to retry.
- Shared structure is preferred over duplicating unrelated visual patterns across result pages.

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
- Secondary actions should be text links, row links, or thin line buttons. They should not use filled backgrounds or heavy bordered full-width buttons.
- Recording states must be readable without relying only on color.
- Empty, loading, permission-denied, and no-signal states should keep the same refined voice and avoid long instructional blocks.
- The UI should not add decorative animation. If motion is used, it should support listening state, pitch stabilization, or page transition clarity.

## Component Boundaries

The implementation should keep the existing mini program page structure and avoid introducing a parallel UI framework.

Suggested reusable style primitives and implementation direction:

- Paper page container: warm background, `40rpx 32rpx` default padding, no boxed outer card.
- Fine rule divider: `1rpx` line using `--line`, with `24-32rpx` vertical rhythm.
- Primary action control: near-black or ivory high-contrast pill/circle, `88rpx` minimum tap height, one per screen.
- Quiet secondary action: transparent background, no heavy fill, `1rpx` line or text-only row with clear tap area.
- Pitch readout block: dominant serif note name, compact cent/frequency metadata, stable dimensions to prevent layout shift.
- Quiet metadata label: `18-22rpx`, muted color, short labels only.
- Ledger row: flex row, `24rpx 0` padding, bottom border using `--line`, no card shadow.
- Markup/correction callout: ivory base, red-brown left rule or underline, one correction per block.
- Instrument selector: violin head image with tappable string zones, active state in gold-brown/ink/red-brown instead of blue.

These primitives should be expressed through shared `app.wxss` tokens and page-level classes, not a new component architecture unless duplication becomes substantial during implementation.

Migration strategy:
- First replace the global tokens in `app.wxss`.
- Then update shared button, panel, metadata, and page primitives.
- Then bring home, result, history, and score-practice pages into the paper system.
- Finally tune detect page so its existing warm style aligns with the new tokens and no longer uses blue active states.

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
- Detection page keeps the violin head interaction and removes blue active highlights.
- Result page gives one clear correction without clutter.
- History is scan-friendly and does not look like a stack of generic cards.
- The color system remains warm paper plus black/ivory, with gold-brown and red-brown used only for meaning.

## Out Of Scope

- New backend features.
- New practice data schema.
- New score evaluation behavior.
- New onboarding, subscription, social, or teacher-account flows.
- Full animation system beyond small state transitions needed for listening and feedback clarity.
- Dark mode. Future dark mode should define a separate deep paper/instrument palette instead of inverting the current light tokens.
