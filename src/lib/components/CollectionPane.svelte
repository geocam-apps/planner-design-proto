<script lang="ts">
	import type { CaptureSummary, CollectionStageKey, CollectionSummary } from '$lib/types';
	import { LoaderCircle, TriangleAlert, Map, ChartLine, Eye } from '@lucide/svelte';
	import CaptureCard from './CaptureCard.svelte';

	let {
		stage,
		collection
	}: {
		stage: CollectionStageKey;
		collection: CollectionSummary;
	} = $props();

	// Lazy-load captures only when viewing the capture pane
	let captureState = $state<'idle' | 'loading' | 'loaded' | 'error'>('idle');
	let captureError = $state<string | null>(null);
	let captures = $state<CaptureSummary[]>([]);

	async function loadCaptures() {
		if (captureState === 'loaded' || captureState === 'loading') return;
		captureState = 'loading';
		try {
			const res = await fetch(`/api/collections/${collection.slug}/captures`);
			if (!res.ok) throw new Error(`http ${res.status}`);
			const data = (await res.json()) as { captures: CaptureSummary[] };
			captures = data.captures;
			captureState = 'loaded';
		} catch (e) {
			captureError = e instanceof Error ? e.message : String(e);
			captureState = 'error';
		}
	}

	$effect(() => {
		if (stage === 'capture') loadCaptures();
	});
</script>

{#if stage === 'plan'}
	<div class="flex flex-col gap-2">
		<div class="flex items-center gap-2 text-sm font-semibold text-slate-800">
			<Map size={16} /> Plan
		</div>
		<p class="text-xs text-slate-500">
			Maps, floor plans and other reference imagery for this collection live here. You'll
			be able to draw walking routes on them — the drawing tool from the earlier prototype
			will slot in at this spot.
		</p>
		<div
			class="mt-2 flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400"
		>
			(drawing tool placeholder)
		</div>
	</div>
{:else if stage === 'analysis'}
	<div class="flex flex-col gap-2">
		<div class="flex items-center gap-2 text-sm font-semibold text-slate-800">
			<ChartLine size={16} /> Analysis
		</div>
		<p class="text-xs text-slate-500">
			Analysis of the plan before field work — coverage checks, route validation, scheduling
			notes. Stub for now.
		</p>
	</div>
{:else if stage === 'capture'}
	<div class="flex flex-col gap-2">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2 text-sm font-semibold text-slate-800">Captures</div>
			<span class="text-xs text-slate-400">
				{collection.captureCount} total
			</span>
		</div>
		{#if captureState === 'loading'}
			<div class="flex items-center gap-2 py-2 text-xs text-slate-500">
				<LoaderCircle size={14} class="animate-spin" />
				Loading captures…
			</div>
		{:else if captureState === 'error'}
			<div
				class="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700"
			>
				<TriangleAlert size={14} />
				Failed to load captures: {captureError}
			</div>
		{:else if captureState === 'loaded' && captures.length === 0}
			<p class="py-2 text-xs text-slate-500">No captures recorded in this collection yet.</p>
		{:else if captureState === 'loaded'}
			<div class="flex flex-col gap-2">
				{#each captures as capture (capture.id)}
					<CaptureCard {capture} />
				{/each}
			</div>
		{/if}
	</div>
{:else if stage === 'review'}
	<div class="flex flex-col gap-2">
		<div class="flex items-center gap-2 text-sm font-semibold text-slate-800">
			<Eye size={16} /> Review
		</div>
		<p class="text-xs text-slate-500">
			Post-processing review — walk-throughs of the delivered outputs, QA notes, sign-off.
			Stub for now.
		</p>
	</div>
{/if}
