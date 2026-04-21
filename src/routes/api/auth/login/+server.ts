import { json, error } from '@sveltejs/kit';
import { COOKIE_NAME, encodeSession } from '$lib/server/session';
import { railsLogin } from '$lib/server/rails';
import { snapshotRolesForSlug } from '$lib/server/user-roles';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	let body: { email?: string; password?: string };
	try {
		body = (await request.json()) as { email?: string; password?: string };
	} catch {
		throw error(400, 'Expected JSON body');
	}
	const email = (body.email ?? '').trim();
	const password = body.password ?? '';
	if (!email || !password) {
		throw error(400, 'Email and password required');
	}

	const rails = await railsLogin(email, password);
	if (!rails.ok) {
		return json({ error: rails.error }, { status: rails.status });
	}

	const snapshot = await snapshotRolesForSlug(rails.user.id);
	if (!snapshot) {
		// Rails authenticated them but we can't find them in the DB. Shouldn't
		// happen unless schemas have drifted — fail loudly rather than open.
		throw error(500, 'Authenticated user not found in database');
	}

	const session = encodeSession(snapshot);

	cookies.set(COOKIE_NAME, session.value, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		expires: session.expires
	});

	return json({
		user: {
			email: snapshot.email,
			username: snapshot.username,
			superuser: snapshot.superuser,
			visibleProjectCount: snapshot.projectIds.length,
			visibleClientCount: snapshot.clientIds.length
		}
	});
};
