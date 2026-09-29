// 開発サーバのアプリを、実際にブラウザで開いて操作する。
//
// なぜこれが要るか：`npm run check` は React で描画までするが、それは
// 「描ける」ことしか見ていない。クリックしたとき何が起きるかは見ていない。
// このスクリプトを書いたことで、確認問題の解答が学習記録へ二重登録される
// 不具合が実際に見つかった（Practice.tsx で actions.answer を setSession の
// 更新関数の中で呼んでいた。StrictMode では更新関数が 2 回走る）。
// 検査でもビルドでも型でも捕まらない種類の不具合で、押してみるしかなかった。
//
// なぜ Playwright を入れないか：このリポジトリの方針が「ランタイム依存は
// React だけ」なので、開発用でも重い依存は足したくない。Node 24 には
// WebSocket が組み込みで入っているため、Chrome DevTools Protocol へ
// 直接つなげば追加インストールなしで済む。Edge は Windows に最初からある。
//
// 使い方：
//   1. 別の端末で `npm run dev` を起動しておく
//   2. node scripts/drive.mjs
//
// 別の画面を見たいときは、いちばん下の「筋書き」だけ書き換える。

import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9222;
// vite は 5173 が埋まっていると 5174、5175 と繰り上がる。
// 別のアプリの開発サーバを同時に立てていると起きるので、環境変数で渡せるようにする。
//   DEV_PORT=5174 node scripts/drive.mjs
const BASE = `http://localhost:${process.env.DEV_PORT ?? 5173}`;

// **どのアプリにつないだかを必ず確かめる。**
// ポートを固定していたせいで、姉妹アプリの開発サーバを相手に
// 「確認できました」と報告しかけた。取り違えは黙って起きるので、機械に見張らせる。
const EXPECT_TITLE = 'エネ管 熱';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Edge を headless で起動して DevTools につなぐ ---

const profile = mkdtempSync(join(tmpdir(), 'drive-'));
const edge = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    // 使い捨てのプロファイルにしないと、ふだん使いの Edge が開いているときに
    // 起動が奪われて DevTools につながらない。
    `--user-data-dir=${profile}`,
    '--no-first-run',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function debuggerUrl() {
  // 起動直後は /json/list がまだ応答しない。数秒ぶんだけ待つ。
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* まだ起動中 */
    }
    await sleep(250);
  }
  throw new Error('DevTools につながらなかった。Edge のパスを確かめること');
}

const ws = new WebSocket(await debuggerUrl());
await new Promise((r) => (ws.onopen = r));

let id = 0;
const waiting = new Map();
const errors = [];

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && waiting.has(msg.id)) {
    waiting.get(msg.id)(msg);
    waiting.delete(msg.id);
    return;
  }
  // 画面は出ているのにコンソールだけ荒れている、という状態を見逃さないため、
  // 例外と console.error を拾っておく。React の警告もここに出る。
  if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(msg.params.exceptionDetails.text);
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    errors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  }
};

function send(method, params = {}) {
  const n = ++id;
  ws.send(JSON.stringify({ id: n, method, params }));
  return new Promise((r) => waiting.set(n, r));
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.result?.exceptionDetails) {
    throw new Error(JSON.stringify(res.result.exceptionDetails));
  }
  return res.result?.result?.value;
}

// --- 操作のことば ---

/** ハッシュルータなので、location.hash を書き換えれば画面が変わる。 */
async function go(hash) {
  await evaluate(`location.hash = ${JSON.stringify(hash)}`);
  await sleep(700);
}

/** いま画面に出ている文字。空行を潰して読みやすくする。 */
function visible() {
  return evaluate(
    `(() => {
       const t = document.querySelector('.page')?.innerText ?? document.body.innerText;
       return t.replace(/\\n{2,}/g, '\\n').trim();
     })()`,
  );
}

/**
 * 文字で要素を探して押す。セレクタではなく見えている文字で指すのは、
 * 画面の作りが変わっても筋書きを書き直さずに済むため。
 * 見つからなければ 'NOT_FOUND' が返る（例外にしない。押せなかったこと自体が結果）。
 */
function click(text, tag = 'button') {
  return evaluate(
    `(() => {
       const els = [...document.querySelectorAll(${JSON.stringify(tag)})];
       const el = els.find((e) => e.innerText.trim().includes(${JSON.stringify(text)}));
       if (!el) return 'NOT_FOUND';
       el.click();
       return 'OK';
     })()`,
  );
}

/**
 * 選択肢の n 番目を押す。確認問題と模試で使う。
 *
 * **選択肢は記号（ア、イ…）ではなく `.choice` のクラスで拾う。**
 * 姉妹アプリは「ア〜エで始まるボタン」を正規表現で拾っていて、5 つめを押せないことに黙って気づけなかった。
 * この試験は空欄ごとに 2〜20 個（ア〜ト）と数が違うので、記号の範囲を決め打ちしない。
 */
function choose(n) {
  return evaluate(
    `(() => {
       const b = [...document.querySelectorAll('button.choice')];
       if (!b[${n}]) return 'NO_CHOICES';
       b[${n}].click();
       return 'OK';
     })()`,
  );
}

/** いま選択されている選択肢の数。単一選択と複数選択の違いはここに出る。 */
function selectedCount() {
  return evaluate(`document.querySelectorAll('.choice.selected').length`);
}

/** いま出ている問題が複数選択かどうか。画面のタグで見る。 */
function isMulti() {
  return evaluate(`document.querySelector('.tag-multi') !== null`);
}

// 教本の節。**節 ID を手で並べる。**
//
// **わざと手で並べている。**`SECTIONS` から自動で拾うと、
// **節が 1 つ消えても気づけない**（その節を開かなくなるだけで、エラーにならない）。
//
// **★ 以前は、開いているページのリンクから拾おうとしていた。**
// ところがこの行はアプリを開く前に走るので、**毎回 0 件**になり、
// 「教本の節」の欄が空のまま「異常なし」に見えていた。**黙って何も見ない検査**だった。
//
// **★ ここは立ち上げのときに必ず空にすること。**
// 前のアプリの節 ID が残っていると、**存在しない節を開いて全部「描けていない」になる。**
// 危険物甲種版から持ってきたときも、50 個の ID が残っていた。
//
// **★ 手で並べるのをやめました**（2026 年 9 月 18 日）。
// 節が 4 本のうちは手で書けましたが、**67 本まで増えた**ところで、
// 手で書き写す形そのものが上の 2 つの失敗（空のまま／前のアプリの ID が残る）を
// 呼び込みます。**ソースから読むようにしたので、古くなりようがありません。**
//
// 教本のデータは TypeScript なので、ここでは**ただの文字列として**読みます。
// `check-source.mjs` と同じ考え方で、壊れていても動きます。
const ALL_SECTIONS = (() => {
  const dir = 'src/data/textbook';
  const ids = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.ts') || name === 'index.ts') continue;
    const text = readFileSync(join(dir, name), 'utf8');
    for (const m of text.matchAll(/^\s*id: '([a-z]+-?\d+)',/gm)) ids.push(m[1]);
  }
  return ids;
})();

// **その場で出す。**以前は最後にまとめて出していたが、途中で止まると
// **出力が 1 文字も出ず、どこで止まったのか分からなかった。**
// 筋書きが伸びるほど効くので、書いた順に流す。
const show = (title, body) => {
  console.log(`\n===== ${title} =====\n${body}`);
};

// ============================================================
// 筋書き — ここだけ書き換えて使う
//
// 「全節を開く → 確認問題を解いて採点 → ドリル → 体験ツール → 模試」まで押す。
//
// **いまの中身**（2026 年 9 月 23 日）：**教本 150 節、確認問題 225 問、計算ドリル 24 種類。**
// **体験ウィジェットだけがまだ 7 つ（引き継いだまま）**なので、その区間は薄い。
//
// **★ 計算ドリルは、ここで必ず押してみること。**
// `npm run check` は 1 種類につき 200 回生成して「5 択か」「0 が混じらないか」を見ているが、
// **問題文が日本語として読めるか、選択肢が紛らわしすぎないかは見ていない。**
// 8 つめでは、ブラウザで押して初めて「0 MPa」という誤答に気づいた。
// 画面を開かずに文字だけ読みたいときは `npm run drills` が使える。
// ============================================================

await send('Page.enable');
await send('Runtime.enable');
await evaluate(`location.href = ${JSON.stringify(BASE + '/')}`);
await sleep(1200);
{
  const title = await evaluate('document.title');
  if (typeof title !== 'string' || !title.includes(EXPECT_TITLE)) {
    console.error(
      `つないだ先が違う：${BASE} のタイトルは「${title}」。` +
        `DEV_PORT を確かめること（このアプリは「${EXPECT_TITLE}」を含む）。`,
    );
    process.exit(1);
  }
}
await evaluate(`location.href = ${JSON.stringify(BASE + '/#/home')}`);
await sleep(1500);
show('ホーム', (await visible()).slice(0, 500));

// 教本の節が描けるか。表と quiz の記法が崩れていないかもここで分かる。
//
// **すべての節を開く。**節ごとに書いた人が違ううえ、図の記法は
// `npm run check` が書式までしか見ない。実際に描かせないと、
// 「枠は出るが中身が空」という壊れ方が残る。
//
// 全節ぶんの本文を貼ると報告が読めなくなるので、**節ごとには要約だけを出し、
// 異常があったものだけを本文つきで出す。**
const sectionReport = [];
const badSections = [];

for (const id of ALL_SECTIONS) {
  await go(`#/textbook/${id}`);
  const info = await evaluate(
    `(() => {
       const page = document.querySelector('.page');
       if (!page) return { missing: true };
       const text = page.innerText;
       return {
         chars: text.length,
         // 節の骨格。digest.ts が直前チェックシートへ抜き出すもの。
         hasSummary: text.includes('この節のまとめ'),
         hasPoint: text.includes('試験のポイント'),
         // 図と表と一問一答が、実際に要素として出ているか
         diagrams: document.querySelectorAll('.dgm').length,
         tables: document.querySelectorAll('table').length,
         quizzes: document.querySelectorAll('.selfcheck-item').length,
         // 描けなかったときに出る形跡
         nan: /NaN|undefined|\\[object Object\\]/.test(text),
         // 記法が崩れると、生の記号が本文に出てくる
         raw: new RegExp('\\\\*\\\\*|::|' + String.fromCharCode(96).repeat(3)).test(text),
       };
     })()`,
  );
  const flags = [];
  if (info.missing) flags.push('描けていない');
  if (!info.hasSummary) flags.push('まとめが無い');
  if (!info.hasPoint) flags.push('試験のポイントが無い');
  if (info.nan) flags.push('NaN/undefined が出ている');
  if (info.raw) flags.push('記法の生の記号が出ている');
  if (info.chars < 800) flags.push(`短すぎる（${info.chars} 字）`);

  sectionReport.push(
    `${id.padEnd(6)} ${String(info.chars ?? 0).padStart(5)}字  ` +
      `図${info.diagrams ?? 0} 表${info.tables ?? 0} 一問一答${info.quizzes ?? 0}` +
      (flags.length ? `  ★ ${flags.join(' / ')}` : ''),
  );
  if (flags.length) badSections.push(id);
}

show('教本の節', sectionReport.join('\n'));

// 異常のあった節だけ、本文を出して目で見る
for (const id of badSections.slice(0, 5)) {
  await go(`#/textbook/${id}`);
  show(`教本 ${id}（要確認）`, (await visible()).slice(0, 900));
}

// 直前チェックシート。各節の「まとめ」「試験のポイント」「よくある勘違い」を
// digest.ts が機械的に抜き出す。**書式が崩れていれば、ここに出てこない。**
await go('#/sheet');
{
  // **★ ここは 2026 年 9 月 18 日まで、黙って 0 を返す死んだ検査でした。**
  // `.sheet-section` も `.sheet h3` も `.page h3` も、この画面には存在しません
  // （`src/pages/Sheet.tsx` が使うのは `.sheet-block` と `.sheet-item`）。
  // **節が 4 本のときも 80 本のときも「見出しの数: 0」と出る**ので、
  // 数字を見ていても異常に気づけませんでした。
  // **画面のクラス名を変えたら、ここも直すこと。**
  const n = await evaluate(
    `JSON.stringify({
       blocks: document.querySelectorAll('.sheet-block').length,
       items: document.querySelectorAll('.sheet-item').length,
     })`,
  );
  const { blocks, items } = JSON.parse(n);
  const bad = blocks === 0 || items === 0 ? '  ← 抜き出せていません' : '';
  show('直前チェックシート', `節 ${blocks} / 項目 ${items}${bad}\n` + (await visible()).slice(0, 900));
}

// 計算ドリル。**この試験には計算問題が出る**ので、姉妹アプリと違って中身がある。
// 値を振り直して出すため、**選択肢が 5 つ揃うか**をここで数える。
await go('#/drill');
show('計算ドリルの一覧', (await visible()).slice(0, 600));

{
  // **一覧で名前を押すと、その種類の選択が外れるだけ**（チェックボックス）。
  // 実際に問題を出すのは「ドリルを始める」。ここを取り違えて
  // 「選択肢が 0 個」という誤った結果を出したことがある。
  const drillReport = [];

  await go('#/drill');
  await click('すべて選ぶ');
  await sleep(300);
  const started = await click('ドリルを始める');
  await sleep(800);

  if (started !== 'OK') {
    drillReport.push('「ドリルを始める」が押せなかった: ' + started);
  } else {
    // 6 種類すべてが出るまで、何問か続けて解く。
    // 値は毎回振り直されるので、**同じ種類でも別の問題**になる。
    const seen = new Set();
    for (let i = 0; i < 24; i += 1) {
      const info = await evaluate(
        `(() => {
           const page = document.querySelector('.page');
           const text = page ? page.innerText : '';
           const choices = [...document.querySelectorAll('button.choice')];
           return {
             choices: choices.length,
             labels: choices.map((c) => c.innerText.trim().slice(0, 28)),
             // **★ テンプレートリテラルの中なので、正規表現のバックスラッシュは 2 つ重ねる。**
             // 1 つだと JS が \s を s と解釈して /s+/g になり、**本文の s が全部消える。**
             // 実際に src/data/drills.ts が「rc/data/drill .t」と報告に出た。
             // 描画も検査も素通りするので、報告を目で読むまで気づけない。
             nan: /NaN|undefined|Infinity/.test(text),
             head: text.slice(0, 220).replace(/\\s+/g, ' '),
           };
         })()`,
      );

      if (info.choices === 0) {
        drillReport.push(`${i + 1} 問目: 選択肢が出ていない  ${info.head}`);
        break;
      }

      const flags = [];
      if (info.choices !== 5) flags.push(`★ 選択肢が ${info.choices} 個（ドリルは数値の 5 択なので 5 個のはず）`);
      if (info.nan) flags.push('★ NaN/undefined/Infinity が出ている');
      // 同じ文字列の選択肢が 2 つあると、正解が一意に決まらない
      if (new Set(info.labels).size !== info.labels.length) flags.push('★ 同じ選択肢が重複している');

      const key = info.head.slice(0, 40);
      if (!seen.has(key) || flags.length) {
        seen.add(key);
        drillReport.push(`${i + 1} 問目: 選択肢 ${info.choices} 個 ${flags.join(' ')}\n    ${info.head}`);
      }

      // 1 つ選んで採点し、次へ進む
      await choose(0);
      await sleep(200);
      await click('解答する');
      await sleep(200);
      const next = await click('次の問題へ');
      await sleep(400);
      if (next !== 'OK') {
        drillReport.push(`${i + 1} 問目のあと「次の問題」が押せなかった（${next}）`);
        break;
      }
    }
  }

  show('計算ドリル', drillReport.join('\n'));
}

// 体験ツール。**押して壊れないかまで見る。**
// 置いてあるだけでは、つまみを動かしたときに NaN が出ても分からない。
await go('#/tools');
show('体験ツールの一覧', (await visible()).slice(0, 600));

{
  const toolReport = [];
  // **★ 手で並べるのをやめました**（2026 年 9 月 23 日）。ソースから読みます。
  //
  // ここには元々 [節 ID, ウィジェット名] を手で書く決まりがあり、
  // 「立ち上げのときに必ず空にすること」という注意書きまで付けてありました。
  // **それでも、乙種版の組（ho-1/bakuhatsu-hani、gm-18/usuniku-ouryoku）が残ったまま
  // 3 回目の再発をしました**（2026 年 9 月 23 日に気づいた）。
  //
  // **この型は目視では見つかりません。**存在しない節を開いて
  // 「描かれていない」と出るだけで、**本物の不具合とまったく同じ顔をします。**
  // 逆に、**実際に埋め込んだのに書き足し忘れたもの**は、黙って素通りします。
  // 実際 `tekiyou-jogai` は法令の節に埋め込んであるのに、一度も押されていませんでした。
  //
  // `ALL_SECTIONS` と同じ考え方で、**教本のソースを文字列として読みます。**
  // 節 ID と widget: の出てくる順に並べ、直前の節 ID と組にします。
  const EMBEDDED = (() => {
    const dir = 'src/data/textbook';
    const pairs = [];
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.ts') || name === 'index.ts') continue;
      const text = readFileSync(join(dir, name), 'utf8');
      let section = null;
      for (const m of text.matchAll(/^\s*id: '([a-z]+-?\d+)',|widget:([a-z0-9-]+)/gm)) {
        if (m[1] !== undefined) section = m[1];
        else if (section !== null) pairs.push([section, m[2]]);
      }
    }
    return pairs;
  })();
  toolReport.push(
    EMBEDDED.length
      ? '教本に埋め込んだウィジェット: ' + EMBEDDED.map(([, w]) => w).join(' / ')
      : '教本に埋め込んだウィジェット: まだ無い',
  );

  // 教本の節に埋め込んだものを、節ごと開いて操作する
  for (const [sec, wid] of EMBEDDED) {
    await go(`#/textbook/${sec}`);
    const found = await evaluate(`document.querySelectorAll('.widget').length`);
    if (!found) {
      toolReport.push(`${sec}: ${wid} が描かれていない`);
      continue;
    }

    // つまみ・選択・ボタンを一通り動かす
    await evaluate(
      `(() => {
         const set = (el, v) => {
           const proto = Object.getPrototypeOf(el);
           const d = Object.getOwnPropertyDescriptor(proto, 'value');
           d.set.call(el, String(v));
           el.dispatchEvent(new Event('input', { bubbles: true }));
           el.dispatchEvent(new Event('change', { bubbles: true }));
         };
         for (const r of document.querySelectorAll('.widget input[type=range]')) set(r, r.max);
         for (const n of document.querySelectorAll('.widget input[type=number]')) set(n, 9999);
         for (const sel of document.querySelectorAll('.widget select')) {
           set(sel, sel.options[sel.options.length - 1].value);
         }
         for (const b of document.querySelectorAll('.widget .widget-card')) b.click();
         return true;
       })()`,
    );
    await sleep(400);

    const after = await evaluate(
      `(() => {
         const w = document.querySelector('.widget');
         const t = w ? w.innerText : '';
         return {
           chars: t.length,
           bad: /NaN|undefined|Infinity|\\[object Object\\]/.test(t),
           tail: t.slice(-180).replace(/\\s+/g, ' '),
         };
       })()`,
    );
    toolReport.push(
      `${sec} / ${wid}: ${after.chars} 字` +
        (after.bad ? '  ★ NaN/undefined が出ている' : '') +
        `\n    ${after.tail}`,
    );
  }
  show('体験ウィジェット（操作したあと）', toolReport.join('\n'));
}

// 確認問題。**入っていれば実際に解いて採点まで押す。**（いまは 0 問）
await go('#/practice');
show('確認問題の設定', (await visible()).slice(0, 500));
{
  const qReport = [];
  // ボタンの文言は「10 問を開始する」のように出題数が入る。**文字で押すので前方一致で探す。**
  const started = (await click('問を開始する')) === 'OK';
  await sleep(700);
  if (!started) {
    qReport.push('開始ボタンが押せなかった');
  } else {
    for (let i = 0; i < 6; i += 1) {
      const info = await evaluate(
        `(() => {
           const page = document.querySelector('.page');
           const text = page ? page.innerText : '';
           const choices = [...document.querySelectorAll('button.choice')];
           return { choices: choices.length, head: text.slice(0, 120).replace(/\\s+/g, ' ') };
         })()`,
      );
      if (info.choices === 0) {
        qReport.push(`${i + 1} 問目: 選択肢が出ていない  ${info.head}`);
        break;
      }
      qReport.push(
        `${i + 1} 問目: 選択肢 ${info.choices} 個` +
          (info.choices >= 2 && info.choices <= 20 ? '' : '  ★ 解答群は 2〜20 個のはず'),
      );
      await choose(i % info.choices);
      await sleep(150);
      await click('解答する');
      await sleep(250);
      // 解説に教本への導線があるか（sectionId が効いているか）
      if (i === 0) {
        const link = await evaluate(
          `[...document.querySelectorAll('button, a')]
             .some((e) => /この節を読む|教本/.test(e.innerText))`,
        );
        qReport.push(`  解説から教本へ戻る導線: ${link ? 'ある' : '★ 無い'}`);
      }
      if (await click('次の問題') !== 'OK') break;
      await sleep(300);
    }
  }
  show('確認問題', qReport.join('\n'));
}

// 法令の問題にだけ、本番と同じ前置きが出ているか。
//
// **check-source.mjs はソースの文字列しか見ていない。**実際に描かれているかは
// ここでしか分からない。前置きが無いと、ただし書で例外が用意されている記述を
// 「例外なく正しい」と言えなくなる（src/data/categories.ts の LAW_PREAMBLE を読むこと）。
{
  const report = [];
  for (const [cat, want] of [['law-what', true], ['gk-state', false]]) {
    // **★ 間にホームを挟むこと。**#/practice から #/practice?cat=... へ移っても
    // 同じページなので React が再マウントせず、useState の初期値（?cat=）が読み直されない。
    // 最初にこう書いたら、章を選べていないのに「前置きが出ない」と言われた。
    await go('#/home');
    await sleep(250);
    await go(`#/practice?cat=${cat}`);
    await sleep(500);
    await click('問を開始する');
    await sleep(800);
    // どの章の問題が出ているかも一緒に見る。前置きが出ない原因が
    // 「法令ではない問題が出ている」なのか「前置きの実装が壊れた」なのかを分けるため。
    const shownCat = await evaluate(
      `(() => {
         const el = document.querySelector('.qcard .tag-cat');
         return el ? el.innerText.trim() : '(問題が出ていない)';
       })()`,
    );
    const found = await evaluate(
      `(() => {
         const el = document.querySelector('.law-preamble');
         return el ? el.innerText.replace(/\\s+/g, ' ').slice(0, 60) : '';
       })()`,
    );
    const ok = want ? found !== '' : found === '';
    report.push(
      `${cat}（画面の章: ${shownCat}）: 前置き ${found === '' ? 'なし' : 'あり'}` +
        (ok ? '' : `  ★ ${want ? '出るはず' : '出ないはず'}`) +
        (found === '' ? '' : `  「${found}…」`),
    );
    if (want && found !== '' && !/令和 8 年 4 月 1 日/.test(found)) {
      report.push('  ★ 基準日が入っていない');
    }
  }
  show('法令の前置き', report.join('\n'));
}

// 模試。**科目ごとの判定が出るのがこのアプリの要。**
await go('#/mock');
show('模試の設定', (await visible()).slice(0, 900));


// ============================================================

// ============================================================

show('コンソールエラー', errors.length ? errors.join('\n') : '(なし)');
