/**
 * データの整合性チェック。`npm run check` で実行する。
 *
 * 教本・問題・ドリルは手で書き足していくため、型では防げない食い違いが必ず混ざる。
 * ここで機械的に潰しておくと、あとから「なぜか画面に出ない」を探さずに済む。
 * 新しい不整合の型を見つけたら、直すついでにこのファイルへ検査を足すこと。
 */
import { CATEGORIES, FIELDS } from '../src/data/categories';
import { SECTIONS } from '../src/data/textbook';
import { QUESTIONS } from '../src/data/questions';
import { PASSAGES } from '../src/data/questions/passages';
import { DRILLS } from '../src/data/drills';
import { isKnownCommand } from '../src/lib/mathSymbols';
import { answerIndices, isMultiAnswer, MAX_CHOICES, MIN_CHOICES } from '../src/lib/answer';
import { CHOICE_LABELS } from '../src/components/ChoiceList';
import { renderCheck } from './render-check';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const BACKSLASH = String.fromCharCode(92);
const LF = String.fromCharCode(10);

const errors: string[] = [];
const warnings: string[] = [];

const err = (m: string): void => {
  errors.push(m);
};
const warn = (m: string): void => {
  warnings.push(m);
};

/** 重複した ID を探す */
function dupes(label: string, ids: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) err(`${label}: ID が重複している → ${id}`);
    seen.add(id);
  }
}

/** 組合せ選択の記述に振る番号 */
const CIRCLED = '①②③④⑤⑥⑦⑧⑨';

/**
 * 選択肢がすべて「①」「①と③」のような組合せか。
 * 組合せの解答群は並びが決まっているので、正解の位置の偏りの検査から外す。
 */
function isComboChoices(choices: readonly string[]): boolean {
  const re = new RegExp(`^[${CIRCLED}](?:と[${CIRCLED}])*$`);
  return choices.length > 0 && choices.every((c) => re.test(c.trim()));
}

/**
 * 正解位置の偏りの集計に入れる問題か。
 *
 * - **単一選択だけ。**複数選択は 1 問で 2 つ以上の位置を埋める
 * - **組合せ選択は外す。**並びが決まっているので、正解の位置は内容で決まる（要素数の偏りは別に見る）
 * - **出典付きは外す。**原文の並びなので直せない（`Question.source` の約束）
 */
function countsForPosition(q: (typeof QUESTIONS)[number]): q is (typeof QUESTIONS)[number] & { answer: number } {
  return typeof q.answer === 'number' && !isComboChoices(q.choices) && q.source === undefined;
}

/**
 * 位置ごとの正解数・期待値・標準化残差。
 *
 * 選択肢の数が問題ごとに違う（2〜20）ので、「ならせば 20 %」では測れない。
 * 各問題で位置 i が正解になる確率は p = 1/n（n はその問題の選択肢数。i < n のときだけ）。
 * 期待値 Σp と分散 Σp(1−p) を足し、**標準化残差 z = (実数 − 期待値) / √分散** で見る。
 *
 * 以前は「期待値の 0.6〜1.5 倍」「章で期待値 2 なのに 0」で警告していたが、
 * codex のレビュー（2026 年 9 月 29 日）で、**期待値 2 の位置が 0 になるのは珍しくなく、
 * 誤警告で本当の注意が埋もれる**と指摘されて置き換えた。
 */
function positionSkew(qs: readonly ((typeof QUESTIONS)[number] & { answer: number })[]) {
  const count = new Array<number>(MAX_CHOICES).fill(0);
  const mean = new Array<number>(MAX_CHOICES).fill(0);
  const variance = new Array<number>(MAX_CHOICES).fill(0);
  for (const q of qs) {
    count[q.answer] += 1;
    const p = 1 / q.choices.length;
    for (let i = 0; i < q.choices.length; i += 1) {
      mean[i] += p;
      variance[i] += p * (1 - p);
    }
  }
  return count.map((c, i) => ({
    i,
    c,
    e: mean[i],
    z: variance[i] > 0 ? (c - mean[i]) / Math.sqrt(variance[i]) : 0,
  }));
}

const categoryIds = new Set(CATEGORIES.map((c) => c.id));
const sectionIds = new Set(SECTIONS.map((s) => s.id));

// ---- 節の並び順 ----
// **目次も「次の節へ」も、SECTIONS の並び順で決まります。**
// 節 id の番号は節の割り方（docs/section-plan.md）そのものなので、
// **並びが番号順になっていなければ、読者は学習の順序を飛ばして読まされます。**
//
// ★ **2026 年 9 月 21 日に `gm-heat` で実際に起きました。**
//   返ってきたファイルの並びが gm-14, gm-18, gm-19, gm-20, gm-16, gm-17, gm-15 で、
//   **配列の末尾に .sort() を付けて実行時に直して**ありました。
//   表示順は正しかったので**どの検査も鳴りません**でしたが、
//   ほかの 22 章は素の配列なので、**そこだけ作りが違う**状態でした。
//   .sort() を外して並べ替えたうえで、**並びそのもの**を検査に足しています。
{
  const seen = new Map<string, number>();
  for (const s2 of SECTIONS) {
    const m = /^([a-z]+)-(\d+)$/.exec(s2.id);
    if (m === null) continue;
    const prefix = m[1];
    const num = Number(m[2]);
    const last = seen.get(prefix);
    if (last !== undefined && num <= last) {
      err(
        `教本 ${s2.id}: 節の並びが番号順になっていない（前は ${prefix}-${last}）。` +
          '目次と「次の節へ」がこの順で出るので、章ファイルの配列を並べ替えること',
      );
    }
    seen.set(prefix, num);
  }
}

// ---- ID の重複 ----
dupes('分野', CATEGORIES.map((c) => c.id));
dupes('教本セクション', SECTIONS.map((s) => s.id));
dupes('確認問題', QUESTIONS.map((q) => q.id));
dupes('ドリル', DRILLS.map((d) => d.id));

// ---- 参照先の存在 ----
for (const s of SECTIONS) {
  if (!categoryIds.has(s.categoryId)) err(`教本 ${s.id}: 存在しない分野 ${s.categoryId}`);
}
for (const q of QUESTIONS) {
  if (!categoryIds.has(q.categoryId)) err(`問題 ${q.id}: 存在しない分野 ${q.categoryId}`);
  if (q.sectionId === undefined) warn(`問題 ${q.id}: sectionId が未設定（教本への復習導線が出ない）`);
  else if (!sectionIds.has(q.sectionId)) err(`問題 ${q.id}: 存在しない節 ${q.sectionId}`);
}
for (const d of DRILLS) {
  if (!categoryIds.has(d.categoryId)) err(`ドリル ${d.id}: 存在しない分野 ${d.categoryId}`);
  if (!sectionIds.has(d.sectionId)) err(`ドリル ${d.id}: 存在しない節 ${d.sectionId}`);
}

// ---- 章の大問数の合計が、課目の公表値と合っているか ----
// 受験案内の「試験課目」欄は、課目ごと・分野ごとの大問の数を書いている。
// 章の questions はそれをそのまま写したものなので、合計は課目の値と一致しなければならない。
// ずれたまま章を足すと、模試の構成比が黙って本番と違うものになる（画面にも型にも出ない）。
//
// **★ 課目Ⅳだけ、出題と解答の数が違う。**＊印の 4 分野（各 1 問題）から 2 問題を選んで解答する
// （受験案内 注 2）。章の合計は**出題の数（8）**、課目の値は**解答の数（6）**なので、
// **選ばずに済む数（2）を足して比べる。**
const UNANSWERED: Partial<Record<string, number>> = { kamoku4: 2 };
for (const f of FIELDS) {
  const sum = CATEGORIES.filter((c) => c.field === f.id).reduce((n, c) => n + c.questions, 0);
  const expect = f.questions + (UNANSWERED[f.id] ?? 0);
  if (sum !== expect) {
    err(`課目「${f.name}」: 章の大問数の合計が ${sum}。受験案内の値は ${expect}`);
  }
}

// ---- 記号とキー操作が、選択肢の上限に届いているか ----
// 記号（ア〜ト）が上限より少ないと、あふれたの選択肢に記号が付かない。
if (CHOICE_LABELS.length !== MAX_CHOICES) {
  err(`選択肢の記号が ${CHOICE_LABELS.length} 個で、上限 MAX_CHOICES（${MAX_CHOICES}）と合わない（ChoiceList.tsx）`);
}

// ---- 問題の形 ----
for (const q of QUESTIONS) {
  // **解答群は 2〜20 個。**本番（令和 6〜8 年度）の空欄ごとの解答群がこの範囲だった。
  // 五肢択一の姉妹アプリと違い、5 に揃えない（docs/public-questions.md §2）。
  if (q.choices.length < MIN_CHOICES || q.choices.length > MAX_CHOICES) {
    err(`問題 ${q.id}: 選択肢が ${q.choices.length} 個（${MIN_CHOICES}〜${MAX_CHOICES} 個であること）`);
  }
  if (new Set(q.choices).size !== q.choices.length) err(`問題 ${q.id}: 選択肢に重複がある`);
  if (q.question.trim() === '') err(`問題 ${q.id}: 問題文が空`);
  q.choices.forEach((c, i) => {
    if (c.trim() === '') err(`問題 ${q.id}: 選択肢 ${CHOICE_LABELS[i] ?? i + 1} が空`);
  });
  if (q.explanation.trim() === '') err(`問題 ${q.id}: 解説が空`);

  // ---- 正解の添字 ----
  // answer は添字ひとつを取るのが通常だが、
  // 型としては配列（複数選択）も受けられるので、どちらでも数えられるようにしてある。
  const right = answerIndices(q.answer);
  if (right.length === 0) err(`問題 ${q.id}: answer が空`);
  for (const i of right) {
    if (!Number.isInteger(i) || i < 0 || i >= q.choices.length) err(`問題 ${q.id}: answer が範囲外 ${i}`);
  }
  if (new Set(right).size !== right.length) err(`問題 ${q.id}: answer に同じ添字が 2 回ある`);
  if (right.length === q.choices.length) {
    err(`問題 ${q.id}: 選択肢が全部正解になっている（選ばない選択肢が要る）`);
  }
  if (isMultiAnswer(q.answer)) {
    if (right.length === 1) {
      // 配列で 1 つだけだと、画面には「複数選択」と出るのに実際は単一選択になる。
      err(`問題 ${q.id}: 複数選択なのに正解が 1 つしかない。単一選択なら answer を数値で書くこと`);
    }
    // **いくつ選ぶのかは画面に出さない方針。**（QuestionCard のコメントを参照）
    // 本番がそれを教えてくれる保証がないため、必要なら問題文に書く。
    // ここで書き忘れを止めないと、受験者は選び終わりが分からないまま解くことになる。
    if (!/(すべて|全て|あてはまるもの)(を)?選|[2-5]\s*つ選|(二|三|四|五)つ選/.test(q.question)) {
      err(
        `問題 ${q.id}: 複数選択なのに、問題文にいくつ選ぶかが書かれていない。` +
          '「2 つ選びなさい」などを問題文へ入れること',
      );
    }
  }
}

// ---- 大問の前置き（passage） ----
// 前置きは複数の問題で共有するので、指し先の食い違いは画面では気づけない
// （前置きが黙って表示されないだけになる）。
{
  dupes('前置き', PASSAGES.map((p) => p.id));
  const used = new Set<string>();
  for (const q of QUESTIONS) {
    if (q.passage === undefined) continue;
    used.add(q.passage);
    const p = PASSAGES.find((x) => x.id === q.passage);
    if (!p) {
      err(`問題 ${q.id}: 前置き「${q.passage}」が passages.ts に無い`);
      continue;
    }
    // 章をまたぐと、章ごとの模試で前置きの設定だけが別の課目から来ることになる
    if (p.categoryId !== q.categoryId) {
      err(`問題 ${q.id}: 前置き「${p.id}」の章（${p.categoryId}）と問題の章（${q.categoryId}）が違う`);
    }
  }
  for (const p of PASSAGES) {
    if (!categoryIds.has(p.categoryId)) err(`前置き ${p.id}: 章 ${p.categoryId} が存在しない`);
    if (p.body.trim() === '') err(`前置き ${p.id}: 本文が空`);
    if (!used.has(p.id)) warn(`前置き ${p.id}: どの問題からも使われていない`);
  }
  // 1 問しか使わない前置きは、問題文に書けば足りる。共有する意味がない
  // （存在しない ID は上でエラーにしているので、ここでは数えない。注意を重ねると本題が埋もれる）
  for (const id of used) {
    if (!PASSAGES.some((p) => p.id === id)) continue;
    const n = QUESTIONS.filter((q) => q.passage === id).length;
    if (n === 1) warn(`前置き ${id}: 使っている問題が 1 問だけ。問題文に入れれば足りる`);
  }
}

// ---- 問題が「解かなくても当てられる」形になっていないか ----
// 実際にこれで偏っていた。試験対策として見抜かれる形は、問題として弱い。
{
  const sameText = new Map<string, string[]>();
  for (const q of QUESTIONS) {
    // **前置きが違えば、同じ問い（「空気比はどれか。」）が並ぶのは正常。**
    // 本番の大問は設定を変えて同じ手順を問うので、前置きの ID を含めて比べる。
    const key = `${q.passage ?? ''}|${q.question.replace(/\s+/g, '')}`;
    sameText.set(key, [...(sameText.get(key) ?? []), q.id]);
  }
  for (const ids of sameText.values()) {
    if (ids.length > 1) err(`問題文がまったく同じ: ${ids.join(' / ')}`);
  }

  // 完全一致だけでは、数字も選択肢も同じで語だけ言い換えた重複を見逃す。
  // **この試験は、保安管理技術と学識でテーマがはっきり重なる。**
  // 材料の劣化・高圧装置・計測機器・ポンプ・漏えい防止は、令和 7 年度では
  // 両方の科目に出ていた（`docs/public-questions.md` §4）。
  // 違うのは深さ（保安管理技術＝現場での扱い／学識＝なぜそうなるか）だけなので、
  // **うっかり同じ問題を 2 つ書きやすい。**
  // 章をまたいだ重複は 1 節ずつ見ている限り気づけないため、機械に数えさせる。
  // 問題文だけで測ると「〜の説明として、最も適切なものはどれか」という定型が
  // 効いて全部が似てしまうので、選択肢も混ぜて測る。
  {
    // **組合せ選択（①、①と②…）は、選択肢を混ぜない。**7 つが全問で同じなので、
    // 混ぜると中身の違う組合せ問題どうしまで「ほぼ同じ」になる（仮データで 0.80 を確かめた）。
    const grams = (q: (typeof QUESTIONS)[number]): Set<string> => {
      const choices = isComboChoices(q.choices) ? '' : [...q.choices].sort().join('');
      const t = (q.question + choices).replace(
        /[\s。、，,．.「」『』（）()]/g,
        '',
      );
      const set = new Set<string>();
      for (let i = 0; i < t.length - 1; i += 1) set.add(t.slice(i, i + 2));
      return set;
    };
    /** 問題文と選択肢に出てくる数を、順序どおりに並べた文字列 */
    const numbers = (q: (typeof QUESTIONS)[number]): string =>
      (q.question + q.choices.join(' ')).match(/[0-9][0-9,.]*/g)?.join('/') ?? '';
    const rows = QUESTIONS.map((q) => ({ q, g: grams(q), nums: numbers(q) }));
    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < rows.length; j += 1) {
        const a = rows[i].g;
        const b = rows[j].g;
        let hit = 0;
        a.forEach((g) => {
          if (b.has(g)) hit += 1;
        });
        const sim = (2 * hit) / (a.size + b.size);
        // 同じ節の中で似るのは、対比のために対で作った問題（直列と並列、暗号化と
        // 署名）なので正常。節をまたいで似ているものが、気づかずに書いた重複。
        const sameSection =
          rows[i].q.sectionId !== undefined && rows[i].q.sectionId === rows[j].q.sectionId;
        // 同じ公式を、理論の節と演習の節で**数値だけ変えて**出すのは意図した
        // 繰返しなので重複ではない（稼働率・損益分岐点・伝送時間など）。
        // 文面が似ていても、出てくる数が違えば別の問題として扱う。
        // ★ 学識（化学）と学識（機械）は**別の試験**で、受験者はどちらか一方しか解かない。
        // だから gk- と gm- のあいだで同じ論点が出ても、重複ではない。むしろ両方に要る。
        // 重複が問題になるのは、**同じ受験者が両方を解く組合せ**だけ
        // （法令と保安管理技術は両区分共通なので、それらと学識の重なりは重複として扱う）。
        const field = (id: string): string => id.split('-')[0];
        const crossDivision =
          (field(rows[i].q.categoryId) === 'gk' && field(rows[j].q.categoryId) === 'gm') ||
          (field(rows[i].q.categoryId) === 'gm' && field(rows[j].q.categoryId) === 'gk');
        if (sim >= 0.6 && !sameSection && !crossDivision && rows[i].nums === rows[j].nums) {
          warn(
            `問題 ${rows[i].q.id} と ${rows[j].q.id} が別の節でほぼ同じ内容（類似度 ${sim.toFixed(2)}）。` +
              '片方の数値か観点を変える',
          );
        }
      }
    }
  }

  // 正解の位置の偏りは `positionSkew` で見る（対象は `countsForPosition`）
  let longest = 0;
  let absoluteInCorrect = 0;
  let absoluteInWrong = 0;
  // 「すべて」は数え方が難しい。「すべての入力に対して」のようなただの記述まで
  // 拾ってしまうので、断定を強める語だけを見る。
  // 「常に」は部分一致だと「非常に」「通常に」まで拾ってしまうので、直前の字で除く。
  // 「絶対」も、学識の「絶対温度」「絶対圧力」を拾ってしまうので除く。
  const absolute = /必ず|(?<![非通日])常に|まったく|全く|一切|絶対(?!温度)|例外なく|いかなる場合|どのような場合|どんな場合|一律|あらゆる/;
  // **全称の量化も、同じ手掛かりになる。**
  // 上の absolute から「すべて」を外してあるのは「すべての入力に対して」のような
  // ただの記述まで拾うからだが、**選択肢の中では全称そのものが言い切り**である。
  // 実際 q-pc-1 は、誤答 4 つが「すべてが」「いずれも」で、正解だけが平叙文だった。
  // absolute が 1 つも当たらないので、下の 1 問ごとの検査を素通りしていた。
  // 主語や対象を量化している形だけを見る（「すべて選べ」は設問側なのでここには来ない）。
  const universal = /すべてが|全てが|すべて[のはを、]|全て[のはを、]|いずれも|いずれの|どれも|例外なく/;
  const tell = (c: string) => absolute.test(c) || universal.test(c);
  for (const q of QUESTIONS) {
    const right = new Set(answerIndices(q.answer));
    // 空白は見た目の長さに効かないので、除いてから数える。
    const lens = q.choices.map((c) => c.replace(/\s/g, '').length);
    q.choices.forEach((c, i) => {
      if (!tell(c)) return;
      if (right.has(i)) absoluteInCorrect += 1;
      else absoluteInWrong += 1;
    });
    // 正解だけが長いと、読まずに「長いものを選ぶ」で当てられてしまう。
    //
    // **比で測ってはいけない。** 以前は「1.3 倍かつ 6 字差」で見ていたが、
    // 長い選択肢どうしだと 40 字 / 34 字が 1.18 倍にしかならず素通りする。
    // そうして漏れたものが積み上がり、このアプリでは 180 問のうち 44 問で
    // 正解が最長になっていた（選択肢の長さの分布から計算した期待値の 3.6 倍）。
    // 受験者がやるのは比の計算ではなく見比べなので、**字数の差**で見る。
    //
    // 複数選択では「正解のうちいちばん短いもの」と「誤答のうちいちばん長いもの」を
    // 比べる。正解が軒並み誤答より長ければ、やはり長い順に選ぶだけで当たるため。
    const other = Math.max(...lens.filter((_, i) => !right.has(i)));
    const mine = Math.min(...lens.filter((_, i) => right.has(i)));
    if (mine >= other * 1.25 && mine - other >= 5) longest += 1;
    if (mine - other >= 5) {
      warn(`問題 ${q.id}: 正解だけが突出して長い（正解 ${mine} 字 / 最長の誤答 ${other} 字）`);
    }

    // 言い切りが誤答にだけ出ていると、
    // 内容を知らなくても「言い切っているものを外す」だけで当てられる。
    // 全体の集計（下の absoluteInWrong）は 1 問ごとの偏りを拾えず、
    // 実際にレビューで 10 問以上この型を指摘された。
    //
    // **「3 つすべて」では緩すぎた。** 2 つ消去できれば残りは二択になり、
    // それだけで正答率が 25 % から 50 % に上がる。2 つ以上で数える。
    const wrongAbsolute = q.choices.filter((_, i) => !right.has(i)).filter(tell).length;

    // **裏返しの型もある。**「誤っているものはどれか」で、言い切りが正解肢にだけ付いていると、
    // 「言い切っているものを選ぶ」だけで当てられてしまう。正誤が逆なので、
    // 上の wrongAbsolute では拾えない。
    //
    // **「正しいものはどれか」では警告しない。**そちらで正解側に言い切りが付くのは、
    // 「正しく言い切れる場面では正解側にも使う」という下の集計の助言どおりの形で、
    // むしろ「言い切りは誤答」という当て推量を外しにいく側だから。
    const picksWrong = /誤って|誤りな|適切でない|妥当でない|該当しない|正しくない|含まれない/.test(q.question);
    if (picksWrong && wrongAbsolute === 0 && q.choices.some((c, i) => right.has(i) && tell(c))) {
      warn(
        `問題 ${q.id}: 「誤っているもの」を選ばせる問いで、言い切りが正解肢にだけある。` +
          '言い切っているものを選ぶだけで当てられるので、誤答側にも言い切りを置くか、正解肢を具体的な誤りに書き直すこと',
      );
    }

    if (wrongAbsolute >= 2 && !q.choices.some((c, i) => right.has(i) && tell(c))) {
      warn(
        `問題 ${q.id}: 誤答 ${wrongAbsolute} つに言い切りがあり、正解にはない。` +
          '言い切りを外すだけで選べてしまうので、誤答側からも言い切りを減らすこと',
      );
    }

    // 「本文で挙げられているものはどれか」は、知識ではなく直前の記載を
    // 覚えているかを問う形になっていて、教本を閉じた受験者には答えようがない。
    // 「本文」だけで見ると、文字列照合の「本文（探索される側の文字列）」まで
    // 拾ってしまう。記載を指す動詞と組になっているときだけ数える。
    if (/(本文|教本|この節)(で|に)(挙げ|述べ|示さ|説明さ|書か)/.test(q.question)) {
      warn(`問題 ${q.id}: 設問が教本の記載そのものを指している。知識を問う形にすること`);
    }
  }
  const n = QUESTIONS.length;
  if (n >= 40) {
    const target = QUESTIONS.filter(countsForPosition);
    for (const { i, c, e, z } of positionSkew(target)) {
      // |z| ≥ 3 はまず偶然では出ない。期待値 2 未満の位置（大きい解答群の後ろのほう）は揺れが大きいので見ない
      if (e < 2 || Math.abs(z) < 3) continue;
      warn(
        `正解の位置が ${CHOICE_LABELS[i]} に偏っている（${c} 問、期待値 ${e.toFixed(1)} 問、z = ${z.toFixed(1)}、` +
          `対象 ${target.length} 問）。選択肢を並べ替えて散らすこと`,
      );
    }
    if (longest / n > 0.3) {
      warn(`正解がはっきり長い問題が ${longest} / ${n} 問。誤答も同じ密度で書くこと`);
    }
    if (absoluteInWrong >= 10 && absoluteInCorrect === 0) {
      warn(
        `「必ず」「すべて」などの言い切りが誤答だけに ${absoluteInWrong} 個ある。` +
          'それ自体が手掛かりになるので、正しく言い切れる場面では正解側にも使うこと',
      );
    }
  }
}

// ---- 正解の位置の偏りを、章ごとにも見る ----
//
// **全体で平らでも、章ごとに偏っていれば意味がない。**
// このアプリの模試は**科目ごとに出題する**ので、科目のまとまりで当てられる。
//
// 実際に起きた（2026 年 9 月 13 日、別の目によるレビューで発覚）：
// 全体は 18/21/23/19/24 で平らだったのに、`prop-each` は**オが 15 問中 8 問**、
// アが 0 問だった。**「迷ったらオ」で 15 問中 8 問取れる状態。**
// 全体集計の検査は、この偏りを 1 件も警告しなかった。
{
  // 全体と同じく標準化残差で見る。上の prop-each の例（15 問中オが 8 問、期待値 3）は z ≈ 3.2 で拾える
  for (const c of CATEGORIES) {
    const target = QUESTIONS.filter((q) => q.categoryId === c.id).filter(countsForPosition);
    // 少ない章で閾値を当てると誤検出になる。10 問以上の章だけを見る。
    if (target.length < 10) continue;
    for (const { i, c: n, e, z } of positionSkew(target)) {
      if (e < 2 || Math.abs(z) < 3) continue;
      warn(
        `章「${c.name}」: 正解の位置が ${CHOICE_LABELS[i]} に ${n} 問（期待値 ${e.toFixed(1)} 問、z = ${z.toFixed(1)}、` +
          `対象 ${target.length} 問）。模試は課目ごとに出すので、章のまとまりで当てられる`,
      );
    }
  }
}

// ---- 2 択が多すぎないか ----
// **2 択は本番に実在するので禁じない**（`MIN_CHOICES` の説明）。ただし当て推量で 5 割取れるので、
// 章の中で多すぎると、その章の正答率が実力より高く出る。2 割を目安にする（codex の提案）。
for (const c of CATEGORIES) {
  const qs = QUESTIONS.filter((q) => q.categoryId === c.id);
  if (qs.length < 10) continue;
  const two = qs.filter((q) => q.choices.length === 2).length;
  if (two / qs.length > 0.2) {
    warn(
      `章「${c.name}」: 2 択が ${two} / ${qs.length} 問（${Math.round((two / qs.length) * 100)} %）。` +
        '2 割を超えると当て推量で正答率が上がる。具体例を並べて選ばせる形などに書き換えること',
    );
  }
}

// ---- 設問の形（組合せ選択）が崩れていないか ----
//
// **この試験の組合せ選択は「①〜③のうち、〜を全て挙げると [ 1 ] である」の形。**
// 令和 8 年度の課目Ⅰ問題 1（法）で 5 空欄あり、**解答群はすべて同じ 7 つを同じ順に並べていた**
// （`docs/public-questions.md` §2）。
//
//   ア ①　イ ②　ウ ③　エ ①と②　オ ①と③　カ ②と③　キ ①と②と③
//
// 記述の番号は ① から始まるとは限らない（⑤〜⑦ を並べた空欄もあった）。
// 並びは「1 つ → 2 つ → 3 つ」、同じ数の中は番号の若い順。
//
// **ここには以前、高圧ガス甲種版の「イ・ロ・ハ・ニ」の組合せ検査と、
// 「誤っているものを選べ」の形を警告する検査が入っていた。外した。**
// どちらも高圧ガスの公開問題を根拠にしていて、この試験には当てはまらない。
// 特に後者は、**この試験に「明らかに間違っているものは [1] 及び [2]」という空欄が
// 実在する**（令和 8 年度課目Ⅲ問題 9）ので、残すと本番どおりの問題を弾く。
//
// 令和 6・7 年度には、ほかの形もあった（`docs/public-questions.md` §2）。
//
// | 問い方 | 記述 | 解答群 |
// | --- | --- | --- |
// | 全て挙げると | ①〜③ | 7（上の並び） |
// | 全て挙げると | ④〜⑦ | 11（2 つ組 6 ＋ 3 つ組 4 ＋ 4 つ全部） |
// | 適切な記述を二つ挙げると | ①〜④ | 6（2 つ組だけ） |
//
// 並びの一致を求めるのは、令和 8 年度に 5 空欄すべてで揃っていた「①〜③・全て挙げる」だけ。
// ほかは形（番号の順・本文にある番号か）だけを見る。
{
  const comboSizes: { id: string; all: boolean; size: number; of: number }[] = [];
  for (const q of QUESTIONS) {
    if (q.source !== undefined) continue;
    const choices = q.choices.map((c) => c.trim());
    if (!isComboChoices(choices)) continue;

    // 本文に並べた記述の番号（行頭の「①」など）
    const stated = [...q.question.matchAll(new RegExp(`(?:^|${LF})\\s*([${CIRCLED}])`, 'g'))].map((m) => m[1]);
    const sets = choices.map((c) => c.split('と'));

    if (stated.length < 2) {
      err(`問題 ${q.id}: 選択肢は組合せ（①と②…）なのに、本文の行頭に並べた記述が ${stated.length} 個しかない`);
      continue;
    }
    const order = stated.map((s) => CIRCLED.indexOf(s));
    if (order.some((v, k) => k > 0 && v !== order[k - 1] + 1)) {
      err(`問題 ${q.id}: 本文の記述の番号が連続していない（${stated.join('・')}）`);
    }
    // 本番の組合せの問い方は 3 通りあった（令和 6〜8 年度）。
    // 「全て挙げると」「適切な記述を二つ挙げると」「下線部が正しいものを一つ挙げると」
    if (!/(全て|すべて|二つ|2 つ|一つ|1 つ)(を)?(挙げ|選)/.test(q.question)) {
      warn(
        `問題 ${q.id}: 組合せ選択なのに、いくつ挙げるのかが問いに書かれていない` +
          '（「全て挙げると」「二つ挙げると」など）',
      );
    }

    for (const [i, set] of sets.entries()) {
      for (const s of set) {
        if (!stated.includes(s)) {
          err(`問題 ${q.id}: 選択肢 ${CHOICE_LABELS[i]}「${choices[i]}」が、本文にない記述「${s}」を指している`);
        }
      }
      const idx = set.map((s) => CIRCLED.indexOf(s));
      if (idx.some((v, k) => k > 0 && v <= idx[k - 1])) {
        err(`問題 ${q.id}: 選択肢 ${CHOICE_LABELS[i]}「${choices[i]}」の番号が若い順になっていない`);
      }
    }

    // 「二つ挙げる」なら、選択肢はすべて 2 つ組で、組み方が過不足なく並ぶ（①〜④なら 6 通り）。
    // 問いだけ見て選択肢を見ないと、単独や 3 つ組が混じっても通ってしまう（codex の指摘）。
    if (/(二つ|2 つ)(を)?(挙げ|選)/.test(q.question)) {
      const bad = choices.filter((_, i) => sets[i].length !== 2);
      if (bad.length > 0) {
        err(`問題 ${q.id}: 「二つ挙げる」なのに、2 つ組でない選択肢がある（${bad.join('、')}）`);
      }
      const pairs = (stated.length * (stated.length - 1)) / 2;
      if (choices.length !== pairs) {
        warn(`問題 ${q.id}: 記述 ${stated.length} つから二つ選ぶ組み方は ${pairs} 通りだが、選択肢は ${choices.length} 個`);
      }
    }

    // 集計用：正解の組合せの要素数（全部か、いくつか）
    if (!isMultiAnswer(q.answer)) {
      const size = sets[answerIndices(q.answer)[0]]?.length ?? 0;
      comboSizes.push({ id: q.id, all: /全て|すべて/.test(q.question), size, of: stated.length });
    }

    // 「全て挙げる」で記述が 3 つ・7 択なら、本番と同じ 7 つを同じ順に並べる
    // （令和 8 年度に 5 空欄すべてで揃っていた形だけ。ほかの問い方は対象外）
    if (/全て|すべて/.test(q.question) && stated.length === 3 && choices.length === 7) {
      const [a, b, c] = stated;
      const canonical = [a, b, c, `${a}と${b}`, `${a}と${c}`, `${b}と${c}`, `${a}と${b}と${c}`];
      if (choices.join('/') !== canonical.join('/')) {
        err(
          `問題 ${q.id}: 記述 3 つの組合せは、本番と同じ 7 つをこの順に並べること → ${canonical.join('、')}` +
            `（いまは ${choices.join('、')}）`,
        );
      }
    }
  }

  // ---- 組合せの正解の偏り ----
  // 組合せは並びが決まっているので、正解位置の検査から外してある（`countsForPosition`）。
  // **外しただけだと「全部正しい」ばかり、「いつも 2 つ組」ばかりでも誰も気づかない**（codex の指摘）。
  // 「全て挙げる」の問題だけで、正解が「全部」になる割合と、要素数の偏りを見る。
  const all = comboSizes.filter((s) => s.all);
  if (all.length >= 15) {
    const everything = all.filter((s) => s.size === s.of).length;
    if (everything / all.length > 0.3) {
      warn(
        `組合せ選択: 「全て挙げる」の正解が「全部」になる問題が ${everything} / ${all.length} 問。` +
          '多いと「迷ったら全部」で当てられる',
      );
    }
    const bySize = new Map<number, number>();
    for (const s of all) bySize.set(s.size, (bySize.get(s.size) ?? 0) + 1);
    for (const [size, count] of bySize) {
      if (count / all.length > 0.6) {
        warn(`組合せ選択: 「全て挙げる」の正解が ${size} 要素の問題が ${count} / ${all.length} 問に偏っている`);
      }
    }
  }
}

// ---- 問題文が本番で読み切れる長さか ----
// **本番は空欄 1 つあたりおよそ 1.5〜2 分。**課目Ⅰは 80 分で 42 空欄、課目Ⅱは 110 分で 56 空欄、
// 課目Ⅲは 80 分で 39 空欄、課目Ⅳは 110 分でおよそ 80 空欄（令和 8 年度）。
// その中で大問の前置きを読み、計算もする。**空欄 1 つぶんの問い（`question`）は短い**のが本番の形で、
// 「①〜③から全て挙げると」の組合せだけが記述を並べて長くなる。
//
// （以前ここには高圧ガス甲種版の「1 区分 50 問 / 270 分」という根拠が書いてあった。
// 閾値は同じでよいが、根拠は別試験のものだったので書き直した。codex の指摘、2026 年 9 月 29 日）
//
// 日本語は 1 分でおよそ 400〜600 字読めるので、問い単体で 200 字を目安・300 字を上限にする。
// **出典のある問題（公開問題）は原文どおりなので、長さを直せない。検査から外す。**
for (const q of QUESTIONS) {
  if (q.source !== undefined) continue;
  const len = q.question.replace(/\s/g, '').length;
  if (len > 300) err(`問題 ${q.id}: 問題文が ${len} 字（200 字までを目安に切り詰める）`);
  else if (len > 200) warn(`問題 ${q.id}: 問題文が ${len} 字とやや長い`);
}

// ---- 大問の前置きの長さと、前置きへの正解の漏れ ----
// **前置きは、それを指す問題のたびに毎回表示される。**本番では大問の冒頭で 1 回読むだけだが、
// このアプリでは復習のたびに読み直すので、長いと負担が問題数ぶん積み上がる。
// 本番の大問の冒頭（設定と与条件）は 300〜500 字ほどだったので、600 字を目安にする。
//
// **前置きに後続の空欄の答えが書いてあると、その前置きを使う全問に答えが漏れる**（codex の指摘）。
// 前置きには「全空欄に共通する設定と与条件」だけを書く約束（`Question.passage`）。
// 正解の選択肢の文字列が前置きにそのまま出ていたら注意する。
// 短い語（「2」「水」など）は偶然一致するので、3 字以上の選択肢だけを見る。誤検出がありうるので注意どまり。
for (const p of PASSAGES) {
  const len = p.body.replace(/\s/g, '').length;
  if (len > 600) warn(`前置き ${p.id}: ${len} 字。問題のたびに表示されるので 600 字までを目安に`);
}
for (const q of QUESTIONS) {
  if (q.passage === undefined) continue;
  const body = PASSAGES.find((p) => p.id === q.passage)?.body;
  if (body === undefined) continue;
  for (const i of answerIndices(q.answer)) {
    const right = q.choices[i]?.trim() ?? '';
    if (right.replace(/\s/g, '').length >= 3 && body.includes(right)) {
      warn(`問題 ${q.id}: 正解「${right}」が前置き ${q.passage} にそのまま書かれている（答えが漏れていないか）`);
    }
  }
}

// ---- 図の題の「N つ」と、実際の数の食い違い ----
// 「2 つのアプローチ」と題した図に 3 分岐が描いてある、という食い違いが実際に出た。
// CLAUDE.md が挙げる「図の名前と中身の食い違い」の型で、読者は数を数えて覚えるので
// そのまま誤記憶になる。数える対象は図の種類で変わる。
//   compare … 左右の見出し（actors）の数
//   tree    … 最上位の数、または 1 段下がった子の数
//   その他   … 要素の数
{
  // 算用数字だけを見ていたため、「三つの要件」と書いた図（要素は 4 個）を
  // 素通りしていた。日本語の本文では漢数字のほうがむしろ普通なので両方見る。
  const KANJI: Record<string, number> = {
    一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
  };
  // **「N つ」だけでは足りなかった。**「固体の燃え方は 3 通り」と題した compare 図に
  // 4 対（8 セル）が入っていて、素通りした（2026 年 9 月 15 日、別の目によるレビューで発覚）。
  // 日本語の数え方はいくつもあるので、図の題に出そうな助数詞をまとめて見る。
  const NUM = /([0-9０-９]+|[一二三四五六七八九十])\s*(?:つ|通り|種類|段階|区分)/;
  const KEYS = new Set(['title', 'top', 'bottom', 'x', 'y', 'note', 'actors', 'caption']);
  const toNum = (t: string): number =>
    KANJI[t] ?? Number(t.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));

  for (const s of SECTIONS) {
    let type: string | null = null;
    let title: string | null = null;
    let actors = 0;
    let top = 0;
    let children = 0;

    const close = (): void => {
      if (type === null || title === null) {
        type = null;
        title = null;
        return;
      }
      const m = NUM.exec(title);
      if (m !== null) {
        const want = toNum(m[1]);
        // **compare は「左右の見出しの数」と「セル対の数」の両方を許す。**
        // 「2 つの制度」なら actors の 2、「4 通りの燃え方」なら対の数（要素 ÷ 2）を指している。
        const pairs = Math.floor(top / 2);
        const ok =
          type === 'compare'
            ? (actors === 0 && top === 0) || want === actors || want === pairs
            : type === 'tree'
              ? want === top || want === children
              : top === 0 || want === top;
        if (!ok) {
          const actual =
            type === 'compare'
              ? `左右の見出し ${actors} 個 / セルの対 ${pairs} 組`
              : `要素 ${top} 個`;
          warn(`教本 ${s.id}: 図の題「${title}」は ${want} と数えているが、${actual}`);
        }
      }
      type = null;
      title = null;
    };

    for (const raw of s.body.split(LF)) {
      const t = raw.trim();
      if (t.startsWith('```')) {
        if (type !== null) close();
        else if (t.startsWith('```diagram:')) {
          type = t.slice('```diagram:'.length);
          title = null;
          actors = 0;
          top = 0;
          children = 0;
        }
        continue;
      }
      if (type === null || t === '') continue;
      const d = /^([a-z]+):\s*(.*)$/.exec(t);
      if (d !== null && KEYS.has(d[1])) {
        if (d[1] === 'title') title = d[2];
        if (d[1] === 'actors') actors = d[2].split('|').filter((x) => x.trim() !== '').length;
        continue;
      }
      const indent = /^\s*/.exec(raw)![0].length;
      if (indent === 0) top += 1;
      else if (indent <= 2) children += 1;
    }
    close();
  }
}

// ---- 別の文字体系の混入 ----
// 日本語の文章に、ハングルやキリル文字が 1 文字だけ紛れ込むことが実際に起きた
// （「データ」の「デ」がハングルに、「短い」がキリル文字に）。
// 見た目では気づきにくく、検索にも引っかからないので機械に数えさせる。
{
  // ギリシャ文字は対象外。αβ 法・ε-greedy・β-VAE のように、
  // 日本語の技術用語の一部として正当に使われるため。
  const STRAY = /[가-힣ᄀ-ᇿЀ-ӿ]/;
  const scan = (label: string, text: string): void => {
    for (const line of text.split(LF)) {
      const m = STRAY.exec(line);
      if (m === null) continue;
      err(`${label}: 日本語以外の文字体系が混ざっている（${m[0]}）→ ${line.trim().slice(0, 50)}`);
    }
  };
  for (const s of SECTIONS) {
    scan(`教本 ${s.id}`, s.title);
    scan(`教本 ${s.id}`, s.goal);
    scan(`教本 ${s.id}`, s.body);
  }
  for (const q of QUESTIONS) {
    scan(`問題 ${q.id}`, q.question);
    scan(`問題 ${q.id}`, q.explanation);
    q.choices.forEach((c) => scan(`問題 ${q.id}`, c));
  }
}

// ---- 強調が行をまたいでいないか ----
// **強調** は markdown.tsx の inline() が 1 行ずつ処理する。
// **行をまたぐと閉じられず、`**` がそのまま画面に出る。**
// 描画自体は成立するので描画検査は通り、型でも防げない。
// 本文を折り返して書き直したときに出る型で、実際に pe-1 で出した。
for (const s of SECTIONS) {
  s.body.split(LF).forEach((line, i) => {
    const n = (line.match(/\*\*/g) ?? []).length;
    if (n % 2 === 1) {
      err(
        `教本 ${s.id}: ${i + 1} 行目で ** の数が奇数。強調は行をまたげないので ` +
          `\`**\` がそのまま出る → ${line.trim().slice(0, 50)}`,
      );
    }
  });
}

// ---- 節の骨格 ----
// 「# この節のまとめ」「> **試験のポイント**」「> **よくある勘違い**」は
// digest.ts が直前チェックシートへ機械的に抜き出す。書式を崩すと拾われないので、
// 崩れていないかではなく「そもそも在るか」をここで数える。
for (const s of SECTIONS) {
  const body = s.body;
  if (!body.includes('# ざっくり言うと')) warn(`教本 ${s.id}: 「# ざっくり言うと」がない`);
  if (!body.includes('# この節のまとめ')) warn(`教本 ${s.id}: 「# この節のまとめ」がない（チェックシートに載らない）`);
  if (!body.includes('> **試験のポイント**')) warn(`教本 ${s.id}: 「> **試験のポイント**」がない`);
  // ★ **上の includes は「1 つでもあれば通る」ので、崩れた見出しを見逃します。**
  //   `ho-33` は「> **試験のポイード**」を持ったまま、どの検査にも掛かりませんでした
  //   （2026 年 9 月 21 日。別の目でのレビューで見つけてもらった）。
  //   同じ節に正しい見出しがもう 1 本あったので、includes が真になっていたのです。
  //   **digest.ts は完全一致でしか拾わないので、崩れた 1 本は黙ってチェックシートから落ちます。**
  //   引用の中の強調（見出しではない一文）は使ってよいので、
  //   **「試験の」「よくある」で始まるのに一致しないもの**だけをエラーにしています。
  for (const line of body.split(LF)) {
    const head = /^> \*\*([^*]+)\*\*/.exec(line);
    if (head === null) continue;
    const name = head[1];
    if (name === '試験のポイント' || name === 'よくある勘違い') continue;
    if (/^試験の|^よくある/.test(name)) {
      err(`教本 ${s.id}: 引用の見出し「${name}」が崩れている（digest.ts は完全一致でしか拾わないので、チェックシートに載らない）`);
    }
  }
  // この試験は 1 問あたり 5 分 24 秒あり、速さより「数字と条件を覚えているか」で決まる。
  // 保安距離・貯蔵能力・容器再検査の期間・爆発範囲は一問一答が向くので、薄い節を数える。
  const quizzes = body.split(LF).filter((l) => l.includes('::')).length;
  if (quizzes === 0) warn(`教本 ${s.id}: quiz ブロックがない（この試験では一問一答が速度対策になる）`);
  else if (quizzes < 4) warn(`教本 ${s.id}: 一問一答が ${quizzes} 問と少ない（目安は 5 問以上）`);
  // ---- 節の厚み ----
  // **`00-common.md` は「本文は 2,500〜4,000 字が目安。短すぎる節は npm run check が
  // 警告します（800 字未満）」と書いていましたが、その検査はありませんでした**
  // （2026 年 9 月 20 日に気づいた）。プロンプトが道具について嘘をついていたことになります。
  // 実害が出ています。`ho-inst` の 5 節が 1,400〜1,900 字で返ってきて、
  // 骨格も一問一答もそろっているので、ほかのどの検査にも掛かりませんでした。
  // **甲種の保安管理技術は「高度の」です。**乙種と同じ厚さで書かれたら、それは薄いということです。
  // 800 ではなく 2,000 で切っているのは、800 字未満の節が 1 つも無く、
  // その値では何も捕まらないからです。
  if (body.length < 2000) {
    warn(`教本 ${s.id}: 本文が ${body.length} 字と薄い（目安は 2,500〜4,000 字）`);
  }
}

// ---- ドリルは実際に生成して確かめる（乱数なので複数回試す） ----
for (const d of DRILLS) {
  for (let i = 0; i < 200; i++) {
    const item = d.generate();
    // **5 択。**ドリルは数値だけで、本番の数値の空欄はほぼ 5 択だった（令和 8 年度）。
    // 確認問題（2〜20 択）とは違い、ここは 5 に揃える。
    if (item.choices.length !== 5) {
      err(`ドリル ${d.id}: 選択肢が ${item.choices.length} 個になる場合がある（5 個であること）`);
      break;
    }
    if (new Set(item.choices).size !== item.choices.length) {
      err(`ドリル ${d.id}: 選択肢が重複する場合がある → ${item.choices.join(' / ')}`);
      break;
    }
    if (item.answer < 0 || item.answer >= item.choices.length) {
      err(`ドリル ${d.id}: answer が範囲外になる場合がある`);
      break;
    }
    // **★ 意味のない誤答が混じっていないか**（2026 年 9 月 19 日に足した）。
    //
    // 「5 個ある」「重複しない」だけでは、**0 のような、見ただけで消せる誤答**を捕まえられない。
    // 実際に薄肉円筒胴の円周応力で「0 MPa」が出ていた（誤答の式が
    // `P t /(2 D)` になっていて、値が小さくなりすぎて 0 に丸められた）。
    // **ブラウザで押してみて初めて気づいた**もので、検査は素通りしていた。
    //
    // 0 が並ぶと実質 4 択になり、本番と手応えが変わる。
    // **正解が 0 になりうる問題を作るときは、ここを緩めるのではなく、
    // 誤答の作り方のほうを見直すこと。**
    const zero = item.choices.find((c) => {
      const n = Number.parseFloat(c.replace(/,/g, ''));
      return Number.isFinite(n) && n === 0;
    });
    if (zero !== undefined) {
      err(`ドリル ${d.id}: 選択肢に 0 が出る場合がある（見ただけで消せるので実質 4 択になる）→ ${item.choices.join(' / ')}`);
      break;
    }
  }
}

// ---- 本文の記法 ----
const KNOWN_DIAGRAMS = new Set(['flow', 'stack', 'tree', 'matrix', 'cycle', 'seq', 'bits', 'compare']);
/**
 * ```widget: で呼べるウィジェットの id。`src/components/widgets/*.tsx` の
 * ファイル名がそのまま id になる（Widget.tsx が同じ規則で自動登録している）。
 * 手で並べると足したときに更新し忘れるので、ディレクトリを直接読む。
 */
const KNOWN_WIDGETS = new Set(
  existsSync('src/components/widgets')
    ? readdirSync('src/components/widgets')
        .filter((f) => f.endsWith('.tsx'))
        .map((f) => f.replace(/\.tsx$/, ''))
    : [],
);
/** 本文リンクで飛べるページ（ハッシュルータの第 1 要素） */
const KNOWN_PAGES = new Set([
  'home',
  'textbook',
  'tools',
  'practice',
  'drill',
  'sheet',
  'review',
  'mock',
  'stats',
  'settings',
]);

const fence = new RegExp('^```(.*)$');

for (const s of SECTIONS) {
  const lines = s.body.split(LF);
  let open: string | null = null;
  let quizBuf: string[] = [];

  for (const line of lines) {
    const m = fence.exec(line.trim());
    if (m) {
      if (open === null) {
        open = m[1].trim();
        quizBuf = [];
        const lang = open;
        if (lang.startsWith('diagram:')) {
          const t = lang.slice('diagram:'.length);
          if (!KNOWN_DIAGRAMS.has(t)) err(`教本 ${s.id}: 未知の図の種類 ${t}`);
        }
        if (lang.startsWith('widget:')) {
          const w = lang.slice('widget:'.length);
          if (!KNOWN_WIDGETS.has(w)) err(`教本 ${s.id}: 未登録のウィジェット ${w}`);
        }
      } else {
        if (open === 'quiz') {
          if (quizBuf.length === 0) err(`教本 ${s.id}: 空の quiz ブロック`);
          for (const q of quizBuf) {
            if (!q.includes('::')) err(`教本 ${s.id}: quiz の行に :: がない → ${q.slice(0, 30)}`);
          }
        }
        open = null;
      }
      continue;
    }
    if (open === 'quiz' && line.trim() !== '') quizBuf.push(line.trim());
  }
  if (open !== null) err(`教本 ${s.id}: 閉じていないコードフェンス（${open || '言語指定なし'}）`);
}

// ---- 図の中の書式 ----
// 図は Markdown を通らないので、`**強調**` を書くとアスタリスクがそのまま出る。
// compare は「1 行 1 セル、偶数行が左・奇数行が右」なので、要素が奇数だと対にならない。
const DIRECTIVE_KEYS = new Set(['title', 'top', 'bottom', 'x', 'y', 'note', 'actors', 'caption']);
for (const s of SECTIONS) {
  let type: string | null = null;
  let items = 0;
  let noted = 0;
  for (const raw of s.body.split(LF)) {
    const t = raw.trim();
    if (t.startsWith('```')) {
      if (type !== null) {
        if (type === 'compare' && items % 2 === 1) {
          err(`教本 ${s.id}: compare の要素が奇数個なので左右が対にならない（1 行 1 セルで書く）`);
        }
        // 奇数個の検査だけでは、`左 :: 右` を全行で書いた図を捕まえられない。
        // `::` は左右の区切りではなく補足なので、この書き方をすると
        // 「左の 1 行目」「左の 2 行目」…が左右に振り分けられて意味が壊れる。
        // 要素が偶数だと素通りするうえ、系譜で 4 回起きている型なので数えておく。
        // 補足付きのセルを並べた正当な図もあるため、全要素に付いている場合だけ疑う。
        if (type === 'compare' && items >= 4 && noted === items) {
          err(
            `教本 ${s.id}: compare の全 ${items} 要素に :: が付いている。` +
              '`::` は左右の区切りではなく補足。左右の対は 1 行 1 セルで書く',
          );
        }
        // **matrix は 2 × 2 の 4 セルしか描けない。**
        // `Diagram.tsx` の Matrix は `items.slice(0, 4)` で、5 個目以降を**黙って捨てる**。
        // 3 × 2 の表を書いたところ、主題だった 2 つの操作が画面から消えていた
        // （2026 年 9 月 15 日、別の目によるレビューで発覚）。
        // 記法としては正しく、描画検査も通るので、ここで数えるしかない。
        if (type === 'matrix' && items > 4) {
          err(
            `教本 ${s.id}: matrix の要素が ${items} 個ある。` +
              'Matrix は 2 × 2 の 4 セルしか描けず、5 個目以降は黙って捨てられる。表に置き換えること',
          );
        }
        type = null;
      } else if (t.startsWith('```diagram:')) {
        type = t.slice('```diagram:'.length);
        items = 0;
        noted = 0;
      }
      continue;
    }
    if (type === null || t === '') continue;
    const m = /^([a-z]+):/.exec(t);
    if (m && DIRECTIVE_KEYS.has(m[1])) continue;
    items++;
    if (t.includes('::')) noted++;
    if (t.includes('**')) err(`教本 ${s.id}: 図の中の ** は強調にならずそのまま出る → ${t.slice(0, 40)}`);
    // seq は `A -> B :: 内容` の形。矢印がないと Diagram.tsx がラベル側を本文として出し、
    // `::` の右（補足）は画面に出ない。つまり書いた内容が黙って消える。
    // 描画自体は成立するので描画検査を素通りする。実際に 2 か所で起きた。
    if (type === 'seq' && t.includes('::') && !/->|<-/.test(t.split('::')[0])) {
      err(
        `教本 ${s.id}: seq の行に矢印（-> か <-）がないので :: の右が表示されない → ${t.slice(0, 40)}`,
      );
    }
  }
}

// ---- 本文リンクの飛び先 ----
// 飛び先が実在するかだけでは、**別の節を指してしまった**誤りを捕まえられない。
// 実際に「[誤差関数の節](textbook/i-3)」のように、ラベルと飛び先が食い違った例が出た。
// そこで、ラベルが他の節のタイトルと一致しているのに別の節を指している場合を警告する。
// **教本を並行で書かせている間は、まだ書かれていない節へのリンクが必ず出る。**
// 章を 1 ファイル 1 担当で同時に書く運用なので、他章への相互リンクは
// 「飛び先がまだ空」の状態で書かれる。これをエラーにすると、
// 全章が揃うまで npm run check が一度も通らなくなり、検査が使えなくなる。
//
// そこで、**執筆側に渡してある節 ID の一覧**（scripts/prompts/00-common.md の
// 「リンクしてよい節 ID」の表）を読み、そこに載っている id への未着の
// リンクは警告にとどめる。載っていない id は今までどおりエラー。
// 一覧を 2 か所に持たないよう、プロンプトの表をそのまま正本として読んでいる。
const plannedIds = new Set<string>();
// **予定している節の題**。まだ書かれていない節へのリンクでも、
// ラベルがその題と食い違っていないかを見るために持っておく。
//
// ★ **9 つめ（高圧ガス甲種）で実際に踏んだ型なので足しました**（2026 年 9 月 20 日）。
//   8 つめから法令の教本をそのまま引き継いだところ、**保安管理技術の節を割り直した**ので、
//   法令から張ってある 7 本のリンクが**黙って別のテーマを指すようになりました。**
//   `ho-33` は乙種では「置換の手順」、こちらの割り方では「リスクアセスメント」です。
//
//   **それまでの検査は素通りします。**ID は予定表にあるので
//   「まだ書かれていない節へのリンク」の警告になるだけで、**中身が違うことは分かりません。**
//   **本文を別のアプリから引き継ぐときに必ず起きる**ので、検査にしてあります。
const plannedTitles = new Map<string, string>();
{
  const promptPath = 'scripts/prompts/00-common.md';
  if (existsSync(promptPath)) {
    const md = readFileSync(promptPath, 'utf8');
    for (const m of md.matchAll(/^\| `([a-z]+-?\d+)` \| ([^|]*) \|/gm)) {
      plannedIds.add(m[1]);
      // 予定タイトルには `**強調**` と補足の括弧が付く。どちらも外して比べる。
      plannedTitles.set(m[1], m[2].replace(/\*\*/g, '').trim());
    }
  }
  if (plannedIds.size === 0) {
    warn('scripts/prompts/00-common.md から節 ID の一覧を読めなかった（表の書式が変わった可能性）');
  }
}

const titleToId = new Map(SECTIONS.map((s) => [s.title, s.id]));

// ★ 学識だけは、甲種化学（`gk-`）と甲種機械（`gm-`）で中身が完全に別で、
//   **読者はどちらか一方しか読みません。**相互にリンクすると、
//   受けない区分の節へ飛ばすことになります（CLAUDE.md の検証観点 4／00-common.md §6）。
//   節の id の接頭辞だけで機械的に分かるので、検査にしてあります。
const gakushikiSide = (id: string): 'gk' | 'gm' | null =>
  /^gk-\d+$/.test(id) ? 'gk' : /^gm-\d+$/.test(id) ? 'gm' : null;
const linkRe = /\[([^\]]+)\]\(([^)\s]+)\)/g;
for (const s of SECTIONS) {
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(s.body)) !== null) {
    const label = m[1].replace(/\*\*/g, '').trim();
    const to = m[2];
    const [pathPart] = to.split('?');
    const [page, param] = pathPart.split('/');
    if (!KNOWN_PAGES.has(page)) {
      err(`教本 ${s.id}: 存在しないページへのリンク ${to}`);
      continue;
    }
    if (page !== 'textbook' || param === undefined) continue;
    const fromSide = gakushikiSide(s.id);
    const toSide = gakushikiSide(param);
    if (fromSide !== null && toSide !== null && fromSide !== toSide) {
      err(
        `教本 ${s.id}: 学識の区分をまたぐリンク ${to}` +
          '（gk- は甲種化学、gm- は甲種機械。読者はどちらか一方しか読まない）',
      );
      continue;
    }
    if (!sectionIds.has(param)) {
      if (plannedIds.has(param)) {
        const planned = plannedTitles.get(param) ?? '';
        // ラベルが予定タイトルのどこにも出てこないなら、**別のテーマを指している**疑い。
        // 逆向き（予定タイトルがラベルに含まれる）も許す。章を書くときに題を縮めることがある。
        if (planned !== '' && !planned.includes(label) && !label.includes(planned)) {
          err(
            `教本 ${s.id}: リンク ${to} のラベル「${label}」が、` +
              `予定している節の題「${planned}」と食い違っています` +
              '（節を割り直したときにずれた可能性。docs/section-plan.md を見ること）',
          );
        } else {
          warn(`教本 ${s.id}: まだ書かれていない節へのリンク ${to}（その章を書けば消えます）`);
        }
      } else {
        err(`教本 ${s.id}: 存在しない節へのリンク ${to}`);
      }
      continue;
    }
    const byTitle = titleToId.get(label);
    if (byTitle !== undefined && byTitle !== param) {
      err(`教本 ${s.id}: リンクのラベル「${label}」は節 ${byTitle} のタイトルなのに ${param} を指している`);
    }
    // 節へのリンクに「〜の章」というラベルを付けると、読者は章の扉に飛べると思う。
    // 章の扉へは飛べないので、ラベルを節の話に直すか、リンクを外す。
    if (/章$/.test(label)) {
      warn(`教本 ${s.id}: リンクのラベル「${label}」が章を指しているが、飛び先は節 ${param}。章の扉へは飛べない`);
    }
  }
}

// ---- 数式のバックスラッシュ落ち ----
// TS のテンプレートリテラル／文字列の中では `\` を 2 つ重ねる必要がある。
// 忘れると `\sum` が `sum` になって画面に出てしまうので、それを検出する。
const COMMANDS = [
  'sum', 'prod', 'int', 'partial', 'nabla', 'infty', 'frac', 'sqrt',
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'eta', 'theta', 'lambda',
  'mu', 'sigma', 'tau', 'phi', 'psi', 'omega', 'Sigma', 'Delta', 'Omega',
  'times', 'cdot', 'approx', 'propto', 'hat', 'bar', 'mathbf', 'mathbb', 'mid',
  // ★ 2026 年 9 月 22 日に足しました。gm-heat で ,qquad と 3 か所、
  //   バックスラッシュが落ちたまま残っていたのを、別の目に見つけてもらいました。
  //   **この表に無い命令は、バックスラッシュが落ちても 1 つも鳴りません。**
  // exp・sin・log などは mathrm{exp} のように**添字として**書かれるので、ここには入れない
  'qquad', 'quad', 'ln', 'left', 'right',
  'rho', 'nu', 'kappa', 'pi', 'varepsilon', 'dot', 'simeq', 'leq', 'geq',
  'rightarrow', 'rightleftharpoons', 'text', 'mathrm', 'boxed',
];
const mathSpan = /\$([^$\n]+)\$/g;
const cmdRe = /\\([A-Za-z]+)/g;

/** 本文から数式の断片を集める（行内の `$...$` と ```math フェンスの中身） */
function mathPieces(text: string): string[] {
  const pieces: string[] = [];
  let m: RegExpExecArray | null;
  mathSpan.lastIndex = 0;
  while ((m = mathSpan.exec(text)) !== null) pieces.push(m[1]);
  let inMath = false;
  for (const line of text.split(LF)) {
    const t = line.trim();
    if (t.startsWith('```')) {
      inMath = t === '```math';
      continue;
    }
    if (inMath && t !== '') pieces.push(t);
  }
  return pieces;
}

const checkMath = (label: string, text: string): void => {
  for (const expr of mathPieces(text)) {
    for (const cmd of COMMANDS) {
      const at = expr.indexOf(cmd);
      if (at < 0) continue;
      if (expr[at - 1] === BACKSLASH) continue;
      // 変数名の一部（例: gamma の中の mu）を拾わないよう、前後が英字なら見送る
      const before = expr[at - 1] ?? '';
      const after = expr[at + cmd.length] ?? '';
      if (/[A-Za-z]/.test(before) || /[A-Za-z]/.test(after)) continue;
      warn(`${label}: 数式の ${cmd} にバックスラッシュがない（$ の中で ${BACKSLASH}${BACKSLASH}${cmd} と書く）→ ${expr}`);
    }
    // 表に無い命令は、記号にならずに名前がそのまま画面へ出る
    cmdRe.lastIndex = 0;
    let c: RegExpExecArray | null;
    while ((c = cmdRe.exec(expr)) !== null) {
      if (!isKnownCommand(c[1])) {
        err(`${label}: 数式に未知の命令 ${BACKSLASH}${c[1]}（記号にならず名前が表示される。src/lib/mathSymbols.ts に足すこと）→ ${expr}`);
      }
    }
  }
};
for (const s of SECTIONS) checkMath(`教本 ${s.id}`, s.body);
for (const q of QUESTIONS) {
  checkMath(`問題 ${q.id}`, q.question);
  checkMath(`問題 ${q.id}`, q.explanation);
  q.choices.forEach((c) => checkMath(`問題 ${q.id}`, c));
}

// ---- 数式の命令が、数式の外に出ていないか ----
// **このアプリのレンダラが知っている別行立ての書き方は ```math ブロックだけ**です。
// LaTeX の角かっこ・丸かっこの書き方（バックスラッシュ ＋ かっこ）で書くと、
// **TS のテンプレートリテラルがバックスラッシュを 1 つ食う**ので、
// レンダラにはただのかっことして届きます。
// **$ が無いので、上の「数式の中身」を見る検査には 1 つも掛かりません。**
// 画面には**命令の名前が地の文に並ぶ**だけになります。
//
// ★ **2026 年 9 月 21 日に gm-thermo で 36 か所、実際に起きました。**
//   そのときは目で見つけましたが、**どの検査も鳴りませんでした。**
//   数式の中とフェンスで囲った塊を外したあとに残るバックスラッシュは、
//   **本文では使い道がない**ので、残っていればエラーにします。
for (const s2 of SECTIONS) {
  let rest = s2.body.replace(/\$[^$\n]+\$/g, ' ');
  rest = rest.replace(/```[a-z]*[\s\S]*?```/g, ' ');
  for (const m of rest.matchAll(/\\[A-Za-z]+/g)) {
    err(
      `教本 ${s2.id}: 数式の命令 ${m[0]} が数式の外にあります` +
        '（別行立ての数式はフェンスで囲った math ブロックで書くこと。LaTeX の角かっこ・丸かっこの書き方は使えません）',
    );
  }
}

// ---- 解説の言う正誤と、answer が指す選択肢が一致しているか ----
//
// **この試験の設問は「イ・ロ・ハ（・ニ）のうち正しいものの組合せ」**なので、
// 解説は必ず記号ごとに正誤を述べている。**その言い分と answer がずれていないか**を見る。
//
// **★ 実際に 2 問ずれていた**（2026 年 9 月 20 日）。
// gm-device-1 と gm-device-7 は、解説が「ハは誤り」と書いているのに
// answer が「イ、ロ、ハ」を指していた。**正解したのに不正解と判定される。**
// 型でもビルドでも止まらず、問題文を読んでいるだけでも気づけない。
// 解説と選択肢を突き合わせて初めて出る。
{
  const LETTERS = 'イロハニ';
  /** 解説から、記号ごとの「正しい/誤り」を読む */
  const verdicts = (expl: string): Map<string, boolean> => {
    const v = new Map<string, boolean>();
    for (const seg of expl.split(LF)) {
      const body = seg.replace(/^[★\s]+/, '');
      // 「イ、ロ、ハはいずれも正しい」「イとロは正しい」「ハとニはいずれも誤り」
      const m = /^((?:[イロハニ](?:、|と|及び|・)?)+)は(?:いずれも)?(正しい|誤り|正しくない)/.exec(body);
      if (m) {
        const ok = m[1 + 1] === '正しい';
        for (const ch of m[1]) if (LETTERS.includes(ch)) v.set(ch, ok);
        continue;
      }
      for (const mm of body.matchAll(/(?:^|。)[★\s]*([イロハニ])(?:は|も)(正しい|誤り|正しくない)/g)) {
        v.set(mm[1], mm[2] === '正しい');
      }
    }
    return v;
  };

  for (const q of QUESTIONS) {
    // 記述が並ぶ形の設問だけを見る
    const letters = [...LETTERS].filter((l) => q.question.includes(LF + l + '．'));
    if (letters.length < 3) continue;
    if (isMultiAnswer(q.answer)) continue;
    const picked = q.choices[q.answer as number] ?? '';
    const right = new Set([...LETTERS].filter((l) => picked.includes(l)));
    const v = verdicts(q.explanation);
    for (const l of letters) {
      const said = v.get(l);
      if (said === undefined) {
        warn(`問題 ${q.id}: 解説が記述 ${l} の正誤を述べていません`);
      } else if (said !== right.has(l)) {
        err(
          `問題 ${q.id}: 解説は記述 ${l} を「${said ? '正しい' : '誤り'}」と書いているのに、` +
            `answer が指す選択肢「${picked}」と食い違っています`,
        );
      }
    }
  }
}

// ---- 法令・保安管理技術の問題に、台帳を通していない数値が無いか ----
//
// **2026 年 9 月 20 日の 2 巡目で、自分がこれを破っているのを見つけたので足した。**
// CLAUDE.md は「数値は docs/primary-numbers.md を経由させ、台帳に無い値は書かないこと」と
// 書いてあるのに、**レビューの反映で「酸素濃度 18 パーセント以上 22 パーセント以下」を
// 台帳を通さずに入れていた**（例示基準の値で、一般則には無い）。
//
// ★ 数字だけで照らし合わせてはいけない。**台帳には条番号も年月日も入っている**ので、
//   「18」はどこかに必ずある。**「数値 ＋ 単位」の組**で照らすこと。
// ★ 単位の表記ゆれを吸収すること。台帳は `MPa`、問題文は「メガパスカル」と書く。
// ★ 対象は law- と ho- の問題だけ。**学識は工学の数値なので、台帳の担当ではない**（§16）。
{
  // ★ 台帳の「書きたかったが、台帳に無いので外した値」の節は読み飛ばす。
  //   そこに「18 〜 22 パーセント」と書いてあるため、そのままだと
  //   **外したはずの値が「台帳にある」ことになり、検査が自分で自分を無効にする。**
  const ledgerRaw = existsSync('docs/primary-numbers.md')
    ? readFileSync('docs/primary-numbers.md', 'utf8')
    : '';
  //
  // ★ 「外した値」の節は 1 つとは限らない（2026 年 9 月 23 日に 2 つめができた）。
  //   見出しを決め打ちにしていたので、**新しく作った節が読み飛ばされず、
  //   外したはずの値を「台帳にある」と言うところだった。**
  //   見出しが「外した値」で終わる `###` の節は、すべて落とす。
  let ledger = ledgerRaw;
  {
    const heads = [...ledgerRaw.matchAll(/^### .*外した値.*$/gm)];
    // ★ 立ち上げたところで、台帳はまだ無い（省エネ法の台帳はこれから作る）。
    //   台帳があるのに「外した値」の節が無いときだけ鳴らす。
    if (ledgerRaw !== '' && heads.length === 0) {
      err('docs/primary-numbers.md に「外した値」の節が 1 つも無い（検査が効いていない可能性）');
    }
    // 後ろから消す。前から消すと index がずれる。
    for (const h of heads.reverse()) {
      const from = h.index ?? 0;
      const nextHead = ledgerRaw.indexOf('\n### ', from + h[0].length);
      const to = nextHead < 0 ? ledgerRaw.length : nextHead;
      ledger = ledger.slice(0, from) + ledger.slice(to);
    }
  }
  /** 表記ゆれを 1 つに寄せる */
  const UNITS: [RegExp, string][] = [
    [/^(?:メガパスカル|MPa)$/, 'MPa'],
    [/^(?:キロパスカル|kPa)$/, 'kPa'],
    [/^(?:キログラム|kg)$/, 'kg'],
    [/^(?:トン|t)$/, 't'],
    [/^(?:立方メートル|m3|m³)$/, 'm3'],
    [/^(?:デシリットル|dL)$/, 'dL'],
    [/^(?:リットル|L)$/, 'L'],
    [/^(?:センチメートル|cm)$/, 'cm'],
    [/^(?:メートル|m)$/, 'm'],
    [/^(?:パーセント|％|%)$/, 'pct'],
    [/^(?:度|℃)$/, 'deg'],
  ];
  const UNIT_RE =
    'メガパスカル|MPa|キロパスカル|kPa|キログラム|kg|トン|立方メートル|m3|m³|' +
    'デシリットル|dL|リットル|L|センチメートル|cm|メートル|m|パーセント|％|%|度|℃';
  /** 正規化したキー → 問題文に出てくる形。**注意文は読める形で出す。** */
  const pairs = (text: string): Map<string, string> => {
    const out = new Map<string, string>();
    for (const m of text.matchAll(new RegExp(`([0-9][0-9,.]*)\\s*(${UNIT_RE})`, 'g'))) {
      const num = m[1].replace(/,/g, '').replace(/\.$/, '');
      const hit = UNITS.find(([re]) => re.test(m[2]));
      out.set(`${num} ${hit ? hit[1] : m[2]}`, `${m[1]} ${m[2]}`);
    }
    return out;
  };
  const known = new Set(pairs(ledger).keys());
  // **見逃してよいもの。**理由を必ず書くこと。
  const allowed = new Set([
    '1 kg', // law-handle-1 の誤答。正しくは 10 キログラム（法 16 ③）
    '9 pct', // 「9 % ニッケル鋼」は材料の呼び名。測った値ではない
    '30 m3', // lw-43 の架空の事業所「琵琶湖東ガス充塡所」の設定値
  ]);
  for (const q of QUESTIONS) {
    if (!/^(law|ho)-/.test(q.categoryId)) continue;
    for (const [key, shown] of pairs(q.question)) {
      if (known.has(key) || allowed.has(key)) continue;
      warn(
        `問題 ${q.id}: 「${shown}」が docs/primary-numbers.md に見当たりません。` +
          `台帳に足すか、値を書かない形にすること`,
      );
    }
  }
  // **教本の側も見る。**確認問題だけ直して本文が古いまま、というのが
  // 2 巡目でいちばん多く出た型なので、両方を同じ物差しで測る。
  // 学識（`gk-` / `gm-`）は工学の数値なので、台帳の担当ではない（§16）。
  for (const sec of SECTIONS) {
    if (!/^(lw|ho)-/.test(sec.id)) continue;
    for (const [key, shown] of pairs(sec.body)) {
      if (known.has(key) || allowed.has(key)) continue;
      warn(
        `節 ${sec.id}: 「${shown}」が docs/primary-numbers.md に見当たりません。` +
          `台帳に足すか、値を書かない形にすること`,
      );
    }
  }
}

// ---- 「前記イ」が後ろの記述を指していないか ----
//
// **記述の並べ替えをすると、ここが壊れる。**
// 2026 年 9 月 20 日に、誤りの位置が「ニ」に 36 % 偏っていたのを直すため
// 127 問の記述を並べ替えたとき、law-tech-14 の イ が「前記ハの措置は」と
// **後ろの記述を指す**形になった。**「前記」なのに前にない。**
// 向きを問わない書き方（「ハに掲げる」）なら、どこにあってもよい。
{
  const LETTERS = 'イロハニ';
  for (const q of QUESTIONS) {
    const parts = q.question.split(LF);
    for (let pos = 1; pos < parts.length; pos += 1) {
      const m = /^([イロハニ])．(.*)$/s.exec(parts[pos]);
      if (!m) continue;
      const here = LETTERS.indexOf(m[1]);
      for (const ref of m[2].matchAll(/前記([イロハニ])/g)) {
        const to = LETTERS.indexOf(ref[1]);
        if (to >= here) {
          err(
            `問題 ${q.id}: 記述 ${m[1]} が「前記${ref[1]}」と書いているのに、` +
              `${ref[1]} は${to === here ? '自分自身' : 'あと'}です`,
          );
        }
      }
    }
  }
}

// ---- 実際に描いてみる ----
// 記法としては正しくても、描くと崩れている場合がある（強調の中の数式など）。
for (const p of renderCheck()) err(p);

// ---- render-check の手書きの一覧が、ファイルと合っているか ----
//
// **★ 実際に起きた（2026 年 9 月 23 日）。**
// `render-check.tsx` の `WIDGETS` が**空のまま**で、
// 「まだ 1 つも作っていない」という引き継ぎ元のコメントごと残っていた。
// **ウィジェット 7 つの描画検査が、一度も走っていなかった。**
//
// あちらは import が要るので機械では並べられない。**だから数だけ突き合わせる。**
// 足し忘れれば、ここが鳴る。
{
  const files = existsSync('src/components/widgets')
    ? readdirSync('src/components/widgets').filter((f) => f.endsWith('.tsx'))
    : [];
  const listed = existsSync('scripts/render-check.tsx')
    ? [...readFileSync('scripts/render-check.tsx', 'utf8').matchAll(/^\s*\['([a-z0-9-]+)',/gm)].map((m) => m[1])
    : [];
  for (const f of files) {
    const id = f.replace(/\.tsx$/, '');
    if (!listed.includes(id)) {
      err(
        `ウィジェット ${id} が scripts/render-check.tsx の WIDGETS に無い。` +
          '足さないと、そのウィジェットだけ描画の検査が素通りする',
      );
    }
  }
  for (const id of listed) {
    if (!files.includes(id + '.tsx')) {
      err(`scripts/render-check.tsx の WIDGETS に ${id} があるが、ファイルが無い`);
    }
  }

  // ---- 体験ツールの画面でも、全部がどれかのグループに入っているか ----
  //
  // **★ 実際に起きた（2026 年 9 月 23 日）。**
  // 新しく作った 5 つが `Tools.tsx` の `GROUPS` に無く、**「その他」へ落ちていた。**
  // **画面から消えるわけではないので、目で見ても不具合に見えない。**
  // 章立てと関係ない場所に並ぶだけなので、気づかないまま公開されうる。
  const tools = existsSync('src/pages/Tools.tsx') ? readFileSync('src/pages/Tools.tsx', 'utf8') : '';
  const grouped = new Set(
    [...tools.matchAll(/ids: \[([^\]]*)\]/g)].flatMap((m) =>
      [...m[1].matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1]),
    ),
  );
  for (const f of files) {
    const id = f.replace(/\.tsx$/, '');
    if (!grouped.has(id)) {
      err(
        `ウィジェット ${id} が src/pages/Tools.tsx の GROUPS に無い。` +
          '体験ツールの画面で「その他」へ落ちる（消えないので目では気づけない）',
      );
    }
  }
  for (const id of grouped) {
    if (!files.includes(id + '.tsx')) {
      err(`src/pages/Tools.tsx の GROUPS に ${id} があるが、ファイルが無い`);
    }
  }

  // ---- 作ったウィジェットが、教本のどこかに埋め込まれているか ----
  //
  // **★ 実際に起きた（2026 年 9 月 23 日）。**
  // 引き継いだ 7 つのうち **5 つがどこの節にも埋め込まれていなかった。**
  // 体験ツールの一覧には出るので画面上は存在するが、
  // **教本を読んでいる人の目には入らない。**置いただけで終わっていた。
  const embedded = new Set<string>();
  for (const s2 of SECTIONS) {
    for (const m of s2.body.matchAll(/widget:([a-z0-9-]+)/g)) embedded.add(m[1]);
  }
  for (const f of files) {
    const id = f.replace(/\.tsx$/, '');
    if (!embedded.has(id)) {
      warn(`ウィジェット ${id} が、教本のどの節にも埋め込まれていない（置いただけになっている）`);
    }
  }
}

// ---- ★ 確認問題の sectionId が、その内容を扱っている節を指しているか ----
//
// **★★ 実際に 9 問ずれていた**（2026 年 9 月 23 日）。
// `law-ope` は 12 問中 6 問で、**「貯槽への 90 % 充塡」が「修理・清掃」の節を
// 指している**という状態だった。`law-vessel-6` は超低温容器の定義を問うのに
// **「容器検査と刻印」**を指していた。
//
// **これまでの検査は、sectionId が実在するかしか見ていなかった。**
// 実在はするので鳴らない。**画面上も「復習する」が別の節へ飛ぶだけで、壊れて見えない。**
//
// 問題文の特徴語を、どの節がいちばん多く持っているかで測る。
// **節をまたぐ問は普通にあるので、差が大きいものだけ注意にする。**
//
// **★ 法令（`lw-`）の問だけを見る。**
// 法令の節は条文のまとまりで切ってあるので、1 つの問は 1 つの節に属する。
// **学識は節どうしが語彙を共有する**ので、同じ測り方をすると誤検知になる
// （`gk-26` の分解爆発の問が `gk-16` の燃焼の反応式に、
// `gm-32` の水素侵食の問が `gm-29` の高温材料に引かれた。どちらも今のままが正しい）。
// **見つかった 9 件のうち 7 件が法令だったので、法令だけで十分に効く。**
{
  // どこにでも出る語は特徴語にしない。
  const STOP = new Set([
    '記述', '正しい', 'どれか', 'もの', 'こと', 'ための', 'ときは', 'について',
    '場合', '高圧ガス', '容器', '製造', '設備', '施設', '規則', '規定', '技術',
    '基準', '必要', '措置', '適用', '対象', '以上', '以下', '未満', '次の',
  ]);
  const terms = (s: string): string[] => {
    const out = new Set<string>();
    for (const m of s.matchAll(/[一-龥]{2,}|[ァ-ヴー]{3,}/g)) {
      if (!STOP.has(m[0])) out.add(m[0]);
    }
    return [...out];
  };

  for (const q of QUESTIONS) {
    if (q.sectionId === undefined || !q.sectionId.startsWith('lw-')) continue;
    const ts = terms(q.question);
    if (ts.length < 4) continue;
    const score = (body: string): number => ts.filter((t) => body.includes(t)).length;
    const mine = score(SECTIONS.find((s) => s.id === q.sectionId)?.body ?? '');
    let best = { id: q.sectionId, n: mine };
    for (const s of SECTIONS) {
      // 同じ科目の節とだけ比べる（法令の問を学識の節と比べても意味がない）
      if (s.id[0] !== q.sectionId[0]) continue;
      const n = score(s.body);
      if (n > best.n) best = { id: s.id, n };
    }
    if (best.id !== q.sectionId && best.n >= mine + 4) {
      warn(
        `問題 ${q.id}: sectionId が ${q.sectionId}（特徴語 ${mine}/${ts.length}）だが、` +
          `${best.id}（${best.n}/${ts.length}）のほうが当てはまる`,
      );
    }
  }
}

// ---- ★ 模試が本番の問題の形ではないと、画面に書いているか ----
//
// 高圧ガス甲種版では「学識は記述式」と画面に書き続けることを検査していた。
// **この試験では「本番は大問の中に空欄が並ぶ形で、この模試とは違う」**がそれに当たる。
// **コメントを剥いでから見る。**コメントに書いてあっても画面には出ない。
{
  const strip = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const mockPath = 'src/pages/Mock.tsx';
  if (existsSync(mockPath)) {
    const shown = strip(readFileSync(mockPath, 'utf8'));
    if (!shown.includes('本番の問題の形ではありません')) {
      err(
        `${mockPath} の画面に「本番の問題の形ではありません」の断りが無い。` +
          '本番は大問の中に空欄が並ぶ形で、この模試とは違う。書かないと、アプリが試験の形について嘘をつく',
      );
    }
  }
}

// ---- 集計して表示 ----
const sectionsPerCategory = new Map<string, number>();
for (const s of SECTIONS) sectionsPerCategory.set(s.categoryId, (sectionsPerCategory.get(s.categoryId) ?? 0) + 1);
const emptyChapters = CATEGORIES.filter((c) => !sectionsPerCategory.has(c.id));

const chars = SECTIONS.reduce((n, s) => n + s.body.length, 0);
const linked = QUESTIONS.filter((q) => q.sectionId !== undefined).length;

console.log('--- 収録状況 ---');
console.log(`教本      : ${SECTIONS.length} 節 / ${chars.toLocaleString()} 字（未着手の章 ${emptyChapters.length}）`);
console.log(`確認問題  : ${QUESTIONS.length} 問（節にひも付き ${linked} 問）`);
console.log(`計算ドリル: ${DRILLS.length} 種類`);
if (emptyChapters.length > 0) {
  console.log(`未着手の章: ${emptyChapters.map((c) => c.name).join('、')}`);
}

console.log('');
if (warnings.length > 0) {
  console.log(`--- 注意 ${warnings.length} 件 ---`);
  warnings.forEach((w) => console.log('  ' + w));
  console.log('');
}

// ---- 最後に、読み飛ばされやすい注意をもう一度出す ----
//
// **実際に起きた（2026 年 9 月 22 日）。**
// 正解の位置が 225 問中 161 問で 4 番目、学識は 60 問中 59 問が 3 要素の組、
// という状態を、この検査は**最初から警告していた。**
// それでも 72 問を書き終えるまで気づかなかった。理由は 2 つある。
//
// 1. **注意が 100 件を超えていた。**大半は「問題文がやや長い」「本文が薄い」で、
//    本当に見るべき 40 件がその中に埋もれた
// 2. **最後の行が「整合性チェック: エラーなし」だけだった。**
//    出力の末尾を読むと、注意を 1 件も見ないまま「通った」と判断できてしまう
//
// だから、**長さの注意（見て判断すればよいもの）と、それ以外（直すべきもの）を分け、
// 最後の行に件数を必ず載せる。**
const isLengthNote = (w: string): boolean =>
  /問題文が \d+ 字/.test(w) || /本文が \d+ 字/.test(w) || /解説が \d+ 字/.test(w);
const sharp = warnings.filter((w) => !isLengthNote(w));
if (sharp.length > 0) {
  console.log(`--- ★ このうち、長さ以外の注意が ${sharp.length} 件 ---`);
  sharp.forEach((w) => console.log('  ' + w));
  console.log('');
}

const tail = warnings.length === 0 ? '' : `（注意 ${warnings.length} 件、うち長さ以外 ${sharp.length} 件）`;
if (errors.length === 0) {
  console.log('整合性チェック: エラーなし' + tail);
} else {
  console.log(`--- エラー ${errors.length} 件 ---`);
  errors.forEach((e) => console.log('  ' + e));
  console.log('');
  console.log(`整合性チェック: エラー ${errors.length} 件` + tail);
  process.exit(1);
}
