/**
 * 本文ファイルの「テンプレートリテラルの壊れ」を、束ねる前に見つける検査。
 *
 * `npm run check` の本体（scripts/check.ts）は esbuild で束ねてから動く。
 * だから **本文ファイルが構文として壊れていると、検査そのものが動かない。**
 * そのとき esbuild が出すのは
 *
 *     Expected "}" but found "diagram"
 *       26 │ ```diagram:flow
 *
 * という、原因が読み取れないメッセージだけになる。
 *
 * 本文は TypeScript のテンプレートリテラル（body: ` … `）の中にあるので、
 * **中のバックティックは `\`` と書かなければならない。**
 * ` ```diagram ` や ` ```quiz ` のフェンスを生で書くと、そこで本文が終わったことになり、
 * 続きが TypeScript のコードとして読まれて崩れる。
 * CLAUDE.md の「バックスラッシュの落とし穴」に書いてある型で、
 * 実際に法令の章を書かせたときに起きた（2026 年 9 月 13 日）。
 *
 * この検査は本文を**ただの文字列として**読むので、壊れていても動く。
 * だから `npm run check` の最初に置いてある。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BT = String.fromCharCode(96); // `
const BS = String.fromCharCode(92); // \

/** 検査するディレクトリ（本文と問題文が入っているところ） */
const ROOTS = ['src/data/textbook', 'src/data/questions'];

/** ソースを再帰で集める（拡張子で絞る） */
function listSrc(dir, exts = ['.ts']) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listSrc(p, exts));
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

const problems = [];

for (const root of ROOTS) {
  let files;
  try {
    files = listSrc(root);
  } catch {
    continue; // まだ無いディレクトリは飛ばす
  }

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');

    lines.forEach((line, i) => {
      // 行頭のフェンスが生のままになっていないか。
      // 正しくは \`\`\`diagram:flow のようにエスケープされている。
      if (line.startsWith(BT + BT + BT)) {
        problems.push({
          file,
          line: i + 1,
          text: line.slice(0, 40),
          why: 'フェンスが生のバックティックです。' + BS + BT + BS + BT + BS + BT + ' と書いてください',
        });
      }
    });

    // 本文（body: ` … `）の中に、エスケープされていないバックティックが無いか。
    // 上のフェンス検査で拾えない「行の途中の `code`」を捕まえる。
    const bodyOpen = /body:\s*`/g;
    let m;
    while ((m = bodyOpen.exec(text)) !== null) {
      const start = m.index + m[0].length;
      // 本文の終わりは 改行 + バックティック + カンマ
      const endMark = '\n' + BT + ',';
      const end = text.indexOf(endMark, start);
      if (end === -1) {
        problems.push({
          file,
          line: text.slice(0, start).split('\n').length,
          text: 'body: ' + BT,
          why: '本文の閉じ（改行 + バックティック + カンマ）が見つかりません',
        });
        break;
      }
      const body = text.slice(start, end);
      for (let i = 0; i < body.length; i += 1) {
        if (body[i] === BT && body[i - 1] !== BS) {
          const lineNo = text.slice(0, start + i).split('\n').length;
          problems.push({
            file,
            line: lineNo,
            text: body.slice(Math.max(0, i - 20), i + 10).replace(/\n/g, '\\n'),
            why: 'エスケープされていないバックティックです',
          });
          break; // 1 か所ぶんだけ挙げれば十分（直せば次が見える）
        }
      }

      // --- 数式のバックスラッシュが 1 本のままになっていないか ---
      //
      // 本文はテンプレートリテラルの中にあるので、**TypeScript が先に食います。**
      // `\f` は改ページ、`\s` や `\l` は単に s・l になる。つまり
      //
      //   \frac{1}{2}  → （改ページ）rac{1}{2}
      //   \sqrt{2}     → sqrt{2}
      //   \leq         → leq
      //
      // **2 本書けば 1 本が残ります。**
      //
      // `check.ts` は「波かっこが生で出ている」ほうで \frac と \sqrt を捕まえますが、
      // **\leq のように波かっこを取らない命令はすり抜けます**
      // （lw-30 で 8 件すり抜けました。2026 年 9 月 18 日）。
      // 画面には `0leq X` と出るだけなので、目で見ても数式の崩れに気づけません。
      // だから**ソースの側で、奇数本のバックスラッシュを数えて**弾きます。
      // ★ 正規表現を文字列から組むときは、バックスラッシュが **2 本**要ります。
      // `BS + '+'` だと「エスケープされた +」＝ 文字としての + になり、何も拾いません
      // （最初にそう書いて、検査が黙って素通りしました）。
      const oddBs = new RegExp(BS + BS + '+([a-zA-Z]+)', 'g');
      let b;
      while ((b = oddBs.exec(body)) !== null) {
        const run = b[0].length - b[1].length;

        // ★★ \n だけは話が逆です（2026 年 9 月 22 日に、この検査の文言で実際に間違えました）。
        //
        //   ソースに \n（1 本）  → 実行時に**改行**になる。段落を分けたいときはこれでよい
        //   ソースに \\n（2 本） → 画面に「\n」という**2 文字がそのまま出る**
        //
        // 下の「2 本で書いてください」を \n にも当ててしまい、
        // **段落の区切りのつもりで入れた 71 か所が、画面に \n\n と出る状態**になりました。
        // 既存の 100 節あまりは、ソースで実際に改行しています。そちらにそろえてください。
        if (b[1] === 'n') {
          if (run >= 2) {
            problems.push({
              file,
              line: text.slice(0, start + b.index).split('\n').length,
              text: body.slice(Math.max(0, b.index - 12), b.index + b[0].length + 4).replace(/\n/g, ' '),
              why:
                'バックスラッシュ ' + run + ' 本 + n です。**画面に n の前のバックスラッシュごと文字として出ます。**' +
                '段落を分けたいなら、ソースで実際に改行してください',
            });
            break;
          }
          continue; // 1 本は改行になる。正しい書き方
        }

        if (run % 2 === 0) continue; // 2 本ならそのまま残る
        problems.push({
          file,
          line: text.slice(0, start + b.index).split('\n').length,
          text: body.slice(Math.max(0, b.index - 12), b.index + b[0].length + 4).replace(/\n/g, ' '),
          why:
            'バックスラッシュが ' + run + ' 本です。TypeScript が食うので ' +
            BS + BS + b[1] + ' と 2 本で書いてください',
        });
        break; // 1 ファイル 1 件でよい（直せば次が見える）
      }

      // ★ 以前はここで「細空きの \, は読点として出るので \ に書くこと」と弾いていた。
      //   **2026 年 9 月 30 日に描画部品（src/lib/math.tsx）のほうを直し、\, を空白として描くようにした。**
      //   だから \, はそのまま書いてよい。戻っていないかは check.ts が実際に描いて確かめている。

      bodyOpen.lastIndex = end;
    }
  }
}

// --- 選択肢の数を決め打ちした名残 ---
//
// **この試験の確認問題は、空欄ごとに選択肢が 2〜20 個と違う**（CLAUDE.md「確認問題の形」）。
// 姉妹アプリは四肢択一・五肢択一で数が決まっていたので、移植したコードのあちこちに
// 「4」「5」が決め打ちで残る。型では防げない。
//
// 姉妹アプリで実際に残っていたもの（2026 年 9 月 13 日に発見）
//   - 画面のキーボード案内「1〜4 で選択」…… 3 画面。
//     `choiceIndexOf` は直っていたので、**押せば動くのに案内だけが 4** だった
//   - `scripts/drive.mjs` が選択肢を /^[アイウエ]/ で拾っていた …… 5 つめを数えていなかった
//
// どちらも「壊れていないように見えて、最後の選択肢だけが無いことになる」壊れ方をする。
// このアプリでは**数を決め打ちした書き方そのもの**を止める。
{
  const FOUR = [
    {
      roots: ['src/pages', 'src/components'],
      exts: ['.tsx', '.ts'],
      re: /<kbd>1<\/kbd>\s*〜\s*<kbd>\d<\/kbd>/,
      why: '画面の案内が数字の決め打ちです。選択肢の数は問題ごとに違うので、`keyChoiceCount(choices.length)` を出してください（数字キーは 9 個目まで）',
    },
    {
      roots: ['src/pages', 'src/components', 'src/lib', 'scripts'],
      exts: ['.tsx', '.ts', '.mjs'],
      re: /\[アイウエオ?\]/,
      why: '選択肢を「ア〜エ／オ」で拾っています。解答群は最大ト（20 個）までです',
    },
    {
      roots: ['src/pages', 'src/components', 'src/lib'],
      exts: ['.tsx', '.ts'],
      re: /choiceIndexOf\(key\)|choiceIndexOf\(key: string, max = \d\)/,
      why: 'choiceIndexOf に選択肢の数を渡していません（既定値は置かない方針）',
    },
  ];

  for (const rule of FOUR) {
    for (const root of rule.roots) {
      let files;
      try {
        files = listSrc(root, rule.exts);
      } catch {
        continue;
      }
      for (const file of files) {
        // この検査ファイル自身は飛ばす。**探している字面をコメントに書いてあるため。**
        if (file.endsWith('check-source.mjs')) continue;
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (rule.re.test(line)) {
              problems.push({ file, line: i + 1, text: line.trim().slice(0, 60), why: rule.why });
            }
          });
      }
    }
  }
}

// --- 描画中にストアを書き換えていないか ---
//
// `setSession((s) => { ... actions.answer(...) ... })` のように、
// **状態の更新関数の中でストアを書き換える**と 2 つのことが起きる。
//
//   1. React が「描画中に別のコンポーネントを更新した」と警告する
//   2. **StrictMode では更新関数が 2 回走るので、学習記録が二重に入る**
//
// 2 は画面に何も出ないまま成績だけが狂うので、目で見ても気づけない。
// 姉妹アプリの `Practice.tsx` と、このアプリの `Drill.tsx` の両方で起きた
// （`scripts/drive.mjs` がコンソールの警告を拾って見つけた）。
//
// **正しい形は、記録を更新関数の外で 1 回だけ呼ぶこと。**
{
  let files;
  try {
    files = listSrc('src/pages', ['.tsx']).concat(listSrc('src/components', ['.tsx']));
  } catch {
    files = [];
  }
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    // set*((...) => { ... }) の中身を取り出して、actions.* が入っていないか見る
    const re = /set[A-Z]\w*\(\s*\((\w*)\)\s*=>\s*\{/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      // 対応する閉じ括弧まで数える
      let depth = 1;
      let i = m.index + m[0].length;
      for (; i < text.length && depth > 0; i += 1) {
        if (text[i] === '{') depth += 1;
        else if (text[i] === '}') depth -= 1;
      }
      const inner = text.slice(m.index + m[0].length, i);
      const hit = inner.match(/actions\.\w+\(/);
      if (hit) {
        problems.push({
          file,
          line: text.slice(0, m.index).split('\n').length,
          text: m[0] + ' … ' + hit[0],
          why:
            '状態の更新関数の中でストア（' +
            hit[0] +
            '）を書き換えています。StrictMode で 2 回走り、記録が二重に入ります',
        });
      }
    }
  }
}

/*
 * 4. 姉妹アプリと共有する入れ物に、アプリ固有の名前が付いているか。
 *
 * localStorage も Cache Storage も**オリジン単位**なので、
 * github.io に姉妹アプリを並べると 1 つの入れ物を共有する。
 *   - localStorage のキーがぶつかれば、学習記録が混ざる
 *   - サービスワーカーの activate が「自分以外」を消せば、隣のキャッシュまで巻き添えになる
 *
 * どちらも `package.json` の名前を接頭辞にすれば、ぶつからない。
 * **リポジトリ名を改めたときに、片方だけ直し忘れる形で起きる。**
 * 実際に、乙 4 版の改名で見つかった（2026 年 9 月 15 日）。
 */
{
  let pkgName = '';
  try {
    pkgName = JSON.parse(readFileSync('package.json', 'utf8')).name || '';
  } catch {
    pkgName = ''; // package.json が読めないときは、この検査を飛ばす
  }

  const lineOf = (text, index) => text.slice(0, index).split('\n').length;

  if (pkgName) {
    try {
      const sw = readFileSync('public/sw.js', 'utf8');
      const m = sw.match(/const CACHE_PREFIX = '([^']*)'/);
      if (!m) {
        problems.push({
          file: 'public/sw.js',
          line: 1,
          text: 'CACHE_PREFIX が見つからない',
          why: 'キャッシュ名がオリジンの中でアプリ固有になっていません',
        });
      } else if (m[1] !== pkgName + '-') {
        problems.push({
          file: 'public/sw.js',
          line: lineOf(sw, m.index),
          text: m[1] + '  （package.json は ' + pkgName + '）',
          why: 'キャッシュの接頭辞がオリジンの中でアプリ固有になっていません。package.json の名前 + "-" にしてください',
        });
      }
      if (!/startsWith\(CACHE_PREFIX\)/.test(sw)) {
        problems.push({
          file: 'public/sw.js',
          line: 1,
          text: 'activate が startsWith(CACHE_PREFIX) で絞っていない',
          why: 'オリジンを共有する姉妹アプリのキャッシュまで消します。消すのは自分の接頭辞が付いたものだけにしてください',
        });
      }
    } catch {
      /* まだ sw.js が無いなら飛ばす */
    }

    try {
      const st = readFileSync('src/lib/storage.ts', 'utf8');
      const m = st.match(/const KEY = '([^']*)'/);
      if (m && !m[1].startsWith(pkgName + '-')) {
        problems.push({
          file: 'src/lib/storage.ts',
          line: lineOf(st, m.index),
          text: m[1] + '  （package.json は ' + pkgName + '）',
          why: 'localStorage のキーがオリジンの中でアプリ固有になっていません。package.json の名前で始めてください',
        });
      }
    } catch {
      /* まだ storage.ts が無いなら飛ばす */
    }
  }
}

// --- 合格基準を「以上」と言い切っていないか ---
//
// **この試験の合格基準は「各科目とも満点の 60 パーセント程度」で、「以上」ではありません。**
// 姉妹アプリ（危険物取扱者試験）は「それぞれ 60 % 以上」と言い切っていたので、
// **移植した画面に、向こうの言い回しがそのまま残ります。**
//
// 実際に残っていました（2026 年 9 月 19 日、`src/pages/Stats.tsx`）。
// 「合格には 3 科目それぞれで 60 % 以上が必要です。」と出ていて、
// **CLAUDE.md が「基準を満たすと書かないこと」と名指ししている当のことを、
// アプリ自身が画面でやっていました。**型でもビルドでも検査でも止まらず、
// 起動して読んで初めて見つかっています。
//
// 「『6 割以上』と言い切られていません」のような**打ち消しの文**は通します。
// 弾くのは、**基準そのものを「以上」で言い切っている**書き方だけです。
{
  const uiRoots = ['src/pages', 'src/components'];
  const BAD = [
    /(?:60\s*%|６０％|60\s*パーセント|6\s*割)\s*以上[がを]?\s*(?:必要|要る|求め)/,
    /基準を満たす/,
    /合格(?:基準)?(?:に|は)[^。]{0,20}以上[がを]?\s*必要/,
  ];
  for (const root of uiRoots) {
    let files;
    try {
      files = listSrc(root, ['.tsx', '.ts']);
    } catch {
      continue;
    }
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        // コメント行は対象外（なぜ「以上」と書いてはいけないかを説明している箇所がある）
        const t = line.trim();
        if (t.startsWith('*') || t.startsWith('//')) return;
        if (BAD.some((re) => re.test(line))) {
          problems.push({
            file,
            line: i + 1,
            text: t.slice(0, 80),
            why: '合格基準を「以上」と言い切っています（この試験は「60 パーセント程度」です）',
          });
        }
      });
    }
  }
}

// --- 法規の問題に、基準日の前置きが出るか ---
//
// **受験案内（注 1）は、省エネ法を「令和 8 年 4 月 1 日時点で施行されている法令」としています。**
// 基準日を示さないと、改正の前後で記述の正誤が割れます。
//
// **★ 高圧ガス甲種版から持ってきた検査です。**向こうでは前置きが 3 つ（基準日・大臣の認定・
// 都道府県知事等）でしたが、**この試験の本番の問題用紙に何が置かれているかは、まだ確かめていません。**
// 公開問題で確かめたら、ここに足してください。
//
// 画面から消えても型でもビルドでも止まらないので、ここで見張ります。
{
  const cats = readFileSync('src/data/categories.ts', 'utf8');
  const card = readFileSync('src/components/QuestionCard.tsx', 'utf8');
  const lines = (cats.match(/export const LAW_PREAMBLE[^;]*;/s) ?? [''])[0];
  if (!lines) {
    problems.push({
      file: 'src/data/categories.ts',
      line: 1,
      text: 'LAW_PREAMBLE',
      why: '法令の前置き（LAW_PREAMBLE）がありません',
    });
  } else {
    // 基準日があるか（年度が変わったら取り直すこと）
    for (const [word, what] of [['令和 8 年 4 月 1 日', '基準日']]) {
      if (!lines.includes(word)) {
        problems.push({
          file: 'src/data/categories.ts',
          line: 1,
          text: 'LAW_PREAMBLE',
          why: '法令の前置きに' + what + 'がありません',
        });
      }
    }
  }
  // **★ import 行の LAW_PREAMBLE を数えないこと。**
  // 最初にこう書いたら、画面から前置きを丸ごと消しても通ってしまった。
  // 実際に並べているところ（.map）を見る。
  if (!/LAW_PREAMBLE\.map\(/.test(card)) {
    problems.push({
      file: 'src/components/QuestionCard.tsx',
      line: 1,
      text: 'QuestionCard',
      why: '法令の前置きを画面に出していません（LAW_PREAMBLE を描いてください）',
    });
  } else if (!/q\.categoryId === 'k1-law'/.test(card)) {
    problems.push({
      file: 'src/components/QuestionCard.tsx',
      line: 1,
      text: 'QuestionCard',
      why: '法令の前置きを法令の問題だけに絞っていません',
    });
  }
}

if (problems.length > 0) {
  console.error('--- 束ねる前の検査で見つかりました（' + problems.length + ' 件）---');
  for (const p of problems) {
    console.error('  ' + p.file + ':' + p.line + '  ' + p.why);
    console.error('    ' + p.text);
  }
  console.error('');
  if (problems.some((p) => p.why.includes('バックティック'))) {
    console.error('本文は TypeScript のテンプレートリテラルの中にあります。');
    console.error('中のバックティックは ' + BS + BT + ' と書いてください（CLAUDE.md「バックスラッシュの落とし穴」）。');
    console.error('bash のヒアドキュメントはバックスラッシュを落とすので、Write ツールを使ってください。');
  }
  if (problems.some((p) => /決め打ち|最大ト|選択肢の数/.test(p.why))) {
    console.error('この試験の確認問題は、空欄ごとに選択肢が 2〜20 個と違います（姉妹アプリは 4 択・5 択の固定でした）。');
    console.error('CLAUDE.md の「確認問題の形」を参照してください。');
  }
  if (problems.some((p) => p.why.includes('更新関数'))) {
    console.error('記録は更新関数の外で 1 回だけ呼んでください。');
    console.error('正しい形は src/pages/Practice.tsx の submit にあります。');
  }
  if (problems.some((p) => p.why.includes('合格基準'))) {
    console.error('合格基準は「各科目とも満点の 60 パーセント程度」です（受験案内書 Ⅰ-7）。');
    console.error('姉妹アプリ（危険物取扱者試験）の「それぞれ 60 % 以上」を写さないでください。');
    console.error('画面に出せるのは「この模試で 6 割に届いたか」までです（CLAUDE.md「変えないこと」）。');
  }
  if (problems.some((p) => p.why.includes('前置き'))) {
    console.error('法規の問題には、基準日（令和 8 年 4 月 1 日時点の法令）の前置きを置いてください。');
    console.error('省エネ法は改正が続いています。基準日が無いと、改正の前後で記述の正誤が割れます。');
  }
  if (problems.some((p) => p.why.includes('オリジン'))) {
    console.error('localStorage と Cache Storage はオリジン単位です。姉妹アプリを同じ github.io に並べると共有します。');
    console.error('名前は package.json の名前を接頭辞にして、消すときも自分の接頭辞が付いたものだけにしてください。');
  }
  process.exit(1);
}

console.log('本文の書式・選択肢の数の決め打ち: 問題なし');
