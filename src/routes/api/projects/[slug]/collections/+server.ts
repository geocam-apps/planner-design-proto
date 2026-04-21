import { json, error } from '@sveltejs/kit';
import { query } from '$lib/server/db';
import {
	computeCollectionStages,
	currentCollectionStage,
	type CollectionCounts
} from '$lib/server/stage-status';
import type { CollectionSummary } from '$lib/types';
import type { RequestHandler } from './$types';

type Row = {
	id: string;
	slug: string;
	name: string | null;
	description: string | null;
	project_id: string;
	project_slug: string;
	created_at: Date;
	updated_at: Date;
	doc_count: string;
	capture_count: string;
	captures_processed: string;
	captures_with_issues: string;
};

export const GET: RequestHandler = async ({ params }) => {
	const projectSlug = params.slug;
	if (!projectSlug) throw error(400, 'missing project slug');

	try {
		const result = await query<Row>(
			`SELECT cm.id::text,
			        cm.slug,
			        cm.name,
			        cm.description,
			        cm.project_id::text AS project_id,
			        p.slug AS project_slug,
			        cm.created_at,
			        cm.updated_at,
			        (SELECT count(*) FROM documents d
			           WHERE d.documentable_type = 'CellMap'
			             AND d.documentable_id = cm.id)::text AS doc_count,
			        (SELECT count(*) FROM captures cap
			           JOIN cells cl ON cl.id = cap.collection_cell_id
			          WHERE cl.cell_map_id = cm.id
			            AND cap.deleted_at IS NULL)::text AS capture_count,
			        (SELECT count(*) FROM captures cap
			           JOIN cells cl ON cl.id = cap.collection_cell_id
			          WHERE cl.cell_map_id = cm.id
			            AND cap.deleted_at IS NULL
			            AND cap.shot_load_completed_at IS NOT NULL)::text AS captures_processed,
			        (SELECT count(*) FROM captures cap
			           JOIN cells cl ON cl.id = cap.collection_cell_id
			          WHERE cl.cell_map_id = cm.id
			            AND cap.deleted_at IS NULL
			            AND cap.missing_image_file_count > 0)::text AS captures_with_issues
			   FROM cell_maps cm
			   JOIN projects p ON p.id = cm.project_id
			  WHERE cm.kind = 'collection'
			    AND cm.deleted_at IS NULL
			    AND p.slug = $1
			  ORDER BY cm.created_at DESC`,
			[projectSlug]
		);

		const collections: CollectionSummary[] = result.rows.map((r) => {
			const counts: CollectionCounts = {
				docs: Number(r.doc_count),
				captures: Number(r.capture_count),
				capturesProcessed: Number(r.captures_processed),
				capturesWithIssues: Number(r.captures_with_issues),
				hasDescription: r.description !== null && r.description.trim().length > 0
			};
			const stages = computeCollectionStages(counts);
			return {
				id: r.id,
				slug: r.slug,
				name: r.name,
				description: r.description,
				projectId: r.project_id,
				projectSlug: r.project_slug,
				createdAt: r.created_at.toISOString(),
				updatedAt: r.updated_at.toISOString(),
				captureCount: counts.captures,
				stages,
				currentStage: currentCollectionStage(stages)
			};
		});

		return json({ collections });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		throw error(500, `Database query failed: ${message}`);
	}
};
