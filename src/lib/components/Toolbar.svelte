<script lang="ts">
	import { ImagePlus, Map as MapIcon, Search, Loader2 } from '@lucide/svelte';

	type Mode = 'draw' | 'edit';

	let {
		mode = $bindable(),
		smoothing = $bindable(),
		strokeWidth = $bindable(),
		color = $bindable(),
		mapEnabled = $bindable(),
		onClear,
		onAddImage,
		onGeocode
	}: {
		mode: Mode;
		smoothing: number;
		strokeWidth: number;
		color: string;
		mapEnabled: boolean;
		onClear: () => void;
		onAddImage: (files: FileList) => void;
		onGeocode: (query: string) => Promise<void>;
	} = $props();

	const presets = [
		{ label: 'Low', value: 1 },
		{ label: 'Medium', value: 2.5 },
		{ label: 'High', value: 10 }
	];

	const activePreset = $derived(presets.find((p) => Math.abs(p.value - smoothing) < 0.01));

	const palette = ['#0f172a', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#a855f7'];

	function setPreset(v: number) {
		smoothing = v;
	}

	let fileInput: HTMLInputElement;
	function openFilePicker() {
		fileInput?.click();
	}
	function onFilePicked(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length) {
			// Copy the FileList into a stable array — clearing the input's
			// value below mutates the live FileList, which would empty out the
			// reference we just passed up to the parent.
			const copy = new DataTransfer();
			for (const f of Array.from(target.files)) copy.items.add(f);
			onAddImage(copy.files);
		}
		// Reset so picking the same file twice re-fires `change`.
		target.value = '';
	}

	let query = $state('');
	let geocoding = $state(false);
	async function submitGeocode(e: SubmitEvent) {
		e.preventDefault();
		const q = query.trim();
		if (!q) return;
		geocoding = true;
		try {
			await onGeocode(q);
		} finally {
			geocoding = false;
		}
	}
</script>

<div
	class="pointer-events-auto fixed top-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-2 py-2 shadow-lg shadow-slate-900/5 backdrop-blur"
>
	<!-- Mode toggle -->
	<div
		class="flex rounded-xl bg-slate-100 p-0.5"
		role="radiogroup"
		aria-label="Interaction mode"
	>
		<button
			type="button"
			role="radio"
			aria-checked={mode === 'draw'}
			onclick={() => (mode = 'draw')}
			class="rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none {mode ===
			'draw'
				? 'bg-white text-slate-900 shadow-sm'
				: 'text-slate-500 hover:text-slate-700'}"
		>
			Draw
		</button>
		<button
			type="button"
			role="radio"
			aria-checked={mode === 'edit'}
			onclick={() => (mode = 'edit')}
			class="rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none {mode ===
			'edit'
				? 'bg-white text-slate-900 shadow-sm'
				: 'text-slate-500 hover:text-slate-700'}"
		>
			Edit
		</button>
	</div>

	<div class="h-6 w-px bg-slate-200"></div>

	<!-- Smoothing -->
	<div class="flex items-center gap-2 px-1">
		<label class="text-xs font-medium text-slate-500" for="smoothing-slider">Smoothing</label>
		<div class="flex rounded-lg bg-slate-100 p-0.5">
			{#each presets as p (p.value)}
				<button
					type="button"
					onclick={() => setPreset(p.value)}
					class="rounded-md px-2 py-1 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none {activePreset?.value ===
					p.value
						? 'bg-white text-slate-900 shadow-sm'
						: 'text-slate-500 hover:text-slate-700'}"
				>
					{p.label}
				</button>
			{/each}
		</div>
		<input
			id="smoothing-slider"
			type="range"
			min="1"
			max="20"
			step="0.1"
			bind:value={smoothing}
			class="accent-sky-500"
			aria-label="Smoothing tolerance"
		/>
		<span
			class="w-10 text-right font-mono text-xs tabular-nums text-slate-500"
			aria-live="polite"
		>
			{smoothing.toFixed(1)}
		</span>
	</div>

	<div class="h-6 w-px bg-slate-200"></div>

	<!-- Stroke width -->
	<div class="flex items-center gap-2 px-1">
		<label class="text-xs font-medium text-slate-500" for="width-slider">Width</label>
		<input
			id="width-slider"
			type="range"
			min="1"
			max="24"
			step="1"
			bind:value={strokeWidth}
			class="accent-sky-500"
			aria-label="Stroke width"
		/>
		<span class="w-6 text-right font-mono text-xs tabular-nums text-slate-500">
			{strokeWidth}
		</span>
	</div>

	<div class="h-6 w-px bg-slate-200"></div>

	<!-- Color picker -->
	<div class="flex items-center gap-1 px-1" role="radiogroup" aria-label="Stroke color">
		{#each palette as c (c)}
			<button
				type="button"
				role="radio"
				aria-checked={color === c}
				aria-label="Color {c}"
				onclick={() => (color = c)}
				class="size-6 rounded-full transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-none {color ===
				c
					? 'ring-2 ring-slate-900 ring-offset-2'
					: ''}"
				style="background-color: {c}"
			></button>
		{/each}
		<label
			class="size-6 cursor-pointer overflow-hidden rounded-full ring-1 ring-slate-200"
			aria-label="Custom color"
		>
			<input type="color" bind:value={color} class="h-8 w-8 -translate-x-1 -translate-y-1 cursor-pointer" />
		</label>
	</div>

	<div class="h-6 w-px bg-slate-200"></div>

	<!-- Add image -->
	<button
		type="button"
		onclick={openFilePicker}
		class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
		aria-label="Add image"
		title="Add image"
	>
		<ImagePlus class="size-4" />
		<span>Image</span>
	</button>
	<input
		bind:this={fileInput}
		type="file"
		accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
		multiple
		class="hidden"
		onchange={onFilePicked}
	/>

	<!-- Map toggle -->
	<button
		type="button"
		role="switch"
		aria-checked={mapEnabled}
		aria-label="Toggle map background"
		onclick={() => (mapEnabled = !mapEnabled)}
		class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none {mapEnabled
			? 'bg-sky-100 text-sky-700 hover:bg-sky-200'
			: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}"
		title="Toggle map background"
	>
		<MapIcon class="size-4" />
		<span>Map</span>
	</button>

	<!-- Address search (only useful with map on, but shown always so the user
	     can tee up a search and then toggle) -->
	<form onsubmit={submitGeocode} class="flex items-center gap-1">
		<div class="relative">
			<Search class="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-slate-400" />
			<input
				type="text"
				bind:value={query}
				placeholder="Address or place"
				aria-label="Search address"
				class="w-44 rounded-lg border border-slate-200 bg-white py-1.5 pr-2 pl-7 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-500 focus:outline-none"
			/>
		</div>
		<button
			type="submit"
			disabled={geocoding || !query.trim()}
			class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
		>
			{#if geocoding}
				<Loader2 class="size-4 animate-spin" />
			{:else}
				Go
			{/if}
		</button>
	</form>

	<div class="h-6 w-px bg-slate-200"></div>

	<!-- Clear -->
	<button
		type="button"
		onclick={onClear}
		class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
	>
		Clear
	</button>
</div>
