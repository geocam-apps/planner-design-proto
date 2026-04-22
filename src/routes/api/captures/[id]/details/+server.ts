import { json, error } from '@sveltejs/kit';
import { query } from '$lib/server/db';
import { projectScope, requireUser } from '$lib/server/scope';
import type { CaptureDetail, SegmentSummary } from '$lib/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals);
	const idRaw = params.id;
	if (!idRaw || !/^\d+$/.test(idRaw)) throw error(400, 'invalid capture id');
	const id = Number(idRaw);

	const scope = projectScope(user, 'p.id', 'p.client_id', 2);
	if (scope.empty) throw error(404, 'not found');

	try {
		// Verify the capture exists and the user can see its project.
		const capRes = await query<{ id: string }>(
			`SELECT cap.id::text
			   FROM captures cap
			   JOIN projects p ON p.id = cap.project_id
			  WHERE cap.id = $1
			    AND cap.deleted_at IS NULL
			    AND ${scope.sql}
			  LIMIT 1`,
			[id, ...scope.params]
		);
		if (capRes.rows.length === 0) throw error(404, 'not found');

		type SegRow = {
			id: string;
			name: string | null;
			number: string | null;
			kind: string;
			shot_count: string;
		};
		const segRes = await query<SegRow>(
			`SELECT s.id::text,
			        s.name,
			        s.number::text,
			        s.kind::text AS kind,
			        (SELECT count(*) FROM shots sh WHERE sh.segment_id = s.id)::text AS shot_count
			   FROM segments s
			  WHERE s.capture_id = $1
			  ORDER BY s.number NULLS LAST, s.id`,
			[id]
		);

		const metaRes = await query<{ data: Record<string, unknown> | null }>(
			`SELECT data
			   FROM data
			  WHERE datable_type = 'Capture'
			    AND datable_id = $1
			    AND kind = 'metadata'
			  ORDER BY updated_at DESC
			  LIMIT 1`,
			[id]
		);

		const segments: SegmentSummary[] = segRes.rows.map((r) => ({
			id: r.id,
			name: r.name,
			number: r.number == null ? null : Number(r.number),
			kind: r.kind,
			shotCount: Number(r.shot_count)
		}));

		const metadata = metaRes.rows[0]?.data ?? {};

		const body: CaptureDetail = { segments, metadata };
		return json(body);
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		const message = e instanceof Error ? e.message : String(e);
		throw error(500, `Database query failed: ${message}`);
	}
};
