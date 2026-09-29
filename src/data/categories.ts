import type { Category, FieldId } from '../types';

/**
 * 分野（＝試験の課目）と章。
 *
 * **エネルギー管理士試験（熱分野）は 4 課目です。**
 * 必須基礎区分の課目Ⅰと、熱分野専門区分の課目Ⅱ〜Ⅳ（令和 8 年度 受験案内）。
 *
 * | 分野 | 課目 | 時限 | 時間 | 大問 |
 * | --- | --- | --- | --- | --- |
 * | `kamoku1` | Ⅰ エネルギー総合管理及び法規 | 1 時限 9:00〜10:20 | 80 分 | 3 |
 * | `kamoku2` | Ⅱ 熱と流体の流れの基礎 | 2 時限 10:50〜12:40 | 110 分 | 4 |
 * | `kamoku4` | Ⅳ 熱利用設備及びその管理 | **3 時限** 14:00〜15:50 | 110 分 | 8（うち＊4 問題から 2 を選ぶ） |
 * | `kamoku3` | Ⅲ 燃料と燃焼 | **4 時限** 16:20〜17:40 | 80 分 | 3 |
 *
 * **★ 課目の順番（Ⅰ〜Ⅳ）と時限の順番は違います。**課目Ⅳが 3 時限、課目Ⅲが 4 時限です。
 * 受験案内が「ご注意ください」と書いているところです。
 *
 * **★ 合格基準は各課目とも配点の 60 %。**4 課目すべてが基準以上で試験合格。
 * **課目合格の免除期間は 3 年**（同じ分野で受けた場合）。
 *
 * **★★ 章（`CATEGORIES`）は、受験案内の「試験課目」欄に書かれた出題分野そのままです。**
 * 括弧内の数字も受験案内のもので、**大問の数**です（択一の問題数ではありません）。
 * **本番のマークシートは大問の中に空欄がいくつも並ぶ形です。**このアプリの確認問題は
 * その空欄 1 つぶんを 1 問にしています（CLAUDE.md「確認問題の形」）。
 */
export const FIELDS: { id: FieldId; name: string; note: string; questions: number }[] = [
  {
    id: 'intro',
    name: '入門編',
    note: '試験の形、4 課目と時限の順番、課目合格の免除制度、マークシートの答え方をここでそろえる',
    questions: 0,
  },
  {
    id: 'kamoku1',
    name: '課目Ⅰ エネルギー総合管理及び法規',
    note: '必須基礎区分。熱分野と電気分野で共通の課目。1 時限 80 分、大問 3。省エネ法（令和 8 年 4 月 1 日時点で施行されている法令）、エネルギー情勢・政策とエネルギー概論、エネルギー管理技術の基礎',
    questions: 3,
  },
  {
    id: 'kamoku2',
    name: '課目Ⅱ 熱と流体の流れの基礎',
    note: '熱分野専門区分。2 時限 110 分、大問 4。熱力学の基礎（2）、流体工学の基礎（1）、伝熱工学の基礎（1）',
    questions: 4,
  },
  {
    id: 'kamoku3',
    name: '課目Ⅲ 燃料と燃焼',
    note: '熱分野専門区分。★ 4 時限（最後）80 分、大問 3。燃料及び燃焼管理（2）、燃焼計算（1）',
    questions: 3,
  },
  {
    id: 'kamoku4',
    name: '課目Ⅳ 熱利用設備及びその管理',
    note: '熱分野専門区分。★ 3 時限 110 分。計測及び制御（2）、ボイラ・蒸気輸送貯蔵・原動機（2）、★ 残り 4 分野（各 1）から 2 問題を選んで解答',
    questions: 6,
  },
];

const TODO = '**この章はまだ書かれていません。**シラバスと節割りができ次第、書きます（`docs/section-plan.md`）。';

/**
 * 章。**受験案内の「試験課目」欄の出題分野を、そのまま章にしてあります。**
 * `questions` は受験案内の括弧内の数（**大問の数**）。
 *
 * **節割りは、まだです**（引き継ぎ書 §2 の 3。シラバスを起こしてから決める）。
 */
export const CATEGORIES: Category[] = [
  {
    id: 'intro',
    field: 'intro',
    name: 'はじめに',
    summary: '試験の形と、この教本の使い方',
    syllabus: '範囲外',
    questions: 0,
    intro: TODO,
  },

  // ---- 課目Ⅰ エネルギー総合管理及び法規（必須基礎区分） ----
  {
    id: 'k1-law',
    field: 'kamoku1',
    name: '省エネ法',
    summary: 'エネルギーの使用の合理化及び非化石エネルギーへの転換等に関する法律及び命令',
    syllabus: '課目Ⅰ（大問 1）。令和 8 年 4 月 1 日時点で施行されている法令',
    questions: 1,
    intro: TODO,
  },
  {
    id: 'k1-policy',
    field: 'kamoku1',
    name: 'エネルギー情勢・政策とエネルギー概論',
    summary: 'エネルギー情勢・政策、エネルギー概論',
    syllabus: '課目Ⅰ（大問 1）',
    questions: 1,
    intro: TODO,
  },
  {
    id: 'k1-tech',
    field: 'kamoku1',
    name: 'エネルギー管理技術の基礎',
    summary: 'エネルギー管理技術の基礎',
    syllabus: '課目Ⅰ（大問 1）',
    questions: 1,
    intro: TODO,
  },

  // ---- 課目Ⅱ 熱と流体の流れの基礎 ----
  {
    id: 'k2-thermo',
    field: 'kamoku2',
    name: '熱力学の基礎',
    summary: '熱力学の基礎',
    syllabus: '課目Ⅱ（大問 2）',
    questions: 2,
    intro: TODO,
  },
  {
    id: 'k2-fluid',
    field: 'kamoku2',
    name: '流体工学の基礎',
    summary: '流体工学の基礎',
    syllabus: '課目Ⅱ（大問 1）',
    questions: 1,
    intro: TODO,
  },
  {
    id: 'k2-heat',
    field: 'kamoku2',
    name: '伝熱工学の基礎',
    summary: '伝熱工学の基礎',
    syllabus: '課目Ⅱ（大問 1）',
    questions: 1,
    intro: TODO,
  },

  // ---- 課目Ⅲ 燃料と燃焼 ----
  {
    id: 'k3-fuel',
    field: 'kamoku3',
    name: '燃料及び燃焼管理',
    summary: '燃料及び燃焼管理',
    syllabus: '課目Ⅲ（大問 2）',
    questions: 2,
    intro: TODO,
  },
  {
    id: 'k3-calc',
    field: 'kamoku3',
    name: '燃焼計算',
    summary: '燃焼計算',
    syllabus: '課目Ⅲ（大問 1）',
    questions: 1,
    intro: TODO,
  },

  // ---- 課目Ⅳ 熱利用設備及びその管理 ----
  // ★ 下の 4 分野（＊印）は、4 問題中 2 問題を選択して解答する（受験案内 注 2）
  {
    id: 'k4-measure',
    field: 'kamoku4',
    name: '計測及び制御',
    summary: '計測及び制御',
    syllabus: '課目Ⅳ（大問 2）',
    questions: 2,
    intro: TODO,
  },
  {
    id: 'k4-boiler',
    field: 'kamoku4',
    name: 'ボイラ・蒸気輸送貯蔵装置・原動機',
    summary: 'ボイラ、蒸気輸送・貯蔵装置、蒸気原動機・内燃機関・ガスタービン',
    syllabus: '課目Ⅳ 熱利用設備（大問 2）',
    questions: 2,
    intro: TODO,
  },
  {
    id: 'k4-hx',
    field: 'kamoku4',
    name: '熱交換器・熱回収装置',
    summary: '熱交換器・熱回収装置',
    syllabus: '課目Ⅳ 熱利用設備 ＊選択（大問 1）',
    questions: 1,
    intro: TODO,
  },
  {
    id: 'k4-refrig',
    field: 'kamoku4',
    name: '冷凍・空気調和設備',
    summary: '冷凍・空気調和設備',
    syllabus: '課目Ⅳ 熱利用設備 ＊選択（大問 1）',
    questions: 1,
    intro: TODO,
  },
  {
    id: 'k4-furnace',
    field: 'kamoku4',
    name: '工業炉・熱設備材料',
    summary: '工業炉、熱設備材料',
    syllabus: '課目Ⅳ 熱利用設備 ＊選択（大問 1）',
    questions: 1,
    intro: TODO,
  },
  {
    id: 'k4-process',
    field: 'kamoku4',
    name: '蒸留・蒸発・濃縮・乾燥・乾留・ガス化装置',
    summary: '蒸留・蒸発・濃縮装置、乾燥装置、乾留・ガス化装置',
    syllabus: '課目Ⅳ 熱利用設備 ＊選択（大問 1）',
    questions: 1,
    intro: TODO,
  },
];

/** 用語辞典の節の ID。本文から飛ばすのに使う */
export const GLOSSARY_SECTION_ID = 'i-4';

/** 計算の解き方を説明する節の ID。解説から飛ばすのに使う */
export const MATH_SECTION_ID = 'i-3';

export const categoryById = (id: string): Category | undefined => CATEGORIES.find((c) => c.id === id);

export const categoryName = (id: string): string => categoryById(id)?.name ?? id;

export const categoriesOfField = (field: FieldId): Category[] => CATEGORIES.filter((c) => c.field === field);

/** 分野の表示名 */
export const fieldName = (id: FieldId): string => FIELDS.find((f) => f.id === id)?.name ?? id;

/** 章 ID から分野 ID を引く。模試の科目別集計に使う */
export function fieldOfCategory(categoryId: string): FieldId | undefined {
  return categoryById(categoryId)?.field;
}

/**
 * 課目Ⅰの法規の問題に置く前置き。
 *
 * 受験案内（注 1）は「エネルギーの使用の合理化及び非化石エネルギーへの転換等に関する法律及び命令」は
 * **令和 8 年 4 月 1 日時点で施行されている法令が対象**としている。
 * **年度が変わったら、ここも取り直すこと。**
 *
 * **★ まだ 1 行だけです。**本番の問題用紙に置かれている前置きを、公開問題で確かめてから足すこと。
 */
export const LAW_PREAMBLE: readonly string[] = [
  '令和 8 年 4 月 1 日時点で施行されている「エネルギーの使用の合理化及び非化石エネルギーへの転換等に関する法律」及び命令に基づいて出題しています。',
];

/**
 * **このアプリの模試 1 本あたりの問題数。**いまは課目の大問数の合計（3 + 4 + 3 + 6 = 16）。
 *
 * **★ 仮の値です。**本番は大問の中に空欄が並ぶ形で、確認問題の形がまだ決まっていない
 * （CLAUDE.md「まだ決めていないこと」）。**形を決めたら、ここも決め直すこと。**
 */
export const MOCK_QUESTIONS = 16;

/**
 * **本番の試験時間の合計（380 分）。**令和 8 年度 受験案内の時限表から。
 *
 * | 時限 | 課目 | 時間 |
 * | --- | --- | --- |
 * | 1 | Ⅰ | 9:00〜10:20（80 分） |
 * | 2 | Ⅱ | 10:50〜12:40（110 分） |
 * | 3 | **Ⅳ** | 14:00〜15:50（110 分） |
 * | 4 | **Ⅲ** | 16:20〜17:40（80 分） |
 *
 * **1 日がかりの試験で、時限の間に休憩がある。**通しで 380 分座るわけではない。
 */
export const EXAM_MINUTES = 380;

/**
 * **合格基準は、各課目とも配点の 60 %**（令和 8 年度 受験案内「各課目の合格基準（配点の 60％）」）。
 *
 * それでも、このアプリが出せるのは「**この模試の結果が 6 割に届いたか**」までで、
 * **合否の判定ではない**（系譜 9 本すべての方針）。
 */
export const PASS_RATIO = 0.6;
