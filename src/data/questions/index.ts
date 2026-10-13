import type { Question } from '../../types';
import { k2Gas } from './k2-gas';
import { k2Vapor } from './k2-vapor';
import { k2Fluid } from './k2-fluid';
import { k2Heat } from './k2-heat';
import { k3Fuel } from './k3-fuel';
import { k3Burn } from './k3-burn';
import { k3Calc } from './k3-calc';
import { k4Measure } from './k4-measure';
import { k4Control } from './k4-control';
import { k4Boiler } from './k4-boiler';
import { k4Engine } from './k4-engine';
import { k4Hx } from './k4-hx';
import { k4Refrig } from './k4-refrig';

/**
 * 確認問題。課目Ⅱの 4 章から書いている（2026 年 10 月 10 日〜）。
 *
 * **1 問 ＝ 本番の空欄 1 つぶん**（CLAUDE.md「確認問題の形」、2026 年 9 月 29 日に決定）。
 * 選択肢は空欄ごとに 2〜20 個で、5 に揃えない。大問の設定は `passages.ts` に書いて `passage` で指す。
 *
 * 章ごとにファイルを分けて、ここで束ねる（1 章 1 ファイル。並行して書かせるため）。
 */
export const QUESTIONS: Question[] = [...k2Gas, ...k2Vapor, ...k2Fluid, ...k2Heat, ...k3Fuel, ...k3Burn, ...k3Calc, ...k4Measure, ...k4Control, ...k4Boiler, ...k4Engine, ...k4Hx, ...k4Refrig];

export const questionById = (id: string): Question | undefined => QUESTIONS.find((q) => q.id === id);

export const questionsOfCategory = (categoryId: string): Question[] =>
  QUESTIONS.filter((q) => q.categoryId === categoryId);

export const questionsOfSection = (sectionId: string): Question[] =>
  QUESTIONS.filter((q) => q.sectionId === sectionId);
