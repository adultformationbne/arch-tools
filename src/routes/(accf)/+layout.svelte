<script>
	import '../../app.css';
</script>

<div class="min-h-screen" style="background-color: #334642;">
	<slot />
</div>

<style>
	/* Custom ACCF styles that complement Tailwind */
	.accf-card {
		@apply bg-accf-lightest border border-accf-light rounded-lg shadow-sm p-6;
	}

	.accf-button-primary {
		@apply bg-accf-accent text-accf-darkest font-semibold px-6 py-2 rounded-lg hover:bg-opacity-90 transition-colors duration-200;
	}

	.accf-button-secondary {
		@apply bg-accf-light text-accf-dark border border-accf-accent px-6 py-2 rounded-lg hover:bg-accf-accent hover:text-accf-darkest transition-colors duration-200;
	}

	.accf-heading {
		@apply font-bebas text-accf-dark tracking-wide;
	}

	.accf-text {
		@apply text-accf-darkest;
	}

	.accf-input {
		@apply bg-accf-lightest border border-accf-light focus:border-accf-accent focus:ring-2 focus:ring-accf-accent focus:ring-opacity-20 rounded-lg px-4 py-2;
	}
</style>