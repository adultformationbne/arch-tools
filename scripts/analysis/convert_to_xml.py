#!/usr/bin/env python3
"""Convert mary_chapter_cleaned.md to structured XML format."""

import re
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom import minidom

def create_xml_document():
    # Create root element
    root = Element('document')
    root.set('type', 'religious_text')
    root.set('subject', 'marian_theology')
    root.set('source', 'mary_chapter.txt')
    root.set('processed_date', '2025-08-19')
    
    # Add metadata
    metadata = SubElement(root, 'metadata')
    SubElement(metadata, 'title').text = 'Mary, Mother of the Church'
    SubElement(metadata, 'topic').text = 'Catholic Mariology'
    SubElement(metadata, 'audience').text = 'Catholic faithful'
    SubElement(metadata, 'language').text = 'English'
    
    # Read the cleaned markdown file
    with open('mary_chapter_cleaned.md', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split into sections based on headers
    sections = re.split(r'\n(#{1,3})\s*([^\n]+)\n', content)
    
    current_section = None
    current_subsection = None
    
    for i, part in enumerate(sections):
        if i == 0:  # First part before any header
            if part.strip():
                intro = SubElement(root, 'introduction')
                intro.text = part.strip()
            continue
            
        if part.startswith('#'):
            level = len(part)
            title = sections[i+1] if i+1 < len(sections) else ""
            content_text = sections[i+2] if i+2 < len(sections) else ""
            
            if level == 1:  # Main title (already handled in metadata)
                continue
            elif level == 2:  # Main sections
                current_section = SubElement(root, 'section')
                current_section.set('level', '2')
                current_section.set('id', title.lower().replace(' ', '_').replace("'", ""))
                SubElement(current_section, 'title').text = title
                
                # Process content
                if content_text.strip():
                    add_content_elements(current_section, content_text.strip())
                    
            elif level == 3:  # Subsections
                if current_section is not None:
                    current_subsection = SubElement(current_section, 'subsection')
                    current_subsection.set('level', '3')
                    current_subsection.set('id', title.lower().replace(' ', '_').replace("'", ""))
                    SubElement(current_subsection, 'title').text = title
                    
                    # Process content
                    if content_text.strip():
                        add_content_elements(current_subsection, content_text.strip())
    
    return root

def add_content_elements(parent, text):
    """Add structured content elements to parent."""
    
    # Split into paragraphs
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    
    for para in paragraphs:
        if para.startswith('>'):  # Blockquote
            quote = SubElement(parent, 'quote')
            quote.set('type', 'official')
            quote.text = para.replace('> ', '').strip()
            
        elif para.startswith('**') and ':' in para:  # Section headers like "**Joyful:**"
            list_section = SubElement(parent, 'list_section')
            header_match = re.match(r'\*\*([^*]+)\*\*:', para)
            if header_match:
                SubElement(list_section, 'header').text = header_match.group(1)
                # Extract list items
                items = re.findall(r'\d+\.\s*([^\n]+)', para)
                for item in items:
                    SubElement(list_section, 'item').text = item.strip()
                    
        elif re.match(r'^\d+\.', para):  # Numbered list
            list_elem = SubElement(parent, 'list')
            list_elem.set('type', 'numbered')
            items = re.findall(r'\d+\.\s*([^\n]+)', para)
            for item in items:
                SubElement(list_elem, 'item').text = item.strip()
                
        elif para.startswith('•'):  # Bullet list
            list_elem = SubElement(parent, 'list')
            list_elem.set('type', 'bullet')
            items = re.findall(r'•\s*([^\n]+)', para)
            for item in items:
                SubElement(list_elem, 'item').text = item.strip()
                
        else:  # Regular paragraph
            p_elem = SubElement(parent, 'paragraph')
            
            # Check for biblical quotes (text in italics)
            if '*' in para:
                # Split by italic markers and handle mixed content
                parts = re.split(r'(\*[^*]+\*)', para)
                combined_text = ""
                for part in parts:
                    if part.startswith('*') and part.endswith('*'):
                        # This is a biblical quote
                        quote_text = part[1:-1]  # Remove asterisks
                        combined_text += f'<biblical_quote>{quote_text}</biblical_quote>'
                    else:
                        combined_text += part
                p_elem.text = combined_text
                p_elem.set('contains_quotes', 'true')
            else:
                p_elem.text = para
            
            # Add semantic tags
            if 'Luke' in para or 'Matthew' in para or 'Mark' in para or 'John' in para:
                p_elem.set('contains_scripture', 'true')
            if 'Vatican Council' in para:
                p_elem.set('contains_magisterium', 'true')
            if 'Mary' in para or 'mother' in para:
                p_elem.set('marian_content', 'true')

def prettify_xml(elem):
    """Return a pretty-printed XML string for the Element."""
    rough_string = tostring(elem, 'unicode')
    reparsed = minidom.parseString(rough_string)
    return reparsed.toprettyxml(indent="  ")

def main():
    root = create_xml_document()
    
    # Write to file
    xml_string = prettify_xml(root)
    with open('mary_chapter.xml', 'w', encoding='utf-8') as f:
        f.write(xml_string)
    
    print("Successfully converted to XML format: mary_chapter.xml")
    print("XML features added:")
    print("- Hierarchical structure with sections/subsections")
    print("- Metadata tags")
    print("- Content type identification (quotes, lists, paragraphs)")
    print("- Biblical quote markup")
    print("- Semantic attributes for content analysis")

if __name__ == "__main__":
    main()