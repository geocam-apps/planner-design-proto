import { error } from '@sveltejs/kit';
import type { SessionUser } from './session';

export type ProjectScopeClause = {
	// A SQL WHERE fragment and the extra positional params it expects.
	// Use with the positional offset that lines up with existing params.
	sql: string;
	params: unknown[];
	// If `all` is true, no extra WHERE is needed — the user can see everything.
	all: boolean;
	// Empty visibility means no rows at all — caller can short-circuit.
	empty: boolean;
};

export function requireUser(locals: App.Locals): SessionUser {
	if (!locals.user) throw error(401, 'Not authenticated');
	return locals.user;
}

// Build a WHERE clause for "visible projects" using placeholders starting at
// $<startParam>. Returns the SQL fragment, the params to append, and
// shortcuts for the all-access and no-access cases.
export function projectScope(
	user: SessionUser,
	projectColumnExpr: string,
	clientColumnExpr: string,
	startParam: number
): ProjectScopeClause {
	if (user.superuser) {
		return { sql: 'TRUE', params: [], all: true, empty: false };
	}
	if (user.clientIds.length === 0 && user.projectIds.length === 0) {
		return { sql: 'FALSE', params: [], all: false, empty: true };
	}
	const params: unknown[] = [];
	const parts: string[] = [];
	let p = startParam;
	if (user.clientIds.length > 0) {
		parts.push(`${clientColumnExpr} = ANY($${p}::bigint[])`);
		params.push(user.clientIds);
		p++;
	}
	if (user.projectIds.length > 0) {
		parts.push(`${projectColumnExpr} = ANY($${p}::bigint[])`);
		params.push(user.projectIds);
		p++;
	}
	return {
		sql: '(' + parts.join(' OR ') + ')',
		params,
		all: false,
		empty: false
	};
}
