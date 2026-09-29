/**
 * 計算ドリルを 1 問ずつ生成して、画面に出る文字そのままを流す道具。
 *
 * **`npm run check` は「5 択か」「0 が混じらないか」しか見ていません。**
 * 問題文が日本語として読めるか、単位が付いているか、選択肢が紛らわしすぎないかは、
 * **人が読まないと分かりません。**8 つめで、ブラウザで押してみて初めて
 * 「0 MPa」に気づいた例があります（`check.ts` の該当箇所に経緯があります）。
 *
 * 使い方:
 *   npm run drills          … 全種類を 1 問ずつ
 *   npm run drills gm-      … id が gm- で始まるものだけ
 *   npm run drills gm-lmtd 5 … その id を 5 問
 */
import { DRILLS } from '../src/data/drills';

const filter = process.argv[2] ?? '';
const times = Number(process.argv[3] ?? '1');

let shown = 0;
for (const d of DRILLS) {
  if (filter !== '' && !d.id.startsWith(filter)) continue;
  for (let i = 0; i < times; i++) {
    const item = d.generate();
    console.log('━━━ ' + d.id + ' / ' + d.name + ' ━━━');
    console.log('[' + d.categoryId + ' ' + d.sectionId + '] ' + d.summary);
    console.log('');
    console.log(item.question);
    console.log('');
    item.choices.forEach((c, k) => {
      console.log('  (' + (k + 1) + ') ' + c + (k === item.answer ? '   ← 正解' : ''));
    });
    console.log('');
    console.log(item.explanation);
    console.log('');
    shown += 1;
  }
}
console.log('── ' + shown + ' 問を出しました（全 ' + DRILLS.length + ' 種類）');
