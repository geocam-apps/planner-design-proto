<script lang="ts">
	import ProjectCard from '$lib/components/ProjectCard.svelte';
	import ShowHiddenToggle from '$lib/components/ShowHiddenToggle.svelte';
	import { arrange } from '$lib/stores/preferences.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const arrangedProjects = $derived(arrange(data.projects, 'project'));
</script>

<main class="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-10">
	<header class="flex items-end justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight text-slate-900">Projects</h1>
			<p class="mt-1 text-sm text-slate-500">
				Plan collections, run captures, review outputs.
			</p>
		</div>
		<div class="flex items-center gap-3">
			<ShowHiddenToggle />
			<a
				href="/drawing"
				class="text-xs font-medium text-slate-500 underline-offset-4 hover:text-slate-700 hover:underline"
			>
				Drawing prototype →
			</a>
		</div>
	</header>

	{#if data.projects.length === 0}
		<p class="rounded-xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
			No projects yet.
		</p>
	{:else if arrangedProjects.length === 0}
		<p class="rounded-xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
			All projects are hidden. Toggle "Show hidden" to see them.
		</p>
	{:else}
		<div class="flex flex-col gap-3">
			{#each arrangedProjects as project (project.id)}
				<ProjectCard {project} />
			{/each}
		</div>
	{/if}
</main>
