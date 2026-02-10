# 現在使われているフォント一覧

このドキュメントは、`index.html` で現在指定されているフォントと使用箇所の対応表。

## フォントと使用箇所

| フォント名 | 種別 | 指定箇所 | 主な用途 | 文字列例 |
| --- | --- | --- | --- | --- |
| `Dela Gothic One` | Webフォント | `index.html:499`, `index.html:563` | 見出し（`.pause-title`, `.title`） | `一時停止`, `FRUIT CATCH`, `ゲームオーバー` |
| `M PLUS Rounded 1c` | Webフォント | `index.html:53`, `index.html:3100` | 本文・ボタン・HUD全般、canvasの浮遊テキスト | `スタート！`, `サウンド: オン`, `続けるか、最初からやり直すか選んでね`, `フィーバー！`, `ダメージ!` |
| `Hiragino Maru Gothic ProN` | フォールバック | `index.html:53` | `M PLUS Rounded 1c` 非対応時の代替表示 | `一時停止`, `右上の「一時停止」でいつでも止められる` |
| `Yu Gothic UI` | フォールバック | `index.html:53` | 同上（代替表示） | `リスタート`, `再開` |
| `Meiryo` | フォールバック | `index.html:53` | 同上（代替表示） | `スマホでサッと遊べるフルーツキャッチ！` |
| `system-ui` | フォールバック | `index.html:53` | OS標準フォントへの最終フォールバック | `Score`, `Life` |
| `sans-serif` | 汎用ファミリー | `index.html:53`, `index.html:499`, `index.html:563`, `index.html:3100` | 指定フォントが利用不可の際の最終代替 | `Fever` |

## 補足

- `button` は `font-family: inherit`（`index.html:361`）のため、親要素（実質 `body`）のフォント設定を継承する。
- 見出しは `Dela Gothic One` を先頭に指定し、未利用時は `M PLUS Rounded 1c` -> `sans-serif` の順でフォールバックする。
