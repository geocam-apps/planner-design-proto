<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { LogIn, LoaderCircle, TriangleAlert, ShieldCheck } from '@lucide/svelte';

	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let error = $state<string | null>(null);

	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		submitting = true;
		error = null;
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				error = data.error ?? `Login failed (${res.status})`;
				return;
			}
			const next = page.url.searchParams.get('next') ?? '/';
			await goto(next, { invalidateAll: true });
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in · planner</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center px-4">
	<div class="w-full max-w-sm">
		<div class="mb-6 flex flex-col items-center gap-2 text-center">
			<div
				class="flex size-12 items-center justify-center rounded-2xl bg-slate-900 text-white"
			>
				<LogIn size={20} />
			</div>
			<h1 class="text-xl font-semibold text-slate-900">Sign in</h1>
			<p class="text-sm text-slate-500">Use your Geocam account.</p>
		</div>

		<form
			onsubmit={onSubmit}
			class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5"
		>
			<label class="flex flex-col gap-1 text-sm">
				<span class="font-medium text-slate-700">Email</span>
				<input
					type="email"
					name="email"
					autocomplete="email"
					required
					bind:value={email}
					disabled={submitting}
					class="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-200 focus:outline-none disabled:opacity-50"
					placeholder="you@geocam.io"
				/>
			</label>

			<label class="flex flex-col gap-1 text-sm">
				<span class="font-medium text-slate-700">Password</span>
				<input
					type="password"
					name="password"
					autocomplete="current-password"
					required
					bind:value={password}
					disabled={submitting}
					class="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:ring-2 focus:ring-sky-200 focus:outline-none disabled:opacity-50"
				/>
			</label>

			{#if error}
				<div
					class="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700"
				>
					<TriangleAlert size={14} />
					{error}
				</div>
			{/if}

			<button
				type="submit"
				disabled={submitting || !email || !password}
				class="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
			>
				{#if submitting}
					<LoaderCircle size={14} class="animate-spin" />
				{:else}
					<LogIn size={14} />
				{/if}
				Sign in
			</button>
		</form>

		<p class="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
			<ShieldCheck size={12} />
			Read-only prototype — no data is modified by your actions.
		</p>
	</div>
</main>
