# Suno Automation Risk Reference

## 目的
Suno運用で自動化可否を検討するとき、公式情報と非公式実装のリスクを分離して判断する。

## 事実（一次情報）
- Suno Termsには、robots/scraping/data mining等の行為に関する制約が含まれる。  
  URL: https://suno.com/terms
- この参照セット内では、Suno公式Helpで公開APIの詳細仕様を示すページは確認できない。  
  URL: https://help.suno.com/en/articles/2462273
- `imyizhang/Suno-API` はGitHub上の非公式実装として公開されている。  
  URL: https://github.com/imyizhang/Suno-API
- `Malith-Rukshan/Suno-API` もGitHub上の非公式実装として公開されている。  
  URL: https://github.com/Malith-Rukshan/Suno-API

## 推論（リスク評価）
- 公式API要件が不明な状況で非公式実装へ依存すると、規約・安定性・保守性のリスクが高い。  
  根拠URL: https://suno.com/terms
- 自動化要望には、まず手動UI運用の再現性向上（テンプレ化・A/B手順固定）を優先する方が安全。  
  根拠URL: https://help.suno.com/en/articles/2415873

## 回答ルール（automation-feasibility）
1. 公式情報で確認できる事実だけを先に提示する。  
2. 非公式ライブラリに触れる場合は、必ず `非公式` と明記する。  
3. 規約適合性を断定せず、要確認事項を列挙する。  
4. 公式代替として、手動UIベースの運用案を同時に提示する。

## 推奨代替（手動UI）
- Customで `Lyrics` と `Style Prompt` をテンプレ化して保存する。  
  根拠URL: https://help.suno.com/en/articles/2415873
- 比較時は変更軸を1-2個に固定し、結果評価軸を記録する。  
  根拠URL: https://help.suno.com/en/articles/6141569
- Upload/Coverを使う場合は、保持要素と変更要素を毎回明文化する。  
  根拠URL: https://help.suno.com/en/articles/5782977

## 不明点（断定しない）
- 公式に提供される安定APIの有無、認証方式、利用条件の詳細は不明。  
  参照URL: https://suno.com/terms
