// The single piece of canned content in onboarding: an illustrative
// `garden-import-v1` response, shown collapsed near the paste box in Beat 4 so
// the user knows what shape to expect. It is clearly labelled as an example and
// is never the user's real data — except in the dev backdoor, which seeds it so
// the "grown" beat can be inspected without a live LLM round-trip.

export const ONBOARDING_EXAMPLE_OBJECT = {
	woodles: 'garden-import-v1',
	kind: 'tv-series',
	title: 'Twin Peaks',
	description:
		'An FBI agent investigates the murder of a homecoming queen in a strange Pacific Northwest town.',
	network: 'ABC',
	firstAired: '1990',
	lastAired: '1991',
	genres: ['mystery', 'drama', 'surreal'],
	status: 'ended',
	seasons: [
		{
			kind: 'season',
			title: 'Season 1',
			year: '1990',
			episodeCount: 8,
			episodes: [
				{ kind: 'episode', title: 'Pilot', episodeNumber: 1, airDate: '1990-04-08' },
				{ kind: 'episode', title: 'Traces to Nowhere', episodeNumber: 2, airDate: '1990-04-12' }
			]
		},
		{
			kind: 'season',
			title: 'Season 2',
			year: '1990',
			episodeCount: 22,
			episodes: [
				{ kind: 'episode', title: 'May the Giant Be with You', episodeNumber: 1, airDate: '1990-09-30' },
				{ kind: 'episode', title: 'Coma', episodeNumber: 2, airDate: '1990-10-06' }
			]
		}
	]
};

export const ONBOARDING_EXAMPLE = JSON.stringify(ONBOARDING_EXAMPLE_OBJECT, null, 2);
