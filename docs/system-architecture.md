# あやめのシステム構成図

```mermaid
flowchart LR
    user[受験者・管理者のブラウザ]
    github[GitHub<br/>sho-nagisa/ayame]
    sites[公開サイト基盤<br/>Cloudflare Pages / Worker]
    app[あやめアプリ<br/>画面・API]
    db[(Cloudflare D1<br/>アカウント・成績・正解候補)]
    questions[問題データ<br/>lib/questions.ts<br/>音読み・訓読み]
    tests[自動テスト<br/>tests/]

    user -->|HTTPS| sites
    sites --> app
    app -->|ログイン・採点・成績| db
    app -->|問題を読み込む| questions
    github -->|ソースをPushして公開| sites
    github --> tests
    tests -.->|ビルド・動作確認| app

    classDef external fill:#fff7ed,stroke:#f97316,stroke-width:1.5px;
    classDef runtime fill:#eff6ff,stroke:#2563eb,stroke-width:1.5px;
    classDef data fill:#ecfdf3,stroke:#16a34a,stroke-width:1.5px;
    class user,github external;
    class sites,app runtime;
    class db,questions,tests data;
```

## この図が示す範囲

- `ユーザー → 公開サイト`：ブラウザからHTTPSで利用
- `公開サイト → アプリ`：画面とAPIを実行
- `アプリ → D1`：アカウント、受験結果、回答、正解候補を保存・取得
- `GitHub → 公開サイト`：ソースをPushした状態を公開用ビルドとして反映
- `tests`：問題数・出題モード・採点・認証・画面構成を確認
