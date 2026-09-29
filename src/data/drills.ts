/**
 * 計算ドリル：出題のたびに数値が変わる自動生成問題。
 *
 * 計算問題は同じ問題文を暗記してしまうと本番で崩れるため、
 * 値を振り直して「手順」だけが身に付くようにしている。
 * 生成した問題は復習カード（SRS）には登録しない（同じ問題が二度と現れないため）。
 *
 * **★ この試験は計算が多い。**課目Ⅱ（熱力学・流体・伝熱）と課目Ⅲ（燃焼計算）は
 * 大問の中で値を出させる。**どの単元に何問出るかは、公開問題を分析してから決めること。**
 *
 * **物性値をこちらで決め打ちしない。**問題文の中で与えること。
 * **ドリルは手順の練習なので、値は与えてよい。**
 *
 * 手順で必ず解けるものに絞ること。有効数字や単位の扱いで割れる問題は、
 * 自動生成すると答えが一意にならない。
 *
 * **★ 書いたら `npm run drills` で目を通すこと。**
 * `npm run check` は 1 種類につき 200 回生成しますが、見ているのは
 * 「5 択か」「重複しないか」「0 が混じらないか」だけです。
 * **日本語として読めるか、選択肢が紛らわしすぎないかは人が読むしかありません。**
 */

export interface DrillItem {
  question: string;
  choices: string[];
  answer: number;
  /** 計算手順の解説 */
  explanation: string;
}

export interface Drill {
  id: string;
  name: string;
  categoryId: string;
  sectionId: string;
  summary: string;
  generate: () => DrillItem;
}

// ---------------------------------------------------------------- 補助関数

const rnd = (min: number, max: number): number => min + Math.floor(Math.random() * (max - min + 1));

/** 選択肢や条件をランダムに 1 つ選ぶ。新しいドリルを書くときに使う */
export function pick<T>(items: readonly T[]): T {
  return items[rnd(0, items.length - 1)];
}

/** 小数を読みやすく整える（末尾の 0 を落とす）。新しいドリルを書くときに使う */
export function fx(n: number, digits = 2): string {
  return Number(n.toFixed(digits)).toString();
}

/**
 * 正解と誤答候補から 5 択を作る。重複は除き、足りなければ補充関数で埋める。
 *
 * **5 択なのは、本番の数値の空欄がほぼ 5 択だから**（令和 8 年度。`docs/public-questions.md` §2）。
 * 確認問題は空欄によって 2〜20 択だが、ドリルは数値だけなので 5 に揃える。
 * 本番と選択肢の数が違うと、消去法の手応えが変わってしまう。
 */
function build(
  correct: string,
  wrongs: string[],
  fallback?: (i: number) => string,
): { choices: string[]; answer: number } {
  const pool: string[] = [];
  for (const w of wrongs) {
    if (w !== correct && !pool.includes(w)) pool.push(w);
    if (pool.length === 4) break;
  }
  for (let i = 1; pool.length < 4 && i < 80; i++) {
    const extra = fallback ? fallback(i) : String(i);
    if (extra !== correct && !pool.includes(extra)) pool.push(extra);
  }
  const all = [correct, ...pool];
  for (let j = all.length - 1; j > 0; j--) {
    const k = rnd(0, j);
    [all[j], all[k]] = [all[k], all[j]];
  }
  return { choices: all, answer: all.indexOf(correct) };
}

/**
 * 数値の 5 択。ありがちな誤答を先に使い、足りない分は倍率でずらして作る。
 * 正解が 0 や負になりうる問題では倍率では埋まらないので、build に自前の
 * 補充関数を渡すこと（npm run check が「選択肢が 2 個になる」で捕まえる）。
 */
export function buildNumeric(
  correct: number,
  fmt: (n: number) => string,
  mistakes: number[],
): { choices: string[]; answer: number } {
  const wrongs = mistakes.filter((n) => Number.isFinite(n) && n >= 0).map(fmt);
  const factors = [2, 0.5, 1.5, 0.8, 1.25, 3, 0.25, 1.1, 0.9, 1.4, 0.6];
  let fi = 0;
  return build(fmt(correct), wrongs, () => fmt(correct * factors[fi++ % factors.length]));
}

/**
 * 計算ドリル。**まだ 1 種類もありません**（立ち上げたところ）。
 *
 * **★ 高圧ガス甲種版（`kouatsugas_kou_exam_app`）に、そのまま使えそうなものがあります。**
 * 熱力学（等温圧縮の仕事・可逆断熱変化・マイヤーの関係）、流体（連続の式・レイノルズ数・
 * 圧力損失・トリチェリ）、伝熱（総括伝熱係数・対数平均温度差・伝熱管の長さ）、
 * 燃焼（理論空気量・ヘスの法則）。**章 ID と節 ID を付け替えれば戻せます。**
 * 向こうも 5 択なので、形はそのまま使える。**ただし本番の数値の選択肢は小さい順に並んでいる**
 * （令和 8 年度）。持ってくるときに、並べ替えを揃えるかを決めること。
 */
export const DRILLS: Drill[] = [];
