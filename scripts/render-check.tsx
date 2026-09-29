import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from '../src/lib/markdown';
import { SECTIONS } from '../src/data/textbook';
import { QUESTIONS } from '../src/data/questions';
import { DRILLS } from '../src/data/drills';
import JoutaiHouteishiki from '../src/components/widgets/joutai-houteishiki';
import NetsuTeikou from '../src/components/widgets/netsu-teikou';
import Reynolds from '../src/components/widgets/reynolds';
import RironKuuki from '../src/components/widgets/riron-kuuki';
import TaisuuHeikin from '../src/components/widgets/taisuu-heikin';

/**
 * 実際に描いてみて、画面に出てはいけないものが残っていないかを見る検査。
 * `npm run check` から呼ばれる（check.ts と違い、こちらは React を通す）。
 *
 * 型でも記法の検査でも捕まらない崩れ方が実際にあった。
 *   - `$...$` が強調の中にあると数式にならず、$ ごと画面に出ていた
 *   - `\mathbf{x}` の波かっこが記号にならず `{x}` と出ていた
 *   - ウィジェットの入力欄に NaN が入り込み、画面に NaN と出ていた
 * どれも「描いてみれば一目で分かる」たぐいなので、機械にやらせる。
 *
 * 計算ドリルは値が毎回変わるので、何度か引いて確かめる。
 */

const BACKSLASH = String.fromCharCode(92);
const BACKTICK3 = String.fromCharCode(96).repeat(3);

/**
 * ウィジェットは import.meta.glob 経由だと check から読めないので、ここに直接並べる。
 *
 * **★ ここは 2026 年 9 月 23 日まで、空のまま死んでいました。**
 * 「まだ 1 つも作っていない」というコメントが**引き継ぎ元のまま残り**、
 * その下の検査（$ が出ている／NaN が出ている／描画に失敗する）が
 * **7 つ全部について一度も走っていませんでした。**
 *
 * **手で並べる一覧は、いつか必ず古くなります。**
 * `check.ts` の `KNOWN_WIDGETS` はディレクトリを直接読む形に直してあるのに、
 * こちらだけ手書きのまま取り残されていた、という形の抜けです。
 * **ここは import が要るので機械では並べられません。**
 * だから `check.ts` に**「ファイルの数とこの一覧の数が合っているか」の検査を足してあります。**
 * 足し忘れれば、そちらが鳴ります。
 */
const WIDGETS: [string, ComponentType][] = [
  ['joutai-houteishiki', JoutaiHouteishiki],
  ['netsu-teikou', NetsuTeikou],
  ['reynolds', Reynolds],
  ['riron-kuuki', RironKuuki],
  ['taisuu-heikin', TaisuuHeikin],
];

/** 数式として描かれた部分だけを取り出す */
function mathTexts(html: string): string[] {
  const out: string[] = [];
  const re = /<span class="math">([\s\S]*?)<\/span>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[1].replace(/<[^>]+>/g, ''));
  return out;
}

function inspect(label: string, source: string, problems: string[]): void {
  const html = renderToStaticMarkup(<Markdown source={source} />);
  for (const t of mathTexts(html)) {
    if (t.includes('{') || t.includes('}')) {
      problems.push(`${label}: 数式に波かっこがそのまま出ている → ${t.slice(0, 60)}`);
    }
    if (t.includes(BACKSLASH)) {
      problems.push(`${label}: 数式にバックスラッシュがそのまま出ている → ${t.slice(0, 60)}`);
    }
  }
  if (html.includes('$')) {
    const at = html.indexOf('$');
    problems.push(`${label}: $ が数式にならず本文に出ている → ${html.slice(Math.max(0, at - 40), at + 40).replace(/<[^>]+>/g, '')}`);
  }
  if (html.includes('未対応の図の種類')) problems.push(`${label}: 未対応の図がある`);

  // **★ 記法の生の記号が、画面に文字として残っていないか**（2026 年 9 月 23 日に足した）。
  //
  // `scripts/drive.mjs` は「記法の生の記号が出ている」を見ていたが、
  // **あれは dev サーバを起こさないと走らない。**`npm run check` では素通りしていた。
  // 実際 `gk-7` が、**強調が成立せず `**` を画面に出したまま**通っていた。
  // 原因は、強調の中身に `*` を許さない正規表現に、
  // 数式の上付きの星（飽和蒸気圧の $p_A^*$）が当たったこと（`src/lib/markdown.tsx`）。
  //
  // **タグを外してから見る。**`**` は属性値に現れないが、
  // `::` は CSS 由来で出うるので、本文の文字だけにしてから数える。
  const shown = html
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&');
  for (const mark of ['**', '::', BACKTICK3]) {
    if (shown.includes(mark)) {
      const at = shown.indexOf(mark);
      problems.push(
        `${label}: 「${mark}」が記法として効かず画面に出ている → ` +
          shown.slice(Math.max(0, at - 30), at + 40).replace(/\n/g, ' '),
      );
    }
  }
}

/** 見つかった問題の一覧を返す。空なら異常なし */
export function renderCheck(): string[] {
  const problems: string[] = [];
  for (const s of SECTIONS) inspect(`教本 ${s.id}`, s.body, problems);
  for (const q of QUESTIONS) {
    inspect(`問題 ${q.id}`, q.question, problems);
    inspect(`問題 ${q.id}`, q.explanation, problems);
    q.choices.forEach((c) => inspect(`問題 ${q.id}`, c, problems));
  }
  for (const d of DRILLS) {
    for (let i = 0; i < 40; i++) {
      const item = d.generate();
      inspect(`ドリル ${d.id}`, item.question, problems);
      inspect(`ドリル ${d.id}`, item.explanation, problems);
      item.choices.forEach((c) => inspect(`ドリル ${d.id}`, c, problems));
    }
  }
  for (const [id, Component] of WIDGETS) {
    let html = '';
    try {
      html = renderToStaticMarkup(<Component />);
    } catch (e) {
      problems.push(`ウィジェット ${id}: 描画に失敗した → ${String(e).slice(0, 80)}`);
      continue;
    }
    // ウィジェットは JSX なので Markdown 記法は効かない。$...$ を書いても数式にならない
    if (html.includes('$')) problems.push(`ウィジェット ${id}: $ が数式にならずそのまま出ている`);
    if (html.includes('**')) problems.push(`ウィジェット ${id}: ** が強調にならずそのまま出ている`);
    if (html.includes('NaN')) problems.push(`ウィジェット ${id}: NaN が画面に出ている`);
    if (html.includes('Infinity')) problems.push(`ウィジェット ${id}: Infinity が画面に出ている`);
    if (html.includes('undefined')) problems.push(`ウィジェット ${id}: undefined が画面に出ている`);
  }
  // 同じ崩れを何度も報告しても仕方がないのでまとめる
  return [...new Set(problems)];
}
