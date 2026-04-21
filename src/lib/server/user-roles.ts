import { query } from './db';

export type RoleSnapshot = {
	userId: number;
	userSlug: string;
	email: string;
	username: string | null;
	superuser: boolean;
	clientIds: number[];
	projectIds: number[];
};

// Given a user's slug (returned from Rails), look up their internal id and
// roles. Returns null if the user row cannot be found.
export async function snapshotRolesForSlug(slug: string): Promise<RoleSnapshot | null> {
	const userRes = await query<{
		id: string;
		slug: string;
		email: string;
		username: string | null;
	}>(
		`SELECT id::text, slug, email, username
		   FROM users
		  WHERE slug = $1
		  LIMIT 1`,
		[slug]
	);
	if (userRes.rows.length === 0) return null;
	const u = userRes.rows[0];
	const userId = Number(u.id);

	const rolesRes = await query<{
		role: string;
		accessable_type: string | null;
		accessable_id: string | null;
	}>(
		`SELECT role::text, accessable_type, accessable_id::text
		   FROM roles
		  WHERE user_id = $1`,
		[userId]
	);

	let superuser = false;
	const clientIds = new Set<number>();
	const projectIds = new Set<number>();

	for (const r of rolesRes.rows) {
		if (r.role === 'super') {
			superuser = true;
			continue;
		}
		if (!r.accessable_type || !r.accessable_id) continue;
		if (r.accessable_type === 'Client') clientIds.add(Number(r.accessable_id));
		else if (r.accessable_type === 'Project') projectIds.add(Number(r.accessable_id));
	}

	return {
		userId,
		userSlug: u.slug,
		email: u.email,
		username: u.username,
		superuser,
		clientIds: [...clientIds],
		projectIds: [...projectIds]
	};
}
