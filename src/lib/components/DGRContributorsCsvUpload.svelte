<script>
	import { Upload, FileText, AlertCircle, ClipboardPaste, Download, X } from '$lib/icons';
	import { isValidEmail } from '$lib/utils/form-validator.js';

	let {
		onUpload = (data) => {},
		onClose = () => {}
	} = $props();

	let dragActive = $state(false);
	let file = $state(null);
	let error = $state('');
	let uploading = $state(false);
	let showPasteMode = $state(false);
	let pastedText = $state('');
	let parsedData = $state(null);

	function handleDrag(e) {
		e.preventDefault();
		e.stopPropagation();
		if (e.type === 'dragenter' || e.type === 'dragover') {
			dragActive = true;
		} else if (e.type === 'dragleave') {
			dragActive = false;
		}
	}

	function handleDrop(e) {
		e.preventDefault();
		e.stopPropagation();
		dragActive = false;

		const files = e.dataTransfer.files;
		if (files && files.length > 0) {
			handleFile(files[0]);
		}
	}

	function handleFileInput(e) {
		const files = e.target.files;
		if (files && files.length > 0) {
			handleFile(files[0]);
		}
	}

	function handleFile(selectedFile) {
		error = '';

		if (!selectedFile.name.endsWith('.csv')) {
			error = 'Please upload a CSV file';
			return;
		}

		if (selectedFile.size > 5 * 1024 * 1024) {
			error = 'File size must be less than 5MB';
			return;
		}

		file = selectedFile;
		parseCSV(selectedFile);
	}

	async function parseCSVText(text) {
		uploading = true;
		error = '';

		try {
			const lines = text.split(/\r?\n|\r/).filter((line) => line.trim());

			if (lines.length < 2) {
				error = 'CSV must contain a header row and at least one data row';
				uploading = false;
				return null;
			}

			// Detect delimiter
			let delimiter = ',';
			if (lines[0].includes('\t')) {
				delimiter = '\t';
			} else if (lines[0].includes(';')) {
				delimiter = ';';
			}

			// Parse header
			const rawHeader = lines[0].split(delimiter).map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));

			// Map variations to standard names
			const headerMap = {
				name: ['name', 'full_name', 'fullname', 'contributor name', 'contributor'],
				email: ['email', 'e-mail', 'email address', 'mail'],
				notes: ['notes', 'note', 'comments', 'comment', 'description'],
				schedule_type: ['schedule_type', 'pattern_type', 'schedule pattern', 'pattern'],
				schedule_value: ['schedule_value', 'pattern_value', 'day', 'day_value']
			};

			const header = rawHeader.map((h) => {
				for (const [standard, variations] of Object.entries(headerMap)) {
					if (variations.includes(h)) {
						return standard;
					}
				}
				return h;
			});

			// Check required columns
			if (!header.includes('name') || !header.includes('email')) {
				error = `Missing required columns. Required: name, email. Found: ${rawHeader.join(', ')}`;
				uploading = false;
				return null;
			}

			// Parse data rows
			const data = [];
			const errors = [];

			for (let i = 1; i < lines.length; i++) {
				const values = lines[i].split(delimiter).map((v) => v.replace(/^["']|["']$/g, '').trim());
				const row = {};

				header.forEach((col, index) => {
					row[col] = values[index] || '';
				});

				// Skip empty rows
				if (!row.email && !row.name) {
					continue;
				}

				// Validate required fields
				if (!row.email || !row.name) {
					errors.push(`Row ${i + 1}: Missing required fields (name and email)`);
					continue;
				}

				// Validate email format
				if (!isValidEmail(row.email)) {
					errors.push(`Row ${i + 1}: Invalid email format (${row.email})`);
					continue;
				}

				// Build schedule_pattern if provided (supports comma-separated values like "14,31")
				let schedule_pattern = null;
				if (row.schedule_type && row.schedule_value) {
					const type = row.schedule_type.toLowerCase().trim();
					// Parse comma-separated values
					const rawValues = row.schedule_value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));

					if (type === 'day_of_month' && rawValues.length > 0) {
						const validValues = rawValues.filter(v => v >= 1 && v <= 31);
						if (validValues.length > 0) {
							schedule_pattern = { type: 'day_of_month', values: validValues };
						}
					} else if (type === 'day_of_week' && rawValues.length > 0) {
						const validValues = rawValues.filter(v => v >= 0 && v <= 6);
						if (validValues.length > 0) {
							schedule_pattern = { type: 'day_of_week', values: validValues };
						}
					}
				}

				data.push({
					name: row.name.trim(),
					email: row.email.toLowerCase().trim(),
					notes: row.notes || null,
					schedule_pattern
				});
			}

			if (errors.length > 0 && data.length === 0) {
				error = `All rows failed validation:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n...and ${errors.length - 5} more errors` : ''}`;
				uploading = false;
				return null;
			}

			uploading = false;
			return { data, errors };
		} catch (err) {
			error = `Failed to parse CSV: ${err.message}`;
			uploading = false;
			return null;
		}
	}

	async function parseCSV(csvFile) {
		try {
			const text = await csvFile.text();
			const result = await parseCSVText(text);
			if (result) {
				parsedData = result;
			}
		} catch (err) {
			uploading = false;
		}
	}

	async function handlePaste() {
		if (!pastedText.trim()) {
			error = 'Please paste CSV data';
			return;
		}

		const result = await parseCSVText(pastedText);
		if (result) {
			parsedData = result;
		}
	}

	async function confirmUpload() {
		if (!parsedData || !parsedData.data.length) return;
		uploading = true;
		await onUpload(parsedData.data);
		uploading = false;
	}

	function reset() {
		file = null;
		error = '';
		uploading = false;
		showPasteMode = false;
		pastedText = '';
		parsedData = null;
	}

	function downloadTemplate() {
		const template = `name,email,notes,schedule_type,schedule_value
Sr. Mary Catherine,mary@example.com,Writes on Marian feast days,day_of_week,1
Fr. John Smith,john@example.com,Available most weekends,day_of_month,15
Mike Humphrys,mike@example.com,Covers extra days,day_of_month,"14,31"
Deacon Thomas,thomas@example.com,Prefers Saturdays,,`;

		const blob = new Blob([template], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'dgr_contributors_template.csv';
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
	<div class="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white shadow-xl">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
			<div>
				<h2 class="text-xl font-bold text-gray-900">Import Contributors</h2>
				<p class="text-sm text-gray-500">Upload a CSV file to add multiple contributors at once</p>
			</div>
			<button onclick={onClose} class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
				<X class="h-5 w-5" />
			</button>
		</div>

		<div class="p-6">
			{#if !parsedData}
				<!-- Template download -->
				<div class="mb-6 flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3">
					<div class="text-sm text-blue-700">
						<strong>Need a template?</strong> Download our CSV template with the required columns.
					</div>
					<button
						onclick={downloadTemplate}
						class="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
					>
						<Download class="h-4 w-4" />
						Template
					</button>
				</div>

				{#if !showPasteMode}
					<!-- File upload area -->
					<div
						class="cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all {dragActive
							? 'border-blue-500 bg-blue-50'
							: 'border-gray-300 hover:border-gray-400'}"
						ondragenter={handleDrag}
						ondragover={handleDrag}
						ondragleave={handleDrag}
						ondrop={handleDrop}
						role="button"
						tabindex="0"
					>
						<input type="file" id="csv-input" accept=".csv" onchange={handleFileInput} class="hidden" />
						<label for="csv-input" class="flex cursor-pointer flex-col items-center gap-3">
							<Upload class="h-12 w-12 text-gray-400" />
							<div>
								<p class="font-medium text-gray-700">Drag and drop or click to browse</p>
								<p class="mt-1 text-sm text-gray-500">Required: name, email | Optional: notes, schedule_type, schedule_value</p>
							</div>
						</label>
					</div>

					<div class="my-6 flex items-center gap-4">
						<div class="h-px flex-1 bg-gray-200"></div>
						<span class="text-sm font-medium text-gray-500">OR</span>
						<div class="h-px flex-1 bg-gray-200"></div>
					</div>

					<button
						onclick={() => (showPasteMode = true)}
						class="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-4 font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-50"
					>
						<ClipboardPaste class="h-5 w-5" />
						Paste CSV Data
					</button>
				{:else}
					<!-- Paste mode -->
					<div class="space-y-4">
						<div class="flex items-center gap-2">
							<ClipboardPaste class="h-5 w-5 text-gray-600" />
							<h3 class="font-semibold text-gray-900">Paste CSV Data</h3>
						</div>

						<p class="text-sm text-gray-600">
							Copy from Excel/Google Sheets or paste CSV text. First row should be headers.
						</p>

						<textarea
							bind:value={pastedText}
							rows="8"
							placeholder="name,email,notes,schedule_type,schedule_value&#10;Sr. Mary,mary@example.com,Notes here,day_of_week,1"
							class="w-full rounded-lg border border-gray-300 p-3 font-mono text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
						></textarea>

						<div class="flex gap-3">
							<button
								onclick={handlePaste}
								disabled={!pastedText.trim()}
								class="flex-1 rounded-lg bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
							>
								Process Data
							</button>
							<button
								onclick={() => {
									showPasteMode = false;
									pastedText = '';
								}}
								class="rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50"
							>
								Cancel
							</button>
						</div>
					</div>
				{/if}
			{:else}
				<!-- Preview parsed data -->
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<FileText class="h-5 w-5 text-green-600" />
							<h3 class="font-semibold text-gray-900">Preview ({parsedData.data.length} contributors)</h3>
						</div>
						<button onclick={reset} class="text-sm text-blue-600 hover:text-blue-800">Choose different file</button>
					</div>

					{#if parsedData.errors.length > 0}
						<div class="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
							<strong>Warning:</strong> {parsedData.errors.length} row(s) had errors and will be skipped.
							<details class="mt-2">
								<summary class="cursor-pointer font-medium">View errors</summary>
								<ul class="mt-2 list-inside list-disc space-y-1">
									{#each parsedData.errors.slice(0, 10) as err}
										<li>{err}</li>
									{/each}
									{#if parsedData.errors.length > 10}
										<li>...and {parsedData.errors.length - 10} more</li>
									{/if}
								</ul>
							</details>
						</div>
					{/if}

					<div class="max-h-64 overflow-auto rounded-lg border border-gray-200">
						<table class="min-w-full divide-y divide-gray-200 text-sm">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-4 py-2 text-left font-medium text-gray-600">Name</th>
									<th class="px-4 py-2 text-left font-medium text-gray-600">Email</th>
									<th class="px-4 py-2 text-left font-medium text-gray-600">Schedule</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								{#each parsedData.data.slice(0, 50) as contributor}
									<tr>
										<td class="px-4 py-2 font-medium text-gray-900">{contributor.name}</td>
										<td class="px-4 py-2 text-gray-600">{contributor.email}</td>
										<td class="px-4 py-2 text-gray-500">
											{#if contributor.schedule_pattern}
												{contributor.schedule_pattern.type === 'day_of_week'
													? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][contributor.schedule_pattern.value]
													: `Day ${contributor.schedule_pattern.value}`}
											{:else}
												<span class="text-gray-400">Manual</span>
											{/if}
										</td>
									</tr>
								{/each}
								{#if parsedData.data.length > 50}
									<tr>
										<td colspan="3" class="px-4 py-2 text-center text-gray-500">
											...and {parsedData.data.length - 50} more
										</td>
									</tr>
								{/if}
							</tbody>
						</table>
					</div>

					<div class="flex gap-3 pt-4">
						<button
							onclick={confirmUpload}
							disabled={uploading}
							class="flex-1 rounded-lg bg-green-600 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-50"
						>
							{uploading ? 'Importing...' : `Import ${parsedData.data.length} Contributors`}
						</button>
						<button
							onclick={onClose}
							class="rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
						>
							Cancel
						</button>
					</div>
				</div>
			{/if}

			{#if error}
				<div class="mt-4 flex items-start gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-700">
					<AlertCircle class="h-5 w-5 flex-shrink-0" />
					<span class="whitespace-pre-line">{error}</span>
				</div>
			{/if}

			{#if uploading && !parsedData}
				<div class="mt-4 flex items-center justify-center gap-3 text-gray-600">
					<div class="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
					<span>Processing CSV...</span>
				</div>
			{/if}
		</div>
	</div>
</div>
