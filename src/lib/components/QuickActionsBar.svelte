<script>
	import { ArrowRight, MessageSquare, Users } from 'lucide-svelte';

	let { cohort, students, onAdvance, onAttendance } = $props();

	// Calculate stats
	const studentsReadyCount = $derived(
		students?.filter(
			(s) => s.status === 'active' && s.current_session === cohort?.current_session
		).length || 0
	);

	const nextSession = $derived((cohort?.current_session || 1) + 1);

	const pendingReflectionsCount = $derived(
		students?.filter(
			(s) =>
				s.status === 'active' &&
				s.current_session > 1 &&
				(!s.latest_reflection_status || s.latest_reflection_status === 'pending')
		).length || 0
	);

	const currentSession = $derived(cohort?.current_session || 1);

	const attendanceMarkedCount = $derived(
		students?.filter((s) => s.attendance_marked_for_current_session).length || 0
	);

	const totalStudents = $derived(students?.filter((s) => s.status === 'active').length || 0);
</script>

<div class="quick-actions">
	<button class="action-card" onclick={onAdvance}>
		<div class="action-icon advance">
			<ArrowRight size={24} />
		</div>
		<div class="action-content">
			<h3>Advance Students</h3>
			<p class="action-meta">{studentsReadyCount} ready for Session {nextSession}</p>
			<div class="action-button">Advance & Email</div>
		</div>
	</button>

	<a href="/admin/reflections?cohort={cohort?.id}" class="action-card">
		<div class="action-icon reflections">
			<MessageSquare size={24} />
		</div>
		<div class="action-content">
			<h3>Mark Reflections</h3>
			<p class="action-meta">{pendingReflectionsCount} pending reviews</p>
			<div class="action-button">View All</div>
		</div>
	</a>

	<button class="action-card" onclick={onAttendance}>
		<div class="action-icon attendance">
			<Users size={24} />
		</div>
		<div class="action-content">
			<h3>Record Attendance</h3>
			<p class="action-meta">
				Session {currentSession} - {attendanceMarkedCount}/{totalStudents} marked
			</p>
			<div class="action-button">Mark Attendance</div>
		</div>
	</button>
</div>

<style>
	.quick-actions {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.action-card {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		padding: 1.5rem;
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		transition: all 0.2s;
		cursor: pointer;
		text-decoration: none;
		color: inherit;
	}

	.action-card:hover {
		border-color: var(--course-accent-light, #c59a6b);
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		transform: translateY(-2px);
	}

	.action-icon {
		width: 48px;
		height: 48px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.action-icon.advance {
		background: rgba(34, 197, 94, 0.1);
		color: #16a34a;
	}

	.action-icon.reflections {
		background: rgba(59, 130, 246, 0.1);
		color: #2563eb;
	}

	.action-icon.attendance {
		background: rgba(168, 85, 247, 0.1);
		color: #9333ea;
	}

	.action-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.action-content h3 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--course-accent-darkest, #1e2322);
		margin: 0;
	}

	.action-meta {
		font-size: 0.875rem;
		color: #6b7280;
		margin: 0;
	}

	.action-button {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--course-accent-light, #c59a6b);
		margin-top: 0.25rem;
	}

	@media (max-width: 768px) {
		.quick-actions {
			grid-template-columns: 1fr;
		}
	}
</style>