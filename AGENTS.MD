USE THE SUPABASE MCP FOR ANY SCHEMA CHECKS AND MIGRATIONS.

# Supabase MCP Workflow

- Call `mcp__supabase__list_tables({ schemas: ["public"] })` to inspect table definitions, row counts, constraints, and RLS flags before proposing schema changes.
- Run `mcp__supabase__list_migrations()` to review applied migrations and confirm naming/version ordering prior to creating new migrations.
- Use `mcp__supabase__get_advisors({ type: "security" | "performance" })` after every change; the response includes remediation links that highlight necessary follow-up fixes.
- Leverage `mcp__supabase__list_extensions()` when planning functionality that relies on Postgres extensions.
- Query documentation through `mcp__supabase__search_docs` when you need the latest Supabase guidance.

# Tips From Recent Testing

- Most endpoints expect specific argument shapes; avoid passing unused keys (for example, `list_migrations` must be called with an empty object).
- Responses often arrive as JSON strings; copy them into a formatter when you need to scan large outputs quickly.
- Advisor warnings surface actionable security items (e.g. SECURITY DEFINER views, RLS gaps); incorporate them into review checklists.
- Schema calls can produce large payloads—filter by schema or narrow to relevant tables to keep responses manageable.

# Migration Execution

- Draft DDL in a migration file and apply it with `mcp__supabase__apply_migration({ name, query })` once reviewed.
- For data fixes, prefer `mcp__supabase__execute_sql({ query })` and reference IDs via queries, not hardcoded literals.
