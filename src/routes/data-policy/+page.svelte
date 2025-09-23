<script>
	import { page } from '$app/stores';
	export let data;
	$: ({ session } = data);
</script>

<svelte:head>
	<title>Data Handling Policy - Archdiocesan Ministry Tools</title>
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-4xl">
	<div class="bg-white shadow-lg rounded-lg p-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-6">Data Handling Policy</h1>
		<p class="text-sm text-gray-600 mb-8">Internal Use - Archdiocesan Ministry Staff</p>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">What This Platform Does</h2>
			<p class="text-gray-700 mb-4">
				The Archdiocesan Ministry Tools platform is an internal content management system that helps staff organize and publish Catholic liturgical content, including:
			</p>
			<ul class="list-disc list-inside text-gray-700 space-y-2 ml-4">
				<li>Daily Gospel Reflections (DGR) scheduling and publishing</li>
				<li>Scripture reading organization from public liturgical calendars</li>
				<li>Content editing and version management for publications</li>
				<li>User account management for internal staff access</li>
			</ul>
		</section>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">Data We Store</h2>

			<div class="space-y-6">
				<div class="bg-blue-50 p-4 rounded-lg">
					<h3 class="font-medium text-gray-800 mb-2">Data We Can Access (stored in our database)</h3>
					<ul class="list-disc list-inside text-gray-700 space-y-1 ml-4">
						<li>Work email addresses and staff names</li>
						<li>User roles and permissions (admin, editor, contributor, viewer)</li>
						<li>Content editing activity logs and version history</li>
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
					<h3 class="font-medium text-gray-800">Public Content We Organize</h3>
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
				<li><strong>Role-based access:</strong> Staff can only access content appropriate to their role</li>
				<li><strong>Secure hosting:</strong> Data stored on Supabase's secure PostgreSQL infrastructure</li>
				<li><strong>Version control:</strong> All content changes are logged with timestamps and user attribution</li>
				<li><strong>Token-based submissions:</strong> Public contributors access content via secure, time-limited tokens</li>
			</ul>
		</section>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">Data Retention</h2>
			<ul class="list-disc list-inside text-gray-700 space-y-2 ml-4">
				<li><strong>Content:</strong> All content versions are preserved for historical reference and audit purposes</li>
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
				<li>Only access and modify content within your assigned role</li>
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
			<p>Last updated: September 2025</p>
			<p>This policy applies to internal use of the Archdiocesan Ministry Tools platform.</p>
		</footer>
	</div>
</div>