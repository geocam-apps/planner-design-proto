import { env } from '$env/dynamic/private';

export type RailsLoginResult =
	| {
			ok: true;
			token: string;
			user: {
				id: string; // this is the friendly_id slug
				email: string;
				username: string | null;
			};
	  }
	| { ok: false; status: number; error: string };

export async function railsLogin(email: string, password: string): Promise<RailsLoginResult> {
	const base = env.RAILS_API_URL;
	if (!base) {
		return { ok: false, status: 500, error: 'RAILS_API_URL is not configured' };
	}
	const url = base.replace(/\/$/, '') + '/api/v1/sessions';
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', accept: 'application/json' },
		body: JSON.stringify({ email, password })
	}).catch((e) => {
		throw new Error(`Rails unreachable at ${url}: ${e instanceof Error ? e.message : e}`);
	});

	if (res.status === 401) {
		return { ok: false, status: 401, error: 'Invalid email or password' };
	}
	if (!res.ok) {
		return { ok: false, status: res.status, error: `Rails returned ${res.status}` };
	}
	const data = (await res.json()) as {
		token: string | number;
		data: {
			user: { id: string; email: string; username: string | null };
		};
	};
	return {
		ok: true,
		token: String(data.token),
		user: data.data.user
	};
}
