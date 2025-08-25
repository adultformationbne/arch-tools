import { XMLParser } from 'fast-xml-parser';

export function parseXML(xmlString) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    parseAttributeValue: true
  });

  const jsonObj = parser.parse(xmlString);
  console.log('Parsed XML structure:', jsonObj);
  
  // Extract the book structure
  const book = jsonObj.book;
  if (!book) {
    throw new Error('Invalid XML: missing book element');
  }
  
  console.log('Book chapters:', book.chapter?.length || 1);

  // Extract metadata
  const metadata = {
    title: book.metadata?.title || "At Home With God's People",
    subtitle: book.metadata?.subtitle || "Our Catholic Faith",
    version: book.metadata?.version || "2.0"
  };

  // Process chapters - handle both single chapter and array of chapters
  const chapters = [];
  let chapterElements = [];
  
  if (book.chapter) {
    chapterElements = Array.isArray(book.chapter) ? book.chapter : [book.chapter];
  }
  
  console.log('📋 Found', chapterElements.length, 'chapters');
  
  let totalBlocks = 0;
  let paragraphCount = 0;
  let calloutCount = 0;
  let headerCount = 0;

  chapterElements.forEach((chapterEl, index) => {
    if (!chapterEl) {
      console.log(`⚠️ Chapter ${index} is null/undefined`);
      return;
    }

    const chapter = {
      id: chapterEl["@id"] || `ch_${String(index + 1).padStart(3, '0')}`,
      number: chapterEl["@number"] || index + 1,
      title: chapterEl["@title"] || `Chapter ${index + 1}`,
      sections: [],
      blocks: [],
      totalBlocks: 0
    };

    // Extract content blocks from the chapter
    const blocks = extractContentBlocks(chapterEl);
    chapter.blocks = blocks;
    chapter.totalBlocks = blocks.length;
    totalBlocks += blocks.length;
    
    console.log(`📖 Ch${chapter.number}: ${chapter.title} (${blocks.length} blocks)`);

    // Count content types
    blocks.forEach(block => {
      switch (block.type) {
        case 'paragraph':
          paragraphCount++;
          break;
        case 'callout_text':
        case 'callout_header':
          calloutCount++;
          break;
        case 'header':
          headerCount++;
          break;
      }
    });

    chapters.push(chapter);
  });

  return {
    metadata,
    chapters,
    totalBlocks,
    statistics: {
      paragraphs: paragraphCount,
      callouts: calloutCount,
      headers: headerCount
    }
  };
}

function extractContentBlocks(chapterElement) {
  const blocks = [];
  const seenContent = new Map(); // Track content we've already seen
  
  // Process sections first (they have better structure)
  if (chapterElement.section) {
    const sections = Array.isArray(chapterElement.section) ? chapterElement.section : [chapterElement.section];
    
    sections.forEach(section => {
      // Add section title as header
      if (section.section_title) {
        const titleElements = Array.isArray(section.section_title) ? section.section_title : [section.section_title];
        titleElements.forEach(titleEl => {
          const content = extractTextFromElement(titleEl);
          if (content.trim() && titleEl["@id"]) {
            blocks.push({
              id: titleEl["@id"],
              type: 'header',
              content: content.trim(),
              originalClass: titleEl["@original_class"] || 'section-title',
              metadata: extractMetadata(titleEl)
            });
          }
        });
      }
      
      // Process paragraphs within sections
      if (section.paragraph) {
        const paragraphs = Array.isArray(section.paragraph) ? section.paragraph : [section.paragraph];
        paragraphs.forEach(para => {
          const content = extractTextFromElement(para);
          const contentKey = content.trim().toLowerCase();
          
          // Only add if we haven't seen this content before and it's substantial
          if (content.trim() && para["@id"] && !seenContent.has(contentKey) && content.length > 10) {
            seenContent.set(contentKey, true);
            blocks.push({
              id: para["@id"],
              type: mapContentType(para["@content_type"] || 'paragraph', para["@original_class"] || '', content.trim()),
              content: content.trim(),
              originalClass: para["@original_class"] || '',
              metadata: extractMetadata(para)
            });
          }
        });
      }
    });
  }
  
  // Process remaining content types, but skip duplicates
  Object.keys(chapterElement).forEach(key => {
    if (key.startsWith('@') || key === '#text' || key === 'section') return;
    
    const elements = chapterElement[key];
    const elementArray = Array.isArray(elements) ? elements : [elements];
    
    elementArray.forEach((element, index) => {
      if (!element || typeof element !== 'object') return;
      
      const id = element["@id"];
      const originalClass = element["@original_class"] || '';
      const contentTypeAttr = element["@content_type"] || key;
      const content = extractTextFromElement(element);
      const contentKey = content.trim().toLowerCase();
      
      // Skip if we've already processed this content or it's too short
      if (!content.trim() || !id || seenContent.has(contentKey) || content.length < 10) {
        return;
      }
      
      // Handle special cases for mega-paragraphs that need splitting
      if (key === 'paragraph' && content.length > 1000) {
        const splitBlocks = splitMegaParagraph(content, id, originalClass);
        splitBlocks.forEach(block => {
          const blockKey = block.content.toLowerCase();
          if (!seenContent.has(blockKey)) {
            seenContent.set(blockKey, true);
            blocks.push(block);
          }
        });
      } else {
        seenContent.set(contentKey, true);
        blocks.push({
          id: id,
          type: mapContentType(contentTypeAttr, originalClass, content.trim()),
          content: content.trim(),
          originalClass: originalClass,
          metadata: extractMetadata(element)
        });
      }
    });
  });
  
  return blocks;
}

function splitMegaParagraph(content, baseId, originalClass) {
  const blocks = [];
  
  // Enhanced splitting patterns for better content detection
  const sections = content.split(/(?=(?:Hat is|What is|Are you|Do you want|How (?:will|can)|the Old Testament|The New Testament|Many books, one story|Law and covenant|Israel's journey|Prophecy and prayer|The new and the old|Early Christian writings|Three Gospel stages|Inspired by God|The Catholic biblical movement|the beginnings|of the Church))/);
  
  sections.forEach((section, index) => {
    const trimmed = section.trim();
    if (trimmed.length > 30) { // Reduced minimum length to catch more content
      // Determine content type based on first sentence patterns
      let contentType = 'paragraph';
      if (/^Hat is.*?\?|^What is.*?\?|^Are you.*?\?|^Do you.*?\?|^How (?:will|can).*?\?/.test(trimmed)) {
        // This looks like an opening question
        contentType = trimmed.length < 200 ? 'header' : 'paragraph';
      } else if (/^(?:the Old Testament|The New Testament|Many books, one story|Law and covenant|Israel's journey|Prophecy and prayer|The new and the old)/.test(trimmed)) {
        contentType = 'header';
      }
      
      blocks.push({
        id: `${baseId}_split_${index}`,
        type: contentType,
        content: trimmed,
        originalClass: originalClass + ' split-paragraph',
        metadata: {
          splitFrom: baseId,
          splitIndex: index,
          autoDetectedType: contentType
        }
      });
    }
  });
  
  return blocks.length > 1 ? blocks : [{
    id: baseId,
    type: mapContentType('paragraph', originalClass, content.trim()),
    content: content.trim(),
    originalClass: originalClass,
    metadata: {}
  }];
}

function mapContentType(xmlType, originalClass = '', content = '') {
  // First check explicit types
  switch (xmlType) {
    case 'callout_text':
      return 'callout_text';
    case 'callout_header':
      return 'callout_header';
    case 'chapter_title':
    case 'section_title':
      return 'header';
  }
  
  // Detect headers from styling patterns
  if (isHeaderByClass(originalClass) || isHeaderByContent(content)) {
    return 'header';
  }
  
  // Default to paragraph
  return 'paragraph';
}

function isHeaderByClass(originalClass) {
  if (!originalClass) return false;
  
  const headerClasses = [
    'heading', 'header', 'title', 'subhead', 'subtitle',
    '_1-head', '_2-head', '_3-head', '_4-head',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'section-head', 'chapter-head', 'sub-head',
    'bold-head', 'center-head'
  ];
  
  const className = originalClass.toLowerCase();
  return headerClasses.some(headerClass => className.includes(headerClass));
}

function isHeaderByContent(content) {
  if (!content || content.length > 100) return false; // Headers are usually short
  
  const trimmed = content.trim();
  
  // Check for header-like patterns
  const headerPatterns = [
    /^[A-Z][A-Za-z\s]+[A-Z]$/, // Title Case or ALL CAPS
    /^[A-Z\s]{3,}$/, // ALL CAPS
    /^\d+\.\s*[A-Z]/, // Numbered sections like "1. Introduction"
    /^Chapter\s+\d+/i, // Chapter titles
    /^Part\s+[IVX\d]+/i, // Part titles
    /^[A-Z][a-z]+\s+of\s+[A-Z]/i, // "Images of God", "Birth of the Church"
  ];
  
  // Content characteristics that suggest headers
  const hasHeaderCharacteristics = [
    trimmed.length < 50, // Short
    !trimmed.includes('.') || trimmed.endsWith('?'), // No periods or ends with question
    /^[A-Z]/.test(trimmed), // Starts with capital
    trimmed.split(' ').length <= 6, // Few words
  ].filter(Boolean).length >= 2; // At least 2 characteristics
  
  const matchesPattern = headerPatterns.some(pattern => pattern.test(trimmed));
  
  return matchesPattern || hasHeaderCharacteristics;
}

function categorizeContentType(element, originalClass) {
  const className = originalClass.toLowerCase();
  
  if (className.includes('callout') || className.includes('box')) {
    if (className.includes('header') || className.includes('title')) {
      return 'callout_header';
    }
    return 'callout_text';
  }
  
  if (className.includes('header') || className.includes('title') || className.includes('heading')) {
    return 'header';
  }
  
  if (className.includes('prayer') || className.includes('scripture')) {
    return 'special_text';
  }
  
  return 'paragraph';
}

function extractTextFromElement(element) {
  let text = '';
  
  if (typeof element === 'string') {
    return element;
  }
  
  if (element['#text']) {
    text += element['#text'];
  }
  
  // Recursively extract text from nested elements
  Object.keys(element).forEach(key => {
    if (key.startsWith('@') || key === '#text') return;
    
    const child = element[key];
    if (Array.isArray(child)) {
      child.forEach(c => {
        text += ' ' + extractTextFromElement(c);
      });
    } else if (typeof child === 'object') {
      text += ' ' + extractTextFromElement(child);
    } else if (typeof child === 'string') {
      text += ' ' + child;
    }
  });
  
  return text.trim();
}

function extractMetadata(element) {
  const metadata = {};
  
  // Extract all attributes as metadata
  Object.keys(element).forEach(key => {
    if (key.startsWith('@')) {
      const metaKey = key.substring(1);
      metadata[metaKey] = element[key];
    }
  });
  
  return metadata;
}

function generateBlockId(index) {
  // Generate a simple ID for elements without one
  const hash = Math.random().toString(36).substring(2, 10);
  return `blk_gen_${String(index).padStart(5, '0')}_${hash}`;
}