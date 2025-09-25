# Making Sections Full-Width on WordPress

## The Challenge
WordPress content is typically wrapped in a container with padding/margins. The Daily Gospel Reflections need certain sections (like the Subscribe section) to break out of this container and span the full width.

## Solution Approaches

### 1. **Negative Margins (Most Reliable)**
Use negative margins to counteract WordPress's container padding:

```html
<!-- Full-width Subscribe Section -->
<div style="
  margin-left: calc(-50vw + 50%);
  margin-right: calc(-50vw + 50%);
  padding-left: calc(50vw - 50%);
  padding-right: calc(50vw - 50%);
  background: linear-gradient(135deg, #0fa3a3 0%, #2c7777 100%);
  padding-top: 50px;
  padding-bottom: 50px;
  text-align: center;
">
  <div style="max-width: 600px; margin: 0 auto;">
    <!-- Content here -->
  </div>
</div>
```

### 2. **WordPress-Specific Classes**
Some themes support full-width classes:

```html
<div class="alignfull" style="background: linear-gradient(135deg, #0fa3a3 0%, #2c7777 100%);">
  <!-- Content -->
</div>
```

### 3. **Viewport Width with Overflow**
Use 100vw width (may cause horizontal scroll on some themes):

```html
<div style="
  width: 100vw;
  position: relative;
  left: 50%;
  right: 50%;
  margin-left: -50vw;
  margin-right: -50vw;
  background: linear-gradient(135deg, #0fa3a3 0%, #2c7777 100%);
">
  <!-- Content -->
</div>
```

## Recommended Implementation

For the DGR Subscribe section, use this approach that combines techniques:

```html
<!-- Subscribe Section - Full Width on WordPress -->
<div style="
  /* Break out of container */
  margin-left: calc(-50vw + 50%);
  margin-right: calc(-50vw + 50%);

  /* Background and spacing */
  background: linear-gradient(135deg, #0fa3a3 0%, #2c7777 100%);
  padding: 50px 20px;
  margin-top: 50px;
  margin-bottom: 0;
  text-align: center;

  /* Ensure full width */
  width: auto;
  max-width: none;
">
  <div style="max-width: 600px; margin: 0 auto;">
    <h3 style="font-family: 'PT Serif', Georgia, serif; font-size: 28px; font-weight: 700; color: white; margin: 0 0 15px;">
      Subscribe to Daily Gospel Reflections
    </h3>
    <p style="font-size: 16px; color: white; margin: 0 0 30px; opacity: 0.95;">
      Sent directly to your email inbox, every morning.
    </p>
    <a href="https://share-ap1.hsforms.com/1tifbJAvIRhmZf5yuh3qEsQ7av94g" target="_blank" style="
      display: inline-block;
      background: white;
      color: #2c7777;
      padding: 14px 35px;
      text-decoration: none;
      font-size: 16px;
      font-weight: 600;
      border-radius: 5px;
      transition: opacity 0.2s ease;
    " onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
      Subscribe
    </a>
  </div>
</div>
```

## Testing Notes

When implementing full-width sections:
1. Test on different WordPress themes
2. Check for horizontal scrollbars
3. Verify mobile responsiveness
4. Test with different container widths

## Browser Compatibility

The `calc(-50vw + 50%)` technique works in:
- All modern browsers
- IE11+ (with calc support)
- Mobile browsers

## Common WordPress Container Classes

Different themes use different container classes:
- `.entry-content` (most common)
- `.post-content`
- `.page-content`
- `.content-area`
- `.site-content`

The negative margin technique works regardless of the container class used.