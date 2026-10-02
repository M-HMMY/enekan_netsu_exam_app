import type { TextbookSection } from '../../types';
import { intro } from './intro';
import { k2Gas } from './k2-gas';
import { k2Vapor } from './k2-vapor';
import { k2Fluid } from './k2-fluid';
import { k2Heat } from './k2-heat';

/**
 * 教本の全節。**章ごとにファイルを分けて、ここで束ねる**（1 章 1 ファイル。並行して書かせるため）。
 *
 * いまは入門編と課目Ⅱの 4 章（2026 年 10 月 2 日）。残りの章は書いたらここへ足す。
 * 章は `src/data/categories.ts` の `CATEGORIES`（受験案内の出題分野そのまま）。
 */
export const SECTIONS: TextbookSection[] = [...intro, ...k2Gas, ...k2Vapor, ...k2Fluid, ...k2Heat];

export const sectionById = (id: string): TextbookSection | undefined => SECTIONS.find((s) => s.id === id);

export const sectionsOfCategory = (categoryId: string): TextbookSection[] =>
  SECTIONS.filter((s) => s.categoryId === categoryId);

/** 教本全体の目安学習時間（分）。ホームと目次に出す */
export const totalMinutes = SECTIONS.reduce((sum, s) => sum + s.minutes, 0);
