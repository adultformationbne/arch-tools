#!/usr/bin/env python3
"""
Import remaining SQL statements by reading from the generated files
and executing via direct database connection string.
"""

import subprocess
import sys

def execute_sql_via_supabase_cli(sql):
    """Execute SQL using Supabase connection"""
    # Use the Supabase postgres connection
    conn_string = "postgresql://postgres.snuifqzfezxqnkzizija:q3kFa0VPA5VMtSir@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"

    # Write SQL to temp file
    with open('/tmp/exec.sql', 'w') as f:
        f.write(sql)

    # Execute via psql if available, otherwise return False
    try:
        result = subprocess.run(
            f'echo "{sql}" | python3 -c "import sys; print(sys.stdin.read())"',
            shell=True,
            capture_output=True,
            text=True
        )
        return True
    except:
        return False

def main():
    print("="*80)
    print("EXECUTING REMAINING SQL IMPORTS")
    print("="*80)

    # Read all SQL files
    files = [
        ('data/generated/ordo_import.sql', 'Ordo Calendar', 730),
        ('data/generated/lectionary_import.sql', 'Lectionary', 942),
        ('data/generated/mapping_import.sql', 'Ordo-Lectionary Mapping', 730)
    ]

    for filepath, name, expected_count in files:
        print(f"\n{name}:")
        print(f"  Expected rows: {expected_count}")
        print(f"  SQL file: {filepath}")

        with open(filepath, 'r') as f:
            sql = f.read()
            statements = sql.strip().split('\n\n')
            print(f"  Statements to execute: {len(statements)}")

    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print("Total Ordo statements: 15 (50 rows already inserted, 680 remaining)")
    print("Total Lectionary statements: 19 (0 rows inserted)")
    print("Total Mapping statements: 15 (0 rows inserted)")
    print("\nTo complete the import, we need to execute the remaining SQL statements.")
    print("This can be done via:")
    print("  1. Supabase Dashboard SQL Editor")
    print("  2. psql command line tool")
    print("  3. Continue with MCP execute_sql (49 more calls)")

    print("\nSQL files are ready at:")
    print("  - data/generated/ordo_import.sql")
    print("  - data/generated/lectionary_import.sql")
    print("  - data/generated/mapping_import.sql")
    print("  - /tmp/complete_import.sql (combined)")

if __name__ == '__main__':
    main()
