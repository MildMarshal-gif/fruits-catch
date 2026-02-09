# フォント改善 実装プラン v1

## 結論
- 第一推奨案は **A案**。
- 目的は「可愛くキャッチー」かつ「誤読しにくい」タイポグラフィを、`index.html` 全体へ一貫適用すること。

## 対象
- プロジェクト: `fruits-catch`
- 主対象ファイル: `index.html`, `docs/font-usage.md`

## 前提・仮定
- 英字表示は `Score` `Life` `Fever` など短いUIラベルが中心。
- 英文/和文フォントの使い分けは `lang` 属性または `.latin` クラスで明示的に行う。
- 今回はスケジュール・工数・マイルストーンは扱わない。

## 評価基準
- 可読性: 小サイズUIで文字が潰れないか。
- 誤読防止: `I/l/1`, `O/0`, `シ/ツ`, `ソ/ン` の判別性。
- トーン適合: 可愛い/元気/やわらかい印象との整合。
- 実装容易性: 既存 `index.html` のフォント指定へ段階的に導入できるか。

## 提案A（第一推奨）
### フォント構成
- 英文フォント（見出し）: `Nunito`
- 英文フォント（本文）: `Atkinson Hyperlegible`
- 和文フォント（見出し）: `M PLUS Rounded 1c`
- 和文フォント（本文）: `M PLUS 1p`
- UIラベル（必要時）:
  - 英文: `Atkinson Hyperlegible`
  - 和文: `M PLUS 1p`

### 推奨ウェイト
- `400 / 500 / 700 / 800 / 900`

### タイポ推奨値
- 見出し: `letter-spacing: 0.01em; line-height: 1.18;`
- 本文: `letter-spacing: 0.015em; line-height: 1.55;`
- UIラベル: `letter-spacing: 0.04em; line-height: 1.20;`

### UIトーン
- 可愛い・元気・整理感

### 誤読リスクと回避策
- リスク: `I/l/1`、`O/0` の混同。
- 回避策: 英数字主体の要素（スコア・倍率・タイマー）は `Atkinson Hyperlegible` 固定。
- リスク: `シ/ツ` `ソ/ン` の判別低下（低コントラスト/小サイズ）。
- 回避策: 本文最小 `14px`、本文行間 `1.5+`、見出しは `700+` を基準にする。

### 商用利用可否の根拠
- 可（`SIL Open Font License 1.1`）。
- 公式配布元:
  - Google Fonts（`Nunito`, `Atkinson Hyperlegible`）
  - M+ Fonts 公式配布（`M PLUS Rounded 1c`, `M PLUS 1p`）

## 提案B
### フォント構成
- 英文フォント（見出し）: `Comfortaa`
- 英文フォント（本文）: `Nunito`
- 和文フォント（見出し）: `Zen Maru Gothic`
- 和文フォント（本文）: `M PLUS 1p`
- UIラベル（必要時）:
  - 英文: `Nunito`
  - 和文: `M PLUS 1p`

### 推奨ウェイト
- `400 / 500 / 600 / 700`

### タイポ推奨値
- 見出し: `letter-spacing: 0.015em; line-height: 1.20;`
- 本文: `letter-spacing: 0.01em; line-height: 1.58;`
- UIラベル: `letter-spacing: 0.03em; line-height: 1.22;`

### UIトーン
- やわらかい・親しみ・ポップ

### 誤読リスクと回避策
- リスク: `Comfortaa` は小サイズで判別性が落ちる可能性。
- 回避策: 見出し専用（`28px+`）に限定し、数値/UIは `Nunito 700+` を使う。

### 商用利用可否の根拠
- 可（`SIL Open Font License 1.1`）。
- 公式配布元:
  - Google Fonts（`Comfortaa`, `Nunito`, `Zen Maru Gothic`）
  - M+ Fonts 公式配布（`M PLUS 1p`）

## 提案C
### フォント構成
- 英文フォント（見出し）: `Atkinson Hyperlegible`
- 英文フォント（本文）: `Atkinson Hyperlegible`
- 和文フォント（見出し）: `M PLUS Rounded 1c`
- 和文フォント（本文）: `Zen Maru Gothic`
- UIラベル（必要時）:
  - 英文: `Atkinson Hyperlegible`
  - 和文: `M PLUS Rounded 1c`

### 推奨ウェイト
- `400 / 500 / 700 / 800`

### タイポ推奨値
- 見出し: `letter-spacing: 0.008em; line-height: 1.16;`
- 本文: `letter-spacing: 0.012em; line-height: 1.60;`
- UIラベル: `letter-spacing: 0.035em; line-height: 1.20;`

### UIトーン
- すっきり・安心・少し可愛い

### 誤読リスクと回避策
- リスク: キャッチーさが弱くなる。
- 回避策: 見出しは `M PLUS Rounded 1c 800` と高彩度配色で印象補強。

### 商用利用可否の根拠
- 可（`SIL Open Font License 1.1`）。
- 公式配布元:
  - Google Fonts（`Atkinson Hyperlegible`, `Zen Maru Gothic`）
  - M+ Fonts 公式配布（`M PLUS Rounded 1c`）

## 採用方針（第一推奨案）
- 採用候補: **A案**
- 採用理由:
  - 見出しの可愛さと勢いを保ちながら、本文/UIの誤読耐性を高く維持できる。
  - 現行の `index.html` の指定構造（見出し系と本文系の分離）へ無理なく移行できる。

## 実装ステップ（コード変更は次フェーズ）
1. `index.html` でフォントトークン（見出し/本文/UI）を定義。
2. 英文と和文の適用境界を `lang` 属性または `.latin` クラスで明示。
3. 見出し・本文・UIラベルへ推奨 `letter-spacing` / `line-height` を適用。
4. `docs/font-usage.md` を新構成に合わせて更新。
5. 読みやすさ検証（`I/l/1`, `O/0`, `シ/ツ`, `ソ/ン`, 数字）を実施し、必要ならウェイトと字間を微調整。
