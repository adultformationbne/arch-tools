<script>
	import { Users, Globe, Heart, MessageCircle, ChevronRight } from 'lucide-svelte';

	let { onReadReflection = () => {} } = $props();

	// Mock data for public reflections from other cohorts
	const publicReflections = [
		{
			id: 1,
			studentName: "Maria Rodriguez",
			studentInitials: "MR",
			cohortName: "Scripture & Tradition",
			weekNumber: 6,
			reflectionExcerpt: "This week's exploration of the Eucharist transformed my understanding of communion. I never realized how deeply the symbolism runs through every aspect of the liturgy. When Father explained that we don't just receive Christ, but become what we receive - the Body of Christ - it fundamentally changed how I approach Mass...",
			submittedAt: "2 hours ago",
			likes: 12,
			comments: 3
		},
		{
			id: 2,
			studentName: "David Chen",
			studentInitials: "DC",
			cohortName: "Foundations of Faith",
			weekNumber: 4,
			reflectionExcerpt: "The concept of grace has always puzzled me, but this week's readings finally made it click. Grace isn't earned or deserved - it's freely given. This realization has lifted such a weight off my shoulders. I've spent years thinking I needed to be 'good enough' for God's love, but now I understand that His love comes first...",
			submittedAt: "5 hours ago",
			likes: 8,
			comments: 2
		},
		{
			id: 3,
			studentName: "Jennifer Walsh",
			studentInitials: "JW",
			cohortName: "Sacraments & Liturgy",
			weekNumber: 7,
			reflectionExcerpt: "Today's discussion on reconciliation brought me to tears. I've been carrying guilt for so long, afraid to bring it to confession. But learning about God's infinite mercy and the joy in heaven over one repentant sinner gave me courage. The parable of the Prodigal Son isn't just a story - it's my story...",
			submittedAt: "1 day ago",
			likes: 24,
			comments: 7
		},
		{
			id: 4,
			studentName: "Thomas Anderson",
			studentInitials: "TA",
			cohortName: "Moral Teaching",
			weekNumber: 3,
			reflectionExcerpt: "Wrestling with the Church's social teachings has challenged my political views in unexpected ways. The preferential option for the poor isn't just charity - it's justice. This week made me examine how I vote, how I spend, and how I treat those society overlooks. The Gospel isn't meant to be comfortable...",
			submittedAt: "1 day ago",
			likes: 15,
			comments: 5
		},
		{
			id: 5,
			studentName: "Sarah O'Brien",
			studentInitials: "SO",
			cohortName: "Foundations of Faith",
			weekNumber: 8,
			reflectionExcerpt: "Completing this module feels like the beginning, not the end. Eight weeks ago, I came seeking answers but I'm leaving with better questions. Faith isn't about certainty - it's about trust. The Trinity still mystifies me, but now I'm comfortable with the mystery. Some things are meant to be lived, not solved...",
			submittedAt: "2 days ago",
			likes: 31,
			comments: 9
		},
		{
			id: 6,
			studentName: "Michael Nguyen",
			studentInitials: "MN",
			cohortName: "Scripture & Tradition",
			weekNumber: 5,
			reflectionExcerpt: "Learning about Lectio Divina has revolutionized my prayer life. I used to rush through Scripture like a textbook, but now I sit with just a few verses and let them speak. This morning, 'Be still and know that I am God' held me for an entire hour. The Word is living and active - I finally understand what that means...",
			submittedAt: "3 days ago",
			likes: 19,
			comments: 4
		}
	];
</script>

<div>
	<!-- Section Header -->
	<div class="flex items-center justify-between mb-8">
		<div class="flex items-center gap-4">
			<h2 class="text-4xl font-bold text-white">Community Reflections</h2>
			<div class="flex items-center gap-2 px-3 py-1 rounded-full" style="background-color: rgba(197, 154, 107, 0.2);">
				<Globe size="16" style="color: #c59a6b;" />
				<span class="text-sm font-medium" style="color: #c59a6b;">Public Feed</span>
			</div>
		</div>
		<div class="text-white text-lg opacity-75">
			Shared reflections from all ACCF cohorts
		</div>
	</div>

	<!-- Public Reflections Grid -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
		{#each publicReflections as reflection}
			<button
				on:click={() => onReadReflection(reflection)}
				class="text-left rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl cursor-pointer group"
				style="background-color: #eae2d9;"
			>
				<!-- Header with Student Info -->
				<div class="flex items-start justify-between mb-4">
					<div class="flex items-center gap-3">
						<!-- Avatar -->
						<div
							class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
							style="background-color: #334642;"
						>
							{reflection.studentInitials}
						</div>
						<div>
							<h3 class="font-semibold text-gray-800 group-hover:text-gray-900 transition-colors">
								{reflection.studentName}
							</h3>
							<div class="flex items-center gap-2 text-xs text-gray-600">
								<span>{reflection.cohortName}</span>
								<span>•</span>
								<span>Week {reflection.weekNumber}</span>
							</div>
						</div>
					</div>
					<ChevronRight size="16" class="text-gray-400 group-hover:text-gray-600 transition-colors mt-2" />
				</div>

				<!-- Reflection Excerpt -->
				<div class="mb-4">
					<p class="text-gray-700 text-sm leading-relaxed line-clamp-4">
						{reflection.reflectionExcerpt}
					</p>
				</div>

				<!-- Footer with Engagement Stats -->
				<div class="flex items-center justify-between pt-4 border-t border-gray-300">
					<div class="flex items-center gap-4">
						<div class="flex items-center gap-1 text-gray-600">
							<Heart size="14" />
							<span class="text-xs font-medium">{reflection.likes}</span>
						</div>
						<div class="flex items-center gap-1 text-gray-600">
							<MessageCircle size="14" />
							<span class="text-xs font-medium">{reflection.comments}</span>
						</div>
					</div>
					<span class="text-xs text-gray-500">{reflection.submittedAt}</span>
				</div>
			</button>
		{/each}
	</div>

	<!-- Load More Button -->
	<div class="flex justify-center mt-8">
		<button
			class="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all hover:scale-105"
			style="background-color: rgba(234, 226, 217, 0.2); color: #eae2d9; border: 1px solid rgba(234, 226, 217, 0.3);"
		>
			<Users size="18" />
			Load More Reflections
		</button>
	</div>
</div>

<style>
	/* Tailwind line-clamp utility backup */
	.line-clamp-4 {
		overflow: hidden;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 4;
	}
</style>