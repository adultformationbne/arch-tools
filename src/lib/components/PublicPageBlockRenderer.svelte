<script>
	let { blocks = [] } = $props();

	let openAccordions = $state(new Set());

	function toggleAccordion(key) {
		openAccordions = new Set(openAccordions);
		if (openAccordions.has(key)) {
			openAccordions.delete(key);
		} else {
			openAccordions.add(key);
		}
	}
</script>

<div class="blocks">
	{#each blocks as block, i}
		{#if block.type === 'title'}
			<h2 class="block-title">{block.content}</h2>

		{:else if block.type === 'text'}
			<p class="block-text">{block.content}</p>

		{:else if block.type === 'note'}
			<p class="block-note">{block.content}</p>

		{:else if block.type === 'summary'}
			<div class="block-summary"><p>{block.content}</p></div>

		{:else if block.type === 'quote'}
			<blockquote class="block-quote">
				<p>{block.content}</p>
				{#if block.attribution}<cite>{block.attribution}</cite>{/if}
			</blockquote>

		{:else if block.type === 'scripture'}
			<div class="block-scripture">
				<span class="scripture-label">Scripture</span>
				{#each block.items as ref}
					<span class="scripture-ref">{ref}</span>
				{/each}
			</div>

		{:else if block.type === 'questions'}
			<ol class="block-questions">
				{#each block.items as q, qi}
					<li>
						<span class="q-num">{qi + 1}</span>
						<span class="q-text">{q}</span>
					</li>
				{/each}
			</ol>

		{:else if block.type === 'ordered_list'}
			<ol class="block-ordered">
				{#each block.items as item, ii}
					<li>
						<span class="step-num">{ii + 1}</span>
						<span>{item}</span>
					</li>
				{/each}
			</ol>

		{:else if block.type === 'unordered_list'}
			<ul class="block-unordered">
				{#each block.items as item}
					<li>{item}</li>
				{/each}
			</ul>

		{:else if block.type === 'accordion'}
			<div class="block-accordion">
				{#each block.items as item, ai}
					{@const key = `${i}-${ai}`}
					<div class="accordion-item" class:open={openAccordions.has(key)}>
						<button class="accordion-trigger" onclick={() => toggleAccordion(key)}>
							<span>{item.title}</span>
							<span class="accordion-chevron" class:rotated={openAccordions.has(key)}>▾</span>
						</button>
						{#if openAccordions.has(key)}
							<ul class="accordion-body">
								{#each (item.points ?? item.content ? [item.content] : []) as point}
									<li>{point}</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/each}
			</div>

		{:else if block.type === 'video'}
			<div class="block-video">
				<iframe src={block.url} title={block.caption ?? 'Video'} allowfullscreen></iframe>
				{#if block.caption}<p class="media-caption">{block.caption}</p>{/if}
			</div>

		{:else if block.type === 'image'}
			<figure class="block-image">
				<img src={block.url} alt={block.caption ?? ''} />
				{#if block.caption}<figcaption>{block.caption}</figcaption>{/if}
			</figure>

		{:else if block.type === 'download'}
			<div class="block-download">
				<a href={block.url} target="_blank" rel="noopener noreferrer" class="download-link">
					<span class="download-icon">↓</span>
					<span>{block.title ?? 'Download'}</span>
				</a>
				{#if block.caption}<p class="download-caption">{block.caption}</p>{/if}
			</div>

		{:else if block.type === 'divider'}
			<hr class="block-divider" />
		{/if}
	{/each}
</div>

<style>
	.blocks { display: flex; flex-direction: column; gap: 0; }

	.block-title {
		font-family: 'Inter', sans-serif;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--pp-accent, #7c6a52);
		margin-top: 2.5rem;
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--pp-border, #e7e5e4);
	}

	.block-text {
		font-family: 'Lora', Georgia, serif;
		font-size: 1.05rem;
		color: var(--pp-body, #44403c);
		line-height: 1.85;
		margin-bottom: 1rem;
	}

	.block-note {
		font-family: 'Lora', Georgia, serif;
		font-size: 0.9rem;
		font-style: italic;
		color: var(--pp-muted, #78716c);
		line-height: 1.75;
		margin-top: 0.5rem;
		margin-bottom: 1rem;
	}

	.block-summary {
		background: linear-gradient(135deg, #f9f6f2 0%, #f3ede5 100%);
		border-radius: 12px;
		padding: 1.25rem 1.5rem;
		margin-bottom: 1.5rem;
		border: 1px solid #e8dfd4;
	}
	.block-summary p {
		font-family: 'Lora', Georgia, serif;
		font-size: 1rem;
		color: #44403c;
		line-height: 1.8;
	}

	.block-quote {
		border-left: 3px solid var(--pp-gold, #c9a96e);
		margin: 0 0 1.5rem;
		padding: 0.75rem 1.25rem;
		background: var(--pp-surface, #fafaf9);
	}
	.block-quote p {
		font-family: 'Lora', Georgia, serif;
		font-size: 1.05rem;
		font-style: italic;
		color: #44403c;
		line-height: 1.75;
	}
	.block-quote cite {
		display: block;
		margin-top: 0.5rem;
		font-size: 0.8rem;
		color: #78716c;
		font-style: normal;
	}

	.block-scripture {
		background: #f5f5f4;
		border-left: 3px solid var(--pp-gold, #c9a96e);
		border-radius: 0 8px 8px 0;
		padding: 1rem 1.25rem;
		margin-bottom: 1.5rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
	.scripture-label {
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #a8a29e;
		width: 100%;
		margin-bottom: 0.2rem;
	}
	.scripture-ref {
		font-family: 'Lora', Georgia, serif;
		font-size: 0.85rem;
		color: #5c4f3a;
		background: white;
		border: 1px solid #e7e5e4;
		padding: 0.2rem 0.6rem;
		border-radius: 20px;
	}

	.block-questions {
		list-style: none;
		padding: 0;
		margin-bottom: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.block-questions li {
		display: flex;
		gap: 1rem;
		padding: 0.9rem 1.1rem;
		background: white;
		border: 1px solid #e7e5e4;
		border-radius: 10px;
	}
	.q-num {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--pp-gold, #c9a96e);
		min-width: 18px;
		padding-top: 2px;
	}
	.q-text {
		font-family: 'Lora', Georgia, serif;
		font-size: 0.95rem;
		color: #44403c;
		line-height: 1.65;
	}

	.block-ordered {
		list-style: none;
		padding: 0;
		margin-bottom: 1.5rem;
		display: flex;
		flex-direction: column;
		counter-reset: steps;
	}
	.block-ordered li {
		display: flex;
		gap: 1rem;
		padding: 0.55rem 0;
		border-top: 1px solid #f5f5f4;
		font-family: 'Lora', Georgia, serif;
		font-size: 0.9rem;
		color: #57534e;
		line-height: 1.7;
	}
	.step-num {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		min-width: 22px;
		height: 22px;
		background: #f5f5f4;
		border-radius: 50%;
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--pp-accent, #7c6a52);
		font-family: 'Inter', sans-serif;
		margin-top: 2px;
		flex-shrink: 0;
	}

	.block-unordered {
		list-style: none;
		padding: 0;
		margin-bottom: 1.5rem;
	}
	.block-unordered li {
		font-family: 'Lora', Georgia, serif;
		font-size: 0.95rem;
		color: #57534e;
		line-height: 1.7;
		padding: 0.3rem 0 0.3rem 1.2rem;
		position: relative;
	}
	.block-unordered li::before {
		content: '–';
		position: absolute;
		left: 0;
		color: var(--pp-gold, #c9a96e);
	}

	.block-accordion {
		margin-bottom: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.accordion-item {
		border: 1px solid #e7e5e4;
		border-radius: 10px;
		overflow: hidden;
		background: white;
	}
	.accordion-trigger {
		width: 100%;
		text-align: left;
		padding: 0.9rem 1.1rem;
		background: none;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		font-family: 'Inter', sans-serif;
		font-size: 0.875rem;
		font-weight: 600;
		color: #292524;
	}
	.accordion-trigger:hover { background: #fafaf9; }
	.accordion-chevron { color: #a8a29e; transition: transform 0.2s; font-size: 1rem; }
	.accordion-chevron.rotated { transform: rotate(180deg); color: var(--pp-accent, #7c6a52); }
	.accordion-body {
		list-style: none;
		padding: 0 1.1rem 1.1rem;
	}
	.accordion-body li {
		font-family: 'Lora', Georgia, serif;
		font-size: 0.875rem;
		color: #57534e;
		line-height: 1.7;
		padding: 0.25rem 0 0.25rem 1.1rem;
		position: relative;
	}
	.accordion-body li::before {
		content: '–';
		position: absolute;
		left: 0;
		color: var(--pp-gold, #c9a96e);
	}

	.block-video {
		margin-bottom: 1.5rem;
		border-radius: 12px;
		overflow: hidden;
		aspect-ratio: 16/9;
		background: #1c1917;
	}
	.block-video iframe {
		width: 100%;
		height: 100%;
		border: none;
	}

	.block-image {
		margin: 0 0 1.5rem;
	}
	.block-image img {
		width: 100%;
		border-radius: 12px;
		display: block;
	}
	.media-caption, figcaption {
		font-size: 0.8rem;
		color: #78716c;
		text-align: center;
		margin-top: 0.5rem;
		font-style: italic;
	}

	.block-divider {
		border: none;
		border-top: 1px solid #e7e5e4;
		margin: 2rem 0;
	}

	.block-download { margin-bottom: 1.25rem; }
	.download-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 1.1rem;
		background: #f5f5f4;
		border: 1px solid #e7e5e4;
		border-radius: 8px;
		font-family: 'Inter', sans-serif;
		font-size: 0.875rem;
		font-weight: 500;
		color: #44403c;
		text-decoration: none;
		transition: all 0.15s;
	}
	.download-link:hover { background: #ece9e6; border-color: #c9a96e; }
	.download-icon { font-size: 1rem; color: var(--pp-gold, #c9a96e); }
	.download-caption { font-size: 0.75rem; color: #a8a29e; margin-top: 0.35rem; font-family: 'Inter', sans-serif; }
</style>
