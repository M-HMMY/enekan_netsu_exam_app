import type { Question } from '../types';

/**
 * 解答群の数の下限と上限。
 *
 * 本番の解答群は 3 個から、**複数の空欄で共有する語群では 20 個（ア〜ト）まで**あった
 * （令和 6 年度課目Ⅱ問題 5。`docs/public-questions.md` §2）。
 * 令和 8 年度だけを見て上限を 8 にしていたが、令和 6・7 年度に 11 個・20 個が実在したので上げた。
 * **実際の試験を弾く検査は、検査のほうが間違っている。**
 *
 * 記号（`CHOICE_LABELS`）はこの上限に合わせてある。数字キーで選べるのは 1〜9 まで。
 *
 * **下限は 2。**本番に 2 択（「可逆／不可逆」「大きい／小さい」）が実在する。
 * 当て推量で 5 割取れるので一度は 3 にしたが、別の目（codex）のレビューで
 * 「実在する形を型で禁じるのは、実際の試験を弾く検査と同じ誤り」と指摘されて 2 に戻した（2026 年 9 月 29 日）。
 * 代わりに `check.ts` が、章の中で 2 択が 2 割を超えたら注意を出す。
 */
export const MIN_CHOICES = 2;
export const MAX_CHOICES = 20;

/** 数字キーで選べる選択肢の数の上限。10 個目以降はクリックで選ぶ */
export const MAX_KEY_CHOICES = 9;

/**
 * 正解の扱いを 1 か所にまとめる。
 *
 * `Question.answer` は「添字ひとつ」または「添字の配列」の
 * どちらかを取る。比較のたびに場合分けを書くと採点の実装が
 * 画面ごとにずれていくので、読むのも比べるのもここを通す。
 *
 * **選択の状態は、単一選択でも配列で持つ。**`number | null` と
 * `number[]` を画面ごとに使い分けると、未選択の表し方が
 * `null` と `[]` の 2 通りになって必ず取りこぼす。空配列が未選択。
 */

/** 正解の添字を、単一選択・複数選択のどちらでも昇順の配列で返す */
export function answerIndices(answer: Question['answer']): number[] {
  return typeof answer === 'number' ? [answer] : [...answer].sort((a, b) => a - b);
}

/** 複数選択の問題か */
export function isMultiAnswer(answer: Question['answer']): boolean {
  return typeof answer !== 'number';
}

/**
 * 解答が正解かどうか。
 *
 * **複数選択は完全一致だけを正解とする。**
 * 本番では「順不同の 2 空欄」に当たり、空欄ごとに採点される。このアプリで 1 問にまとめたときの
 * 部分点の規則は公表されていないので、決めるとしたらそれはこちらの創作になる。分からないことを勝手に決めない方針
 * （合否を判定しないのと同じ理由）に合わせて、全部合って正解とする。
 */
export function isCorrectAnswer(answer: Question['answer'], selected: readonly number[]): boolean {
  const want = answerIndices(answer);
  if (selected.length !== want.length) return false;
  const got = new Set(selected);
  return want.every((i) => got.has(i));
}

/**
 * 選択肢を押したときの次の選択状態を返す。
 *
 * 単一選択は置き換え（押し直しで変更できる）。
 * 複数選択はトグル（押すたびに入り切りする）。
 */
export function toggleChoice(
  answer: Question['answer'],
  selected: readonly number[],
  index: number,
): number[] {
  if (!isMultiAnswer(answer)) return [index];
  return selected.includes(index)
    ? selected.filter((i) => i !== index)
    : [...selected, index].sort((a, b) => a - b);
}
