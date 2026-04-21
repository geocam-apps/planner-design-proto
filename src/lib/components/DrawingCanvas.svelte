<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { getStroke } from 'perfect-freehand';
	import type paper from 'paper';

	type Mode = 'draw' | 'edit';
	type InputPoint = [number, number, number]; // x, y, pressure
	type DragTarget =
		| { kind: 'segment'; segment: paper.Segment }
		| { kind: 'handleIn'; segment: paper.Segment }
		| { kind: 'handleOut'; segment: paper.Segment };

	let {
		mode,
		smoothing,
		strokeWidth,
		color,
		clearSignal
	}: {
		mode: Mode;
		smoothing: number;
		strokeWidth: number;
		color: string;
		clearSignal: number;
	} = $props();

	let container: HTMLDivElement;
	let canvas: HTMLCanvasElement;

	// Live-preview stroke state (perfect-freehand)
	let livePoints = $state<InputPoint[]>([]);
	let isDrawing = $state(false);
	let pointerType = $state<'mouse' | 'pen' | 'touch'>('mouse');

	// Paper state
	let paperLib: typeof paper | null = null;
	let scope: paper.PaperScope | null = null;
	let drawLayer: paper.Layer | null = null;
	let uiLayer: paper.Layer | null = null;
	let selectedPath: paper.Path | null = null;
	let drag: DragTarget | null = null;

	// --- perfect-freehand → SVG path ---
	function strokeToSvgPath(stroke: number[][]): string {
		if (!stroke.length) return '';
		const first = stroke[0];
		const d: (string | number)[] = ['M', first[0], first[1], 'Q'];
		for (let i = 0; i < stroke.length; i++) {
			const [x0, y0] = stroke[i];
			const [x1, y1] = stroke[(i + 1) % stroke.length];
			d.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
		}
		d.push('Z');
		return d.join(' ');
	}

	const strokeOptions = $derived({
		size: strokeWidth * 2,
		thinning: 0.55,
		smoothing: 0.5,
		streamline: 0.5,
		simulatePressure: pointerType !== 'pen',
		start: { taper: true, cap: true },
		end: { taper: true, cap: true }
	});

	const livePathData = $derived.by(() => {
		if (!isDrawing || livePoints.length < 2) return '';
		const stroke = getStroke(livePoints, strokeOptions);
		return strokeToSvgPath(stroke);
	});

	// --- coordinate helpers ---
	function toLocal(e: PointerEvent): [number, number] {
		const rect = container.getBoundingClientRect();
		return [e.clientX - rect.left, e.clientY - rect.top];
	}

	function pressureFor(e: PointerEvent): number {
		// Mice and some touch devices report 0 on move, 0.5 on press
		if (e.pointerType === 'pen' && e.pressure > 0) return e.pressure;
		return 0.5;
	}

	// --- pointer handlers ---
	function handlePointerDown(e: PointerEvent) {
		if (e.button !== 0 && e.pointerType === 'mouse') return;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		pointerType = (e.pointerType as typeof pointerType) ?? 'mouse';
		const [x, y] = toLocal(e);

		if (mode === 'draw') {
			isDrawing = true;
			livePoints = [[x, y, pressureFor(e)]];
			// Starting a new stroke deselects any path
			setSelected(null);
		} else {
			// edit mode
			const hit = hitTestEdit(x, y);
			if (!hit) {
				setSelected(null);
				return;
			}
			if (hit.kind === 'path') {
				setSelected(hit.path);
				return;
			}
			drag = hit;
		}
	}

	function handlePointerMove(e: PointerEvent) {
		const [x, y] = toLocal(e);

		if (isDrawing) {
			livePoints = [...livePoints, [x, y, pressureFor(e)]];
			return;
		}

		if (drag && mode === 'edit' && paperLib) {
			const pt = new paperLib.Point(x, y);
			const seg = drag.segment;
			if (drag.kind === 'segment') {
				const delta = pt.subtract(seg.point);
				seg.point = pt;
				// keep handle anchors in place visually by shifting nothing —
				// handles are relative so they already move with the point
				void delta;
			} else if (drag.kind === 'handleIn') {
				seg.handleIn = pt.subtract(seg.point);
			} else if (drag.kind === 'handleOut') {
				seg.handleOut = pt.subtract(seg.point);
			}
			renderHandles();
		}
	}

	function handlePointerUp(e: PointerEvent) {
		try {
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		} catch {
			// ignore
		}

		if (isDrawing) {
			isDrawing = false;
			commitStroke();
			livePoints = [];
		}

		drag = null;
	}

	function handlePointerCancel(e: PointerEvent) {
		handlePointerUp(e);
	}

	// --- commit raw points to a simplified paper path ---
	function commitStroke() {
		if (!paperLib || !drawLayer) return;
		if (livePoints.length < 2) return;

		drawLayer.activate();
		const path = new paperLib.Path({
			strokeColor: new paperLib.Color(color),
			strokeWidth,
			strokeCap: 'round',
			strokeJoin: 'round',
			strokeScaling: false
		});
		for (const [x, y] of livePoints) {
			path.add(new paperLib.Point(x, y));
		}
		try {
			path.simplify(smoothing);
		} catch {
			// very short paths can throw — fall back to the raw points
		}
	}

	// --- edit mode hit testing ---
	const HANDLE_R = 7;
	const SEGMENT_R = 6;

	function hitTestEdit(
		x: number,
		y: number
	):
		| { kind: 'segment' | 'handleIn' | 'handleOut'; segment: paper.Segment }
		| { kind: 'path'; path: paper.Path }
		| null {
		if (!paperLib || !drawLayer) return null;
		const pt = new paperLib.Point(x, y);

		if (selectedPath) {
			for (const seg of selectedPath.segments) {
				if (!seg.handleIn.isZero()) {
					const p = seg.point.add(seg.handleIn);
					if (p.getDistance(pt) < HANDLE_R) return { kind: 'handleIn', segment: seg };
				}
				if (!seg.handleOut.isZero()) {
					const p = seg.point.add(seg.handleOut);
					if (p.getDistance(pt) < HANDLE_R) return { kind: 'handleOut', segment: seg };
				}
			}
			for (const seg of selectedPath.segments) {
				if (seg.point.getDistance(pt) < SEGMENT_R) return { kind: 'segment', segment: seg };
			}
		}

		const hit = drawLayer.hitTest(pt, { stroke: true, fill: false, tolerance: 8 });
		if (hit && hit.item instanceof paperLib.Path) {
			return { kind: 'path', path: hit.item };
		}
		return null;
	}

	function setSelected(path: paper.Path | null) {
		selectedPath = path;
		renderHandles();
	}

	// --- render handles on UI layer ---
	function renderHandles() {
		if (!paperLib || !uiLayer) return;
		uiLayer.removeChildren();
		if (!selectedPath) return;
		uiLayer.activate();

		const accent = new paperLib.Color('#0ea5e9');
		const white = new paperLib.Color('#ffffff');

		for (const seg of selectedPath.segments) {
			if (!seg.handleIn.isZero()) {
				const hp = seg.point.add(seg.handleIn);
				new paperLib.Path.Line({
					from: seg.point,
					to: hp,
					strokeColor: accent,
					strokeWidth: 1
				});
				new paperLib.Path.Circle({
					center: hp,
					radius: 4,
					fillColor: white,
					strokeColor: accent,
					strokeWidth: 1.5
				});
			}
			if (!seg.handleOut.isZero()) {
				const hp = seg.point.add(seg.handleOut);
				new paperLib.Path.Line({
					from: seg.point,
					to: hp,
					strokeColor: accent,
					strokeWidth: 1
				});
				new paperLib.Path.Circle({
					center: hp,
					radius: 4,
					fillColor: white,
					strokeColor: accent,
					strokeWidth: 1.5
				});
			}
		}
		for (const seg of selectedPath.segments) {
			new paperLib.Path.Circle({
				center: seg.point,
				radius: 4,
				fillColor: accent
			});
		}

		if (drawLayer) drawLayer.activate();
	}

	// --- clear ---
	function clearAll() {
		if (!drawLayer) return;
		drawLayer.removeChildren();
		setSelected(null);
	}

	// --- mount / setup ---
	onMount(() => {
		let resizeObserver: ResizeObserver | null = null;
		let mounted = true;

		(async () => {
			const mod = await import('paper');
			if (!mounted) return;
			paperLib = mod.default;
			scope = new paperLib.PaperScope();
			scope.setup(canvas);

			drawLayer = scope.project.activeLayer;
			uiLayer = new paperLib.Layer();
			drawLayer.activate();

			// size the view to the container (handles DPR)
			const sync = () => {
				if (!paperLib || !scope) return;
				const rect = container.getBoundingClientRect();
				scope.view.viewSize = new paperLib.Size(rect.width, rect.height);
			};
			sync();
			resizeObserver = new ResizeObserver(sync);
			resizeObserver.observe(container);
		})();

		return () => {
			mounted = false;
			resizeObserver?.disconnect();
			if (scope) scope.project.remove();
			paperLib = null;
			scope = null;
			drawLayer = null;
			uiLayer = null;
			selectedPath = null;
		};
	});

	// React to prop changes
	$effect(() => {
		// switch mode → drop selection/drag state
		mode;
		untrack(() => {
			drag = null;
			if (mode === 'draw') setSelected(null);
		});
	});

	$effect(() => {
		// clear button pressed from parent
		clearSignal;
		untrack(clearAll);
	});
</script>

<div
	bind:this={container}
	role="application"
	aria-label="Drawing surface"
	class="absolute inset-0 {mode === 'draw'
		? 'cursor-crosshair'
		: 'cursor-default'}"
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
	onpointercancel={handlePointerCancel}
>
	<canvas
		bind:this={canvas}
		class="absolute inset-0 h-full w-full"
		aria-label="Drawing canvas"
	></canvas>

	{#if livePathData}
		<svg
			class="pointer-events-none absolute inset-0 h-full w-full"
			aria-hidden="true"
		>
			<path d={livePathData} fill={color} />
		</svg>
	{/if}
</div>
