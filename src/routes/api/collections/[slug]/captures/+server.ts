import { json, error } from '@sveltejs/kit';
import { query } from '$lib/server/db';
import {
	computeCaptureStages,
	currentCaptureStage,
	type CaptureStageInputs
} from '$lib/server/stage-status';
import type { CaptureSummary } from '$lib/types';
import type { RequestHandler } from './$types';

type Row = {
	id: string;
	name: string | null;
	reference: string | null;
	project_id: string;
	cell_map_id: string | null;
	captured_at: Date | null;
	uploaded_at: Date | null;
	shot_load_started_at: Date | null;
	shot_load_completed_at: Date | null;
	sqlite_shot_count: number | null;
	missing_image_file_count: number;
	output_count: string;
};

export const GET: RequestHandler = async ({ params }) => {
	const collectionSlug = params.slug;
	if (!collectionSlug) throw error(400, 'missing collection slug');

	try {
		const result = await query<Row>(
			`SELECT cap.id::text,
			        cap.name,
			        cap.reference,
			        cap.project_id::text,
			        cl.cell_map_id::text AS cell_map_id,
			        cap.captured_at,
			        cap.uploaded_at,
			        cap.shot_load_started_at,
			        cap.shot_load_completed_at,
			        cap.sqlite_shot_count,
			        cap.missing_image_file_count,
			        (SELECT count(*) FROM outputs o
			           WHERE o.cell_id = cap.collection_cell_id)::text AS output_count
			   FROM captures cap
			   JOIN cells cl ON cl.id = cap.collection_cell_id
			   JOIN cell_maps cm ON cm.id = cl.cell_map_id
			  WHERE cm.slug = $1
			    AND cm.kind = 'collection'
			    AND cm.deleted_at IS NULL
			    AND cap.deleted_at IS NULL
			  ORDER BY COALESCE(cap.captured_at, cap.created_at) DESC`,
			[collectionSlug]
		);

		const captures: CaptureSummary[] = result.rows.map((r) => {
			const inputs: CaptureStageInputs = {
				uploadedAt: r.uploaded_at,
				shotLoadStartedAt: r.shot_load_started_at,
				shotLoadCompletedAt: r.shot_load_completed_at,
				missingImageFileCount: r.missing_image_file_count,
				outputCount: Number(r.output_count),
				capturedAt: r.captured_at
			};
			const stages = computeCaptureStages(inputs);
			return {
				id: r.id,
				name: r.name,
				reference: r.reference,
				projectId: r.project_id,
				collectionId: r.cell_map_id,
				capturedAt: r.captured_at?.toISOString() ?? null,
				uploadedAt: r.uploaded_at?.toISOString() ?? null,
				shotLoadCompletedAt: r.shot_load_completed_at?.toISOString() ?? null,
				shotLoadStartedAt: r.shot_load_started_at?.toISOString() ?? null,
				sqliteShotCount: r.sqlite_shot_count,
				missingImageFileCount: r.missing_image_file_count,
				stages,
				currentStage: currentCaptureStage(stages)
			};
		});

		return json({ captures });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		throw error(500, `Database query failed: ${message}`);
	}
};
