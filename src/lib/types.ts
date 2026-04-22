export type StageStatus = 'dark' | 'green' | 'orange' | 'red';

export type CollectionStageKey = 'plan' | 'analysis' | 'capture' | 'review';
export type CaptureStageKey = 'metadata' | 'upload' | 'processing' | 'view';

export type StageMap<K extends string> = Record<K, StageStatus>;

export interface ProjectSummary {
	id: string;
	slug: string;
	name: string | null;
	reference: string | null;
	description: string | null;
	status: string;
	priority: number | null;
	abbreviation: string | null;
	createdAt: string;
	updatedAt: string;
	collectionCount: number;
	captureCount: number;
}

export interface CollectionSummary {
	id: string;
	slug: string;
	name: string | null;
	description: string | null;
	projectId: string;
	projectSlug: string;
	createdAt: string;
	updatedAt: string;
	captureCount: number;
	stages: StageMap<CollectionStageKey>;
	currentStage: CollectionStageKey;
	// True when this is a virtual catch-all for captures that aren't linked to
	// any real collection (collection_cell_id IS NULL). Not a row in cell_maps.
	virtual?: boolean;
}

export interface CaptureSummary {
	id: string;
	name: string | null;
	reference: string | null;
	projectId: string;
	collectionId: string | null;
	capturedAt: string | null;
	uploadedAt: string | null;
	shotLoadCompletedAt: string | null;
	shotLoadStartedAt: string | null;
	sqliteShotCount: number | null;
	missingImageFileCount: number;
	stages: StageMap<CaptureStageKey>;
	currentStage: CaptureStageKey;
}

export interface CollectionStageDef {
	key: CollectionStageKey;
	label: string;
}

export interface CaptureStageDef {
	key: CaptureStageKey;
	label: string;
}

export const COLLECTION_STAGES: CollectionStageDef[] = [
	{ key: 'plan', label: 'Plan' },
	{ key: 'analysis', label: 'Analysis' },
	{ key: 'capture', label: 'Capture' },
	{ key: 'review', label: 'Review' }
];

export const CAPTURE_STAGES: CaptureStageDef[] = [
	{ key: 'metadata', label: 'Capture' },
	{ key: 'upload', label: 'Upload' },
	{ key: 'processing', label: 'Processing' },
	{ key: 'view', label: 'View / Download' }
];
