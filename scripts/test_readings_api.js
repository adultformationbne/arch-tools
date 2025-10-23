// Test readings API with multiple dates
const testDates = [
  { date: '2025-10-19', expected: 'Luke 18:1-8', name: 'Oct 19, 2025 - 29th Sun Ordinary Time C' },
  { date: '2025-12-01', expected: 'Matthew 8:5-11', name: 'Dec 1, 2025 - Monday Advent 1 Year A' },
  { date: '2026-02-18', expected: 'Matthew 6:1-6, 16-18', name: 'Feb 18, 2026 - Ash Wednesday' },
  { date: '2026-04-12', expected: 'John 20:19-31', name: 'Apr 12, 2026 - 2nd Sunday Easter' },
  { date: '2026-06-07', expected: 'John 6:51-58', name: 'Jun 7, 2026 - Corpus Christi' }
];

async function testDate(dateInfo) {
  try {
    const response = await fetch('http://localhost:5173/api/dgr/readings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dateInfo.date })
    });

    const data = await response.json();

    if (data.error) {
      console.log(`❌ ${dateInfo.name}`);
      console.log(`   Error: ${data.error}\n`);
      return;
    }

    const r = data.readings;
    const match = r.gospel_reading === dateInfo.expected;
    const icon = match ? '✅' : '❌';

    console.log(`${icon} ${dateInfo.name}`);
    console.log(`   Liturgical: ${r.liturgical_name}`);
    console.log(`   Expected: ${dateInfo.expected}`);
    console.log(`   Got: ${r.gospel_reading}`);
    console.log(`   First Reading: ${r.first_reading}\n`);

  } catch (error) {
    console.log(`❌ ${dateInfo.name}`);
    console.log(`   Error: ${error.message}\n`);
  }
}

async function runTests() {
  console.log('Testing Readings API\n');
  console.log('='.repeat(60) + '\n');

  for (const dateInfo of testDates) {
    await testDate(dateInfo);
  }
}

runTests();
