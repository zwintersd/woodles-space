# Schedule planner: feature catalogue and workflow proposal

Audited October 3, 2026. Scope: `/schedules/generator`, its shared data and visual tools, and `/schedules/view`. The separate `/schedules/9-25` example is an adjacent entry point, not the weekly planner's storage or editing system. This report proposes changes; it does not implement them.

The planner already supports a substantial visual-schedule workflow. Its main weakness is that planning time, creating reusable content, configuring learner interactions, preparing pictures, and printing compete within the same screen and nested dialogs.

## Current feature catalogue

| Area | Implemented features | Boundaries and details |
| --- | --- | --- |
| Entry points | Schedule studio hub; weekly planner; standalone Image Studio; finished September 25 example; visual schedule route | The hub adds a navigation step before the saved-plan library. |
| Learner plans | Create a blank plan; learner label; plan name; editable names; saved-plan cards; updated date; populated-day/item summaries; open, duplicate, delete, import, export | New plans have seven weekdays with default 9 AM–noon windows but no activities. Plans are weekly patterns, without a dated-week field or date-specific overrides. |
| Days | Seven day selectors; per-day session start/end; scheduled/unassigned-minute totals; week summary; copy to another visible day; clear day; delete day; restore removed day | Copy replaces the destination's items, session window, and print settings. Deleting a day clears its items. Restoring it restores visibility, not its former content. |
| Timing | Start time and duration; chronological ordering; automatic placement in the first fitting gap; overlap and session-boundary validation; earlier/later buttons | Durations are 1–480 minutes. New ordinary activities use automatic placement; their start becomes explicitly editable afterward. Other item types expose start time immediately. Reordering repacks all items contiguously from session start. Changing the window rejects incompatible items rather than shifting them. |
| Ordinary activities | Name; category with suggested/free-text values; duration; symbol; seven colors; optional picture; image credit; support note; optional ordered steps | Activities are scheduled snapshots. New activities default to saving a reusable library card. Editing a linked occurrence can optionally update that card for future use. |
| Activity library | Add a saved activity to a day; retain its pictures and steps; optionally update the source card; remove a library card while keeping placed copies | Currently accessed through the activity dialog. No dedicated activity-library workspace, search/filter controls, or independent create/edit workflow. |
| Steps inside an activity | Up to 20 steps; title and visual; add/remove/reorder; ordinary task, choice, or suggestion step; nested choices with up to six options; nested suggestion configuration | Steps share the containing activity's total time. Ordinary steps have no independent start times or individual completion controls. Suggestion steps have a bounded time budget. |
| Choice blocks | Two to six options; heading and prompt; start/duration; options created directly or from saved activities; per-option visuals and New/Again labels; removal | Learner taps an option in the visual schedule. A library activity becomes a compact option, not a complete executable copy with all its steps. Choice blocks lack the ordinary activity library's reuse workflow. |
| Video blocks | One to four HTTPS video links; titles; heading/prompt; start/duration; automatic YouTube thumbnails; uploaded/cropped thumbnails; New/Again labels; detection of earlier same-day offerings | One video is presented to watch together; several allow a learner pick. Watch opens an external tab. No playback-duration inference or completion tracking from the player. No standalone video library. |
| Suggestion blocks and steps | Heading/prompt; slot budget; up to 60 candidates; create candidates or add saved activities/videos; enabled state; category; duration; weight 1–10; picture/link/credit/note; saved candidate steps; reusable pools | Only enabled candidates that fit can be drawn. Pools store content and rules; scheduled copies stay independent. Pools are managed inside the suggestion editor rather than a dedicated library. |
| Suggestion policy | No, limited, or unlimited rerolls; repeat avoidance within that slot for the day; optional category selection; optional skip; spinning reel or instant reveal; readiness count; explicit maker reset of today's draws | Category changes share the draw budget. Acceptance locks the result. Refresh and clearing checks preserve draws. Daily rollover starts fresh. Reduced motion uses instant reveal. Repeat avoidance is per slot, not a whole-plan prohibition. |
| Built-in symbols | Direct emoji input; searchable labeled catalogue; Popular, Recent, Learning, Daily routines, Movement, Play, Nature, All groups; stored recents; preview; bundled OpenMoji for supported picks; native fallback | The richer emoji browser is available in the main activity/choice composer; some nested editors use direct text fields plus separate picture/custom-symbol buttons. |
| ARASAAC | Word/phrase search; automatic search from editor context; debounced input; cached results; up to 40 results; keyboard selection; empty/error/stale-request handling; manual ID entry | Search is English and requires the external service. Selected IDs render external pictogram images. Used across activities, steps, nested choice options, choices, and suggestion candidates. |
| Custom symbols | Separate symbol manager/picker; multiple PNG/JPG/WebP/GIF uploads; named sprites; groups; search/group filtering; edit name/group/credit/pixel-art treatment; removal; JSON library import/export | Up to 256 symbols. Static uploads become square symbols up to 128 px; GIFs retain animation with a still for print/reduced motion. Removing or editing a library entry preserves saved schedule snapshots. A custom symbol takes precedence over the optional activity picture. |
| Pictures and Image Studio | Manual ARASAAC ID/HTTPS picture; local upload and crop; drag framing; keyboard nudges; zoom; live canvas; preset size; JPEG/PNG/WebP; quality control; download; attach compact image | Presets: 512×512 activity, 1280×720 thumbnail, 3840×2160 wide, 2160×3840 vertical, 1080×1350 portrait. Full-size downloads are distinct from compact attached images. Studio is reachable independently and from activity/video editors. |
| Learner view | Learner greeting; day links; visual timeline; live clock; current-item highlighting; Now/Next; First/Then for other weekdays; finish message; whole-block check-offs; choices/video picks; nested steps and suggestions; edit-plan link | Now/Next follows clock times, not completion order. Ordinary nested steps are displayed without individual check-offs. Picks and checks persist for the current calendar day. The view reloads saved planner edits via storage events across tabs. |
| Progress controls | Toggle checks and choices; clear checks/picks; daily state; suggestion acceptance/skip; maker draw reset; shared draw budget across learner tabs | Clearing checks/picks deliberately retains suggestion state and its budget. Progress is local and daily, not a history/reporting system; plan JSON is not a progress export. |
| Printing | Selected day; schedule-list or two-column cut-card layout; show/hide times; standard/cut/laminate spacing; visuals, nested content, and source credits; static custom-symbol images | Print controls are persisted per day and always occupy the planning screen. Open slots remain printable cards. Existing tests inspect print-media behavior, not all paper/PDF pagination or physical cut dimensions. |
| Persistence and transfer | Browser-local automatic saving; save status/failure toast; plan JSON export/import; attached assets; relevant activity library cards, suggestion pools, custom symbols; separate symbol-library transfer | No account, cloud sync, publish workflow, or cross-device sharing link. Visual-schedule URLs identify plans stored in that browser. Import creates a new plan and remaps relevant IDs. Export is plan-scoped, not a full-workspace backup. |
| Accessibility and layout | Labeled controls; modal dialogs; keyboard controls/focus restoration in several flows; status announcements; responsive layouts; reduced-motion treatment; tested accessibility on covered flows | No horizontal overflow in the inspected 390 px planner. Vertical placement of the actual editor is the major mobile issue. This is not a claim that every screen has exhaustive accessibility coverage. |

## Why it feels messy

1. **The schedule is below its supporting controls.** In a clean temporary browser at 1440×1000, the list began approximately 796 px down. At 390×844 with one activity, it began approximately 2,300 px down. On mobile, the preview and repeated weekly summary appear before the editor.
2. **Too many actions compete.** Image Studio, printing, transfer, five add buttons, time settings, print settings, copy/clear/delete, preview, and duplicate/delete-plan controls surround a single day's list. The week is summarized twice.
3. **Reuse is fragmented.** Activities, videos, choices, pools, and symbols have different creation and reuse paths. The activity library is a dialog tab; pools are a dropdown in another dialog; video reuse searches material already in the plan.
4. **One small task can open several layers.** Editing an activity, configuring a suggestion step, and picking its picture can require layered dialogs and separate save boundaries. The containing activity still needs saving afterward.
5. **Pictures have overlapping controls.** Emoji, ARASAAC, custom symbol, uploaded image, and image URL are exposed as separate fields/buttons. Users must understand which source wins.
6. **Timing mixes two models.** Editing supports exact times and gaps, but the arrow action imposes a continuous sequence. A seemingly local reorder can change every start time.
7. **Destructive operations have weak recovery.** Confirmation dialogs exist, but no planner undo/history or trash workflow. Restoring a removed weekday does not restore its items.
8. **Planning and use have different progression rules.** The weekly view looks like a sequence, while learner Now/Next is clock-driven. Finishing early does not advance the current block. The interface does not offer a maker-selected progression mode.

## Proposed workflow

### 1. Open a learner plan

Make the saved-plan library the main Schedule studio destination. Keep New plan and Import there; keep the finished example separately available. Ask for a learner label and plan name, then let the maker choose active weekdays and session windows without populating activities. Default times should be easy to review and change.

Provide three main actions within a plan: **Plan**, **Use**, **Print**. Keep **Library** available as a supporting workspace for reusable content. Put backup, duplication, renaming, and deletion under a clearly labeled plan menu.

### 2. Build the selected day

Use one compact weekday strip and one main timeline/list. Put the selected day's session time and remaining minutes in a compact header. Keep the actual schedule immediately underneath. On mobile, show the selected-day editor first, with the weekday selector compact and horizontally scrollable.

One **Add item** action opens a small chooser:

- Activity — do something.
- Choice — learner picks from options.
- Video — watch one or choose a video.
- Suggestion — offer a random idea from a pool.
- Open time — reserve flexible time.

Show **From library** and **Create new** in that chooser. After picking or creating, keep the user in the day editor so adding several items is fast. Insert controls between items make placement explicit; retain keyboard-accessible move controls.

### 3. Edit one item in one place

Use a side inspector on desktop and a full-height sheet on mobile. Start with name, duration, and visual. Reveal options, video links, or pool candidates only for their relevant types. Put category/color/cues/credits under Details, steps under Steps, and random-draw rules under Suggestion rules.

Provide one **Choose visual** control with Emoji, ARASAAC, My symbols, and Upload tabs. Show the effective visual and its source. Put manual URLs/IDs under an advanced input. Retain source credits automatically and allow explicit replacement or removal.

Nested steps should use the same small editor vocabulary. Configuring a suggestion step should stay inside the activity editor, with one clear final save and a visible unsaved draft state.

### 4. Make timing predictable

Offer a plan/day setting with two explicit behaviors:

- **Keep in sequence:** compute starts from durations; reorder changes the sequence; editable open-time blocks preserve intended gaps.
- **Keep set times:** retain explicit starts and gaps; an insert or move shows conflicts and proposed adjustments before applying them.

For existing plans, preserve current times on migration. Require an explicit action to pack a day into a sequence. Do not silently reinterpret old schedules.

Support inline duration changes with immediate feedback such as “10 minutes over the session.” When shortening a session, show affected items and possible adjustments instead of only rejecting the edit.

### 5. Reuse deliberately

Library sections: Activities, Videos, Choices, Suggestion pools, and Symbols. Provide search, category/group filters, previews, create/edit/duplicate/remove, and add-to-day. Reuse remains snapshot-based so existing days do not change unexpectedly.

Default edits to **This scheduled item**. Offer **Update library for future use** as a separate explicit action. If updating already-placed occurrences is added later, show the precise affected days and require selecting them.

Provide **Copy to days…** with multiple target days and a replacement summary. Keep true dated weeks/date overrides outside the first redesign; describe the current model consistently as a weekly pattern.

### 6. Preview, then use

Use a collapsible learner preview instead of a permanent preview card plus duplicate entry buttons. **Use** opens the existing learner view with a clear way back to planning.

Let makers choose **Follow the clock** or **Advance when done** when that capability is implemented. Preserve clock mode for existing plans. In completion mode, marking a block done advances Now/Next; ordinary nested steps can gain individual checks. These are proposed behavior extensions, not existing features.

Keep choice, suggestion, and skip controls simple for learners. Put policies and reset-draw controls in maker editing. Explain reset scope: **Clear checks and choices** versus **Reset today's suggestions**.

### 7. Prepare print and backup outputs

**Print** opens a dedicated preview with selected-day scope, list/cut-card mode, time visibility, and cut/laminate spacing. Show only settings relevant to the chosen layout and keep all attributions. Multi-day printing can follow later with explicit day selection and page breaks.

Keep Export/Import in the plan/library menus and retain a visible local save indicator. Explain that opening the URL on another device requires transferring the plan. Consider a full-workspace backup separately from plan export.

### 8. Make everyday edits recoverable

Add Undo for item removal, moves, day copying, and clearing. Replace Delete day with **Hide day** that retains content, plus a separate **Clear day**. Use scope-bearing labels: Remove from day, Remove from library, Delete plan. Provide recoverable plan deletion before adding permanent deletion controls.

## Implementation order

1. **Reclaim the editor:** compact plan header/day strip; mobile editor first; remove repeated week summary; move print/backup/destructive controls out of the work area; one Add item chooser. Preserve data and existing interactions.
2. **Resolve behavior surprises:** preserve timing during moves; explicit sequence packing; hide days without clearing content; undo; clearer local-save and transfer wording.
3. **Unify creation and reuse:** shared item inspector and visual chooser; activity/pool library workspace first; then video/choice libraries; eliminate nested save confusion.
4. **Improve delivery:** dedicated print preview; optional completion-driven learner progression and step checks; multi-day printing and dated exceptions only when their need is established.

The first useful slice is stages 1 and the move/hide-day corrections from stage 2. Its success criteria are that the selected day's items and Add action are visible in the first mobile screen, moving an item cannot silently remove intentional gaps, and hiding/restoring a day preserves its contents. Expand reuse and learner behavior afterward.

## Evidence and verification limits

Source inspected: `generator/app.js`, `shared.js`, `custom-symbols.js`, `arasaac-picker.js`, `index.html`, `styles.css`; `view/app.js`; hub markup; all five schedule-specific E2E files.

Current verification: JavaScript syntax check passed. A temporary isolated Playwright browser created a blank plan, opened the activity editor, added an activity, inspected desktop/mobile placement, and opened suggestion setup; no page errors occurred. The agent-browser CLI was unavailable, so the installed Playwright runtime was used.

All 13 existing Chromium schedule tests passed in 22.6 seconds, covering ARASAAC flows, custom-symbol management/transfers, ordinary and nested suggestion steps, reuse/import/export, draw budgets/acceptance/day rollover/cross-tab behavior, and accessibility checks in covered flows. ARASAAC service responses in its tests are mocked; this does not establish live external-service availability. Print-media assertions do not establish complete PDF pagination or physical output quality. The standalone Image Studio's full crop/download matrix was inspected in source, not exhaustively exercised during this audit.

At the time of the baseline audit, the app implementation was left unchanged. Browser audit data existed only in temporary test contexts.

## Initial implementation — October 3, 2026

Implemented after approval: compact plan header and weekday strip; mobile editor first; one Add item chooser with all five item types and direct activity-library access; print settings in a dedicated dialog; plan/day tools in labeled disclosures; collapsed learner preview; removal of the duplicate weekly summary.

Moves now swap only the neighboring items within their existing combined time span, retaining the gap between them and every other item's start. Hide day retains items and settings; restoring a hidden day restores its saved schedule. Plan tools remain accessible when all days are hidden. Existing local-storage format and item editors are retained.

Verification: all 16 schedule browser tests passed (the prior 13 plus three new workflow tests). After final refinements to focus and all-hidden-day tools, the three workflow tests passed again. E2E TypeScript, JavaScript syntax checks, and diff whitespace checks passed. Desktop and mobile screenshots were visually inspected. The new workflow tests cover all item-editor entry points, library reuse, preview/use navigation, preserved gaps, reload/restoration, hiding all days, backup access, and per-day print settings/output visibility.

Follow-up work remains as proposed: undo/recovery, unified item/visual editors, expanded libraries, dedicated print preview, and optional completion-driven learner progression. The print dialog opens the browser's existing preview rather than adding a new preview renderer.

## Recovery implementation — October 3, 2026

Added Undo for item removal, neighboring moves, day copying, and clearing. The top-bar control names the available action; Ctrl/Cmd+Z invokes it outside text fields and dialogs. History holds the last 20 recovery actions in this session and ends on reload. Later edits to an affected day invalidate its older snapshots so Undo does not overwrite those edits. Undo restores item IDs, nested content, exact times, gaps, session settings, and print settings without reverting unrelated days or library changes.

Plan removal now uses Move plan to Trash. Plan Trash is available in the learner-plan library and survives reloads. Restore brings back the plan with its saved days and pictures. Immediate Undo also restores a trashed plan. The learner view excludes trashed plans and observes restoration across tabs. This is the schedule planner's local Plan Trash, not HomeSuite's separate trash service.

Asset pruning retains pictures referenced by undo history and trashed plans, including nested and custom-symbol images. Recovery operations roll back in-memory changes and preserve history when browser saving fails; they do not display a success message in that case. Trashed plans are retained until restored; permanent deletion is not introduced in this slice. Plan exports still contain one active plan, not all trashed plans.

Verification: all 20 schedule Chromium tests passed in 32.3 seconds. Four new recovery tests cover reverse-order undo, retained pictures, original destination settings after copy, restoration/export after reload, cross-tab learner restoration, protection against later edits, native text undo, and simulated save failures. E2E TypeScript, JavaScript syntax, and whitespace checks passed. Mobile Trash rendering was visually inspected.

Next bounded slice: shared item/visual editing and a more direct reusable activity/pool library workflow.

## Creation and reuse implementation — October 3, 2026

Added a Reusable library available before creating a plan and from the plan header. Activities and suggestion pools have separate tabs, search, category filtering, creation, editing, duplication, removal, and repeated Add to selected day. Library cards retain independent scheduled snapshots: changing or removing the source leaves existing scheduled copies intact. Adding a card uses the first fitting open time and reports when the day has insufficient space.

Scheduled items and reusable activities use the same side editor. Activity name, duration, and selected visual appear first; Details and optional Steps are disclosed separately. The main activity visual control combines emoji/symbol selection, ARASAAC, custom symbols, uploaded/cropped pictures, and linked pictures behind Choose visual, with the current source visible beside the preview. Item editors share the side-panel presentation; advanced step and candidate controls retain their existing layouts.

Save scope is explicit. Editing a scheduled activity or suggestion defaults to that occurrence; updating its reusable source requires selecting the corresponding option. Standalone library editing saves for future use. New nested suggestion pools remain pending until their parent activity saves, and cancellation discards them. Activity and standalone pool saving roll back on persistence failure and retain the draft for retry.

Verification: all 23 schedule Chromium tests passed in 38.6 seconds. Three new library tests cover creation without a plan, filtering, repeated reuse, snapshot independence, explicit source updates, duplicate/remove behavior, picture and step persistence, nested cancellation, and simulated save failure/retry. Automated accessibility checks cover the new activity editor and pool library; mobile screenshots were visually inspected. E2E TypeScript, JavaScript syntax, and diff whitespace checks passed. Existing ARASAAC tests use mocked service responses, and physical print output remains outside this verification.

Remaining stages: dedicated video/choice libraries, further simplification of nested visual editing, dedicated print preview, and optional completion-driven learner progression. These changes are local and uncommitted.
