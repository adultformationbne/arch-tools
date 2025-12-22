<script>
	import Icon from './Icon.svelte';
	let { ...props } = $props();
</script>

<Icon name="CheckCircle" {...props} />
