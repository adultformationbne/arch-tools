#!/usr/bin/env python3
"""
HTML to Structured XML Parser with Unique IDs
Extracts content from InDesign HTML with unique identifiers for each block
Perfect for building custom content editors
"""

from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET
from xml.dom import minidom
import re
import hashlib
import uuid
from datetime import datetime

class StructuredContentExtractor:
    def __init__(self):
        self.content_id_counter = 1
        self.chapter_counter = 1
        self.section_counter = 1
        self.block_counter = 1
        self.current_chapter_id = None
        self.current_section_id = None
        
    def generate_unique_id(self, content_type, content_text=""):
        """Generate unique, stable IDs for content blocks"""
        
        # Create a base ID using type and counter
        if content_type == "chapter":
            base_id = f"ch_{self.chapter_counter:03d}"
            self.chapter_counter += 1
        elif content_type == "section":
            base_id = f"sec_{self.chapter_counter:03d}_{self.section_counter:03d}"
            self.section_counter += 1
        else:
            base_id = f"blk_{self.chapter_counter:03d}_{self.block_counter:05d}"
            self.block_counter += 1
        
        # Add content hash for uniqueness and stability
        content_hash = hashlib.md5(content_text.encode('utf-8')).hexdigest()[:8]
        
        return f"{base_id}_{content_hash}"
    
    def extract_structured_content(self, html_file_path, output_file_path):
        """Extract structured content with unique IDs from HTML"""
        
        print(f"📄 Parsing HTML: {html_file_path}")
        
        with open(html_file_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Create root XML structure
        root = ET.Element('book')
        root.set('id', 'book_001')
        root.set('created', datetime.now().isoformat())
        root.set('source', html_file_path)
        
        # Add metadata
        metadata = ET.SubElement(root, 'metadata')
        ET.SubElement(metadata, 'title').text = 'At Home With God\'s People'
        ET.SubElement(metadata, 'subtitle').text = 'Our Catholic Faith'
        ET.SubElement(metadata, 'format').text = 'structured_xml_with_ids'
        ET.SubElement(metadata, 'version').text = '2.0'
        
        current_chapter = None
        current_section = None
        
        # Find all content elements
        all_elements = soup.find_all(['p', 'div', 'ul', 'li'])
        
        for element in all_elements:
            element_class = element.get('class', [])
            text_content = self.clean_text(element.get_text(strip=True))
            
            if not text_content:
                continue
            
            # Determine content type and create structured element
            content_info = self.classify_content(element_class, text_content)
            
            if content_info['type'] == 'chapter':
                # Start new chapter
                current_chapter = ET.SubElement(root, 'chapter')
                current_chapter.set('id', self.generate_unique_id('chapter', text_content))
                current_chapter.set('number', str(self.chapter_counter - 1))
                current_chapter.set('title', text_content)
                
                # Add chapter title element
                title_elem = ET.SubElement(current_chapter, 'chapter_title')
                title_elem.set('id', self.generate_unique_id('chapter_title', text_content))
                title_elem.text = text_content
                
                # Reset section counter for new chapter
                self.section_counter = 1
                self.block_counter = 1
                current_section = None
                
            elif content_info['type'] == 'section' and current_chapter is not None:
                # Create new section
                current_section = ET.SubElement(current_chapter, 'section')
                current_section.set('id', self.generate_unique_id('section', text_content))
                current_section.set('level', content_info.get('level', '2'))
                
                # Add section title
                section_title = ET.SubElement(current_section, 'section_title')
                section_title.set('id', self.generate_unique_id('section_title', text_content))
                section_title.text = text_content
                
            elif current_chapter is not None:
                # Add content block to current chapter or section
                container = current_section if current_section is not None else current_chapter
                
                content_block = ET.SubElement(container, content_info['xml_tag'])
                content_block.set('id', self.generate_unique_id(content_info['xml_tag'], text_content))
                content_block.set('original_class', ' '.join(element_class) if element_class else 'none')
                content_block.set('content_type', content_info['type'])
                
                # Add any special attributes
                if content_info.get('semantic_tags'):
                    for tag, value in content_info['semantic_tags'].items():
                        content_block.set(tag, value)
                
                # Handle different content structures
                if content_info['type'] == 'list':
                    self.process_list_content(element, content_block)
                elif content_info['type'] == 'callout_box':
                    self.process_callout_content(element, content_block, text_content)
                else:
                    content_block.text = text_content
        
        # Write structured XML
        self.write_pretty_xml(root, output_file_path)
        
        print(f"✅ Extraction complete!")
        print(f"📚 Found {self.chapter_counter - 1} chapters")
        print(f"📝 Created {self.content_id_counter} unique content blocks")
        print(f"💾 Saved to: {output_file_path}")
        
        return output_file_path
    
    def classify_content(self, element_classes, text_content):
        """Classify content type and determine XML structure"""
        
        classes_str = ' '.join(element_classes) if element_classes else ''
        
        # Chapter titles
        if 'chapter-head-blue' in classes_str:
            return {
                'type': 'chapter',
                'xml_tag': 'chapter_title',
                'semantic_tags': {'importance': 'high', 'hierarchy': '1'}
            }
        
        # Section headings
        if any(heading in classes_str for heading in ['_-Minor-Sub-Heading', '_1-Intro-tab-head']):
            return {
                'type': 'section', 
                'xml_tag': 'section_title',
                'level': '2',
                'semantic_tags': {'hierarchy': '2'}
            }
        
        # Callout boxes
        if 'box-head' in classes_str:
            return {
                'type': 'callout_header',
                'xml_tag': 'callout_header',
                'semantic_tags': {'layout': 'callout', 'emphasis': 'high'}
            }
        
        if 'box-text' in classes_str:
            return {
                'type': 'callout_text',
                'xml_tag': 'callout_text', 
                'semantic_tags': {'layout': 'callout'}
            }
        
        # Body text variations
        if 'body-1-first-par' in classes_str:
            return {
                'type': 'paragraph',
                'xml_tag': 'paragraph',
                'semantic_tags': {'paragraph_type': 'first', 'indent': 'none'}
            }
        
        if 'body' in classes_str or 'Body-type-It-demi' in classes_str:
            return {
                'type': 'paragraph',
                'xml_tag': 'paragraph',
                'semantic_tags': {'paragraph_type': 'body'}
            }
        
        # Italic text
        if 'Italic-1' in classes_str:
            return {
                'type': 'paragraph',
                'xml_tag': 'paragraph',
                'semantic_tags': {'style': 'italic', 'emphasis': 'medium'}
            }
        
        # Drop cap text
        if 'text-after-drop-cap' in classes_str:
            return {
                'type': 'paragraph',
                'xml_tag': 'paragraph',
                'semantic_tags': {'drop_cap': 'true', 'paragraph_type': 'opening'}
            }
        
        # List items
        if 'box-text-bullet' in classes_str:
            return {
                'type': 'list_item',
                'xml_tag': 'list_item',
                'semantic_tags': {'list_type': 'bullet'}
            }
        
        # Default to paragraph
        return {
            'type': 'paragraph',
            'xml_tag': 'paragraph',
            'semantic_tags': {}
        }
    
    def process_list_content(self, element, content_block):
        """Process list elements with individual item IDs"""
        if element.name == 'ul':
            content_block.tag = 'list'
            content_block.set('list_type', 'bullet')
            
            for li in element.find_all('li'):
                item_text = self.clean_text(li.get_text(strip=True))
                if item_text:
                    list_item = ET.SubElement(content_block, 'list_item')
                    list_item.set('id', self.generate_unique_id('list_item', item_text))
                    list_item.text = item_text
    
    def process_callout_content(self, element, content_block, text_content):
        """Process callout box content"""
        content_block.text = text_content
        
        # Look for related callout elements
        parent = element.parent
        if parent:
            siblings = parent.find_all(['p', 'div'])
            for sibling in siblings:
                sibling_classes = sibling.get('class', [])
                if 'box-head' in ' '.join(sibling_classes):
                    content_block.set('callout_title', self.clean_text(sibling.get_text(strip=True)))
    
    def clean_text(self, text):
        """Clean and normalize text content"""
        if not text:
            return ""
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove tab characters that appear as &#9;
        text = text.replace('\t', ' ').replace('\u0009', ' ')
        
        # Clean up quotes and special characters
        text = text.replace('\u2018', "'").replace('\u2019', "'")
        text = text.replace('\u201c', '"').replace('\u201d', '"')
        text = text.replace('\u2013', '–').replace('\u2014', '—')
        
        return text.strip()
    
    def write_pretty_xml(self, root, output_file):
        """Write formatted XML with proper indentation"""
        rough_string = ET.tostring(root, encoding='unicode')
        reparsed = minidom.parseString(rough_string)
        pretty_xml = reparsed.toprettyxml(indent="  ")
        
        # Remove empty lines
        lines = [line for line in pretty_xml.split('\n') if line.strip()]
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

def main():
    """Extract structured content with unique IDs"""
    extractor = StructuredContentExtractor()
    
    html_file = 'AHWGP_original.html'
    output_file = 'AHWGP_structured_with_ids.xml'
    
    try:
        extractor.extract_structured_content(html_file, output_file)
        
        # Generate summary report
        print("\n📊 Content Structure Summary:")
        print("=" * 50)
        
        # Parse the output to show structure
        tree = ET.parse(output_file)
        root = tree.getroot()
        
        for chapter in root.findall('chapter'):
            chapter_id = chapter.get('id')
            chapter_title = chapter.get('title', 'Untitled')
            print(f"📚 {chapter_id}: {chapter_title}")
            
            sections = chapter.findall('section')
            paragraphs = chapter.findall('paragraph')
            callouts = chapter.findall('.//callout_text')
            
            if sections:
                print(f"   📝 {len(sections)} sections")
            print(f"   📄 {len(paragraphs)} paragraphs")
            if callouts:
                print(f"   💬 {len(callouts)} callout boxes")
        
        print(f"\n✅ All content blocks have unique IDs for editor integration!")
        
    except FileNotFoundError:
        print(f"❌ HTML file not found: {html_file}")
        print("   Make sure AHWGP_original.html is in the current directory")
    except Exception as e:
        print(f"❌ Error during extraction: {e}")

if __name__ == "__main__":
    main()