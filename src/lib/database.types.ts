export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	graphql_public: {
		Tables: {
			[_ in never]: never;
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			graphql: {
				Args: {
					variables?: Json;
					operationName?: string;
					query?: string;
					extensions?: Json;
				};
				Returns: Json;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	public: {
		Tables: {
			admin_settings: {
				Row: {
					created_at: string | null;
					description: string | null;
					id: string;
					setting_key: string;
					setting_value: Json;
					updated_at: string | null;
				};
				Insert: {
					created_at?: string | null;
					description?: string | null;
					id?: string;
					setting_key: string;
					setting_value: Json;
					updated_at?: string | null;
				};
				Update: {
					created_at?: string | null;
					description?: string | null;
					id?: string;
					setting_key?: string;
					setting_value?: Json;
					updated_at?: string | null;
				};
				Relationships: [];
			};
			blocks: {
				Row: {
					block_id: string;
					chapter_id: string | null;
					content: string;
					created_at: string | null;
					created_by: string | null;
					id: string;
					metadata: Json | null;
					tag: string;
				};
				Insert: {
					block_id: string;
					chapter_id?: string | null;
					content: string;
					created_at?: string | null;
					created_by?: string | null;
					id?: string;
					metadata?: Json | null;
					tag: string;
				};
				Update: {
					block_id?: string;
					chapter_id?: string | null;
					content?: string;
					created_at?: string | null;
					created_by?: string | null;
					id?: string;
					metadata?: Json | null;
					tag?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'blocks_chapter_id_fkey';
						columns: ['chapter_id'];
						isOneToOne: false;
						referencedRelation: 'chapters';
						referencedColumns: ['id'];
					}
				];
			};
			books: {
				Row: {
					auto_add_on_paste: boolean | null;
					blocks: Json;
					created_at: string | null;
					created_by: string | null;
					custom_tags: Json | null;
					document_title: string;
					id: string;
					parent_version_id: string | null;
					reverse_order: boolean | null;
					version: string | null;
				};
				Insert: {
					auto_add_on_paste?: boolean | null;
					blocks: Json;
					created_at?: string | null;
					created_by?: string | null;
					custom_tags?: Json | null;
					document_title?: string;
					id?: string;
					parent_version_id?: string | null;
					reverse_order?: boolean | null;
					version?: string | null;
				};
				Update: {
					auto_add_on_paste?: boolean | null;
					blocks?: Json;
					created_at?: string | null;
					created_by?: string | null;
					custom_tags?: Json | null;
					document_title?: string;
					id?: string;
					parent_version_id?: string | null;
					reverse_order?: boolean | null;
					version?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'books_parent_version_id_fkey';
						columns: ['parent_version_id'];
						isOneToOne: false;
						referencedRelation: 'books';
						referencedColumns: ['id'];
					}
				];
			};
			chapters: {
				Row: {
					block_id: string;
					chapter_number: number;
					created_at: string | null;
					id: string;
					title: string;
				};
				Insert: {
					block_id: string;
					chapter_number: number;
					created_at?: string | null;
					id?: string;
					title: string;
				};
				Update: {
					block_id?: string;
					chapter_number?: number;
					created_at?: string | null;
					id?: string;
					title?: string;
				};
				Relationships: [];
			};
			dgr_contributors: {
				Row: {
					active: boolean | null;
					created_at: string | null;
					email: string;
					id: string;
					name: string;
					notes: string | null;
					preferred_days: number[] | null;
					updated_at: string | null;
				};
				Insert: {
					active?: boolean | null;
					created_at?: string | null;
					email: string;
					id?: string;
					name: string;
					notes?: string | null;
					preferred_days?: number[] | null;
					updated_at?: string | null;
				};
				Update: {
					active?: boolean | null;
					created_at?: string | null;
					email?: string;
					id?: string;
					name?: string;
					notes?: string | null;
					preferred_days?: number[] | null;
					updated_at?: string | null;
				};
				Relationships: [];
			};
			dgr_email_queue: {
				Row: {
					body: string;
					created_at: string | null;
					email_type: Database['public']['Enums']['dgr_email_type'];
					error_message: string | null;
					id: string;
					recipient_email: string;
					schedule_id: string | null;
					sent_at: string | null;
					status: Database['public']['Enums']['dgr_email_status'] | null;
					subject: string;
				};
				Insert: {
					body: string;
					created_at?: string | null;
					email_type: Database['public']['Enums']['dgr_email_type'];
					error_message?: string | null;
					id?: string;
					recipient_email: string;
					schedule_id?: string | null;
					sent_at?: string | null;
					status?: Database['public']['Enums']['dgr_email_status'] | null;
					subject: string;
				};
				Update: {
					body?: string;
					created_at?: string | null;
					email_type?: Database['public']['Enums']['dgr_email_type'];
					error_message?: string | null;
					id?: string;
					recipient_email?: string;
					schedule_id?: string | null;
					sent_at?: string | null;
					status?: Database['public']['Enums']['dgr_email_status'] | null;
					subject?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'dgr_email_queue_schedule_id_fkey';
						columns: ['schedule_id'];
						isOneToOne: false;
						referencedRelation: 'dgr_schedule';
						referencedColumns: ['id'];
					}
				];
			};
			dgr_schedule: {
				Row: {
					approved_at: string | null;
					contributor_email: string | null;
					contributor_id: string | null;
					created_at: string | null;
					date: string;
					gospel_reference: string | null;
					gospel_text: string | null;
					id: string;
					liturgical_date: string | null;
					published_at: string | null;
					reflection_content: string | null;
					reflection_title: string | null;
					status: Database['public']['Enums']['dgr_status'] | null;
					submission_token: string | null;
					submitted_at: string | null;
					updated_at: string | null;
				};
				Insert: {
					approved_at?: string | null;
					contributor_email?: string | null;
					contributor_id?: string | null;
					created_at?: string | null;
					date: string;
					gospel_reference?: string | null;
					gospel_text?: string | null;
					id?: string;
					liturgical_date?: string | null;
					published_at?: string | null;
					reflection_content?: string | null;
					reflection_title?: string | null;
					status?: Database['public']['Enums']['dgr_status'] | null;
					submission_token?: string | null;
					submitted_at?: string | null;
					updated_at?: string | null;
				};
				Update: {
					approved_at?: string | null;
					contributor_email?: string | null;
					contributor_id?: string | null;
					created_at?: string | null;
					date?: string;
					gospel_reference?: string | null;
					gospel_text?: string | null;
					id?: string;
					liturgical_date?: string | null;
					published_at?: string | null;
					reflection_content?: string | null;
					reflection_title?: string | null;
					status?: Database['public']['Enums']['dgr_status'] | null;
					submission_token?: string | null;
					submitted_at?: string | null;
					updated_at?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'dgr_schedule_contributor_id_fkey';
						columns: ['contributor_id'];
						isOneToOne: false;
						referencedRelation: 'dgr_contributors';
						referencedColumns: ['id'];
					}
				];
			};
			editor_logs: {
				Row: {
					action_type: string;
					block_id: string | null;
					changes: Json | null;
					created_at: string | null;
					entity_id: string | null;
					entity_type: string;
					id: string;
					user_id: string | null;
				};
				Insert: {
					action_type: string;
					block_id?: string | null;
					changes?: Json | null;
					created_at?: string | null;
					entity_id?: string | null;
					entity_type: string;
					id?: string;
					user_id?: string | null;
				};
				Update: {
					action_type?: string;
					block_id?: string | null;
					changes?: Json | null;
					created_at?: string | null;
					entity_id?: string | null;
					entity_type?: string;
					id?: string;
					user_id?: string | null;
				};
				Relationships: [];
			};
		};
		Views: {
			complete_books: {
				Row: {
					block_count: number | null;
					blocks: Json | null;
					book_id: string | null;
					created_at: string | null;
					document_title: string | null;
					version: string | null;
				};
				Relationships: [];
			};
		};
		Functions: {
			assign_contributor_to_date: {
				Args: { target_date: string };
				Returns: string;
			};
			generate_submission_token: {
				Args: Record<PropertyKey, never>;
				Returns: string;
			};
			get_book_by_chapters: {
				Args: { book_id_param?: string };
				Returns: {
					chapter_number: number;
					chapter_title: string;
					chapter_id: string;
					document_title: string;
					book_id: string;
					blocks: Json;
				}[];
			};
			get_complete_book: {
				Args: { book_id_param?: string };
				Returns: {
					created_at: string;
					version: string;
					book_id: string;
					document_title: string;
					blocks: Json;
				}[];
			};
		};
		Enums: {
			dgr_email_status: 'pending' | 'sent' | 'failed';
			dgr_email_type: 'assignment' | 'reminder' | 'approval' | 'published';
			dgr_status: 'pending' | 'submitted' | 'approved' | 'published';
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DefaultSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof Database },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof Database;
	}
		? keyof (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
				Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])
		: never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
	? (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
			Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof Database },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof Database;
	}
		? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
	? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof Database },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof Database;
	}
		? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
	? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof Database },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof Database;
	}
		? keyof Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
	? Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
		? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema['CompositeTypes']
		| { schema: keyof Database },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof Database;
	}
		? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
	? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
		? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	graphql_public: {
		Enums: {}
	},
	public: {
		Enums: {
			dgr_email_status: ['pending', 'sent', 'failed'],
			dgr_email_type: ['assignment', 'reminder', 'approval', 'published'],
			dgr_status: ['pending', 'submitted', 'approved', 'published']
		}
	}
} as const;
