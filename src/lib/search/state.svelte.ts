import { getContext, setContext } from 'svelte';
import type {
	CaptureField,
	CollectionField,
	ProjectField,
	SearchPayload
} from './types';

export type ProjectSearchApi = {
	readonly query: string;
	setQuery(value: string): void;
	clear(): void;
	readonly loading: boolean;
	readonly error: string | null;
	readonly active: boolean;
	readonly anyMatches: boolean;
	readonly totalCount: number;
	hasProjectMatch(id: string): boolean;
	hasCollectionMatch(id: string): boolean;
	hasCaptureMatchInCollection(collectionId: string): boolean;
	hasCaptureMatch(id: string): boolean;
	matchedProjectFields(id: string): Set<ProjectField>;
	matchedCollectionFields(id: string): Set<CollectionField>;
	matchedCaptureFields(id: string): Set<CaptureField>;
};

const KEY = Symbol('project-search');

export function setProjectSearch(api: ProjectSearchApi): void {
	setContext(KEY, api);
}

export function getProjectSearch(): ProjectSearchApi | undefined {
	return getContext(KEY);
}

// Factory expected to be called from inside a component's <script> so the
// $state/$effect it creates are owned by that component's lifecycle.
export function createProjectSearch(projectSlug: string): ProjectSearchApi {
	let query = $state('');
	let debounced = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let matches = $state<SearchPayload | null>(null);

	// debounce
	$effect(() => {
		const q = query;
		const id = setTimeout(() => {
			debounced = q;
		}, 180);
		return () => clearTimeout(id);
	});

	// fetch
	$effect(() => {
		const q = debounced.trim();
		if (q.length < 2) {
			matches = null;
			loading = false;
			error = null;
			return;
		}
		loading = true;
		error = null;
		const ctl = new AbortController();
		fetch(`/api/projects/${encodeURIComponent(projectSlug)}/search?q=${encodeURIComponent(q)}`, {
			signal: ctl.signal
		})
			.then((r) => {
				if (!r.ok) throw new Error(`http ${r.status}`);
				return r.json() as Promise<SearchPayload>;
			})
			.then((data) => {
				matches = data;
				loading = false;
			})
			.catch((e: unknown) => {
				if (e instanceof DOMException && e.name === 'AbortError') return;
				error = e instanceof Error ? e.message : String(e);
				loading = false;
			});
		return () => ctl.abort();
	});

	return {
		get query() {
			return query;
		},
		setQuery(v: string) {
			query = v;
		},
		clear() {
			query = '';
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},
		get active() {
			return debounced.trim().length >= 2;
		},
		get anyMatches() {
			const m = matches;
			return !!m && m.projects.length + m.collections.length + m.captures.length > 0;
		},
		get totalCount() {
			const m = matches;
			if (!m) return 0;
			return m.projects.length + m.collections.length + m.captures.length;
		},
		hasProjectMatch(id) {
			return matches?.projects.some((p) => p.id === id) ?? false;
		},
		hasCollectionMatch(id) {
			return matches?.collections.some((c) => c.id === id) ?? false;
		},
		hasCaptureMatchInCollection(collectionId) {
			return matches?.captures.some((c) => c.collectionId === collectionId) ?? false;
		},
		hasCaptureMatch(id) {
			return matches?.captures.some((c) => c.id === id) ?? false;
		},
		matchedProjectFields(id) {
			const m = matches?.projects.find((p) => p.id === id);
			return new Set(m?.fields ?? []);
		},
		matchedCollectionFields(id) {
			const m = matches?.collections.find((c) => c.id === id);
			return new Set(m?.fields ?? []);
		},
		matchedCaptureFields(id) {
			const m = matches?.captures.find((c) => c.id === id);
			return new Set(m?.fields ?? []);
		}
	};
}
