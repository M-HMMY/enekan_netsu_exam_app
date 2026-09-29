/**
 * 節を 1 つ描いて、画面に出る文字そのままを流す道具（一時用ではなく常備）。
 *
 * `scripts/drive.mjs` が「記法の生の記号が出ている」と言ってきたとき、
 * **どこが出ているのかは画面を見ないと分からない。**ブラウザを開かずに探せるようにする。
 *
 *   npm run dump gk-7
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from '../src/lib/markdown';
import { SECTIONS } from '../src/data/textbook';

const id = process.argv[2];
const sec = SECTIONS.find((s) => s.id === id);
if (sec === undefined) {
  console.error('そんな節はありません: ' + id);
  process.exit(1);
}

const html = renderToStaticMarkup(<Markdown source={sec.body} />);
// タグを外して、画面に出る文字だけにする
const text = html
  .replace(/<br\s*\/?>/g, '\n')
  .replace(/<\/(p|h1|h2|h3|li|tr|div)>/g, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#x27;/g, "'");

const marks = ['**', '::', '```'];
console.log('=== ' + sec.id + ' ' + sec.title + '（' + text.length + ' 字）===');
let hit = 0;
text.split('\n').forEach((line, n) => {
  for (const m of marks) {
    if (line.includes(m)) {
      console.log('  ' + String(n + 1).padStart(4) + ' 行目に「' + m + '」→ ' + line.trim().slice(0, 160));
      hit += 1;
      break;
    }
  }
});
console.log(hit === 0 ? '生の記号は出ていません' : '★ ' + hit + ' 行');
