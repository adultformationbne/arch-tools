<script>
	import { onMount, onDestroy } from 'svelte';
	import { Editor, Extension } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Underline from '@tiptap/extension-underline';
	import Placeholder from '@tiptap/extension-placeholder';
	import Link from '@tiptap/extension-link';
	import { cleanWordHtml, detectSource } from '$lib/utils/html-cleaner.js';
	import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading1, Heading2, Heading3, Link2, Undo, Redo } from '$lib/icons';
	import LinkEditorPopover from './LinkEditorPopover.svelte';

	let {
		content = $bindable(''),
		placeholder = 'Start writing...',
		editorId = undefined,
		labelledBy = undefined,
		stickyTop = '70px'
	} = $props();

	let editorEl;
	let editor = $state(null);
	let lastSetValue = '';

	// ProseMirror creates a new state object on every transaction, so tracking
	// editorState (not editor) gives Svelte 5 a genuine reference change to react to.
	let editorState = $state(null);

	const canUndo = $derived(editorState && editor ? editor.can().undo() : false);
	const canRedo = $derived(editorState && editor ? editor.can().redo() : false);
	const isBold = $derived(editorState && editor ? editor.isActive('bold') : false);
	const isItalic = $derived(editorState && editor ? editor.isActive('italic') : false);
	const isUnderline = $derived(editorState && editor ? editor.isActive('underline') : false);
	const isH1 = $derived(editorState && editor ? editor.isActive('heading', { level: 1 }) : false);
	const isH2 = $derived(editorState && editor ? editor.isActive('heading', { level: 2 }) : false);
	const isH3 = $derived(editorState && editor ? editor.isActive('heading', { level: 3 }) : false);
	const isLink = $derived(editorState && editor ? editor.isActive('link') : false);
	const isBulletList = $derived(editorState && editor ? editor.isActive('bulletList') : false);
	const isOrderedList = $derived(editorState && editor ? editor.isActive('orderedList') : false);

	// Link popover state
	let showLinkPopover = $state(false);
	let currentLinkUrl = $state('');
	let isEditingLink = $state(false);
	let linkAnchorElement = $state(null);

	// Strip all non-semantic attributes from pasted HTML so inbound styles/colors
	// don't bleed into the editor — TipTap's schema then normalises the structure.
	function stripAttributes(html) {
		if (typeof DOMParser === 'undefined') return html;
		const doc = new DOMParser().parseFromString(html, 'text/html');
		const keep = ['href', 'src', 'alt', 'title'];
		doc.querySelectorAll('*').forEach((el) => {
			Array.from(el.attributes).forEach((attr) => {
				if (!keep.includes(attr.name)) el.removeAttribute(attr.name);
			});
		});
		return doc.body.innerHTML;
	}

	// Exit an empty list item on Enter (or Backspace at start), matching email editor behaviour.
	const ListExitExtension = Extension.create({
		name: 'listExit',
		addKeyboardShortcuts() {
			return {
				Enter: ({ editor }) => {
					const { state } = editor;
					if (!state.selection.empty) return false;
					const selFrom = state.selection.$from;
					const listItemType = state.schema.nodes.listItem;
					if (!listItemType) return false;
					for (let d = selFrom.depth; d > 0; d--) {
						const node = selFrom.node(d);
						if (node.type === listItemType && node.textContent.trim().length === 0) {
							return editor.commands.liftListItem('listItem');
						}
					}
					return false;
				},
				Backspace: ({ editor }) => {
					const { state } = editor;
					if (!state.selection.empty) return false;
					if (state.selection.$from.parentOffset !== 0) return false;
					const selFrom = state.selection.$from;
					const listItemType = state.schema.nodes.listItem;
					if (!listItemType) return false;
					for (let d = selFrom.depth; d > 0; d--) {
						const node = selFrom.node(d);
						if (node.type === listItemType && node.textContent.trim().length === 0) {
							return editor.commands.liftListItem('listItem');
						}
					}
					return false;
				}
			};
		}
	});

	function toggleLink(anchorEl = null) {
		if (!editor) return;
		const { href } = editor.getAttributes('link');
		currentLinkUrl = href || '';
		isEditingLink = !!href;
		linkAnchorElement = anchorEl || editorEl;
		showLinkPopover = true;
	}

	function saveLinkUrl(url) {
		if (url) editor.chain().focus().setLink({ href: url }).run();
		showLinkPopover = false;
	}

	function removeLinkUrl() {
		editor.chain().focus().unsetLink().run();
		showLinkPopover = false;
	}

	onMount(() => {
		lastSetValue = content;

		const instance = new Editor({
			element: editorEl,
			extensions: [
				StarterKit.configure({
					heading: { levels: [1, 2, 3] }
				}),
				Underline,
				Placeholder.configure({ placeholder }),
				Link.extend({
					addKeyboardShortcuts() {
						return {
							'Mod-k': () => { toggleLink(); return true; }
						};
					}
				}).configure({ openOnClick: false }),
				ListExitExtension
			],
			content: content || '',
			onTransaction: ({ editor: e }) => {
				editorState = e.state;
			},
			onUpdate: ({ editor: e }) => {
				const html = e.getHTML();
				const normalized = html === '<p></p>' ? '' : html;
				lastSetValue = normalized;
				content = normalized;
			},
			editorProps: {
				attributes: {
					...(editorId ? { id: editorId } : {}),
					...(labelledBy ? { 'aria-labelledby': labelledBy } : {}),
					class: 'tiptap-editor-content'
				},
				handlePaste: (_view, event) => {
					const htmlData = event.clipboardData?.getData('text/html');
					if (!htmlData) return false;
					if (detectSource(htmlData) !== 'unknown') {
						event.preventDefault();
						const clean = cleanWordHtml(htmlData, { debug: false });
						instance.commands.insertContent(stripAttributes(clean));
						return true;
					}
					return false;
				},
				transformPastedHTML: (html) => stripAttributes(html)
			}
		});

		editor = instance;
	});

	onDestroy(() => {
		editor?.destroy();
	});

	// Sync when content is changed externally (e.g. parent resets the editor)
	$effect(() => {
		if (!editor || content === lastSetValue) return;
		lastSetValue = content;
		editor.commands.setContent(content || '', false);
	});
</script>

<LinkEditorPopover
	show={showLinkPopover}
	url={currentLinkUrl}
	anchorElement={linkAnchorElement}
	onSave={saveLinkUrl}
	onCancel={() => (showLinkPopover = false)}
	onRemove={isEditingLink ? removeLinkUrl : null}
/>

<div class="rich-text-editor rounded-lg shadow-sm border border-gray-200 bg-white">
	<!-- Toolbar – onmousedown preventDefault keeps focus (and selection) in the editor -->
	<div
		class="editor-toolbar flex items-center gap-1 px-4 py-2 bg-gray-50 border-b border-gray-200 sticky z-10"
		style="top: {stickyTop};"
		onmousedown={(e) => e.preventDefault()}
	>
		<!-- Undo / Redo -->
		<div class="flex border-r border-gray-300 pr-3 mr-3">
			<button
				type="button"
				onclick={() => editor?.chain().focus().undo().run()}
				disabled={!canUndo}
				class="p-2 rounded transition-colors {canUndo ? 'text-gray-700 hover:bg-gray-200' : 'text-gray-300 cursor-not-allowed'}"
				title="Undo (Ctrl+Z)"
			>
				<Undo size="16" />
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().redo().run()}
				disabled={!canRedo}
				class="p-2 rounded transition-colors {canRedo ? 'text-gray-700 hover:bg-gray-200' : 'text-gray-300 cursor-not-allowed'}"
				title="Redo (Ctrl+Y)"
			>
				<Redo size="16" />
			</button>
		</div>

		<!-- Headings -->
		<div class="flex border-r border-gray-300 pr-3 mr-3">
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
				class="p-2 rounded hover:bg-gray-200 transition-colors {isH1 ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}"
				title="Heading 1"
			>
				<Heading1 size="18" />
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
				class="p-2 rounded hover:bg-gray-200 transition-colors {isH2 ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}"
				title="Heading 2"
			>
				<Heading2 size="18" />
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
				class="p-2 rounded hover:bg-gray-200 transition-colors {isH3 ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}"
				title="Heading 3"
			>
				<Heading3 size="18" />
			</button>
		</div>

		<!-- Text formatting -->
		<div class="flex border-r border-gray-300 pr-3 mr-3">
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleBold().run()}
				class="p-2 rounded hover:bg-gray-200 transition-colors {isBold ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}"
				title="Bold (Ctrl+B)"
			>
				<Bold size="16" />
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleItalic().run()}
				class="p-2 rounded hover:bg-gray-200 transition-colors {isItalic ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}"
				title="Italic (Ctrl+I)"
			>
				<Italic size="16" />
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleUnderline().run()}
				class="p-2 rounded hover:bg-gray-200 transition-colors {isUnderline ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}"
				title="Underline (Ctrl+U)"
			>
				<UnderlineIcon size="16" />
			</button>
		</div>

		<!-- Link -->
		<div class="flex border-r border-gray-300 pr-3 mr-3">
			<button
				type="button"
				onclick={(e) => toggleLink(e.currentTarget)}
				class="p-2 rounded hover:bg-gray-200 transition-colors {isLink ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}"
				title="Link (Ctrl+K)"
			>
				<Link2 size="16" />
			</button>
		</div>

		<!-- Lists -->
		<div class="flex">
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleBulletList().run()}
				class="p-2 rounded hover:bg-gray-200 transition-colors {isBulletList ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}"
				title="Bullet List"
			>
				<List size="16" />
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleOrderedList().run()}
				class="p-2 rounded hover:bg-gray-200 transition-colors {isOrderedList ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}"
				title="Numbered List"
			>
				<ListOrdered size="16" />
			</button>
		</div>
	</div>

	<!-- TipTap mounts its editor inside this div -->
	<div bind:this={editorEl}></div>
</div>

<style>
	:global(.tiptap-editor-content) {
		padding: 2rem 3.5rem;
		min-height: 350px;
		outline: none;
		cursor: text;
		font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
			Arial, sans-serif;
		font-size: 1rem;
		color: #374151;
		line-height: 1.7;
	}

	:global(.tiptap-editor-content:focus) {
		outline: none;
	}

	:global(.tiptap-editor-content p) {
		margin-bottom: 0.75rem;
	}

	:global(.tiptap-editor-content h1) {
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1.25;
		margin-top: 1.5rem;
		margin-bottom: 0.75rem;
		color: #111827;
	}

	:global(.tiptap-editor-content h1:first-child) {
		margin-top: 0;
	}

	:global(.tiptap-editor-content h2) {
		font-size: 1.25rem;
		font-weight: 600;
		line-height: 1.35;
		margin-top: 1.25rem;
		margin-bottom: 0.5rem;
		color: #1f2937;
	}

	:global(.tiptap-editor-content h2:first-child) {
		margin-top: 0;
	}

	:global(.tiptap-editor-content h3) {
		font-size: 1.05rem;
		font-weight: 600;
		line-height: 1.4;
		margin-top: 1rem;
		margin-bottom: 0.4rem;
		color: #374151;
	}

	:global(.tiptap-editor-content h3:first-child) {
		margin-top: 0;
	}

	:global(.tiptap-editor-content ul),
	:global(.tiptap-editor-content ol) {
		padding-left: 1.75rem;
		margin-bottom: 0.75rem;
	}

	:global(.tiptap-editor-content ul) {
		list-style-type: disc;
	}

	:global(.tiptap-editor-content ol) {
		list-style-type: decimal;
	}

	:global(.tiptap-editor-content li) {
		margin-bottom: 0.35rem;
		line-height: 1.6;
	}

	:global(.tiptap-editor-content strong),
	:global(.tiptap-editor-content b) {
		font-weight: 700;
	}

	:global(.tiptap-editor-content em),
	:global(.tiptap-editor-content i) {
		font-style: italic;
	}

	:global(.tiptap-editor-content u) {
		text-decoration: underline;
	}

	:global(.tiptap-editor-content a) {
		color: #4f46e5;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	:global(.tiptap-editor-content a:hover) {
		color: #4338ca;
	}

	/* TipTap placeholder */
	:global(.tiptap-editor-content p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: #9ca3af;
		pointer-events: none;
		height: 0;
		font-style: italic;
	}
</style>
