import type { TextbookSection } from '../../types';
import { intro } from './intro';

/**
 * 教本の全節。**章ごとにファイルを分けて、ここで束ねる**（1 章 1 ファイル。並行して書かせるため）。
 *
 * **まだ入門編の枠しかありません**（立ち上げたところ）。
 * 章は `src/data/categories.ts` の `CATEGORIES`（受験案内の出題分野そのまま）。
 */
export const SECTIONS: TextbookSection[] = [...intro];

export const sectionById = (id: string): TextbookSection | undefined => SECTIONS.find((s) => s.id === id);

export const sectionsOfCategory = (categoryId: string): TextbookSection[] =>
  SECTIONS.filter((s) => s.categoryId === categoryId);

/** 教本全体の目安学習時間（分）。ホームと目次に出す */
export const totalMinutes = SECTIONS.reduce((sum, s) => sum + s.minutes, 0);
