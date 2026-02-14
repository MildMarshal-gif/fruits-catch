# Suno Core Reference

## 目的
Suno向け提案で使う公式UI要素と運用前提を、一次情報ベースで参照する。

## 事実（一次情報）
- Sunoでは `Simple` モードで短い説明文から楽曲生成できる。  
  URL: https://help.suno.com/en/articles/2462273
- Sunoの `Custom` モードでは、`Lyrics` と `Style Prompt` を分けて指定して生成できる。  
  URL: https://help.suno.com/en/articles/2415873
- Style Promptの考え方と書き方はHelp Centerで案内されている。  
  URL: https://help.suno.com/en/articles/3726721
- `Upload Audio` を使って入力音声をもとに生成する導線が用意されている。  
  URL: https://help.suno.com/en/articles/5782849
- `Cover`（Remix/Edit）系の導線があり、既存曲の方向転換に使える。  
  URL: https://help.suno.com/en/articles/5782977
- Creative Sliders（例: Weirdness / Style Influence / Audio Influence）の挙動説明がある。  
  URL: https://help.suno.com/en/articles/6141569
- SunoのTermsには、robots/scraping/data mining等に関する制約が含まれる。  
  URL: https://suno.com/terms

## 推論（設計への落とし込み）
- 初回は `Simple` で方向性確認し、確定後に `Custom` でLyricsとStyleを分離する方が試行効率が高い。  
  根拠URL: https://help.suno.com/en/articles/2462273
- 音質や狙いのズレは、プロンプト文面とSlidersを同時に大幅変更せず、1-2軸だけ変える方が比較しやすい。  
  根拠URL: https://help.suno.com/en/articles/6141569
- Upload/Cover運用では「残したい要素」と「変えたい要素」を明文化すると結果の一貫性が上がりやすい。  
  根拠URL: https://help.suno.com/en/articles/5782849

## 実務で使う制御軸
- Mode軸: `Simple` / `Custom`  
  根拠URL: https://help.suno.com/en/articles/2462273
- 内容軸: `Lyrics` / `Style Prompt` / `Instrumental`  
  根拠URL: https://help.suno.com/en/articles/2415873
- 変化量軸: `Weirdness` / `Style Influence` / `Audio Influence`  
  根拠URL: https://help.suno.com/en/articles/6141569
- 変換軸: `Upload Audio` / `Cover (Remix/Edit)`  
  根拠URL: https://help.suno.com/en/articles/5782977

## 不明点（断定しない）
- 公開された公式APIの詳細仕様・安定提供状況は、この参照セットだけでは確定できない。  
  参照URL: https://suno.com/terms
