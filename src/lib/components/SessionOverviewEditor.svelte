<script>
	let {
		sessionOverview = '',
		onOverviewChange = () => {},
		placeholder = '',
		sessionNumber = 1
	} = $props();

	// Local state to avoid two-way binding issues with props
	let textareaValue = $state(sessionOverview);
	let previousSessionNumber = $state(sessionNumber);
	let textareaEl = $state(null);

	// Auto-resize textarea to fit content
	const autoResize = () => {
		if (!textareaEl) return;
		textareaEl.style.height = 'auto';
		textareaEl.style.height = `${textareaEl.scrollHeight}px`;
	};

	const handleInput = (e) => {
		textareaValue = e.target.value;
		autoResize();
	};

	const handleBlur = () => {
		onOverviewChange(textareaValue);
	};

	// Sync with prop changes only when session changes
	$effect(() => {
		// Session changed - reset value
		if (sessionNumber !== previousSessionNumber) {
			textareaValue = sessionOverview;
			previousSessionNumber = sessionNumber;
		}
	});

	// Resize when content changes externally or on mount
	$effect(() => {
		if (textareaEl && textareaValue !== undefined) {
			autoResize();
		}
	});

	// Custom placeholder based on session type
	const displayPlaceholder = sessionNumber === 0
		? 'Welcome your students and set expectations. What should they do before the first session? Any pre-reading, introductions, or logistics to share?'
		: 'What will students learn in this session? Key topics, goals, or themes to prepare them for the materials and discussion ahead...';
</script>

<div class="bg-white rounded-2xl p-6 shadow-sm">
	<h2 class="text-xl font-bold text-gray-800 mb-4">
		{sessionNumber === 0 ? 'Welcome Message' : 'Session Overview'}
	</h2>
	<textarea
		bind:this={textareaEl}
		value={textareaValue}
		oninput={handleInput}
		onblur={handleBlur}
		placeholder={displayPlaceholder}
		class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent resize-none"
		style="min-height: 120px; max-height: 400px; overflow-y: auto;"
	></textarea>
</div>