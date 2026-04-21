<script lang="ts">
	import type { CaptureStageKey, CaptureSummary } from '$lib/types';
	import { RadioTower, CloudUpload, Cog, Download } from 'lucide-svelte';

	let {
		stage,
		capture
	}: {
		stage: CaptureStageKey;
		capture: CaptureSummary;
	} = $props();

	function fmt(iso: string | null): string {
		return iso ? new Date(iso).toLocaleString() : '—';
	}
</script>

{#if stage === 'metadata'}
	<div class="flex flex-col gap-2 text-xs">
		<div class="flex items-center gap-2 text-sm font-semibold text-slate-800">
			<RadioTower size={14} /> Capture metadata
		</div>
		<dl class="grid grid-cols-[minmax(0,120px)_1fr] gap-x-4 gap-y-1 text-slate-600">
			<dt class="text-slate-400">Reference</dt>
			<dd class="truncate font-mono">{capture.reference ?? '—'}</dd>
			<dt class="text-slate-400">Captured at</dt>
			<dd>{fmt(capture.capturedAt)}</dd>
			<dt class="text-slate-400">Shot count</dt>
			<dd>{capture.sqliteShotCount ?? '—'}</dd>
		</dl>
	</div>
{:else if stage === 'upload'}
	<div class="flex flex-col gap-2 text-xs">
		<div class="flex items-center gap-2 text-sm font-semibold text-slate-800">
			<CloudUpload size={14} /> Upload
		</div>
		<dl class="grid grid-cols-[minmax(0,120px)_1fr] gap-x-4 gap-y-1 text-slate-600">
			<dt class="text-slate-400">Uploaded at</dt>
			<dd>{fmt(capture.uploadedAt)}</dd>
			<dt class="text-slate-400">Missing files</dt>
			<dd>{capture.missingImageFileCount}</dd>
		</dl>
	</div>
{:else if stage === 'processing'}
	<div class="flex flex-col gap-2 text-xs">
		<div class="flex items-center gap-2 text-sm font-semibold text-slate-800">
			<Cog size={14} /> Processing
		</div>
		<dl class="grid grid-cols-[minmax(0,120px)_1fr] gap-x-4 gap-y-1 text-slate-600">
			<dt class="text-slate-400">Started</dt>
			<dd>{fmt(capture.shotLoadStartedAt)}</dd>
			<dt class="text-slate-400">Completed</dt>
			<dd>{fmt(capture.shotLoadCompletedAt)}</dd>
		</dl>
	</div>
{:else if stage === 'view'}
	<div class="flex flex-col gap-2 text-xs">
		<div class="flex items-center gap-2 text-sm font-semibold text-slate-800">
			<Download size={14} /> View / Download
		</div>
		<p class="text-slate-500">
			Processed outputs (3D tour, downloadable tiles) will be listed here once available.
		</p>
	</div>
{/if}
