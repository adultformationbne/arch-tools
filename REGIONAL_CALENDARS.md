# Multi-Region Liturgical Calendar System

## Overview
Expand the liturgical calendar system to support multiple regional variations of the Roman Catholic liturgical calendar, allowing parishes and apps worldwide to access their local Ordo.

## Regional Calendar Variations

### Why Regions Matter

The **General Roman Calendar** is the universal baseline, but each region has:

1. **Different Solemnity Dates**
   - Epiphany: Jan 6 (universal) vs. Sunday between Jan 2-8 (USA, Australia)
   - Ascension: 40 days after Easter vs. 7th Sunday of Easter (USA, Australia)
   - Corpus Christi: Thursday after Trinity Sunday vs. Sunday (many countries)

2. **Regional Saints & Feasts**
   - Australia: Mary MacKillop (Aug 8), Our Lady Help of Christians (May 24)
   - USA: Junípero Serra (Jul 1), Elizabeth Ann Seton (Jan 4)
   - Ireland: St. Patrick (Mar 17 - Solemnity in Ireland, Memorial elsewhere)
   - Philippines: Pedro Calungsod, Lorenzo Ruiz

3. **National Holidays as Solemnities**
   - Some countries elevate local patronal feasts

4. **Translation Differences**
   - Same feast, different names in different languages
   - "All Saints" vs "Todos los Santos" vs "Toussaint"

## Proposed Regional Coverage

### Phase 1: English-Speaking Regions
1. **General Roman Calendar** (Universal baseline)
2. **Australia** (Your current Ordo)
3. **United States** (Large user base)
4. **United Kingdom & Ireland**
5. **Canada**
6. **New Zealand**

### Phase 2: Major Catholic Regions
7. **Mexico** (Spanish)
8. **Philippines** (English/Tagalog)
9. **Brazil** (Portuguese)
10. **Poland** (Polish)
11. **Italy** (Italian)
12. **France** (French)
13. **Spain** (Spanish)

### Phase 3: Additional Regions
- Germany, Argentina, Colombia, Peru, etc.

## Database Schema Design

### Regional Calendar Tables

```sql
-- Regions table
CREATE TABLE liturgical_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL, -- 'GRC', 'AUS', 'USA', 'IRL', etc.
  name VARCHAR(100) NOT NULL,
  name_local VARCHAR(100), -- Local language name
  language_code VARCHAR(5) DEFAULT 'en', -- ISO 639-1
  country_codes TEXT[], -- ISO 3166-1 alpha-2 codes ['AU', 'NZ']
  conference VARCHAR(100), -- Bishops' conference
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Display order
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Regional Ordo calendar (replaces current ordo_calendar)
CREATE TABLE ordo_calendar_regional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID REFERENCES liturgical_regions(id),
  calendar_date DATE NOT NULL,
  liturgical_year INTEGER NOT NULL,
  liturgical_name VARCHAR(255) NOT NULL,
  liturgical_name_local VARCHAR(255), -- Local language
  liturgical_rank VARCHAR(50),
  liturgical_season VARCHAR(50),
  liturgical_week INTEGER,
  year_cycle CHAR(1), -- A, B, C

  -- Regional-specific fields
  is_holy_day_of_obligation BOOLEAN DEFAULT false,
  is_national_holiday BOOLEAN DEFAULT false,
  color VARCHAR(20), -- white, red, green, violet, rose, black
  precedence INTEGER, -- For conflict resolution

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(region_id, calendar_date)
);

-- Regional Lectionary mappings (keeps existing structure)
CREATE TABLE ordo_lectionary_mapping_regional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID REFERENCES liturgical_regions(id),
  calendar_date DATE NOT NULL,
  lectionary_id INTEGER REFERENCES lectionary(admin_order),
  match_type VARCHAR(20), -- exact, partial, manual
  match_method VARCHAR(50),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(region_id, calendar_date)
);

-- Indexes for performance
CREATE INDEX idx_ordo_regional_region_year ON ordo_calendar_regional(region_id, liturgical_year);
CREATE INDEX idx_ordo_regional_date ON ordo_calendar_regional(region_id, calendar_date);
CREATE INDEX idx_ordo_mapping_regional ON ordo_lectionary_mapping_regional(region_id, calendar_date);
```

### Initial Region Data

```sql
INSERT INTO liturgical_regions (code, name, name_local, language_code, country_codes, conference) VALUES
('GRC', 'General Roman Calendar', 'Calendarium Romanum Generale', 'la', NULL, 'Vatican'),
('AUS', 'Australia', 'Australia', 'en', ARRAY['AU'], 'Australian Catholic Bishops Conference'),
('USA', 'United States', 'United States', 'en', ARRAY['US'], 'United States Conference of Catholic Bishops'),
('CAN', 'Canada (English)', 'Canada (English)', 'en', ARRAY['CA'], 'Canadian Conference of Catholic Bishops'),
('IRL', 'Ireland', 'Éire', 'en', ARRAY['IE'], 'Irish Catholic Bishops Conference'),
('GBR', 'England and Wales', 'England and Wales', 'en', ARRAY['GB'], 'Catholic Bishops Conference of England and Wales'),
('NZL', 'New Zealand', 'Aotearoa', 'en', ARRAY['NZ'], 'New Zealand Catholic Bishops Conference'),
('SCT', 'Scotland', 'Alba', 'en', ARRAY['GB-SCT'], 'Bishops Conference of Scotland');
```

## Data Migration Strategy

### Step 1: Migrate Existing Data
```sql
-- 1. Create Australia region (your current data)
INSERT INTO liturgical_regions (code, name, language_code, country_codes, conference)
VALUES ('AUS', 'Australia', 'en', ARRAY['AU'], 'Australian Catholic Bishops Conference')
RETURNING id; -- Save this ID

-- 2. Migrate existing ordo_calendar to regional table
INSERT INTO ordo_calendar_regional (
  region_id,
  calendar_date,
  liturgical_year,
  liturgical_name,
  liturgical_rank,
  liturgical_season,
  liturgical_week,
  year_cycle
)
SELECT
  'YOUR_AUSTRALIA_REGION_ID',
  calendar_date,
  liturgical_year,
  liturgical_name,
  liturgical_rank,
  liturgical_season,
  liturgical_week,
  year_cycle
FROM ordo_calendar;

-- 3. Migrate mappings
INSERT INTO ordo_lectionary_mapping_regional (
  region_id,
  calendar_date,
  lectionary_id,
  match_type,
  match_method
)
SELECT
  'YOUR_AUSTRALIA_REGION_ID',
  calendar_date,
  lectionary_id,
  match_type,
  match_method
FROM ordo_lectionary_mapping;
```

### Step 2: Build General Roman Calendar
The GRC is the baseline. Extract from:
- Vatican's official Calendarium Romanum
- Liturgical year tables (online resources)
- Your Australian calendar minus regional saints

### Step 3: Add Regional Variations
For each new region:
1. Start with GRC as base
2. Add regional saints/feasts
3. Adjust transferred solemnities
4. Mark holy days of obligation

## API Updates

### Regional Query Parameters

```javascript
// Get readings for specific region
GET /api/v1/readings?date=2025-01-06&region=AUS
GET /api/v1/readings?date=2025-01-06&region=USA

// Get calendar for region
GET /api/v1/calendar?start=2025-01-01&end=2025-12-31&region=GRC

// Auto-detect region from IP (optional)
GET /api/v1/today
// Uses CloudFlare country code to detect region
```

### Updated Database Function

```sql
CREATE OR REPLACE FUNCTION get_readings_for_date_regional(
  target_date DATE,
  region_code VARCHAR DEFAULT 'GRC'
)
RETURNS TABLE (
  liturgical_day VARCHAR,
  liturgical_rank VARCHAR,
  liturgical_season VARCHAR,
  liturgical_week INTEGER,
  year_cycle CHAR,
  first_reading VARCHAR,
  psalm VARCHAR,
  second_reading VARCHAR,
  gospel_reading VARCHAR,
  is_holy_day BOOLEAN,
  color VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    oc.liturgical_name,
    oc.liturgical_rank,
    oc.liturgical_season,
    oc.liturgical_week,
    oc.year_cycle,
    l.first_reading,
    l.psalm,
    l.second_reading,
    l.gospel_reading,
    oc.is_holy_day_of_obligation,
    oc.color
  FROM ordo_calendar_regional oc
  INNER JOIN liturgical_regions lr ON oc.region_id = lr.id
  LEFT JOIN ordo_lectionary_mapping_regional olm
    ON oc.calendar_date = olm.calendar_date
    AND oc.region_id = olm.region_id
  LEFT JOIN lectionary l ON olm.lectionary_id = l.admin_order
  WHERE oc.calendar_date = target_date
    AND lr.code = region_code
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
```

## Data Sources for Regional Calendars

### Official Sources

1. **General Roman Calendar**
   - Vatican website: www.vatican.va
   - Liturgical calendar PDFs
   - Ordo Romanus publications

2. **Australia**
   - Australian Catholic Bishops Conference
   - Liturgy Brisbane (your current source)
   - Melbourne Catholic liturgical resources

3. **United States**
   - USCCB website (usccb.org)
   - Official liturgical calendar PDFs
   - Most accessible and well-documented

4. **Other English Regions**
   - UK: catholicchurch.org.uk
   - Ireland: catholicbishops.ie
   - Canada: cccb.ca
   - New Zealand: catholic.org.nz

### Third-Party Aggregators
- Universalis (commercial, but has data)
- Calapi (Czech, but covers multiple regions)
- Catholic Liturgical Calendar apps (for verification)

## Regional Differences: Key Examples

### Example 1: Epiphany (Jan 6)

| Region | Date | Rank | Notes |
|--------|------|------|-------|
| GRC | Jan 6 | Solemnity | Always Jan 6 |
| AUS | Sunday Jan 2-8 | Solemnity | Transferred to Sunday |
| USA | Sunday Jan 2-8 | Solemnity | Transferred to Sunday |
| Spain | Jan 6 | Solemnity | National holiday |

### Example 2: Ascension

| Region | Date | Rank | Notes |
|--------|------|------|-------|
| GRC | Thursday (Easter +40) | Solemnity | Traditional date |
| AUS | 7th Sunday of Easter | Solemnity | Transferred |
| USA | 7th Sunday of Easter | Solemnity | Transferred (most dioceses) |
| UK | Thursday (Easter +40) | Solemnity | Holy Day retained |

### Example 3: Regional Saints

| Saint | GRC | AUS | USA | IRL |
|-------|-----|-----|-----|-----|
| Mary MacKillop | - | Aug 8 (Solemnity) | - | - |
| Patrick | Memorial | Memorial | Memorial | Solemnity |
| Elizabeth Ann Seton | - | - | Jan 4 (Memorial) | - |
| Pedro Calungsod | - | - | - | - (Philippines only) |

## Upload Interface Updates

### Region Selector in Admin

```svelte
<!-- In liturgical calendar upload page -->
<div>
  <label class="mb-2 block text-sm font-semibold text-gray-700">Region</label>
  <select
    bind:value={selectedRegion}
    class="rounded-lg border border-gray-300 px-4 py-2"
  >
    <option value="GRC">General Roman Calendar</option>
    <option value="AUS">Australia</option>
    <option value="USA">United States</option>
    <option value="IRL">Ireland</option>
    <option value="GBR">England & Wales</option>
    <option value="CAN">Canada</option>
    <option value="NZL">New Zealand</option>
  </select>
</div>
```

### Region Switcher in Public View

```svelte
<!-- Show all available regions -->
<div class="flex gap-2">
  {#each regions as region}
    <button
      onclick={() => switchRegion(region.code)}
      class="px-3 py-1 rounded-lg {selectedRegion === region.code ? 'bg-indigo-600 text-white' : 'bg-gray-100'}"
    >
      {region.name}
    </button>
  {/each}
</div>
```

## Lectionary Reuse

**Good news:** The Lectionary readings are mostly universal!

- Same Gospel for "3rd Sunday in Ordinary Time, Year A" worldwide
- Regional differences are in **calendar placement**, not readings
- Your current 942 Lectionary entries cover ALL regions

**What differs:**
- Which day gets which Lectionary entry (Ordo mapping)
- A few optional memorials might have different readings
- Some regional saints have unique proper readings

**Strategy:**
- Keep single Lectionary table (942 entries)
- Create regional Ordo-to-Lectionary mappings
- Add ~50 regional saint readings as needed

## Implementation Roadmap

### Phase 1: Database Migration (1 week)
- [ ] Create new regional tables
- [ ] Migrate Australian data to regional structure
- [ ] Update database functions for regional queries
- [ ] Test backward compatibility

### Phase 2: General Roman Calendar (1 week)
- [ ] Source GRC data (Vatican/online resources)
- [ ] Create GRC year 2025-2026
- [ ] Match GRC to Lectionary (reuse matching algorithm)
- [ ] Validate against known sources

### Phase 3: Add USA Calendar (1 week)
- [ ] Source USCCB Ordo data
- [ ] Identify differences from GRC
- [ ] Create USA calendar 2025-2026
- [ ] Map to Lectionary

### Phase 4: API Updates (1 week)
- [ ] Add region parameter to all endpoints
- [ ] Update public API to accept region codes
- [ ] Add region listing endpoint
- [ ] Update documentation

### Phase 5: UI Updates (3 days)
- [ ] Region selector in admin interface
- [ ] Region switcher in calendar view
- [ ] Display regional metadata
- [ ] Show regional differences

### Phase 6: Additional Regions (Ongoing)
- [ ] UK/Ireland
- [ ] Canada
- [ ] New Zealand
- [ ] Mexico (Spanish)
- [ ] Philippines (English)

## Data Acquisition Strategy

### Option 1: Manual Entry
- Download official PDFs from bishops' conferences
- Enter data manually into CSV
- Use existing upload tool
- **Time:** 1-2 days per region per year
- **Accuracy:** High (official sources)

### Option 2: OCR/Scraping
- Download PDFs and OCR extract
- Parse structured data
- Validate against known dates
- **Time:** Initial setup 2-3 days, then automated
- **Accuracy:** 90-95%, needs validation

### Option 3: Community Contribution
- Open-source the calendar data
- Accept pull requests for regional calendars
- Verify submissions before merging
- **Time:** Depends on community
- **Accuracy:** Varies, needs moderation

### Option 4: API Partnerships
- Partner with Universalis/Calapi
- Licensed data import
- **Time:** Quick once negotiated
- **Accuracy:** High
- **Cost:** Potential licensing fees

## Testing Strategy

### Validation Checks
```javascript
// Test known dates across regions
const testDates = [
  { date: '2025-01-06', regions: {
    GRC: 'Epiphany of the Lord',
    USA: '2 ORDINARY', // Epiphany transferred
    AUS: '2 ORDINARY'
  }},
  { date: '2025-01-05', regions: {
    USA: 'Epiphany of the Lord', // Sunday
    AUS: 'Epiphany of the Lord'
  }},
  { date: '2025-08-08', regions: {
    GRC: 'Saint Dominic',
    AUS: 'Saint Mary MacKillop', // Solemnity in Australia
    USA: 'Saint Dominic'
  }}
];
```

### Cross-Region Comparison
- Generate side-by-side calendars
- Highlight regional differences
- Validate against official sources
- Check holy days of obligation

## Public API Examples

### Get Today's Readings by Region

```javascript
// Auto-detect region from IP
fetch('https://api.yoursite.com/v1/today')
// Returns readings for user's region

// Explicit region
fetch('https://api.yoursite.com/v1/readings?date=2025-08-08&region=AUS')
// Returns: St Mary MacKillop (Solemnity) for Australia

fetch('https://api.yoursite.com/v1/readings?date=2025-08-08&region=USA')
// Returns: St Dominic (Memorial) for USA
```

### List Available Regions

```javascript
fetch('https://api.yoursite.com/v1/regions')
// Returns:
{
  "regions": [
    { "code": "GRC", "name": "General Roman Calendar" },
    { "code": "AUS", "name": "Australia" },
    { "code": "USA", "name": "United States" },
    { "code": "IRL", "name": "Ireland" }
  ]
}
```

### Compare Regions

```javascript
fetch('https://api.yoursite.com/v1/compare?date=2025-01-06&regions=GRC,AUS,USA')
// Returns readings for same date across multiple regions
```

## Benefits of Multi-Region System

### For Users
- ✅ Accurate local liturgical calendar
- ✅ Correct holy days of obligation
- ✅ Local saints and feasts included
- ✅ No confusion about transferred solemnities

### For Developers
- ✅ One API for global coverage
- ✅ Consistent data structure
- ✅ Easy region switching
- ✅ No need to maintain separate data

### For Your Platform
- ✅ Global reach (not just Australia)
- ✅ Differentiation from competitors
- ✅ Scalable architecture
- ✅ Community contribution potential

## Next Steps

1. **Start with what you have:** Migrate Australian calendar to regional structure
2. **Add GRC:** Build the universal baseline
3. **Add USA:** Largest English-speaking market
4. **Scale gradually:** Add regions based on demand/community contribution

This positions your API as the **most comprehensive liturgical calendar API available**, serving the global Catholic Church with accurate, localized data.

Would you like me to start implementing the regional database structure?
