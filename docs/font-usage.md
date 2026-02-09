# フォント運用ルール（A案）

`index.html` のタイポグラフィは、可愛さと誤読耐性の両立を目的に以下へ統一する。

## 採用フォント

- 英文見出し: `Nunito`
- 英文本文/UI: `Atkinson Hyperlegible`
- 和文見出し: `M PLUS Rounded 1c`
- 和文本文/UI: `M PLUS 1p`

## CSSトークン

`index.html` の `:root` で以下を管理する。

- フォントトークン
- `--font-heading-latin`
- `--font-body-latin`
- `--font-ui-latin`
- `--font-heading-ja`
- `--font-body-ja`
- `--font-ui-ja`
- タイポトークン
- `--tracking-heading: 0.01em`
- `--leading-heading: 1.18`
- `--tracking-body: 0.015em`
- `--leading-body: 1.55`
- `--tracking-ui: 0.04em`
- `--leading-ui: 1.20`

## 運用基準

- 推奨ウェイト: `400 / 500 / 700 / 800 / 900`
- 見出しは `700+` を基準（タイトル系は `800`）
- 本文は最小 `14px`、行間 `1.5+` を維持
- 英数字主体のUI（スコア、倍率、タイマー、数値ポップ）は `Atkinson Hyperlegible` 固定
- 数値は `font-variant-numeric: tabular-nums lining-nums` を使用

## 言語境界ルール

- 原則は `lang` 属性で境界を明示する
- 英文ラベル: `lang="en"` を付与（例: `Score`, `Life`, `Fever`, `FRUIT CATCH`）
- 英数字専用UI: `.latin` と `lang="en"` を併用（例: `#score`, `#scoreMul`, `#feverTime`）
- 和文は `html[lang="ja"]` を基準にし、必要に応じて `lang="ja"` を明示する

## 変更時チェックリスト

- `I/l/1` が混同しないか
- `O/0` が混同しないか
- `シ/ツ` が潰れて見えないか
- `ソ/ン` が潰れて見えないか
- スコア/倍率/タイマーが瞬時に読めるか
