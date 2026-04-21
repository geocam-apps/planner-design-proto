<script lang="ts" generics="K extends string">
	import type { StageStatus } from '$lib/types';
	import { statusClasses } from './stages';
	import type { Icon } from 'lucide-svelte';

	let {
		stages,
		icons,
		labels,
		current,
		size = 'md'
	}: {
		stages: Record<K, StageStatus>;
		icons: Record<K, typeof Icon>;
		labels: Record<K, string>;
		current?: K;
		size?: 'sm' | 'md';
	} = $props();

	const keys = $derived(Object.keys(stages) as K[]);
	const dimensions = $derived(
		size === 'sm'
			? { pill: 'size-6', icon: 14 }
			: { pill: 'size-7', icon: 16 }
	);
</script>

<div class="flex items-center gap-1">
	{#each keys as key (key)}
		{@const IconComp = icons[key]}
		{@const status = stages[key]}
		{@const emphasised = key === current}
		<div
			class="flex {dimensions.pill} items-center justify-center rounded-md ring-1 {statusClasses(
				status,
				emphasised
			)}"
			title="{labels[key]} — {status === 'dark' ? 'not started' : status}"
		>
			<IconComp size={dimensions.icon} strokeWidth={2} />
		</div>
	{/each}
</div>
