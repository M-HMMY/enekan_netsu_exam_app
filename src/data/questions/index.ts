import type { Question } from '../../types';

/**
 * 確認問題。**まだ 1 問もありません**（立ち上げたところ）。
 *
 * **★★ 書き始める前に、問題の形を決めること**（CLAUDE.md「まだ決めていないこと」）。
 * エネルギー管理士試験はマークシート方式だが、**大問の中に空欄が並び、
 * 空欄ごとに語群や数値を塗る形**で、姉妹アプリの五肢択一とは作りが違う。
 *
 * 章ごとにファイルを分けて、ここで束ねる（1 章 1 ファイル。並行して書かせるため）。
 */
export const QUESTIONS: Question[] = [];

export const questionById = (id: string): Question | undefined => QUESTIONS.find((q) => q.id === id);

export const questionsOfCategory = (categoryId: string): Question[] =>
  QUESTIONS.filter((q) => q.categoryId === categoryId);

export const questionsOfSection = (sectionId: string): Question[] =>
  QUESTIONS.filter((q) => q.sectionId === sectionId);
