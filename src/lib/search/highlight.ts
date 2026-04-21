export type HighlightPart = { text: string; match: boolean };

export function splitForHighlight(
	text: string | null | undefined,
	query: string
): HighlightPart[] {
	if (text == null || text === '') return [];
	if (!query || query.length < 2) return [{ text, match: false }];
	const needle = query.toLowerCase();
	const lower = text.toLowerCase();
	const out: HighlightPart[] = [];
	let i = 0;
	while (i < text.length) {
		const idx = lower.indexOf(needle, i);
		if (idx === -1) {
			out.push({ text: text.slice(i), match: false });
			break;
		}
		if (idx > i) out.push({ text: text.slice(i, idx), match: false });
		out.push({ text: text.slice(idx, idx + needle.length), match: true });
		i = idx + needle.length;
	}
	return out;
}
