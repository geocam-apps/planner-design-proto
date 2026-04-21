<script lang="ts">
	import { slide } from 'svelte/transition';
	import { untrack } from 'svelte';
	import { ChevronRight, Image } from '@lucide/svelte';
	import type { CaptureStageKey, CaptureSummary } from '$lib/types';
	import { CAPTURE_STAGES } from '$lib/types';
	import StageStrip from './StageStrip.svelte';
	import StageStepper from './StageStepper.svelte';
	import { CAPTURE_ICONS } from './stages';
	import CapturePane from './CapturePane.svelte';
	import CardActions from './CardActions.svelte';
	import { isHidden } from '$lib/stores/preferences.svelte';

	let { capture }: { capture: CaptureSummary } = $props();

	let expanded = $state(false);
	let activeStage = $state<CaptureStageKey>(untrack(() => capture.currentStage));

	const labels = $derived(
		Object.fromEntries(CAPTURE_STAGES.map((s) => [s.key, s.label])) as Record<
			CaptureStageKey,
			string
		>
	);
	const order = CAPTURE_STAGES.map((s) => s.key);

	const displayName = $derived(capture.name ?? capture.reference ?? `#${capture.id}`);
	const hidden = $derived(isHidden('capture', capture.id));

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
	class="overflow-hidden rounded-lg border border-slate-200/70 bg-white transition-shadow {expanded
		? 'shadow-sm'
		: ''} {hidden ? 'opacity-60' : ''}"
>
	<div
		role="button"
		tabindex="0"
		aria-expanded={expanded}
		onclick={toggle}
		onkeydown={onKey}
		class="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset focus-visible:outline-none"
	>
		<ChevronRight
			size={14}
			class="shrink-0 text-slate-400 transition-transform {expanded ? 'rotate-90' : ''}"
		/>
		<div
			class="flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500"
		>
			<Image size={13} />
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<p class="truncate font-mono text-xs text-slate-700">{displayName}</p>
				{#if hidden}
					<span class="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-medium text-slate-600">
						hidden
					</span>
				{/if}
			</div>
			<p class="text-[11px] text-slate-400">
				{#if capture.capturedAt}
					{new Date(capture.capturedAt).toLocaleString()}
				{:else}
					—
				{/if}
				{#if capture.sqliteShotCount}
					· {capture.sqliteShotCount} shots
				{/if}
			</p>
		</div>
		<CardActions type="capture" id={capture.id} size="sm" />
		<StageStrip
			stages={capture.stages}
			icons={CAPTURE_ICONS}
			{labels}
			current={capture.currentStage}
			size="sm"
		/>
	</div>
	{#if expanded}
		<div
			transition:slide={{ duration: 180 }}
			class="border-t border-slate-100 bg-slate-50/70 p-3"
		>
			<StageStepper
				stages={capture.stages}
				icons={CAPTURE_ICONS}
				{labels}
				bind:active={activeStage}
				{order}
			/>
			<div class="mt-3 rounded-lg border border-slate-200/70 bg-white p-3">
				<CapturePane stage={activeStage} {capture} />
			</div>
		</div>
	{/if}
</div>
