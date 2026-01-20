<script>
	import { Upload, FileText, AlertCircle, CheckCircle, ClipboardPaste, Download } from '$lib/icons';
	import { isValidEmail } from '$lib/utils/form-validator.js';

	let {
		onUpload = (data) => {},
		accept = '.csv',
		maxSize = 5 * 1024 * 1024, // 5MB
		disabled = false
	} = $props();

	function downloadTemplate() {
		const template = `first_name,last_name,email,phone,parish_community,hub,parish_role,role,notes
Jane,Smith,jane.smith@example.com,+61 400 123 456,St Mary's Cathedral,St Mary's Parish,Catechist,student,
John,Doe,john.doe@example.com,+61 400 789 012,Holy Spirit Parish,Downtown Hub,Parish Council Chair,coordinator,Experienced facilitator
Mary,Johnson,mary.johnson@example.com,,Our Lady of Mercy,St Mary's Parish,Reader,student,
Robert,Williams,robert.w@example.com,+61 400 555 666,St Patrick's,Downtown Hub,,student,Joined late`;

		const blob = new Blob([template], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'participants_template.csv';
		a.click();
		URL.revokeObjectURL(url);
	}

	let dragActive = $state(false);
	let file = $state(null);
	let error = $state('');
	let uploading = $state(false);
	let showPasteMode = $state(false);
	let pastedText = $state('');

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

		if (disabled) return;

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

		// Validate file type
		if (!selectedFile.name.endsWith('.csv')) {
			error = 'Please upload a CSV file';
			return;
		}

		// Validate file size
		if (selectedFile.size > maxSize) {
			error = `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`;
			return;
		}

		file = selectedFile;
		parseCSV(selectedFile);
	}

	async function parseCSVText(text) {
		uploading = true;
		error = '';

		try {
			// Handle different line endings (CRLF, LF, CR)
			const lines = text.split(/\r?\n|\r/).filter((line) => line.trim());

			if (lines.length < 2) {
				error = 'CSV file must contain a header row and at least one data row';
				uploading = false;
				return;
			}

			// Detect delimiter: try tab first (TSV from Excel), then comma, then semicolon, then pipe
			let delimiter = ',';
			if (lines[0].includes('\t')) {
				delimiter = '\t';
			} else if (lines[0].includes(';')) {
				delimiter = ';';
			} else if (lines[0].includes('|')) {
				delimiter = '|';
			}

			// Parse header with flexible column name matching
			const rawHeader = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());

			// Map various header variations to standard names
			const headerMap = {
				'first_name': ['first_name', 'firstname', 'first name', 'given name', 'forename'],
				'last_name': ['last_name', 'lastname', 'last name', 'surname', 'family name'],
				'full_name': ['full_name', 'fullname', 'name', 'full name', 'student name', 'participant name'],
				'email': ['email', 'e-mail', 'email address', 'e-mail address', 'mail'],
				'phone': ['phone', 'phone number', 'telephone', 'mobile', 'cell', 'contact number'],
				'address': ['address', 'mailing address', 'postal address', 'street address'],
				'parish_community': ['parish_community', 'parish', 'community', 'your parish', 'your parish or community', 'parish/community'],
				'hub': ['hub', 'hub name', 'hub (name)', 'location', 'group', 'site'],
				'parish_role': ['parish_role', 'parish role', 'role/s in parish', 'roles in parish', 'parish roles', 'ministry'],
				'role': ['role', 'user role', 'type', 'user type', 'account type', 'participant type'],
				'notes': ['notes', 'note', 'comments', 'comment', 'additional info', 'remarks']
			};

			// Normalize headers
			const header = rawHeader.map(h => {
				// Remove quotes and extra whitespace
				const clean = h.replace(/['"]/g, '').trim();

				// Find matching standard header
				for (const [standard, variations] of Object.entries(headerMap)) {
					if (variations.includes(clean)) {
						return standard;
					}
				}
				return clean;
			});

			// Required: email and role. Name can be full_name OR first_name+last_name
			const hasEmail = header.includes('email');
			const hasRole = header.includes('role');
			const hasFullName = header.includes('full_name');
			const hasFirstAndLast = header.includes('first_name') && header.includes('last_name');
			const hasAnyName = hasFullName || hasFirstAndLast || header.includes('first_name');

			const missingColumns = [];
			if (!hasEmail) missingColumns.push('email');
			if (!hasRole) missingColumns.push('role');
			if (!hasAnyName) missingColumns.push('name (full_name or first_name)');

			if (missingColumns.length > 0) {
				error = `Missing required columns: ${missingColumns.join(', ')}. Found columns: ${rawHeader.join(', ')}`;
				uploading = false;
				return;
			}

			// Parse data rows
			const data = [];
			const errors = [];

			for (let i = 1; i < lines.length; i++) {
				// Split and clean values (remove quotes, trim whitespace)
				const values = lines[i].split(delimiter).map((v) => v.replace(/^["']|["']$/g, '').trim());
				const row = {};

				header.forEach((col, index) => {
					row[col] = values[index] || '';
				});

				// Build full_name from first_name + last_name if not provided
				if (!row.full_name && (row.first_name || row.last_name)) {
					row.full_name = [row.first_name, row.last_name].filter(Boolean).join(' ');
				}

				// Skip completely empty rows
				if (!row.email && !row.full_name && !row.role) {
					continue;
				}

				// Basic validation - need email, some form of name, and role
				if (!row.email || !row.full_name || !row.role) {
					errors.push(`Row ${i + 1}: Missing required fields (email, name, role)`);
					continue;
				}

				// Validate email format
				if (!isValidEmail(row.email)) {
					errors.push(`Row ${i + 1}: Invalid email format (${row.email})`);
					continue;
				}

				// Normalize role with expanded variations
				// Database constraint allows: 'student', 'coordinator'
				const roleMap = {
					'participant': 'student',
					'participants': 'student',
					'student': 'student',
					'students': 'student',
					'attendee': 'student',
					'member': 'student',
					'hub coordinator': 'coordinator',
					'hub-coordinator': 'coordinator',
					'coordinator': 'coordinator',
					'hub leader': 'coordinator',
					'leader': 'coordinator',
					'facilitator': 'coordinator'
				};

				const roleLower = row.role.toLowerCase().trim();
				const normalizedRole = roleMap[roleLower] || roleLower;

				if (!['student', 'coordinator'].includes(normalizedRole)) {
					errors.push(`Row ${i + 1}: Invalid role "${row.role}". Must be "Participant" or "Hub Coordinator"`);
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

			// If we have errors but also some valid data, warn but continue
			if (errors.length > 0 && data.length === 0) {
				error = `All rows failed validation:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n...and ${errors.length - 5} more errors` : ''}`;
				uploading = false;
				return;
			} else if (errors.length > 0) {
				console.warn('Some rows had errors:', errors);
				// Continue with valid data, but log errors
			}

			return data;
		} catch (err) {
			error = `Failed to parse CSV: ${err.message}`;
			uploading = false;
			throw err;
		}
	}

	async function parseCSV(csvFile) {
		try {
			const text = await csvFile.text();
			const data = await parseCSVText(text);

			// Call the parent's onUpload handler
			await onUpload({
				filename: csvFile.name,
				data: data
			});

			uploading = false;
		} catch (err) {
			// Error already set in parseCSVText
			uploading = false;
		}
	}

	async function handlePaste() {
		if (!pastedText.trim()) {
			error = 'Please paste CSV data';
			return;
		}

		try {
			const data = await parseCSVText(pastedText);

			// Call the parent's onUpload handler
			await onUpload({
				filename: 'pasted-data.csv',
				data: data
			});

			uploading = false;
			pastedText = '';
			showPasteMode = false;
		} catch (err) {
			// Error already set in parseCSVText
			uploading = false;
		}
	}

	function reset() {
		file = null;
		error = '';
		uploading = false;
		showPasteMode = false;
		pastedText = '';
	}

	function togglePasteMode() {
		showPasteMode = !showPasteMode;
		error = '';
	}
</script>

<div class="csv-upload">
	{#if !file && !showPasteMode}
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
				<h3>Upload CSV File</h3>
				<p>Drag and drop or click to browse</p>
				<p class="format-hint">Required: first_name, last_name, email, role (optional: phone, parish, hub, notes)</p>
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
				<strong>first_name, last_name, email, role</strong> (optional: phone, parish_community, hub, parish_role, notes)
			</p>

			<textarea
				bind:value={pastedText}
				placeholder="Paste from Excel/Sheets (tab-separated) or type CSV:

first_name	last_name	email	phone	parish_community	hub	role
John	Smith	john@example.com	+61 400 123 456	St Mary's Cathedral	Downtown Hub	student
Jane	Doe	jane@example.com		Holy Spirit Parish	St Mary's	coordinator"
				rows="10"
			></textarea>

			<div class="paste-actions">
				<button type="button" onclick={handlePaste} class="btn-primary" disabled={!pastedText.trim()}>
					Process CSV Data
				</button>
				<button type="button" onclick={togglePasteMode} class="btn-secondary">
					Cancel
				</button>
			</div>
		</div>
	{:else}
		<div class="file-selected">
			<FileText size={24} />
			<div class="file-info">
				<p class="file-name">{file.name}</p>
				<p class="file-size">{Math.round(file.size / 1024)} KB</p>
			</div>
			{#if !uploading}
				<button type="button" onclick={reset} class="btn-secondary">Change File</button>
			{/if}
		</div>
	{/if}

	{#if error}
		<div class="message error">
			<AlertCircle size={20} />
			<span>{error}</span>
		</div>
	{/if}

	{#if uploading}
		<div class="message processing">
			<div class="spinner"></div>
			<span>Processing CSV...</span>
		</div>
	{/if}
</div>

<style>
	.csv-upload {
		width: 100%;
	}

	.template-download {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 12px 16px;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 8px;
		margin-bottom: 16px;
	}

	.template-text {
		font-size: 0.875rem;
		color: #1e40af;
	}

	.template-text strong {
		font-weight: 600;
	}

	.btn-template {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		background: #2563eb;
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
		background: #1d4ed8;
	}

	.upload-area {
		border: 2px dashed var(--course-accent-light);
		border-radius: 12px;
		padding: 48px 24px;
		text-align: center;
		background: var(--course-lightest);
		transition: all 0.2s ease;
		cursor: pointer;
	}

	.upload-area:hover:not(.disabled) {
		border-color: var(--course-accent-dark);
		background: var(--course-surface);
	}

	.upload-area.drag-active {
		border-color: var(--course-accent-dark);
		background: var(--course-surface);
		transform: scale(1.02);
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
		color: var(--course-accent-dark);
	}

	.upload-label h3 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--course-accent-darkest);
	}

	.upload-label p {
		margin: 0;
		color: var(--course-accent-dark);
	}

	.format-hint {
		font-size: 0.875rem;
		color: var(--course-accent-light) !important;
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
		background: var(--course-surface);
	}

	.divider span {
		position: relative;
		background: white;
		padding: 0 16px;
		color: var(--course-accent-dark);
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
		border: 2px dashed var(--course-accent-light);
		background: white;
		color: var(--course-accent-dark);
		font-size: 1rem;
		font-weight: 600;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-paste:hover {
		border-color: var(--course-accent-dark);
		background: var(--course-surface);
	}

	.paste-area {
		border: 1px solid var(--course-surface);
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
		color: var(--course-accent-darkest);
	}

	.help-text {
		margin: 0 0 16px 0;
		font-size: 0.875rem;
		color: var(--course-accent-dark);
		line-height: 1.5;
	}

	.help-text strong {
		color: var(--course-accent-light);
	}

	textarea {
		width: 100%;
		padding: 12px;
		border: 1px solid var(--course-surface);
		border-radius: 8px;
		font-family: 'Courier New', monospace;
		font-size: 0.875rem;
		resize: vertical;
		margin-bottom: 16px;
	}

	textarea:focus {
		outline: none;
		border-color: var(--course-accent-light);
	}

	.paste-actions {
		display: flex;
		gap: 12px;
	}

	.btn-primary {
		flex: 1;
		padding: 12px 24px;
		border: none;
		background: var(--course-accent-light);
		color: var(--course-accent-darkest);
		font-size: 1rem;
		font-weight: 600;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--course-accent-dark);
		color: white;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.file-selected {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 20px;
		border: 1px solid var(--course-surface);
		border-radius: 8px;
		background: var(--course-lightest);
	}

	.file-info {
		flex: 1;
	}

	.file-name {
		margin: 0;
		font-weight: 600;
		color: var(--course-accent-darkest);
	}

	.file-size {
		margin: 4px 0 0 0;
		font-size: 0.875rem;
		color: var(--course-accent-dark);
	}

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
		background: #fee;
		color: #c00;
		border: 1px solid #fcc;
	}

	.message.processing {
		background: #fef9e7;
		color: #856404;
		border: 1px solid #ffeaa7;
	}

	.btn-secondary {
		padding: 8px 16px;
		border: 1px solid var(--course-accent-light);
		background: transparent;
		color: var(--course-accent-dark);
		border-radius: 6px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-secondary:hover {
		background: var(--course-surface);
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 3px solid rgba(0, 0, 0, 0.1);
		border-top-color: var(--course-accent-light);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>