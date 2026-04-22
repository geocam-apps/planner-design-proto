import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

const PUBLIC_PATHS = ['/login', '/drawing'];

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const onPublic = PUBLIC_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(p + '/'));

	if (!locals.user && !onPublic) {
		throw redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	}

	if (locals.user && url.pathname === '/login') {
		throw redirect(303, '/');
	}

	return {
		user: locals.user
			? {
					email: locals.user.email,
					username: locals.user.username,
					superuser: locals.user.superuser
				}
			: null
	};
};
