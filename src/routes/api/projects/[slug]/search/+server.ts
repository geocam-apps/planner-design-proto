import { json, error } from '@sveltejs/kit';
import { query } from '$lib/server/db';
import { projectScope, requireUser } from '$lib/server/scope';
import type { RequestHandler } from './$types';

const PROJECT_FIELDS = ['name', 'reference', 'description', 'abbreviation'] as const;
const COLLECTION_FIELDS = ['name', 'description'] as const;
const CAPTURE_FIELDS = ['name', 'reference', 'address', 'segment_names', 'country'] as const;

type ProjectField = (typeof PROJECT_FIELDS)[number];
type CollectionField = (typeof COLLECTION_FIELDS)[number];
type CaptureField = (typeof CAPTURE_FIELDS)[number];

type ProjectMatch = {
	id: string;
	fields: ProjectField[];
};
type CollectionMatch = {
	id: string;
	fields: CollectionField[];
};
type CaptureMatch = {
	id: string;
	collectionId: string;
	fields: CaptureField[];
};

export const GET: RequestHandler = async ({ params, url, locals }) => {
	const user = requireUser(locals);
	const projectSlug = params.slug;
	const q = (url.searchParams.get('q') ?? '').trim();
	if (!projectSlug) throw error(400, 'missing project slug');

	if (q.length < 2) {
		return json({
			query: q,
			projects: [] as ProjectMatch[],
			collections: [] as CollectionMatch[],
			captures: [] as CaptureMatch[]
		});
	}

	const scope = projectScope(user, 'p.id', 'p.client_id', 3);
	if (scope.empty) {
		return json({ query: q, projects: [], collections: [], captures: [] });
	}

	const pattern = `%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
	const scopedParams = [projectSlug, pattern, ...scope.params];

	try {
		const projResult = await query<Record<ProjectField, string | null> & { id: string }>(
			`SELECT p.id::text, p.name, p.reference, p.description, p.abbreviation
			   FROM projects p
			  WHERE p.slug = $1
			    AND (p.name ILIKE $2 OR p.reference ILIKE $2
			         OR p.description ILIKE $2 OR p.abbreviation ILIKE $2)
			    AND ${scope.sql}`,
			scopedParams
		);

		const collResult = await query<
			Record<CollectionField, string | null> & { id: string }
		>(
			`SELECT cm.id::text, cm.name, cm.description
			   FROM cell_maps cm
			   JOIN projects p ON p.id = cm.project_id
			  WHERE p.slug = $1
			    AND cm.kind = 'collection'
			    AND cm.deleted_at IS NULL
			    AND (cm.name ILIKE $2 OR cm.description ILIKE $2)
			    AND ${scope.sql}`,
			scopedParams
		);

		const capResult = await query<
			Record<CaptureField, string | null> & { id: string; collection_id: string }
		>(
			`SELECT cap.id::text,
			        cl.cell_map_id::text AS collection_id,
			        cap.name,
			        cap.reference,
			        cap.address,
			        cap.segment_names,
			        cap.country
			   FROM captures cap
			   JOIN cells cl ON cl.id = cap.collection_cell_id
			   JOIN cell_maps cm ON cm.id = cl.cell_map_id
			   JOIN projects p ON p.id = cm.project_id
			  WHERE p.slug = $1
			    AND cm.kind = 'collection'
			    AND cm.deleted_at IS NULL
			    AND cap.deleted_at IS NULL
			    AND (cap.name ILIKE $2 OR cap.reference ILIKE $2
			         OR cap.address ILIKE $2 OR cap.segment_names ILIKE $2
			         OR cap.country ILIKE $2)
			    AND ${scope.sql}`,
			scopedParams
		);

		const needle = q.toLowerCase();
		const matchesInFields = <F extends string>(
			row: Record<string, string | null>,
			fields: readonly F[]
		): F[] => fields.filter((f) => (row[f] ?? '').toLowerCase().includes(needle));

		const projects: ProjectMatch[] = projResult.rows.map((r) => ({
			id: r.id,
			fields: matchesInFields(r, PROJECT_FIELDS)
		}));
		const collections: CollectionMatch[] = collResult.rows.map((r) => ({
			id: r.id,
			fields: matchesInFields(r, COLLECTION_FIELDS)
		}));
		const captures: CaptureMatch[] = capResult.rows.map((r) => ({
			id: r.id,
			collectionId: r.collection_id,
			fields: matchesInFields(r, CAPTURE_FIELDS)
		}));

		return json({ query: q, projects, collections, captures });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		throw error(500, `Search failed: ${message}`);
	}
};
