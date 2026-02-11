# HUD Alignment Plan (2026-02-10)

## 1. 現状整理（想定原因）

- 現在のHUDはDOMオーバーレイで、`Score`/`Life` は同一ラッパー配下にある（`index.html:16`-`index.html:34`）。
- 位置基準は本来 `.hud` の `inset` とCSS変数で統一されている（`styles/main.css:122`-`styles/main.css:128`）。
- ただしモバイル向け `@media (max-width: 700px)` で `.hud` の `inset` が固定pxで再定義され、変数経由の基準と二重化している（`styles/main.css:673`-`styles/main.css:679`）。
- `scripts/game.js` 側でも `--hud-inset-top/side` を毎回更新しており（`scripts/game.js:1203`-`scripts/game.js:1219`）、CSS固定値と競合しやすい。
- 想定されるズレ原因は「基準位置の二重管理」と「ブレークポイントごとの固定値直置き」。

### 仮定

- ユーザーが言う「SCORE/LIFEの位置ズレ」は、HUDカード全体の表示位置ズレを指すと仮定する。
- ゲーム進行中の数値アニメーション（`#score` transform）はレイアウト計算へ直接影響しないため、主因は座標基準側と仮定する。

## 2. 改修方針（おすすめ/代案）

### おすすめ（DOM HUDを維持する最小変更）

- `.hud` だけを位置基準にし、`top/left` はCSS変数経由へ一本化する。
- `@media (max-width: 700px)` の `.hud inset` 固定pxを廃止し、`--hud-inset-top` / `--hud-inset-side` を使う。
- `Score`/`Life` は既存 `hud-main` 内の2カラム維持。子要素間は `grid/flex + gap` だけで制御し、個別 `top/left` を禁止する。
- 必要に応じて `--hud-inset-top` を `clamp(8px, 2.2vh, 14px)` にし、`safe-area` は親 `.hud` 側で加算を継続する。
- 既存DOM構造を崩さず、`hud-side`（pause/fever）への影響を避ける。

### 代案（Canvas描画中心へ寄せる場合）

- DOM HUDを減らし、Canvas上に `HUD_ORIGIN_X/Y` を導入して `Score/Life` を同一原点から描画する。
- `HUD_ORIGIN_X = canvas.width * ratioX`、`HUD_ORIGIN_Y = canvas.height * ratioY` とし、`scoreOffsetX/lifeOffsetX` は相対値管理。
- 端末差は `ratio + clamp` で吸収する。
- この代案は描画/UI責務の変更範囲が大きいため、今回は非推奨。

## 3. 変更対象ファイル候補

- `styles/main.css`
- `scripts/game.js`
- `index.html`（原則変更不要。必要時のみ `hud-main` ラッパーのクラス追加レベル）
- `scripts/ui.js`（原則変更不要。位置制御を触る場合のみ確認）

## 4. 実装ステップ（小さな単位）

1. 現状固定値の棚卸し
- `.hud` の位置関連定義を抽出し、変数経由と固定pxの重複箇所を一覧化。

2. 親基準の一本化
- `.hud` の `inset` を全ブレークポイントで変数参照に統一。
- `safe-area-inset-top` の加算は `.hud` のみで行う。

3. 子要素配置の相対化確認
- `Score`/`Life` のカード内で個別座標指定がないことを確認。
- `hud-main` の `grid` と `gap` を調整して視覚位置を揃える。

4. モバイル値の可変化
- `--hud-inset-top` / `--hud-inset-side` の値を `clamp` か段階値で見直し。
- `scripts/game.js` 側の `hudTop/hudSide` をCSS戦略に合わせて簡素化。

5. 回帰確認
- Pauseボタン、Feverバッジ、オーバーレイ表示時の重なりを確認。
- プレイ中アニメーション時に `Score/Life` の基準位置が固定されることを確認。

## 5. レスポンシブ検証項目（スマホ/PC）

- スマホ縦（360x800, 390x844, 430x932）
- スマホ横（800x360 付近）
- タブレット（768x1024）
- PC（1280x720, 1920x1080）
- 検証観点:
- `Score` と `Life` が同一基準線上に並ぶ
- ゲーム開始前/プレイ中/一時停止/フィーバーでHUD位置が跳ねない
- `env(safe-area-inset-top)` のある端末で切れない
- `wrap` が `100dvh` になる条件でも上端余白が破綻しない

## 6. リスクと回避策

- リスク: モバイルでHUDが上に寄りすぎてノッチと干渉
- 回避: `calc(var(--hud-inset-top) + env(safe-area-inset-top))` を維持

- リスク: `hud-side` の改行条件が変わり、ボタン位置が崩れる
- 回避: `hud-main` と `hud-side` の責務を分離し、`grid-template-columns` は既存維持

- リスク: JSで更新する`--hud-inset-*`とCSSメディア定義の意図不一致
- 回避: 変数の最終決定点を1箇所（JSかCSSのどちらか）に寄せる

## 7. 受け入れ条件（Doneの定義）

- `Score`/`Life` の位置基準が `.hud` 親コンテナのみで決まる。
- `styles/main.css` に `Score`/`Life` 個別の固定 `top/left` が存在しない。
- モバイル/PC両方で、プレイ状態変化時にHUDの基準位置が変動しない。
- `@media (max-width: 700px)` でも `.hud` の位置は変数基準で一貫する。
- 既存機能（Pause, Fever badge, Overlay, ライフ演出）に視覚回帰がない。

## 8. 実装依頼用プロンプト（そのまま実装AIに渡せる文面）

```text
あなたはこのリポジトリの実装担当。以下の制約でHUD位置ズレ修正を実装してください。

目的:
- ゲーム中の「SCORE」「LIFE」位置ズレを解消する
- 固定px直置きをやめ、HUD親コンテナ基準で位置を統一する
- スマホ/PCの両方で崩れにくくする

必須方針:
- Score/Lifeは同じHUDラッパー配下のまま扱う
- 親要素（.hud）だけが基準位置を持つ
- 子要素は grid/flex と gap の相対配置のみで揃える
- 必要に応じて clamp(), vw/vh, env(safe-area-inset-top) を使う

実装条件:
- 既存構成を壊さない最小変更
- 不要なリファクタ禁止
- 変更理由をコメントかPR本文で明示

主な作業:
1) styles/main.css の .hud 位置定義を全ブレークポイントで変数ベースに統一
2) @media (max-width: 700px) の .hud 固定 inset(px) を撤去し、--hud-inset-top/side に集約
3) scripts/game.js の --hud-inset-* 設定値を見直し、CSS側と競合しない単一ルールに整理
4) Score/Lifeカード内に個別座標指定がないことを確認し、必要なら gap/align-items のみで整列
5) スマホ縦横・PCでプレイ中/ポーズ中/フィーバー中の位置安定を確認

完了条件:
- SCORE/LIFEの基準位置が親HUDのみで決まる
- モバイルとPCで視覚的なズレ再現がなくなる
- Pause/Fever/Overlayに回帰がない

最後に、変更ファイル一覧と検証結果を簡潔に報告してください。
```

