<script lang="ts">
	import ProjectCard from '$lib/components/ProjectCard.svelte';
	import ShowHiddenToggle from '$lib/components/ShowHiddenToggle.svelte';
	import { arrange } from '$lib/stores/preferences.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { LogOut, ShieldCheck, Search, X } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let filter = $state('');

	const arrangedProjects = $derived(arrange(data.projects, 'project'));
	const filteredProjects = $derived.by(() => {
		const q = filter.trim().toLowerCase();
		if (!q) return arrangedProjects;
		return arrangedProjects.filter((p) =>
			(p.name ?? '').toLowerCase().includes(q)
		);
	});
	const hiddenByFilter = $derived(arrangedProjects.length - filteredProjects.length);

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

	{#if data.projects.length > 0}
		<div class="relative">
			<Search
				size={14}
				class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
			/>
			<input
				type="search"
				bind:value={filter}
				placeholder="Filter projects by name…"
				aria-label="Filter projects by name"
				class="w-full rounded-xl border border-slate-200 bg-white py-2 pr-9 pl-9 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
			/>
			{#if filter}
				<button
					type="button"
					onclick={() => (filter = '')}
					aria-label="Clear filter"
					class="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
				>
					<X size={13} />
				</button>
			{/if}
		</div>
	{/if}

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
	{:else if filteredProjects.length === 0}
		<p class="rounded-xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
			No project name matches "{filter}".
		</p>
	{:else}
		<div class="flex flex-col gap-3">
			{#each filteredProjects as project (project.id)}
				<ProjectCard {project} />
			{/each}
		</div>
		{#if hiddenByFilter > 0}
			<p class="text-center text-xs text-slate-400">
				{hiddenByFilter} {hiddenByFilter === 1 ? 'project' : 'projects'} hidden by filter
			</p>
		{/if}
	{/if}
</main>
