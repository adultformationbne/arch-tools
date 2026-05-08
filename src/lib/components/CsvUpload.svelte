<script>
	import { Upload, FileText, AlertCircle, CheckCircle, ClipboardPaste, Download } from '$lib/icons';
	import { isValidEmail } from '$lib/utils/form-validator.js';
	import {
		detectCliFormat,
		analyzeCliTicketTypes,
		translateCliRows,
		parseCSVRow
	} from '$lib/utils/cli-import.js';
	import * as XLSX from 'xlsx';

	let {
		onUpload = (data) => {},
		accept = '.csv,.xlsx,.xls',
		maxSize = 5 * 1024 * 1024, // 5MB
		disabled = false
	} = $props();

	function downloadTemplate() {
		const template = `first_name,last_name,email,phone,mailing_address,parish_community,hub,ministry_role,cohort_role,notes
Jane,Smith,jane.smith@example.com,+61 400 123 456,123 Church St Brisbane QLD 4000,St Mary's Cathedral,St Mary's Parish,Catechist,student,
John,Doe,john.doe@example.com,+61 400 789 012,45 Faith Ave Sydney NSW 2000,Holy Spirit Parish,Downtown Hub,Parish Council Chair,coordinator,Experienced facilitator
Mary,Johnson,mary.johnson@example.com,,,Our Lady of Mercy,St Mary's Parish,Reader,student,
Robert,Williams,robert.w@example.com,+61 400 555 666,,St Patrick's,Downtown Hub,,student,Joined late`;

		const blob = new Blob([template], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'participants_template.csv';
		a.click();
		URL.revokeObjectURL(url);
	}

	let dragActive = $state(false);
	/** @type {File | null} */
	let file = $state(null);
	let error = $state('');
	let warning = $state('');
	let uploading = $state(false);
	let showPasteMode = $state(false);
	let pastedText = $state('');

	// CLI mapping state
	/** @type {string[] | null} */
	let cliRawLines = $state(null);
	/** @type {import('$lib/utils/cli-import.js').CliTicketTypeInfo[]} */
	let cliTicketTypes = $state([]);
	/** @type {any} */
	let cliMappings = $state({});
	let showCliMapping = $state(false);

	const cliTotalCount = $derived(cliTicketTypes.reduce((s, t) => s + t.count, 0));

	// Upload progress animation
	let uploadProgress = $state(0);
	let uploadStatusLabel = $state('');
	let rafHandle = 0;

	const UPLOAD_STAGES = [
		{ target: 22, duration: 700,   label: 'Preparing import…' },
		{ target: 55, duration: 3500,  label: 'Checking existing accounts…' },
		{ target: 82, duration: 8000,  label: 'Enrolling participants…' },
		{ target: 93, duration: 10000, label: 'Almost there…' }
	];

	function startUploadProgress() {
		cancelAnimationFrame(rafHandle);
		uploadProgress = 0;
		uploadStatusLabel = UPLOAD_STAGES[0].label;
		let stageIdx = 0;
		let stageStart = performance.now();
		let progressAtStageStart = 0;
		function tick(now) {
			const stage = UPLOAD_STAGES[stageIdx];
			const t = Math.min((now - stageStart) / stage.duration, 1);
			const eased = 1 - (1 - t) * (1 - t);
			uploadProgress = progressAtStageStart + eased * (stage.target - progressAtStageStart);
			uploadStatusLabel = stage.label;
			if (t >= 1 && stageIdx < UPLOAD_STAGES.length - 1) {
				stageIdx++;
				stageStart = now;
				progressAtStageStart = stage.target;
			}
			rafHandle = requestAnimationFrame(tick);
		}
		rafHandle = requestAnimationFrame(tick);
	}

	function stopUploadProgress() {
		cancelAnimationFrame(rafHandle);
		rafHandle = 0;
		uploadProgress = 100;
		uploadStatusLabel = 'Done!';
	}

	// Duplicate email resolution state
	/** @type {Array<{email: string, primaryIdx: number, rows: Array<{idx: number, full_name: string, customEmail: string, skip: boolean}>}>} */
	let duplicateGroups = $state([]);
	let showDuplicateResolution = $state(false);
	/** @type {{data: any[], filename: string} | null} */
	let pendingImport = $state(null);

	/** Reads a file as CSV text, converting xlsx/xls via SheetJS if needed.
	 *  For tickets.org exports the data is in "All Event Data"; falls back to first sheet
	 *  so edited files with the other sheets deleted still work. */
	async function fileToText(f) {
		if (/\.xlsx?$/i.test(f.name)) {
			const buffer = await f.arrayBuffer();
			const workbook = XLSX.read(buffer);
			console.log('[CsvUpload] xlsx sheets:', workbook.SheetNames);
			const target = workbook.SheetNames.find(
				(n) => n.toLowerCase().replace(/\s+/g, ' ').trim() === 'all event data'
			);
			const sheetName = target ?? workbook.SheetNames[0];
			console.log('[CsvUpload] reading sheet:', sheetName);
			const sheet = workbook.Sheets[sheetName];
			return XLSX.utils.sheet_to_csv(sheet);
		}
		return f.text();
	}

	/** Removes rows where both email and name are identical — exact duplicates need no human input. */
	function autoDedupeExact(data) {
		const seen = new Set();
		let dropped = 0;
		const kept = data.filter((row) => {
			const key = `${row.email}|${row.full_name.toLowerCase().trim()}`;
			if (seen.has(key)) { dropped++; return false; }
			seen.add(key);
			return true;
		});
		return { kept, dropped };
	}

	/** Groups translated rows by email; returns only groups with 2+ different-named participants. */
	function findDuplicateGroups(data) {
		/** @type {Map<string, Array<{idx: number, full_name: string}>>} */
		const emailMap = new Map();
		data.forEach((row, idx) => {
			if (!emailMap.has(row.email)) emailMap.set(row.email, []);
			emailMap.get(row.email)?.push({ idx, full_name: row.full_name });
		});
		return [...emailMap.entries()]
			.filter(([, rows]) => rows.length > 1)
			.map(([email, rows]) => ({
				email,
				primaryIdx: 0,
				rows: rows.map((r) => ({ ...r, customEmail: '', skip: false }))
			}));
	}

	/** Called after parsing; auto-dedupes exact matches, then shows resolution step if needed. */
	async function processData(data, filename) {
		const { kept, dropped } = autoDedupeExact(data);
		if (dropped > 0) {
			console.log(`[CsvUpload] auto-removed ${dropped} exact duplicate(s) (same email + name)`);
			warning = warning
				? `${warning} ${dropped} exact duplicate${dropped === 1 ? '' : 's'} auto-removed.`
				: `${dropped} exact duplicate${dropped === 1 ? ' (same email and name)' : 's (same email and name)'} auto-removed.`;
		}

		const groups = findDuplicateGroups(kept);
		console.log(`[CsvUpload] processData: ${kept.length} rows, ${groups.length} shared-email group(s) needing resolution`);
		if (groups.length > 0) {
			groups.forEach((g) =>
				console.log(`  ↳ ${g.email}: ${g.rows.map((r) => r.full_name).join(', ')}`)
			);
			pendingImport = { data: kept, filename };
			duplicateGroups = groups;
			showDuplicateResolution = true;
		} else {
			uploading = true;
			startUploadProgress();
			console.log(`[CsvUpload] uploading ${kept.length} rows`);
			await onUpload({ filename, data: kept });
			stopUploadProgress();
			uploading = false;
		}
	}

	async function confirmDuplicates() {
		if (!pendingImport) return;

		// Validate: non-primary, non-skip rows need a valid email
		for (const group of duplicateGroups) {
			for (let i = 0; i < group.rows.length; i++) {
				if (i === group.primaryIdx) continue;
				const row = group.rows[i];
				if (row.skip) continue;
				if (!row.customEmail.trim()) {
					error = `Enter an email for ${row.full_name} or choose "Don't import"`;
					return;
				}
				if (!isValidEmail(row.customEmail.trim())) {
					error = `"${row.customEmail}" is not a valid email address`;
					return;
				}
			}
		}

		const resolved = [...pendingImport.data];
		for (const group of duplicateGroups) {
			for (let i = 0; i < group.rows.length; i++) {
				if (i === group.primaryIdx) continue;
				const row = group.rows[i];
				if (row.skip) {
					resolved[row.idx] = null;
					console.log(`[CsvUpload] skipping duplicate: ${row.full_name} (${group.email})`);
				} else {
					resolved[row.idx] = { ...resolved[row.idx], email: row.customEmail.trim().toLowerCase() };
					console.log(`[CsvUpload] reassigning email: ${row.full_name} → ${row.customEmail.trim()}`);
				}
			}
		}

		const data = resolved.filter(Boolean);
		const { filename } = pendingImport;

		showDuplicateResolution = false;
		duplicateGroups = [];
		pendingImport = null;
		error = '';

		console.log(`[CsvUpload] uploading ${data.length} rows after duplicate resolution`);
		uploading = true;
		startUploadProgress();
		await onUpload({ filename, data });
		stopUploadProgress();
		uploading = false;
	}

	function cancelDuplicates() {
		showDuplicateResolution = false;
		duplicateGroups = [];
		pendingImport = null;
		error = '';
		// Return to CLI mapping step if that's where we came from
		if (cliRawLines) {
			showCliMapping = true;
		} else {
			reset();
		}
	}

	function handleDrag(e) {
		e.preventDefault();
		e.stopPropagation();
		if (e.type === 'dragenter' || e.type === 'dragover') {
			dragActive = true;
		} else if (e.type === 'dragleave') {
			if (!e.currentTarget.contains(e.relatedTarget)) {
				dragActive = false;
			}
		}
	}

	function handleDrop(e) {
		e.preventDefault();
		e.stopPropagation();
		dragActive = false;
		if (disabled) return;
		const files = e.dataTransfer.files;
		if (files && files.length > 0) handleFile(files[0]);
	}

	function handleFileInput(e) {
		const files = e.target.files;
		if (files && files.length > 0) handleFile(files[0]);
	}

	async function handleFile(selectedFile) {
		error = '';
		console.log(`[CsvUpload] file selected: ${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)`);

		if (!selectedFile.name.match(/\.(csv|xlsx?)$/i)) {
			error = 'Please upload a CSV or Excel (.xlsx) file';
			return;
		}

		if (selectedFile.size > maxSize) {
			error = `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`;
			return;
		}

		file = selectedFile;

		try {
			const text = await fileToText(selectedFile);
			const lines = text.split(/\r?\n|\r/).filter((line) => line.trim());
			console.log(`[CsvUpload] read ${lines.length} lines`);

			if (lines.length < 2) {
				error = 'File must contain a header row and at least one data row';
				return;
			}

			if (detectCliFormat(lines[0])) {
				console.log('[CsvUpload] Tickets.org format detected');
				cliRawLines = lines;
				cliTicketTypes = analyzeCliTicketTypes(lines);
				console.log(`[CsvUpload] ticket types:`, cliTicketTypes.map((t) => `${t.ticketType} (${t.count})`));
				const mappings = {};
				for (const info of cliTicketTypes) {
					mappings[info.ticketType] = {
						isHub: info.isLikelyHub,
						hubName: info.suggestedHubName
					};
				}
				cliMappings = mappings;
				showCliMapping = true;
			} else {
				console.log('[CsvUpload] standard CSV format');
				uploading = true;
				const data = await parseCSVText(text);
				if (data) await processData(data, selectedFile.name);
				else uploading = false;
			}
		} catch (err) {
			console.error('[CsvUpload] error reading file:', err);
			error = `Failed to read file: ${err.message}`;
			uploading = false;
		}
	}

	async function confirmCliMapping() {
		if (!cliRawLines) return;

		for (const [ticketType, mapping] of Object.entries(cliMappings)) {
			if (mapping.isHub && !mapping.hubName.trim()) {
				error = `Enter a hub name for "${ticketType}" or uncheck the hub option`;
				return;
			}
		}

		error = '';
		const mappingsMap = new Map(Object.entries(cliMappings));
		console.log('[CsvUpload] CLI mappings confirmed:', Object.fromEntries(
			[...mappingsMap.entries()].filter(([, v]) => v.isHub).map(([k, v]) => [k, v.hubName])
		));

		const data = translateCliRows(cliRawLines, mappingsMap);
		console.log(`[CsvUpload] translated ${data.length} rows from CLI export`);

		if (data.length === 0) {
			error = 'No valid participants found in the file';
			return;
		}

		showCliMapping = false;
		await processData(data, file?.name ?? 'cli-import');
	}

	function cancelCliMapping() {
		showCliMapping = false;
		cliRawLines = null;
		cliTicketTypes = [];
		cliMappings = {};
		file = null;
		error = '';
	}

	async function parseCSVText(text) {
		uploading = true;
		error = '';
		warning = '';

		try {
			const lines = text.split(/\r?\n|\r/).filter((line) => line.trim());

			if (lines.length < 2) {
				error = 'CSV file must contain a header row and at least one data row';
				uploading = false;
				return;
			}

			// Detect delimiter: tab (TSV from Excel paste), then comma, semicolon, pipe
			let delimiter = ',';
			if (lines[0].includes('\t')) {
				delimiter = '\t';
			} else if (lines[0].includes(';')) {
				delimiter = ';';
			} else if (lines[0].includes('|')) {
				delimiter = '|';
			}

			// Parse header with flexible column name matching
			const splitRow = (line) =>
				delimiter === ','
					? parseCSVRow(line)
					: line.split(delimiter).map((v) => v.replace(/^["']|["']$/g, '').trim());

			const rawHeader = splitRow(lines[0]).map((h) => h.trim().toLowerCase());

			const headerMap = {
				first_name: ['first_name', 'firstname', 'first name', 'given name', 'forename'],
				last_name: ['last_name', 'lastname', 'last name', 'surname', 'family name'],
				full_name: ['full_name', 'fullname', 'name', 'full name', 'student name', 'participant name'],
				email: ['email', 'e-mail', 'email address', 'e-mail address', 'mail'],
				phone: ['phone', 'phone number', 'telephone', 'mobile', 'cell', 'contact number'],
				address: ['address', 'mailing_address', 'mailing address', 'postal address', 'street address'],
				parish_community: [
					'parish_community',
					'parish',
					'community',
					'your parish',
					'your parish or community',
					'parish/community'
				],
				parish_role: [
					'ministry_role',
					'ministry role',
					'parish_role',
					'parish role',
					'role/s in parish',
					'roles in parish',
					'parish roles',
					'ministry'
				],
				role: [
					'cohort_role',
					'cohort role',
					'role',
					'user role',
					'type',
					'user type',
					'account type',
					'participant type'
				],
				notes: ['notes', 'note', 'comments', 'comment', 'additional info', 'remarks']
			};

			const header = rawHeader.map((h) => {
				const clean = h.replace(/['"]/g, '').trim();
				for (const [standard, variations] of Object.entries(headerMap)) {
					if (variations.includes(clean)) return standard;
				}
				return clean;
			});

			const hasEmail = header.includes('email');
			const hasRole = header.includes('role');
			const hasFullName = header.includes('full_name');
			const hasFirstAndLast = header.includes('first_name') && header.includes('last_name');
			const hasAnyName = hasFullName || hasFirstAndLast || header.includes('first_name');

			const missingColumns = [];
			if (!hasEmail) missingColumns.push('email');
			if (!hasRole) missingColumns.push('cohort_role');
			if (!hasAnyName) missingColumns.push('name (full_name or first_name)');

			console.log('[CsvUpload] parsed headers:', header);
			if (missingColumns.length > 0) {
				console.warn('[CsvUpload] missing columns:', missingColumns);
				error = `Missing required columns: ${missingColumns.join(', ')}. Found columns: ${rawHeader.join(', ')}`;
				uploading = false;
				return;
			}

			const data = [];
			const errors = [];

			for (let i = 1; i < lines.length; i++) {
				const values = splitRow(lines[i]);
				const row = {};
				header.forEach((col, index) => {
					row[col] = values[index] || '';
				});

				if (!row.full_name && (row.first_name || row.last_name)) {
					row.full_name = [row.first_name, row.last_name].filter(Boolean).join(' ');
				}

				if (!row.email && !row.full_name && !row.role) continue;

				if (!row.email || !row.full_name) {
					errors.push(`Row ${i + 1}: Missing required fields (email, name)`);
					continue;
				}

				if (!isValidEmail(row.email)) {
					errors.push(`Row ${i + 1}: Invalid email format (${row.email})`);
					continue;
				}

				const roleMap = {
					participant: 'student',
					participants: 'student',
					student: 'student',
					students: 'student',
					attendee: 'student',
					member: 'student',
					'hub coordinator': 'coordinator',
					'hub-coordinator': 'coordinator',
					coordinator: 'coordinator',
					'hub leader': 'coordinator',
					leader: 'coordinator',
					facilitator: 'coordinator'
				};

				const roleLower = row.role.toLowerCase().trim();
				const normalizedRole = roleLower ? (roleMap[roleLower] || roleLower) : 'student';

				if (!['student', 'coordinator'].includes(normalizedRole)) {
					errors.push(
						`Row ${i + 1}: Invalid cohort_role "${row.role}". Must be "student" or "coordinator"`
					);
					continue;
				}

				data.push({
					email: row.email.toLowerCase().trim(),
					full_name: row.full_name.trim(),
					first_name: row.first_name ? row.first_name.trim() : null,
					last_name: row.last_name ? row.last_name.trim() : null,
					phone: row.phone ? row.phone.trim() : null,
					address: row.address ? row.address.trim() : null,
					parish_community: row.parish_community ? row.parish_community.trim() : null,
					parish_role: row.parish_role ? row.parish_role.trim() : null,
					notes: row.notes ? row.notes.trim() : null,
					role: normalizedRole,
					hub: row.hub ? row.hub.trim() : null
				});
			}

			console.log(`[CsvUpload] parsed ${data.length} valid rows, ${errors.length} skipped`);
			if (errors.length > 0) console.warn('[CsvUpload] row errors:', errors);

			if (errors.length > 0 && data.length === 0) {
				error = `All rows failed validation:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n...and ${errors.length - 5} more errors` : ''}`;
				uploading = false;
				return;
			} else if (errors.length > 0) {
				warning = `${errors.length} row${errors.length === 1 ? '' : 's'} skipped: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? ` (+${errors.length - 3} more)` : ''}`;
			}

			return data;
		} catch (err) {
			error = `Failed to parse CSV: ${err.message}`;
			uploading = false;
			throw err;
		}
	}

	async function handlePaste() {
		if (!pastedText.trim()) {
			error = 'Please paste CSV data';
			return;
		}

		try {
			console.log('[CsvUpload] processing pasted data');
			const data = await parseCSVText(pastedText);
			if (data) {
				await processData(data, 'pasted-data.csv');
			} else {
				uploading = false;
			}
			pastedText = '';
			showPasteMode = false;
		} catch (err) {
			uploading = false;
		}
	}

	function reset() {
		file = null;
		error = '';
		warning = '';
		uploading = false;
		showPasteMode = false;
		pastedText = '';
		showCliMapping = false;
		cliRawLines = null;
		cliTicketTypes = [];
		cliMappings = {};
	}

	function togglePasteMode() {
		showPasteMode = !showPasteMode;
		error = '';
		warning = '';
	}
</script>

<div class="csv-upload">
	{#if showDuplicateResolution}
		<!-- Duplicate email resolution step -->
		<div class="dup-resolution">
			<div class="dup-header">
				<AlertCircle size={18} />
				<div>
					<strong>{duplicateGroups.length} shared email {duplicateGroups.length === 1 ? 'address' : 'addresses'}</strong>
					— multiple participants registered with the same email. Choose who keeps it and enter a
					unique address for the others, or don't import them.
				</div>
			</div>

			{#each duplicateGroups as group (group.email)}
				<div class="dup-group">
					<div class="dup-group-email">{group.email}</div>
					<div class="dup-rows">
						{#each group.rows as row, i (row.idx)}
							<div class="dup-row" class:dup-row-primary={i === group.primaryIdx}>
								<button
									type="button"
									class="dup-radio"
									class:dup-radio-active={i === group.primaryIdx}
									onclick={() => { group.primaryIdx = i; }}
									title="Set as primary (keeps this email)"
								>
									{#if i === group.primaryIdx}●{:else}○{/if}
								</button>
								<span class="dup-name">{row.full_name}</span>
								{#if i === group.primaryIdx}
									<span class="dup-keeps-label">keeps {group.email}</span>
								{:else if row.skip}
									<span class="dup-skipped-label">won't be imported</span>
									<button type="button" class="dup-undo-btn" onclick={() => { row.skip = false; }}>
										Undo
									</button>
								{:else}
									<input
										type="email"
										class="dup-email-input"
										placeholder="Enter unique email"
										value={row.customEmail}
										oninput={(e) => { row.customEmail = /** @type {HTMLInputElement} */ (e.target).value; }}
									/>
									<button
										type="button"
										class="dup-skip-btn"
										onclick={() => { row.skip = true; row.customEmail = ''; }}
									>
										Don't import
									</button>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/each}

			{#if error}
				<div class="message error" style="margin: 0 16px;">
					<AlertCircle size={16} />
					<span>{error}</span>
				</div>
			{/if}

			<div class="dup-actions">
				<button type="button" onclick={confirmDuplicates} class="btn-primary" disabled={uploading}>
					{#if uploading}
						<div class="spinner"></div>
						Importing…
					{:else}
						Continue import
					{/if}
				</button>
				<button type="button" onclick={cancelDuplicates} class="btn-secondary">Back</button>
			</div>
		</div>
	{:else if showCliMapping}
		<!-- Tickets.org hub mapping UI -->
		<div class="cli-mapping">
			<div class="cli-banner">
				<CheckCircle size={16} />
				<div class="cli-banner-text">
					<strong>Tickets.org export detected</strong> — {file?.name}
				</div>
			</div>

			<p class="cli-intro">
				{cliTotalCount} participants across {cliTicketTypes.length} ticket
				{cliTicketTypes.length === 1 ? 'type' : 'types'}. Choose which ticket types represent a hub
				location — those participants will be grouped under that hub.
			</p>

			<div class="mapping-table-wrap">
				<table class="mapping-table">
					<thead>
						<tr>
							<th>Ticket Type</th>
							<th class="col-narrow col-center">Participants</th>
							<th class="col-narrow col-center">Assign to Hub?</th>
							<th>Hub Name</th>
						</tr>
					</thead>
					<tbody>
						{#each cliTicketTypes as info (info.ticketType)}
							<tr>
								<td class="cell-ticket-type">{info.ticketType}</td>
								<td class="col-narrow col-center">{info.count}</td>
								<td class="col-narrow col-center">
									<input
										type="checkbox"
										checked={cliMappings[info.ticketType]?.isHub ?? false}
										onchange={(e) => {
											const t = /** @type {HTMLInputElement} */ (e.target);
											cliMappings[info.ticketType] = {
												...cliMappings[info.ticketType],
												isHub: t.checked
											};
										}}
									/>
								</td>
								<td>
									{#if cliMappings[info.ticketType]?.isHub}
										<input
											type="text"
											class="hub-name-input"
											placeholder="Hub name"
											value={cliMappings[info.ticketType]?.hubName ?? ''}
											oninput={(e) => {
												const t = /** @type {HTMLInputElement} */ (e.target);
												cliMappings[info.ticketType] = {
													...cliMappings[info.ticketType],
													hubName: t.value
												};
											}}
										/>
									{:else}
										<span class="no-hub-label">No hub — main group</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if error}
				<div class="message error">
					<AlertCircle size={16} />
					<span>{error}</span>
				</div>
			{/if}

			<div class="mapping-actions">
				<button
					type="button"
					onclick={confirmCliMapping}
					class="btn-primary"
					disabled={uploading}
				>
					{#if uploading}
						<div class="spinner"></div>
						Processing…
					{:else}
						Import {cliTotalCount} participants
					{/if}
				</button>
				<button type="button" onclick={cancelCliMapping} class="btn-secondary">Cancel</button>
			</div>
		</div>
	{:else if !file && !showPasteMode}
		<!-- Template download -->
		<div class="template-download">
			<div class="template-text">
				<strong>Need a template?</strong> Download our CSV template with sample data.
			</div>
			<button type="button" onclick={downloadTemplate} class="btn-template">
				<Download size={16} />
				Download Template
			</button>
		</div>

		<div
			class="upload-area"
			class:drag-active={dragActive}
			class:disabled
			ondragenter={handleDrag}
			ondragover={handleDrag}
			ondragleave={handleDrag}
			ondrop={handleDrop}
			role="button"
			tabindex="0"
		>
			<input
				type="file"
				id="csv-file-input"
				accept={accept}
				onchange={handleFileInput}
				{disabled}
				style="display: none;"
			/>

			<label for="csv-file-input" class="upload-label">
				<Upload size={48} />
				<h3>Upload CSV or Excel File</h3>
				<p>Drag and drop or click to browse</p>
				<p class="format-hint">
					Accepts .csv and .xlsx — including raw tickets.org exports
				</p>
			</label>
		</div>

		<div class="divider">
			<span>OR</span>
		</div>

		<button type="button" onclick={togglePasteMode} class="btn-paste">
			<ClipboardPaste size={20} />
			Paste CSV Data
		</button>
	{:else if showPasteMode}
		<div class="paste-area">
			<h3>
				<ClipboardPaste size={24} />
				Paste CSV Data
			</h3>
			<p class="help-text">
				Copy data directly from Excel/Google Sheets and paste it here. First row should be headers:
				<strong>first_name, last_name, email, cohort_role</strong> (optional: phone, mailing_address,
				parish_community, hub, ministry_role, notes)
			</p>

			<textarea
				bind:value={pastedText}
				placeholder="Paste from Excel/Sheets (tab-separated) or type CSV:

first_name	last_name	email	phone	mailing_address	parish_community	hub	cohort_role
John	Smith	john@example.com	+61 400 123 456	123 Church St Brisbane	St Mary's Cathedral	Downtown Hub	student
Jane	Doe	jane@example.com			Holy Spirit Parish	St Mary's	coordinator"
				rows="10"
			></textarea>

			<div class="paste-actions">
				<button type="button" onclick={handlePaste} class="btn-primary" disabled={!pastedText.trim()}>
					Process CSV Data
				</button>
				<button type="button" onclick={togglePasteMode} class="btn-secondary"> Cancel </button>
			</div>
		</div>
	{:else}
		<div class="file-selected">
			<FileText size={24} />
			<div class="file-info">
				<p class="file-name">{file?.name}</p>
				<p class="file-size">{Math.round((file?.size ?? 0) / 1024)} KB</p>
			</div>
			{#if !uploading}
				<button type="button" onclick={reset} class="btn-secondary">Change File</button>
			{/if}
		</div>
	{/if}

	{#if !showCliMapping && !showDuplicateResolution}
		{#if error}
			<div class="message error">
				<AlertCircle size={20} />
				<span>{error}</span>
			</div>
		{/if}

		{#if warning}
			<div class="message warning">
				<AlertCircle size={20} />
				<span>{warning}</span>
			</div>
		{/if}

		{#if uploading}
			<div class="upload-progress-wrap">
				<div class="progress-bar-bg">
					<div
						class="progress-bar-fill"
						style="width: {uploadProgress}%"
						class:progress-bar-done={uploadProgress >= 100}
					></div>
				</div>
				<p class="progress-label">{uploadStatusLabel}</p>
			</div>
		{/if}
	{/if}
</div>

<style>
	.csv-upload {
		width: 100%;
	}

	/* ── Duplicate resolution ── */

	.dup-resolution {
		border: 1px solid #fde68a;
		border-radius: 12px;
		overflow: hidden;
	}

	.dup-header {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 14px 16px;
		background: #fffbeb;
		border-bottom: 1px solid #fde68a;
		color: #92400e;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.dup-group {
		border-bottom: 1px solid #f3f4f6;
	}

	.dup-group:last-of-type {
		border-bottom: none;
	}

	.dup-group-email {
		padding: 10px 16px 6px;
		font-size: 0.8125rem;
		font-weight: 600;
		color: #6b7280;
		font-family: monospace;
	}

	.dup-rows {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0 16px 10px;
	}

	.dup-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 10px;
		border-radius: 6px;
		background: #f9fafb;
	}

	.dup-row-primary {
		background: #f0fdf4;
	}

	.dup-radio {
		width: 20px;
		text-align: center;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 1rem;
		color: #9ca3af;
		padding: 0;
		flex-shrink: 0;
	}

	.dup-radio-active {
		color: #16a34a;
	}

	.dup-name {
		flex: 0 0 180px;
		font-size: 0.875rem;
		font-weight: 500;
		color: #1f2937;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dup-keeps-label {
		font-size: 0.8125rem;
		color: #16a34a;
		font-style: italic;
	}

	.dup-skipped-label {
		font-size: 0.8125rem;
		color: #9ca3af;
		font-style: italic;
		flex: 1;
	}

	.dup-email-input {
		flex: 1;
		padding: 6px 10px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
	}

	.dup-email-input:focus {
		outline: none;
		border-color: #6b7280;
	}

	.dup-skip-btn {
		padding: 5px 10px;
		background: none;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.8125rem;
		color: #6b7280;
		cursor: pointer;
		white-space: nowrap;
	}

	.dup-skip-btn:hover {
		background: #f3f4f6;
		color: #374151;
	}

	.dup-undo-btn {
		padding: 5px 10px;
		background: none;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.8125rem;
		color: #6b7280;
		cursor: pointer;
	}

	.dup-undo-btn:hover {
		background: #f3f4f6;
	}

	.dup-actions {
		display: flex;
		gap: 12px;
		padding: 14px 16px;
		border-top: 1px solid #f3f4f6;
	}

	/* ── CLI mapping ── */

	.cli-mapping {
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		overflow: hidden;
	}

	.cli-banner {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 16px;
		background: #f0fdf4;
		border-bottom: 1px solid #bbf7d0;
		color: #15803d;
		font-size: 0.875rem;
	}

	.cli-banner-text {
		flex: 1;
		word-break: break-all;
	}

	.cli-intro {
		margin: 0;
		padding: 14px 16px 0;
		font-size: 0.875rem;
		color: #6b7280;
		line-height: 1.5;
	}

	.mapping-table-wrap {
		overflow-x: auto;
		margin: 12px 16px 0;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
	}

	.mapping-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.mapping-table th {
		padding: 10px 12px;
		background: #f9fafb;
		border-bottom: 1px solid #e5e7eb;
		text-align: left;
		font-weight: 600;
		color: #374151;
		white-space: nowrap;
	}

	.mapping-table td {
		padding: 8px 12px;
		border-bottom: 1px solid #f3f4f6;
		color: #374151;
	}

	.mapping-table tbody tr:last-child td {
		border-bottom: none;
	}

	.mapping-table tbody tr:hover td {
		background: #f9fafb;
	}

	.col-narrow {
		width: 1%;
		white-space: nowrap;
	}

	.col-center {
		text-align: center;
	}

	.cell-ticket-type {
		font-weight: 500;
	}

	.hub-name-input {
		width: 100%;
		min-width: 160px;
		padding: 6px 10px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
		color: #1f2937;
	}

	.hub-name-input:focus {
		outline: none;
		border-color: #6b7280;
	}

	.no-hub-label {
		color: #9ca3af;
		font-size: 0.8125rem;
	}

	.mapping-actions {
		display: flex;
		gap: 12px;
		padding: 14px 16px;
	}

	/* ── Template download ── */

	.template-download {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 12px 16px;
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		margin-bottom: 16px;
	}

	.template-text {
		font-size: 0.875rem;
		color: #374151;
	}

	.template-text strong {
		font-weight: 600;
	}

	.btn-template {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		background: #374151;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s ease;
		white-space: nowrap;
	}

	.btn-template:hover {
		background: #1f2937;
	}

	/* ── Upload area ── */

	.upload-area {
		border: 2px dashed #d1d5db;
		border-radius: 12px;
		padding: 48px 24px;
		text-align: center;
		background: #f9fafb;
		transition: all 0.2s ease;
		cursor: pointer;
	}

	.upload-area:hover:not(.disabled) {
		border-color: #9ca3af;
		background: #f3f4f6;
	}

	.upload-area.drag-active {
		border-color: #6b7280;
		background: #f3f4f6;
		transform: scale(1.02);
	}

	.upload-area.drag-active * {
		pointer-events: none;
	}

	.upload-area.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.upload-label {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		cursor: pointer;
		color: #6b7280;
	}

	.upload-label h3 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: #1f2937;
	}

	.upload-label p {
		margin: 0;
		color: #6b7280;
	}

	.format-hint {
		font-size: 0.875rem;
		color: #9ca3af !important;
		margin-top: 8px !important;
	}

	.divider {
		text-align: center;
		margin: 24px 0;
		position: relative;
	}

	.divider::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		height: 1px;
		background: #e5e7eb;
	}

	.divider span {
		position: relative;
		background: white;
		padding: 0 16px;
		color: #6b7280;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.btn-paste {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 14px;
		border: 2px dashed #d1d5db;
		background: white;
		color: #374151;
		font-size: 1rem;
		font-weight: 600;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-paste:hover {
		border-color: #9ca3af;
		background: #f9fafb;
	}

	/* ── Paste area ── */

	.paste-area {
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		padding: 24px;
		background: white;
	}

	.paste-area h3 {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 0 0 12px 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: #1f2937;
	}

	.help-text {
		margin: 0 0 16px 0;
		font-size: 0.875rem;
		color: #6b7280;
		line-height: 1.5;
	}

	.help-text strong {
		color: #374151;
	}

	textarea {
		width: 100%;
		padding: 12px;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		font-family: 'Courier New', monospace;
		font-size: 0.875rem;
		resize: vertical;
		margin-bottom: 16px;
	}

	textarea:focus {
		outline: none;
		border-color: #9ca3af;
	}

	.paste-actions {
		display: flex;
		gap: 12px;
	}

	/* ── File selected ── */

	.file-selected {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 20px;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		background: #f9fafb;
	}

	.file-info {
		flex: 1;
	}

	.file-name {
		margin: 0;
		font-weight: 600;
		color: #1f2937;
	}

	.file-size {
		margin: 4px 0 0 0;
		font-size: 0.875rem;
		color: #6b7280;
	}

	/* ── Messages ── */

	.message {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border-radius: 8px;
		margin-top: 16px;
		font-size: 0.875rem;
	}

	.message.error {
		background: #fef2f2;
		color: #dc2626;
		border: 1px solid #fecaca;
	}

	.message.warning {
		background: #fffbeb;
		color: #92400e;
		border: 1px solid #fcd34d;
	}

	/* ── Upload progress bar ── */

	.upload-progress-wrap {
		margin-top: 16px;
		padding: 16px 20px;
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
	}

	.progress-bar-bg {
		height: 6px;
		background: #e5e7eb;
		border-radius: 3px;
		overflow: hidden;
		margin-bottom: 10px;
	}

	.progress-bar-fill {
		height: 100%;
		background: #374151;
		border-radius: 3px;
		transition: width 0.15s ease-out;
	}

	.progress-bar-done {
		transition: width 0.4s ease-out;
		background: #16a34a;
	}

	.progress-label {
		margin: 0;
		font-size: 0.875rem;
		color: #6b7280;
	}

	/* ── Shared buttons ── */

	.btn-primary {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px 24px;
		border: none;
		background: #374151;
		color: white;
		font-size: 1rem;
		font-weight: 600;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-primary:hover:not(:disabled) {
		background: #1f2937;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		padding: 8px 16px;
		border: 1px solid #d1d5db;
		background: #f3f4f6;
		color: #374151;
		border-radius: 6px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-secondary:hover {
		background: #e5e7eb;
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 3px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		flex-shrink: 0;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
