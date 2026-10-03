import type { TextbookSection } from '../../types';
import { intro } from './intro';
import { k2Gas } from './k2-gas';
import { k2Vapor } from './k2-vapor';
import { k2Fluid } from './k2-fluid';
import { k2Heat } from './k2-heat';
import { k3Fuel } from './k3-fuel';
import { k3Burn } from './k3-burn';
import { k3Calc } from './k3-calc';
import { k4Boiler } from './k4-boiler';

/**
 * 教本の全節。**章ごとにファイルを分けて、ここで束ねる**（1 章 1 ファイル。並行して書かせるため）。
 *
 * いまは入門編と課目Ⅱの 4 章（2026 年 10 月 2 日）、課目Ⅲの 3 章と課目Ⅳのボイラ（10 月 4 日）。残りの章は書いたらここへ足す。
 * 章は `src/data/categories.ts` の `CATEGORIES`（受験案内の出題分野そのまま）。
 */
export const SECTIONS: TextbookSection[] = [...intro, ...k2Gas, ...k2Vapor, ...k2Fluid, ...k2Heat, ...k3Fuel, ...k3Burn, ...k3Calc, ...k4Boiler];

export const sectionById = (id: string): TextbookSection | undefined => SECTIONS.find((s) => s.id === id);

export const sectionsOfCategory = (categoryId: string): TextbookSection[] =>
  SECTIONS.filter((s) => s.categoryId === categoryId);

/** 教本全体の目安学習時間（分）。ホームと目次に出す */
export const totalMinutes = SECTIONS.reduce((sum, s) => sum + s.minutes, 0);
