# Fruit Size Redesign Plan (Basket基準・最小差分)

実行ステータス: 実行済み

結論: フルーツ半径の算出元だけをバスケット可視本体幅基準へ切り替える。端末差は最終係数（mobile +5%, tablet +2%, desktop 0%）のみで吸収する。
結論: `index.html`中心の最小差分で、既存の`getFruitRadiusForMul`と`spawnObject`の流れは維持する。

## 1. 原因仮説の再確認
- 現状のフルーツ半径は `BASE_FRUIT_RADIUS_MIN/MAX * preset.fruitScale` で決まり、バスケット基準になっていない。
- `basketScale` が端末で大きく異なるため、フルーツ対バスケット比率が端末間でばらけやすい。
- `fx_fruit_pop` は `baseScale` と `lighter` 合成の組み合わせで白飛びしやすい。

## 2. 実装ステップ（Step 1..n）
- Step 1: 仕様式をコード上に明示する。
- `BasketBodyWidth = getBasketBodyRect().w`
- `FruitBaseDiameter = BasketBodyWidth * 0.75`
- `FruitDiameterMin = FruitBaseDiameter * 0.90`
- `FruitDiameterMax = FruitBaseDiameter * 1.10`
- Step 2: `applyResponsiveProfile` の半径更新だけ差し替える。
- 変更前: `fruitRadiusMin = BASE_FRUIT_RADIUS_MIN * preset.fruitScale`
- 変更前: `fruitRadiusMax = BASE_FRUIT_RADIUS_MAX * preset.fruitScale`
- 変更後: 上記 `FruitDiameterMin/Max` を算出し、最終係数（端末補正）を掛けて半径化する。
- Step 3: 種類ごと固定サイズロジックは既存維持。
- `getFruitRadiusForMul` はそのまま使い、`FRUITS` の `mul` で単調減少を担保する。
- Step 4: `spawnObject` は既存フロー維持で副作用確認のみ実施する。
- 星/バグの `r` が極端化しないかだけ確認し、必要時のみ係数を微調整する。
- Step 5: 取得演出は `fx_fruit_pop` を主対象に調整する。
- サイズを対応フルーツの約+10%に合わせる。
- 白飛び抑制のため、加算寄り表現を弱める。
- 彩度・色コントラストを上げる。
- Step 6: PC/スマホで定量検証し、受け入れ基準を満たしたら完了。

## 3. 変更対象一覧（関数/定数ごと）
- `DEVICE_PRESETS`（`fruitScale` の意味を最終係数へ寄せる）
- `applyResponsiveProfile`（`fruitRadiusMin/Max` 算出式）
- `getFruitRadiusForMul`（ロジック維持、単調性確認）
- `spawnObject`（半径利用の副作用確認）
- `drawObjectSpriteOrFallback`（基本変更なし、見た目確認のみ）
- `spriteMeta`（必要時のみ `fx_fruit_pop` の `drawScale` 微調整）
- `spawnImpactFx`（`fx_fruit_pop` の演出サイズ係数）
- `drawImpactFx`（合成・色味の調整）

## 4. パラメータ変更案（変更前/変更後を明記）

### 4-1. 端末補正係数（最終係数）
- `DEVICE_PRESETS.mobile.fruitScale`: `0.90` -> `1.05`
- `DEVICE_PRESETS.tablet.fruitScale`: `0.95` -> `1.02`
- `DEVICE_PRESETS.desktop.fruitScale`: `1.00` -> `1.00`（維持）

数値根拠:
- 要件で指定された補正値（mobile +5%, tablet +2%, desktop ±0%）をそのまま採用。
- 端末差を小幅に限定し、共通ロジック維持を優先。

### 4-2. フルーツ半径算出
- 変更前:
- `fruitRadiusMin = BASE_FRUIT_RADIUS_MIN * preset.fruitScale`
- `fruitRadiusMax = BASE_FRUIT_RADIUS_MAX * preset.fruitScale`
- 変更後:
- `basketBodyWidth = getBasketBodyRect().w`（取得不可時は `basket.w` フォールバック）
- `fruitBaseDiameter = basketBodyWidth * 0.75`
- `fruitDiameterMin = fruitBaseDiameter * 0.90`
- `fruitDiameterMax = fruitBaseDiameter * 1.10`
- `fruitRadiusMin = (fruitDiameterMin * preset.fruitScale) / 2`
- `fruitRadiusMax = (fruitDiameterMax * preset.fruitScale) / 2`

数値根拠:
- バスケット可視本体幅に対して 75% を基準とすると、キャッチ難易度を急変させず視認性を上げやすい。
- ±10% は種類差の帯域として十分広く、既存 `mul` 補間と整合しやすい。

### 4-3. 取得演出（`fx_fruit_pop`）
- `spawnImpactFx` の `fx_fruit_pop` 用 `baseScale`:
- 変更前: `1.70`
- 変更後候補: `1.10`（まず要件準拠の第一候補）
- `drawImpactFx` の合成:
- 変更前: 全fx一律 `globalCompositeOperation = 'lighter'`
- 変更後案: `fx_fruit_pop` のみ加算を弱める（`screen` または `source-over`）、他fxは現状維持
- `drawImpactFx` の色調:
- 変更前: 色調補正なし
- 変更後案: `fx_fruit_pop` 描画時のみ `ctx.filter` で `saturate(1.2) contrast(1.12) brightness(0.94)` を適用

数値根拠:
- +10% は「主役フルーツを邪魔しない演出拡張」として視認バランスがよい。
- 明度を少し落として白飛びを抑え、彩度/コントラストで色差を戻す。

## 5. PC/スマホ検証チェックリスト
- [ ] 種類固定: 同一 `fruitKind` の直径が連続30spawnで ±1px 以内
- [ ] 単調減少: `points` が高いほど直径が小さい（同点は同等以下）
- [ ] 基準比率: desktop で `FruitDiameter / BasketBodyWidth` が `0.675〜0.825` に収まる
- [ ] 端末補正: tablet は desktop 比 `+2% ±1%`、mobile は desktop 比 `+5% ±1%`
- [ ] 取得演出サイズ: `fx_fruit_pop` 見かけ直径 / 対応フルーツ直径が `1.10 ±0.03`
- [ ] 色味: `fx_fruit_pop` で白飛び低減、フルーツ色の識別が目視で改善
- [ ] 副作用: `fx_star_burst` / `fx_bug_hit` の視認性・迫力・負荷が悪化しない

受け入れ基準（定量）:
- サイズ比率誤差は各端末で ±1% 以内。
- 直径の種類固定誤差は ±1px 以内。
- 演出サイズ比は 1.10 目標に対して ±0.03 以内。

## 6. リスクと回避策
- リスク: フルーツが大きくなり難易度が下がる
- 回避策: 本タスクではサイズのみ変更。必要時は別タスクで `spawnInterval` / `baseFallSpeed` を微調整。
- リスク: アセット未ロード時の `getBasketBodyRect()` 依存
- 回避策: `basket.w` フォールバックを入れて初期フレームの破綻を防ぐ。
- リスク: `fx_fruit_pop` の加算弱化で地味になる
- 回避策: alpha と filter を `fx_fruit_pop` 限定で微調整し、他fxは触らない。
- リスク: 端末補正と ±10% の解釈差
- 回避策: 「±10%は基準帯、端末補正は最終乗算」をコメントで明記。

## 7. ロールバック方針
- ロールバック対象を3点に限定する。
- `applyResponsiveProfile` の半径算出式
- `spawnImpactFx` の `fx_fruit_pop` サイズ係数
- `drawImpactFx` の合成/色調補正
- 失敗時は以下へ即時復帰する。
- `fruitRadiusMin/Max = BASE_FRUIT_RADIUS_* * preset.fruitScale`
- `fx_fruit_pop` の `baseScale = 1.70`
- 合成を一律 `lighter` に戻す
- 変更は1コミットに集約し、差分追跡を容易にする。

## 8. 未確定事項（あれば）
- `points=10` の `orange` と `peach` を同サイズ扱いにするか（現状は `mul` が異なる）。
- ±10% の評価を「端末補正前」で固定判定するか、「端末補正後」まで含めるか。
- `fx_fruit_pop` の色味判定を目視のみで完了にするか、簡易キャプチャ比較まで実施するか。
