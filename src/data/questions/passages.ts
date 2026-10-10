import type { Passage } from '../../types';
import { k2GasPassages } from './k2-gas';
import { k2VaporPassages } from './k2-vapor';
import { k2FluidPassages } from './k2-fluid';
import { k2HeatPassages } from './k2-heat';
import { k3FuelPassages } from './k3-fuel';
import { k3BurnPassages } from './k3-burn';
import { k3CalcPassages } from './k3-calc';

/**
 * 大問の前置き。確認問題が `passage: 'id'` で指す。
 *
 * 前置きは章の問題ファイルに書き、ここで束ねる（1 章 1 ファイル。並行して書かせるため）。
 *
 * 本番の大問は、1 つの設定に空欄が十数個ぶら下がる（`docs/public-questions.md` §2）。
 * その設定をここに 1 回だけ書く。**前の空欄の答えは前置きに書かず、問題文の側で与える**
 * （復習キューは問題をばらばらの順で出すので、前の問題を解いた前提にできない）。
 *
 * **公開問題の設定を写さないこと。**燃料の組成も、サイクルの温度も、事業者の事例も自前で作る。
 */
export const PASSAGES: Passage[] = [...k2GasPassages, ...k2VaporPassages, ...k2FluidPassages, ...k2HeatPassages, ...k3FuelPassages, ...k3BurnPassages, ...k3CalcPassages];

export const passageById = (id: string): Passage | undefined => PASSAGES.find((p) => p.id === id);
