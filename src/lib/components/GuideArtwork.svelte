<script>
	// A single-colour illustration (e.g. a botanical engraving) for the public guide
	// pages. On screen the image file is used as a mask, so the artwork takes whatever
	// colour the theme gives it. In print it is drawn as it is (see the style below).
	let {
		src,
		width,
		height,
		color = 'var(--pp-highlight, #c9a96e)',
		size = '100%',
		opacity = 1,
		label = '' // leave empty for decoration; set it when the image carries meaning
	} = $props();
</script>

<div
	class="artwork"
	role={label ? 'img' : undefined}
	aria-label={label || undefined}
	aria-hidden={label ? undefined : 'true'}
	style="--artwork: url('{src}'); aspect-ratio: {width} / {height}; width: {size}; background-color: {color}; opacity: {opacity};"
></div>

<style>
	.artwork {
		max-width: 100%;
		-webkit-mask: var(--artwork) center / contain no-repeat content-box;
		mask: var(--artwork) center / contain no-repeat content-box;
		padding: 2px; /* keeps the mask off the element's edge, which can print as a hairline box */
		box-sizing: border-box;
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
	}

	/* Chromium's PDF output draws a hairline box around masked elements, so on paper
	   the image is shown directly, in its own ink colour */
	@media print {
		.artwork {
			-webkit-mask: none;
			mask: none;
			background: var(--artwork) center / contain no-repeat content-box !important;
		}
	}
</style>
