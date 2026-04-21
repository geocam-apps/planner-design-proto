import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ user: null }, { status: 200 });
	}
	return json({
		user: {
			email: locals.user.email,
			username: locals.user.username,
			superuser: locals.user.superuser,
			visibleProjectCount: locals.user.projectIds.length,
			visibleClientCount: locals.user.clientIds.length,
			expiresAt: locals.user.expiresAt
		}
	});
};
