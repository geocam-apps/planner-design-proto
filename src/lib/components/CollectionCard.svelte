<script lang="ts">
	import { slide } from 'svelte/transition';
	import { untrack } from 'svelte';
	import { ChevronRight, Layers } from 'lucide-svelte';
	import type { CollectionStageKey, CollectionSummary } from '$lib/types';
	import { COLLECTION_STAGES } from '$lib/types';
	import StageStrip from './StageStrip.svelte';
	import StageStepper from './StageStepper.svelte';
	import { COLLECTION_ICONS } from './stages';
	import CollectionPane from './CollectionPane.svelte';

	let { collection }: { collection: CollectionSummary } = $props();

	let expanded = $state(false);
	let activeStage = $state<CollectionStageKey>(untrack(() => collection.currentStage));

	const labels = $derived(
		Object.fromEntries(COLLECTION_STAGES.map((s) => [s.key, s.label])) as Record<
			CollectionStageKey,
			string
		>
	);
	const order = COLLECTION_STAGES.map((s) => s.key);
</script>

<div
	class="overflow-hidden rounded-xl border border-slate-200/80 bg-white transition-shadow {expanded
		? 'shadow-sm shadow-slate-900/10'
		: ''}"
>
	<button
		type="button"
		onclick={() => (expanded = !expanded)}
		aria-expanded={expanded}
		class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset focus-visible:outline-none"
	>
		<ChevronRight
			size={16}
			class="shrink-0 text-slate-400 transition-transform {expanded ? 'rotate-90' : ''}"
		/>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<h3 class="truncate text-sm font-semibold text-slate-900">
					{collection.name ?? collection.slug}
				</h3>
				{#if collection.captureCount > 0}
					<span class="inline-flex items-center gap-1 text-xs text-slate-500">
						<Layers size={11} />{collection.captureCount}
					</span>
				{/if}
			</div>
			{#if collection.description}
				<p class="mt-0.5 truncate text-xs text-slate-500">{collection.description}</p>
			{/if}
		</div>
		<StageStrip
			stages={collection.stages}
			icons={COLLECTION_ICONS}
			{labels}
			current={collection.currentStage}
			size="sm"
		/>
	</button>
	{#if expanded}
		<div
			transition:slide={{ duration: 180 }}
			class="border-t border-slate-100 bg-slate-50/70 p-3"
		>
			<StageStepper
				stages={collection.stages}
				icons={COLLECTION_ICONS}
				{labels}
				bind:active={activeStage}
				{order}
			/>
			<div class="mt-3 rounded-lg border border-slate-200/80 bg-white p-4">
				<CollectionPane stage={activeStage} {collection} />
			</div>
		</div>
	{/if}
</div>
