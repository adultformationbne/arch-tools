// Better content extraction strategy
// Instead of fixing the broken HTML export, let's create a cleaner structure

export function createCleanStructure() {
  // Chapter 4 proper structure based on original book
  const chapter4 = {
    id: "ch_004_clean",
    number: 4,
    title: "The Bible – the Word of God",
    sections: [
      {
        id: "sec_004_001_intro",
        title: "Introduction", // This is what was missing!
        blocks: [
          {
            id: "blk_004_001_question",
            type: "paragraph",
            content: "What is the basic rule of faith for Catholics? Where do we find revealed those truths which are the foundations of our faith? The usual answer given to these questions has been in the writings of the Bible and in the Tradition of the Church (from a Latin word, trāditiō, meaning 'to pass' or 'hand on'). This is a view shared by all the major Christian churches, because we all look to the Bible as the main source of the basic truths of Christianity and each church has its own tradition."
          },
          {
            id: "blk_004_002_tradition",
            type: "paragraph", 
            content: "We Catholics place more emphasis on Tradition than the other churches, but this does not mean we regard Scripture and Tradition as two completely separate and distinct sources of God's revelation. The New Testament narratives about Jesus emerge from an already active process of 'traditioning'. Prior to the written forms, there were oral traditions about the words and deeds of Jesus. The written forms (Scripture) developed from a process of communal formation (Tradition). Scripture and Tradition are all part of the same process. God's truth is one and indivisible, and the Bible and the Church are closely related to each other. The Tradition of the Church is really the teaching Church's official interpretation of the Scripture. The Church's ongoing understanding and exposition of the truth contained in Scripture is what makes up Tradition."
          }
        ]
      },
      {
        id: "sec_004_002_what_is_bible",
        title: "What is the Bible?",
        blocks: [
          {
            id: "blk_004_003_bible_intro",
            type: "paragraph",
            content: "So we come back to the Bible, the Scriptures, as the basic source of divine truth and revelation. It is important, therefore, that we have a clear understanding of what the Bible is. In this first of two chapters on the Bible, we shall look at its contents and say something about how it came into existence or how it took shape."
          }
          // ... more properly structured blocks
        ]
      }
    ]
  };
  
  return chapter4;
}

export function fixChapterStructure(brokenChapter) {
  // Strategy to fix chapters that are missing their opening sections
  
  // Look for mega-paragraphs that contain multiple logical sections
  const fixedBlocks = [];
  let pendingIntroContent = "";
  
  brokenChapter.blocks.forEach(block => {
    // If we find content that should be an introduction before any section headers
    if (block.content.includes("What is the basic rule") || 
        block.content.includes("Where do we find revealed")) {
      
      // Extract the intro content before any section starts
      const beforeFirstSection = block.content.split(/(?=What is the Bible\?)/)[0];
      if (beforeFirstSection.trim()) {
        // Split the intro into logical paragraphs
        const introParagraphs = beforeFirstSection.split(/(?=We Catholics place|The New Testament narratives)/);
        
        introParagraphs.forEach((para, index) => {
          if (para.trim().length > 50) {
            fixedBlocks.push({
              id: `${block.id}_intro_${index}`,
              type: 'paragraph',
              content: para.trim(),
              section: 'introduction'
            });
          }
        });
      }
    } else {
      fixedBlocks.push(block);
    }
  });
  
  return {
    ...brokenChapter,
    blocks: fixedBlocks
  };
}

// Reference structure for what Chapter 4 should look like:
export const chapter4Reference = {
  sections: [
    "Introduction (What is the basic rule of faith...)",
    "What is the Bible?", 
    "Many books, one story",
    "The Old Testament",
    "Law and covenant", 
    "Israel's journey",
    "Prophecy and prayer",
    "The New Testament",
    "The new and the old",
    "The Catholic biblical movement",
    "The beginnings of the Church",
    "Early Christian writings",
    "Three Gospel stages", 
    "Inspired by God"
  ]
};