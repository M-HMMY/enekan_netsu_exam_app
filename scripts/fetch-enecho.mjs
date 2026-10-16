// 資源エネルギー庁のサイトから、告示・白書・エネルギー動向・エネルギー基本計画の PDF を取る。
//
// なぜこれが要るか：資源エネルギー庁（enecho.meti.go.jp）と経済産業省のサイトは AWS WAF の
// JavaScript の確認画面を挟んでいて、curl では 403 か 202（確認画面）しか返らない。
// 2026 年 9 月 30 日に台帳を作ったときはここで止まり、告示と白書の数値を入れられなかった。
// **JavaScript を動かす本物のブラウザなら通る**ので、drive.mjs と同じく Windows の Edge を
// ヘッドレスで起こし、DevTools Protocol で操作する（Playwright は入れない。ランタイム依存は React だけ）。
//
// **★ 名乗り（User-Agent）を普通の Edge にすること。**ヘッドレスの既定の名乗り（HeadlessChrome）のままだと、
// 確認画面は通るのに、どのページも「お探しのページが見つかりません」が返る（2026 年 10 月 17 日に実測）。
//
// 使い方（取った原本は sources/ に置く。.gitignore 済みで公開しない。台帳 docs/primary-numbers.md の出どころ）：
//   node scripts/fetch-enecho.mjs page <ページの URL>                     … タイトルとリンクの一覧（JSON）
//   node scripts/fetch-enecho.mjs pdf <ページの URL> <PDF の URL> <保存先>  … そのページの文脈で PDF を取る
// 取ったら `pdftotext -enc UTF-8 -layout x.pdf x.txt` で文字に起こす（Git for Windows の mingw64 に入っている）。
// 公開されている資料を数本、人が開くのと同じ間隔で取るためのもの。続けて取るときは間を空けること。

import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [mode, url, pdfUrl, out] = process.argv.slice(2);

const edge = spawn(
  EDGE,
  ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
   `--user-data-dir=${mkdtempSync(join(tmpdir(), 'fe-'))}`, '--no-first-run', 'about:blank'],
  { stdio: 'ignore' },
);
let wsUrl;
for (let i = 0; i < 40 && !wsUrl; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
  } catch {}
  if (!wsUrl) await sleep(250);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const waiting = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
};
const send = (method, params = {}) => {
  const n = ++id;
  ws.send(JSON.stringify({ id: n, method, params }));
  return new Promise((r) => waiting.set(n, r));
};
const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send('Page.enable');
// ヘッドレスの既定の名乗り（HeadlessChrome）だと、別のページを返すサイトがある
await send('Network.setUserAgentOverride', {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  acceptLanguage: 'ja',
});
await send('Page.navigate', { url });
// 確認画面は JavaScript で解いてから本来のページへ移る。タイトルが入るまで待つ
let title = '';
for (let i = 0; i < 40; i++) {
  await sleep(500);
  title = await evaluate('document.title');
  if (title) break;
}
await sleep(1000);
if (mode === 'page') {
  const info = await evaluate(`JSON.stringify({
    title: document.title,
    url: location.href,
    links: [...document.querySelectorAll('a')].map((a) => [a.innerText.trim().replace(/\\s+/g, ' ').slice(0, 70), a.href]).filter(([t, h]) => t && h),
  })`);
  console.log(info);
} else {
  const b64 = await evaluate(`(async () => {
    const r = await fetch(${JSON.stringify(pdfUrl)});
    if (!r.ok) return 'HTTP ' + r.status;
    const buf = new Uint8Array(await r.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  })()`);
  if (typeof b64 !== 'string' || b64.startsWith('HTTP')) console.log('失敗', title, b64);
  else { writeFileSync(out, Buffer.from(b64, 'base64')); console.log('保存', out, Buffer.from(b64, 'base64').length, 'bytes'); }
}
ws.close();
edge.kill();
process.exit(0);
