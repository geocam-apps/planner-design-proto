import type { CaptureStageKey } from '$lib/types';

export type ProjectField = 'name' | 'reference' | 'description' | 'abbreviation';
export type CollectionField = 'name' | 'description';
export type CaptureField = 'name' | 'reference' | 'address' | 'segment_names' | 'country';

export type ProjectMatch = { id: string; fields: ProjectField[] };
export type CollectionMatch = { id: string; fields: CollectionField[] };
export type CaptureMatch = {
	id: string;
	collectionId: string;
	fields: CaptureField[];
};

export type SearchPayload = {
	query: string;
	projects: ProjectMatch[];
	collections: CollectionMatch[];
	captures: CaptureMatch[];
};

const CAPTURE_FIELD_TO_STAGE: Record<CaptureField, CaptureStageKey> = {
	name: 'metadata',
	reference: 'metadata',
	address: 'metadata',
	segment_names: 'metadata',
	country: 'metadata'
};

export function captureFieldToStage(field: CaptureField): CaptureStageKey {
	return CAPTURE_FIELD_TO_STAGE[field];
}

export function captureMatchedStages(fields: Iterable<CaptureField>): Set<CaptureStageKey> {
	const out = new Set<CaptureStageKey>();
	for (const f of fields) out.add(captureFieldToStage(f));
	return out;
}
