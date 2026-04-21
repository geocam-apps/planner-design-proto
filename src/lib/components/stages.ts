import {
	Map,
	ChartLine,
	Camera,
	Eye,
	RadioTower,
	CloudUpload,
	Cog,
	Download,
	type Icon
} from '@lucide/svelte';
import type { CaptureStageKey, CollectionStageKey, StageStatus } from '$lib/types';

export const COLLECTION_ICONS: Record<CollectionStageKey, typeof Icon> = {
	plan: Map,
	analysis: ChartLine,
	capture: Camera,
	review: Eye
};

export const CAPTURE_ICONS: Record<CaptureStageKey, typeof Icon> = {
	metadata: RadioTower,
	upload: CloudUpload,
	processing: Cog,
	view: Download
};

export function statusClasses(status: StageStatus, emphasised: boolean): string {
	if (status === 'green') {
		return emphasised
			? 'bg-emerald-500 text-white ring-emerald-500/20'
			: 'bg-emerald-50 text-emerald-600 ring-emerald-500/20';
	}
	if (status === 'orange') {
		return emphasised
			? 'bg-amber-500 text-white ring-amber-500/20'
			: 'bg-amber-50 text-amber-600 ring-amber-500/20';
	}
	if (status === 'red') {
		return emphasised
			? 'bg-rose-500 text-white ring-rose-500/20'
			: 'bg-rose-50 text-rose-600 ring-rose-500/20';
	}
	// dark = not reached
	return emphasised
		? 'bg-slate-700 text-slate-200 ring-slate-500/10'
		: 'bg-slate-100 text-slate-400 ring-slate-300/10';
}

export function dotColor(status: StageStatus): string {
	if (status === 'green') return 'bg-emerald-500';
	if (status === 'orange') return 'bg-amber-500';
	if (status === 'red') return 'bg-rose-500';
	return 'bg-slate-300';
}
