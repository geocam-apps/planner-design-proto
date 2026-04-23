<script lang="ts">
	import ProjectCard from '$lib/components/ProjectCard.svelte';
	import ShowHiddenToggle from '$lib/components/ShowHiddenToggle.svelte';
	import { arrange } from '$lib/stores/preferences.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import {
		LogOut,
		ShieldCheck,
		Search,
		Filter,
		ScanSearch,
		X,
		LoaderCircle
	} from '@lucide/svelte';
	import type { PageData } from './$types';
	import type { ProjectSummary } from '$lib/types';

	let { data }: { data: PageData } = $props();

	type Mode = 'filter' | 'search';
	let mode = $state<Mode>('filter');
	let query = $state('');

	// --- Filter mode (client-side, project-name only) ---
	const arrangedProjects = $derived(arrange(data.projects, 'project'));
	const filteredByName = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (mode !== 'filter' || !q) return arrangedProjects;
		return arrangedProjects.filter((p) => (p.name ?? '').toLowerCase().includes(q));
	});
	const hiddenByFilter = $derived(
		mode === 'filter' ? arrangedProjects.length - filteredByName.length : 0
	);

	// --- Search mode (server-side, deep across projects/collections/captures) ---
	type GlobalMatch = {
		slug: string;
		name: string | null;
		projectMatch: boolean;
		collectionMatchCount: number;
		captureMatchCount: number;
	};
	let debouncedQuery = $state('');
	let searchLoading = $state(false);
	let searchError = $state<string | null>(null);
	let searchMatches = $state<GlobalMatch[] | null>(null);
	let searchTruncated = $state(false);

	$effect(() => {
		const q = query;
		const id = setTimeout(() => {
			debouncedQuery = q;
		}, 220);
		return () => clearTimeout(id);
	});

	$effect(() => {
		if (mode !== 'search') {
			searchMatches = null;
			searchLoading = false;
			searchError = null;
			return;
		}
		const q = debouncedQuery.trim();
		if (q.length < 2) {
			searchMatches = null;
			searchLoading = false;
			searchError = null;
			return;
		}
		searchLoading = true;
		searchError = null;
		const ctl = new AbortController();
		fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
			.then((r) => {
				if (!r.ok) throw new Error(`http ${r.status}`);
				return r.json() as Promise<{ matches: GlobalMatch[]; truncated?: boolean }>;
			})
			.then((data) => {
				searchMatches = data.matches;
				searchTruncated = Boolean(data.truncated);
				searchLoading = false;
			})
			.catch((e: unknown) => {
				if (e instanceof DOMException && e.name === 'AbortError') return;
				searchError = e instanceof Error ? e.message : String(e);
				searchLoading = false;
			});
		return () => ctl.abort();
	});

	const searchedProjects = $derived.by((): ProjectSummary[] => {
		if (mode !== 'search' || !searchMatches) return [];
		const allowed = new Set(searchMatches.map((m) => m.slug));
		return arrangedProjects.filter((p) => allowed.has(p.slug));
	});

	function toggleMode() {
		mode = mode === 'filter' ? 'search' : 'filter';
	}

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		await invalidateAll();
		await goto('/login');
	}
</script>

<main class="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-10">
	<header class="flex items-end justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight text-slate-900">Projects</h1>
			<p class="mt-1 text-sm text-slate-500">
				Plan collections, run captures, review outputs.
			</p>
		</div>
		<div class="flex items-center gap-3">
			<ShowHiddenToggle />
			<a
				href="/drawing"
				class="text-xs font-medium text-slate-500 underline-offset-4 hover:text-slate-700 hover:underline"
			>
				Drawing prototype →
			</a>
			{#if data.user}
				<div class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600">
					{#if data.user.superuser}
						<ShieldCheck size={12} class="text-emerald-500" />
					{/if}
					<span class="max-w-[160px] truncate" title={data.user.email}>{data.user.email}</span>
					<button
						type="button"
						onclick={logout}
						aria-label="Sign out"
						title="Sign out"
						class="-mr-1 flex size-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
					>
						<LogOut size={12} />
					</button>
				</div>
			{/if}
		</div>
	</header>

	{#if data.projects.length > 0}
		<div class="flex items-center gap-2">
			<div class="relative flex-1">
				{#if mode === 'filter'}
					<Filter
						size={14}
						class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
					/>
				{:else}
					<Search
						size={14}
						class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 {searchLoading
							? 'text-sky-500'
							: 'text-slate-400'}"
					/>
				{/if}
				<input
					type="search"
					bind:value={query}
					placeholder={mode === 'filter'
						? 'Filter projects by name…'
						: 'Search captures, collections, project names…'}
					aria-label={mode === 'filter' ? 'Filter projects by name' : 'Search all'}
					class="w-full rounded-xl border bg-white py-2 pr-9 pl-9 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 {mode ===
					'search'
						? 'border-sky-300 focus:border-sky-400 focus:ring-sky-200'
						: 'border-slate-200 focus:border-sky-400 focus:ring-sky-200'}"
				/>
				{#if query}
					<button
						type="button"
						onclick={() => (query = '')}
						aria-label="Clear"
						class="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
					>
						<X size={13} />
					</button>
				{/if}
			</div>
			<button
				type="button"
				onclick={toggleMode}
				aria-pressed={mode === 'search'}
				title={mode === 'filter'
					? 'Switch to deep search (hits the server, matches capture references etc.)'
					: 'Switch back to name filter (instant, project names only)'}
				class="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none {mode ===
				'search'
					? 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100'
					: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
			>
				<ScanSearch size={14} />
				<span>{mode === 'search' ? 'Deep search' : 'Deep search'}</span>
			</button>
		</div>
	{/if}

	{#if mode === 'search'}
		{#if searchError}
			<p class="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
				Search failed: {searchError}
			</p>
		{:else if searchLoading && !searchMatches}
			<p class="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
				<LoaderCircle size={14} class="animate-spin" /> Searching…
			</p>
		{:else if query.trim().length < 2}
			<p class="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
				Type at least 2 characters to search across capture references, collection names, and project fields.
			</p>
		{:else if searchedProjects.length === 0 && !searchLoading}
			<p class="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
				Nothing matches "{debouncedQuery}".
			</p>
		{:else}
			<div class="flex flex-col gap-3">
				{#each searchedProjects as project (project.id)}
					<ProjectCard {project} externalSearchQuery={debouncedQuery} />
				{/each}
			</div>
			{#if searchTruncated}
				<p class="text-center text-xs text-slate-400">
					Showing the first {searchedProjects.length} matching projects — refine your query to narrow.
				</p>
			{/if}
		{/if}
	{:else if data.projects.length === 0}
		<p class="rounded-xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
			{#if data.user && !data.user.superuser}
				No projects in scope for your account.
			{:else}
				No projects yet.
			{/if}
		</p>
	{:else if arrangedProjects.length === 0}
		<p class="rounded-xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
			All projects are hidden. Toggle "Show hidden" to see them.
		</p>
	{:else if filteredByName.length === 0}
		<p class="rounded-xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
			No project name matches "{query}".
		</p>
	{:else}
		<div class="flex flex-col gap-3">
			{#each filteredByName as project (project.id)}
				<ProjectCard {project} />
			{/each}
		</div>
		{#if hiddenByFilter > 0}
			<p class="text-center text-xs text-slate-400">
				{hiddenByFilter} {hiddenByFilter === 1 ? 'project' : 'projects'} hidden by filter
			</p>
		{/if}
	{/if}
</main>
