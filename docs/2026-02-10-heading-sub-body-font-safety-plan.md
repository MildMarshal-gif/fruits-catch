# Heading Sub 系統へ Body 統一 安全実装プラン

作成日: 2026-02-10

## 結論
- Body（見出し以外）は `Heading sub` と同じ書体系へ寄せる。
- 採用ウェイトは `1p-medium`、ボタン文字のみ `bold` を明示する。

## 目的
- UI全体の字面を `Heading sub` 系で統一し、見た目の一貫性を上げる。
- 変更を最小差分で入れて、既存の見出し境界ルールを壊さない。

## 完了条件（DoD）
- Body トークンが `Heading sub` 系ファミリー + `1p-medium` になる。
- `button` は family を Body に追従しつつ、weight は `bold` 固定になる。
- 見出し用途は現行ルールを維持する。
- Canvas 浮遊テキストが Body と同一 family/weight を参照する。
- 参照フォントファイルとライセンス同梱が `docs/font-usage.md` に反映される。

## 前提と仮定
- 「Heading sub のファミリー書体」は `rounded-x-mplus` 系を指す。
- `Heading sub` 自体（`一時停止` / `ゲームオーバー`）は現行どおり `1p-BLACK` を維持する。
- Body だけを同系ファミリーの `1p-medium` へ変更する。

## 変更対象
- `styles/font-system.css`
- `styles/main.css`
- `scripts/game.js`（Canvas 既定フォント名のフォールバック）
- `docs/font-usage.md`
- `assets/fonts/rounded-x-mplus/*`（`1p-medium` 追加時）
- `assets/fonts/licenses/rounded-x-mplus/*`（不足文書があれば補完）

## 実装ステップ（安全順）
1. 事前確認
- `rounded-x-mplus-1p-medium.ttf` の実在確認。
- 無ければ配布アーカイブから抽出して `assets/fonts/rounded-x-mplus/` へ配置。

2. フォントトークン差し替え
- `styles/font-system.css` の `--font-family-body` / `--font-family-body-canvas` を `rounded-x-mplus` 系 `1p-medium` に向ける。
- `--font-weight-body` は `500` を維持する。

3. ボタンだけ太字化
- `styles/main.css` の `button` で `font-weight: 700`（または `bold`）を明示。
- 他の本文要素は `--font-weight-body` のまま維持する。

4. Canvas 同期
- `scripts/game.js` の Body 既定フォールバックを新 family 名へ更新。
- CSSトークン優先ロジックは維持する。

5. ドキュメント更新
- `docs/font-usage.md` の Body 行を `rounded-x-mplus` `1p-medium` に更新。
- 採用理由、ファイル名、同梱ライセンスを追記。

6. 検証
- `node --check scripts/game.js` 実行。
- 外部フォント依存が増えていないことを `rg "fonts.googleapis|fonts.gstatic"` で確認。
- UI確認（手動）:
  - スタート画面
  - プレイ中HUD
  - 一時停止
  - ゲームオーバー
  - 幅 `700px` 以下

## リスクと回避
- リスク: `rounded-x-mplus-1p-medium.ttf` が未配置で表示崩れ。
- 回避: 実装前にファイル存在チェックし、無ければ抽出を先行。

- リスク: ボタン太字化で文言折返しが増える。
- 回避: 700px以下でボタン群の改行・高さを重点確認。

- リスク: Body と Heading の境界が曖昧化。
- 回避: `title` / `pause-title` セレクタは変更しない。

## ロールバック
- 直前コミットへ戻せるよう、1コミットで閉じる。
- 追加フォント資産はそのコミットに同梱して追跡を一体化する。

## 実装依頼用プロンプト
```text
fruits-catch のフォントを再調整して。
要件:
- Body（見出し以外）は Heading sub と同じファミリー書体へ変更。
- Body のウェイトは 1p-medium。
- ボタン文字だけ bold。
- 見出し境界ルールは維持（FRUIT CATCH / 一時停止 / ゲームオーバーのみ見出し）。
- 外部フォント依存は増やさない。
- フォント定義は styles/font-system.css のトークン一元管理を維持。
- Canvas浮遊テキストも Body と同じ family/weight に同期。
- 採用ファイル名とライセンス同梱状況を docs/font-usage.md に更新。

変更対象:
- styles/font-system.css
- styles/main.css
- scripts/game.js
- docs/font-usage.md
- assets/fonts/rounded-x-mplus/*
- 必要に応じて assets/fonts/licenses/rounded-x-mplus/*

受け入れ条件:
- Body が Heading sub 系ファミリーの 1p-medium。
- button は bold。
- 見出し用途は現行どおり。
- 700px以下でも表示崩れなし。
- 外部フォント依存なし。
```
