<script lang="ts">
	import Toolbar from '$lib/components/Toolbar.svelte';
	import DrawingCanvas from '$lib/components/DrawingCanvas.svelte';
	import { drawing, setMap } from '$lib/stores/drawing.svelte';

	let mode = $state<'draw' | 'edit'>('draw');
	let smoothing = $state(2.5);
	let strokeWidth = $state(4);
	let color = $state('#0f172a');
	let clearSignal = $state(0);
	let addImageSignal = $state<FileList | null>(null);

	// Two-way bindable: the canvas reads `drawing.map.enabled`, but the toolbar
	// flips it; we keep a local mirror and write through on change.
	let mapEnabled = $state(drawing.map.enabled);
	$effect(() => {
		if (mapEnabled !== drawing.map.enabled) setMap({ enabled: mapEnabled });
	});

	function handleClear() {
		clearSignal++;
	}

	function handleAddImage(files: FileList) {
		addImageSignal = files;
	}

	// Geocode via Nominatim (OSM public endpoint). No API key, soft rate limit
	// of ~1 req/s — fine for manual use. If it fails we just leave the map where
	// it was; the user can try again.
	async function handleGeocode(query: string) {
		const url = new URL('https://nominatim.openstreetmap.org/search');
		url.searchParams.set('q', query);
		url.searchParams.set('format', 'json');
		url.searchParams.set('limit', '1');
		try {
			const res = await fetch(url, {
				headers: { Accept: 'application/json' }
			});
			if (!res.ok) return;
			const hits = (await res.json()) as Array<{ lat: string; lon: string }>;
			if (!hits.length) return;
			const { lat, lon } = hits[0];
			const latN = Number(lat);
			const lonN = Number(lon);
			if (!Number.isFinite(latN) || !Number.isFinite(lonN)) return;
			// Turning the map on if it's off makes the search feel obvious.
			mapEnabled = true;
			setMap({ enabled: true, lat: latN, lng: lonN, zoom: 17 });
		} catch {
			// Network blocked or CORS — silent, prototype.
		}
	}
</script>

<main class="relative h-screen w-screen overflow-hidden">
	<DrawingCanvas
		{mode}
		{smoothing}
		{strokeWidth}
		{color}
		{clearSignal}
		{addImageSignal}
	/>
	<Toolbar
		bind:mode
		bind:smoothing
		bind:strokeWidth
		bind:color
		bind:mapEnabled
		onClear={handleClear}
		onAddImage={handleAddImage}
		onGeocode={handleGeocode}
	/>

	<div
		class="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/80 px-3 py-1 text-xs text-slate-500 shadow-sm backdrop-blur"
	>
		{#if mode === 'draw'}
			Draw with your pointer. Drop an image anywhere to attach it.
		{:else}
			Click a stroke or image to select. Drag handles to transform. Delete removes the selection.
		{/if}
	</div>
</main>
