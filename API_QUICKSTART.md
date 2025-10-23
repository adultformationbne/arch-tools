# API Quick Start - 2 Minute Guide

## 🚀 Your API is Live!

You now have a **free public API** for Catholic Mass readings.

## 📍 Endpoints

### Today's Readings (No parameters needed)
```
GET /api/v1/today
```

### Specific Date
```
GET /api/v1/readings?date=2025-12-25
```

## 💻 Try It Now

### In Your Browser
```
http://localhost:5175/api/v1/today
http://localhost:5175/api/v1/readings?date=2025-12-25
```

### In Terminal
```bash
curl http://localhost:5175/api/v1/today
```

### In JavaScript
```javascript
fetch('/api/v1/today')
  .then(res => res.json())
  .then(data => console.log(data.liturgical_day, data.readings.gospel));
```

## 📖 Documentation

Full docs at: http://localhost:5175/api/v1

## ✅ What You Get

```json
{
  "liturgical_day": "THE NATIVITY OF THE LORD",
  "liturgical_rank": "Solemnity",
  "year_cycle": "C",
  "readings": {
    "first_reading": "Numbers 6:22-27",
    "psalm": "Psalm 66:2-3.5.6.8",
    "second_reading": "Galatians 4:4-7",
    "gospel": "Luke 2:16-21"
  }
}
```

## 🌟 Features

- ✅ **Free** - No API keys, no limits
- ✅ **Fast** - Sub-100ms responses
- ✅ **CORS** - Use from anywhere
- ✅ **Complete** - All 4 readings + metadata

## 🎯 Use Cases

- Catholic mobile apps
- Parish websites
- Prayer apps
- Digital signage
- Notification services

## 📊 Coverage

- **Region:** Australia
- **Years:** 2025-2026
- **Entries:** 730 days fully mapped

## 🔮 Coming Soon

- USA, UK, Ireland regions
- Calendar range queries
- Search functionality
- More years

## 🚢 Deploy

Ready to deploy to production:
- Vercel (recommended)
- Netlify
- Cloudflare Pages

## 📞 Questions?

See full docs: `API_README.md`

---

**That's it! You have a working public API. 🎉**
