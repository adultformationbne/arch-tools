<script lang="ts">
	import { Palette, Type } from '$lib/icons';

	let {
		accentDark = '#334642',
		accentLight = '#c59a6b',
		fontFamily = 'Inter',
		onThemeChange = (theme: any) => {}
	} = $props();

	// Available fonts
	const fonts = [
		{ value: 'Inter', label: 'Inter', style: 'font-sans' },
		{ value: 'Georgia', label: 'Georgia', style: 'font-serif' },
		{ value: 'Courier New', label: 'Courier New', style: 'font-mono' },
		{ value: 'Arial', label: 'Arial', style: 'font-sans' },
		{ value: 'Times New Roman', label: 'Times New Roman', style: 'font-serif' }
	];

	function updateDark(value: string) {
		onThemeChange({ accentDark: value, accentLight, fontFamily });
	}

	function updateLight(value: string) {
		onThemeChange({ accentDark, accentLight: value, fontFamily });
	}

	function updateFont(value: string) {
		onThemeChange({ accentDark, accentLight, fontFamily: value });
	}

	function applyPreset(dark: string, light: string, font: string) {
		onThemeChange({ accentDark: dark, accentLight: light, fontFamily: font });
	}
</script>

<div class="space-y-6">
	<!-- Color Selection -->
	<div>
		<h3 class="mb-3 flex items-center text-sm font-semibold text-gray-700">
			<Palette class="mr-2 h-4 w-4" />
			Brand Colors
		</h3>

		<div class="grid grid-cols-2 gap-4">
			<!-- Accent Dark Color -->
			<div>
				<label for="accent-dark" class="mb-2 block text-xs font-medium text-gray-600">
					Accent Dark
				</label>
				<div class="flex items-center gap-2">
					<input
						type="color"
						id="accent-dark"
						value={accentDark}
						oninput={(e) => updateDark(e.currentTarget.value)}
						class="h-10 w-16 cursor-pointer rounded border border-gray-300"
					/>
					<input
						type="text"
						value={accentDark}
						oninput={(e) => updateDark(e.currentTarget.value)}
						class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
						placeholder="#334642"
					/>
				</div>
			</div>

			<!-- Accent Light Color -->
			<div>
				<label for="accent-light" class="mb-2 block text-xs font-medium text-gray-600">
					Accent Light
				</label>
				<div class="flex items-center gap-2">
					<input
						type="color"
						id="accent-light"
						value={accentLight}
						oninput={(e) => updateLight(e.currentTarget.value)}
						class="h-10 w-16 cursor-pointer rounded border border-gray-300"
					/>
					<input
						type="text"
						value={accentLight}
						oninput={(e) => updateLight(e.currentTarget.value)}
						class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
						placeholder="#c59a6b"
					/>
				</div>
			</div>
		</div>
	</div>

	<!-- Font Selection -->
	<div>
		<h3 class="mb-3 flex items-center text-sm font-semibold text-gray-700">
			<Type class="mr-2 h-4 w-4" />
			Typography
		</h3>

		<select
			value={fontFamily}
			onchange={(e) => updateFont(e.currentTarget.value)}
			class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
		>
			{#each fonts as font}
				<option value={font.value}>{font.label}</option>
			{/each}
		</select>
	</div>

	<!-- Live Preview -->
	<div>
		<h3 class="mb-3 text-sm font-semibold text-gray-700">Preview</h3>

		<div
			class="overflow-hidden rounded-xl border border-gray-300 shadow-lg"
			style="background-color: {accentLight};"
		>
			<!-- Header with dark accent -->
			<div
				class="px-6 py-4"
				style="background-color: {accentDark}; color: white; font-family: '{fontFamily}', sans-serif;"
			>
				<h4 class="text-lg font-bold">Course Title</h4>
				<p class="mt-1 text-sm opacity-90">Welcome to your course</p>
			</div>

			<!-- Content area with light accent background -->
			<div class="p-6">
				<div
					class="rounded-lg bg-white p-4 shadow-sm"
					style="font-family: '{fontFamily}', sans-serif;"
				>
					<h5 class="mb-2 font-semibold" style="color: {accentDark};">
						Module 1: Introduction
					</h5>
					<p class="text-sm text-gray-600">
						This is how your course content will appear with the selected theme. The dark accent is
						used for headers and primary elements, while the light accent creates a warm
						background.
					</p>

					<!-- Sample button -->
					<button
						class="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
						style="background-color: {accentDark}; font-family: '{fontFamily}', sans-serif;"
					>
						Continue Learning
					</button>
				</div>
			</div>

			<!-- Footer with light accent text -->
			<div
				class="border-t px-6 py-3 text-center text-xs"
				style="background-color: {accentLight}; color: {accentDark}; font-family: '{fontFamily}', sans-serif; border-color: {accentDark}33;"
			>
				Course branding reflects your organization's identity
			</div>
		</div>
	</div>

	<!-- Quick Presets -->
	<div>
		<h3 class="mb-3 text-sm font-semibold text-gray-700">Quick Presets</h3>
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				onclick={() => applyPreset('#334642', '#c59a6b', 'Inter')}
				class="rounded-lg border-2 border-gray-300 px-3 py-2 text-xs font-medium transition-colors hover:border-gray-400"
			>
				<div class="flex items-center gap-2">
					<div class="flex gap-1">
						<div class="h-4 w-4 rounded" style="background-color: #334642;"></div>
						<div class="h-4 w-4 rounded" style="background-color: #c59a6b;"></div>
					</div>
					<span>ACCF Classic</span>
				</div>
			</button>

			<button
				type="button"
				onclick={() => applyPreset('#1e3a8a', '#93c5fd', 'Inter')}
				class="rounded-lg border-2 border-gray-300 px-3 py-2 text-xs font-medium transition-colors hover:border-gray-400"
			>
				<div class="flex items-center gap-2">
					<div class="flex gap-1">
						<div class="h-4 w-4 rounded" style="background-color: #1e3a8a;"></div>
						<div class="h-4 w-4 rounded" style="background-color: #93c5fd;"></div>
					</div>
					<span>Ocean Blue</span>
				</div>
			</button>

			<button
				type="button"
				onclick={() => applyPreset('#7c2d12', '#fed7aa', 'Georgia')}
				class="rounded-lg border-2 border-gray-300 px-3 py-2 text-xs font-medium transition-colors hover:border-gray-400"
			>
				<div class="flex items-center gap-2">
					<div class="flex gap-1">
						<div class="h-4 w-4 rounded" style="background-color: #7c2d12;"></div>
						<div class="h-4 w-4 rounded" style="background-color: #fed7aa;"></div>
					</div>
					<span>Autumn</span>
				</div>
			</button>

			<button
				type="button"
				onclick={() => applyPreset('#064e3b', '#a7f3d0', 'Inter')}
				class="rounded-lg border-2 border-gray-300 px-3 py-2 text-xs font-medium transition-colors hover:border-gray-400"
			>
				<div class="flex items-center gap-2">
					<div class="flex gap-1">
						<div class="h-4 w-4 rounded" style="background-color: #064e3b;"></div>
						<div class="h-4 w-4 rounded" style="background-color: #a7f3d0;"></div>
					</div>
					<span>Forest Green</span>
				</div>
			</button>
		</div>
	</div>
</div>
