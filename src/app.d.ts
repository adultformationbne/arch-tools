// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		// interface Error {}
		interface CourseTheme {
			accentLight: string;
			accentDark: string;
			accentDarkest: string;
			surface: string;
			lightest: string;
			textOnDark: string;
			textOnLight: string;
			borderMuted: string;
			fontFamily: string;
			navBackground: string;
		}

		interface CourseBranding {
			logoUrl: string;
			showLogo: boolean;
			title: string | null;
		}

		interface CourseInfo {
			id: string;
			name: string | null;
		}

		interface Locals {
			supabase: SupabaseClient;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
		}
		interface PageData {
			session: Session | null;
			user: User | null;
			userProfile: any | null;
			isCoursesRoute: boolean;
			courseTheme: CourseTheme;
			courseBranding: CourseBranding;
			courseInfo: CourseInfo | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
