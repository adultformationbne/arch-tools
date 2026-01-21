// Quick test of parseReadings logic

const BOOK_PATTERN = /^((?:\d\s*)?[A-Za-z]+)\s*([\d:,\-–—\s]+)$/;

function parseReadings(readingsStr) {
  if (!readingsStr) return [];
  const readings = readingsStr.split(/[;|]/).map(r => r.trim()).filter(r => r);
  let previousBook = '';

  return readings.map(reading => {
    const match = reading.match(BOOK_PATTERN);
    const versesOnlyMatch = reading.match(/^([\d:,\-–—\s]+)$/);

    if (versesOnlyMatch && previousBook) {
      return { book: previousBook, verses: versesOnlyMatch[1].trim() };
    }

    if (!match) return { book: reading, verses: '' };

    let [, bookAbbr, verses] = match;
    previousBook = bookAbbr;
    return { book: bookAbbr, verses: verses.trim() };
  });
}

const testCases = [
  '1 Samuel 18:6-9; 19:1-7',
  'Zephaniah 2:3; 3:12-13',
  '1 Kings 11:29-32; 12:19',
  'Hebrews 6:10-20; Psalm 110:1-2; Mark 2:23-28',
  '1 Samuel 18:6-9; 19:1-7; Psalm 55:2-3, 9-14; Mark 3:7-12'
];

console.log('Testing parseReadings with book continuation fix:\n');

for (const test of testCases) {
  console.log('Input:', test);
  const result = parseReadings(test);
  console.log('Pills:');
  result.forEach((r, i) => console.log(`  ${i+1}. [${r.book}] ${r.verses}`));
  console.log('');
}
