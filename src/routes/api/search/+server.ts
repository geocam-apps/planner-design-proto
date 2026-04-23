import { json, error } from '@sveltejs/kit';
import { query } from '$lib/server/db';
import { projectScope, requireUser } from '$lib/server/scope';
import type { RequestHandler } from './$types';

// Global search — one query that returns project slugs (plus per-project match
// counts) for any project the user can see that has at least one matching
// project / collection / capture field. The client uses this to narrow its
// project list; each surviving project's per-project search endpoint then
// fills in the highlight detail.
//
// Heavier than the name-only filter. Capped at 100 projects.

const MAX_PROJECTS = 100;

type Row = {
	slug: string;
	name: string | null;
	project_match: boolean;
	collection_matches: string;
	capture_matches: string;
};

export const GET: RequestHandler = async ({ url, locals }) => {
	const user = requireUser(locals);
	const q = (url.searchParams.get('q') ?? '').trim();
	if (q.length < 2) {
		return json({ query: q, matches: [] as unknown[] });
	}

	const scope = projectScope(user, 'p.id', 'p.client_id', 2);
	if (scope.empty) return json({ query: q, matches: [] });

	const pattern = `%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;

	try {
		const res = await query<Row>(
			`SELECT p.slug,
			        p.name,
			        (p.name ILIKE $1 OR p.reference ILIKE $1
			         OR p.description ILIKE $1 OR p.abbreviation ILIKE $1) AS project_match,
			        (SELECT count(*) FROM cell_maps cm
			           WHERE cm.project_id = p.id
			             AND cm.kind = 'collection'
			             AND cm.deleted_at IS NULL
			             AND (cm.name ILIKE $1 OR cm.description ILIKE $1))::text AS collection_matches,
			        (SELECT count(*) FROM captures cap
			           WHERE cap.project_id = p.id
			             AND cap.deleted_at IS NULL
			             AND (cap.name ILIKE $1 OR cap.reference ILIKE $1
			                  OR cap.address ILIKE $1 OR cap.segment_names ILIKE $1
			                  OR cap.country ILIKE $1))::text AS capture_matches
			   FROM projects p
			  WHERE ${scope.sql}
			    AND (
			      p.name ILIKE $1 OR p.reference ILIKE $1
			      OR p.description ILIKE $1 OR p.abbreviation ILIKE $1
			      OR EXISTS (SELECT 1 FROM cell_maps cm
			                   WHERE cm.project_id = p.id
			                     AND cm.kind = 'collection'
			                     AND cm.deleted_at IS NULL
			                     AND (cm.name ILIKE $1 OR cm.description ILIKE $1))
			      OR EXISTS (SELECT 1 FROM captures cap
			                   WHERE cap.project_id = p.id
			                     AND cap.deleted_at IS NULL
			                     AND (cap.name ILIKE $1 OR cap.reference ILIKE $1
			                          OR cap.address ILIKE $1 OR cap.segment_names ILIKE $1
			                          OR cap.country ILIKE $1))
			    )
			  ORDER BY p.updated_at DESC
			  LIMIT ${MAX_PROJECTS}`,
			[pattern, ...scope.params]
		);

		const matches = res.rows.map((r) => ({
			slug: r.slug,
			name: r.name,
			projectMatch: r.project_match,
			collectionMatchCount: Number(r.collection_matches),
			captureMatchCount: Number(r.capture_matches)
		}));

		return json({ query: q, matches, truncated: matches.length >= MAX_PROJECTS });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		throw error(500, `Search failed: ${message}`);
	}
};
