#!/usr/bin/env python3
"""
Content Analysis Script with Local LLM
Analyzes paragraph blocks from AHWGP_master.json using local Ollama LLM
Generates structured evaluations for relatability, historical focus, etc.
"""

import json
import requests
import time
from pathlib import Path
from typing import Dict, List, Any
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ContentAnalyzer:
    def __init__(self, ollama_url: str = "http://localhost:11434", model: str = "llama3.1:8b"):
        self.ollama_url = ollama_url
        self.model = model
        self.evaluation_data = []
        
    def test_ollama_connection(self) -> bool:
        """Test if Ollama is running and accessible"""
        try:
            response = requests.get(f"{self.ollama_url}/api/tags")
            if response.status_code == 200:
                models = response.json()
                logger.info(f"Ollama connected. Available models: {[m['name'] for m in models['models']]}")
                return True
            else:
                logger.error(f"Ollama connection failed with status: {response.status_code}")
                return False
        except requests.exceptions.ConnectionError:
            logger.error("Cannot connect to Ollama. Make sure it's running on localhost:11434")
            return False
    
    def analyze_content_block(self, block: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze a single content block with the LLM"""
        
        # Extract relevant content
        block_id = block.get('id', 'unknown')
        content = block.get('content', '')
        tag = block.get('tag', 'unknown')
        
        # Skip empty or very short content
        if not content or len(content.strip()) < 10:
            return {
                "block_id": block_id,
                "error": "Content too short or empty",
                "scores": {}
            }
        
        # Create analysis prompt  
        prompt = f"""You are a focus group moderator testing content for adults exploring Catholic faith. 

IMAGINE: You're sitting with 10 regular people (teachers, nurses, mechanics, etc.) who are curious about Catholicism but know very little. You're reading this text aloud. Would they:
- Nod and say "I totally get that" OR look confused and bored?
- Feel personally connected OR think "this doesn't apply to me"?
- Be inspired OR find it dry and academic?

BE BRUTALLY HONEST about how REAL PEOPLE would react.

Text: "{content}"

Score this text on each dimension (1-10 scale):

1. relatability (1-10): Would regular people say "That's exactly how I feel!"?
   - 9-10: Everyone nods - talks about love, fear, hope, family struggles 
   - 5-6: Some people relate - general life themes but not deeply personal
   - 1-3: Eyes glaze over - bureaucratic procedures, technical instructions

2. historical_focus (1-10): Is this about ancient history or today?
   - 9-10: Lots of "back in Biblical times" and old Church stories
   - 5-6: Some history mixed with modern application
   - 1-3: All about faith in today's world

3. theological_depth (1-10): Would people need a theology degree to understand this?
   - 9-10: Seminary textbook language - doctrine, Latin, complex theory
   - 5-6: College-level concepts but still accessible
   - 1-3: Simple spiritual ideas anyone can grasp

4. practical_application (1-10): Can people walk out and actually DO something?
   - 9-10: Crystal clear action steps: "Pray this way, do this practice"
   - 5-6: Some hints about how to live/act but vague
   - 1-3: Just information - no clear actions to take

5. accessibility (1-10): Would a complete beginner understand this easily?
   - 9-10: Uses everyday language, explains any church terms
   - 5-6: Mostly clear but assumes some basic knowledge
   - 1-3: Full of jargon, assumes lots of Catholic background

6. emotional_resonance (1-10): Would this give people goosebumps or put them to sleep?
   - 9-10: Brings tears, chills, deep inspiration - really moves people
   - 5-6: Pleasant and interesting but not emotionally powerful
   - 1-3: Dry as a technical manual, boring, academic

REMEMBER: You're looking for content that would make people lean forward and engage, not check their phones. Score based on how REAL PEOPLE would actually react.

Return your honest assessment as JSON:
{{
    "relatability": [1-10],
    "historical_focus": [1-10], 
    "theological_depth": [1-10],
    "practical_application": [1-10],
    "accessibility": [1-10],
    "emotional_resonance": [1-10],
    "key_themes": ["extract", "real", "themes", "from", "this", "content"],
    "content_type_analysis": "explain why you scored it this way"
}}
"""
        
        try:
            # Make request to Ollama
            response = requests.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,  # Higher temperature for more varied, thoughtful responses
                        "num_predict": 500   # Limit response length
                    }
                },
                timeout=120
            )
            
            if response.status_code == 200:
                result = response.json()
                llm_response = result['response'].strip()
                
                # Try to parse JSON from LLM response
                try:
                    # Extract JSON from response (sometimes LLM adds extra text)
                    start_idx = llm_response.find('{')
                    end_idx = llm_response.rfind('}') + 1
                    if start_idx != -1 and end_idx != -1:
                        json_str = llm_response[start_idx:end_idx]
                        scores = json.loads(json_str)
                    else:
                        # Fallback: try parsing entire response
                        scores = json.loads(llm_response)
                    
                    # Validate and clean scores
                    validated_scores = self.validate_scores(scores)
                    
                    return {
                        "block_id": block_id,
                        "content_full": content,  # Store full content instead of preview
                        "tag": tag,
                        "scores": validated_scores,
                        "analysis_timestamp": time.time()
                    }
                    
                except json.JSONDecodeError as e:
                    logger.warning(f"Failed to parse JSON for block {block_id}: {e}")
                    logger.warning(f"LLM Response: {llm_response[:200]}...")
                    return {
                        "block_id": block_id,
                        "error": f"JSON parse error: {str(e)}",
                        "raw_response": llm_response[:200]
                    }
            else:
                logger.error(f"Ollama request failed for block {block_id}: {response.status_code}")
                return {
                    "block_id": block_id,
                    "error": f"Request failed with status {response.status_code}"
                }
                
        except requests.exceptions.Timeout:
            logger.warning(f"Timeout analyzing block {block_id}")
            return {
                "block_id": block_id,
                "error": "Request timeout"
            }
        except Exception as e:
            logger.error(f"Unexpected error analyzing block {block_id}: {e}")
            return {
                "block_id": block_id,
                "error": f"Unexpected error: {str(e)}"
            }
    
    def validate_scores(self, scores: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and clean score data from LLM"""
        expected_metrics = [
            'relatability', 'historical_focus', 'theological_depth',
            'practical_application', 'accessibility', 'emotional_resonance'
        ]
        
        validated = {}
        
        # Validate numeric scores (1-10)
        for metric in expected_metrics:
            if metric in scores:
                try:
                    score = float(scores[metric])
                    # Clamp to 1-10 range
                    validated[metric] = max(1, min(10, score))
                except (ValueError, TypeError):
                    validated[metric] = 5  # Default middle score
            else:
                validated[metric] = 5  # Default if missing
        
        # Preserve additional fields if they exist
        if 'key_themes' in scores:
            validated['key_themes'] = scores['key_themes'] if isinstance(scores['key_themes'], list) else []
        
        if 'content_type_analysis' in scores:
            validated['content_type_analysis'] = str(scores['content_type_analysis'])[:200]  # Limit length
        
        return validated
    
    def process_json_file(self, input_file: str, output_file: str = "evaluation.json", 
                         batch_size: int = 10, start_from: int = 0, max_blocks: int = None) -> None:
        """Process the AHWGP master JSON file and generate evaluations"""
        
        # Test Ollama connection first
        if not self.test_ollama_connection():
            logger.error("Cannot proceed without Ollama connection")
            return
        
        # Load input data
        input_path = Path(input_file)
        if not input_path.exists():
            logger.error(f"Input file not found: {input_file}")
            return
        
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        blocks = data.get('blocks', [])
        total_blocks = len(blocks)
        
        logger.info(f"Found {total_blocks} blocks in {input_file}")
        
        # Load existing evaluations if file exists
        output_path = Path(output_file)
        evaluated_block_ids = set()
        if output_path.exists():
            with open(output_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
                self.evaluation_data = existing_data.get('evaluations', [])
                logger.info(f"Loaded {len(self.evaluation_data)} existing evaluations")
                
                # Track which blocks have already been evaluated
                for eval_data in self.evaluation_data:
                    evaluated_block_ids.add(eval_data.get('block_id'))
        
        # Filter out already evaluated blocks AND only keep plain paragraph blocks
        blocks_to_process = []
        current_chapter = "Unknown"
        skip_introduction = True
        
        for block in blocks:
            # Track current chapter
            if block.get('tag') == 'chapter':
                current_chapter = block.get('content', 'Unknown')
                continue
                
            # Skip Introduction chapter if skip_introduction is True
            if skip_introduction and current_chapter.lower() in ['introduction', 'intro']:
                continue
                
            # Skip if already evaluated
            if block.get('id') in evaluated_block_ids:
                continue
                
            # Only process paragraph blocks
            if block.get('tag') != 'paragraph':
                continue
                
            # Skip blocks with special metadata (prayer-page, reflection, etc.)
            # Check for any metadata fields that indicate special content
            if any(key in block for key in ['prayer-page', 'reflection', 'special_type']):
                continue
                
            # Skip empty or very short content blocks
            content = block.get('content', '')
            if not content or len(content.strip()) < 10:
                logger.info(f"Skipping empty/short block {block.get('id')}: {len(content)} chars")
                continue
                
            blocks_to_process.append(block)
        
        logger.info(f"Found {len(blocks_to_process)} unanalyzed blocks out of {total_blocks} total blocks")
        
        if not blocks_to_process:
            logger.info("All blocks have already been analyzed!")
            return
            
        # Apply limits to unanalyzed blocks
        if start_from > 0:
            blocks_to_process = blocks_to_process[start_from:]
            logger.info(f"Starting from unanalyzed block {start_from}")
        
        if max_blocks:
            blocks_to_process = blocks_to_process[:max_blocks]
            logger.info(f"Processing maximum {max_blocks} blocks")
        
        # Process blocks in batches
        processed = 0
        failed = 0
        
        for i in range(0, len(blocks_to_process), batch_size):
            batch = blocks_to_process[i:i + batch_size]
            logger.info(f"Processing batch {i//batch_size + 1}: blocks {i+1}-{min(i+batch_size, len(blocks_to_process))}")
            
            for block in batch:
                try:
                    evaluation = self.analyze_content_block(block)
                    self.evaluation_data.append(evaluation)
                    
                    if 'error' in evaluation:
                        failed += 1
                        logger.warning(f"Failed to analyze block {evaluation['block_id']}: {evaluation['error']}")
                    else:
                        processed += 1
                        logger.info(f"✓ Analyzed block {evaluation['block_id']} - relatability: {evaluation['scores'].get('relatability', 'N/A')}")
                    
                    # Small delay to avoid overwhelming the LLM
                    time.sleep(0.5)
                    
                except Exception as e:
                    logger.error(f"Error processing block: {e}")
                    failed += 1
            
            # Save progress after each batch
            self.save_evaluations(output_file)
            logger.info(f"Saved progress: {processed} successful, {failed} failed")
        
        logger.info(f"Processing complete: {processed} successful, {failed} failed")
        logger.info(f"Results saved to: {output_file}")
    
    def save_evaluations(self, output_file: str) -> None:
        """Save current evaluations to JSON file"""
        output_data = {
            "metadata": {
                "total_evaluations": len(self.evaluation_data),
                "successful_evaluations": len([e for e in self.evaluation_data if 'scores' in e]),
                "failed_evaluations": len([e for e in self.evaluation_data if 'error' in e]),
                "model_used": self.model,
                "timestamp": time.time()
            },
            "evaluations": self.evaluation_data
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)

    def test_specific_blocks(self, input_file: str, block_ids: List[str], output_file: str = "test_evaluation.json") -> None:
        """Test analysis on specific blocks by their IDs"""
        
        # Test Ollama connection first
        if not self.test_ollama_connection():
            logger.error("Cannot proceed without Ollama connection")
            return
        
        # Load input data
        input_path = Path(input_file)
        if not input_path.exists():
            logger.error(f"Input file not found: {input_file}")
            return
        
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Find and filter blocks by IDs
        paragraph_blocks = []
        
        # Handle both flat structure (blocks array) and nested structure (chapters/blocks)
        if 'blocks' in data:
            # Flat structure
            for block in data.get('blocks', []):
                if block.get('tag') == 'paragraph' and block.get('id') in block_ids:
                    paragraph_blocks.append(block)
        elif 'chapters' in data:
            # Nested structure
            for chapter in data.get('chapters', []):
                for block in chapter.get('blocks', []):
                    if block.get('tag') == 'paragraph' and block.get('id') in block_ids:
                        paragraph_blocks.append(block)
        
        if not paragraph_blocks:
            logger.error(f"No paragraph blocks found with IDs: {block_ids}")
            return
        
        logger.info(f"Found {len(paragraph_blocks)} blocks to test")
        
        # Process the selected blocks
        evaluations = []
        for i, block in enumerate(paragraph_blocks):
            logger.info(f"Testing block {i+1}/{len(paragraph_blocks)}: {block.get('id')}")
            result = self.analyze_content_block(block)
            evaluations.append(result)
            
            # Brief pause between requests
            time.sleep(1)
        
        # Save results
        output_data = {
            "metadata": {
                "total_evaluations": len(evaluations),
                "successful_evaluations": len([e for e in evaluations if 'scores' in e]),
                "failed_evaluations": len([e for e in evaluations if 'error' in e]),
                "model_used": self.model,
                "timestamp": time.time(),
                "test_mode": True,
                "tested_block_ids": block_ids
            },
            "evaluations": evaluations
        }
        
        output_path = Path(output_file)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2)
        
        logger.info(f"Test results saved to: {output_file}")
        
        # Print summary
        successful = len([e for e in evaluations if 'scores' in e])
        logger.info(f"Test complete: {successful}/{len(evaluations)} blocks analyzed successfully")

def main():
    """Main execution function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Analyze AHWGP content with local LLM')
    parser.add_argument('--input', default='editor-app/static/AHWGP_master.json', 
                       help='Input JSON file path')
    parser.add_argument('--output', default='evaluation.json', 
                       help='Output evaluation file path')
    parser.add_argument('--model', default='llama3.1:8b', 
                       help='Ollama model name')
    parser.add_argument('--batch-size', type=int, default=10, 
                       help='Number of blocks to process in each batch')
    parser.add_argument('--start-from', type=int, default=0, 
                       help='Block index to start from (for resuming)')
    parser.add_argument('--max-blocks', type=int, 
                       help='Maximum number of blocks to process (for testing)')
    parser.add_argument('--test', action='store_true', 
                       help='Test mode: analyze only first 5 blocks')
    parser.add_argument('--test-blocks', nargs='+', 
                       help='Test specific blocks by ID (space-separated list)')
    
    args = parser.parse_args()
    
    # Create analyzer
    analyzer = ContentAnalyzer(model=args.model)
    
    # Test specific blocks mode
    if args.test_blocks:
        logger.info(f"Testing specific blocks: {args.test_blocks}")
        analyzer.test_specific_blocks(
            input_file=args.input,
            block_ids=args.test_blocks,
            output_file='test_blocks_evaluation.json'
        )
        return
    
    # Test mode
    if args.test:
        args.max_blocks = 5
        args.output = 'evaluation_test.json'
        logger.info("Running in test mode: processing first 5 blocks")
    
    # Process the file
    analyzer.process_json_file(
        input_file=args.input,
        output_file=args.output,
        batch_size=args.batch_size,
        start_from=args.start_from,
        max_blocks=args.max_blocks
    )

if __name__ == "__main__":
    main()