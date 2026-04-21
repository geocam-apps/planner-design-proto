<script lang="ts">
	import { Search, X, LoaderCircle } from '@lucide/svelte';
	import type { ProjectSearchApi } from '$lib/search/state.svelte';

	let { search }: { search: ProjectSearchApi } = $props();

	function onInput(e: Event) {
		const t = e.currentTarget as HTMLInputElement;
		search.setQuery(t.value);
	}

	function onClear() {
		search.clear();
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			search.clear();
			(e.currentTarget as HTMLInputElement).blur();
		}
		e.stopPropagation();
	}
</script>

<div class="relative flex w-full items-center">
	<Search
		size={14}
		class="pointer-events-none absolute left-3 text-slate-400"
	/>
	<input
		type="search"
		value={search.query}
		oninput={onInput}
		onkeydown={onKey}
		onclick={(e) => e.stopPropagation()}
		placeholder="Search collections, captures…"
		aria-label="Search in this project"
		class="w-full rounded-lg border border-slate-200 bg-white py-1.5 pr-9 pl-8 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
	/>
	<div class="absolute right-2 flex items-center gap-1">
		{#if search.loading}
			<LoaderCircle size={13} class="animate-spin text-slate-400" />
		{/if}
		{#if search.query}
			<button
				type="button"
				onclick={(e) => {
					e.stopPropagation();
					onClear();
				}}
				aria-label="Clear search"
				class="flex size-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
			>
				<X size={12} />
			</button>
		{/if}
	</div>
</div>

{#if search.error}
	<p class="mt-1 text-xs text-rose-600">Search failed: {search.error}</p>
{:else if search.active && !search.loading && !search.anyMatches}
	<p class="mt-1 text-xs text-slate-500">No matches for "{search.query}".</p>
{:else if search.active && search.anyMatches}
	<p class="mt-1 text-xs text-slate-500">
		{search.totalCount} {search.totalCount === 1 ? 'match' : 'matches'}
	</p>
{/if}
