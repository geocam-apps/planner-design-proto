// Prototype-local user preferences. Persisted to localStorage under a single
// key. This stands in for real DB columns (see SCHEMA_CHANGES.md) until the
// Rails side is ready.

export type EntityType = 'project' | 'collection' | 'capture';

type IdSet = Record<string, true>;

type PrefsShape = {
	starred: Record<EntityType, IdSet>;
	hidden: Record<EntityType, IdSet>;
	showHidden: boolean;
};

const STORAGE_KEY = 'planner-proto-prefs-v1';

function blank(): PrefsShape {
	return {
		starred: { project: {}, collection: {}, capture: {} },
		hidden: { project: {}, collection: {}, capture: {} },
		showHidden: false
	};
}

function loadInitial(): PrefsShape {
	if (typeof localStorage === 'undefined') return blank();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return blank();
		const parsed = JSON.parse(raw) as Partial<PrefsShape>;
		const base = blank();
		return {
			starred: { ...base.starred, ...(parsed.starred ?? {}) },
			hidden: { ...base.hidden, ...(parsed.hidden ?? {}) },
			showHidden: parsed.showHidden ?? false
		};
	} catch {
		return blank();
	}
}

export const prefs = $state<PrefsShape>(loadInitial());

function persist() {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify($state.snapshot(prefs)));
	} catch {
		// quota exceeded or private mode — non-fatal for a prototype
	}
}

export function isStarred(type: EntityType, id: string): boolean {
	return Boolean(prefs.starred[type][id]);
}

export function toggleStarred(type: EntityType, id: string): void {
	const bucket = prefs.starred[type];
	if (bucket[id]) delete bucket[id];
	else bucket[id] = true;
	persist();
}

export function isHidden(type: EntityType, id: string): boolean {
	return Boolean(prefs.hidden[type][id]);
}

export function toggleHidden(type: EntityType, id: string): void {
	const bucket = prefs.hidden[type];
	if (bucket[id]) delete bucket[id];
	else bucket[id] = true;
	persist();
}

export function setShowHidden(value: boolean): void {
	prefs.showHidden = value;
	persist();
}

export function hiddenCount(type?: EntityType): number {
	if (type) return Object.keys(prefs.hidden[type]).length;
	return (
		Object.keys(prefs.hidden.project).length +
		Object.keys(prefs.hidden.collection).length +
		Object.keys(prefs.hidden.capture).length
	);
}

// Sort starred items first, filter out hidden unless showHidden is on.
export function arrange<T extends { id: string }>(items: T[], type: EntityType): T[] {
	const filtered = prefs.showHidden ? items : items.filter((i) => !isHidden(type, i.id));
	const starred: T[] = [];
	const rest: T[] = [];
	for (const item of filtered) {
		if (isStarred(type, item.id)) starred.push(item);
		else rest.push(item);
	}
	return [...starred, ...rest];
}
