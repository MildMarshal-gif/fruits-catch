# 実装プランレビュー: `docs/implementation-plan-v2.md`

- レビュー対象: `docs/implementation-plan-v2.md`
- 要件参照元: `これはメモ.md`
- 参照レビュー: `docs/implementation-plan-review.md`
- レビュー日: 2026-02-07

## 結論

v2は前回指摘の主要4点を概ね解消しており、品質は改善している。  
ただし、工数定義の整合に1点だけ修正が必要。

## 指摘事項（重大度順）

1. **[中] 工数の定義とWBS合計が不一致**
   - 該当:
     - `docs/implementation-plan-v2.md:10`（「実装40h + バッファ8h = 48h」）
     - `docs/implementation-plan-v2.md:51`（「実装32h」）
     - `docs/implementation-plan-v2.md:91` `docs/implementation-plan-v2.md:99` `docs/implementation-plan-v2.md:107` `docs/implementation-plan-v2.md:114`（実装フェーズ合計38h）
     - `docs/implementation-plan-v2.md:121`（QA/修正 8h）
   - 影響:
     - 総工数48hの内訳解釈が揺れ、進行管理時に認識ズレが発生しやすい。
   - 対応:
     - 工数表をWBS合計に合わせて一本化し、「48hがバッファ込み最終総工数」であることを明記する。

## 反映確認（前回レビュー4点）

- 関数名不一致の修正: 反映済み  
  (`docs/implementation-plan-v2.md:16`, `docs/implementation-plan-v2.md:62`, `docs/implementation-plan-v2.md:67`, `docs/implementation-plan-v2.md:70`)
- QA定義不足の解消: 反映済み  
  (`docs/implementation-plan-v2.md:121`, `docs/implementation-plan-v2.md:129`)
- REQ-01「デザイン性維持」判定: 反映済み  
  (`docs/implementation-plan-v2.md:33`)
- 参照資料固定要件: 反映済み  
  (`docs/implementation-plan-v2.md:30`, `docs/implementation-plan-v2.md:31`)

## 修正提案（確定前）

1. `docs/implementation-plan-v2.md` の工数表を、Phase実数との対応式付きで再定義する  
   （例: 実装38h + QA/修正8h = 46h、バッファ2hで48h など）。
2. 「小計」「バッファ」「最終合計」の3層を固定し、文中の工数表現を1系統に統一する。
