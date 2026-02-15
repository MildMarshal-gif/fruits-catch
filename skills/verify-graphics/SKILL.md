---
name: verify-graphics
description: Visually verify game graphics using Chrome integration. Opens browser, captures screenshot, and provides feedback on visual quality.
argument-hint: [url]
---

# Visual Graphics Verification

Use Chrome integration to visually verify game graphics after modifications.

## Trigger Phrases

- `グラフィック確認して`
- `見た目チェック`
- `ビジュアル確認`
- `画面見せて`
- `表示確認`

## Workflow

1. Ensure local server is running (use `/local-server-control start` if needed)
2. Open browser at `http://localhost:8080/` (or specified URL argument)
3. Capture screenshot using Chrome integration
4. Analyze visual output and provide detailed feedback:
   - Rendering quality and correctness
   - Visual alignment and positioning
   - Color accuracy and contrast
   - Animation smoothness (if applicable)
   - Any visual bugs or artifacts
5. Suggest specific improvements if issues found

## Usage Examples

```
/verify-graphics
```

Verifies default game URL (`http://localhost:8080/`)

```
/verify-graphics http://localhost:8080/index.html?debug=true
```

Verifies specific URL with parameters

## Safety Rules

- Always confirm server is running before opening browser
- Default to `http://localhost:8080/` unless URL specified
- If Chrome integration not enabled, guide user to enable it with `/chrome` command
- Wait for page load before capturing screenshot (allow time for animations/rendering)

## Prerequisites

- Chrome integration must be enabled (use `/chrome` to enable)
- Local server must be running on port 8080 (or specified port)
