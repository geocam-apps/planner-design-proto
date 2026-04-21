<script lang="ts" generics="K extends string">
	import type { StageStatus } from '$lib/types';
	import { statusClasses } from './stages';
	import type { Icon } from '@lucide/svelte';

	let {
		stages,
		icons,
		labels,
		active = $bindable(),
		order,
		highlighted
	}: {
		stages: Record<K, StageStatus>;
		icons: Record<K, typeof Icon>;
		labels: Record<K, string>;
		active: K;
		order: readonly K[];
		highlighted?: Set<K>;
	} = $props();
</script>

<div class="flex items-center gap-1 rounded-xl bg-slate-100/80 p-1" role="tablist">
	{#each order as key, i (key)}
		{@const IconComp = icons[key]}
		{@const status = stages[key]}
		{@const isActive = active === key}
		{@const hit = highlighted?.has(key) ?? false}
		<button
			type="button"
			role="tab"
			aria-selected={isActive}
			onclick={() => (active = key)}
			class="group relative flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none {isActive
				? 'bg-white text-slate-900 shadow-sm'
				: 'text-slate-500 hover:bg-white/60 hover:text-slate-700'} {hit
				? 'outline outline-2 outline-yellow-400 outline-offset-0'
				: ''}"
		>
			<span
				class="flex size-6 items-center justify-center rounded-md ring-1 {statusClasses(
					status,
					isActive
				)}"
			>
				<IconComp size={14} strokeWidth={2.25} />
			</span>
			<span class="truncate">{labels[key]}</span>
			{#if i < order.length - 1}
				<span
					class="pointer-events-none absolute top-1/2 -right-0.5 h-px w-1 -translate-y-1/2 bg-slate-200"
				></span>
			{/if}
		</button>
	{/each}
</div>
