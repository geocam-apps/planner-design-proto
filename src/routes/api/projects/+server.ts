import { json, error } from '@sveltejs/kit';
import { query } from '$lib/server/db';
import type { RequestHandler } from './$types';

type ProjectRow = {
	id: string;
	slug: string | null;
	name: string | null;
	reference: string | null;
	description: string | null;
	status: string;
	priority: number | null;
	abbreviation: string | null;
	created_at: Date;
	updated_at: Date;
	collection_count: string;
	capture_count: string;
};

export const GET: RequestHandler = async () => {
	try {
		const result = await query<ProjectRow>(
			`SELECT p.id::text,
			        p.slug,
			        p.name,
			        p.reference,
			        p.description,
			        p.status::text AS status,
			        p.priority,
			        p.abbreviation,
			        p.created_at,
			        p.updated_at,
			        (SELECT count(*) FROM cell_maps cm
			           WHERE cm.project_id = p.id
			             AND cm.kind = 'collection'
			             AND cm.deleted_at IS NULL) AS collection_count,
			        (SELECT count(*) FROM captures c
			           WHERE c.project_id = p.id
			             AND c.deleted_at IS NULL) AS capture_count
			 FROM projects p
			 ORDER BY p.updated_at DESC`
		);

		const projects = result.rows.map((r) => ({
			id: r.id,
			slug: r.slug,
			name: r.name,
			reference: r.reference,
			description: r.description,
			status: r.status,
			priority: r.priority,
			abbreviation: r.abbreviation,
			createdAt: r.created_at,
			updatedAt: r.updated_at,
			collectionCount: Number(r.collection_count),
			captureCount: Number(r.capture_count)
		}));

		return json({ projects });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		throw error(500, `Database query failed: ${message}`);
	}
};
