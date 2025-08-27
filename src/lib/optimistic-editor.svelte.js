// Optimistic editor with background sync queue
import * as EditorAPI from './editor-api.js';

export class OptimisticEditor {
	// State - make sure blocks is properly reactive
	blocks = $state([]);
	pendingOperations = $state([]);
	isProcessing = $state(false);
	lastSyncTime = $state(null);
	errorCount = $state(0);

	constructor() {
		// Start background sync processor
		this.startSyncProcessor();
	}

	// Load initial data
	async loadBlocks() {
		try {
			const bookData = await EditorAPI.loadBook();
			this.blocks = bookData.blocks || [];
			this.lastSyncTime = new Date().toISOString();
			return bookData;
		} catch (error) {
			console.error('Error loading blocks:', error);
			throw error;
		}
	}

	// Optimistic block movement
	moveBlock(blockId, direction) {
		const index = this.blocks.findIndex((b) => b.id === blockId);
		if (index === -1) return false;

		const newIndex = direction === 'up' ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= this.blocks.length) return false;

		// Optimistic UI update - instant
		const newBlocks = [...this.blocks];
		const [movedBlock] = newBlocks.splice(index, 1);
		newBlocks.splice(newIndex, 0, movedBlock);
		this.blocks = newBlocks;

		// Queue API call for background sync
		this.queueOperation({
			type: 'move',
			blockId,
			direction,
			timestamp: Date.now(),
			rollback: () => {
				// Rollback on error: move back
				const currentIndex = this.blocks.findIndex((b) => b.id === blockId);
				if (currentIndex !== -1) {
					const rollbackIndex = direction === 'up' ? currentIndex + 1 : currentIndex - 1;
					if (rollbackIndex >= 0 && rollbackIndex < this.blocks.length) {
						const rollbackBlocks = [...this.blocks];
						const [blockToRollback] = rollbackBlocks.splice(currentIndex, 1);
						rollbackBlocks.splice(rollbackIndex, 0, blockToRollback);
						this.blocks = rollbackBlocks;
					}
				}
			}
		});

		return true;
	}

	// Optimistic visibility toggle
	toggleBlockVisibility(blockId) {
		const block = this.blocks.find((b) => b.id === blockId);
		if (!block) return false;

		const oldVisibility = block.isVisible;
		const newVisibility = !oldVisibility;

		// Optimistic UI update - instant
		block.isVisible = newVisibility;
		this.blocks = [...this.blocks]; // Trigger reactivity

		// Queue API call for background sync
		this.queueOperation({
			type: 'set_visibility',
			blockId,
			visible: newVisibility,
			timestamp: Date.now(),
			rollback: () => {
				// Rollback on error
				const currentBlock = this.blocks.find((b) => b.id === blockId);
				if (currentBlock) {
					currentBlock.isVisible = oldVisibility;
					this.blocks = [...this.blocks];
				}
			}
		});

		return true;
	}

	// Bulk visibility toggle
	bulkToggleVisibility(blockIds) {
		const rollbacks = [];

		// Collect current state and apply optimistic updates
		blockIds.forEach((blockId) => {
			const block = this.blocks.find((b) => b.id === blockId);
			if (block) {
				const oldVisibility = block.isVisible;
				const newVisibility = !oldVisibility;

				// Optimistic update
				block.isVisible = newVisibility;

				// Store rollback info
				rollbacks.push({ blockId, visibility: oldVisibility });
			}
		});

		this.blocks = [...this.blocks]; // Trigger reactivity

		// Queue bulk operation
		this.queueOperation({
			type: 'toggle_visibility',
			blockIds,
			timestamp: Date.now(),
			rollback: () => {
				// Rollback all changes
				rollbacks.forEach(({ blockId, visibility }) => {
					const block = this.blocks.find((b) => b.id === blockId);
					if (block) {
						block.isVisible = visibility;
					}
				});
				this.blocks = [...this.blocks];
			}
		});
	}

	// Queue an operation for background sync
	queueOperation(operation) {
		this.pendingOperations = [...this.pendingOperations, operation];
	}

	// Background sync processor
	startSyncProcessor() {
		setInterval(() => {
			if (this.pendingOperations.length > 0 && !this.isProcessing) {
				this.processPendingOperations();
			}
		}, 100); // Process every 100ms
	}

	// Process pending operations in background
	async processPendingOperations() {
		if (this.isProcessing || this.pendingOperations.length === 0) return;

		this.isProcessing = true;

		// Process operations in batches
		const batchSize = 5;
		const batch = this.pendingOperations.slice(0, batchSize);

		try {
			await Promise.all(batch.map((op) => this.executeOperation(op)));

			// Remove successful operations
			this.pendingOperations = this.pendingOperations.slice(batchSize);
			this.errorCount = 0;
			this.lastSyncTime = new Date().toISOString();
		} catch (error) {
			console.error('Error in background sync:', error);
			this.errorCount++;

			// If too many errors, rollback failed operations
			if (this.errorCount > 3) {
				batch.forEach((op) => {
					if (op.rollback) {
						op.rollback();
					}
				});

				// Remove failed operations
				this.pendingOperations = this.pendingOperations.slice(batchSize);
				this.errorCount = 0;
			}
		} finally {
			this.isProcessing = false;
		}
	}

	// Execute a single operation via API
	async executeOperation(operation) {
		switch (operation.type) {
			case 'move':
				return await EditorAPI.bulkOperation('move', [operation.blockId], {
					direction: operation.direction
				});

			case 'set_visibility':
				return await EditorAPI.bulkOperation('set_visibility', [operation.blockId], {
					visible: operation.visible
				});

			case 'toggle_visibility':
				return await EditorAPI.bulkOperation('toggle_visibility', operation.blockIds);

			default:
				throw new Error(`Unknown operation type: ${operation.type}`);
		}
	}

	// Force sync all pending operations
	async forcSync() {
		while (this.pendingOperations.length > 0) {
			await this.processPendingOperations();
			// Small delay to prevent overwhelming the server
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
	}

	// Get sync status
	getSyncStatus() {
		return {
			pendingCount: this.pendingOperations.length,
			isProcessing: this.isProcessing,
			lastSync: this.lastSyncTime,
			hasErrors: this.errorCount > 0
		};
	}
}
