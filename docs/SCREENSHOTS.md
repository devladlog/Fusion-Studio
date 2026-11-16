# Screenshot Guide for Fusion Studio

This guide explains how to capture and organize screenshots for the VS Code Marketplace and documentation.

---

## Required Screenshots

The README references the following screenshots that need to be captured:

| Filename | Description | Location | Size |
|----------|-------------|----------|------|
| `banner.png` | Hero banner for README header | docs/assets/ | 1200x300 |
| `dashboard.png` | Main dashboard view | docs/assets/screenshots/ | 1200x800 |
| `dashboard-full.png` | Full dashboard with all sections | docs/assets/screenshots/ | 1400x900 |
| `ai-generation.png` | AI generation panel | docs/assets/screenshots/ | 800x600 |
| `dataverse-designer.png` | Dataverse table designer | docs/assets/screenshots/ | 1200x800 |
| `flow-designer.png` | Flow designer canvas | docs/assets/screenshots/ | 1200x800 |
| `chat-panel.png` | AI Copilot chat interface | docs/assets/screenshots/ | 600x800 |
| `dependency-graph.png` | Dependency graph visualization | docs/assets/screenshots/ | 1000x600 |

---

## Capturing Screenshots

### Step 1: Prepare the Environment

1. Open VS Code with Fusion Studio installed
2. Use a clean, dark theme (recommended: One Dark Pro or GitHub Dark)
3. Set zoom level to 100%
4. Hide unnecessary panels and toolbars
5. Use a resolution of at least 1920x1080

### Step 2: Launch Extension Development Host

```powershell
cd extension
npm run bundle
# Press F5 to launch Extension Development Host
```

### Step 3: Capture Each Screenshot

#### Dashboard (`dashboard.png` / `dashboard-full.png`)
1. Run command: `Power Apps: Open Fusion Studio Dashboard`
2. Wait for dashboard to fully load
3. Capture with Windows Snipping Tool or ShareX
4. Save as PNG

#### AI Generation (`ai-generation.png`)
1. Open Dashboard
2. Click on "AI Doc" or "AI Mockup" section
3. Show the generation input area
4. Capture the relevant panel

#### Dataverse Designer (`dataverse-designer.png`)
1. Run command: `Power Apps: Open Dataverse Designer`
2. Add some sample columns to show functionality
3. Capture the full designer interface

#### Flow Designer (`flow-designer.png`)
1. Run command: `Power Apps: Open Flow Designer`
2. Add a few sample steps to the flow
3. Capture showing the visual flow builder

#### Chat Panel (`chat-panel.png`)
1. Run command: `Power Apps: Open AI Copilot`
2. Show a sample conversation if possible
3. Capture the chat interface

#### Dependency Graph (`dependency-graph.png`)
1. Open a Power App with dependencies
2. Run command: `Power Apps: Export Dependency Graph`
3. Preview the generated Mermaid diagram
4. Capture or export the visualization

---

## Creating the Banner

The banner (`banner.png`) should be a professional header image:

### Option 1: Use Canva/Figma
1. Create a 1200x300 canvas
2. Use dark gradient background (#1e1e2e to #2d2d3d)
3. Add Fusion Studio logo on the left
4. Add tagline: "Power Apps Studio inside VS Code"
5. Add feature icons on the right

### Option 2: Use the Template

```
+------------------------------------------------------------------+
|                                                                  |
|   [Logo]  FUSION STUDIO                                          |
|           Power Apps Studio inside VS Code                       |
|           with engineering super-powers                          |
|                                                          [Icons] |
|                                                                  |
+------------------------------------------------------------------+
```

### Recommended Colors
- Background: `#1e1e2e` (dark purple/blue)
- Accent: `#00d4aa` (teal/mint green)
- Text: `#ffffff` (white)
- Secondary: `#a0a0a0` (gray)

---

## Image Optimization

Before uploading, optimize images:

```powershell
# Using ImageMagick (optional)
magick input.png -strip -quality 85 output.png

# Or use online tools:
# - TinyPNG (https://tinypng.com/)
# - Squoosh (https://squoosh.app/)
```

### Recommended Settings
- Format: PNG (for screenshots) or SVG (for logos)
- Quality: 85-90%
- Strip metadata: Yes
- Max file size: 500KB per image

---

## Folder Structure

```
docs/
  assets/
    banner.png                 <- Hero banner
    logo.png                   <- Extension logo
    screenshots/
      dashboard.png            <- Dashboard preview
      dashboard-full.png       <- Full dashboard
      ai-generation.png        <- AI generation
      dataverse-designer.png   <- Dataverse designer
      flow-designer.png        <- Flow designer
      chat-panel.png           <- AI chat
      dependency-graph.png     <- Dependency visualization
```

---

## Hosting Screenshots

### Option A: GitHub Repository (Recommended)

All images are referenced from:
```
https://raw.githubusercontent.com/devladlog/Fusion-Studio/main/docs/assets/...
```

Push images to the `docs/assets/` folder in the main branch.

### Option B: External Hosting

If GitHub raw isn't suitable, use:
- Imgur (for quick testing)
- Azure Blob Storage
- Cloudinary

---

## Checklist

- [ ] Banner created (1200x300)
- [ ] Dashboard screenshot captured
- [ ] Dashboard full screenshot captured
- [ ] AI generation screenshot captured
- [ ] Dataverse Designer screenshot captured
- [ ] Flow Designer screenshot captured
- [ ] Chat Panel screenshot captured
- [ ] Dependency graph screenshot captured
- [ ] All images optimized (<500KB each)
- [ ] Images uploaded to GitHub repo
- [ ] README links tested and working

---

## Notes

- Keep screenshots up-to-date when UI changes
- Use consistent window sizes across all screenshots
- Avoid showing sensitive/personal data in screenshots
- Test image URLs after pushing to GitHub
