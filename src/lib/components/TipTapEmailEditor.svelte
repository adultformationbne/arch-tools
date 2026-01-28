<script>
	import { onMount, onDestroy } from 'svelte';
	import { Editor, Extension } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Placeholder from '@tiptap/extension-placeholder';
	import Link from '@tiptap/extension-link';
	import TiptapImage from '@tiptap/extension-image';
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
		Minus,
		Image,
		Loader2
	} from '$lib/icons';
	import LinkEditorPopover from './LinkEditorPopover.svelte';
	import ButtonEditorPopover from './ButtonEditorPopover.svelte';
	import { toastError } from '$lib/utils/toast-helpers.js';

	let {
		value = '',
		onchange = (html) => {},
		placeholder = 'Write your email content...',
		availableVariables = [],
		hideVariablePicker = false,
		showFixedToolbar = false,
		verticalToolbar = false,
		accentColor = '#334642', // Button/accent color for this context
		context = 'course', // 'course', 'dgr', 'platform' - for image uploads
		contextId = null, // course ID if context is 'course'
		editor = $bindable(),
		hasSelection = $bindable(false)
	} = $props();

	let editorElement;
	let showVariableMenu = $state(false);
	let variableMenuButton;
	let textIsSelected = $state(false); // Internal state to track if text is selected

	// Image upload state
	let imageFileInput;
	let isUploadingImage = $state(false);

	// Popover state for link editing
	let showLinkPopover = $state(false);
	let currentLinkUrl = $state('');
	let isEditingLink = $state(false);
	let linkAnchorElement = $state(null);

	// Popover state for button editing
	let showButtonPopover = $state(false);
	let currentButtonText = $state('');
	let currentButtonUrl = $state('');
	let editingButtonPos = $state(null);
	let buttonAnchorElement = $state(null);

	// Track the last value we set to avoid unnecessary updates
	let lastSetValue = '';

	// Process value to convert {{variable}} syntax to Variable nodes
	function processValueForEditor(rawValue) {
		if (!rawValue) return '';

		let content = rawValue;
		const hasHtmlTags = /<[^>]+>/.test(content);

		if (!hasHtmlTags) {
			// Plain text - convert to HTML preserving line breaks
			const blocks = content.split(/\n\n+/);
			let htmlParts = [];

			for (const block of blocks) {
				if (block.trim()) {
					const lineContent = block.replace(/\n/g, '<br>');
					htmlParts.push(`<p>${lineContent}</p>`);
				} else {
					htmlParts.push('<p></p>');
				}
			}

			content = htmlParts.join('');
		}

		// Replace {{variable}} syntax with proper variable span tags
		content = content.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
			return `<span data-type="variable" data-id="${varName}" data-label="${varName}" class="variable-pill">${varName}</span>`;
		});

		return content;
	}

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
					tag: 'span[data-type="variable"]',
					getAttrs: (dom) => {
						return {
							id: dom.getAttribute('data-id'),
							label: dom.getAttribute('data-label')
						};
					}
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
					tag: 'div[data-type="email-button"]',
					getAttrs: (dom) => {
						return {
							text: dom.getAttribute('data-text') || 'Click Here',
							href: dom.getAttribute('data-href') || 'https://example.com'
						};
					}
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
				wrapper.className = 'email-button-wrapper text-center my-5';
				wrapper.setAttribute('data-type', 'email-button');

				const buttonContainer = document.createElement('div');
				buttonContainer.className = 'group relative inline-block';

				const button = document.createElement('a');
				button.href = node.attrs.href;
				button.className = 'email-button';
				// Note: background-color comes from CSS using --button-accent custom property
				button.style.cssText = 'display: inline-block; padding: 12px 32px; color: #ffffff !important; text-decoration: none !important; border-radius: 6px; font-weight: 600; font-size: 16px; cursor: default; transition: background-color 0.2s; pointer-events: none;';
				button.contentEditable = 'false';
				button.textContent = node.attrs.text;

				// Create action buttons - floats completely above and to the right
				const actionButtons = document.createElement('div');
				actionButtons.className = 'absolute -top-12 right-0 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity';
				actionButtons.contentEditable = 'false';

				// Edit button
				const editButton = document.createElement('button');
				editButton.className = 'flex items-center gap-1 bg-white rounded-lg px-3 py-1.5 shadow-lg cursor-pointer hover:bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700';
				editButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg><span>Edit</span>';

				// Go to link button
				const linkButton = document.createElement('button');
				linkButton.className = 'flex items-center gap-1 bg-white rounded-lg px-3 py-1.5 shadow-lg cursor-pointer hover:bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700';
				linkButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg><span>Link</span>';

				// Edit button click handler
				editButton.addEventListener('click', (e) => {
					e.preventDefault();
					e.stopPropagation();
					currentButtonText = node.attrs.text;
					currentButtonUrl = node.attrs.href;
					editingButtonPos = editor.view.posAtDOM(wrapper, 0);
					buttonAnchorElement = button;
					showButtonPopover = true;
				});

				// Link button click handler
				linkButton.addEventListener('click', (e) => {
					e.preventDefault();
					e.stopPropagation();
					window.open(node.attrs.href, '_blank');
				});

				actionButtons.appendChild(editButton);
				actionButtons.appendChild(linkButton);

				buttonContainer.appendChild(button);
				buttonContainer.appendChild(actionButtons);
				wrapper.appendChild(buttonContainer);
				return {
					dom: wrapper
				};
			};
		}
	});

	// Custom extension to handle exiting lists on Enter when list item is empty
	const ListExitExtension = Extension.create({
		name: 'listExit',

		addKeyboardShortcuts() {
			return {
				Enter: ({ editor }) => {
					// Check if we're in a list item
					const { state } = editor;
					const { empty } = state.selection;
					const fromPos = state.selection.$from;

					if (!empty) return false;

					// Find if we're in a listItem
					const listItemType = state.schema.nodes.listItem;

					if (!listItemType) return false;

					// Check if current node is a list item and is empty
					for (let d = fromPos.depth; d > 0; d--) {
						const node = fromPos.node(d);
						if (node.type === listItemType) {
							// Check if the list item is empty (only contains empty paragraph or is empty)
							const isEmpty = node.content.size === 0 ||
								(node.content.size === 2 && node.firstChild?.type.name === 'paragraph' && node.firstChild.content.size === 0);

							if (isEmpty) {
								// Lift out of the list
								return editor.commands.liftListItem('listItem');
							}
							break;
						}
					}

					return false;
				}
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
		// Cleanup any existing editor (helps with HMR)
		if (editor) {
			editor.destroy();
			editor = null;
		}

		// Convert existing {{variable}} syntax to Variable nodes on load
		const initialContent = processValueForEditor(value);
		lastSetValue = value;

		editor = new Editor({
			element: editorElement,
			extensions: [
				StarterKit.configure({
					heading: {
						levels: [1, 2, 3]
					}
				}),
				Placeholder.configure({ placeholder }),
				Link.extend({
					addKeyboardShortcuts() {
						return {
							'Mod-k': () => {
								// Override default prompt behavior with our modal
								toggleLink();
								return true;
							}
						};
					}
				}).configure({
					openOnClick: false
				}),
				TiptapImage.configure({
					HTMLAttributes: {
						class: 'email-image',
						'data-type': 'email-image'
					},
					allowBase64: false
				}),
				Variable,
				EmailButton,
				EmailDivider,
				ListExitExtension
			],
			content: initialContent,
			onTransaction: () => {
				editor = editor;
			},
			onSelectionUpdate: ({ editor }) => {
				// Track if there's a text selection for toolbar highlighting
				const { from, to } = editor.state.selection;
				const selected = from !== to;
				hasSelection = selected;
				textIsSelected = selected;
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
					class: 'max-w-none focus:outline-none email-editor-content'
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

	function toggleLink(anchorEl = null) {
		if (!editor) return;
		// Check if there's already a link at the current selection
		const { href } = editor.getAttributes('link');
		currentLinkUrl = href || '';
		isEditingLink = !!href;
		linkAnchorElement = anchorEl || editorElement;
		showLinkPopover = true;
	}

	function saveLinkUrl(url) {
		if (url) {
			editor.chain().focus().setLink({ href: url }).run();
		}
		showLinkPopover = false;
	}

	function removeLinkUrl() {
		editor.chain().focus().unsetLink().run();
		showLinkPopover = false;
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

	function insertButton(anchorEl = null) {
		if (!editor) return;

		// Reset state for new button
		currentButtonText = '';
		currentButtonUrl = '';
		editingButtonPos = null;
		buttonAnchorElement = anchorEl || editorElement;
		showButtonPopover = true;
	}

	function saveButton(text, url) {
		if (editingButtonPos !== null) {
			// Update existing button - find the node at the stored position
			const node = editor.state.doc.nodeAt(editingButtonPos);
			if (node && node.type.name === 'emailButton') {
				editor
					.chain()
					.focus()
					.command(({ tr }) => {
						tr.setNodeMarkup(editingButtonPos, null, { text, href: url });
						return true;
					})
					.run();
			}
			editingButtonPos = null;
		} else {
			// Insert new button
			editor
				.chain()
				.focus()
				.insertContent({
					type: 'emailButton',
					attrs: {
						text,
						href: url
					}
				})
				.run();
		}
		showButtonPopover = false;
	}

	function removeButton() {
		if (editingButtonPos !== null) {
			const node = editor.state.doc.nodeAt(editingButtonPos);
			if (node && node.type.name === 'emailButton') {
				editor
					.chain()
					.focus()
					.command(({ tr }) => {
						tr.delete(editingButtonPos, editingButtonPos + node.nodeSize);
						return true;
					})
					.run();
			}
			editingButtonPos = null;
		}
		showButtonPopover = false;
	}

	function insertDivider() {
		if (!editor) return;

		editor.chain().focus().insertContent({ type: 'emailDivider' }).run();
	}

	function triggerImageUpload() {
		imageFileInput?.click();
	}

	async function handleImageUpload(event) {
		const file = event.target.files?.[0];
		if (!file || !editor) return;

		// Validate file type
		const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
		if (!allowedTypes.includes(file.type)) {
			toastError('Please select a JPEG, PNG, GIF, or WebP image');
			return;
		}

		// Validate file size (5MB max before processing)
		if (file.size > 5 * 1024 * 1024) {
			toastError('Image must be less than 5MB');
			return;
		}

		isUploadingImage = true;

		try {
			const formData = new FormData();
			formData.append('image', file);
			formData.append('context', context);
			if (contextId) {
				formData.append('context_id', contextId);
			}

			const response = await fetch('/api/emails/upload-image', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || 'Failed to upload image');
			}

			const result = await response.json();

			// Insert the image into the editor
			editor
				.chain()
				.focus()
				.setImage({
					src: result.url,
					alt: file.name,
					title: file.name
				})
				.run();
		} catch (err) {
			console.error('Image upload error:', err);
			toastError(err.message || 'Failed to upload image');
		} finally {
			isUploadingImage = false;
			// Reset file input
			if (imageFileInput) {
				imageFileInput.value = '';
			}
		}
	}

	function toggleVariableMenu() {
		showVariableMenu = !showVariableMenu;
	}

	// Public methods that parent components can call
	export function openLinkModal(anchorEl = null) {
		toggleLink(anchorEl);
	}

	export function openButtonModal(anchorEl = null) {
		insertButton(anchorEl);
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

	// Sync editor content when value prop changes
	$effect(() => {
		if (!editor) return;

		// Get the current output (with {{variable}} syntax)
		const currentOutput = (() => {
			let html = editor.getHTML();
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, 'text/html');
			const variables = doc.querySelectorAll('[data-type="variable"]');
			variables.forEach((varElement) => {
				const id = varElement.getAttribute('data-id');
				const textNode = document.createTextNode(`{{${id}}}`);
				varElement.replaceWith(textNode);
			});
			return doc.body.innerHTML;
		})();

		// Only update if the value is actually different from what we have
		if (value !== currentOutput && value !== lastSetValue) {
			lastSetValue = value;
			const processedContent = processValueForEditor(value);
			editor.commands.setContent(processedContent, false);
		}
	});

	// Group variables by category
	const variablesByCategory = $derived.by(() => {
		return availableVariables.reduce((acc, v) => {
			if (!acc[v.category]) acc[v.category] = [];
			acc[v.category].push(v);
			return acc;
		}, {});
	});

	// Filter variables for button popover - prioritize link-related variables
	const buttonVariables = $derived.by(() => {
		const linkVars = availableVariables.filter(v =>
			v.name.toLowerCase().includes('link') ||
			v.name.toLowerCase().includes('url')
		);
		// Return link variables first, then others (up to 6 total for buttons)
		const otherVars = availableVariables.filter(v =>
			!v.name.toLowerCase().includes('link') &&
			!v.name.toLowerCase().includes('url')
		);
		return [...linkVars, ...otherVars].slice(0, 6);
	});
</script>

<!-- Popovers -->
<LinkEditorPopover
	show={showLinkPopover}
	url={currentLinkUrl}
	anchorElement={linkAnchorElement}
	onSave={saveLinkUrl}
	onCancel={() => (showLinkPopover = false)}
	onRemove={isEditingLink ? removeLinkUrl : null}
/>

<ButtonEditorPopover
	show={showButtonPopover}
	buttonText={currentButtonText}
	buttonUrl={currentButtonUrl}
	anchorElement={buttonAnchorElement}
	availableVariables={buttonVariables}
	onSave={saveButton}
	onCancel={() => (showButtonPopover = false)}
	onRemove={editingButtonPos !== null ? removeButton : null}
/>

<!-- Container -->
<div class={verticalToolbar ? 'flex' : ''} style="--button-accent: {accentColor};">
	<!-- Fixed Toolbar (optional - appears above or beside editor) -->
	{#if showFixedToolbar}
		<div class="{verticalToolbar ? 'flex flex-col items-center gap-1 p-2 bg-gray-50 border-r border-gray-200 w-14' : 'flex items-center gap-1 p-3 bg-gray-50 border-b border-gray-200 flex-wrap'}">
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

			<!-- Link (only enabled when text is selected) -->
			<button
				type="button"
				onclick={(e) => { if (textIsSelected) toggleLink(e.currentTarget); }}
				disabled={!textIsSelected}
				class="p-2 rounded transition-colors {textIsSelected ? 'hover:bg-gray-200 text-gray-700' : 'text-gray-300 cursor-not-allowed opacity-50'}"
				title={textIsSelected ? "Add Link" : "Select text to add link"}
			>
				<Link2 size={18} />
			</button>

			<div class="w-px h-6 bg-gray-300 mx-1"></div>

			<!-- Button, Image & Divider -->
			<button
				type="button"
				onclick={(e) => insertButton(e.currentTarget)}
				class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
				title="Insert Button"
			>
				<RectangleHorizontal size={18} />
			</button>
			<button
				type="button"
				onclick={triggerImageUpload}
				disabled={isUploadingImage}
				class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700 disabled:opacity-50"
				title="Insert Image"
			>
				{#if isUploadingImage}
					<Loader2 size={18} class="animate-spin" />
				{:else}
					<Image size={18} />
				{/if}
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

	<!-- Hidden file input for image uploads -->
	<input
		type="file"
		accept="image/jpeg,image/png,image/gif,image/webp"
		bind:this={imageFileInput}
		onchange={handleImageUpload}
		class="hidden"
	/>

	<!-- Editor -->
	<div bind:this={editorElement} class="bg-white min-h-[300px] cursor-text px-8 py-6"></div>

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
	:global(.email-editor-content ul) {
		color: #000000;
		font-size: 15px;
		line-height: 1.6;
		margin: 0 0 15px 0;
		padding-left: 25px;
		list-style-type: disc;
	}

	:global(.email-editor-content ol) {
		color: #000000;
		font-size: 15px;
		line-height: 1.6;
		margin: 0 0 15px 0;
		padding-left: 25px;
		list-style-type: decimal;
	}

	:global(.email-editor-content li) {
		margin-bottom: 8px;
		display: list-item;
	}

	:global(.email-editor-content ul li::marker),
	:global(.email-editor-content ol li::marker) {
		color: #374151;
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
		background-color: var(--button-accent, #334642);
		color: #ffffff;
		text-decoration: none;
		border-radius: 6px;
		font-weight: 600;
		font-size: 16px;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	:global(.email-button:hover) {
		filter: brightness(0.85);
	}

	/* Email Divider Styling */
	:global(.email-divider) {
		border: none;
		border-top: 2px solid #eae2d9;
		margin: 30px 0;
	}

	/* Email Image Styling */
	:global(.email-image) {
		max-width: 100%;
		height: auto;
		display: block;
		margin: 20px auto;
		border-radius: 4px;
	}

	:global(.email-image.ProseMirror-selectednode) {
		outline: 2px solid #334642;
		outline-offset: 2px;
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
