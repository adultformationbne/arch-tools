<script>
	import { Plus, Edit3, Trash2, Save, X, FileText, Video, Link, BookOpen, Upload } from 'lucide-svelte';
	import SimplifiedRichTextEditor from './SimplifiedRichTextEditor.svelte';
	import DocumentUpload from './DocumentUpload.svelte';

	let {
		materials = [],
		onMaterialsChange = () => {},
		allowNativeContent = true,
		allowDocumentUpload = true,
		moduleId = '1',
		weekNumber = 1,
		onSaveStatusChange = () => {}
	} = $props();

	let editingMaterial = $state(null);
	let newMaterial = $state({
		type: 'video',
		title: '',
		url: '',
		content: '',
		description: ''
	});

	let showNativeEditor = $state(false);
	let showDocumentUpload = $state(false);

	const materialTypes = [
		{ value: 'video', label: 'Video (YouTube)', icon: Video },
		{ value: 'document', label: 'Document Link', icon: FileText },
		{ value: 'link', label: 'External Link', icon: Link },
		...(allowNativeContent ? [{ value: 'native', label: 'Native Content', icon: BookOpen }] : []),
		...(allowDocumentUpload ? [{ value: 'upload', label: 'Upload Document', icon: Upload }] : [])
	];

	const getMaterialIcon = (type) => {
		const typeObj = materialTypes.find(t => t.value === type);
		return typeObj ? typeObj.icon : FileText;
	};

	const addMaterial = async () => {
		console.log('Add material clicked', newMaterial);

		if (!newMaterial.title.trim()) {
			console.log('No title provided');
			return;
		}

		// For native content, we need content instead of URL
		if (newMaterial.type === 'native') {
			const textContent = newMaterial.content.replace(/<[^>]*>/g, '').trim();
			if (!textContent) {
				console.log('Native type but no content');
				return;
			}
		}

		// For uploads, we handle differently
		if (newMaterial.type === 'upload') {
			console.log('Upload type - showing modal');
			showDocumentUpload = true;
			return;
		}

		// For other types, we need a URL
		if (newMaterial.type !== 'native' && !newMaterial.url.trim()) {
			console.log('Non-native type but no URL');
			return;
		}

		try {
			onSaveStatusChange(true, 'Saving material...');

			// Prepare content based on type
			const content = newMaterial.type === 'native' ? newMaterial.content : newMaterial.url;

			const response = await fetch('/api/module-materials', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					module_id: moduleId,
					week_number: weekNumber,
					type: newMaterial.type,
					title: newMaterial.title,
					content: content,
					display_order: materials.length + 1
				})
			});

			if (response.ok) {
				const { material } = await response.json();

				// Convert database format to component format
				const newMaterialForUI = {
					id: material.id,
					type: material.type,
					title: material.title,
					url: material.type === 'native' ? '' : material.content,
					content: material.type === 'native' ? material.content : '',
					description: newMaterial.description,
					order: material.display_order
				};

				const updatedMaterials = [...materials, newMaterialForUI];
				onMaterialsChange(updatedMaterials);
				newMaterial = { type: 'video', title: '', url: '', content: '', description: '' };
				showNativeEditor = false;

				onSaveStatusChange(false, 'Saved');
				setTimeout(() => onSaveStatusChange(false, ''), 1000);
				console.log('Material added successfully');
			} else {
				const errorData = await response.json();
				console.error('Failed to add material:', errorData);
				onSaveStatusChange(false, 'Save failed');
				setTimeout(() => onSaveStatusChange(false, ''), 2000);
				alert(`Failed to add material: ${errorData.error}`);
			}
		} catch (error) {
			console.error('Error adding material:', error);
			onSaveStatusChange(false, 'Save failed');
			setTimeout(() => onSaveStatusChange(false, ''), 2000);
			alert('Failed to add material');
		}
	};

	const startEditMaterial = (material) => {
		editingMaterial = { ...material };
		if (material.type === 'native') {
			showNativeEditor = true;
		}
	};

	const saveEditMaterial = async () => {
		if (!editingMaterial) return;

		try {
			onSaveStatusChange(true, 'Updating material...');

			// Prepare content based on type
			const content = editingMaterial.type === 'native' ? editingMaterial.content : editingMaterial.url;

			const response = await fetch('/api/module-materials', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: editingMaterial.id,
					type: editingMaterial.type,
					title: editingMaterial.title,
					content: content,
					display_order: editingMaterial.order
				})
			});

			if (response.ok) {
				const { material } = await response.json();

				// Convert database format to component format and update local state
				const updatedMaterialForUI = {
					id: material.id,
					type: material.type,
					title: material.title,
					url: material.type === 'native' ? '' : material.content,
					content: material.type === 'native' ? material.content : '',
					description: editingMaterial.description,
					order: material.display_order
				};

				const updatedMaterials = materials.map(m =>
					m.id === editingMaterial.id ? updatedMaterialForUI : m
				);
				onMaterialsChange(updatedMaterials);
				editingMaterial = null;
				showNativeEditor = false;

				onSaveStatusChange(false, 'Saved');
				setTimeout(() => onSaveStatusChange(false, ''), 1000);
				console.log('Material updated successfully');
			} else {
				const errorData = await response.json();
				console.error('Failed to update material:', errorData);
				onSaveStatusChange(false, 'Save failed');
				setTimeout(() => onSaveStatusChange(false, ''), 2000);
				alert(`Failed to update material: ${errorData.error}`);
			}
		} catch (error) {
			console.error('Error updating material:', error);
			onSaveStatusChange(false, 'Save failed');
			setTimeout(() => onSaveStatusChange(false, ''), 2000);
			alert('Failed to update material');
		}
	};

	const cancelEditMaterial = () => {
		editingMaterial = null;
		showNativeEditor = false;
	};

	const deleteMaterial = async (materialId) => {
		if (!confirm('Are you sure you want to delete this material?')) {
			return;
		}

		try {
			onSaveStatusChange(true, 'Deleting material...');

			const response = await fetch('/api/module-materials', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: materialId })
			});

			if (response.ok) {
				const updatedMaterials = materials.filter(m => m.id !== materialId);
				onMaterialsChange(updatedMaterials);

				onSaveStatusChange(false, 'Deleted');
				setTimeout(() => onSaveStatusChange(false, ''), 1000);
				console.log('Material deleted successfully');
			} else {
				const errorData = await response.json();
				console.error('Failed to delete material:', errorData);
				onSaveStatusChange(false, 'Delete failed');
				setTimeout(() => onSaveStatusChange(false, ''), 2000);
				alert(`Failed to delete material: ${errorData.error}`);
			}
		} catch (error) {
			console.error('Error deleting material:', error);
			onSaveStatusChange(false, 'Delete failed');
			setTimeout(() => onSaveStatusChange(false, ''), 2000);
			alert('Failed to delete material');
		}
	};

	const moveMaterial = async (materialId, direction) => {
		const materialsCopy = [...materials];
		const index = materialsCopy.findIndex(m => m.id === materialId);

		if (direction === 'up' && index > 0) {
			[materialsCopy[index], materialsCopy[index - 1]] = [materialsCopy[index - 1], materialsCopy[index]];
		} else if (direction === 'down' && index < materialsCopy.length - 1) {
			[materialsCopy[index], materialsCopy[index + 1]] = [materialsCopy[index + 1], materialsCopy[index]];
		} else {
			return; // No change needed
		}

		// Update order numbers locally
		materialsCopy.forEach((material, i) => {
			material.order = i + 1;
		});

		// Update UI immediately for responsiveness
		onMaterialsChange(materialsCopy);

		// Update database with new ordering
		try {
			const updatePromises = materialsCopy.map(material =>
				fetch('/api/module-materials', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						id: material.id,
						display_order: material.order
					})
				})
			);

			const responses = await Promise.all(updatePromises);
			const failedUpdates = responses.filter(r => !r.ok);

			if (failedUpdates.length > 0) {
				console.error('Some material order updates failed');
				alert('Failed to update material order in database');
			} else {
				console.log('Material order updated successfully');
			}
		} catch (error) {
			console.error('Error updating material order:', error);
			alert('Failed to update material order');
		}
	};

	const handleDocumentUpload = async (uploadResults) => {
		// Add each uploaded file as a material
		for (const uploadResult of uploadResults) {
			const material = {
				id: Date.now() + Math.random(),
				type: 'document',
				title: uploadResult.name.replace(/\.[^/.]+$/, ""), // Remove extension
				url: uploadResult.url,
				description: `Uploaded document (${(uploadResult.size / 1024 / 1024).toFixed(2)} MB)`,
				order: materials.length + 1
			};

			const updatedMaterials = [...materials, material];
			onMaterialsChange(updatedMaterials);
		}

		showDocumentUpload = false;
		return uploadResults;
	};

	const handleTypeChange = (isNew = true) => {
		const material = isNew ? newMaterial : editingMaterial;
		if (!material) return;

		if (material.type === 'native') {
			showNativeEditor = true;
		} else {
			showNativeEditor = false;
		}

		if (material.type === 'upload' && isNew) {
			showDocumentUpload = true;
		}
	};

	const isAddButtonDisabled = () => {
		// Must have a title
		if (!newMaterial.title.trim()) return true;

		// For native content, check if content exists (HTML content might have tags even if empty)
		if (newMaterial.type === 'native') {
			// Check if content has actual text (strip HTML tags)
			const textContent = newMaterial.content.replace(/<[^>]*>/g, '').trim();
			if (!textContent) return true;
		}

		// For uploads, no URL validation needed (handled by upload modal)
		if (newMaterial.type === 'upload') return false;

		// For other types (video, document, link), must have URL
		if (newMaterial.type !== 'native' && !newMaterial.url.trim()) return true;

		return false;
	};
</script>

<div class="bg-white rounded-2xl p-6 shadow-sm">
	<h2 class="text-xl font-bold text-gray-800 mb-6">Materials</h2>

	<!-- Existing Materials -->
	<div class="space-y-3 mb-6">
		{#each materials as material, index}
			{#if editingMaterial && editingMaterial.id === material.id}
				<!-- Edit Mode -->
				<div class="p-4">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
						<div>
							<label class="block text-sm font-semibold text-gray-700 mb-1">Type</label>
							<select
								bind:value={editingMaterial.type}
								onchange={() => handleTypeChange(false)}
								class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:border-transparent"
								style="focus:ring-color: #c59a6b;"
							>
								{#each materialTypes as type}
									<option value={type.value}>{type.label}</option>
								{/each}
							</select>
						</div>
						<div>
							<label class="block text-sm font-semibold text-gray-700 mb-1">Title</label>
							<input
								bind:value={editingMaterial.title}
								type="text"
								class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:border-transparent"
								style="focus:ring-color: #c59a6b;"
							/>
						</div>
					</div>

					{#if editingMaterial.type === 'native' && showNativeEditor}
						<div class="mb-4">
							<label class="block text-sm font-semibold text-gray-700 mb-1">Content</label>
							<SimplifiedRichTextEditor
								bind:content={editingMaterial.content}
								placeholder="Enter your content..."
							/>
						</div>
					{:else if editingMaterial.type !== 'native'}
						<div class="mb-4">
							<label class="block text-sm font-semibold text-gray-700 mb-1">URL</label>
							<input
								bind:value={editingMaterial.url}
								type="url"
								class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:border-transparent"
								style="focus:ring-color: #c59a6b;"
							/>
						</div>
					{/if}

					<div class="mb-4">
						<label class="block text-sm font-semibold text-gray-700 mb-1">Description (optional)</label>
						<textarea
							bind:value={editingMaterial.description}
							rows="2"
							class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:border-transparent resize-none"
							style="focus:ring-color: #c59a6b;"
						></textarea>
					</div>

					<div class="flex gap-2">
						<button
							onclick={saveEditMaterial}
							class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded font-semibold hover:bg-green-700"
						>
							<Save size="16" />
							Save
						</button>
						<button
							onclick={cancelEditMaterial}
							class="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded font-semibold hover:bg-gray-600"
						>
							<X size="16" />
							Cancel
						</button>
					</div>
				</div>
			{:else}
				<!-- View Mode -->
				<div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
					<div class="flex items-center gap-3">
						<div class="flex items-center gap-2">
							<span class="text-sm font-semibold text-gray-500 w-6">{index + 1}</span>
							<svelte:component this={getMaterialIcon(material.type)} size="20" style="color: #c59a6b;" />
						</div>
						<div>
							<h3 class="font-semibold text-gray-800">{material.title}</h3>
							<p class="text-sm text-gray-600">
								{#if material.type === 'native'}
									Native content
								{:else}
									{material.url}
								{/if}
							</p>
							{#if material.description}
								<p class="text-xs text-gray-500">{material.description}</p>
							{/if}
						</div>
					</div>
					<div class="flex items-center gap-2">
						<button
							onclick={() => moveMaterial(material.id, 'up')}
							class="p-1 text-gray-500 hover:text-gray-700"
							disabled={index === 0}
						>
							↑
						</button>
						<button
							onclick={() => moveMaterial(material.id, 'down')}
							class="p-1 text-gray-500 hover:text-gray-700"
							disabled={index === materials.length - 1}
						>
							↓
						</button>
						<button
							onclick={() => startEditMaterial(material)}
							class="p-2 text-blue-600 hover:text-blue-800"
						>
							<Edit3 size="16" />
						</button>
						<button
							onclick={() => deleteMaterial(material.id)}
							class="p-2 text-red-600 hover:text-red-800"
						>
							<Trash2 size="16" />
						</button>
					</div>
				</div>
			{/if}
		{/each}

		{#if materials.length === 0}
			<div class="text-center py-8 text-gray-500">
				<FileText size="48" class="mx-auto mb-3 opacity-50" />
				<p>No materials added yet</p>
			</div>
		{/if}
	</div>

	<!-- Document Upload Modal -->
	{#if showDocumentUpload}
		<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div class="bg-white rounded-lg p-6 w-full max-w-md mx-4">
				<div class="flex items-center justify-between mb-4">
					<h3 class="text-lg font-semibold">Upload Documents</h3>
					<button
						onclick={() => showDocumentUpload = false}
						class="p-1 text-gray-500 hover:text-gray-700"
					>
						<X size="20" />
					</button>
				</div>
				<DocumentUpload
					onUpload={handleDocumentUpload}
					accept=".pdf,.doc,.docx,.txt,.md"
					multiple={true}
					{cohortId}
					{weekNumber}
				/>
			</div>
		</div>
	{/if}

	<!-- Add New Material -->
	<div class="border-t pt-6">
		<h3 class="font-semibold text-gray-800 mb-4">Add New Material</h3>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
			<div>
				<label class="block text-sm font-semibold text-gray-700 mb-1">Type</label>
				<select
					bind:value={newMaterial.type}
					onchange={() => handleTypeChange(true)}
					class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:border-transparent"
					style="focus:ring-color: #c59a6b;"
				>
					{#each materialTypes as type}
						<option value={type.value}>{type.label}</option>
					{/each}
				</select>
			</div>
			<div>
				<label class="block text-sm font-semibold text-gray-700 mb-1">Title</label>
				<input
					bind:value={newMaterial.title}
					type="text"
					placeholder="Material title"
					class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:border-transparent"
					style="focus:ring-color: #c59a6b;"
				/>
			</div>
		</div>

		{#if newMaterial.type === 'native' && showNativeEditor}
			<div class="mb-4">
				<label class="block text-sm font-semibold text-gray-700 mb-1">Content</label>
				<SimplifiedRichTextEditor
					bind:content={newMaterial.content}
					placeholder="Enter your content..."
				/>
			</div>
		{:else if newMaterial.type !== 'native' && newMaterial.type !== 'upload'}
			<div class="mb-4">
				<label class="block text-sm font-semibold text-gray-700 mb-1">URL</label>
				<input
					bind:value={newMaterial.url}
					type="url"
					placeholder="https://..."
					class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:border-transparent"
					style="focus:ring-color: #c59a6b;"
				/>
			</div>
		{/if}

		<div class="mb-4">
			<label class="block text-sm font-semibold text-gray-700 mb-1">Description (optional)</label>
			<textarea
				bind:value={newMaterial.description}
				placeholder="Brief description of this material..."
				rows="2"
				class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:border-transparent resize-none"
				style="focus:ring-color: #c59a6b;"
			></textarea>
		</div>

		<button
			onclick={addMaterial}
			class="flex items-center gap-2 px-4 py-2 font-semibold rounded-lg transition-colors {isAddButtonDisabled() ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}"
			style="background-color: #c59a6b; color: white;"
			disabled={isAddButtonDisabled()}
		>
			<Plus size="16" />
			Add Material
		</button>
	</div>
</div>