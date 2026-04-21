<script lang="ts">
	import ProjectCard from '$lib/components/ProjectCard.svelte';
	import ShowHiddenToggle from '$lib/components/ShowHiddenToggle.svelte';
	import { arrange } from '$lib/stores/preferences.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { LogOut, ShieldCheck } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const arrangedProjects = $derived(arrange(data.projects, 'project'));

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		await invalidateAll();
		await goto('/login');
	}
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
			{#if data.user}
				<div class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600">
					{#if data.user.superuser}
						<ShieldCheck size={12} class="text-emerald-500" />
					{/if}
					<span class="max-w-[160px] truncate" title={data.user.email}>{data.user.email}</span>
					<button
						type="button"
						onclick={logout}
						aria-label="Sign out"
						title="Sign out"
						class="-mr-1 flex size-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
					>
						<LogOut size={12} />
					</button>
				</div>
			{/if}
		</div>
	</header>

	{#if data.projects.length === 0}
		<p class="rounded-xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
			{#if data.user && !data.user.superuser}
				No projects in scope for your account.
			{:else}
				No projects yet.
			{/if}
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
