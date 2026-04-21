import type {
	CaptureStageKey,
	CollectionStageKey,
	StageMap,
	StageStatus
} from '$lib/types';
import { CAPTURE_STAGES, COLLECTION_STAGES } from '$lib/types';

export type CollectionCounts = {
	docs: number;
	captures: number;
	capturesProcessed: number;
	capturesWithIssues: number;
	hasDescription: boolean;
};

export function computeCollectionStages(counts: CollectionCounts): StageMap<CollectionStageKey> {
	const plan: StageStatus = counts.docs > 0 || counts.hasDescription ? 'green' : 'dark';
	// Analysis will have a dedicated artifact (complexity, GNSS base-station distance, …).
	// Until that exists, leave it dark so the UI doesn't lie.
	const analysis: StageStatus = 'dark';
	let capture: StageStatus = 'dark';
	if (counts.captures > 0) {
		capture = counts.capturesWithIssues > 0 ? 'orange' : 'green';
	}
	let review: StageStatus = 'dark';
	if (counts.captures > 0 && counts.capturesProcessed === counts.captures) {
		review = counts.capturesWithIssues > 0 ? 'orange' : 'green';
	} else if (counts.capturesProcessed > 0) {
		review = 'orange';
	}
	return { plan, analysis, capture, review };
}

export type CaptureStageInputs = {
	uploadedAt: Date | null;
	shotLoadStartedAt: Date | null;
	shotLoadCompletedAt: Date | null;
	missingImageFileCount: number;
	outputCount: number;
	capturedAt: Date | null;
};

export function computeCaptureStages(inputs: CaptureStageInputs): StageMap<CaptureStageKey> {
	const metadata: StageStatus = 'green';

	let upload: StageStatus = 'orange';
	if (inputs.uploadedAt) {
		upload = inputs.missingImageFileCount > 0 ? 'orange' : 'green';
	}

	let processing: StageStatus = 'dark';
	if (inputs.shotLoadCompletedAt) {
		processing = 'green';
	} else if (inputs.shotLoadStartedAt) {
		const startedMs = inputs.shotLoadStartedAt.getTime();
		const ageMinutes = (Date.now() - startedMs) / 60_000;
		processing = ageMinutes > 15 ? 'red' : 'orange';
	}

	const view: StageStatus = inputs.outputCount > 0 ? 'green' : 'dark';

	return { metadata, upload, processing, view };
}

export function currentCollectionStage(
	stages: StageMap<CollectionStageKey>
): CollectionStageKey {
	for (let i = COLLECTION_STAGES.length - 1; i >= 0; i--) {
		const key = COLLECTION_STAGES[i].key;
		if (stages[key] !== 'dark') return key;
	}
	return 'plan';
}

export function currentCaptureStage(stages: StageMap<CaptureStageKey>): CaptureStageKey {
	for (let i = CAPTURE_STAGES.length - 1; i >= 0; i--) {
		const key = CAPTURE_STAGES[i].key;
		if (stages[key] !== 'dark') return key;
	}
	return 'metadata';
}
