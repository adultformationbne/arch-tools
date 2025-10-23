#!/usr/bin/env python3
"""
Import Ordo, Lectionary, and mapping data using raw SQL.
This bypasses the need for Supabase client libraries.
"""

import csv
import json

def escape_sql_string(value):
    """Escape single quotes in SQL strings"""
    if value is None:
        return 'NULL'
    return "'" + str(value).replace("'", "''") + "'"

def generate_ordo_inserts():
    """Generate SQL INSERT statements for Ordo calendar"""
    with open('data/generated/ordo_normalized.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = []
        for row in reader:
            year = int(row['year'])
            cycles = ['C', 'A', 'B']
            year_cycle = cycles[(year - 2025) % 3]

            calendar_date = escape_sql_string(row['calendar_date'])
            liturgical_year = year
            liturgical_season = escape_sql_string(row['liturgical_season']) if row['liturgical_season'] else 'NULL'
            liturgical_week = row['liturgical_week'] if row['liturgical_week'] else 'NULL'
            liturgical_name = escape_sql_string(row['liturgical_name'])
            liturgical_rank = escape_sql_string(row['liturgical_rank']) if row['liturgical_rank'] else 'NULL'
            year_cycle_val = escape_sql_string(year_cycle)

            rows.append(f"({calendar_date}, {liturgical_year}, {liturgical_season}, {liturgical_week}, {liturgical_name}, {liturgical_rank}, {year_cycle_val})")

        # Create batched INSERT statements
        batch_size = 50
        sql_statements = []
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            sql = f"""
INSERT INTO ordo_calendar (calendar_date, liturgical_year, liturgical_season, liturgical_week, liturgical_name, liturgical_rank, year_cycle)
VALUES {', '.join(batch)};
"""
            sql_statements.append(sql.strip())

        return sql_statements, len(rows)

def generate_lectionary_inserts():
    """Generate SQL INSERT statements for Lectionary"""
    with open('data/source/Lectionary.csv', 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = []
        for row in reader:
            admin_order = row.get('Admin Order', '').strip()
            if not admin_order:
                continue

            admin_order_val = admin_order
            year = escape_sql_string(row.get('Year', '').strip()) if row.get('Year', '').strip() else 'NULL'
            week = escape_sql_string(row.get('Week', '').strip()) if row.get('Week', '').strip() else 'NULL'
            day = escape_sql_string(row.get('Day', '').strip()) if row.get('Day', '').strip() else 'NULL'
            time = escape_sql_string(row.get('Time', '').strip()) if row.get('Time', '').strip() else 'NULL'
            liturgical_day = escape_sql_string(row.get('Liturgical Day', '').strip())
            first_reading = escape_sql_string(row.get('First Reading', '').strip()) if row.get('First Reading', '').strip() else 'NULL'
            psalm = escape_sql_string(row.get('Psalm', '').strip()) if row.get('Psalm', '').strip() else 'NULL'
            second_reading = escape_sql_string(row.get('Second Reading', '').strip()) if row.get('Second Reading', '').strip() else 'NULL'
            gospel_reading = escape_sql_string(row.get('Gospel Reading', '').strip()) if row.get('Gospel Reading', '').strip() else 'NULL'

            rows.append(f"({admin_order_val}, {year}, {week}, {day}, {time}, {liturgical_day}, {first_reading}, {psalm}, {second_reading}, {gospel_reading})")

        # Create batched INSERT statements
        batch_size = 50
        sql_statements = []
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            sql = f"""
INSERT INTO lectionary (admin_order, year, week, day, time, liturgical_day, first_reading, psalm, second_reading, gospel_reading)
VALUES {', '.join(batch)};
"""
            sql_statements.append(sql.strip())

        return sql_statements, len(rows)

def generate_mapping_inserts():
    """Generate SQL INSERT statements for Ordo-Lectionary mapping"""
    with open('data/generated/ordo_lectionary_mapping.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = []
        for row in reader:
            calendar_date = escape_sql_string(row['calendar_date'])
            lectionary_id = row.get('lectionary_id', '').strip()
            lectionary_id_val = lectionary_id if lectionary_id else 'NULL'
            match_type = escape_sql_string(row['match_type'])
            match_method = escape_sql_string(row.get('match_method', '').strip()) if row.get('match_method', '').strip() else 'NULL'

            rows.append(f"({calendar_date}, {lectionary_id_val}, {match_type}, {match_method})")

        # Create batched INSERT statements
        batch_size = 50
        sql_statements = []
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            sql = f"""
INSERT INTO ordo_lectionary_mapping (calendar_date, lectionary_id, match_type, match_method)
VALUES {', '.join(batch)};
"""
            sql_statements.append(sql.strip())

        return sql_statements, len(rows)

def main():
    print("=" * 80)
    print("GENERATING SQL INSERT STATEMENTS")
    print("=" * 80)

    print("\nGenerating Ordo inserts...")
    ordo_sql, ordo_count = generate_ordo_inserts()
    print(f"  Generated {len(ordo_sql)} SQL statements for {ordo_count} Ordo entries")

    print("\nGenerating Lectionary inserts...")
    lect_sql, lect_count = generate_lectionary_inserts()
    print(f"  Generated {len(lect_sql)} SQL statements for {lect_count} Lectionary entries")

    print("\nGenerating mapping inserts...")
    map_sql, map_count = generate_mapping_inserts()
    print(f"  Generated {len(map_sql)} SQL statements for {map_count} mapping entries")

    # Save to files for manual execution
    with open('data/generated/ordo_import.sql', 'w', encoding='utf-8') as f:
        f.write('\n\n'.join(ordo_sql))
    print(f"\n✅ Saved Ordo SQL to: data/generated/ordo_import.sql")

    with open('data/generated/lectionary_import.sql', 'w', encoding='utf-8') as f:
        f.write('\n\n'.join(lect_sql))
    print(f"✅ Saved Lectionary SQL to: data/generated/lectionary_import.sql")

    with open('data/generated/mapping_import.sql', 'w', encoding='utf-8') as f:
        f.write('\n\n'.join(map_sql))
    print(f"✅ Saved Mapping SQL to: data/generated/mapping_import.sql")

    # Print first statement as sample
    print("\n" + "=" * 80)
    print("SAMPLE SQL (first Ordo insert):")
    print("=" * 80)
    print(ordo_sql[0])

if __name__ == '__main__':
    main()
