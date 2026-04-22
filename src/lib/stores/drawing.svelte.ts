// Persisted state for the /drawing prototype. One blob in localStorage
// rehydrated on mount; every mutation goes through a helper that re-persists.
// Base64 image data urls are embedded inline. localStorage is typically 5 MB
// per origin — a handful of phone photos will fit; drop in a 4K PNG and it
// will evict. The catch around setItem swallows quota errors.

export type StrokeImage = {
	id: string;
	dataUrl: string; // base64 data url (PNG/JPG/WebP/GIF/SVG)
	x: number; // center, canvas coords
	y: number;
	// Natural pixel size of the image. Scale is applied on top.
	naturalWidth: number;
	naturalHeight: number;
	scale: number; // uniform multiplier; 1 = natural size
	rotation: number; // degrees, clockwise
	z: number; // relative stacking order; higher draws on top
};

export type MapView = {
	enabled: boolean;
	lat: number;
	lng: number;
	zoom: number;
};

export type DrawingState = {
	// Paper.js project JSON, captures the draw-layer strokes verbatim.
	paperJson: string | null;
	images: StrokeImage[];
	map: MapView;
};

const STORAGE_KEY = 'planner-proto-drawing-v1';

function blank(): DrawingState {
	return {
		paperJson: null,
		images: [],
		map: {
			enabled: false,
			// Central London, not for any reason other than it looks nice on OSM.
			lat: 51.5074,
			lng: -0.1278,
			zoom: 15
		}
	};
}

function loadInitial(): DrawingState {
	if (typeof localStorage === 'undefined') return blank();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return blank();
		const parsed = JSON.parse(raw) as Partial<DrawingState>;
		const base = blank();
		return {
			paperJson: parsed.paperJson ?? null,
			images: Array.isArray(parsed.images) ? (parsed.images as StrokeImage[]) : [],
			map: { ...base.map, ...(parsed.map ?? {}) }
		};
	} catch {
		return blank();
	}
}

export const drawing = $state<DrawingState>(loadInitial());

export function persistDrawing(): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify($state.snapshot(drawing)));
	} catch {
		// Quota blown (typically by a few MB of base64 image data) — silent for
		// the prototype. A real version would compress, use IndexedDB, or push to S3.
	}
}

export function setPaperJson(json: string | null): void {
	drawing.paperJson = json;
	persistDrawing();
}

export function setImages(next: StrokeImage[]): void {
	drawing.images = next;
	persistDrawing();
}

export function upsertImage(image: StrokeImage): void {
	const idx = drawing.images.findIndex((i) => i.id === image.id);
	if (idx === -1) drawing.images = [...drawing.images, image];
	else {
		const copy = drawing.images.slice();
		copy[idx] = image;
		drawing.images = copy;
	}
	persistDrawing();
}

export function removeImage(id: string): void {
	drawing.images = drawing.images.filter((i) => i.id !== id);
	persistDrawing();
}

export function setMap(next: Partial<MapView>): void {
	drawing.map = { ...drawing.map, ...next };
	persistDrawing();
}

export function nextZ(): number {
	if (!drawing.images.length) return 1;
	return Math.max(...drawing.images.map((i) => i.z)) + 1;
}

export function clearAll(): void {
	drawing.paperJson = null;
	drawing.images = [];
	persistDrawing();
}
