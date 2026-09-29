import type { Question } from '../../types';

/**
 * 確認問題。**まだ 1 問もありません**（立ち上げたところ）。
 *
 * **1 問 ＝ 本番の空欄 1 つぶん**（CLAUDE.md「確認問題の形」、2026 年 9 月 29 日に決定）。
 * 選択肢は空欄ごとに 3〜8 個で、5 に揃えない。大問の設定は `passages.ts` に書いて `passage` で指す。
 *
 * 章ごとにファイルを分けて、ここで束ねる（1 章 1 ファイル。並行して書かせるため）。
 */
export const QUESTIONS: Question[] = [];

export const questionById = (id: string): Question | undefined => QUESTIONS.find((q) => q.id === id);

export const questionsOfCategory = (categoryId: string): Question[] =>
  QUESTIONS.filter((q) => q.categoryId === categoryId);

export const questionsOfSection = (sectionId: string): Question[] =>
  QUESTIONS.filter((q) => q.sectionId === sectionId);
