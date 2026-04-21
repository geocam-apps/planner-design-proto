<script lang="ts">
	import type { CollectionSummary, ProjectSummary } from '$lib/types';
	import CollectionCard from './CollectionCard.svelte';
	import { Layers, LoaderCircle, TriangleAlert, Folder } from '@lucide/svelte';

	let { project }: { project: ProjectSummary } = $props();

	let expanded = $state(false);
	let loadState = $state<'idle' | 'loading' | 'loaded' | 'error'>('idle');
	let loadError = $state<string | null>(null);
	let collections = $state<CollectionSummary[]>([]);

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
</script>

<div
	class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 transition-shadow {expanded
		? 'shadow-md shadow-slate-900/10'
		: ''}"
>
	<button
		type="button"
		onclick={() => (expanded = !expanded)}
		aria-expanded={expanded}
		class="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset focus-visible:outline-none"
	>
		<div
			class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500 ring-1 ring-slate-200"
		>
			<Folder size={18} />
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<h2 class="truncate text-base font-semibold text-slate-900">
					{project.name ?? project.reference ?? project.slug}
				</h2>
				<span class="rounded-full px-2 py-0.5 text-xs font-medium {statusPill}">
					{project.status}
				</span>
			</div>
			<p class="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
				{#if project.reference && project.reference !== project.name}
					<span class="font-mono">{project.reference}</span>
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
		<div class="text-slate-400">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="transition-transform {expanded ? 'rotate-90' : ''}"
			>
				<polyline points="9 18 15 12 9 6"></polyline>
			</svg>
		</div>
	</button>
	{#if expanded}
		<div class="border-t border-slate-100 bg-slate-50/50 p-4">
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
			{:else if loadState === 'loaded' && collections.length === 0}
				<p class="px-1 py-2 text-sm text-slate-500">No collections in this project yet.</p>
			{:else if loadState === 'loaded'}
				<div class="flex flex-col gap-2">
					{#each collections as collection (collection.id)}
						<CollectionCard {collection} />
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
