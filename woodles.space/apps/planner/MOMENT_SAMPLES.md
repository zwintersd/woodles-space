# Moment samples

Write about a moment first. Color labels and further details are optional. Save moment (or Save changes) records the text, label and all entered details together.

Use **More details** to add mood, energy, coping, what helped, what made things harder, body sensations, or people and surroundings. Only one editor opens at a time. Ratings start unanswered. **Done** closes the editor; **Remove detail** clears that answer in the draft. Save the moment to commit either change. Saved detail chips reopen their editors.

**Worth adding?** shows at most two optional questions. The local rules consider words in the entry, the selected label's name, answers already entered, and strictly earlier samples from the same day. Each offer explains its reason. Nothing is inferred or automatically recorded. These are recording prompts, not health assessments or recommendations.

An earlier low energy or coping rating can prompt a later check-in, but not within an hour unless there is an explicit new cue in the entry. A newer rating supersedes the older rating. Dismiss a question or hide suggestions for the current moment; all fields remain available through More details. Show suggestions again resets those choices for that moment.

Optional details travel with observations through the existing local persistence, export and sync paths. Missing fields remain missing, including on older records. Editing text through an older caller that omits details preserves them; explicitly saving an empty details object removes them. Draft edits do not change the saved observation until Save.

Implementation: `momentDetails.ts` contains field definitions, cleaning and suggestion rules. `MomentDetails.svelte` owns disclosure and draft-only controls. `MomentarySample.svelte` saves the complete observation.
