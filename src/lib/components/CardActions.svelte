<script lang="ts">
	import { Star, Eye, EyeOff } from '@lucide/svelte';
	import {
		isHidden,
		isStarred,
		toggleHidden,
		toggleStarred,
		type EntityType
	} from '$lib/stores/preferences.svelte';

	let {
		type,
		id,
		size = 'md'
	}: {
		type: EntityType;
		id: string;
		size?: 'sm' | 'md';
	} = $props();

	const starred = $derived(isStarred(type, id));
	const hidden = $derived(isHidden(type, id));

	const iconSize = $derived(size === 'sm' ? 13 : 15);
	const btnSize = $derived(size === 'sm' ? 'size-6' : 'size-7');

	function starClick(e: MouseEvent) {
		e.stopPropagation();
		toggleStarred(type, id);
	}

	function hideClick(e: MouseEvent) {
		e.stopPropagation();
		toggleHidden(type, id);
	}
</script>

<div class="flex items-center gap-0.5" role="group" aria-label="Item actions">
	<button
		type="button"
		onclick={starClick}
		aria-pressed={starred}
		aria-label={starred ? 'Unstar' : 'Star'}
		title={starred ? 'Unstar — remove from the top' : 'Star — pin to the top'}
		class="flex {btnSize} items-center justify-center rounded-md transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none {starred
			? 'text-amber-500'
			: 'text-slate-300 hover:text-slate-500'}"
	>
		<Star size={iconSize} fill={starred ? 'currentColor' : 'none'} strokeWidth={2} />
	</button>
	<button
		type="button"
		onclick={hideClick}
		aria-pressed={hidden}
		aria-label={hidden ? 'Unhide' : 'Hide'}
		title={hidden ? 'Unhide — return to the list' : 'Hide — remove from the list'}
		class="flex {btnSize} items-center justify-center rounded-md transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none {hidden
			? 'text-slate-600'
			: 'text-slate-300 hover:text-slate-500'}"
	>
		{#if hidden}
			<EyeOff size={iconSize} strokeWidth={2} />
		{:else}
			<Eye size={iconSize} strokeWidth={2} />
		{/if}
	</button>
</div>
