# ポケスピ！

ポケモンの素早さ種族値を左右で比べる、スマートフォン向けのスピードクイズです。追加のビルド手順なしでGitHub Pagesに公開できます。

## ローカルでの確認

`index.html`を直接開くのではなく、リポジトリのルートで静的HTTPサーバーを起動してください。たとえば、Pythonがインストール済みなら `python -m http.server 8000` を実行し、`http://localhost:8000` を開きます。

ロジックテストはNode.js 22以降で実行できます。

```sh
node --test
```

## 出題範囲

- **最終進化のみ**：進化先を持たない通常のポケモンを対象にします。メガシンカは進化段階として扱わないため除外します。
- **レギュレーションM-C**：2026年9月9日時点の[M-C対象リスト](https://github.com/Marioarttv/PokemonChampionsHelper/blob/main/src/data/championsLegalPokemon.ts)を全国図鑑番号に変換した一覧で絞り込みます。データとして存在する全フォルムに同じ図鑑番号の条件を適用します。

出題条件は個別に切り替えられます。どちらもオフにすると、同梱データにある全ポケモンが対象です。素早さが同じ2匹は出題しません。

## データと画像

- 日本語名・種族値・進化情報：[`kotofurumiya/pokemon_data`](https://github.com/kotofurumiya/pokemon_data) のJSONを同梱しています。同データは全国図鑑807番までのため、808番以降の通常ポケモンは[PokeAPIのCSVデータ](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv)から補っています。
- レギュレーションM-C対象番号：[Pokemon Champions Helper](https://github.com/Marioarttv/PokemonChampionsHelper)が公開する2026年9月9日時点の対象名一覧をPokeAPIの全国図鑑データに照合した一覧を同梱しています。公式発表との同期ではないため、ルール更新時は公式情報を確認して `data/regulation-mc.json` を更新してください。
- 画像：PokeAPI SpritesのChampions Frontを優先し、Legends: Z-A、Scarlet/Violet（Generation IX）、Legends: Arceusの順にフォールバックします。

データを更新する場合は、出題データと `data/regulation-mc.json` を合わせて更新してください。画像は実行時にPokeAPI Spritesから読み込みます。

## GitHub Pages

`main`へのpushでGitHub Actionsがテストを実行し、成功するとPagesへデプロイします。初回公開前にGitHubリポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定してください。初回push時点でPagesが未設定の場合は、設定後にActionsの失敗したデプロイを再実行します。公開URLは `https://bashio44.github.io/PokemonSpeedQuiz/` です。
