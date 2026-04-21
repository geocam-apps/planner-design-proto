<script lang="ts">
	import type { CollectionSummary, ProjectSummary } from '$lib/types';
	import CollectionCard from './CollectionCard.svelte';
	import CardActions from './CardActions.svelte';
	import Highlight from './Highlight.svelte';
	import SearchBox from './SearchBox.svelte';
	import { ChevronRight, Folder, Layers, LoaderCircle, TriangleAlert } from '@lucide/svelte';
	import { arrange, isHidden } from '$lib/stores/preferences.svelte';
	import { createProjectSearch, setProjectSearch } from '$lib/search/state.svelte';
	import { untrack } from 'svelte';

	let { project }: { project: ProjectSummary } = $props();

	const search = createProjectSearch(untrack(() => project.slug));
	setProjectSearch(search);

	let userExpanded = $state(false);
	let loadState = $state<'idle' | 'loading' | 'loaded' | 'error'>('idle');
	let loadError = $state<string | null>(null);
	let collections = $state<CollectionSummary[]>([]);

	// Expand whenever the user toggled open OR a search is active in this project.
	const expanded = $derived(userExpanded || search.active);

	async function ensureLoaded() {
		if (loadState === 'loaded' || loadState === 'loading') return;
		loadState = 'loading';
		try {
			const res = await fetch(`/api/projects/${project.slug}/collections`);
			if (!res.ok) throw new Error(`http ${res.status}`);
			const data = (await res.json()) as { collections: CollectionSummary[] };
			collections = data.collections;
			loadState = 'loaded';
		} catch (e) {
			loadError = e instanceof Error ? e.message : String(e);
			loadState = 'error';
		}
	}

	$effect(() => {
		if (expanded) ensureLoaded();
	});

	const statusPill = $derived(
		project.status === 'active'
			? 'bg-emerald-100 text-emerald-700'
			: project.status === 'planning'
				? 'bg-sky-100 text-sky-700'
				: 'bg-slate-100 text-slate-600'
	);

	const hidden = $derived(isHidden('project', project.id));
	const arrangedCollections = $derived(arrange(collections, 'collection'));
	const matchedFields = $derived(search.matchedProjectFields(project.id));

	function toggle() {
		userExpanded = !userExpanded;
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggle();
		}
	}
</script>

<div
	class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 transition-shadow {expanded
		? 'shadow-md shadow-slate-900/10'
		: ''} {hidden ? 'opacity-60' : ''}"
>
	<div
		role="button"
		tabindex="0"
		aria-expanded={expanded}
		onclick={toggle}
		onkeydown={onKey}
		class="flex cursor-pointer items-center gap-4 px-5 py-4 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset focus-visible:outline-none"
	>
		<div
			class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500 ring-1 ring-slate-200"
		>
			<Folder size={18} />
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<h2 class="truncate text-base font-semibold text-slate-900">
					<Highlight
						text={project.name ?? project.reference ?? project.slug}
						query={matchedFields.has('name') ? search.query : ''}
					/>
				</h2>
				<span class="rounded-full px-2 py-0.5 text-xs font-medium {statusPill}">
					{project.status}
				</span>
				{#if hidden}
					<span class="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">
						hidden
					</span>
				{/if}
			</div>
			<p class="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
				{#if project.reference && project.reference !== project.name}
					<span class="font-mono">
						<Highlight
							text={project.reference}
							query={matchedFields.has('reference') ? search.query : ''}
						/>
					</span>
				{/if}
				<span class="inline-flex items-center gap-1">
					<Layers size={12} />
					{project.collectionCount}
					{project.collectionCount === 1 ? 'collection' : 'collections'}
				</span>
				<span>·</span>
				<span>{project.captureCount} {project.captureCount === 1 ? 'capture' : 'captures'}</span>
			</p>
		</div>
		<CardActions type="project" id={project.id} />
		<ChevronRight
			size={16}
			class="text-slate-400 transition-transform {expanded ? 'rotate-90' : ''}"
		/>
	</div>
	{#if expanded}
		<div class="border-t border-slate-100 bg-slate-50/50 p-4">
			<div class="mb-3">
				<SearchBox {search} />
			</div>
			{#if loadState === 'loading'}
				<div class="flex items-center gap-2 px-1 py-2 text-sm text-slate-500">
					<LoaderCircle size={14} class="animate-spin" />
					Loading collections…
				</div>
			{:else if loadState === 'error'}
				<div class="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
					<TriangleAlert size={14} />
					Failed to load collections: {loadError}
				</div>
			{:else if loadState === 'loaded' && arrangedCollections.length === 0}
				<p class="px-1 py-2 text-sm text-slate-500">
					{#if collections.length > 0}
						All collections in this project are hidden. Toggle "Show hidden" to see them.
					{:else}
						No collections in this project yet.
					{/if}
				</p>
			{:else if loadState === 'loaded'}
				<div class="flex flex-col gap-2">
					{#each arrangedCollections as collection (collection.id)}
						<CollectionCard {collection} />
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
