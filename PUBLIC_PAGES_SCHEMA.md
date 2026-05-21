# Public Pages — Block Schema

Use this document when generating JSON content for a course module's public page. Paste this schema guide along with your companion guide session content into an AI assistant and ask it to produce a JSON array of blocks.

## Block Array Format

Each module's content is a JSON array of block objects. Each block has a `type` field and type-specific properties.

```json
[
  { "type": "...", ... },
  { "type": "...", ... }
]
```

---

## Block Types

### `title`
A section heading within the page.
```json
{ "type": "title", "content": "Overview" }
```

### `text`
A body paragraph.
```json
{ "type": "text", "content": "There are many ways we come into a life of faith..." }
```

### `note`
A soft addendum, closing reflection, or aside. Renders as muted italic text. Use after practice steps, questions, or any block that needs a gentle footnote.
```json
{ "type": "note", "content": "This exercise is not a test or something to be achieved. It is a way for you to put into language the hidden movements of grace already working in your heart." }
```

### `quote`
A pull quote or highlighted scripture passage. Renders as a styled blockquote.
```json
{ "type": "quote", "content": "God was willing to give up His own Son to redeem us.", "attribution": "Session 1 Teaching" }
```
`attribution` is optional.

### `accordion`
A collapsible section with a list of items. Use for key themes, structured content with sub-points.
```json
{
  "type": "accordion",
  "title": "Key Themes",
  "items": [
    {
      "title": "The Gospel as Good News",
      "points": [
        "The Gospel means 'good news' — God's announcement that freedom has come through Christ",
        "We carry deep questions about identity: Who am I really?",
        "The Gospel speaks to this longing — God has intervened in our alienation"
      ]
    },
    {
      "title": "Your Intrinsic Value Comes from God",
      "points": [
        "We were created to receive our sense of worth from the Trinity",
        "Our fundamental need is to know we are loved and known"
      ]
    }
  ]
}
```

### `questions`
A numbered list of discussion or reflection questions.
```json
{
  "type": "questions",
  "items": [
    "What led you to do this course?",
    "What is one thing you are hoping to get out of doing this course?",
    "In a couple of sentences, describe what identity means to you."
  ]
}
```

### `ordered_list`
A numbered step-by-step list. Use for practice instructions or sequential steps.
```json
{
  "type": "ordered_list",
  "items": [
    "Find a time and place where you can be alone without distraction.",
    "Reflect on what you learned and identify the concepts that stand out.",
    "Write freely in your journal without judging or correcting yourself."
  ]
}
```

### `unordered_list`
A bullet-point list. Use for non-sequential items.
```json
{
  "type": "unordered_list",
  "items": [
    "Colossians 1:21–22",
    "Ephesians 2:1–5",
    "Romans 8:15"
  ]
}
```

### `scripture`
Scripture reference pills. Use for listing the session's scripture passages.
```json
{
  "type": "scripture",
  "items": [
    "Colossians 1:21–22",
    "Colossians 2:9",
    "2 Corinthians 5:19",
    "Ephesians 2:1–5",
    "Luke 15:11–32",
    "Galatians 4:6",
    "Romans 8:15"
  ]
}
```

### `summary`
A highlighted summary or callout box. Use for the teaching summary.
```json
{ "type": "summary", "content": "The Gospel is the story of God loving us and restoring us to our created value through union with Christ." }
```

### `video`
An embedded video. Use a YouTube or Vimeo embed URL.
```json
{ "type": "video", "url": "https://www.youtube.com/embed/VIDEO_ID", "caption": "Optional caption" }
```
`caption` is optional.

### `image`
An image with optional caption.
```json
{ "type": "image", "url": "https://...", "caption": "Optional caption" }
```

### `divider`
A visual separator between content groups. No properties needed.
```json
{ "type": "divider" }
```

---

## Example: Full Session

```json
[
  { "type": "title", "content": "Overview" },
  { "type": "text", "content": "There are many ways we come into a life of faith..." },
  { "type": "text", "content": "Whichever path has led you to discipleship, it is of immense value..." },
  { "type": "divider" },
  { "type": "title", "content": "Opening Questions" },
  { "type": "questions", "items": [
    "What led you to do this course?",
    "What is one thing you are hoping to get out of doing this course?",
    "In a couple of sentences, describe what identity means to you."
  ]},
  { "type": "divider" },
  { "type": "title", "content": "Teaching Summary" },
  { "type": "summary", "content": "The Gospel is the story of God loving us and restoring us to our created value through union with Christ." },
  { "type": "title", "content": "Key Themes" },
  { "type": "accordion", "title": "Key Themes", "items": [
    { "title": "The Gospel as Good News", "points": ["The Gospel means 'good news'", "We carry deep questions about identity"] },
    { "title": "Your Intrinsic Value Comes from God", "points": ["We were created to receive worth from the Trinity"] }
  ]},
  { "type": "divider" },
  { "type": "title", "content": "Scripture" },
  { "type": "scripture", "items": ["Colossians 1:21–22", "Ephesians 2:1–5", "Romans 8:15"] },
  { "type": "divider" },
  { "type": "title", "content": "Discussion Questions" },
  { "type": "questions", "items": [
    "How could this understanding of God's love shape your sense of intrinsic value?",
    "How can you respond in your everyday life to the idea that God loves you now as much as ever?",
    "How can we pray with and for one another over the next 7 weeks?"
  ]},
  { "type": "divider" },
  { "type": "title", "content": "Practice" },
  { "type": "text", "content": "This week your practice is to write a prayer in your journal..." },
  { "type": "ordered_list", "items": [
    "Find a time and place where you can be alone with Jesus without distraction.",
    "Reflect on what you learned and identify concepts that stand out.",
    "Write freely in your journal without judging or correcting.",
    "Read back what you wrote and notice the main themes.",
    "Write a prayer expressing your intention for this course."
  ]},
  { "type": "note", "content": "This exercise is not a test or something to be achieved. It is a way for you to put into language the hidden movements of grace already working in your heart. It should take anywhere from 5 to 30 minutes." }
]
```

---

## AI Prompt Template

> I have a companion guide session below. Please convert it into a JSON array following the block schema in the attached document. Use `title` blocks for section headings, `text` for body paragraphs, `questions` for discussion/opening questions, `accordion` for key themes with sub-points, `scripture` for scripture references, `ordered_list` for practice steps, `summary` for the teaching summary paragraph, `note` for any closing reflections or addendums, and `divider` between major sections. Return only valid JSON with no commentary.
>
> [paste session content here]
