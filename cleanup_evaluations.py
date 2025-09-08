#!/usr/bin/env python3
"""
Clean up evaluation.json to only keep paragraph blocks
"""
import json

# Load existing evaluations
with open('evaluation.json', 'r') as f:
    data = json.load(f)

# Filter to only paragraph blocks
paragraph_evaluations = []
for evaluation in data['evaluations']:
    if evaluation.get('tag') == 'paragraph' or 'content_full' in evaluation:
        paragraph_evaluations.append(evaluation)

# Update metadata
data['evaluations'] = paragraph_evaluations
data['metadata']['total_evaluations'] = len(paragraph_evaluations)
data['metadata']['successful_evaluations'] = len([e for e in paragraph_evaluations if 'scores' in e])
data['metadata']['failed_evaluations'] = len([e for e in paragraph_evaluations if 'error' in e])

# Save cleaned data
with open('evaluation_cleaned.json', 'w') as f:
    json.dump(data, f, indent=2)

print(f"Cleaned evaluations saved to evaluation_cleaned.json")
print(f"Total paragraph evaluations: {len(paragraph_evaluations)}")
print(f"Original had {len(data['evaluations'])} evaluations")