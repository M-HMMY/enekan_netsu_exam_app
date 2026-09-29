import type { Passage } from '../../types';

/**
 * 大問の前置き。確認問題が `passage: 'id'` で指す。
 *
 * **まだ 1 つもありません**（確認問題が 0 問のため）。
 *
 * 本番の大問は、1 つの設定に空欄が十数個ぶら下がる（`docs/public-questions.md` §2）。
 * その設定をここに 1 回だけ書く。**前の空欄の答えは前置きに書かず、問題文の側で与える**
 * （復習キューは問題をばらばらの順で出すので、前の問題を解いた前提にできない）。
 *
 * **公開問題の設定を写さないこと。**燃料の組成も、サイクルの温度も、事業者の事例も自前で作る。
 */
export const PASSAGES: Passage[] = [];

export const passageById = (id: string): Passage | undefined => PASSAGES.find((p) => p.id === id);
