#!/usr/bin/env python3
"""Remove duplicate evaluations and keep only successful ones"""
import json

with open('evaluation.json', 'r') as f:
    data = json.load(f)

# Remove duplicates, keeping only the first occurrence
seen_ids = set()
unique_evaluations = []

for evaluation in data['evaluations']:
    block_id = evaluation.get('block_id')
    if block_id not in seen_ids:
        seen_ids.add(block_id)
        # Only keep if it has scores (successful) or we want to keep errors
        if 'scores' in evaluation and evaluation['scores']:
            unique_evaluations.append(evaluation)

# Update metadata
data['evaluations'] = unique_evaluations
data['metadata']['total_evaluations'] = len(unique_evaluations)
data['metadata']['successful_evaluations'] = len([e for e in unique_evaluations if 'scores' in e])
data['metadata']['failed_evaluations'] = len([e for e in unique_evaluations if 'error' in e])

# Save cleaned data
with open('evaluation.json', 'w') as f:
    json.dump(data, f, indent=2)

print(f"Cleaned evaluations: {len(unique_evaluations)} unique entries")
print(f"Removed {len(seen_ids) - len(unique_evaluations)} duplicates/errors")