<script>
	import { Play, FileText, Book, ExternalLink } from '$lib/icons';

	let { materials, courseSlug } = $props();

	const getIcon = (type) => {
		switch (type) {
			case 'video':
			case 'mux_video':
			case 'embed': return Play;
			case 'native': return Book;
			default: return FileText;
		}
	};

	const isDirectLink = (type) => type === 'link' || type === 'document';

	const getMaterialHref = (material) =>
		isDirectLink(material.type)
			? (material.url ?? material.content ?? '#')
			: `/courses/${courseSlug}/materials?material=${material.id}`;
</script>

<div class="mt-6 rounded-xl lg:ml-16" style="background-color: color-mix(in srgb, var(--course-accent-light, #c59a6b) 20%, white);">
	<div class="p-6 sm:p-8 lg:p-10">
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4 items-start">
			<!-- Left: heading -->
			<div>
				<h2 class="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2" style="color: var(--course-accent-dark, #334642);">
					For Upcoming Session
				</h2>
				<div class="flex items-center gap-2">
					<p class="text-base font-semibold" style="color: var(--course-accent-light, #c59a6b);">Next Session</p>
					<div class="h-1 w-10 rounded" style="background-color: var(--course-accent-light, #c59a6b);"></div>
				</div>
			</div>

			<!-- Right: pills — same inline-flex rounded-full style as session materials -->
			<div class="flex flex-wrap gap-2">
				{#each materials as material}
					{@const IconComponent = getIcon(material.type)}
					{@const direct = isDirectLink(material.type)}
					<a
						href={getMaterialHref(material)}
						target={direct ? '_blank' : undefined}
						rel={direct ? 'noopener noreferrer' : undefined}
						class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors cursor-pointer no-underline text-sm font-medium hover:opacity-90"
						style="background-color: var(--course-accent-dark, #334642);"
					>
						<IconComponent size="14" class="text-white/70 flex-shrink-0" />
						<span class="text-white">{material.title}</span>
						{#if direct}
							<ExternalLink size="11" class="ml-1 flex-shrink-0 text-white/50" />
						{/if}
					</a>
				{/each}
			</div>
		</div>
	</div>
</div>
