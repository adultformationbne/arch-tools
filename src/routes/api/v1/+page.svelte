<script>
	import { onMount } from 'svelte';

	let todayExample = $state(null);
	let loading = $state(true);

	onMount(async () => {
		// Fetch today's readings as an example
		try {
			const response = await fetch('/api/v1/today');
			todayExample = await response.json();
		} catch (error) {
			console.error('Failed to load example:', error);
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Liturgical Readings API - Documentation</title>
	<meta name="description" content="Free public API for Catholic daily Mass readings and liturgical calendar" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
	<div class="mx-auto max-w-5xl px-4">
		<!-- Header -->
		<div class="mb-12 text-center">
			<h1 class="mb-4 text-5xl font-bold text-gray-900">Liturgical Readings API</h1>
			<p class="text-xl text-gray-700">Free public API for Catholic daily Mass readings</p>
			<p class="mt-2 text-sm text-gray-600">v1.0 • Australian Calendar • Open Access</p>
		</div>

		<!-- Quick Start -->
		<div class="mb-8 rounded-2xl bg-white p-8 shadow-lg">
			<h2 class="mb-4 text-2xl font-bold text-gray-900">Quick Start</h2>

			<div class="space-y-6">
				<!-- Endpoint 1: Today -->
				<div>
					<h3 class="mb-2 text-lg font-semibold text-gray-800">Get Today's Readings</h3>
					<div class="rounded-lg bg-gray-900 p-4">
						<code class="text-sm text-green-400">GET /api/v1/today</code>
					</div>
					<p class="mt-2 text-sm text-gray-600">Returns today's Mass readings with no parameters needed.</p>
				</div>

				<!-- Endpoint 2: Specific Date -->
				<div>
					<h3 class="mb-2 text-lg font-semibold text-gray-800">Get Readings for a Specific Date</h3>
					<div class="rounded-lg bg-gray-900 p-4">
						<code class="text-sm text-green-400">GET /api/v1/readings?date=2025-12-25</code>
					</div>
					<p class="mt-2 text-sm text-gray-600">Returns readings for any date in YYYY-MM-DD format.</p>
				</div>
			</div>
		</div>

		<!-- Live Example -->
		<div class="mb-8 rounded-2xl bg-white p-8 shadow-lg">
			<h2 class="mb-4 text-2xl font-bold text-gray-900">Live Example</h2>

			{#if loading}
				<div class="flex justify-center py-8">
					<div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
				</div>
			{:else if todayExample?.success}
				<div class="space-y-4">
					<div class="rounded-lg bg-blue-50 p-4">
						<p class="text-sm font-semibold text-blue-900">Request</p>
						<code class="text-sm text-blue-700">GET /api/v1/today</code>
					</div>

					<div class="rounded-lg bg-gray-900 p-4">
						<p class="mb-2 text-sm font-semibold text-gray-400">Response</p>
						<pre class="overflow-x-auto text-xs text-green-400">{JSON.stringify(todayExample, null, 2)}</pre>
					</div>

					<div class="rounded-lg border-l-4 border-green-500 bg-green-50 p-4">
						<p class="font-semibold text-green-900">{todayExample.liturgical_day}</p>
						<p class="text-sm text-green-700">
							{todayExample.liturgical_rank} • {todayExample.liturgical_season || 'N/A'} • Year {todayExample.year_cycle}
						</p>
						<div class="mt-3 space-y-1 text-sm text-green-800">
							<p><strong>First Reading:</strong> {todayExample.readings.first_reading || 'None'}</p>
							<p><strong>Psalm:</strong> {todayExample.readings.psalm || 'None'}</p>
							{#if todayExample.readings.second_reading}
								<p><strong>Second Reading:</strong> {todayExample.readings.second_reading}</p>
							{/if}
							<p><strong>Gospel:</strong> {todayExample.readings.gospel || 'None'}</p>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Response Format -->
		<div class="mb-8 rounded-2xl bg-white p-8 shadow-lg">
			<h2 class="mb-4 text-2xl font-bold text-gray-900">Response Format</h2>

			<div class="overflow-x-auto">
				<table class="w-full text-left text-sm">
					<thead class="border-b-2 border-gray-200">
						<tr>
							<th class="pb-3 font-semibold text-gray-900">Field</th>
							<th class="pb-3 font-semibold text-gray-900">Type</th>
							<th class="pb-3 font-semibold text-gray-900">Description</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						<tr>
							<td class="py-3 font-mono text-blue-600">success</td>
							<td class="py-3 text-gray-600">boolean</td>
							<td class="py-3 text-gray-600">Whether the request was successful</td>
						</tr>
						<tr>
							<td class="py-3 font-mono text-blue-600">date</td>
							<td class="py-3 text-gray-600">string</td>
							<td class="py-3 text-gray-600">The date in YYYY-MM-DD format</td>
						</tr>
						<tr>
							<td class="py-3 font-mono text-blue-600">liturgical_day</td>
							<td class="py-3 text-gray-600">string</td>
							<td class="py-3 text-gray-600">Name of the liturgical celebration</td>
						</tr>
						<tr>
							<td class="py-3 font-mono text-blue-600">liturgical_rank</td>
							<td class="py-3 text-gray-600">string</td>
							<td class="py-3 text-gray-600">Solemnity, Feast, Sunday, Memorial, or Feria</td>
						</tr>
						<tr>
							<td class="py-3 font-mono text-blue-600">liturgical_season</td>
							<td class="py-3 text-gray-600">string</td>
							<td class="py-3 text-gray-600">Ordinary Time, Advent, Christmas, Lent, or Easter</td>
						</tr>
						<tr>
							<td class="py-3 font-mono text-blue-600">year_cycle</td>
							<td class="py-3 text-gray-600">string</td>
							<td class="py-3 text-gray-600">A, B, or C (Sunday cycle)</td>
						</tr>
						<tr>
							<td class="py-3 font-mono text-blue-600">readings</td>
							<td class="py-3 text-gray-600">object</td>
							<td class="py-3 text-gray-600">All Mass readings</td>
						</tr>
						<tr>
							<td class="py-3 pl-8 font-mono text-blue-600">first_reading</td>
							<td class="py-3 text-gray-600">string</td>
							<td class="py-3 text-gray-600">Scripture reference (e.g., "Genesis 1:1-5")</td>
						</tr>
						<tr>
							<td class="py-3 pl-8 font-mono text-blue-600">psalm</td>
							<td class="py-3 text-gray-600">string</td>
							<td class="py-3 text-gray-600">Responsorial psalm reference</td>
						</tr>
						<tr>
							<td class="py-3 pl-8 font-mono text-blue-600">second_reading</td>
							<td class="py-3 text-gray-600">string</td>
							<td class="py-3 text-gray-600">Second reading (Sundays/Solemnities only)</td>
						</tr>
						<tr>
							<td class="py-3 pl-8 font-mono text-blue-600">gospel</td>
							<td class="py-3 text-gray-600">string</td>
							<td class="py-3 text-gray-600">Gospel reference (e.g., "John 1:1-18")</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<!-- Code Examples -->
		<div class="mb-8 rounded-2xl bg-white p-8 shadow-lg">
			<h2 class="mb-4 text-2xl font-bold text-gray-900">Code Examples</h2>

			<div class="space-y-6">
				<!-- JavaScript -->
				<div>
					<h3 class="mb-2 font-semibold text-gray-800">JavaScript / Fetch</h3>
					<div class="rounded-lg bg-gray-900 p-4">
						<pre class="overflow-x-auto text-xs text-green-400"><code>{`// Get today's readings
fetch('https://yoursite.com/api/v1/today')
  .then(res => res.json())
  .then(data => {
    console.log(data.liturgical_day);
    console.log(data.readings.gospel);
  });

// Get specific date
fetch('https://yoursite.com/api/v1/readings?date=2025-12-25')
  .then(res => res.json())
  .then(data => console.log(data));`}</code></pre>
					</div>
				</div>

				<!-- cURL -->
				<div>
					<h3 class="mb-2 font-semibold text-gray-800">cURL</h3>
					<div class="rounded-lg bg-gray-900 p-4">
						<pre class="overflow-x-auto text-xs text-green-400"><code>{`curl https://yoursite.com/api/v1/today

curl https://yoursite.com/api/v1/readings?date=2025-12-25`}</code></pre>
					</div>
				</div>

				<!-- Python -->
				<div>
					<h3 class="mb-2 font-semibold text-gray-800">Python</h3>
					<div class="rounded-lg bg-gray-900 p-4">
						<pre class="overflow-x-auto text-xs text-green-400"><code>{`import requests

# Get today's readings
response = requests.get('https://yoursite.com/api/v1/today')
data = response.json()

print(data['liturgical_day'])
print(data['readings']['gospel'])`}</code></pre>
					</div>
				</div>
			</div>
		</div>

		<!-- Features -->
		<div class="mb-8 rounded-2xl bg-white p-8 shadow-lg">
			<h2 class="mb-4 text-2xl font-bold text-gray-900">Features</h2>

			<div class="grid gap-4 md:grid-cols-2">
				<div class="rounded-lg bg-green-50 p-4">
					<h3 class="mb-2 font-semibold text-green-900">✅ Completely Free</h3>
					<p class="text-sm text-green-700">No API keys, no registration, no rate limits.</p>
				</div>
				<div class="rounded-lg bg-blue-50 p-4">
					<h3 class="mb-2 font-semibold text-blue-900">🌍 CORS Enabled</h3>
					<p class="text-sm text-blue-700">Use directly from browsers and web apps.</p>
				</div>
				<div class="rounded-lg bg-purple-50 p-4">
					<h3 class="mb-2 font-semibold text-purple-900">⚡ Fast & Cached</h3>
					<p class="text-sm text-purple-700">Responses cached for optimal performance.</p>
				</div>
				<div class="rounded-lg bg-orange-50 p-4">
					<h3 class="mb-2 font-semibold text-orange-900">📅 Complete Data</h3>
					<p class="text-sm text-orange-700">All 4 readings plus liturgical metadata.</p>
				</div>
			</div>
		</div>

		<!-- Current Limitations -->
		<div class="mb-8 rounded-2xl bg-yellow-50 border border-yellow-200 p-8">
			<h2 class="mb-4 text-2xl font-bold text-yellow-900">Current Limitations (MVP)</h2>

			<ul class="list-disc space-y-2 pl-6 text-sm text-yellow-800">
				<li><strong>Region:</strong> Australian liturgical calendar only (for now)</li>
				<li><strong>Years:</strong> Currently covers 2025-2026</li>
				<li><strong>Language:</strong> English only</li>
				<li><strong>Text:</strong> Scripture references only (not full text)</li>
			</ul>

			<p class="mt-4 text-sm font-semibold text-yellow-900">Coming Soon:</p>
			<ul class="list-disc space-y-1 pl-6 text-sm text-yellow-700">
				<li>Multiple regions (USA, UK, Ireland, General Roman Calendar)</li>
				<li>Extended year coverage</li>
				<li>Calendar range queries</li>
				<li>Search functionality</li>
			</ul>
		</div>

		<!-- Use Cases -->
		<div class="mb-8 rounded-2xl bg-white p-8 shadow-lg">
			<h2 class="mb-4 text-2xl font-bold text-gray-900">Use Cases</h2>

			<div class="grid gap-4 md:grid-cols-3">
				<div class="rounded-lg border border-gray-200 p-4">
					<p class="mb-2 text-2xl">📱</p>
					<h3 class="mb-2 font-semibold text-gray-900">Mobile Apps</h3>
					<p class="text-sm text-gray-600">Daily Mass readings for Catholic apps</p>
				</div>
				<div class="rounded-lg border border-gray-200 p-4">
					<p class="mb-2 text-2xl">⛪</p>
					<h3 class="mb-2 font-semibold text-gray-900">Parish Websites</h3>
					<p class="text-sm text-gray-600">Embed today's readings automatically</p>
				</div>
				<div class="rounded-lg border border-gray-200 p-4">
					<p class="mb-2 text-2xl">🙏</p>
					<h3 class="mb-2 font-semibold text-gray-900">Prayer Apps</h3>
					<p class="text-sm text-gray-600">Lectio divina and reflection tools</p>
				</div>
			</div>
		</div>

		<!-- Footer -->
		<div class="text-center text-sm text-gray-600">
			<p>Built with ❤️ for the Catholic community</p>
			<p class="mt-2">
				<a href="https://github.com/yourusername/liturgical-api" class="text-blue-600 hover:underline">
					View on GitHub
				</a>
				•
				<a href="mailto:api@yoursite.com" class="text-blue-600 hover:underline">
					Contact
				</a>
			</p>
		</div>
	</div>
</div>

<style>
	code {
		font-family: 'Courier New', monospace;
	}
</style>
