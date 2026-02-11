# 58f0c34 不具合修正プラン（実装前）

## 目的
- `58f0c34137dc4f59cc72b10af5ab653d7381dfa8` 起点の見た目崩れを、`index.html` のサイズ計算と当たり判定の整合で解消する。
- PC/スマホ両方で「フルーツ/虫が大きすぎる」「バスケットが小さすぎる」「バスケット見た目と判定不一致」を同時に直す。

## 原因仮説（優先度順）
1. 優先度A: `spriteMeta` の `collisionRadiusPx` が 1024px スプライトに対して小さすぎる。  
   `drawObjectSpriteOrFallback` の計算で描画倍率が過大になり、フルーツと虫が大きく描かれている可能性が高い。
2. 優先度A: `drawBasketSpriteOrFallback` が `min(scaleX, scaleY)` で 1024x1024 画像全体を `basket.w/h` にフィットさせるため、可視バスケット本体が小さく見える。
3. 優先度A: `intersectsObjBasket` は `basket.w/h` ベースで判定しているため、描画だけ小さい現状では「見た目より判定が大きい」ズレが発生する。
4. 優先度B: `DEVICE_PRESETS` の `fruitScale`/`basketScale` は旧描画向け値のため、スプライト補正後に微調整が必要になる可能性がある。

## 実装プラン（Step 1..n）
1. 現状基準を固定する。  
   PC/スマホで、オブジェクト見た目直径と `o.r`、バスケット見た目幅高と `basket.w/h` の乖離を確認し、比較基準を残す。
2. `spriteMeta` を最小変更で補正する。  
   `fruit_*`, `hazard_bug`, `bonus_star` の `collisionRadiusPx` を 1024素材前提の基準値（第一候補: 512）へ調整する。まず `drawScale` は 1.00 維持。
3. `drawObjectSpriteOrFallback` は式を維持する。  
   ロジック改造ではなく、`spriteMeta` パラメータ調整で適正サイズへ収束させる。
4. `drawBasketSpriteOrFallback` を本体基準でスケーリングする。  
   `spriteMeta.basket_default` に本体基準パラメータ（例: `bodyWidthPx`, `bodyHeightPx`）を追加し、画像全体ではなく本体寸法で `basket.w/h` と一致させる。
5. `intersectsObjBasket` を描画基準に合わせる。  
   現在の inset 算出を、バスケット可視本体と同じ基準で計算し、見た目と判定の一致を取る。
6. 必要時のみ `DEVICE_PRESETS` を微調整する。  
   上記で不足がある場合だけ `fruitScale`/`basketScale` を小幅調整（目安 ±0.03〜0.08）する。

### 変更予定の関数/定数と調整パラメータ
- `spriteMeta`
  - `fruit_*`, `hazard_bug`, `bonus_star`: `collisionRadiusPx`
  - `basket_default`: `drawScale`（必要時）、`bodyWidthPx`/`bodyHeightPx`（新設候補）
- `drawObjectSpriteOrFallback(o)`
  - 基本式維持。参照パラメータは `spriteMeta` 側で調整
- `drawBasketSpriteOrFallback()`
  - スケール算出基準（画像全体 -> 可視本体基準）
  - `anchorX`/`anchorY` の確認・必要時微修正
- `intersectsObjBasket(o)`
  - `hitX`, `hitY`, `hitW`, `hitH` の算出比率（描画基準と一致させる）
- 関連箇所（必要時）
  - `DEVICE_PRESETS.mobile/tablet/desktop` の `fruitScale`, `basketScale`

## 検証計画（PC/スマホ）

### PC
- [ ] フルーツ/虫の見た目直径が `o.r` 想定（おおむね `2r` 近傍）に収まる
- [ ] バスケット見た目サイズが `basket.w/h` と大きく乖離しない
- [ ] 見た目の縁接触で取得でき、見た目から外れた位置では取得しない
- [ ] 画面端で可視バスケットが不自然にはみ出さない

### スマホ
- [ ] 縦持ちでフルーツ/虫の過大表示が解消される
- [ ] バスケットが小さすぎず、タッチ時の取得感が見た目と一致する
- [ ] 端末回転後もサイズと判定の一致が維持される
- [ ] 連続プレイ時にFPS低下や入力遅延の悪化がない

## リスクと回避策
- リスク: 画像余白の影響で単純スケール変更だけだと再度ズレる。  
  回避策: `spriteMeta` に可視本体基準パラメータを持たせ、全体画像基準を避ける。
- リスク: 判定を絞りすぎると取り逃しが増える。  
  回避策: `intersectsObjBasket` の inset を段階調整し、境界テストで確認する。
- リスク: 演出系（`fx_*`）に副作用が出る。  
  回避策: 修正対象を `fruit/bug/star/basket` に限定し、`fx_*` は回帰確認のみ行う。

### ロールバック方針
- 変更範囲を `spriteMeta` と対象関数（`drawObjectSpriteOrFallback`, `drawBasketSpriteOrFallback`, `intersectsObjBasket`）中心に限定する。
- 問題発生時は該当修正コミットのみをロールバックする。
- 緊急退避が必要な場合は `FEATURE_FLAGS.USE_IMAGE_SPRITES` / `FEATURE_FLAGS.USE_IMAGE_BASKET` を一時的に `false` にしてフォールバック描画へ戻す。

## 完了条件（受け入れ基準）
- PC/スマホ両方で、フルーツ/虫の過大表示が解消されている。
- PC/スマホ両方で、バスケットの過小表示が解消されている。
- 見た目バスケットと当たり判定が実プレイで違和感なく一致している。
- 変更は `index.html` の対象箇所中心で、最小変更方針を維持している。
