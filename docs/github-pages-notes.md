# GitHub Pages運用メモ

- 想定公開URL: `https://<user>.github.io/<repo>/`
- 本リファクタでは、`index.html` / `styles/main.css` / `scripts/*.js` を相対パスで統一済み。
- キャッシュ対策の方針: 将来デプロイ時に `?v=<shortSHA>` を `link/script` に付ける。
- 404対策の方針: 将来ルーティング導入時は `404.html` を配置し、`index.html` と同等のエントリを返す。
