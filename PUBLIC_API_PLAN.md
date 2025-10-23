# Public Liturgical Calendar API - Implementation Plan

## Overview
Transform the internal liturgical calendar system into a public API that Catholic ministries, parishes, and developers can use to access daily Mass readings and liturgical information.

## Current State
- ✅ Complete Lectionary database (942 entries)
- ✅ Ordo calendar mappings (730 days, 2025-2026)
- ✅ Intelligent matching system
- ✅ All 4 daily readings stored
- ✅ Year cycle calculation (A, B, C)
- ✅ Internal admin API endpoints

## Public API Endpoints

### 1. Daily Readings
**GET /api/v1/readings**

Query Parameters:
- `date` (optional) - YYYY-MM-DD format, defaults to today
- `locale` (optional) - Language code (future: en, es, fr, etc.)

Response:
```json
{
  "date": "2025-12-25",
  "liturgical_day": "Nativity of the Lord",
  "liturgical_rank": "Solemnity",
  "liturgical_season": "Christmas",
  "liturgical_week": null,
  "year_cycle": "C",
  "readings": {
    "first_reading": "Isaiah 52:7-10",
    "responsorial_psalm": "Psalm 98:1-6",
    "second_reading": "Hebrews 1:1-6",
    "gospel": "John 1:1-18"
  },
  "color": "white"
}
```

### 2. Calendar Range
**GET /api/v1/calendar**

Query Parameters:
- `start` (required) - YYYY-MM-DD
- `end` (required) - YYYY-MM-DD (max 365 days)
- `rank` (optional) - Filter by rank: solemnity, feast, sunday, memorial, feria

Response:
```json
{
  "total": 31,
  "start_date": "2025-12-01",
  "end_date": "2025-12-31",
  "entries": [
    {
      "date": "2025-12-25",
      "liturgical_day": "Nativity of the Lord",
      "rank": "Solemnity",
      "readings": { ... }
    }
  ]
}
```

### 3. Major Feasts/Sundays
**GET /api/v1/major-feasts**

Query Parameters:
- `year` (required) - Year to fetch
- `type` (optional) - solemnities, sundays, all (default: all)

Response:
```json
{
  "year": 2025,
  "year_cycle": "C",
  "feasts": [
    {
      "date": "2025-01-01",
      "name": "Solemnity of Mary, Mother of God",
      "rank": "Solemnity",
      "is_holy_day": true
    },
    {
      "date": "2025-01-05",
      "name": "Epiphany of the Lord",
      "rank": "Solemnity"
    }
  ]
}
```

### 4. Search
**GET /api/v1/search**

Query Parameters:
- `q` (required) - Search term
- `year` (optional) - Limit to specific year

Response:
```json
{
  "query": "Epiphany",
  "results": [
    {
      "date": "2025-01-06",
      "liturgical_day": "Epiphany of the Lord",
      "rank": "Solemnity"
    }
  ]
}
```

### 5. Today's Readings
**GET /api/v1/today**

Simple endpoint for current day (no parameters needed).

Response: Same as /api/v1/readings with today's date

### 6. Liturgical Year Info
**GET /api/v1/year-info**

Query Parameters:
- `year` (optional) - Defaults to current year

Response:
```json
{
  "year": 2025,
  "year_cycle": "C",
  "advent_starts": "2025-11-30",
  "christmas": "2025-12-25",
  "ash_wednesday": "2025-03-05",
  "easter_sunday": "2025-04-20",
  "pentecost": "2025-06-08"
}
```

## API Features

### Authentication
**Tiered Access:**

1. **Free Tier** (No API Key)
   - 100 requests/day
   - Basic endpoints only (/readings, /today)
   - Rate limited to 10 requests/minute

2. **Registered Tier** (API Key Required)
   - 10,000 requests/day
   - All endpoints
   - Rate limited to 60 requests/minute
   - Usage analytics dashboard

3. **Premium Tier** (Paid/Partnership)
   - Unlimited requests
   - Priority support
   - Custom endpoints
   - SLA guarantees

### Rate Limiting
```javascript
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### CORS
Enable CORS for all domains:
```javascript
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
```

### Caching
- HTTP Cache-Control headers
- Daily readings cached for 24 hours
- Calendar ranges cached based on date proximity
- CDN integration (Cloudflare)

### Documentation
- OpenAPI/Swagger spec
- Interactive API explorer
- Code examples (JavaScript, Python, PHP, Ruby)
- Postman collection

## Implementation Steps

### Phase 1: API Infrastructure (Week 1)
- [ ] Create `/api/v1/` namespace
- [ ] Implement rate limiting middleware
- [ ] Add CORS headers
- [ ] Create API key system (Supabase table)
- [ ] Add usage tracking

### Phase 2: Core Endpoints (Week 2)
- [ ] `/api/v1/readings` - Daily readings
- [ ] `/api/v1/today` - Today's readings
- [ ] `/api/v1/calendar` - Date range
- [ ] Error handling and validation
- [ ] Response caching

### Phase 3: Advanced Features (Week 3)
- [ ] `/api/v1/major-feasts` - Solemnities/Sundays
- [ ] `/api/v1/search` - Search functionality
- [ ] `/api/v1/year-info` - Liturgical year metadata
- [ ] Webhook notifications (optional)

### Phase 4: Documentation & Launch (Week 4)
- [ ] OpenAPI specification
- [ ] Developer documentation site
- [ ] Code examples and SDKs
- [ ] API dashboard for registered users
- [ ] Public announcement
- [ ] Monitor usage and feedback

## Technical Implementation

### Database Schema Additions

```sql
-- API Keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(64) UNIQUE NOT NULL,
  user_email VARCHAR(255),
  tier VARCHAR(20) DEFAULT 'free', -- free, registered, premium
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  daily_limit INTEGER DEFAULT 100,
  notes TEXT
);

-- API Usage tracking
CREATE TABLE api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id),
  endpoint VARCHAR(255),
  request_date DATE,
  request_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(api_key_id, endpoint, request_date)
);

-- Indexes for performance
CREATE INDEX idx_api_keys_key ON api_keys(key);
CREATE INDEX idx_api_usage_key_date ON api_usage(api_key_id, request_date);
```

### Middleware Example

```javascript
// Rate limiting middleware
export async function rateLimitMiddleware({ request, locals }) {
  const apiKey = request.headers.get('X-API-Key');
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  // Check rate limit
  const limit = await checkRateLimit(apiKey || ip);

  if (limit.exceeded) {
    return new Response(JSON.stringify({
      error: 'Rate limit exceeded',
      limit: limit.max,
      reset: limit.reset
    }), {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.max,
        'X-RateLimit-Remaining': 0,
        'X-RateLimit-Reset': limit.reset
      }
    });
  }

  // Track usage
  await trackApiUsage(apiKey, request.url);

  return null; // Continue to endpoint
}
```

### Example Endpoint Implementation

```javascript
// /api/v1/readings/+server.js
import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export async function GET({ url, request }) {
  const dateParam = url.searchParams.get('date');
  const targetDate = dateParam || new Date().toISOString().split('T')[0];

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return json({
      error: 'Invalid date format. Use YYYY-MM-DD'
    }, { status: 400 });
  }

  // Fetch from database
  const { data, error } = await supabase.rpc('get_readings_for_date', {
    target_date: targetDate
  });

  if (error || !data?.[0]) {
    return json({
      error: 'No readings found for this date'
    }, { status: 404 });
  }

  const reading = data[0];

  return json({
    date: targetDate,
    liturgical_day: reading.liturgical_day,
    liturgical_rank: reading.liturgical_rank,
    liturgical_season: reading.liturgical_season,
    year_cycle: reading.year_cycle,
    readings: {
      first_reading: reading.first_reading,
      responsorial_psalm: reading.psalm,
      second_reading: reading.second_reading,
      gospel: reading.gospel_reading
    }
  }, {
    headers: {
      'Cache-Control': 'public, max-age=86400', // 24 hours
      'X-API-Version': '1.0'
    }
  });
}
```

## Revenue Model (Optional)

### Free for All
- Keep basic API completely free
- Build goodwill with Catholic community
- Optional donation button

### Freemium
- Free tier: 100 req/day
- Paid tier: $10/month for 100k req/day
- Enterprise: Custom pricing

### Sponsorship
- Parish sponsorships
- Diocesan partnerships
- Catholic organization grants

## Marketing & Distribution

### Developer Outreach
1. Post on Catholic developer forums
2. Reach out to Catholic app developers
3. Contact parish website companies
4. Catholic software directory listings

### Documentation Site
- docs.yoursite.com/api
- Interactive examples
- Showcase apps using the API
- Community gallery

### Sample Apps
Build demo apps to showcase:
- Daily readings widget
- Parish website plugin (WordPress)
- Mobile app example (React Native)
- Digital signage template

## Legal & Compliance

### Terms of Service
- Attribution required for free tier
- No commercial reselling of data
- No excessive scraping
- Data accuracy disclaimer

### Data Licensing
- Readings references (not full text) are factual data
- Liturgical calendar is public domain
- Full scripture text requires permissions (NAB, RSV, etc.)

### Privacy
- No personal data collection (free tier)
- Email only for registered tier
- GDPR compliance for EU users
- Clear privacy policy

## Success Metrics

### Technical KPIs
- 99.9% uptime
- < 100ms average response time
- < 1% error rate

### Adoption Metrics
- 1,000 API calls/day within 3 months
- 100 registered API keys within 6 months
- 10 showcase apps using the API

### Community Impact
- Used by 50+ parishes
- 10+ Catholic apps integrated
- Positive developer feedback

## Future Enhancements

### Phase 2 Features
- Full scripture text (with licensing)
- Multi-language support (Spanish, French, Latin)
- Audio readings
- Saint of the day
- Liturgical color/vestments
- Mass time finder integration

### Advanced Features
- Webhooks for daily readings
- GraphQL API
- WebSocket for real-time updates
- Mobile SDKs (iOS, Android)
- NPM package for JavaScript

## Comparison to Existing APIs

### Current Catholic APIs
1. **Universalis** - Commercial, limited free tier
2. **USCCB API** - US-focused, not always available
3. **Calapi** - Czech, limited English support

### Your Competitive Advantages
- ✅ Free and open
- ✅ Modern REST API
- ✅ Complete daily readings
- ✅ Intelligent Ordo matching
- ✅ Well-documented
- ✅ Fast response times
- ✅ Developer-friendly

## Support & Maintenance

### Community Support
- GitHub issues for bug reports
- Developer Discord/Slack
- Email support for registered users

### Monitoring
- Uptime monitoring (UptimeRobot)
- Error tracking (Sentry)
- Analytics (Plausible or Fathom)
- API usage dashboard

### Updates
- Annual Ordo updates (new liturgical years)
- Lectionary corrections as needed
- API versioning for breaking changes
- Deprecation notices with 6-month lead time

## Conclusion

This API could serve thousands of Catholic developers, parishes, and ministries worldwide. The infrastructure is already 90% complete—you just need to:

1. Add public API endpoints
2. Implement authentication/rate limiting
3. Create documentation
4. Announce to the community

**Estimated Time to Launch:** 3-4 weeks for MVP

**Potential Impact:** Could become the de facto standard for Catholic liturgical calendar APIs, serving millions of users through various apps and websites.

Would you like me to start implementing the public API infrastructure?
