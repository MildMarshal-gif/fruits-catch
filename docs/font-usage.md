# fruits-catch Font Usage

Updated: 2026-02-10

## Primary references
- `https://moji-waku.com/mj_work_license/`
- ZIP bundled docs (`readme` / `license`) as canonical sources

Reference only:
- `https://moji-waku.com/kenq/kenq_trademark/`

## Current font mapping

| Role | Archive | Source | Adopted file | CSS token |
| --- | --- | --- | --- | --- |
| Heading brand (`FRUIT CATCH`) | `poprumcute.zip` | `https://moji-waku.com/download/poprumcute.zip` | `poprumcute/PopRumCute.otf` | `--font-family-heading-brand` |
| Heading sub (`一時停止` / `ゲームオーバー`) | `rounded-x-mplus-20150529.zip` | `C:/Users/test-user/Desktop/素材/font/rounded-x-mplus-20150529.zip` | `rounded-x-mplus-1p-black.ttf` | `--font-family-heading-sub` |
| Body (all non-headings: HUD, buttons, descriptions, numbers, canvas float text) | `rounded-x-mplus-20150529.zip` | `C:/Users/test-user/Desktop/素材/font/rounded-x-mplus-20150529.zip` | `rounded-x-mplus-1p-medium.ttf` | `--font-family-body` / `--font-family-body-canvas` |

## Weight and line-height
- Brand: standard -> `--font-weight-heading-brand: 400`
- Sub heading: `1p-BLACK` -> `--font-weight-heading-sub: 900`
- Body: `1p-medium` -> `--font-weight-body: 500`
- Button text: bold -> `--font-weight-button: 700`
- Body line-height -> `--font-line-height-body: 1.52`

## Bundled adopted font files
- `assets/fonts/poprumcute/PopRumCute.otf`
- `assets/fonts/rounded-x-mplus/rounded-x-mplus-1p-black.ttf`
- `assets/fonts/rounded-x-mplus/rounded-x-mplus-1p-medium.ttf`

## Bundled license files

- `assets/fonts/licenses/poprumcute/readme.txt`
- `assets/fonts/licenses/rounded-x-mplus/README_J_Rounded.txt`
- `assets/fonts/licenses/rounded-x-mplus/README_E_Rounded.txt`
- `assets/fonts/licenses/rounded-x-mplus/LICENSE_J`
- `assets/fonts/licenses/rounded-x-mplus/LICENSE_E`
- `assets/fonts/licenses/rounded-x-mplus/README_J_MPLUS`
- `assets/fonts/licenses/rounded-x-mplus/README_E_MPLUS`
- `assets/fonts/licenses/rounded-l-mgenplus/README_Rounded-MgenPlus.txt`
- `assets/fonts/licenses/rounded-l-mgenplus/SIL_Open_Font_License_1.1.txt`
- `assets/fonts/licenses/rounded-l-mgenplus/mplus-TESTFLIGHT-059/LICENSE_J`
- `assets/fonts/licenses/rounded-l-mgenplus/mplus-TESTFLIGHT-059/LICENSE_E`
- `assets/fonts/licenses/rounded-l-mgenplus/mplus-TESTFLIGHT-059/README_J`
- `assets/fonts/licenses/rounded-l-mgenplus/mplus-TESTFLIGHT-059/README_E`

## Notes
- For public builds where `PopRumCute` cannot be used, set `:root[data-release-channel="public-fallback"]`.
- Body and canvas float text use the same family as heading sub (`rounded-x-mplus`) with `1p-medium` weight.
- Heading boundary remains unchanged: only `FRUIT CATCH`, `一時停止`, and `ゲームオーバー` are heading typography targets.
