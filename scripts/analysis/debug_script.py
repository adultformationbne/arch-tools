#!/usr/bin/env python3
"""Debug exactly what's happening in the filtering"""
import json

# Load evaluations
with open('evaluation.json', 'r') as f:
    eval_data = json.load(f)
    evaluated_ids = {e['block_id'] for e in eval_data['evaluations']}

# Load master JSON  
with open('editor-app/static/AHWGP_master.json', 'r') as f:
    data = json.load(f)

blocks_to_process = []
skipped_reasons = {'already_evaluated': 0, 'not_paragraph': 0, 'special_metadata': 0, 'too_short': 0}

for i, block in enumerate(data['blocks']):
    block_id = block.get('id')
    
    # Skip if already evaluated
    if block_id in evaluated_ids:
        skipped_reasons['already_evaluated'] += 1
        continue
        
    # Only process paragraph blocks
    if block.get('tag') != 'paragraph':
        skipped_reasons['not_paragraph'] += 1
        continue
        
    # Skip blocks with special metadata
    special_keys = ['prayer-page', 'reflection', 'special_type', 'metadata']
    if any(key in block for key in special_keys):
        skipped_reasons['special_metadata'] += 1
        print(f"Skipping {block_id} due to special metadata: {[k for k in special_keys if k in block]}")
        continue
        
    # Skip empty or very short content blocks
    content = block.get('content', '')
    if not content or len(content.strip()) < 10:
        skipped_reasons['too_short'] += 1
        continue
        
    blocks_to_process.append(block)
    if len(blocks_to_process) <= 3:  # Show first few
        print(f"Would process: {block_id} - {content[:50]}...")

print(f"\\nSkip reasons: {skipped_reasons}")
print(f"Blocks to process: {len(blocks_to_process)}")