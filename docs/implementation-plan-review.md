# 実装プランレビュー: `docs/implementation-plan.md`

- レビュー対象: `docs/implementation-plan.md`
- 要件参照元: `これはメモ.md`
- レビュー日: 2026-02-07

## 結論

要件網羅はできているが、着手前に修正必須のズレが4点ある。

## 指摘事項（重大度順）

1. **[重大] 変更対象マップの関数名が現行コードと不一致**
   - 該当: `docs/implementation-plan.md:25`, `docs/implementation-plan.md:26`, `docs/implementation-plan.md:27`, `docs/implementation-plan.md:30`
   - 実コード: `index.html:1210` (`triggerLifeDamageEffect`), `index.html:1677` (`updateHearts`), `index.html:1837` (`intersectsObjBasket`), `index.html:1225` (`updateScorePulseStyles`)
   - 影響: 編集箇所探索の迷走、着手ロス

2. **[中] 工数表記の整合不備**
   - 該当: `docs/implementation-plan.md:20`
   - 内容: 「約40時間 + バッファ20%」とあるが、Phase合計がすでに40時間
   - 影響: スケジュール期待値の齟齬
   - 対応: 総工数を48hに統一するか、40hにバッファ込みで再計算するか明記

3. **[中] QA 1日計上に対してQAタスク定義が不足**
   - 該当: `docs/implementation-plan.md:40`, `docs/implementation-plan.md:89`
   - 内容: QA完了は定義済みだが、QA専用の作業表・観点・完了判定の粒度が不足
   - 影響: DoD「プレイ不能バグ0件」の検証が曖昧化

4. **[中] REQ-01の「デザイン性維持」が受け入れ条件に未反映**
   - 要件原文: `これはメモ.md:2`
   - 該当: `docs/implementation-plan.md:55`, `docs/implementation-plan.md:95`
   - 内容: 可読性評価はあるが、デザイン性維持の判定軸がない
   - 影響: 実装後レビューで主観衝突が発生しやすい

## 修正提案（実装前）

1. 変更対象マップの関数名を実在名へ差し替える
2. 工数は「実装」「検証」「バッファ」を分離して合計を再定義する
3. QA専用セクション（シナリオ、再現手順、合否条件）を追加する
4. REQ-01に「可読性 + デザイン維持」の定量/定性判定を追記する
