<script lang="ts">
	import { Eye, EyeOff } from '@lucide/svelte';
	import { prefs, setShowHidden, hiddenCount } from '$lib/stores/preferences.svelte';

	const total = $derived(hiddenCount());
</script>

<button
	type="button"
	onclick={() => setShowHidden(!prefs.showHidden)}
	aria-pressed={prefs.showHidden}
	class="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none {prefs.showHidden
		? 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
		: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
	title={prefs.showHidden ? 'Hide items marked as hidden' : 'Show items marked as hidden'}
>
	{#if prefs.showHidden}
		<Eye size={14} />
	{:else}
		<EyeOff size={14} />
	{/if}
	<span>{prefs.showHidden ? 'Showing hidden' : 'Show hidden'}</span>
	{#if total > 0}
		<span
			class="rounded-full {prefs.showHidden
				? 'bg-sky-100 text-sky-700'
				: 'bg-slate-100 text-slate-500'} px-1.5 text-[10px] font-semibold tabular-nums"
		>
			{total}
		</span>
	{/if}
</button>
