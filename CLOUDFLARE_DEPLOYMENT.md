# PWA & Cloudflare Deployment Guide

## PWA Features Added

The application now includes full Progressive Web App (PWA) support with the following features:

### ✅ Service Worker
- **Offline Support**: Cached resources allow basic functionality when offline
- **Network-First Strategy**: API calls prioritize fresh data
- **Cache-First Strategy**: Static assets are cached for fast loading
- **Background Sync**: Pending requests sync when connection is restored

### ✅ Web App Manifest
- **Installable**: Users can install the app as a standalone application
- **Custom Branding**: Custom name, icons, and theme colors
- **Multiple Icon Sizes**: 192x192 and 512x512 for various device displays
- **Maskable Icons**: Support for adaptive icons on modern devices

### ✅ Meta Tags
- Apple mobile web app capable
- Custom theme color
- Status bar styling
- OG/Twitter cards for social sharing

## Before Deploying

### 1. **Add PWA Icons to `/public` folder**

You need to create the following icon files in the `public/` directory:
- `icon-192.png` (192x192 px)
- `icon-192-maskable.png` (192x192 px, with safe zone - center 40%)
- `icon-512.png` (512x512 px)
- `icon-512-maskable.png` (512x512 px, with safe zone)
- `screenshot-1.png` (540x720 px, mobile view)
- `screenshot-2.png` (1280x720 px, desktop view)

Icons should follow these guidelines:
- PNG format with transparency
- Maskable icons should have content in the center 40% area
- Use the app's brand colors (dark theme)

### 2. **Install Dependencies**
```bash
npm install
```

This will install `vite-plugin-pwa` which handles PWA manifest generation and service worker integration.

## Deploying to Cloudflare

### Option 1: Using Wrangler CLI (Recommended)

```bash
# Install Wrangler globally (if not already installed)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Build the application
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy dist/public --project-name ledger-app

# Or deploy to Cloudflare Workers
wrangler deploy
```

### Option 2: Using Cloudflare Pages UI

1. Connect your GitHub repository to Cloudflare Pages
2. Set build command: `npm run build`
3. Set publish directory: `dist/public`
4. Deploy

### Option 3: Using GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - run: npm install
      - run: npm run build
      
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: ledger-app
          directory: dist/public
```

## Configuration Files Updated

### `vite.config.ts`
- Added `VitePWA` plugin from `vite-plugin-pwa`
- Configured manifest, workbox caching strategies
- Set up service worker auto-update

### `wrangler.jsonc`
- Updated to production-ready configuration
- Added environment-specific settings (production/development)
- Configured routes and build settings

### `src/routes/__root.tsx`
- Added PWA meta tags (apple-mobile-web-app, theme-color)
- Added manifest.json link
- Registered service worker on app load

### `public/manifest.json`
- Web app manifest with all required fields
- Icon configurations with maskable support
- Screenshot configurations for app stores

### `public/sw.js`
- Service worker with caching strategies
- Background sync support
- Network and cache fallbacks

## Testing PWA Features

### 1. **Desktop (Chrome/Edge)**
- Open DevTools → Application → Manifest
- Click "Install app" in address bar
- Check "Installed" status

### 2. **Mobile (Android)**
- Open Chrome
- Tap menu → "Install app"
- Verify app appears on home screen

### 3. **Offline Testing**
- Go to DevTools → Application → Service Workers
- Check "Offline" checkbox
- Navigate to cached pages to verify offline mode

### 4. **Lighthouse Audit**
- Run Lighthouse audit in DevTools
- Check PWA category score (should be 90+)

## Monitoring & Updates

### Service Worker Updates
The PWA is configured for auto-update. When you deploy new versions:
1. Old service worker continues serving cached assets
2. New version is fetched in background
3. Users are prompted to update via toast notification
4. App refreshes on next visit after update

### Cache Strategy Details

**Static Assets (JS, CSS, Fonts, Images)**
- Cache-first: Use cached version, fall back to network
- Reduces bandwidth and improves performance

**API Calls & Supabase**
- Network-first: Always try fresh data
- Falls back to cache if offline
- Supabase calls cached for 1 hour

**HTML Pages**
- Network-first: Try to get fresh page
- Falls back to cache if offline
- Enables offline navigation to cached pages

## Environment Variables

Update your `.env` file with Cloudflare settings:

```env
# Existing Supabase config
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Cloudflare (if using Workers KV)
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
```

## Troubleshooting

### Service Worker Not Registering
- Check browser DevTools → Application → Service Workers
- Verify `/public/sw.js` is accessible
- Check browser console for errors

### Icons Not Showing
- Verify files exist in `/public/` folder
- Check manifest.json paths are correct
- Icons should be in PNG format with transparency

### Offline Mode Not Working
- Check DevTools → Network tab for cached resources
- Verify service worker is active (blue status)
- Test with DevTools offline mode enabled

### Build Errors
```bash
# Clear cache and rebuild
rm -rf dist node_modules package-lock.json
npm install
npm run build
```

## Performance Tips

1. **Compress Icons**: Use tools like ImageOptim for smaller file sizes
2. **Monitor Cache Size**: Keep cache under 50MB for optimal performance
3. **Update Frequency**: Consider your deployment frequency for cache busting
4. **Test on Slow Networks**: Use DevTools network throttling (3G/4G)

## Resources

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Web.dev PWA Checklist](https://web.dev/pwa-checklist/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)

## Security Considerations

- Service worker only works over HTTPS (except localhost)
- Supabase authentication tokens are cached securely
- Sensitive data is not persisted in cache
- Cache is cleared on app updates
- Use `max-age` headers for cache control

---

**Next Steps:**
1. Create PWA icons (192x192, 512x512) in `/public/`
2. Test locally: `npm run dev`
3. Build and test: `npm run build && npm run preview`
4. Deploy using one of the methods above
