<script lang="ts">
	import Toolbar from '$lib/components/Toolbar.svelte';
	import DrawingCanvas from '$lib/components/DrawingCanvas.svelte';

	let mode = $state<'draw' | 'edit'>('draw');
	let smoothing = $state(2.5);
	let strokeWidth = $state(4);
	let color = $state('#0f172a');
	let clearSignal = $state(0);

	function handleClear() {
		clearSignal++;
	}
</script>

<main class="relative h-screen w-screen overflow-hidden">
	<DrawingCanvas {mode} {smoothing} {strokeWidth} {color} {clearSignal} />
	<Toolbar bind:mode bind:smoothing bind:strokeWidth bind:color onClear={handleClear} />

	<div
		class="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/80 px-3 py-1 text-xs text-slate-500 shadow-sm backdrop-blur"
	>
		{#if mode === 'draw'}
			Draw with your pointer. Release to smooth into an editable curve.
		{:else}
			Click a stroke to select, then drag its points or handles.
		{/if}
	</div>
</main>
