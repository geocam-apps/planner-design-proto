<script lang="ts">
	import { slide } from 'svelte/transition';
	import { untrack } from 'svelte';
	import { ChevronRight, Layers } from '@lucide/svelte';
	import type { CollectionStageKey, CollectionSummary } from '$lib/types';
	import { COLLECTION_STAGES } from '$lib/types';
	import StageStrip from './StageStrip.svelte';
	import StageStepper from './StageStepper.svelte';
	import { COLLECTION_ICONS } from './stages';
	import CollectionPane from './CollectionPane.svelte';
	import CardActions from './CardActions.svelte';
	import { isHidden } from '$lib/stores/preferences.svelte';

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

	const hidden = $derived(isHidden('collection', collection.id));

	function toggle() {
		expanded = !expanded;
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggle();
		}
	}
</script>

<div
	class="overflow-hidden rounded-xl border border-slate-200/80 bg-white transition-shadow {expanded
		? 'shadow-sm shadow-slate-900/10'
		: ''} {hidden ? 'opacity-60' : ''}"
>
	<div
		role="button"
		tabindex="0"
		aria-expanded={expanded}
		onclick={toggle}
		onkeydown={onKey}
		class="flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset focus-visible:outline-none"
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
				{#if hidden}
					<span class="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">
						hidden
					</span>
				{/if}
			</div>
			{#if collection.description}
				<p class="mt-0.5 truncate text-xs text-slate-500">{collection.description}</p>
			{/if}
		</div>
		<CardActions type="collection" id={collection.id} size="sm" />
		<StageStrip
			stages={collection.stages}
			icons={COLLECTION_ICONS}
			{labels}
			current={collection.currentStage}
			size="sm"
		/>
	</div>
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
