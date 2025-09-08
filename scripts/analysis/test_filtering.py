#!/usr/bin/env python3
"""Test the filtering logic"""
import json

# Load evaluations
with open('evaluation.json', 'r') as f:
    eval_data = json.load(f)
    evaluated_ids = {e['block_id'] for e in eval_data['evaluations']}

# Load master JSON  
with open('editor-app/static/AHWGP_master.json', 'r') as f:
    data = json.load(f)

print(f"Evaluated IDs count: {len(evaluated_ids)}")
print(f"Sample evaluated IDs: {list(evaluated_ids)[:3]}")

blocks_to_process = []
for block in data['blocks']:
    # Skip if already evaluated
    if block.get('id') in evaluated_ids:
        continue
        
    # Only process paragraph blocks
    if block.get('tag') != 'paragraph':
        continue
        
    # Skip blocks with special metadata
    if any(key in block for key in ['prayer-page', 'reflection', 'special_type', 'metadata']):
        continue
        
    # Skip empty or very short content blocks
    content = block.get('content', '')
    if not content or len(content.strip()) < 10:
        print(f"Skipping short block {block.get('id')}: {len(content)} chars")
        continue
        
    blocks_to_process.append(block)

print(f"Blocks to process: {len(blocks_to_process)}")
if blocks_to_process:
    print(f"First unprocessed: {blocks_to_process[0]['id']} - {blocks_to_process[0]['content'][:50]}...")