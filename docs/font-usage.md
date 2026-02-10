# fruits-catch Font Usage

更新日: 2026-02-10

## 一次参照元（固定）
- `https://moji-waku.com/mj_work_license/`
- 各 ZIP 同梱文書（`readme` / `license`。こちらを正本として優先）

参考リンク（補助扱い）:
- `https://moji-waku.com/kenq/kenq_trademark/`

## ZIP 実体確認結果

| 役割 | ZIP | 取得元 | ZIP 内実ファイル | CSS 適用 |
| --- | --- | --- | --- | --- |
| 見出し brand (`FRUIT CATCH`) | `poprumcute.zip` | `https://moji-waku.com/download/poprumcute.zip` | `poprumcute/PopRumCute.otf` | `--font-family-heading-brand` |
| 見出し sub (`一時停止` / `ゲームオーバー`) | `rounded-x-mplus-20150529.zip` | `https://ftp.iij.ad.jp/pub/osdn.jp/users/8/8573/rounded-x-mplus-20150529.zip` | `rounded-x-mplus-1p-black.ttf` | `--font-family-heading-sub` |
| 本文（HUD/ボタン/説明/数値/Canvas 浮遊テキスト） | `mgenplus-1p-20150602.zip` | `https://ftp.iij.ad.jp/pub/osdn.jp/users/8/8594/mgenplus-1p-20150602.zip` | `mgenplus-1pp-medium.ttf` | `--font-family-body` / `--font-family-body-canvas` |

## ウェイト対応
- brand: `PopRumCute.otf`（標準） -> `--font-weight-heading-brand: 400`
- sub: `rounded-x-mplus-1p-black.ttf`（`1p-BLACK`） -> `--font-weight-heading-sub: 900`
- body: `mgenplus-1pp-medium.ttf`（`1pp-medium`） -> `--font-weight-body: 500`
- body line-height: `--font-line-height-body: 1.52`

## ライセンス正本の同梱先

`assets/fonts/licenses/` 配下に ZIP 同梱文書を配置済み。

- `assets/fonts/licenses/poprumcute/readme.txt`
- `assets/fonts/licenses/rounded-x-mplus/README_J_Rounded.txt`
- `assets/fonts/licenses/rounded-x-mplus/README_E_Rounded.txt`
- `assets/fonts/licenses/rounded-x-mplus/LICENSE_J`
- `assets/fonts/licenses/rounded-x-mplus/LICENSE_E`
- `assets/fonts/licenses/rounded-x-mplus/README_J_MPLUS`
- `assets/fonts/licenses/rounded-x-mplus/README_E_MPLUS`
- `assets/fonts/licenses/mgenplus-1p/README_MgenPlus.txt`
- `assets/fonts/licenses/mgenplus-1p/SIL_Open_Font_License_1.1.txt`
- `assets/fonts/licenses/mgenplus-1p/LICENSE_J`
- `assets/fonts/licenses/mgenplus-1p/LICENSE_E`
- `assets/fonts/licenses/mgenplus-1p/README_J_MPLUS`
- `assets/fonts/licenses/mgenplus-1p/README_E_MPLUS`

## 配布条件メモ（実装時判断）
- `poprumcute` の同梱 `readme.txt` は「商用可」「無断での改変/二次配布は禁止」を明記。
- `mj_work_license` ページは Web フォント利用（サーバー設置/サブセット化）を許容しつつ、無断二次配布・改変配布を禁止。
- そのため公開方法によっては `poprumcute` 利用可否の再確認が必要。

公開版で `poprumcute` 条件を満たせない場合:
- `:root[data-release-channel="public-fallback"]` を有効化する。
- これにより brand 見出しは `rounded-x-mplus-1p-black` に自動フォールバックする（`styles/font-system.css`）。

## 実装側の一元管理ポイント
- フォント定義とトークン: `styles/font-system.css`
- 利用側（トークン参照のみ）: `styles/main.css`
- 見出し切替: `scripts/ui.js` (`.title[data-title-role="brand|sub"]`)
- Canvas 浮遊テキスト: `scripts/game.js`（`--font-family-body-canvas` / `--font-weight-body` を参照）
