// World 1's field note templates now live in @woodles/witch-engine, bundled
// the same way the package bundles its own example fixtures. Re-exported
// here so every existing call site in this app keeps working unchanged.
export {
	fieldNotesByDomain,
	equilibriumFieldNotes,
	quietFieldNotes,
	categoryMasteryFieldNotes
} from '@woodles/witch-engine';
