import crypto from 'node:crypto';
import { env } from '$env/dynamic/private';

export type SessionUser = {
	userId: number;
	userSlug: string;
	email: string;
	username: string | null;
	superuser: boolean;
	clientIds: number[];
	projectIds: number[];
	issuedAt: number;
	expiresAt: number;
};

export const COOKIE_NAME = 'gc_session';
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
	const s = env.SESSION_SECRET;
	if (!s || s.length < 16) {
		throw new Error(
			'SESSION_SECRET is missing or too short in .env.local. Generate one with: openssl rand -base64 32'
		);
	}
	return s;
}

function b64url(input: Buffer | string): string {
	return Buffer.from(input as never).toString('base64url');
}

function sign(payload: string, secret: string): string {
	return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function timingSafeEqStr(a: string, b: string): boolean {
	const aa = Buffer.from(a);
	const bb = Buffer.from(b);
	if (aa.length !== bb.length) return false;
	return crypto.timingSafeEqual(aa, bb);
}

export function encodeSession(
	user: Omit<SessionUser, 'issuedAt' | 'expiresAt'>,
	ttlMs = DEFAULT_TTL_MS
): { value: string; expires: Date } {
	const now = Date.now();
	const full: SessionUser = {
		...user,
		issuedAt: now,
		expiresAt: now + ttlMs
	};
	const payload = b64url(JSON.stringify(full));
	const sig = sign(payload, getSecret());
	return { value: `${payload}.${sig}`, expires: new Date(full.expiresAt) };
}

export function decodeSession(raw: string | undefined): SessionUser | null {
	if (!raw) return null;
	const dot = raw.lastIndexOf('.');
	if (dot < 0) return null;
	const payload = raw.slice(0, dot);
	const sig = raw.slice(dot + 1);
	const expected = sign(payload, getSecret());
	if (!timingSafeEqStr(sig, expected)) return null;
	try {
		const json = Buffer.from(payload, 'base64url').toString('utf8');
		const parsed = JSON.parse(json) as SessionUser;
		if (parsed.expiresAt <= Date.now()) return null;
		return parsed;
	} catch {
		return null;
	}
}
