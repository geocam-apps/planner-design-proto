// Headless smoke test. Loads the app, optionally logs in, expands projects,
// runs a search, and prints anything that looks wrong. From repo root:
//   node scripts/smoke.mjs [url] [email password] [searchTerm]
// Example:
//   node scripts/smoke.mjs http://localhost:8080/ myles@geocam.io correcthorse segundo

import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:8080/';
const email = process.argv[3] ?? null;
const password = process.argv[4] ?? null;
const term = process.argv[5] ?? null;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const consoleMsgs = [];
const pageErrors = [];
const failedReqs = [];
page.on('console', (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('requestfailed', (r) =>
	failedReqs.push(`${r.method()} ${r.url()} - ${r.failure()?.errorText}`)
);

console.log(`GET ${url}`);
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(200);

console.log('path:', new URL(page.url()).pathname);

if (email && password) {
	console.log(`\nLogging in as ${email}…`);
	await page.getByLabel(/email/i).fill(email);
	await page.getByLabel(/password/i).fill(password);
	const resp = page.waitForResponse(
		(r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST'
	);
	await page.getByRole('button', { name: /sign in/i }).click();
	const loginResp = await resp;
	console.log(`login ${loginResp.status()}`);
	// wait for SvelteKit client-side navigation to complete
	await page
		.waitForURL((u) => new URL(u).pathname !== '/login', { timeout: 5000 })
		.catch(() => null);
	await page.waitForLoadState('networkidle');
	console.log('path after login:', new URL(page.url()).pathname);
}

const h1 = await page.locator('h1').first().textContent().catch(() => null);
console.log('h1:', h1);

const projectCount = await page.locator('h2').count();
console.log(`projects visible: ${projectCount}`);

if (term) {
	console.log(`\nSearching for "${term}"…`);
	const projectButtons = await page.locator('div[role="button"][aria-expanded]').all();
	for (const b of projectButtons.slice(0, projectCount)) {
		await b.click();
		await page.waitForTimeout(50);
	}
	const searchInput = page.getByPlaceholder(/search/i).first();
	await searchInput.waitFor({ state: 'visible', timeout: 5000 });
	await searchInput.fill(term);
	const searchApiResponse = await page
		.waitForResponse((r) => r.url().includes('/search?') && r.status() === 200, {
			timeout: 3000
		})
		.catch(() => null);
	if (searchApiResponse) {
		const payload = await searchApiResponse.json().catch(() => null);
		console.log(`api matches: projects=${payload?.projects?.length ?? 0} collections=${payload?.collections?.length ?? 0} captures=${payload?.captures?.length ?? 0}`);
	}
	await page.waitForTimeout(400);
	const marks = await page.locator('mark').allInnerTexts();
	console.log(`highlighted (${marks.length}): ${JSON.stringify(marks)}`);
	const yellowRings = await page.locator('[class*="outline-yellow-400"]').count();
	console.log(`yellow-outlined stage icons: ${yellowRings}`);
}

if (consoleMsgs.length) {
	console.log('\n---console---');
	for (const m of consoleMsgs) console.log(m);
}
if (pageErrors.length) {
	console.log('\n---pageerrors---');
	for (const e of pageErrors) console.log(e);
}
if (failedReqs.length) {
	console.log('\n---failed requests---');
	for (const r of failedReqs) console.log(r);
}

const exitCode = pageErrors.length > 0 ? 1 : 0;
await browser.close();
process.exit(exitCode);
