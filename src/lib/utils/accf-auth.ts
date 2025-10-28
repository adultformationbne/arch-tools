import type { SupabaseClient } from '@supabase/supabase-js';

export type ACCFRole = 'courses_student' | 'courses_admin' | 'hub_coordinator' | 'admin';

export interface ACCFUser {
	id: string;
	email: string;
	role: ACCFRole;
	full_name?: string;
	display_name?: string;
}

/**
 * Create a new ACCF user with the specified role
 * This function assumes the auth user already exists in auth.users
 */
export async function createACCFUser(
	supabase: SupabaseClient,
	userId: string,
	email: string,
	role: ACCFRole,
	fullName?: string
) {
	try {
		const { data, error } = await supabase
			.from('user_profiles')
			.insert([
				{
					id: userId,
					email,
					role,
					full_name: fullName || email.split('@')[0],
					display_name: fullName || email.split('@')[0]
				}
			])
			.select()
			.single();

		if (error) throw error;
		return { success: true, user: data };
	} catch (error) {
		console.error('Error creating ACCF user:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Enroll a student in a cohort
 */
export async function enrollStudent(
	supabase: SupabaseClient,
	userId: string,
	cohortId: string,
	hubId?: string,
	assignedAdminId?: string
) {
	try {
		const { data, error } = await supabase
			.from('enrollments')
			.insert([
				{
					user_id: userId,
					cohort_id: cohortId,
					hub_id: hubId,
					current_week: 1,
					status: 'active',
					assigned_admin_id: assignedAdminId
				}
			])
			.select()
			.single();

		if (error) throw error;
		return { success: true, enrollment: data };
	} catch (error) {
		console.error('Error enrolling student:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Get user role from profile
 */
export async function getUserRole(supabase: SupabaseClient, userId: string): Promise<ACCFRole | null> {
	try {
		const { data, error } = await supabase
			.from('user_profiles')
			.select('role')
			.eq('id', userId)
			.single();

		if (error) throw error;
		return data.role as ACCFRole;
	} catch (error) {
		console.error('Error fetching user role:', error);
		return null;
	}
}

/**
 * Check if user has permission for ACCF routes
 */
export function hasACCFAccess(role: string | null): boolean {
	return ['courses_student', 'courses_admin', 'admin', 'hub_coordinator'].includes(role || '');
}

/**
 * Check if user has admin permissions
 */
export function hasAdminAccess(role: string | null): boolean {
	return ['courses_admin', 'admin'].includes(role || '');
}

/**
 * Get appropriate redirect URL based on user role
 */
export function getDefaultRedirect(role: string | null): string {
	switch (role) {
		case 'courses_student':
			return '/dashboard';
		case 'courses_admin':
		case 'admin':
			return '/admin';
		case 'hub_coordinator':
			return '/dashboard'; // For now, hub coordinators use student interface
		default:
			return '/';
	}
}