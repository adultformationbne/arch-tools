<script>
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Placeholder from '@tiptap/extension-placeholder';
	import Link from '@tiptap/extension-link';
	import BubbleMenu from '@tiptap/extension-bubble-menu';
	import { Node, mergeAttributes } from '@tiptap/core';
	import {
		Bold,
		Italic,
		List,
		ListOrdered,
		Link2,
		Heading1,
		Heading2,
		Heading3,
		Plus,
		RectangleHorizontal,
		Minus
	} from 'lucide-svelte';

	let {
		value = '',
		onchange = (html) => {},
		placeholder = 'Write your email content...',
		availableVariables = [],
		hideVariablePicker = false,
		showFixedToolbar = false
	} = $props();

	let editor;
	let editorElement;
	let bubbleMenuElement;
	let showVariableMenu = $state(false);
	let variableMenuButton;

	// Custom Variable Node Extension - Renders as pills
	const Variable = Node.create({
		name: 'variable',
		group: 'inline',
		inline: true,
		atom: true,
		selectable: true,

		addAttributes() {
			return {
				id: {
					default: null
				},
				label: {
					default: null
				}
			};
		},

		parseHTML() {
			return [
				{
					tag: 'span[data-type="variable"]'
				}
			];
		},

		renderHTML({ node }) {
			return [
				'span',
				{
					'data-type': 'variable',
					'data-id': node.attrs.id,
					'data-label': node.attrs.label,
					class: 'variable-pill'
				},
				node.attrs.id
			];
		},

		addNodeView() {
			return ({ node }) => {
				const pill = document.createElement('span');
				pill.setAttribute('data-type', 'variable');
				pill.setAttribute('data-id', node.attrs.id);
				pill.className = 'variable-pill';
				pill.contentEditable = 'false';
				pill.textContent = node.attrs.id;
				return {
					dom: pill
				};
			};
		}
	});

	// Custom Button Node Extension
	const EmailButton = Node.create({
		name: 'emailButton',
		group: 'block',
		atom: true,
		selectable: true,

		addAttributes() {
			return {
				text: {
					default: 'Click Here'
				},
				href: {
					default: 'https://example.com'
				}
			};
		},

		parseHTML() {
			return [
				{
					tag: 'div[data-type="email-button"]'
				}
			];
		},

		renderHTML({ node }) {
			return [
				'div',
				{
					'data-type': 'email-button',
					'data-text': node.attrs.text,
					'data-href': node.attrs.href,
					class: 'email-button-wrapper'
				},
				[
					'a',
					{
						href: node.attrs.href,
						class: 'email-button',
						contenteditable: 'false'
					},
					node.attrs.text
				]
			];
		},

		addNodeView() {
			return ({ node, editor }) => {
				const wrapper = document.createElement('div');
				wrapper.className = 'email-button-wrapper';
				wrapper.setAttribute('data-type', 'email-button');

				const button = document.createElement('a');
				button.href = node.attrs.href;
				button.className = 'email-button';
				button.contentEditable = 'false';
				button.textContent = node.attrs.text;

				// Make button editable on double-click
				button.addEventListener('dblclick', () => {
					const newText = prompt('Button text:', node.attrs.text);
					const newHref = prompt('Button link:', node.attrs.href);
					if (newText !== null && newHref !== null) {
						editor.commands.updateAttributes('emailButton', {
							text: newText,
							href: newHref
						});
					}
				});

				wrapper.appendChild(button);
				return {
					dom: wrapper
				};
			};
		}
	});

	// Custom Divider Node Extension
	const EmailDivider = Node.create({
		name: 'emailDivider',
		group: 'block',
		atom: true,

		parseHTML() {
			return [
				{
					tag: 'hr[data-type="email-divider"]'
				}
			];
		},

		renderHTML() {
			return [
				'hr',
				{
					'data-type': 'email-divider',
					class: 'email-divider'
				}
			];
		}
	});

	onMount(() => {
		// Convert existing {{variable}} syntax to Variable nodes on load
		let initialContent = value;
		if (initialContent) {
			// Replace {{variable}} with proper variable nodes
			const variableRegex = /\{\{(\w+)\}\}/g;
			const parts = [];
			let lastIndex = 0;
			let match;

			while ((match = variableRegex.exec(initialContent)) !== null) {
				// Add text before variable
				if (match.index > lastIndex) {
					const textBefore = initialContent.substring(lastIndex, match.index);
					if (textBefore) {
						parts.push({ type: 'text', text: textBefore });
					}
				}

				// Add variable node
				parts.push({
					type: 'variable',
					attrs: {
						id: match[1],
						label: match[1]
					}
				});

				lastIndex = match.index + match[0].length;
			}

			// Add remaining text
			if (lastIndex < initialContent.length) {
				parts.push({ type: 'text', text: initialContent.substring(lastIndex) });
			}

			// If we found variables, use structured content
			if (parts.length > 0) {
				initialContent = {
					type: 'doc',
					content: [
						{
							type: 'paragraph',
							content: parts
						}
					]
				};
			}
		}

		editor = new Editor({
			element: editorElement,
			extensions: [
				StarterKit,
				Placeholder.configure({ placeholder }),
				Link.configure({ openOnClick: false }),
				BubbleMenu.configure({
					element: bubbleMenuElement,
					tippyOptions: {
						duration: 100,
						placement: 'top'
					}
				}),
				Variable,
				EmailButton,
				EmailDivider
			],
			content: initialContent,
			onTransaction: () => {
				editor = editor;
			},
			onUpdate: ({ editor }) => {
				// Convert variable nodes back to {{syntax}} for storage
				let html = editor.getHTML();

				// Replace variable pills with {{variable}} syntax
				const parser = new DOMParser();
				const doc = parser.parseFromString(html, 'text/html');
				const variables = doc.querySelectorAll('[data-type="variable"]');

				variables.forEach((varElement) => {
					const id = varElement.getAttribute('data-id');
					const textNode = document.createTextNode(`{{${id}}}`);
					varElement.replaceWith(textNode);
				});

				html = doc.body.innerHTML;
				onchange(html);
			},
			editorProps: {
				attributes: {
					class: 'prose prose-sm max-w-none focus:outline-none email-editor-content'
				}
			}
		});
	});

	onDestroy(() => {
		if (editor) {
			editor.destroy();
		}
	});

	// Toolbar actions
	function toggleBold() {
		editor.chain().focus().toggleBold().run();
	}

	function toggleItalic() {
		editor.chain().focus().toggleItalic().run();
	}

	function toggleBulletList() {
		editor.chain().focus().toggleBulletList().run();
	}

	function toggleOrderedList() {
		editor.chain().focus().toggleOrderedList().run();
	}

	function setHeading(level) {
		editor.chain().focus().toggleHeading({ level }).run();
	}

	function toggleLink() {
		const url = window.prompt('Enter URL:');
		if (url) {
			editor.chain().focus().setLink({ href: url }).run();
		}
	}

	function insertVariable(variableId, variableLabel) {
		if (!editor) return;

		// Insert variable as a node
		editor
			.chain()
			.focus()
			.insertContent([
				{
					type: 'variable',
					attrs: {
						id: variableId,
						label: variableLabel
					}
				},
				{
					type: 'text',
					text: ' '
				}
			])
			.run();

		showVariableMenu = false;
	}

	function insertButton() {
		if (!editor) return;

		const text = prompt('Button text:', 'Click Here');
		const href = prompt('Button link (use {{variableName}} for dynamic links):', 'https://example.com');

		if (text && href) {
			editor
				.chain()
				.focus()
				.insertContent({
					type: 'emailButton',
					attrs: {
						text,
						href
					}
				})
				.run();
		}
	}

	function insertDivider() {
		if (!editor) return;

		editor.chain().focus().insertContent({ type: 'emailDivider' }).run();
	}

	function toggleVariableMenu() {
		showVariableMenu = !showVariableMenu;
	}

	// Close menu when clicking outside
	function handleClickOutside(event) {
		if (
			showVariableMenu &&
			variableMenuButton &&
			!variableMenuButton.contains(event.target) &&
			!event.target.closest('.variable-dropdown')
		) {
			showVariableMenu = false;
		}
	}

	$effect(() => {
		if (showVariableMenu) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	});

	// Group variables by category
	const variablesByCategory = $derived(() => {
		return availableVariables.reduce((acc, v) => {
			if (!acc[v.category]) acc[v.category] = [];
			acc[v.category].push(v);
			return acc;
		}, {});
	});
</script>

<!-- Container -->
<div>
	<!-- Fixed Toolbar (optional - appears above editor) -->
	{#if showFixedToolbar}
		<div class="flex items-center gap-1 p-3 bg-gray-50 border-b border-gray-200 flex-wrap">
			<!-- Text formatting -->
			<button
				type="button"
				onclick={toggleBold}
				class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
				title="Bold"
			>
				<Bold size={18} />
			</button>
			<button
				type="button"
				onclick={toggleItalic}
				class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
				title="Italic"
			>
				<Italic size={18} />
			</button>

			<div class="w-px h-6 bg-gray-300 mx-1"></div>

			<!-- Headings -->
			<button
				type="button"
				onclick={() => setHeading(1)}
				class="px-3 py-2 hover:bg-gray-200 rounded transition-colors text-gray-700 text-sm font-semibold"
				title="Heading 1"
			>
				H1
			</button>
			<button
				type="button"
				onclick={() => setHeading(2)}
				class="px-3 py-2 hover:bg-gray-200 rounded transition-colors text-gray-700 text-sm font-semibold"
				title="Heading 2"
			>
				H2
			</button>
			<button
				type="button"
				onclick={() => setHeading(3)}
				class="px-3 py-2 hover:bg-gray-200 rounded transition-colors text-gray-700 text-sm font-semibold"
				title="Heading 3"
			>
				H3
			</button>

			<div class="w-px h-6 bg-gray-300 mx-1"></div>

			<!-- Lists -->
			<button
				type="button"
				onclick={toggleBulletList}
				class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
				title="Bullet List"
			>
				<List size={18} />
			</button>
			<button
				type="button"
				onclick={toggleOrderedList}
				class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
				title="Numbered List"
			>
				<ListOrdered size={18} />
			</button>

			<div class="w-px h-6 bg-gray-300 mx-1"></div>

			<!-- Link -->
			<button
				type="button"
				onclick={toggleLink}
				class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
				title="Add Link"
			>
				<Link2 size={18} />
			</button>

			<div class="w-px h-6 bg-gray-300 mx-1"></div>

			<!-- Button & Divider -->
			<button
				type="button"
				onclick={insertButton}
				class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
				title="Insert Button"
			>
				<RectangleHorizontal size={18} />
			</button>
			<button
				type="button"
				onclick={insertDivider}
				class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
				title="Insert Divider"
			>
				<Minus size={18} />
			</button>
		</div>
	{/if}

	<!-- Floating Bubble Menu (appears on text selection) -->
	<div bind:this={bubbleMenuElement} class="bubble-menu">
		<div class="flex items-center gap-0.5 bg-gray-900 rounded-lg shadow-2xl p-1">
			<!-- Text formatting -->
			<button
				type="button"
				onclick={toggleBold}
				class="p-2 hover:bg-gray-700 rounded transition-colors text-white"
				title="Bold"
			>
				<Bold size={16} />
			</button>
			<button
				type="button"
				onclick={toggleItalic}
				class="p-2 hover:bg-gray-700 rounded transition-colors text-white"
				title="Italic"
			>
				<Italic size={16} />
			</button>

			<div class="w-px h-6 bg-gray-600 mx-1"></div>

			<!-- Headings -->
			<button
				type="button"
				onclick={() => setHeading(1)}
				class="px-2.5 py-2 hover:bg-gray-700 rounded transition-colors text-white text-xs font-semibold"
				title="Heading 1"
			>
				H1
			</button>
			<button
				type="button"
				onclick={() => setHeading(2)}
				class="px-2.5 py-2 hover:bg-gray-700 rounded transition-colors text-white text-xs font-semibold"
				title="Heading 2"
			>
				H2
			</button>
			<button
				type="button"
				onclick={() => setHeading(3)}
				class="px-2.5 py-2 hover:bg-gray-700 rounded transition-colors text-white text-xs font-semibold"
				title="Heading 3"
			>
				H3
			</button>

			<div class="w-px h-6 bg-gray-600 mx-1"></div>

			<!-- Lists -->
			<button
				type="button"
				onclick={toggleBulletList}
				class="p-2 hover:bg-gray-700 rounded transition-colors text-white"
				title="Bullet List"
			>
				<List size={16} />
			</button>
			<button
				type="button"
				onclick={toggleOrderedList}
				class="p-2 hover:bg-gray-700 rounded transition-colors text-white"
				title="Numbered List"
			>
				<ListOrdered size={16} />
			</button>

			<div class="w-px h-6 bg-gray-600 mx-1"></div>

			<!-- Link -->
			<button
				type="button"
				onclick={toggleLink}
				class="p-2 hover:bg-gray-700 rounded transition-colors text-white"
				title="Add Link"
			>
				<Link2 size={16} />
			</button>
		</div>
	</div>

	<!-- Editor -->
	<div bind:this={editorElement} class="bg-white min-h-[300px] cursor-text px-6 py-6"></div>

	<!-- Variable Pills Below Editor (conditionally hidden) -->
	{#if !hideVariablePicker && availableVariables.length > 0}
		<div class="pt-2 border-t border-gray-200">
			<p class="text-xs text-gray-500 mb-2">Click to insert variable:</p>
			<div class="flex flex-wrap gap-2">
				{#each availableVariables.slice(0, 12) as variable}
					<button
						type="button"
						onclick={() => insertVariable(variable.name, variable.description)}
						class="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium transition-all hover:scale-105 variable-picker-pill"
						title={variable.description}
					>
						{variable.name}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	/* Editor styling - Comfortable editing experience
	   MJML handles final email rendering, so no need for exact matches! */
	:global(.email-editor-content) {
		color: #000000;
		font-size: 15px;
		line-height: 1.6;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background-color: #ffffff;
	}

	/* Heading styles - approximate email appearance for editing comfort */
	:global(.email-editor-content h1) {
		color: #1e2322;
		font-size: 24px;
		font-weight: 700;
		margin: 0 0 20px 0;
		line-height: 1.3;
	}

	:global(.email-editor-content h2) {
		color: #334642;
		font-size: 20px;
		font-weight: 600;
		margin: 30px 0 15px 0;
		line-height: 1.3;
	}

	:global(.email-editor-content h3) {
		color: #334642;
		font-size: 16px;
		font-weight: 600;
		margin: 20px 0 10px 0;
		line-height: 1.3;
	}

	/* Text styles */
	:global(.email-editor-content p) {
		color: #000000;
		font-size: 15px;
		line-height: 1.6;
		margin: 0 0 15px 0;
	}

	/* Lists */
	:global(.email-editor-content ul),
	:global(.email-editor-content ol) {
		color: #000000;
		font-size: 15px;
		line-height: 1.6;
		margin: 0 0 15px 0;
		padding-left: 25px;
	}

	:global(.email-editor-content li) {
		margin-bottom: 8px;
	}

	/* Links */
	:global(.email-editor-content a) {
		color: #334642;
		text-decoration: underline;
	}

	/* Strong */
	:global(.email-editor-content strong) {
		font-weight: 600;
		color: #000000;
	}

	/* Variable pills in editor - Simple gray */
	:global(.variable-pill) {
		display: inline-flex;
		align-items: center;
		padding: 2px 8px;
		margin: 0 2px;
		background: #e5e7eb;
		color: #374151;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Courier New', monospace;
		font-size: 13px;
		font-weight: 500;
		cursor: default;
		user-select: none;
		text-transform: lowercase;
	}

	:global(.variable-pill::before) {
		content: '{ ';
		opacity: 0.4;
		font-size: 11px;
	}

	:global(.variable-pill::after) {
		content: ' }';
		opacity: 0.4;
		font-size: 11px;
	}

	/* Variable picker pills below editor */
	.variable-picker-pill {
		background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
		color: #374151;
		border: 1px solid #d1d5db;
	}

	.variable-picker-pill:hover {
		background: linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%);
		color: #6b21a8;
		border-color: #a855f7;
	}

	/* Email Button Styling */
	:global(.email-button-wrapper) {
		text-align: center;
		margin: 20px 0;
	}

	:global(.email-button) {
		display: inline-block;
		padding: 12px 32px;
		background-color: #334642;
		color: #ffffff;
		text-decoration: none;
		border-radius: 6px;
		font-weight: 600;
		font-size: 16px;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	:global(.email-button:hover) {
		background-color: #1e2322;
	}

	/* Email Divider Styling */
	:global(.email-divider) {
		border: none;
		border-top: 2px solid #eae2d9;
		margin: 30px 0;
	}

	:global(.ProseMirror p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: #9ca3af;
		pointer-events: none;
		height: 0;
	}

	:global(.ProseMirror:focus) {
		outline: none;
	}

	/* Bubble Menu Styling */
	.bubble-menu {
		visibility: hidden;
		opacity: 0;
		transition: opacity 0.2s ease, visibility 0.2s ease;
	}

	:global(.bubble-menu.is-active) {
		visibility: visible;
		opacity: 1;
	}

	/* Variable dropdown positioning */
	.variable-dropdown {
		animation: slideDown 0.15s ease-out;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
