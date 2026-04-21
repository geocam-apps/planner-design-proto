import type { Handle } from '@sveltejs/kit';
import { COOKIE_NAME, decodeSession } from '$lib/server/session';

export const handle: Handle = async ({ event, resolve }) => {
	const raw = event.cookies.get(COOKIE_NAME);
	event.locals.user = decodeSession(raw);
	return resolve(event);
};
