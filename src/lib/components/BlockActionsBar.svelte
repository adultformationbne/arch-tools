<script>
	import {
		Eye,
		EyeOff,
		Edit,
		Trash2,
		ChevronUp,
		ChevronDown,
		History,
		Move,
		Copy,
		Archive
	} from 'lucide-svelte';
	import Button from '$lib/design-system/Button.svelte';

	let {
		block,
		index = 0,
		totalBlocks = 0,
		onEdit = () => {},
		onToggleVisibility = () => {},
		onDelete = () => {},
		onMove = () => {},
		onShowVersionHistory = () => {},
		onDuplicate = () => {},
		compact = false
	} = $props();

	const canMoveUp = index > 0;
	const canMoveDown = index < totalBlocks - 1;

	function handleMove(direction) {
		onMove(block.id, direction);
	}

	function handleEdit() {
		onEdit(block);
	}

	function handleToggleVisibility() {
		onToggleVisibility(block.id);
	}

	function handleDelete() {
		onDelete(block.id);
	}

	function handleVersionHistory() {
		onShowVersionHistory(block);
	}

	function handleDuplicate() {
		onDuplicate(block);
	}
</script>

{#if compact}
	<!-- Compact horizontal layout for list views -->
	<div class="flex items-center gap-1 rounded-lg bg-gray-50 p-1">
		<Button
			variant="ghost"
			size="xs"
			icon={Edit}
			onclick={handleEdit}
			class="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
			title="Edit Block"
		/>

		<Button
			variant="ghost"
			size="xs"
			icon={History}
			onclick={handleVersionHistory}
			class="text-purple-600 hover:bg-purple-50 hover:text-purple-700"
			title="Version History"
		/>

		<Button
			variant="ghost"
			size="xs"
			icon={block.isVisible ? Eye : EyeOff}
			onclick={handleToggleVisibility}
			class={block.isVisible
				? 'text-gray-600 hover:bg-gray-100 hover:text-gray-700'
				: 'text-red-600 hover:bg-red-50 hover:text-red-700'}
			title={block.isVisible ? 'Hide Block' : 'Show Block'}
		/>

		<Button
			variant="ghost"
			size="xs"
			icon={ChevronUp}
			onclick={() => handleMove('up')}
			disabled={!canMoveUp}
			class="text-gray-500 hover:bg-gray-100 hover:text-gray-700"
			title="Move Up"
		/>

		<Button
			variant="ghost"
			size="xs"
			icon={ChevronDown}
			onclick={() => handleMove('down')}
			disabled={!canMoveDown}
			class="text-gray-500 hover:bg-gray-100 hover:text-gray-700"
			title="Move Down"
		/>

		<Button
			variant="ghost"
			size="xs"
			icon={Trash2}
			onclick={handleDelete}
			class="text-red-500 hover:bg-red-50 hover:text-red-700"
			title="Delete Block"
		/>
	</div>
{:else}
	<!-- Full-size labeled actions bar -->
	<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
		<div class="mb-3 text-xs font-semibold tracking-wider text-gray-500 uppercase">
			Block Actions
		</div>

		<div class="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
			<!-- Primary Actions -->
			<Button
				variant="primary"
				size="lg"
				icon={Edit}
				onclick={handleEdit}
				class="h-16 flex-col text-xs"
			>
				Edit Content
			</Button>

			<Button
				variant="secondary"
				size="lg"
				icon={block.isVisible ? EyeOff : Eye}
				onclick={handleToggleVisibility}
				class="h-16 flex-col text-xs"
			>
				{block.isVisible ? 'Hide Block' : 'Show Block'}
			</Button>

			<!-- Movement Actions -->
			<Button
				variant="outline"
				size="lg"
				icon={ChevronUp}
				onclick={() => handleMove('up')}
				disabled={!canMoveUp}
				class="h-16 flex-col text-xs"
			>
				Move Up
			</Button>

			<Button
				variant="outline"
				size="lg"
				icon={ChevronDown}
				onclick={() => handleMove('down')}
				disabled={!canMoveDown}
				class="h-16 flex-col text-xs"
			>
				Move Down
			</Button>

			<!-- Secondary Actions -->
			<Button
				variant="ghost"
				size="lg"
				icon={History}
				onclick={handleVersionHistory}
				class="h-16 flex-col text-xs text-purple-600 hover:bg-purple-50 hover:text-purple-700"
			>
				Version History
			</Button>

			<Button
				variant="ghost"
				size="lg"
				icon={Copy}
				onclick={handleDuplicate}
				class="h-16 flex-col text-xs text-green-600 hover:bg-green-50 hover:text-green-700"
			>
				Duplicate
			</Button>
		</div>

		<!-- Destructive Actions Separated -->
		<div class="mt-4 border-t border-gray-200 pt-4">
			<div class="mb-3 text-xs font-semibold tracking-wider text-gray-500 uppercase">
				Destructive Actions
			</div>
			<div class="flex gap-3">
				<Button variant="danger" size="md" icon={Trash2} onclick={handleDelete} class="flex-1">
					Delete Block
				</Button>

				<Button variant="outline" size="md" icon={Archive} class="flex-1">Archive Block</Button>
			</div>
		</div>

		<!-- Block Info -->
		<div class="mt-4 border-t border-gray-100 pt-3">
			<div class="flex justify-between text-xs text-gray-500">
				<span>Position: {index + 1} of {totalBlocks}</span>
				<span>ID: {block.id.slice(0, 8)}...</span>
			</div>
		</div>
	</div>
{/if}
