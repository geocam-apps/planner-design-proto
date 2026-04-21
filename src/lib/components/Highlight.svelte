<script lang="ts">
	import { splitForHighlight } from '$lib/search/highlight';

	let {
		text,
		query
	}: {
		text: string | null | undefined;
		query: string;
	} = $props();

	const parts = $derived(splitForHighlight(text, query));
</script>

{#if parts.length === 0}
	{text}
{:else}
	{#each parts as part, i (i)}
		{#if part.match}<mark
				class="rounded-sm bg-yellow-200 px-0.5 text-slate-900"
			>{part.text}</mark>{:else}{part.text}{/if}
	{/each}
{/if}
