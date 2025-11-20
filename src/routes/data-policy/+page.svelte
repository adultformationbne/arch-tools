<script>
	import { page } from '$app/stores';
	export let data;
	$: ({ session, platform } = data);
</script>

<svelte:head>
	<title>Data Handling Policy - {platform.name}</title>
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-4xl">
	<div class="bg-white shadow-lg rounded-lg p-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-6">Data Handling Policy</h1>
		<p class="text-sm text-gray-600 mb-8">Internal Use - Archdiocesan Ministry Staff</p>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">What This Platform Does</h2>
			<p class="text-gray-700 mb-4">
				The {platform.name} is an internal content management system that helps staff organise and publish Catholic liturgical content, and manage formation programs, including:
			</p>
			<ul class="list-disc list-inside text-gray-700 space-y-2 ml-4">
				<li>Daily Gospel Reflections (DGR) scheduling and publishing</li>
				<li>Scripture reading organisation from public liturgical calendars</li>
				<li>Content editing and version management for publications</li>
				<li>User account management for internal staff access</li>
				<li>Catholic formation courses and programs (e.g., ACCF - Archdiocesan Centre for Catholic Formation)</li>
				<li>Student enrolment and cohort management</li>
				<li>Course materials delivery and reflection tracking</li>
			</ul>
		</section>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">Data We Store</h2>

			<div class="space-y-6">
				<div class="bg-blue-50 p-4 rounded-lg">
					<h3 class="font-medium text-gray-800 mb-2">Data We Can Access (stored in our database)</h3>

					<h4 class="font-medium text-gray-700 mt-4 mb-2">User & Access Data:</h4>
					<ul class="list-disc list-inside text-gray-700 space-y-1 ml-4">
						<li>Email addresses and names (staff and course participants)</li>
						<li>Platform access modules (platform.admin, editor, dgr, courses.participant, courses.manager, courses.admin)</li>
						<li>Course assignments for managers</li>
						<li>Activity logs and version history</li>
					</ul>

					<h4 class="font-medium text-gray-700 mt-4 mb-2">Course & Formation Data:</h4>
					<ul class="list-disc list-inside text-gray-700 space-y-1 ml-4">
						<li>Course enrolments (participant names, emails, cohort assignments)</li>
						<li>Course roles (student, coordinator)</li>
						<li>Hub assignments and coordination</li>
						<li>Student progress tracking (current session number)</li>
						<li>Attendance records</li>
						<li>Reflection submissions and written responses</li>
						<li>Grading and feedback on reflections (passing/not passing, feedback text)</li>
						<li>Course materials (videos, documents, links, HTML content)</li>
						<li>Module and session structures</li>
					</ul>

					<h4 class="font-medium text-gray-700 mt-4 mb-2">Content & Publishing Data:</h4>
					<ul class="list-disc list-inside text-gray-700 space-y-1 ml-4">
						<li>Scripture readings and liturgical content</li>
						<li>Gospel reflections and publication content</li>
						<li>Contributor scheduling preferences and assignments</li>
						<li>Email notification records and delivery status</li>
					</ul>
				</div>

				<div class="bg-green-50 p-4 rounded-lg">
					<h3 class="font-medium text-gray-800 mb-2">Data We Cannot Access (handled by Supabase)</h3>
					<ul class="list-disc list-inside text-gray-700 space-y-1 ml-4">
						<li>User passwords (encrypted by Supabase Auth)</li>
						<li>Login session tokens and authentication data</li>
						<li>Password reset tokens and verification codes</li>
						<li>Raw authentication credentials</li>
					</ul>
					<p class="text-sm text-gray-600 mt-2 italic">
						Supabase handles all password security using industry-standard encryption.
						Archdiocesan staff cannot view or access user passwords.
					</p>
				</div>

				<div>
					<h3 class="font-medium text-gray-800">Public Content We Organise</h3>
					<ul class="list-disc list-inside text-gray-700 ml-4">
						<li>Scripture readings from publicly available liturgical calendars</li>
						<li>Liturgical dates and seasonal information</li>
						<li>Published gospel reflections intended for public distribution</li>
					</ul>
				</div>
			</div>
		</section>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">How We Protect Data</h2>
			<ul class="list-disc list-inside text-gray-700 space-y-2 ml-4">
				<li><strong>Authentication:</strong> All access requires secure login via Supabase Auth</li>
				<li><strong>Module-based access:</strong> Platform access controlled by assigned modules (platform.admin, editor, dgr, courses.*)</li>
				<li><strong>Course-level permissions:</strong> Course managers only access assigned courses; participants only access enrolled cohorts</li>
				<li><strong>Secure hosting:</strong> Data stored on Supabase's secure PostgreSQL infrastructure</li>
				<li><strong>Row-level security:</strong> Database policies ensure users only access data they're authorised to see</li>
				<li><strong>Version control:</strong> All content changes are logged with timestamps and user attribution</li>
				<li><strong>Token-based submissions:</strong> Public contributors access content via secure, time-limited tokens</li>
				<li><strong>Enrolment privacy:</strong> Student reflection submissions are only visible to course administrators and the student who submitted them</li>
			</ul>
		</section>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">Data Retention</h2>
			<ul class="list-disc list-inside text-gray-700 space-y-2 ml-4">
				<li><strong>Content:</strong> All content versions are preserved for historical reference and audit purposes</li>
				<li><strong>Course enrolments:</strong> Maintained indefinitely for transcript and completion record purposes</li>
				<li><strong>Reflection submissions:</strong> Preserved as part of student records and grading history</li>
				<li><strong>Attendance records:</strong> Retained for the duration of the course and archived upon completion</li>
				<li><strong>User sessions:</strong> Automatically expire according to Supabase security policies</li>
				<li><strong>Activity logs:</strong> Maintained indefinitely for content integrity and version control</li>
				<li><strong>Email notifications:</strong> Processed and delivered, not permanently stored</li>
			</ul>
		</section>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">Third-Party Services</h2>
			<ul class="list-disc list-inside text-gray-700 space-y-2 ml-4">
				<li><strong>Supabase:</strong> Provides authentication, database, and security infrastructure</li>
				<li><strong>Universalis API:</strong> Supplies daily liturgical readings (read-only access)</li>
				<li><strong>Email services:</strong> Used for contributor notifications and administrative communications</li>
			</ul>
		</section>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">Staff Responsibilities</h2>
			<ul class="list-disc list-inside text-gray-700 space-y-2 ml-4">
				<li>Keep login credentials secure and do not share accounts</li>
				<li>Only access and modify content within your assigned modules and courses</li>
				<li>Respect student privacy - do not share reflection submissions or grades outside the platform</li>
				<li>Course managers should only access courses they are assigned to manage</li>
				<li>Maintain confidentiality of participant information (names, emails, progress, reflections)</li>
				<li>Report any suspected security issues to IT administration</li>
				<li>Use the platform only for official archdiocesan ministry purposes</li>
			</ul>
		</section>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">Questions or Concerns</h2>
			<p class="text-gray-700 mb-4">
				For questions about data handling, access permissions, or technical issues with this platform,
				contact:
			</p>
			<div class="bg-gray-50 p-4 rounded-lg">
				<p class="text-gray-700">
					<strong>Technical Support:</strong><br>
					<a href="mailto:desicl@bne.catholic.net.au" class="text-blue-600 hover:text-blue-800">desicl@bne.catholic.net.au</a>
				</p>
				<p class="text-gray-700 mt-2">
					<strong>General Inquiries:</strong> Your ministry supervisor
				</p>
			</div>
		</section>

		<footer class="mt-12 pt-6 border-t border-gray-200 text-sm text-gray-500">
			<p>Last updated: November 2025</p>
			<p>This policy applies to internal use of the {platform.name}, including course management and formation programs.</p>
		</footer>
	</div>
</div>