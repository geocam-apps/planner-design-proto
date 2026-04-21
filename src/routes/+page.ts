import type { PageLoad } from './$types';
import type { ProjectSummary } from '$lib/types';

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/projects');
	if (!res.ok) {
		throw new Error(`Failed to load projects (${res.status})`);
	}
	const data = (await res.json()) as { projects: ProjectSummary[] };
	return { projects: data.projects };
};
