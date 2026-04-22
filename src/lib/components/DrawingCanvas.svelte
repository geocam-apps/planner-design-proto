<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { getStroke } from 'perfect-freehand';
	import type paper from 'paper';
	import type * as LeafletNS from 'leaflet';
	import {
		drawing,
		setPaperJson,
		upsertImage,
		removeImage,
		setMap,
		nextZ,
		clearAll as clearAllStore,
		type StrokeImage
	} from '$lib/stores/drawing.svelte';

	type Mode = 'draw' | 'edit';
	type InputPoint = [number, number, number]; // x, y, pressure
	type SegmentDrag =
		| { kind: 'segment'; segment: paper.Segment }
		| { kind: 'handleIn'; segment: paper.Segment }
		| { kind: 'handleOut'; segment: paper.Segment };

	// Corner order: tl, tr, br, bl. Rotation handle is 'rot'.
	type HandleKind = 'tl' | 'tr' | 'br' | 'bl' | 'rot';

	type ImageDrag =
		| { kind: 'move'; imageId: string; offsetX: number; offsetY: number }
		| { kind: 'handle'; imageId: string; handle: HandleKind; startImage: StrokeImage };

	let {
		mode,
		smoothing,
		strokeWidth,
		color,
		clearSignal,
		addImageSignal
	}: {
		mode: Mode;
		smoothing: number;
		strokeWidth: number;
		color: string;
		clearSignal: number;
		addImageSignal: FileList | null;
	} = $props();

	let container: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let mapEl: HTMLDivElement;

	// Live-preview stroke state (perfect-freehand)
	let livePoints = $state<InputPoint[]>([]);
	let isDrawing = $state(false);
	let pointerType = $state<'mouse' | 'pen' | 'touch'>('mouse');

	// Drag-over visual for file drops
	let dragOver = $state(false);

	// Selected image (by id) — drives the transform gizmo.
	let selectedImageId = $state<string | null>(null);

	// Paper state
	let paperLib: typeof paper | null = null;
	let scope: paper.PaperScope | null = null;
	let drawLayer: paper.Layer | null = null;
	let imageLayer: paper.Layer | null = null;
	let uiLayer: paper.Layer | null = null;
	let selectedPath: paper.Path | null = null;
	let segDrag: SegmentDrag | null = null;
	let imgDrag: ImageDrag | null = null;

	// Paper.js Raster instances keyed by image id so we can sync transforms.
	const rasters = new Map<string, paper.Raster>();

	// Leaflet state
	let LeafletMod: typeof LeafletNS | null = null;
	let leafletMap: LeafletNS.Map | null = null;

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
	function toLocal(e: PointerEvent | DragEvent | MouseEvent): [number, number] {
		const rect = container.getBoundingClientRect();
		return [e.clientX - rect.left, e.clientY - rect.top];
	}

	function pressureFor(e: PointerEvent): number {
		if (e.pointerType === 'pen' && e.pressure > 0) return e.pressure;
		return 0.5;
	}

	// --- image helpers ---
	function makeId(): string {
		return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
	}

	function readFileAsDataUrl(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const fr = new FileReader();
			fr.onload = () => resolve(String(fr.result));
			fr.onerror = () => reject(fr.error);
			fr.readAsDataURL(file);
		});
	}

	function loadImageSize(dataUrl: string): Promise<{ w: number; h: number }> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
			img.onerror = () => reject(new Error('image load failed'));
			img.src = dataUrl;
		});
	}

	async function addImageFiles(files: FileList | File[], atX?: number, atY?: number) {
		const rect = container.getBoundingClientRect();
		const cx = atX ?? rect.width / 2;
		const cy = atY ?? rect.height / 2;

		for (const file of Array.from(files)) {
			if (!file.type.startsWith('image/')) continue;
			try {
				const dataUrl = await readFileAsDataUrl(file);
				const { w, h } = await loadImageSize(dataUrl);
				// Fit within 60% of the shorter container side.
				const maxEdge = Math.min(rect.width, rect.height) * 0.6;
				const fit = Math.min(1, maxEdge / Math.max(w, h));
				const img: StrokeImage = {
					id: makeId(),
					dataUrl,
					x: cx,
					y: cy,
					naturalWidth: w,
					naturalHeight: h,
					scale: fit,
					rotation: 0,
					z: nextZ()
				};
				upsertImage(img);
				await ensureRaster(img);
				selectedImageId = img.id;
				renderHandles();
			} catch {
				// Skip unreadable files silently.
			}
		}
	}

	// Build (or update) a Paper Raster for an image record. Returns the raster.
	async function ensureRaster(img: StrokeImage): Promise<paper.Raster | null> {
		if (!paperLib || !imageLayer) return null;
		let raster = rasters.get(img.id);
		if (!raster) {
			imageLayer.activate();
			raster = new paperLib.Raster({ source: img.dataUrl });
			raster.data = { imageId: img.id };
			rasters.set(img.id, raster);
			// Paper doesn't know the size until the image loads; wait for it
			// so subsequent scale() math is correct.
			await new Promise<void>((resolve) => {
				if (raster!.loaded) resolve();
				else raster!.onLoad = () => resolve();
			});
			drawLayer?.activate();
		}
		syncRasterToModel(raster, img);
		orderImageLayer();
		return raster;
	}

	// Apply position / scale / rotation from the model to the raster.
	function syncRasterToModel(raster: paper.Raster, img: StrokeImage) {
		if (!paperLib) return;
		// Reset transform before applying, otherwise scale compounds each edit.
		raster.matrix.reset();
		raster.position = new paperLib.Point(img.x, img.y);
		raster.scale(img.scale);
		raster.rotate(img.rotation);
	}

	// Reorder raster children by z so stacking matches the model.
	function orderImageLayer() {
		if (!imageLayer) return;
		const ordered = drawing.images
			.slice()
			.sort((a, b) => a.z - b.z)
			.map((i) => rasters.get(i.id))
			.filter((r): r is paper.Raster => !!r);
		for (const r of ordered) r.bringToFront();
	}

	// Purge any rasters whose model record has been removed.
	function reconcileRasters() {
		const liveIds = new Set(drawing.images.map((i) => i.id));
		for (const [id, raster] of rasters) {
			if (!liveIds.has(id)) {
				raster.remove();
				rasters.delete(id);
			}
		}
	}

	// --- Handle UX: corner scale + top rotation (the "simpler" pattern from
	// the spec — four corners that scale uniformly from the image center, plus
	// one handle off the top edge that rotates around the center). Holding
	// shift isn't needed because scale is always uniform here; it keeps the
	// image from shearing, which is what a non-dev most likely wants. ---
	const HANDLE_R = 6;
	const ROT_OFFSET = 28; // pixels above the top edge
	const PATH_HANDLE_R = 7;
	const SEGMENT_R = 6;

	type ImageCorners = {
		tl: paper.Point;
		tr: paper.Point;
		br: paper.Point;
		bl: paper.Point;
		top: paper.Point; // rotation-handle anchor, outside the top edge
		center: paper.Point;
	};

	function imageCorners(img: StrokeImage): ImageCorners | null {
		if (!paperLib) return null;
		const halfW = (img.naturalWidth * img.scale) / 2;
		const halfH = (img.naturalHeight * img.scale) / 2;
		const rad = (img.rotation * Math.PI) / 180;
		const cos = Math.cos(rad);
		const sin = Math.sin(rad);
		const rot = (lx: number, ly: number): paper.Point =>
			new paperLib!.Point(img.x + lx * cos - ly * sin, img.y + lx * sin + ly * cos);
		return {
			tl: rot(-halfW, -halfH),
			tr: rot(halfW, -halfH),
			br: rot(halfW, halfH),
			bl: rot(-halfW, halfH),
			top: rot(0, -halfH - ROT_OFFSET),
			center: new paperLib.Point(img.x, img.y)
		};
	}

	function findImageAt(x: number, y: number): StrokeImage | null {
		if (!paperLib) return null;
		const pt = new paperLib.Point(x, y);
		// Hit-test in reverse z order (top-most first).
		const byZ = drawing.images.slice().sort((a, b) => b.z - a.z);
		for (const img of byZ) {
			const raster = rasters.get(img.id);
			if (!raster) continue;
			if (raster.contains(pt)) return img;
		}
		return null;
	}

	function handleHitForSelectedImage(x: number, y: number): HandleKind | null {
		if (!selectedImageId) return null;
		const img = drawing.images.find((i) => i.id === selectedImageId);
		if (!img || !paperLib) return null;
		const corners = imageCorners(img);
		if (!corners) return null;
		const pt = new paperLib.Point(x, y);
		const checks: Array<[HandleKind, paper.Point]> = [
			['rot', corners.top],
			['tl', corners.tl],
			['tr', corners.tr],
			['br', corners.br],
			['bl', corners.bl]
		];
		for (const [k, p] of checks) {
			if (p.getDistance(pt) <= HANDLE_R + 4) return k;
		}
		return null;
	}

	// --- pointer handlers ---
	function handlePointerDown(e: PointerEvent) {
		if (e.button !== 0 && e.pointerType === 'mouse') return;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		pointerType = (e.pointerType as typeof pointerType) ?? 'mouse';
		const [x, y] = toLocal(e);

		// Image handle hit check comes first so it wins over drawing.
		if (selectedImageId) {
			const handle = handleHitForSelectedImage(x, y);
			if (handle) {
				const img = drawing.images.find((i) => i.id === selectedImageId);
				if (img) {
					imgDrag = { kind: 'handle', imageId: img.id, handle, startImage: { ...img } };
					return;
				}
			}
		}

		if (mode === 'draw') {
			// In draw mode, clicking on an image surface still picks it up for
			// moving (feels better than forcing the user to switch modes for a
			// quick nudge). Clicking empty canvas starts a stroke.
			const hitImg = findImageAt(x, y);
			if (hitImg) {
				selectedImageId = hitImg.id;
				setSelected(null);
				imgDrag = { kind: 'move', imageId: hitImg.id, offsetX: x - hitImg.x, offsetY: y - hitImg.y };
				renderHandles();
				return;
			}

			selectedImageId = null;
			renderHandles();

			isDrawing = true;
			livePoints = [[x, y, pressureFor(e)]];
			setSelected(null);
		} else {
			// edit mode
			// Image surface → select and drag.
			const hitImg = findImageAt(x, y);
			if (hitImg) {
				selectedImageId = hitImg.id;
				setSelected(null);
				imgDrag = { kind: 'move', imageId: hitImg.id, offsetX: x - hitImg.x, offsetY: y - hitImg.y };
				renderHandles();
				return;
			}

			// Otherwise path segment / handle / path selection.
			const hit = hitTestEdit(x, y);
			if (!hit) {
				setSelected(null);
				selectedImageId = null;
				renderHandles();
				return;
			}
			if (hit.kind === 'path') {
				setSelected(hit.path);
				selectedImageId = null;
				return;
			}
			segDrag = hit;
		}
	}

	function handlePointerMove(e: PointerEvent) {
		const [x, y] = toLocal(e);

		if (isDrawing) {
			livePoints = [...livePoints, [x, y, pressureFor(e)]];
			return;
		}

		if (imgDrag) {
			const img = drawing.images.find((i) => i.id === imgDrag!.imageId);
			if (!img) {
				imgDrag = null;
				return;
			}
			if (imgDrag.kind === 'move') {
				const next: StrokeImage = {
					...img,
					x: x - imgDrag.offsetX,
					y: y - imgDrag.offsetY
				};
				updateImage(next, { persist: false });
			} else {
				const start = imgDrag.startImage;
				if (imgDrag.handle === 'rot') {
					// Rotate around center so the cursor stays under the handle.
					const angle = Math.atan2(y - start.y, x - start.x) * (180 / Math.PI);
					// The top handle points "up" from center at rotation 0, which
					// is angle -90°. Offset by +90 so dragging straight up = 0°.
					const rotation = angle + 90;
					updateImage({ ...img, rotation }, { persist: false });
				} else {
					// Scale from center to the dragged corner. Distance from
					// center → corner defines the current half-diagonal; compare
					// to the natural half-diagonal for a uniform scale factor.
					const halfNaturalDiag =
						Math.hypot(start.naturalWidth, start.naturalHeight) / 2;
					if (halfNaturalDiag <= 0) return;
					const cornerDist = Math.hypot(x - start.x, y - start.y);
					const nextScale = Math.max(0.02, cornerDist / halfNaturalDiag);
					updateImage({ ...img, scale: nextScale }, { persist: false });
				}
			}
			renderHandles();
			return;
		}

		if (segDrag && mode === 'edit' && paperLib) {
			const pt = new paperLib.Point(x, y);
			const seg = segDrag.segment;
			if (segDrag.kind === 'segment') {
				seg.point = pt;
			} else if (segDrag.kind === 'handleIn') {
				seg.handleIn = pt.subtract(seg.point);
			} else if (segDrag.kind === 'handleOut') {
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
			persistStrokes();
		}

		if (imgDrag) {
			// Commit final state to localStorage now that the drag is over.
			const img = drawing.images.find((i) => i.id === imgDrag!.imageId);
			if (img) upsertImage(img);
			imgDrag = null;
		}

		if (segDrag) {
			persistStrokes();
			segDrag = null;
		}
	}

	function handlePointerCancel(e: PointerEvent) {
		handlePointerUp(e);
	}

	// --- image model mutation ---
	function updateImage(next: StrokeImage, { persist }: { persist: boolean }) {
		// Mirror to store (without persisting on every mouse move — we commit
		// on pointer up).
		const idx = drawing.images.findIndex((i) => i.id === next.id);
		if (idx === -1) return;
		const arr = drawing.images.slice();
		arr[idx] = next;
		drawing.images = arr;
		const raster = rasters.get(next.id);
		if (raster) syncRasterToModel(raster, next);
		if (persist) upsertImage(next);
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

	// --- edit mode hit testing (paths) ---
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
					if (p.getDistance(pt) < PATH_HANDLE_R) return { kind: 'handleIn', segment: seg };
				}
				if (!seg.handleOut.isZero()) {
					const p = seg.point.add(seg.handleOut);
					if (p.getDistance(pt) < PATH_HANDLE_R) return { kind: 'handleOut', segment: seg };
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

	// --- render handles (both path segments and selected image gizmo) ---
	function renderHandles() {
		if (!paperLib || !uiLayer) return;
		uiLayer.removeChildren();
		uiLayer.activate();

		const accent = new paperLib.Color('#0ea5e9');
		const white = new paperLib.Color('#ffffff');

		if (selectedPath) {
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
		}

		if (selectedImageId) {
			const img = drawing.images.find((i) => i.id === selectedImageId);
			if (img) {
				const c = imageCorners(img);
				if (c) {
					// Bounding rect
					const rect = new paperLib.Path({
						segments: [c.tl, c.tr, c.br, c.bl],
						closed: true,
						strokeColor: accent,
						strokeWidth: 1
					});
					void rect;

					// Line from top edge midpoint to rotation handle
					const topMid = c.tl.add(c.tr).divide(2);
					new paperLib.Path.Line({
						from: topMid,
						to: c.top,
						strokeColor: accent,
						strokeWidth: 1
					});

					// Corner handles
					for (const corner of [c.tl, c.tr, c.br, c.bl]) {
						new paperLib.Path.Rectangle({
							point: new paperLib.Point(corner.x - HANDLE_R, corner.y - HANDLE_R),
							size: new paperLib.Size(HANDLE_R * 2, HANDLE_R * 2),
							fillColor: white,
							strokeColor: accent,
							strokeWidth: 1.5
						});
					}

					// Rotation handle
					new paperLib.Path.Circle({
						center: c.top,
						radius: HANDLE_R,
						fillColor: white,
						strokeColor: accent,
						strokeWidth: 1.5
					});
				}
			}
		}

		if (drawLayer) drawLayer.activate();
	}

	// --- persistence ---
	function persistStrokes() {
		if (!drawLayer || !paperLib || !scope) return;
		// Export only the draw layer — we don't want images in this JSON
		// (they're persisted separately as model records).
		try {
			const json = drawLayer.exportJSON({ asString: true }) as string;
			setPaperJson(json);
		} catch {
			// ignore export errors
		}
	}

	// --- clear ---
	function clearAllDrawing() {
		if (!drawLayer) return;
		drawLayer.removeChildren();
		setSelected(null);
		for (const [, raster] of rasters) raster.remove();
		rasters.clear();
		selectedImageId = null;
		renderHandles();
		// One call to the store helper clears paperJson + images + persists.
		clearAllStore();
	}

	// --- keyboard ---
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Delete' || e.key === 'Backspace') {
			// Don't steal delete when the user is typing in an input/textarea.
			const target = e.target as HTMLElement | null;
			if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
			if (selectedImageId) {
				const raster = rasters.get(selectedImageId);
				if (raster) raster.remove();
				rasters.delete(selectedImageId);
				removeImage(selectedImageId);
				selectedImageId = null;
				renderHandles();
				e.preventDefault();
				return;
			}
			if (selectedPath) {
				selectedPath.remove();
				selectedPath = null;
				renderHandles();
				persistStrokes();
				e.preventDefault();
			}
		}
	}

	// --- drag & drop ---
	// --- wheel → map zoom (only active when map is on) ---
	function onWheel(e: WheelEvent) {
		if (!drawing.map.enabled || !leafletMap || !LeafletMod) return;
		e.preventDefault();
		const [x, y] = toLocal(e);
		const rect = container.getBoundingClientRect();
		// Convert canvas-local px to lat/lng, zoom around that point.
		const containerPoint = LeafletMod.point(x, y);
		void rect;
		const target = leafletMap.containerPointToLatLng(containerPoint);
		const curZ = leafletMap.getZoom();
		const dz = e.deltaY > 0 ? -1 : 1;
		const nextZoom = Math.max(2, Math.min(19, curZ + dz));
		if (nextZoom !== curZ) leafletMap.setView(target, nextZoom, { animate: false });
	}

	function zoomBy(dz: number) {
		if (!leafletMap) return;
		const curZ = leafletMap.getZoom();
		const nextZoom = Math.max(2, Math.min(19, curZ + dz));
		if (nextZoom !== curZ) leafletMap.setZoom(nextZoom);
	}

	function onDragEnter(e: DragEvent) {
		if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
			dragOver = true;
		}
	}
	function onDragOver(e: DragEvent) {
		if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
			e.preventDefault();
			dragOver = true;
		}
	}
	function onDragLeave(e: DragEvent) {
		// Only clear if we've actually left the container (not a child).
		if (e.target === container) dragOver = false;
	}
	async function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const files = e.dataTransfer?.files;
		if (!files || !files.length) return;
		const [x, y] = toLocal(e);
		await addImageFiles(files, x, y);
	}

	// --- mount / setup ---
	onMount(() => {
		let resizeObserver: ResizeObserver | null = null;
		let mounted = true;

		(async () => {
			const [paperMod, leafletMod] = await Promise.all([
				import('paper'),
				import('leaflet')
			]);
			// Leaflet's CSS ships separately; pull it in client-side only so SSR
			// stays happy.
			await import('leaflet/dist/leaflet.css');
			if (!mounted) return;

			paperLib = paperMod.default;
			LeafletMod = leafletMod;

			scope = new paperLib.PaperScope();
			scope.setup(canvas);
			// Transparent background so the Leaflet map (if enabled) shows through.
			// Paper itself doesn't paint a bg colour; we rely on the canvas element.

			drawLayer = scope.project.activeLayer;
			imageLayer = new paperLib.Layer();
			uiLayer = new paperLib.Layer();
			drawLayer.activate();

			const sync = () => {
				if (!paperLib || !scope) return;
				const rect = container.getBoundingClientRect();
				scope.view.viewSize = new paperLib.Size(rect.width, rect.height);
				leafletMap?.invalidateSize();
			};
			sync();
			resizeObserver = new ResizeObserver(sync);
			resizeObserver.observe(container);

			// Rehydrate: images first (they go underneath strokes), then strokes.
			for (const img of drawing.images) {
				await ensureRaster(img);
			}
			orderImageLayer();

			if (drawing.paperJson) {
				try {
					// importJSON into the draw layer specifically.
					drawLayer.activate();
					drawLayer.importJSON(drawing.paperJson);
				} catch {
					// corrupt blob, ignore
				}
			}

			// Bring up the map if it was on at last unload.
			if (drawing.map.enabled) initMap();
		})();

		window.addEventListener('keydown', handleKeyDown);

		return () => {
			mounted = false;
			resizeObserver?.disconnect();
			window.removeEventListener('keydown', handleKeyDown);
			if (leafletMap) {
				leafletMap.remove();
				leafletMap = null;
			}
			if (scope) scope.project.remove();
			paperLib = null;
			scope = null;
			drawLayer = null;
			imageLayer = null;
			uiLayer = null;
			selectedPath = null;
			rasters.clear();
		};
	});

	// --- map init / teardown ---
	function initMap() {
		if (!LeafletMod || leafletMap || !mapEl) return;
		leafletMap = LeafletMod.map(mapEl, {
			center: [drawing.map.lat, drawing.map.lng],
			zoom: drawing.map.zoom,
			// The canvas sits on top and owns pointer events (so the user can
			// draw). That means Leaflet's own drag/zoom handlers can't fire.
			// We re-expose wheel-zoom through a custom handler below, and the
			// primary way to move the map is the toolbar address search.
			dragging: false,
			scrollWheelZoom: false,
			doubleClickZoom: false,
			touchZoom: false,
			boxZoom: false,
			keyboard: false,
			zoomControl: false,
			attributionControl: true
		});
		LeafletMod.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 19,
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
		}).addTo(leafletMap);
		leafletMap.on('moveend zoomend', () => {
			if (!leafletMap) return;
			const c = leafletMap.getCenter();
			setMap({ lat: c.lat, lng: c.lng, zoom: leafletMap.getZoom() });
		});
		// Invalidate after next tick so the tile layer fills the container.
		setTimeout(() => leafletMap?.invalidateSize(), 0);
	}

	function teardownMap() {
		if (!leafletMap) return;
		leafletMap.remove();
		leafletMap = null;
	}

	// React to map toggle / view changes from outside.
	$effect(() => {
		const enabled = drawing.map.enabled;
		untrack(() => {
			if (enabled && !leafletMap && LeafletMod) initMap();
			else if (!enabled && leafletMap) teardownMap();
		});
	});

	$effect(() => {
		const { lat, lng, zoom } = drawing.map;
		untrack(() => {
			if (!leafletMap) return;
			const cur = leafletMap.getCenter();
			const curZ = leafletMap.getZoom();
			if (
				Math.abs(cur.lat - lat) > 1e-7 ||
				Math.abs(cur.lng - lng) > 1e-7 ||
				curZ !== zoom
			) {
				leafletMap.setView([lat, lng], zoom, { animate: true });
			}
		});
	});

	// React to prop changes
	$effect(() => {
		mode;
		untrack(() => {
			segDrag = null;
			imgDrag = null;
			if (mode === 'draw') setSelected(null);
		});
	});

	$effect(() => {
		clearSignal;
		untrack(clearAllDrawing);
	});

	$effect(() => {
		const files = addImageSignal;
		untrack(() => {
			if (files && files.length) void addImageFiles(files);
		});
	});

	// Keep model → rasters in sync when the model mutates from elsewhere
	// (e.g. rehydrate). We reconcile on every images reference change.
	$effect(() => {
		const imgs = drawing.images;
		untrack(() => {
			if (!paperLib || !imageLayer) return;
			reconcileRasters();
			for (const img of imgs) {
				const raster = rasters.get(img.id);
				if (raster) syncRasterToModel(raster, img);
			}
			orderImageLayer();
		});
	});
</script>

<div
	bind:this={container}
	role="application"
	aria-label="Drawing surface"
	class="absolute inset-0 isolate {mode === 'draw'
		? 'cursor-crosshair'
		: 'cursor-default'} {dragOver ? 'ring-4 ring-inset ring-sky-400' : ''} {drawing.map.enabled
		? ''
		: 'bg-white'}"
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
	onpointercancel={handlePointerCancel}
	ondragenter={onDragEnter}
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	ondrop={onDrop}
	onwheel={onWheel}
>
	<!-- Leaflet map: sits underneath everything. Always in the DOM so we can
	     initialise it lazily; hidden when the toggle is off. The outer wrapper
	     has `isolate`, so Leaflet's internal z-indexes (which go up to ~700)
	     stay bounded to this stacking context. -->
	<div
		bind:this={mapEl}
		class="absolute inset-0 z-0 {drawing.map.enabled ? 'block' : 'hidden'}"
		aria-hidden={!drawing.map.enabled}
	></div>

	<!-- Paper.js canvas: transparent, hosts images + strokes. -->
	<canvas
		bind:this={canvas}
		class="absolute inset-0 z-10 h-full w-full"
		aria-label="Drawing canvas"
	></canvas>

	<!-- Live perfect-freehand preview SVG, no pointer events. -->
	{#if livePathData}
		<svg
			class="pointer-events-none absolute inset-0 z-20 h-full w-full"
			aria-hidden="true"
		>
			<path d={livePathData} fill={color} />
		</svg>
	{/if}

	{#if dragOver}
		<div
			class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-sky-50/40"
		>
			<div class="rounded-xl border-2 border-dashed border-sky-400 bg-white/90 px-4 py-2 text-sm font-medium text-sky-700 shadow-sm">
				Drop image to attach
			</div>
		</div>
	{/if}

	{#if drawing.map.enabled}
		<!-- Minimal zoom control that sits above the canvas so the user can
		     still zoom without scrolling (wheel works too). -->
		<div class="absolute right-4 bottom-16 z-40 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white/90 shadow-sm backdrop-blur">
			<button
				type="button"
				onclick={() => zoomBy(1)}
				aria-label="Zoom in"
				class="px-2.5 py-1 text-lg font-medium text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
			>+</button>
			<div class="h-px bg-slate-200"></div>
			<button
				type="button"
				onclick={() => zoomBy(-1)}
				aria-label="Zoom out"
				class="px-2.5 py-1 text-lg font-medium text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
			>&minus;</button>
		</div>
	{/if}
</div>

<style>
	/* Leaflet internals generate their own stacking contexts; make sure the
	   tile layer stays behind the canvas. */
	:global(.leaflet-container) {
		background: #f1f5f9;
	}
</style>
