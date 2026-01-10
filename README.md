# YouTube Channel Analyzer

A tool for discovering great videos on any YouTube channel using advanced engagement metrics and statistical analysis.

Analyzes videos by Comments Per Day, Comments Per View, Likes Per View, engagement rates, and proprietary quality scores to identify patterns and outliers. Filter by video length, analyze up to 100,000 videos, and export results as JSON or CSV.

Requires a YouTube Data API v3 key.

## Build

### Development
```bash
npm install
npm run dev
```

### Production Build
```bash
npm run build
```

This generates:
- `dist/` - Standard Vite build output
- `YT-Channel-Analyzer_compiled.html` - Standalone HTML file with all JavaScript inlined

The compiled HTML file can be:
- Hosted on any web server
- Opened directly in a browser from the file system
- Shared as a single file

## CI/CD

The GitHub Actions workflow automatically runs on:
- Pushes to `main` or `master` branch
- Changes to source files (`src/`, `index.html`, `package.json`, `vite.config.ts`)
- Manual trigger via workflow dispatch

The workflow:
1. Installs dependencies
2. Runs `npm run build`
3. Commits the updated `YT-Channel-Analyzer_compiled.html` back to the repository
