# HUD余白調整プラン（見た目一致優先・Life基準）

## 目的
- `Score` と `Life` のカード高さを常に同一にする。
- `Score` と `Life` のラベル位置を常に同一にする。
- `Score` 数字下ラインと `Life` ハート下ラインを見た目で一致させる。
- ラベル左ライン基準で、`Score` 値と `Life` ハートを左詰めで揃える。

## 対象
- 変更対象: `styles/main.css`
- 非対象: `index.html`, `scripts/game.js`

## 実装方針
1. HUD高さは共通変数で管理し、`Score/Life` 個別高さ定義は作らない。
2. `Score` 側へ最小補正のみ適用する。
   - `.score-card .stat-value { align-self:flex-end; }`
   - `.hud-main > .score-card .stat-value { align-self:flex-end; }`
   - `#score { top:2px; }`
   - `.score-shell { padding:2px 12px 2px; }`
3. 不要変数 `--score-optical-bottom-shift` は削除する。

## 受け入れ基準
- `Score/Life` カード高さが一致。
- `Score/Life` ラベル上余白が一致。
- `Score` 数字下余白と `Life` ハート下余白が一致（見た目基準、許容差 0〜1px）。
- `Score` 値と `Life` ハートがラベル左ライン基準で左詰め一致。
- PC/スマホ/Fever で崩れない。

## 検証観点
- PC: `1280x720`, `1366x768`, `1920x1080`
- Mobile: `390x844`, `428x926`, `360x800`
- 境界: `700px` 前後, `980px` 前後
- 状態: 通常 / Fever (`is-fever + scoreMul.show`)

