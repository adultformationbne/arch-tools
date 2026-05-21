<script>
	import Modal from './Modal.svelte';
	import PublicPageBlockRenderer from './PublicPageBlockRenderer.svelte';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import { ExternalLink } from '$lib/icons';

	let {
		isOpen = false,
		module = null,       // { id, name, order_number, public_page_content, section_name }
		session = null,      // { id, sessionNumber, title, publicPageContent } — alternative to module for session editing
		moduleOrderNumber = null,  // required when session is set, for preview link
		courseSlug = '',
		onClose = () => {},
		onSaved = () => {}   // called with updated data
	} = $props();

	let json = $state('');
	let sectionName = $state('');
	let saving = $state(false);
	let showSchema = $state(false);
	let promptCopied = $state(false);

	// Sync state when modal opens
	$effect(() => {
		if (isOpen && module) {
			json = module.public_page_content ? JSON.stringify(module.public_page_content, null, 2) : '';
			sectionName = module.section_name ?? '';
		} else if (isOpen && session) {
			json = session.publicPageContent ? JSON.stringify(session.publicPageContent, null, 2) : '';
			sectionName = '';
		}
	});

	function tryParseBlocks(str) {
		if (!str.trim()) return { blocks: [], error: null };
		try {
			const parsed = JSON.parse(str);
			if (!Array.isArray(parsed)) return { blocks: [], error: 'Must be a JSON array' };
			return { blocks: parsed, error: null };
		} catch (e) {
			return { blocks: [], error: e.message };
		}
	}

	const preview = $derived(tryParseBlocks(json));

	async function handleSave() {
		const parsed = tryParseBlocks(json);
		if (parsed.error) { toastError(parsed.error, 'Invalid JSON'); return; }

		const blocks = json.trim() ? parsed.blocks : null;
		saving = true;
		try {
			if (session) {
				const res = await fetch(`/admin/courses/${courseSlug}/sessions/api`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ sessionId: session.id, publicPageContent: blocks })
				});
				const result = await res.json();
				if (!res.ok || !result.success) throw new Error(result.error || 'Save failed');
				toastSuccess('Saved');
				onSaved({ ...session, publicPageContent: blocks });
			} else {
				const res = await fetch(`/admin/courses/${courseSlug}/modules/api`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						moduleId: module.id,
						publicPageContent: blocks,
						sectionName: sectionName.trim() || null
					})
				});
				const result = await res.json();
				if (!res.ok || !result.success) throw new Error(result.error || 'Save failed');
				toastSuccess('Saved');
				onSaved({
					...module,
					public_page_content: blocks,
					section_name: sectionName.trim() || null
				});
			}
		} catch (e) {
			toastError(e.message || 'Failed to save', 'Save Failed');
		} finally {
			saving = false;
		}
	}

	async function copyAiPrompt() {
		const materials = session?.materials ?? [];
		const schemaLines = SCHEMA_QUICK_REF.map(r => `  ${r.type}: { ${r.props} }  — ${r.note}`).join('\n');
		const materialLines = materials.length > 0
			? materials.map(m => {
				const kind = m.type === 'mux_video' ? 'video' : m.type;
				return `  { "type": "material", "materialId": "${m.id}" }  — ${m.title} (${kind})`;
			}).join('\n')
			: '  (no materials uploaded for this session)';

		const prompt = `Convert the companion guide session content below into a JSON block array.

BLOCK TYPES AVAILABLE:
${schemaLines}
  material: { materialId }  — reference an uploaded material by ID (resolved server-side)
  download: { url, title, caption? }  — external download link
  divider: {}  — visual separator

AVAILABLE MATERIALS FOR THIS SESSION:
${materialLines}

RULES:
- Output ONLY a valid JSON array. No explanation, no markdown fences.
- Use "material" blocks to reference the uploaded materials above.
- Use "scripture" for Bible references (items array of strings like "John 3:16").
- Use "questions" for discussion questions (items array of strings).
- Use "accordion" for key themes with expandable detail.

COMPANION GUIDE CONTENT TO CONVERT:
[PASTE YOUR SESSION CONTENT HERE]`;

		await navigator.clipboard.writeText(prompt);
		promptCopied = true;
		setTimeout(() => { promptCopied = false; }, 2000);
	}

	const SCHEMA_QUICK_REF = [
		{ type: 'title', props: 'content', note: 'Section heading' },
		{ type: 'text', props: 'content', note: 'Body paragraph' },
		{ type: 'note', props: 'content', note: 'Muted italic addendum/footnote' },
		{ type: 'summary', props: 'content', note: 'Highlighted callout box' },
		{ type: 'quote', props: 'content, attribution?', note: 'Pull quote / blockquote' },
		{ type: 'scripture', props: 'items[]', note: 'Scripture reference pills' },
		{ type: 'questions', props: 'items[]', note: 'Numbered discussion questions' },
		{ type: 'accordion', props: 'title, items[]{title, points[]}', note: 'Collapsible key themes' },
		{ type: 'ordered_list', props: 'items[]', note: 'Numbered steps' },
		{ type: 'unordered_list', props: 'items[]', note: 'Bullet points' },
		{ type: 'video', props: 'url, caption?', note: 'Embedded video (YouTube/Vimeo embed URL)' },
		{ type: 'image', props: 'url, caption?', note: 'Image' },
		{ type: 'download', props: 'url, title, caption?', note: 'Download/link button' },
		{ type: 'material', props: 'materialId', note: 'Reference uploaded material by ID (resolved server-side)' },
		{ type: 'divider', props: '—', note: 'Visual separator' },
	];
</script>

<Modal {isOpen} title="Edit Public Page — {session ? `Session ${session.sessionNumber}: ${session.title}` : (module?.name ?? '')}" onClose={onClose} size="xl" closeOnBackdrop={false}>
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600&display=swap" />

	<div class="editor-layout">
		<!-- Left: editor -->
		<div class="editor-pane">
			<!-- Section name (modules only) -->
			{#if !session}
			<div class="field">
				<label class="field-label" for="section-name">Section name <span class="field-optional">(optional — groups sessions in the sidebar)</span></label>
				<input
					id="section-name"
					type="text"
					bind:value={sectionName}
					placeholder="e.g. Discovering Yourself in Jesus"
					class="field-input"
				/>
			</div>
			{/if}

			<!-- JSON textarea -->
			<div class="field grow">
				<label class="field-label" for="json-content">
					Content blocks
					<span class="field-optional">(JSON array)</span>
				</label>
				<textarea
					id="json-content"
					bind:value={json}
					class="json-textarea"
					placeholder="Paste your JSON block array here…"
					spellcheck="false"
				></textarea>
			</div>

			<!-- Schema quick reference -->
			<div class="schema-section">
				<button
					type="button"
					class="schema-toggle"
					onclick={() => showSchema = !showSchema}
				>
					<span>{showSchema ? '▾' : '▸'} Block type reference</span>
				</button>
				{#if showSchema}
					<div class="schema-table">
						{#each SCHEMA_QUICK_REF as row}
							<div class="schema-row">
								<code class="schema-type">{row.type}</code>
								<code class="schema-props">{row.props}</code>
								<span class="schema-note">{row.note}</span>
							</div>
						{/each}
						<div class="schema-prompt">
							<strong>AI prompt tip:</strong> Click "Copy AI prompt" below — it includes this schema plus your session's material IDs.
							Paste the prompt into Claude or ChatGPT, add your companion guide text at the bottom, and paste the JSON result above.
						</div>
					</div>
				{/if}
			</div>

			<!-- Actions -->
			<div class="editor-actions">
				{#if session}
					<button type="button" onclick={copyAiPrompt} class="prompt-btn">
						{promptCopied ? '✓ Copied!' : 'Copy AI prompt'}
					</button>
				{/if}
				{#if session && moduleOrderNumber && json.trim()}
					<a
						href="/p/{courseSlug}/{moduleOrderNumber}/{session.sessionNumber}"
						target="_blank"
						class="preview-link"
					>
						<ExternalLink size={14} /> Preview live page
					</a>
				{:else if !session && (module?.public_page_content || json.trim())}
					<a
						href="/p/{courseSlug}/{module?.order_number}"
						target="_blank"
						class="preview-link"
					>
						<ExternalLink size={14} /> Preview live page
					</a>
				{/if}
				<button
					onclick={handleSave}
					disabled={saving}
					class="save-btn"
				>
					{saving ? 'Saving…' : 'Save'}
				</button>
			</div>
		</div>

		<!-- Right: live preview -->
		<div class="preview-pane">
			<div class="preview-header">Live preview</div>
			<div class="preview-scroll">
				{#if preview.error}
					<div class="preview-error">
						<p class="preview-error-label">JSON error</p>
						<code>{preview.error}</code>
					</div>
				{:else if preview.blocks.length === 0}
					<p class="preview-empty">Paste content blocks to see a preview.</p>
				{:else}
					<div class="preview-inner">
						<PublicPageBlockRenderer blocks={preview.blocks} />
					</div>
				{/if}			</div>
		</div>
	</div>
</Modal>

<style>
	.editor-layout {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0;
		height: 75vh;
		overflow: hidden;
	}

	/* Left pane */
	.editor-pane {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.25rem;
		border-right: 1px solid #e5e7eb;
		overflow-y: auto;
		min-height: 0;
	}

	.field { display: flex; flex-direction: column; gap: 0.3rem; }
	.field.grow { flex: 1; min-height: 0; display: flex; flex-direction: column; }
	.field-label {
		font-size: 0.75rem; font-weight: 600;
		color: #374151;
	}
	.field-optional { font-weight: 400; color: #9ca3af; }
	.field-input {
		padding: 0.5rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
		color: #111827;
		outline: none;
		transition: border-color 0.15s;
	}
	.field-input:focus { border-color: #7c6a52; }

	.json-textarea {
		flex: 1;
		min-height: 200px;
		padding: 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 0.75rem;
		line-height: 1.6;
		color: #1f2937;
		background: #f9fafb;
		resize: none;
		outline: none;
		transition: border-color 0.15s;
	}
	.json-textarea:focus { border-color: #7c6a52; background: white; }

	/* Schema reference */
	.schema-section { flex-shrink: 0; }
	.schema-toggle {
		background: none; border: none; cursor: pointer;
		font-size: 0.75rem; color: #6b7280;
		padding: 0.25rem 0; text-align: left;
	}
	.schema-toggle:hover { color: #374151; }
	.schema-table {
		margin-top: 0.5rem;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		overflow: hidden;
		font-size: 0.72rem;
	}
	.schema-row {
		display: grid;
		grid-template-columns: 110px 160px 1fr;
		gap: 0.5rem;
		padding: 0.4rem 0.75rem;
		border-bottom: 1px solid #f3f4f6;
		align-items: start;
	}
	.schema-row:last-of-type { border-bottom: none; }
	.schema-type { color: #7c3aed; font-weight: 600; }
	.schema-props { color: #0369a1; }
	.schema-note { color: #6b7280; }
	.schema-prompt {
		padding: 0.6rem 0.75rem;
		background: #f9fafb;
		border-top: 1px solid #e5e7eb;
		font-size: 0.72rem;
		color: #6b7280;
		line-height: 1.5;
	}

	/* Actions */
	.editor-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
		flex-shrink: 0;
		padding-top: 0.25rem;
	}
	.preview-link {
		display: flex; align-items: center; gap: 0.35rem;
		font-size: 0.8rem; color: #6b7280;
		text-decoration: none;
	}
	.preview-link:hover { color: #374151; }
	.prompt-btn {
		padding: 0.4rem 0.9rem;
		background: #f3f4f6; color: #374151;
		border: 1px solid #d1d5db; border-radius: 6px;
		font-size: 0.8rem; font-weight: 500;
		cursor: pointer; transition: all 0.15s;
	}
	.prompt-btn:hover { background: #e5e7eb; }
	.save-btn {
		padding: 0.5rem 1.25rem;
		background: #7c6a52; color: white;
		border: none; border-radius: 7px;
		font-size: 0.875rem; font-weight: 600;
		cursor: pointer; transition: background 0.15s;
	}
	.save-btn:hover { background: #5c4f3a; }
	.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	/* Right pane */
	.preview-pane {
		display: flex;
		flex-direction: column;
		background: #faf8f5;
		overflow: hidden;
	}
	.preview-header {
		padding: 0.6rem 1.25rem;
		font-size: 0.7rem; font-weight: 600;
		text-transform: uppercase; letter-spacing: 0.08em;
		color: #a8a29e;
		border-bottom: 1px solid #e7e5e4;
		background: white;
		flex-shrink: 0;
	}
	.preview-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
	}
	.preview-inner {
		max-width: 520px;
	}
	.preview-error {
		padding: 1rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 8px;
	}
	.preview-error-label {
		font-size: 0.75rem; font-weight: 600;
		color: #991b1b; margin-bottom: 0.3rem;
	}
	.preview-error code {
		font-size: 0.75rem; color: #b91c1c;
	}
	.preview-empty {
		font-size: 0.875rem; color: #a8a29e;
		font-style: italic; text-align: center;
		margin-top: 3rem;
	}

	@media (max-width: 768px) {
		.editor-layout {
			grid-template-columns: 1fr;
			height: auto;
		}
		.preview-pane { display: none; }
		.editor-pane { height: 60vh; }
	}
</style>
