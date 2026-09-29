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
 * **★★ 章（`CATEGORIES`）は、本番の大問と 1 対 1 です**（docs/section-plan.md §1）。
 * 受験案内の出題分野のうち「熱力学の基礎（2）」のように 2 大問をまとめたものは、
 * 令和 6〜8 年度の分担に合わせて 2 章に割った。**章は学習の道筋で、出題範囲の境界ではない。**
 * **本番のマークシートは大問の中に空欄がいくつも並ぶ形です。**このアプリの確認問題は
 * その空欄 1 つぶんを 1 問にしています（CLAUDE.md「確認問題の形」）。
 *
 * `questions` は**解答する大問の数**（受験案内の括弧内の合計。課目Ⅳは選択 2 を含めて 6）、
 * `points` は**課目の満点**（令和 6〜8 年度の標準解答）。どちらも章の値の合計と `check.ts` が突き合わせる。
 */
export const FIELDS: { id: FieldId; name: string; note: string; questions: number; points: number }[] = [
  {
    id: 'intro',
    name: '入門編',
    note: '試験の形、4 課目と時限の順番、課目合格の免除制度、マークシートの答え方をここでそろえる',
    questions: 0,
    points: 0,
  },
  {
    id: 'kamoku1',
    name: '課目Ⅰ エネルギー総合管理及び法規',
    note: '必須基礎区分。熱分野と電気分野で共通の課目。1 時限 80 分、大問 3、200 点。省エネ法（令和 8 年 4 月 1 日時点で施行されている法令）、エネルギー情勢・政策とエネルギー概論、エネルギー管理技術の基礎',
    questions: 3,
    points: 200,
  },
  {
    id: 'kamoku2',
    name: '課目Ⅱ 熱と流体の流れの基礎',
    note: '熱分野専門区分。2 時限 110 分、大問 4、200 点。熱力学の基礎（2）、流体工学の基礎（1）、伝熱工学の基礎（1）',
    questions: 4,
    points: 200,
  },
  {
    id: 'kamoku3',
    name: '課目Ⅲ 燃料と燃焼',
    note: '熱分野専門区分。★ 4 時限（最後）80 分、大問 3、110 点。燃料及び燃焼管理（2）、燃焼計算（1）',
    questions: 3,
    points: 110,
  },
  {
    id: 'kamoku4',
    name: '課目Ⅳ 熱利用設備及びその管理',
    note: '熱分野専門区分。★ 3 時限 110 分、280 点。計測及び制御（2）、ボイラ・蒸気輸送貯蔵・原動機（2）、★ 残り 4 分野（各 1）から 2 問題を選んで解答',
    questions: 6,
    points: 280,
  },
];

/** 課目Ⅳの＊選択の章から、本番で選んで解答する数（受験案内 注 2） */
export const ELECTIVES_TO_ANSWER = 2;

const TODO = '**この章はまだ書かれていません。**節割りは `docs/section-plan.md` にあります。';

/**
 * 章。**本番の大問と 1 対 1 です**（`docs/section-plan.md` §1・§4）。
 * `questions` は大問の数（入門編を除いて 1）、`points` はその大問の配点。
 * `syllabus` の括弧は受験案内の出題分野の名前で、2 大問をまとめた分野はどちらの半分かを書く。
 *
 * **節 ID の接頭辞は課目ごと**（`lw-` `ea-` `tf-` `fc-` `hu-`）。**`ea-` は `k1-policy` と `k1-tech` で通し番号を共有する。**
 */
export const CATEGORIES: Category[] = [
  {
    id: 'intro',
    field: 'intro',
    name: 'はじめに',
    summary: '試験の形と、この教本の使い方',
    syllabus: '範囲外',
    questions: 0,
    points: 0,
    intro: TODO,
  },

  // ---- 課目Ⅰ エネルギー総合管理及び法規（必須基礎区分） ----
  {
    id: 'k1-law',
    field: 'kamoku1',
    name: '省エネ法',
    summary: 'エネルギーの使用の合理化及び非化石エネルギーへの転換等に関する法律及び命令',
    syllabus: '課目Ⅰ 問題 1（省エネ法及び命令）。令和 8 年 4 月 1 日時点で施行されている法令',
    questions: 1,
    points: 50,
    intro: TODO,
  },
  {
    id: 'k1-policy',
    field: 'kamoku1',
    name: 'エネルギー情勢・政策とエネルギー概論',
    summary: '単位、エネルギーの変換と貯蔵、エネルギー需給、温暖化対策と政策',
    syllabus: '課目Ⅰ 問題 2（エネルギー情勢・政策、エネルギー概論）',
    questions: 1,
    points: 50,
    intro: TODO,
  },
  {
    id: 'k1-tech',
    field: 'kamoku1',
    name: 'エネルギー管理技術の基礎',
    summary: '工場等判断基準と、熱・燃焼・流体・電気・照明の小問',
    syllabus: '課目Ⅰ 問題 3（エネルギー管理技術の基礎）',
    questions: 1,
    points: 100,
    intro: TODO,
  },

  // ---- 課目Ⅱ 熱と流体の流れの基礎 ----
  {
    id: 'k2-gas',
    field: 'kamoku2',
    name: '熱力学の基礎（1）理想気体とガスサイクル',
    summary: '第一法則、理想気体の状態変化、エントロピー、ガスサイクル',
    syllabus: '課目Ⅱ 問題 4（熱力学の基礎 2 問題のうち、理想気体の側）',
    questions: 1,
    points: 50,
    intro: TODO,
  },
  {
    id: 'k2-vapor',
    field: 'kamoku2',
    name: '熱力学の基礎（2）蒸気と冷凍サイクル',
    summary: '相変化、蒸気表と冷媒表、ランキンサイクル、蒸気圧縮冷凍サイクル',
    syllabus: '課目Ⅱ 問題 5（熱力学の基礎 2 問題のうち、相変化する作動流体の側）',
    questions: 1,
    points: 50,
    intro: TODO,
  },
  {
    id: 'k2-fluid',
    field: 'kamoku2',
    name: '流体工学の基礎',
    summary: 'ベルヌーイの式、差圧式流量計、管摩擦損失、ポンプと送風機',
    syllabus: '課目Ⅱ 問題 6（流体工学の基礎）',
    questions: 1,
    points: 50,
    intro: TODO,
  },
  {
    id: 'k2-heat',
    field: 'kamoku2',
    name: '伝熱工学の基礎',
    summary: '伝導、対流と無次元数、放射、熱交換器',
    syllabus: '課目Ⅱ 問題 7（伝熱工学の基礎）',
    questions: 1,
    points: 50,
    intro: TODO,
  },

  // ---- 課目Ⅲ 燃料と燃焼 ----
  {
    id: 'k3-fuel',
    field: 'kamoku3',
    name: '燃料及び燃焼管理（1）燃料と燃焼の基礎',
    summary: '燃料の種類と発熱量、燃料転換、燃焼の基礎',
    syllabus: '課目Ⅲ 問題 8（燃料及び燃焼管理 2 問題のうち、燃料の側）',
    questions: 1,
    points: 30,
    intro: TODO,
  },
  {
    id: 'k3-burn',
    field: 'kamoku3',
    name: '燃料及び燃焼管理（2）燃焼装置と排ガス',
    summary: '気体・液体・固体燃料の燃焼装置、通風、ばいじんと NOx・SOx、排ガス分析',
    syllabus: '課目Ⅲ 問題 9（燃料及び燃焼管理 2 問題のうち、燃焼装置と管理の側）',
    questions: 1,
    points: 30,
    intro: TODO,
  },
  {
    id: 'k3-calc',
    field: 'kamoku3',
    name: '燃焼計算',
    summary: '理論空気量、燃焼ガス量、空気比、排ガス熱損失',
    syllabus: '課目Ⅲ 問題 10（燃焼計算）',
    questions: 1,
    points: 50,
    intro: TODO,
  },

  // ---- 課目Ⅳ 熱利用設備及びその管理 ----
  // ★ 下の 4 章（elective）は、4 問題中 2 問題を選択して解答する（受験案内 注 2）
  {
    id: 'k4-measure',
    field: 'kamoku4',
    name: '計測及び制御（1）計測',
    summary: '温度・流量・圧力の計測',
    syllabus: '課目Ⅳ 問題 11（計測及び制御 2 問題のうち、計測の側）',
    questions: 1,
    points: 50,
    intro: TODO,
  },
  {
    id: 'k4-control',
    field: 'kamoku4',
    name: '計測及び制御（2）制御',
    summary: '制御方式、ブロック線図、PID',
    syllabus: '課目Ⅳ 問題 12（計測及び制御 2 問題のうち、制御の側）',
    questions: 1,
    points: 50,
    intro: TODO,
  },
  {
    id: 'k4-boiler',
    field: 'kamoku4',
    name: 'ボイラ・蒸気輸送貯蔵装置',
    summary: 'ボイラの種類と効率、ボイラ水、蒸気配管とドレン',
    syllabus: '課目Ⅳ 問題 13（ボイラ・蒸気輸送貯蔵装置・原動機 2 問題のうち、ボイラと蒸気の側）',
    questions: 1,
    points: 50,
    intro: TODO,
  },
  {
    id: 'k4-engine',
    field: 'kamoku4',
    name: '原動機',
    summary: '蒸気タービン、内燃機関、ガスタービン、コンバインドサイクル',
    syllabus: '課目Ⅳ 問題 14（ボイラ・蒸気輸送貯蔵装置・原動機 2 問題のうち、原動機の側）',
    questions: 1,
    points: 50,
    intro: TODO,
  },
  {
    id: 'k4-hx',
    field: 'kamoku4',
    name: '熱交換器・熱回収装置',
    summary: '熱交換器の形式と効率、廃熱回収、ヒートパイプ、冷却塔',
    syllabus: '課目Ⅳ 問題 15 ＊選択（熱交換器・熱回収装置）',
    questions: 1,
    points: 40,
    elective: true,
    intro: TODO,
  },
  {
    id: 'k4-refrig',
    field: 'kamoku4',
    name: '冷凍・空気調和設備',
    summary: '湿り空気線図、空調負荷、冷凍機と吸収冷凍機、熱源方式',
    syllabus: '課目Ⅳ 問題 16 ＊選択（冷凍・空気調和設備）',
    questions: 1,
    points: 40,
    elective: true,
    intro: TODO,
  },
  {
    id: 'k4-furnace',
    field: 'kamoku4',
    name: '工業炉・熱設備材料',
    summary: '工業炉の熱効率と省エネ、判断基準の基準値、耐火物と断熱材',
    syllabus: '課目Ⅳ 問題 17 ＊選択（工業炉・熱設備材料）',
    questions: 1,
    points: 40,
    elective: true,
    intro: TODO,
  },
  {
    id: 'k4-process',
    field: 'kamoku4',
    name: '蒸留・蒸発・濃縮・乾燥・乾留・ガス化装置',
    summary: '気液平衡と蒸留、蒸発と濃縮、乾燥の収支、乾留とガス化',
    syllabus: '課目Ⅳ 問題 18 ＊選択（蒸留・蒸発・濃縮・乾燥・乾留・ガス化装置）',
    questions: 1,
    points: 40,
    elective: true,
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
