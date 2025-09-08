# PDF Text and Image Extraction Guide

## Best Libraries for PDF Extraction

### 1. **PyMuPDF (fitz)** - RECOMMENDED
- **Best for**: Complete PDF extraction (text + images + layout)
- **Pros**: Fast, excellent image extraction, preserves formatting
- **GitHub**: https://github.com/pymupdf/PyMuPDF
- **Install**: `pip install PyMuPDF`

```python
import fitz  # PyMuPDF
import os

def extract_pdf_content(pdf_path, output_dir):
    doc = fitz.open(pdf_path)
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        
        # Extract text with formatting
        text = page.get_text()
        
        # Extract images
        image_list = page.get_images()
        for img_index, img in enumerate(image_list):
            xref = img[0]
            pix = fitz.Pixmap(doc, xref)
            if pix.n < 5:  # GRAY or RGB
                pix.save(f"{output_dir}/page_{page_num}_img_{img_index}.png")
            pix = None
```

### 2. **pdfplumber** - Great for structured text
- **Best for**: Tables, structured text, precise positioning
- **GitHub**: https://github.com/jsvine/pdfplumber
- **Install**: `pip install pdfplumber`

```python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        tables = page.extract_tables()
```

### 3. **PDFMiner** - Advanced text analysis
- **Best for**: Complex text extraction with detailed formatting
- **GitHub**: https://github.com/pdfminer/pdfminer.six
- **Install**: `pip install pdfminer.six`

### 4. **pdf2image** - For image conversion
- **Best for**: Converting PDF pages to images
- **GitHub**: https://github.com/Belval/pdf2image
- **Install**: `pip install pdf2image`

## Recommended Approach for Your Book

### Option A: PyMuPDF (Comprehensive Solution)

```python
#!/usr/bin/env python3
"""
Complete PDF extraction for book redesign
Extracts text, images, and maintains structure
"""

import fitz  # PyMuPDF
import os
import re
from pathlib import Path

def extract_book_content(pdf_path, output_base_dir):
    """Extract all content from PDF organized by chapters"""
    
    # Create output directories
    text_dir = f"{output_base_dir}/extracted_text"
    images_dir = f"{output_base_dir}/extracted_images"
    os.makedirs(text_dir, exist_ok=True)
    os.makedirs(images_dir, exist_ok=True)
    
    doc = fitz.open(pdf_path)
    
    current_chapter = 1
    chapter_text = []
    all_text = ""
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        
        # Extract text
        page_text = page.get_text()
        all_text += f"\n--- PAGE {page_num + 1} ---\n{page_text}\n"
        
        # Detect chapter breaks (customize this regex for your book)
        if re.search(r'^Chapter \d+|^CHAPTER \d+', page_text, re.MULTILINE):
            if chapter_text:  # Save previous chapter
                save_chapter(chapter_text, current_chapter, text_dir)
                chapter_text = []
                current_chapter += 1
        
        chapter_text.append(page_text)
        
        # Extract images
        extract_page_images(page, page_num, images_dir, doc)
    
    # Save final chapter
    if chapter_text:
        save_chapter(chapter_text, current_chapter, text_dir)
    
    # Save complete text
    with open(f"{text_dir}/complete_book.txt", 'w', encoding='utf-8') as f:
        f.write(all_text)
    
    doc.close()
    return current_chapter

def extract_page_images(page, page_num, images_dir, doc):
    """Extract all images from a page"""
    image_list = page.get_images(full=True)
    
    for img_index, img in enumerate(image_list):
        try:
            xref = img[0]
            pix = fitz.Pixmap(doc, xref)
            
            # Convert CMYK to RGB if needed
            if pix.n - pix.alpha < 4:
                img_data = pix.tobytes("png")
                img_filename = f"{images_dir}/page_{page_num:03d}_img_{img_index:02d}.png"
                
                with open(img_filename, "wb") as img_file:
                    img_file.write(img_data)
                
                print(f"Saved: {img_filename}")
            
            pix = None
        except Exception as e:
            print(f"Error extracting image {img_index} from page {page_num}: {e}")

def save_chapter(chapter_text, chapter_num, text_dir):
    """Save chapter text to individual file"""
    chapter_content = "\n".join(chapter_text)
    filename = f"{text_dir}/chapter_{chapter_num:02d}.txt"
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(chapter_content)
    
    print(f"Saved: {filename}")

if __name__ == "__main__":
    pdf_file = "AHWGP_original.pdf"
    output_dir = "extracted_content"
    
    chapters_found = extract_book_content(pdf_file, output_dir)
    print(f"Extraction complete! Found {chapters_found} chapters.")
```

### Option B: Multi-Library Approach (Most Robust)

```python
#!/usr/bin/env python3
"""
Multi-library PDF extraction for maximum reliability
"""

import fitz  # PyMuPDF for images
import pdfplumber  # For structured text
from pdf2image import convert_from_path  # Fallback for complex layouts
import os

def hybrid_extraction(pdf_path, output_dir):
    """Use multiple libraries for best results"""
    
    # Method 1: pdfplumber for clean text
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text:
                with open(f"{output_dir}/pdfplumber_page_{i+1}.txt", 'w') as f:
                    f.write(text)
    
    # Method 2: PyMuPDF for images and fallback text
    doc = fitz.open(pdf_path)
    for page_num in range(len(doc)):
        page = doc[page_num]
        
        # Extract images
        image_list = page.get_images()
        for img_index, img in enumerate(image_list):
            # Image extraction code here
            pass
        
        # Fallback text extraction
        text = page.get_text()
        with open(f"{output_dir}/pymupdf_page_{page_num+1}.txt", 'w') as f:
            f.write(text)
    
    doc.close()
```

## Installation Commands

```bash
# Install all recommended libraries
pip install PyMuPDF pdfplumber pdf2image pillow

# For pdf2image on macOS (requires poppler)
brew install poppler

# For pdf2image on Ubuntu/Debian
sudo apt-get install poppler-utils

# For pdf2image on Windows
# Download poppler from: https://github.com/oschwartz10612/poppler-windows
```

## Advanced Features for Book Processing

### 1. OCR for Scanned PDFs
If your PDF is scanned images rather than text:

```python
import pytesseract
from pdf2image import convert_from_path

def ocr_pdf(pdf_path):
    """Extract text from scanned PDF using OCR"""
    pages = convert_from_path(pdf_path, 300)  # 300 DPI
    
    for i, page in enumerate(pages):
        text = pytesseract.image_to_string(page)
        with open(f"ocr_page_{i+1}.txt", 'w') as f:
            f.write(text)
```

### 2. Chapter Detection Patterns
Customize these regex patterns for your book:

```python
chapter_patterns = [
    r'^Chapter \d+',
    r'^CHAPTER \d+',
    r'^\d+\.\s+[A-Z]',  # "1. CHAPTER NAME"
    r'^[A-Z\s]{10,}$',  # All caps titles
]
```

### 3. Image Classification
```python
def classify_images(image_path):
    """Identify image types for better organization"""
    # Could be photos, diagrams, decorative elements, etc.
    # Use image analysis libraries like PIL or OpenCV
    pass
```

## Workflow Integration

1. **Extract**: Run extraction script on your PDF
2. **Clean**: Review and clean extracted text files
3. **Process**: Run through your XML conversion pipeline
4. **Organize**: Sort images by chapter/section
5. **Design**: Import into InDesign with your template

## Quality Checks

```python
def validate_extraction(text_dir, images_dir):
    """Check extraction quality"""
    
    # Check for missing text
    total_chars = 0
    for file in os.listdir(text_dir):
        if file.endswith('.txt'):
            with open(f"{text_dir}/{file}", 'r') as f:
                total_chars += len(f.read())
    
    print(f"Total characters extracted: {total_chars}")
    
    # Check image count
    image_count = len([f for f in os.listdir(images_dir) if f.endswith(('.png', '.jpg', '.jpeg'))])
    print(f"Total images extracted: {image_count}")
```

## Recommendation

**Start with PyMuPDF** - it's the most comprehensive and handles both text and images well. If you encounter issues with specific pages or formatting, then supplement with pdfplumber for those sections.