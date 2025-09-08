#!/usr/bin/env python3
"""
PDF Content Extraction Script
Extracts text and images from AHWGP_original.pdf
"""

import fitz  # PyMuPDF
import os
import re
from pathlib import Path
import argparse
from tqdm import tqdm

def extract_book_content(pdf_path, output_base_dir="extracted_content"):
    """Extract all content from PDF organized by chapters"""
    
    if not os.path.exists(pdf_path):
        print(f"❌ PDF file not found: {pdf_path}")
        return False
    
    # Create output directories
    text_dir = f"{output_base_dir}/text"
    images_dir = f"{output_base_dir}/images"
    os.makedirs(text_dir, exist_ok=True)
    os.makedirs(images_dir, exist_ok=True)
    
    print(f"📄 Opening PDF: {pdf_path}")
    doc = fitz.open(pdf_path)
    
    current_chapter = 1
    chapter_text = []
    all_text = ""
    total_images = 0
    
    print(f"📊 Processing {len(doc)} pages...")
    
    for page_num in tqdm(range(len(doc)), desc="Extracting pages"):
        page = doc[page_num]
        
        # Extract text
        page_text = page.get_text()
        all_text += f"\n--- PAGE {page_num + 1} ---\n{page_text}\n"
        
        # Detect chapter breaks (customize these patterns for your book)
        chapter_patterns = [
            r'^Chapter \d+',
            r'^CHAPTER \d+',
            r'^\d+\.\s+[A-Z]',
            r'^[A-Z\s]{15,}$'  # Long all-caps titles
        ]
        
        # Check for chapter break
        for pattern in chapter_patterns:
            if re.search(pattern, page_text, re.MULTILINE):
                if chapter_text:  # Save previous chapter
                    save_chapter(chapter_text, current_chapter, text_dir)
                    chapter_text = []
                    current_chapter += 1
                break
        
        chapter_text.append(page_text)
        
        # Extract images
        images_extracted = extract_page_images(page, page_num, images_dir, doc)
        total_images += images_extracted
    
    # Save final chapter
    if chapter_text:
        save_chapter(chapter_text, current_chapter, text_dir)
    
    # Save complete text
    with open(f"{text_dir}/complete_book.txt", 'w', encoding='utf-8') as f:
        f.write(all_text)
    
    doc.close()
    
    print(f"✅ Extraction complete!")
    print(f"📚 Found {current_chapter} chapters")
    print(f"🖼️  Extracted {total_images} images")
    print(f"📁 Text files: {text_dir}/")
    print(f"📁 Image files: {images_dir}/")
    
    return True

def extract_page_images(page, page_num, images_dir, doc):
    """Extract all images from a page"""
    image_list = page.get_images(full=True)
    images_extracted = 0
    
    for img_index, img in enumerate(image_list):
        try:
            xref = img[0]
            pix = fitz.Pixmap(doc, xref)
            
            # Convert CMYK to RGB if needed
            if pix.n - pix.alpha < 4:
                img_data = pix.tobytes("png")
                img_filename = f"{images_dir}/page_{page_num+1:03d}_img_{img_index+1:02d}.png"
                
                with open(img_filename, "wb") as img_file:
                    img_file.write(img_data)
                
                images_extracted += 1
            
            pix = None
        except Exception as e:
            print(f"⚠️  Error extracting image {img_index+1} from page {page_num+1}: {e}")
    
    return images_extracted

def save_chapter(chapter_text, chapter_num, text_dir):
    """Save chapter text to individual file"""
    chapter_content = "\n".join(chapter_text)
    filename = f"{text_dir}/chapter_{chapter_num:02d}.txt"
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(chapter_content)
    
    print(f"💾 Saved: chapter_{chapter_num:02d}.txt")

def analyze_extraction(text_dir, images_dir):
    """Analyze the extraction results"""
    print("\n📊 Extraction Analysis:")
    
    # Analyze text files
    text_files = [f for f in os.listdir(text_dir) if f.endswith('.txt')]
    total_chars = 0
    
    for file in text_files:
        with open(f"{text_dir}/{file}", 'r', encoding='utf-8') as f:
            chars = len(f.read())
            total_chars += chars
            if 'chapter' in file:
                print(f"  📄 {file}: {chars:,} characters")
    
    print(f"  📊 Total characters: {total_chars:,}")
    
    # Analyze images
    image_files = [f for f in os.listdir(images_dir) if f.endswith(('.png', '.jpg', '.jpeg'))]
    print(f"  🖼️  Total images: {len(image_files)}")
    
    return len(text_files), len(image_files)

def main():
    parser = argparse.ArgumentParser(description='Extract content from PDF')
    parser.add_argument('--pdf', default='AHWGP_original.pdf', 
                       help='Path to PDF file (default: AHWGP_original.pdf)')
    parser.add_argument('--output', default='extracted_content',
                       help='Output directory (default: extracted_content)')
    parser.add_argument('--analyze', action='store_true',
                       help='Analyze extraction results')
    
    args = parser.parse_args()
    
    if args.analyze:
        text_dir = f"{args.output}/text"
        images_dir = f"{args.output}/images"
        if os.path.exists(text_dir) and os.path.exists(images_dir):
            analyze_extraction(text_dir, images_dir)
        else:
            print("❌ No extraction results found. Run extraction first.")
        return
    
    success = extract_book_content(args.pdf, args.output)
    if success:
        analyze_extraction(f"{args.output}/text", f"{args.output}/images")

if __name__ == "__main__":
    main()