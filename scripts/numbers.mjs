// 台帳を通していない数値が、地の文に入り込んでいないかを探す。
//
//   node scripts/numbers.mjs          # 教本・確認問題・ドリル・ウィジェット（**法令は除く**）
//   node scripts/numbers.mjs gm-      # ファイル名が gm- で始まるものだけ
//   node scripts/numbers.mjs law      # ★ 法令も見る（台帳 §1〜§15 と突き合わせるとき）
//
// **既定では法令（`law-*` と `lw-*`）を外しています。**
// 法令の数値は台帳の §1〜§15 が持っていて、条文から引き直す仕事は別です。
// 混ぜると 340 行を超えて、探している工学の数値が埋もれます。
//
// **これは `npm run check` には入れていません。**誤検知が多く、エラーにすると邪魔になります。
// `echoes.mjs` `terms.mjs` と同じ「人が眺めて拾う道具」です。
//
// ★ 何を探しているか
// docs/primary-numbers.md §16 の「教本の本文が、台帳を経由せずに置いている工学の数値」。
// **例題で問題文が値を与えるのは正しい書き方**なので、そう読める行は落としています。
// 残るのは「地の文が値を断定している行」で、そこだけ人が読めば済みます。
//
// ★ 落ちる行（正しい書き方なので出しません）
//   - 「〜とする」「与えられた」「問題文」「求めよ」などを含む行 …… 例題
//   - 「1 mol 当たり」「1 kg 当たり」 …… 基準量であって物性値ではない
//
// ★ 出たものの読み方（docs/primary-numbers.md §16 の決めごと）
//   - 定義値（273.15、101.325、SI 接頭語、気体定数）…… そのまま置いてよい
//   - 目安（レイノルズ数の 2,300 と 4,000、薄肉の t/r）…… **目安と読めるように書く**
//   - 物性値（沸点、爆発範囲、比重、許容濃度、燃焼熱）…… **台帳に無いなら書かない**
//   - 法令の数値 …… 台帳の §1〜§15 にあるはず。無ければ先に台帳へ足す
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const arg = process.argv[2] ?? '';
const withLaw = arg === 'law';
const filter = withLaw ? '' : arg;

/** 法令のファイルか。既定では外す（台帳 §1〜§15 の範囲）。 */
const isLaw = (name) => name.startsWith('law');

// 単位。数式の中の \mathrm{...} でも拾えるようにしている。
const UNITS = [
  '℃', 'K', 'MPa', 'kPa', 'GPa', 'Pa', 'MJ', 'kJ', 'kW', 'W',
  'mm', 'cm', 'km', 'm', 'kg', 'mol', 'L', '%', 'パーセント', '度',
];
const NUM = '[0-9][0-9,.]*';
const RE = new RegExp(
  '(?:' +
    NUM +
    ')\\s*(?:\\\\,|\\\\ |~|\\s)*(?:\\\\mathrm\\{)?(?:' +
    UNITS.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') +
    ')',
  'g'
);

// 値が「与えられた」ことを示す言い回し。これがあれば例題なので落とす。
const GIVEN = /とする|とします|与え|求め[よるな]|いくらか|問題文|例題|として扱|優先/;
// 基準量。物性値ではない。
const BASIS = /1\s*mol\s*(当たり|あたり)|1\s*kg\s*(当たり|あたり)/;

/** 1 ファイルを走査して、拾った行を返す。 */
function scan(path, idOf) {
  const out = [];
  let id = '(不明)';
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = idOf.exec(line);
    if (m) {
      id = m[1];
      continue;
    }
    const found = [...line.matchAll(RE)].map((x) => x[0].replace(/\s+/g, ''));
    if (found.length === 0) continue;
    if (GIVEN.test(line) || BASIS.test(line)) continue;
    out.push({ id, hits: [...new Set(found)].join(' '), line: line.trim() });
  }
  return out;
}

const groups = [];

// 教本
{
  const dir = 'src/data/textbook';
  const rows = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.ts') || name === 'index.ts') continue;
    if (filter && !name.startsWith(filter)) continue;
    if (!withLaw && isLaw(name)) continue;
    rows.push(...scan(join(dir, name), /^\s*id: '([a-z]+-?[0-9]+)',/));
  }
  groups.push(['教本', rows]);
}

// 確認問題
if (!filter) {
  const dir = 'src/data/questions';
  const rows = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.ts') || name === 'index.ts') continue;
    if (!withLaw && isLaw(name)) continue;
    rows.push(...scan(join(dir, name), /^\s*id: '([a-z-]+[0-9]+)',/));
  }
  groups.push(['確認問題', rows]);
}

// ドリル
if (!filter && existsSync('src/data/drills.ts')) {
  groups.push(['計算ドリル', scan('src/data/drills.ts', /^\s*id: '([a-z-]+)',/)]);
}

// 体験ウィジェット
if (!filter) {
  const dir = 'src/components/widgets';
  const rows = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.tsx')) continue;
    for (const r of scan(join(dir, name), /^$/)) {
      rows.push({ ...r, id: name.replace(/\.tsx$/, '') });
    }
  }
  groups.push(['体験ウィジェット', rows]);
}

let total = 0;
for (const [label, rows] of groups) {
  total += rows.length;
  console.log('\n########## ' + label + '（' + rows.length + ' 行） ##########');
  let last = '';
  for (const r of rows) {
    if (r.id !== last) {
      console.log('\n===== ' + r.id + ' =====');
      last = r.id;
    }
    console.log('  {' + r.hits + '}  ' + r.line.slice(0, 200));
  }
}

console.log('\n合わせて ' + total + ' 行。**これは誤検知を含みます。**');
console.log('定義値と目安は残してよい行です。docs/primary-numbers.md §16 と突き合わせてください。');
if (!withLaw) {
  console.log('法令（law-*）は外してあります。見るなら `node scripts/numbers.mjs law`。');
}
