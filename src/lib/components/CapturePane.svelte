<script lang="ts">
	import type { CaptureDetail, CaptureStageKey, CaptureSummary } from '$lib/types';
	import {
		RadioTower,
		CloudUpload,
		Cog,
		Download,
		LoaderCircle,
		TriangleAlert
	} from '@lucide/svelte';
	import Highlight from './Highlight.svelte';
	import type { CaptureField } from '$lib/search/types';

	let {
		stage,
		capture,
		query = '',
		matchedFields
	}: {
		stage: CaptureStageKey;
		capture: CaptureSummary;
		query?: string;
		matchedFields?: Set<CaptureField>;
	} = $props();

	function fmt(iso: string | null): string {
		return iso ? new Date(iso).toLocaleString() : '—';
	}

	const refQuery = $derived(matchedFields?.has('reference') ? query : '');
	const nameQuery = $derived(matchedFields?.has('name') ? query : '');

	// --- Capture-stage detail: segments + metadata ---
	let detailState = $state<'idle' | 'loading' | 'loaded' | 'error'>('idle');
	let detailError = $state<string | null>(null);
	let detail = $state<CaptureDetail | null>(null);

	async function loadDetail() {
		if (detailState === 'loading' || detailState === 'loaded') return;
		detailState = 'loading';
		detailError = null;
		try {
			const res = await fetch(`/api/captures/${encodeURIComponent(capture.id)}/details`);
			if (!res.ok) throw new Error(`http ${res.status}`);
			detail = (await res.json()) as CaptureDetail;
			detailState = 'loaded';
		} catch (e) {
			detailError = e instanceof Error ? e.message : String(e);
			detailState = 'error';
		}
	}

	$effect(() => {
		if (stage === 'metadata') loadDetail();
	});

	function formatKey(k: string): string {
		return k
			.replace(/_/g, ' ')
			.replace(/\b\w/g, (c) => c.toUpperCase())
			.replace(/\bNtrip\b/i, 'NTRIP')
			.replace(/\bGnss\b/i, 'GNSS')
			.replace(/\bHdr\b/i, 'HDR')
			.replace(/\bFps\b/i, 'FPS');
	}

	function formatValue(v: unknown): string {
		if (v == null) return '—';
		if (typeof v === 'string') return v;
		if (typeof v === 'number' || typeof v === 'boolean') return String(v);
		return JSON.stringify(v);
	}

	function segmentKindBadge(kind: string): string {
		// Group the 12 segment_type values into colour families that hint at
		// what the segment is for, without promising a 1:1 mapping.
		if (kind.includes('trunk') || kind === 'driving') return 'bg-slate-100 text-slate-700';
		if (kind.includes('branch') || kind === 'link') return 'bg-sky-100 text-sky-700';
		if (kind === 'calibration' || kind === 'static_gnss')
			return 'bg-emerald-100 text-emerald-700';
		if (kind === 'scratch') return 'bg-amber-100 text-amber-700';
		return 'bg-slate-100 text-slate-600';
	}
</script>

{#if stage === 'metadata'}
	<div class="flex flex-col gap-4 text-xs">
		<div>
			<div class="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
				<RadioTower size={14} /> Segments
			</div>
			{#if detailState === 'loading'}
				<div class="flex items-center gap-2 py-1 text-slate-500">
					<LoaderCircle size={12} class="animate-spin" /> Loading…
				</div>
			{:else if detailState === 'error'}
				<div class="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-rose-700">
					<TriangleAlert size={12} /> {detailError}
				</div>
			{:else if detailState === 'loaded' && detail}
				{#if detail.segments.length === 0}
					<p class="text-slate-400">No segments recorded for this capture.</p>
				{:else}
					<div class="overflow-hidden rounded-lg border border-slate-200">
						<table class="w-full text-left">
							<thead class="bg-slate-50 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
								<tr>
									<th class="w-10 px-3 py-1.5">#</th>
									<th class="px-3 py-1.5">Name</th>
									<th class="px-3 py-1.5">Kind</th>
									<th class="w-20 px-3 py-1.5 text-right">Shots</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-100 bg-white">
								{#each detail.segments as seg (seg.id)}
									<tr class="hover:bg-slate-50">
										<td class="px-3 py-1.5 font-mono text-[11px] text-slate-500">
											{seg.number ?? '—'}
										</td>
										<td class="px-3 py-1.5 text-slate-700">{seg.name ?? '—'}</td>
										<td class="px-3 py-1.5">
											<span
												class="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium {segmentKindBadge(
													seg.kind
												)}"
											>
												{seg.kind}
											</span>
										</td>
										<td class="px-3 py-1.5 text-right font-mono tabular-nums text-slate-700">
											{seg.shotCount.toLocaleString()}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			{/if}
		</div>

		<div>
			<div class="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
				Capture metadata
			</div>
			<dl class="grid grid-cols-[minmax(0,160px)_1fr] gap-x-4 gap-y-1 text-slate-600">
				<dt class="text-slate-400">Reference</dt>
				<dd class="truncate font-mono">
					<Highlight text={capture.reference ?? '—'} query={refQuery} />
				</dd>
				{#if capture.name}
					<dt class="text-slate-400">Name</dt>
					<dd class="truncate"><Highlight text={capture.name} query={nameQuery} /></dd>
				{/if}
				{#if detailState === 'loaded' && detail}
					{#each Object.entries(detail.metadata).sort((a, b) => a[0].localeCompare(b[0])) as [k, v] (k)}
						<dt class="truncate text-slate-400" title={k}>{formatKey(k)}</dt>
						<dd
							class="break-all {typeof v === 'string' && v.includes('{')
								? 'font-mono text-[11px]'
								: ''}"
							title={formatValue(v)}
						>
							{formatValue(v)}
						</dd>
					{/each}
				{:else if detailState === 'loading'}
					<dt class="text-slate-400">…</dt>
					<dd class="text-slate-400">Loading metadata</dd>
				{/if}
			</dl>
		</div>
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
