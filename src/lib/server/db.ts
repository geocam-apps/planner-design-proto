import pg from 'pg';
import { env } from '$env/dynamic/private';

let poolInstance: pg.Pool | null = null;

export function pool(): pg.Pool {
	if (!poolInstance) {
		const connectionString = env.DATABASE_URL;
		if (!connectionString) {
			throw new Error(
				'DATABASE_URL is not set. Add it to .env.local (see the planner_proto credentials).'
			);
		}
		poolInstance = new pg.Pool({
			connectionString,
			max: 5,
			idleTimeoutMillis: 30_000
		});
	}
	return poolInstance;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
	text: string,
	params?: unknown[]
): Promise<pg.QueryResult<T>> {
	return pool().query<T>(text, params as never);
}
