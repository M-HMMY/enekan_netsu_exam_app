/**
 * 計算ドリル：出題のたびに数値が変わる自動生成問題。
 *
 * 計算問題は同じ問題文を暗記してしまうと本番で崩れるため、
 * 値を振り直して「手順」だけが身に付くようにしている。
 * 生成した問題は復習カード（SRS）には登録しない（同じ問題が二度と現れないため）。
 *
 * **★ この試験は計算が多い。**課目Ⅱ（熱力学・流体・伝熱）と課目Ⅲ（燃焼計算）は
 * 大問の中で値を出させ、課目Ⅰ問題 3 と課目Ⅳのボイラにも数値の空欄が並ぶ。
 * **19 種類あります**（2026 年 10 月 16 日）。内訳は下の `DRILLS` の説明。
 *
 * **★ 電卓は四則と √ まで**（関数電卓は禁止。受験案内 §7）。
 * **指数・対数の値が要るものは、問題文で値を与えている**（本番は表を付ける）。
 * 対数平均温度差・等温圧縮は ln の値を、可逆断熱変化は累乗の値を問題文に書いてある。
 * 平方根はそのまま出す（トリチェリ、力率の sin）。
 *
 * **物性値・係数をこちらで決め打ちしない。**問題文の中で与えること。
 * **ドリルは手順の練習なので、値は与えてよい。**
 * **法令の値（原油換算の係数）だけは `docs/primary-numbers.md` §2 の値を使う。**
 *
 * **★ 問題文と選択肢は、Markdown を通さずにそのまま画面に出る**（`src/pages/Drill.tsx`）。
 * `$...$` や `**` を書くと記号のまま出るので、問題文・選択肢では使わないこと。
 * 化学式は CH₄ のような Unicode の添字で書く。**解説は Markdown を通る**ので、数式はそちらで書く。
 *
 * 手順で必ず解けるものに絞ること。有効数字や単位の扱いで割れる問題は、
 * 自動生成すると答えが一意にならない。
 *
 * **★ 書いたら `npm run drills` で目を通すこと。**
 * `npm run check` は 1 種類につき 200 回生成しますが、見ているのは
 * 「5 択か」「重複しないか」「0 が混じらないか」だけです。
 * **日本語として読めるか、選択肢が紛らわしすぎないかは人が読むしかありません。**
 */

export interface DrillItem {
  question: string;
  choices: string[];
  answer: number;
  /** 計算手順の解説 */
  explanation: string;
}

export interface Drill {
  id: string;
  name: string;
  categoryId: string;
  sectionId: string;
  summary: string;
  generate: () => DrillItem;
}

// ---------------------------------------------------------------- 補助関数

const rnd = (min: number, max: number): number => min + Math.floor(Math.random() * (max - min + 1));

/** 選択肢や条件をランダムに 1 つ選ぶ。新しいドリルを書くときに使う */
export function pick<T>(items: readonly T[]): T {
  return items[rnd(0, items.length - 1)];
}

/** 小数を読みやすく整える（末尾の 0 を落とす）。新しいドリルを書くときに使う */
export function fx(n: number, digits = 2): string {
  return Number(n.toFixed(digits)).toString();
}

/**
 * 小数点以下の桁をそろえ、整数部に 3 桁ごとのカンマを入れる（選択肢と解説の値に使う）。
 * **選択肢は桁をそろえる。**`fx` のように末尾の 0 を落とすと、1.2 と 1.183 が並んで読みにくい。
 */
export function nf(n: number, digits = 0): string {
  const s = Math.abs(n).toFixed(digits);
  const [int, frac] = s.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = n < 0 && Number(s) !== 0 ? '−' : '';
  return sign + grouped + (frac !== undefined ? '.' + frac : '');
}

function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let j = a.length - 1; j > 0; j--) {
    const k = rnd(0, j);
    [a[j], a[k]] = [a[k], a[j]];
  }
  return a;
}

/**
 * 数値の 5 択。**選択肢は小さい順に並べる**（本番の数値の解答群が小さい順だった。令和 8 年度）。
 *
 * **★ 正解の位置を先に乱数で決めてから、誤答を選ぶ。**
 * 誤答を 4 つ選んでから並べるだけだと、誤答は正解の両側に散るので、**正解はほとんど 2〜4 番目に来て、
 * 1 番目と 5 番目にはまず来ない**（実際に 5,000 回生成して、端の位置は 0〜2 % だった）。
 * 「真ん中を選べば当たる」癖が付くので、**正解より小さい誤答の数 k（＝正解の位置）を先に決め、
 * 小さい側から k 個、大きい側から 4 − k 個を取る。**
 *
 * - 誤答の候補（`mistakes`）は**ありがちな間違え方の値**を渡す。**大きい側と小さい側の両方に、
 *   なるべく 3 つ以上ずつ置くこと。**足りない側は倍率でずらした値で埋める（1 問に 2 つまで）。
 *   **倍率の埋め草は最後の手段**なので、候補が片側に偏っている問題では k の範囲を狭めて使い過ぎないようにする
 * - 0 以下・NaN・Infinity の候補と、**表示が 0 になる候補**は捨てる
 * - **ほかの選択肢と近すぎる候補は捨てる**（相対で `minGap` 未満。既定 3 %）。
 *   途中で丸めて解いた人が隣を選ばないように、という本番の「最も近いもの」への配慮
 * - `base` は倍率でずらすときの原点。空気比のように 1 からの差に意味がある量は `base: 1` にする
 *   （1.2 の 2 倍の 2.4 は空気比としてありえず、見ただけで消せる）
 *
 * 並べ替えは**数値で比べる**（表示の文字列では比べない。"12.5" と "9.8" が逆になる）。
 */
export function buildNumeric(
  correct: number,
  fmt: (n: number) => string,
  mistakes: number[],
  opts: { minGap?: number; base?: number } = {},
): { choices: string[]; answer: number } {
  const minGap = opts.minGap ?? 0.03;
  const base = opts.base ?? 0;
  const label = fmt(correct);
  const chosen: { v: number; s: string }[] = [{ v: correct, s: label }];
  const usable = (v: number, against: { v: number; s: string }[]): boolean => {
    if (!Number.isFinite(v) || v <= 0) return false;
    const s = fmt(v);
    if (against.some((c) => c.s === s)) return false;
    const shown = Number.parseFloat(s.replace(/,/g, ''));
    if (!Number.isFinite(shown) || shown === 0) return false;
    return against.every((c) => Math.abs(v - c.v) > minGap * Math.max(Math.abs(v), Math.abs(c.v)));
  };
  const tryAdd = (v: number): boolean => {
    if (chosen.length >= 5 || !usable(v, chosen)) return false;
    chosen.push({ v, s: fmt(v) });
    return true;
  };
  const take = (cands: number[], need: number): number => {
    let got = 0;
    for (const v of cands) {
      if (got >= need) break;
      if (tryAdd(v)) got++;
    }
    return got;
  };
  const scaled = (f: number): number => base + (correct - base) * f;
  // 候補どうしが近すぎるものは、片方だけを数える（そうしないと k を決めるときに数を多く見積もり、
  // 片側が足りずに反対側から埋めることになって、正解の位置が偏る）
  const distinct = (vals: number[]): number[] => {
    const acc: { v: number; s: string }[] = [];
    for (const v of vals) if (usable(v, [...chosen, ...acc])) acc.push({ v, s: fmt(v) });
    return acc.map((a) => a.v);
  };
  const lower = distinct(shuffle(mistakes.filter((v) => v < correct)));
  const upper = distinct(shuffle(mistakes.filter((v) => v > correct)));
  const lowF = shuffle([0.5, 0.6, 0.7, 0.8, 0.4, 0.87, 0.3]).map(scaled);
  const upF = shuffle([1.25, 1.4, 1.5, 1.8, 2, 2.5, 1.15, 3]).map(scaled);
  // 埋め草は 1 問に 2 つまで。だから小さい側の誤答が L 個なら、k は L ＋ 2 まで
  const FILL = 2;
  let fills = 0;
  const takeFill = (cands: number[], need: number): void => {
    fills += take(cands, Math.min(need, FILL - fills));
  };
  const kMin = Math.max(0, 4 - (upper.length + FILL));
  const kMax = Math.min(4, lower.length + FILL);
  const k = rnd(kMin, Math.max(kMin, kMax));
  const gotLow = take(lower, k);
  takeFill(lowF, k - gotLow);
  const gotUp = take(upper, 4 - k);
  takeFill(upF, 4 - k - gotUp);
  // 近すぎて捨てた分などで、まだ足りなければ、まず誤答の候補をどちら側からでも。
  // 次に埋め草を上限の 2 つまで（以前はここで上限を越えて 3 つ目が入っていた）
  take([...lower, ...upper], 5 - chosen.length);
  takeFill([...lowF, ...upF], 5 - chosen.length);
  // それでも 5 つにならないときだけ、上限を越えて埋める（5 択を崩さないための最後の手段）
  take([...lowF, ...upF], 5 - chosen.length);
  chosen.sort((a, b) => a.v - b.v);
  return { choices: chosen.map((c) => c.s), answer: chosen.findIndex((c) => c.s === label) };
}

/** 自然対数の表（本番は問題に表が付く）。比が表にある値になるように数値を組む */
const LN_TABLE = [
  { r: 1.5, ln: 0.405 },
  { r: 2, ln: 0.693 },
  { r: 2.5, ln: 0.916 },
  { r: 3, ln: 1.099 },
  { r: 4, ln: 1.386 },
  { r: 5, ln: 1.609 },
] as const;

/** 炭化水素（燃焼計算の 2 成分目に使う） */
const HYDROCARBONS = [
  { name: 'エタン', formula: 'C₂H₆', x: 2, y: 6 },
  { name: 'プロパン', formula: 'C₃H₈', x: 3, y: 8 },
  { name: 'ブタン', formula: 'C₄H₁₀', x: 4, y: 10 },
  { name: 'エチレン', formula: 'C₂H₄', x: 2, y: 4 },
] as const;

/** 数式用の化学式（$\mathrm{C_{3}H_{8}}$ の中身） */
function chem(x: number, y: number): string {
  return '\\mathrm{C' + (x > 1 ? '_{' + x + '}' : '') + 'H_{' + y + '}}';
}

/**
 * 空気比・排ガス損失のドリルで使う燃料。**組成から理論量を計算して使う**（値を手で写さない）。
 * 燃料 1 単位（気体は 1 m³N、液体は 1 kg）あたりの理論酸素量・CO₂（SO₂ を含む）・H₂O。
 * 発熱量は「問題文で与える」ための値で、物性の主張ではない。
 */
const FLUE_FUELS = [
  { name: 'メタン', unit: 'm³N', o0: 2, co2: 1, h2o: 2, hl: 35.8 },
  { name: '体積組成 CH₄ 90 %、C₂H₆ 6 %、C₃H₈ 4 % の混合ガス', unit: 'm³N', o0: 2.21, co2: 1.14, h2o: 2.14, hl: 39.7 },
  { name: 'プロパン', unit: 'm³N', o0: 5, co2: 3, h2o: 4, hl: 91.2 },
  // 重油：質量組成 C 86 %、H 12 %、S 1 %（O₀ ＝ 1.867C ＋ 5.6H ＋ 0.7S）。CO₂ の欄は SO₂ を含めた乾きの燃焼生成物
  { name: '質量組成 C 86 %、H 12 %、S 1 % の重油', unit: 'kg', o0: 2.28462, co2: 1.61262, h2o: 1.344, hl: 41.3 },
] as const;

function flueValues(f: (typeof FLUE_FUELS)[number]): { a0: number; g0d: number; g0w: number } {
  // 表示する値（3 桁に丸めた値）で計算をそろえる。問題文の値から解いた人と同じ答えになるように
  const a0 = Number((f.o0 / 0.21).toFixed(3));
  const g0d = Number((f.co2 + 0.79 * (f.o0 / 0.21)).toFixed(3));
  const g0w = Number((g0d + f.h2o).toFixed(3));
  return { a0, g0d, g0w };
}

/**
 * 飽和蒸気表（圧力は絶対圧 MPa。h′ と蒸発熱 r は kJ/kg。問題文で与える値）。
 * **IAPWS-IF97 の値を小数 1 桁に丸めた**（Python の iapws 1.5.5 で取った。2026 年 10 月 16 日）。
 * r は h″ − h′ を丸める前の値で出してから丸めた（0.8 MPa は h″ 2768.30 − h′ 721.02 ＝ 2047.28 → 2047.3）。
 * 確認問題（k2-vapor・k4-boiler）の飽和表と同じ値になるようにしてある
 */
const STEAM = {
  0.4: { hf: 604.7, r: 2133.3 },
  0.5: { hf: 640.2, r: 2107.9 },
  0.6: { hf: 670.5, r: 2085.6 },
  0.7: { hf: 697.1, r: 2065.6 },
  0.8: { hf: 721.0, r: 2047.3 },
  0.9: { hf: 742.7, r: 2030.3 },
  1.0: { hf: 762.7, r: 2014.4 },
  1.4: { hf: 830.1, r: 1958.8 },
  1.5: { hf: 844.7, r: 1946.3 },
} as const;

/**
 * 湿り蒸気の加熱のドリルで使う飽和表（絶対圧 MPa、h′ と h″ は kJ/kg）。
 * IAPWS-IF97 を小数 1 桁に丸めた値（iapws 1.5.5）。確認問題 k2-vapor の 0.8・1.5 MPa は使わない
 */
const SAT_HG = [
  { p: 0.2, hf: 504.7, hg: 2706.2 },
  { p: 0.3, hf: 561.5, hg: 2724.9 },
  { p: 0.6, hf: 670.5, hg: 2756.1 },
  { p: 1.0, hf: 762.7, hg: 2777.1 },
  { p: 1.2, hf: 798.5, hg: 2783.8 },
  { p: 2.0, hf: 908.6, hg: 2798.4 },
] as const;
type SteamP = keyof typeof STEAM;

/**
 * 計算ドリル。**19 種類**（2026 年 10 月 16 日）。
 *
 * | 課目 | 章 | ドリル |
 * | --- | --- | --- |
 * | Ⅰ | `k1-law` | 原油換算（則 4 条の係数。台帳 §2） |
 * | Ⅰ | `k1-tech` | 力率改善のコンデンサ容量、デマンドの残り時間の上限 |
 * | Ⅱ | `k2-gas` | マイヤーの関係、等温圧縮の仕事、可逆断熱圧縮の温度 |
 * | Ⅱ | `k2-vapor` | 湿り蒸気を定圧で加熱する熱量 |
 * | Ⅱ | `k2-fluid` | 連続の式、トリチェリ、レイノルズ数、管摩擦損失 |
 * | Ⅱ | `k2-heat` | 熱通過率、対数平均温度差、伝熱管の長さ |
 * | Ⅲ | `k3-fuel` | 生成エンタルピーから発熱量 |
 * | Ⅲ | `k3-calc` | 混合ガスの理論空気量と空気量、O₂ から空気比、排ガス熱損失 |
 * | Ⅳ | `k4-boiler` | 換算蒸発量 |
 *
 * **高圧ガス甲種版から 12 種類を持ってきて**（章 ID・節 ID を付け替え、記号を教本に合わせた）、
 * **この試験に固有のものを 7 種類足した。**高圧ガスの法令（充塡質量・貯蔵所）、
 * 化学（分子量・ラウール・反応速度・アレニウス・TNT 換算・爆発下限界）、
 * 材料力学（薄肉胴の応力）は、この試験の出題分野に無いので持ってきていない。
 *
 * **★ 選択肢は小さい順**（`buildNumeric`）。誤答は**ありがちな間違え方**の値で、
 * 正解の大きい側と小さい側の両方に置いてある。
 *
 * **★ 単位の換算を、わざと 1 段入れてある。**℃ と K、mm と m、W と kW、kJ と MJ、t と kg、分と時間、
 * J/(mol·K) と kJ/(kg·K)。
 */
export const DRILLS: Drill[] = [
  // ------------------------------------------------------------ 課目Ⅰ 法（原油換算）
  {
    id: 'lw-crude-oil',
    name: '原油換算のエネルギー使用量',
    categoryId: 'k1-law',
    sectionId: 'lw-3',
    summary: '燃料は別表第一の発熱量、買った蒸気は別表第二の係数、買電は 8.64 で GJ にそろえ、0.0258 を掛ける',
    generate: () => {
      // 係数はすべて docs/primary-numbers.md §2（則 4 条・別表第一・第二）の値
      const oil = pick([120, 180, 240, 300, 360, 450]); // A 重油 kL（38.9 GJ/kL）
      const genOil = pick([20, 30, 40, 60]); // そのうち発電機で使った kL
      const genMwh = Math.round(genOil * pick([3.4, 3.6, 3.8]));// 発電した電気（千 kWh）
      const lpg = pick([15, 25, 40, 60, 80]); // LPG t（50.1 GJ/t）
      const buy = pick([600, 900, 1200, 1800, 2400, 3000]); // 買電 千 kWh（8.64 GJ）
      const steam = pick([3000, 5000, 8000, 12000]); // 産業用蒸気 GJ（係数 1.17）
      const gjOil = oil * 38.9;
      const gjLpg = lpg * 50.1;
      const gjBuy = buy * 8.64;
      const gjSteam = steam * 1.17;
      const gj = gjOil + gjLpg + gjBuy + gjSteam;
      const kl = gj * 0.0258;
      const fmt = (n: number): string => nf(n, 0) + ' kL';
      const { choices, answer } = buildNumeric(
        kl,
        fmt,
        [
          (gjOil + gjLpg + buy * 3.6 + gjSteam) * 0.0258, // 買電を 3.60 で換算
          (gjOil + gjLpg + gjBuy + steam) * 0.0258, // 蒸気に 1.17 を掛け忘れ
          (gj + genMwh * 8.64) * 0.0258, // 自家発の電気も数える（二重計上）
          (oil * 41.8 + gjLpg + gjBuy + gjSteam) * 0.0258, // A 重油に B・C 重油の発熱量
          gj, // 0.0258 を掛け忘れ（GJ のまま）
          ((oil - genOil) * 38.9 + gjLpg + gjBuy + gjSteam) * 0.0258, // 発電に回した重油を除く
          (gjOil + gjBuy + gjSteam) * 0.0258, // LPG を落とす
        ],
        { minGap: 0.015 },
      );
      return {
        question:
          'ある工場の 1 年間のエネルギーの使用は次のとおりである。A 重油 ' + oil + ' kL（このうち ' + genOil +
          ' kL は構内のディーゼル発電機の燃料に使い、発電した電気 ' + genMwh + ' 千 kWh は構内で使った）、液化石油ガス ' + lpg +
          ' t、電気事業者から購入した電気 ' + nf(buy, 0) + ' 千 kWh、隣の工場（製造業）から購入した産業用蒸気 ' + nf(steam, 0) +
          ' GJ。省エネ法施行規則第 4 条により原油換算すると、およそ何 kL か。' +
          '発熱量は A 重油 38.9 GJ/kL、B・C 重油 41.8 GJ/kL、液化石油ガス 50.1 GJ/t、産業用蒸気の係数 1.17、' +
          '電気は 1 千 kWh ＝ 8.64 GJ（自ら使うため発電した非化石電気は 3.60 GJ）、1 GJ ＝ 原油 0.0258 kL とする。',
        choices,
        answer,
        explanation:
          '**1. 燃料を GJ にする。**A 重油は全量を数える。$' + oil + '\\times38.9=' + nf(gjOil, 1) + '$ GJ。' +
          '液化石油ガスは $' + lpg + '\\times50.1=' + nf(gjLpg, 1) + '$ GJ。\n\n' +
          '**2. 自家発の電気は数えない。**ディーゼル発電機の電気は、燃料を熱源とする熱から得た動力による電気なので、' +
          '使用量に数えない（令 2 条 2 項）。**発電に使った A 重油 ' + genOil + ' kL を、1 の燃料ですでに数えている**からで、' +
          genMwh + ' 千 kWh を足すと二重に数えることになる。\n\n' +
          '**3. 買った蒸気は係数を掛ける。**$' + nf(steam, 0) + '\\times1.17=' + nf(gjSteam, 1) + '$ GJ。' +
          '受け取った熱量に係数 1.17 を乗じた熱量で数える（則 4 条 2 項 1 号）。\n\n' +
          '**4. 買電は 8.64。**電気事業者から買った電気は 3 項 2 号の電気なので、$' + nf(buy, 0) + '\\times8.64=' +
          nf(gjBuy, 1) + '$ GJ。3.60 は、自ら使うため（又は特定の需要家のため）に発電した非化石電気だけである。\n\n' +
          '**5. 足して 0.0258 を掛ける。**合計 ' + nf(gj, 1) + ' GJ。$' + nf(gj, 1) + '\\times0.0258\\approx' + nf(kl, 0) +
          '$ kL。\n\n' +
          '**よくある取り違え**：買電を 3.60 で換算する（' + fmt((gjOil + gjLpg + buy * 3.6 + gjSteam) * 0.0258) +
          '）、自家発の電気も足す（' + fmt((gj + genMwh * 8.64) * 0.0258) + '）、蒸気の係数を落とす（' +
          fmt((gjOil + gjLpg + gjBuy + steam) * 0.0258) + '）。',
      };
    },
  },

  // ------------------------------------------------------------ 課目Ⅰ 電気（力率改善・デマンド）
  {
    id: 'ea-capacitor',
    name: '力率改善に要るコンデンサ容量',
    categoryId: 'k1-tech',
    sectionId: 'ea-21',
    summary: '有効電力一定で Q_C ＝ P(tanφ₁ − tanφ₂)。tan は √(1 − cos²) ÷ cos で出す',
    generate: () => {
      // 400 kW・0.8 → 1.0 は令和 7 年度の本番と同じ組になるので、400 は入れない
      const p = pick([60, 80, 120, 150, 200, 250, 300, 500]); // kW
      const c1 = pick([0.6, 0.65, 0.7, 0.75, 0.8, 0.85]);
      const c2 = pick([0.9, 0.92, 0.95, 0.98, 1.0]);
      const s1 = Math.sqrt(1 - c1 * c1);
      const s2 = Math.sqrt(1 - c2 * c2);
      const t1 = s1 / c1;
      const t2 = s2 / c2;
      const qc = p * (t1 - t2);
      const fmt = (n: number): string => nf(n, 1) + ' kvar';
      const { choices, answer } = buildNumeric(qc, fmt, [
        p * t1, // 改善後に残る無効電力を引き忘れる
        p / c1, // 皮相電力と取り違える
        p * (s1 - s2), // tan ではなく sin の差
        p * (1 / c1 - 1 / c2), // 皮相電力の差
        p * t1 - (p / c1) * s2, // 改善後の無効電力を、改善前の皮相電力で出す
        qc / 3, // 1 相分を答える
        qc * Math.sqrt(3), // 三相だからと √3 を掛ける
      ]);
      const c2txt = c2 === 1 ? '1.0（100 %）' : nf(c2, 2);
      return {
        question:
          '有効電力 ' + p + ' kW、力率 ' + nf(c1, 2) + '（遅れ）で運転している三相負荷がある。' +
          '電圧と負荷の有効電力を変えずに、負荷と並列に進相コンデンサをつないで力率を ' + c2txt +
          ' に改善したい。必要なコンデンサの容量（三相分）はおよそいくらか。',
        choices,
        answer,
        explanation:
          '**有効電力は変わらない。**縮むのは無効電力だけで、その差がコンデンサの容量になる：$Q_{C}=P(\\tan\\varphi_{1}-\\tan\\varphi_{2})$。\n\n' +
          '**1. 改善前の tan を出す。**$\\sin\\varphi_{1}=\\sqrt{1-' + nf(c1, 2) + '^{2}}=' + nf(s1, 4) + '$、' +
          '$\\tan\\varphi_{1}=' + nf(s1, 4) + '/' + nf(c1, 2) + '=' + nf(t1, 4) + '$。\n\n' +
          '**2. 改善後の tan を出す。**' +
          (c2 === 1
            ? '力率 100 % なので $\\tan\\varphi_{2}=0$（いまの無効電力を全部打ち消す）。\n\n'
            : '$\\sin\\varphi_{2}=\\sqrt{1-' + nf(c2, 2) + '^{2}}=' + nf(s2, 4) + '$、$\\tan\\varphi_{2}=' + nf(s2, 4) + '/' +
              nf(c2, 2) + '=' + nf(t2, 4) + '$。\n\n') +
          '**3. 掛ける。**$Q_{C}=' + p + '\\times(' + nf(t1, 4) + '-' + nf(t2, 4) + ')\\approx' + nf(qc, 1) + '$ kvar。\n\n' +
          '**確かめ**：改善前の無効電力 $P\\tan\\varphi_{1}\\approx' + nf(p * t1, 1) + '$ kvar より小さいこと。' +
          (c2 === 1 ? '100 % にするときだけ、両者が等しくなる。' : 'その差 ' + nf(p * t2, 1) + ' kvar が、改善後も電源から来る無効電力である。') +
          '\n\n**tan の代わりに sin の差を取る**と ' + fmt(p * (s1 - s2)) + '、**皮相電力の差を取る**と ' +
          fmt(p * (1 / c1 - 1 / c2)) + ' になる。三角形の縦の辺（無効電力）の差だ、と図で確かめる。',
      };
    },
  },
  {
    id: 'ea-demand',
    name: 'デマンドの残り時間の上限',
    categoryId: 'k1-tech',
    sectionId: 'ea-22',
    summary: '時限に使える電力量の枠（目標 × 0.5 h）から使った分を引き、残り時間（h）で割る',
    generate: () => {
      // 2,000 kW・20 分・700 kWh は令和 7 年度の本番と同じ組になるので、2,000 は入れない
      // （ほかの年度の 3,600 kW・4,000 kW も入れない）
      const d = pick([600, 800, 900, 1000, 1200, 1500, 1800, 2400]); // 目標 kW
      const tu = pick([6, 9, 10, 12, 15, 18, 20]); // 経過 分
      const pace = pick([0.75, 0.85, 0.9, 1.05, 1.1, 1.2, 1.25, 1.3]);
      const used = Math.round((d * pace * tu) / 60); // kWh
      const tr = 30 - tu;
      const limit = (d * 0.5 - used) / (tr / 60);
      const now = used / (tu / 60);
      const fmt = (n: number): string => nf(n, 0) + ' kW';
      const { choices, answer } = buildNumeric(limit, fmt, [
        (d * 0.5 - used) / tr, // 分のまま割る
        (d * 1 - used) / (tr / 60), // 枠を 1 時間分にする
        (d * 0.5 - used) / 0.5, // 時限全体の長さで割る
        2 * d - now, // 「超えた分だけ下げる」と考える
        now, // ここまでの平均のまま
        (d * 0.5) / (tr / 60), // 使った分を引き忘れる
        d * 0.5 - used, // 残りの電力量（kWh）で止める
      ]);
      return {
        question:
          'デマンド（30 分の平均電力）の目標を ' + nf(d, 0) + ' kW として監視している。ある時限の始めから ' + tu + ' 分間で ' +
          nf(used, 0) + ' kWh を使った。この時限のデマンドを目標以下にするには、残りの ' + tr +
          ' 分間の平均電力をおよそ何 kW 以下にすればよいか。',
        choices,
        answer,
        explanation:
          '**1. 時限に使える電力量の枠を出す。**$' + nf(d, 0) + '\\times0.5=' + nf(d * 0.5, 0) + '$ kWh。\n\n' +
          '**2. 残りの電力量を出す。**$' + nf(d * 0.5, 0) + '-' + nf(used, 0) + '=' + nf(d * 0.5 - used, 0) + '$ kWh。\n\n' +
          '**3. 残り時間を h に直して割る。**' + tr + ' 分 ＝ ' + nf(tr / 60, 4).replace(/0+$/, '') + ' h。' +
          '$' + nf(d * 0.5 - used, 0) + '/(' + tr + '/60)\\approx' + nf(limit, 0) + '$ kW。\n\n' +
          '**確かめ**：ここまでの平均は $' + nf(used, 0) + '/(' + tu + '/60)\\approx' + nf(now, 0) + '$ kW。' +
          (now > d
            ? '目標より速いペースで使ってきたので、残りの上限は目標より低くなる。'
            : '目標より控えめに使ってきたので、残りの上限は目標より高くなる。') +
          '\n\n**分のまま割ると 60 分の 1**（' + fmt((d * 0.5 - used) / tr) + '）になり、解答群のどこにも近い値がなくなる。' +
          'デマンドは時限の**平均**なので、前半の使い方で後半の上限が動く。',
      };
    },
  },

  // ------------------------------------------------------------ 課目Ⅱ 熱力学
  {
    id: 'tf-mayer',
    name: 'マイヤーの関係から比熱を出す',
    categoryId: 'k2-gas',
    sectionId: 'tf-2',
    summary: '気体定数を分子量で割って R にし、c_v ＝ R/(κ − 1)、c_p ＝ κR/(κ − 1)',
    generate: () => {
      const gas = pick([
        { name: '窒素', m: 28.0, k: 1.4 },
        { name: '酸素', m: 32.0, k: 1.4 },
        { name: '空気', m: 29.0, k: 1.4 },
        { name: '水素', m: 2.0, k: 1.41 },
        { name: 'アルゴン', m: 39.9, k: 1.67 },
        { name: 'メタン', m: 16.0, k: 1.31 },
      ]);
      const r0 = 8.314;
      const r = r0 / gas.m; // kJ/(kg·K)
      const cv = r / (gas.k - 1);
      const cp = gas.k * cv;
      const askCv = pick([true, false]);
      const val = askCv ? cv : cp;
      const fmt = (n: number): string => nf(n, 3) + ' kJ/(kg·K)';
      const { choices, answer } = buildNumeric(val, fmt, [
        askCv ? cp : cv, // もう一方を答える
        r / gas.k, // κ − 1 ではなく κ で割る
        r * gas.k, // 比熱比を掛けるだけ
        askCv ? r0 / (gas.k - 1) : (gas.k * r0) / (gas.k - 1), // 分子量で割り忘れる（モル基準の値のまま）
        askCv ? r * (gas.k - 1) : r * gas.k * (gas.k - 1), // κ − 1 で割らずに掛ける
        val * 1000, // J/(kg·K) のまま kJ と書く
        askCv ? cp + r : cv + r0, // c_p に R を足す／c_v にモル基準の気体定数を足す
      ]);
      const name = askCv ? '定容比熱' : '定圧比熱';
      return {
        question:
          gas.name + 'を理想気体とみなす。分子量を ' + nf(gas.m, 1) + '、比熱比を ' + nf(gas.k, 2) +
          '、一般気体定数を 8.314 J/(mol·K) とするとき、' + gas.name + 'の' + name + 'はおよそいくらか。',
        choices,
        answer,
        explanation:
          '**1. 1 kg あたりの気体定数にする。**一般気体定数を分子量で割る。J/(mol·K) を g/mol で割ると J/(g·K)、' +
          'つまり **kJ/(kg·K)** になる。$R=8.314/' + nf(gas.m, 1) + '=' + nf(r, 4) + '$ kJ/(kg·K)。\n\n' +
          '**2. マイヤーの関係と比熱比を連立する。**$c_p=c_v+R$、$\\kappa=c_p/c_v$ から $c_v=\\dfrac{R}{\\kappa-1}$、$c_p=\\dfrac{\\kappa R}{\\kappa-1}$。\n\n' +
          '**3. 代入する。**$c_v=' + nf(r, 4) + '/(' + nf(gas.k, 2) + '-1)=' + nf(cv, 3) + '$、' +
          '$c_p=' + nf(gas.k, 2) + '\\times' + nf(cv, 3) + '=' + nf(cp, 3) + '$ kJ/(kg·K)。訊かれているのは' + name + 'なので **' +
          nf(val, 3) + ' kJ/(kg·K)**。\n\n' +
          '**確かめ**：差 $' + nf(cp, 3) + '-' + nf(cv, 3) + '=' + nf(cp - cv, 3) + '$ が $R$ に、比が $\\kappa$ に戻る。' +
          '割る相手は $\\kappa-1$ である。$\\kappa$ で割ると ' + fmt(r / gas.k) + ' になる。',
      };
    },
  },
  {
    id: 'tf-isothermal-work',
    name: '等温圧縮に要る仕事',
    categoryId: 'k2-gas',
    sectionId: 'tf-3',
    summary: 'W ＝ mRT ln(p₂/p₁)。圧力は一定でないので積分が要る。ln の値は問題文が与える',
    generate: () => {
      const gas = pick([
        { name: '空気', r: 287 },
        { name: '窒素', r: 297 },
        { name: '酸素', r: 260 },
      ]);
      const t = pick(LN_TABLE.filter((e) => e.r >= 2));
      const m = pick([0.5, 1, 2, 3, 5]); // kg
      const tc = pick([10, 15, 20, 25, 30, 40]);
      const tk = tc + 273;
      const w = (m * gas.r * tk * t.ln) / 1000; // kJ
      const fmt = (n: number): string => nf(n, 1) + ' kJ';
      const { choices, answer } = buildNumeric(w, fmt, [
        (m * gas.r * tc * t.ln) / 1000, // ℃ のまま
        (m * gas.r * tk * t.r) / 1000, // 対数を取らず圧力比をそのまま
        (m * gas.r * tk * (t.r - 1)) / 1000, // 圧縮後の圧力が一定とみなす（p₂ΔV）
        (m * gas.r * tk * (1 - 1 / t.r)) / 1000, // 圧縮前の圧力が一定とみなす（p₁ΔV）
        m * gas.r * tk * t.ln, // J のまま kJ と書く
        (gas.r * tk * t.ln) / 1000, // 質量を掛け忘れる（1 kg あたりの値で止める）
      ]);
      return {
        question:
          gas.name + ' ' + nf(m, 1).replace(/\.0$/, '') + ' kg を、温度 ' + tc + ' ℃ に保ったまま、圧力が ' + t.r +
          ' 倍になるまでゆっくり（可逆に）圧縮した。外から加えた仕事の大きさはおよそいくらか。' +
          gas.name + 'は理想気体とし、気体定数を ' + gas.r + ' J/(kg·K)、絶対温度は ℃ の値に 273 を足した値、ln ' + t.r + ' ＝ ' +
          t.ln.toFixed(3) + ' とする。',
        choices,
        answer,
        explanation:
          '**1. 絶対温度にする。**$' + tc + '+273=' + tk + '$ K。\n\n' +
          '**2. 式を選ぶ。**等温では $p=mRT/V$ が体積とともに動くので、**圧力を一定とみなせない**。積分して ' +
          '$W=mRT\\ln\\dfrac{V_2}{V_1}=mRT\\ln\\dfrac{p_1}{p_2}$。圧縮では $p_2>p_1$ なので負になり、' +
          '外から加えた仕事の大きさは $mRT\\ln(p_2/p_1)$ である。\n\n' +
          '**3. 代入する。**$' + nf(m, 1).replace(/\.0$/, '') + '\\times' + gas.r + '\\times' + tk + '\\times' + t.ln.toFixed(3) +
          '\\approx' + nf(m * gas.r * tk * t.ln, 0) + '$ J ＝ **' + nf(w, 1) + ' kJ**。\n\n' +
          '**気体定数が J で与えられているので、出てくるのは J。**kJ に直すのを忘れると 1000 倍ずれる。\n\n' +
          '**等温なので内部エネルギーは変わらず**、加えた仕事と同じ ' + nf(w, 1) + ' kJ の熱が外へ出ていく。\n\n' +
          '**℃ のまま入れると** ' + fmt((m * gas.r * tc * t.ln) / 1000) + '、圧力を一定とみなして $p\\Delta V$ にすると ' +
          fmt((m * gas.r * tk * (1 - 1 / t.r)) / 1000) + ' や ' + fmt((m * gas.r * tk * (t.r - 1)) / 1000) +
          ' になる。正しい値は、この 2 つのあいだに入る。',
      };
    },
  },
  {
    id: 'tf-adiabatic-temp',
    name: '可逆断熱圧縮の後の温度',
    categoryId: 'k2-gas',
    sectionId: 'tf-4',
    summary: 'T₂/T₁ ＝ (p₂/p₁)^((κ−1)/κ)。体積比なら κ − 1 乗。累乗の値は問題文の表から選ぶ',
    generate: () => {
      const k = pick([1.4, 1.3]);
      const r = pick([2, 3, 4, 5, 6, 8, 10]);
      const fp = Number(Math.pow(r, (k - 1) / k).toFixed(3)); // 圧力比の (κ−1)/κ 乗
      const fv = Number(Math.pow(r, k - 1).toFixed(3)); // 同じ数の κ − 1 乗（体積比なら使う）
      const t1c = pick([10, 15, 20, 25, 30, 35]);
      const t1 = t1c + 273;
      const t2 = t1 * fp;
      const t2c = t2 - 273;
      const fmt = (n: number): string => nf(n, 1) + ' ℃';
      const { choices, answer } = buildNumeric(t2c, fmt, [
        t1c * fp, // ℃ のまま掛ける
        t2, // K のまま答える
        t1 * fv - 273, // 体積比の式に圧力比を入れる
        t1 * (fp - 1), // 温度の上がり幅を答える
        t1 * r - 273, // 温度比を圧力比そのものとする
      ]);
      const kTxt = nf(k, 1);
      const kmTxt = nf(k - 1, 1);
      return {
        question:
          '比熱比 ' + kTxt + ' の理想気体を、' + t1c + ' ℃ から可逆断熱圧縮して圧力を ' + r +
          ' 倍にした。圧縮後の温度はおよそ何 ℃ か。絶対温度は ℃ の値に 273 を足した値とする。' +
          '必要なら次の値を使ってよい：' + r + ' の ' + kmTxt + '/' + kTxt + ' 乗 ＝ ' + fp.toFixed(3) + '、' + r + ' の ' +
          kmTxt + ' 乗 ＝ ' + fv.toFixed(3) + '。',
        choices,
        answer,
        explanation:
          '**1. 式を選ぶ。**可逆断熱変化では $\\dfrac{T_2}{T_1}=\\left(\\dfrac{v_1}{v_2}\\right)^{\\kappa-1}=\\left(\\dfrac{p_2}{p_1}\\right)^{(\\kappa-1)/\\kappa}$。' +
          '**与えられているのは圧力比**なので $(\\kappa-1)/\\kappa$ 乗の ' + fp.toFixed(3) + ' を使う。' +
          kmTxt + ' 乗の ' + fv.toFixed(3) + ' は体積比が与えられたときの値である。\n\n' +
          '**2. 絶対温度にする。**$' + t1c + '+273=' + t1 + '$ K。\n\n' +
          '**3. 掛ける。**$' + t1 + '\\times' + fp.toFixed(3) + '\\approx' + nf(t2, 1) + '$ K。\n\n' +
          '**4. ℃ へ戻す。**$' + nf(t2, 1) + '-273=' + nf(t2c, 1) + '$ ℃。\n\n' +
          '**℃ のまま掛けると** ' + fmt(t1c * fp) + '、**4 を忘れると** ' + nf(t2, 1) + ' になる。' +
          '比で扱う式には必ず絶対温度を入れる。\n\n' +
          '**確かめ**：断熱圧縮では温度が上がる。下がる値が出たら、圧縮と膨張を取り違えている。',
      };
    },
  },

  // ------------------------------------------------------------ 課目Ⅱ 蒸気
  {
    id: 'tf-wet-steam-heat',
    name: '湿り蒸気を定圧で加熱する熱量',
    categoryId: 'k2-vapor',
    sectionId: 'tf-13',
    summary: 'h ＝ h′ ＋ xr、r ＝ h″ − h′。定圧の加熱量は比エンタルピーの差 × 質量。乾き度は r に掛ける',
    generate: () => {
      // 飽和表は IAPWS-IF97（SAT_HG）。確認問題 k2-vapor の場面（絞り熱量計・タービン）と数値の組は使わない
      const sat = pick(SAT_HG);
      const r = Number((sat.hg - sat.hf).toFixed(1));
      const m = pick([2, 5, 10, 20, 50]); // kg
      const x1 = pick([0.7, 0.75, 0.8, 0.85, 0.9]);
      const x2 = pick([0.92, 0.95, 0.98, 1.0].filter((v) => v - x1 >= 0.05 - 1e-9));
      const q = (m * (x2 - x1) * r) / 1000; // MJ
      const dg = q < 1 ? 3 : q < 10 ? 2 : 1;
      const fmt = (n: number): string => nf(n, dg) + ' MJ';
      const { choices, answer } = buildNumeric(q, fmt, [
        (m * (x2 - x1) * sat.hg) / 1000, // h ＝ xh″ として、乾き度を h″ に掛ける
        (m * x2 * r) / 1000, // 加熱前の乾き度を落とす（全部を蒸発させたように数える）
        (m * (sat.hf + x2 * r)) / 1000, // 加熱後の比エンタルピーそのものに質量を掛ける
        ((x2 - x1) * r) / 1000, // 質量を掛け忘れる
        (m * (x2 - x1) * sat.hf) / 1000, // 蒸発熱の代わりに h′ を使う
        (m * (1 - x1) * r) / 1000, // 乾き飽和蒸気まで加熱したとする
        m * (x2 - x1) * r, // kJ のまま MJ と書く
      ]);
      const mf = (n: number, digits: number): string => n.toFixed(digits); // 数式用（カンマなし）
      const x2txt = x2 === 1 ? '乾き飽和蒸気' : '乾き度 ' + nf(x2, 2) + ' の湿り蒸気';
      return {
        question:
          'ピストン付きのシリンダの中に、圧力 ' + nf(sat.p, 1) + ' MPa（絶対圧）、乾き度 ' + nf(x1, 2) + ' の湿り蒸気が ' + m +
          ' kg ある。圧力を一定に保ったまま加熱して、' + x2txt + 'にした。加えた熱量はおよそいくらか。' +
          nf(sat.p, 1) + ' MPa の飽和水の比エンタルピー h′ を ' + nf(sat.hf, 1) + ' kJ/kg、乾き飽和蒸気の比エンタルピー h″ を ' +
          nf(sat.hg, 1) + ' kJ/kg とし、運動エネルギーと位置エネルギーの変化は無視する。',
        choices,
        answer,
        explanation:
          '**1. 定圧の加熱量は比エンタルピーの差。**閉じた系で圧力一定なら、$Q=\\Delta U+p\\Delta V=\\Delta H$。' +
          'だから $Q=m(h_{2}-h_{1})$。\n\n' +
          '**2. 蒸発熱を出す。**$r=h\'\'-h\'=' + mf(sat.hg, 1) + '-' + mf(sat.hf, 1) + '=' + mf(r, 1) + '$ kJ/kg。\n\n' +
          '**3. 湿り蒸気の比エンタルピー。**湿り蒸気は飽和水と乾き飽和蒸気の混合物なので、$h=h\'+xr$。' +
          '$h_{1}=' + mf(sat.hf, 1) + '+' + mf(x1, 2) + '\\times' + mf(r, 1) + '\\approx' + mf(sat.hf + x1 * r, 1) + '$、' +
          '$h_{2}=' + mf(sat.hf, 1) + '+' + mf(x2, 2) + '\\times' + mf(r, 1) + '\\approx' + mf(sat.hf + x2 * r, 1) + '$ kJ/kg。\n\n' +
          '**4. 差を取って質量を掛ける。**$h\'$ は両方に入っているので消え、$h_{2}-h_{1}=(x_{2}-x_{1})r=' + mf(x2 - x1, 2) + '\\times' +
          mf(r, 1) + '\\approx' + mf((x2 - x1) * r, 1) + '$ kJ/kg。$Q=' + m + '\\times' + mf((x2 - x1) * r, 1) + '\\approx' +
          mf(q * 1000, 0) + '$ kJ ＝ **' + fmt(q) + '**。\n\n' +
          '**乾き度は蒸発熱 $r$ に掛ける。**$h=xh\'\'$ として $h\'\'$ に掛けると ' + fmt((m * (x2 - x1) * sat.hg) / 1000) +
          ' になる。$x$ は蒸気の質量の割合で、液の分も飽和水の $h\'$ を持っている。\n\n' +
          '**確かめ**：温度は飽和温度のまま変わらず、加えた熱はすべて残りの液の蒸発に使われる。' +
          '蒸発した量は $' + m + '\\times' + mf(x2 - x1, 2) + '=' + mf(m * (x2 - x1), 2) + '$ kg で、これに $r$ を掛けた値と一致する。',
      };
    },
  },

  // ------------------------------------------------------------ 課目Ⅱ 流体
  {
    id: 'tf-continuity',
    name: '連続の式で流速を出す',
    categoryId: 'k2-fluid',
    sectionId: 'tf-19',
    summary: '非圧縮なら Q ＝ A₁u₁ ＝ A₂u₂。面積は径の 2 乗に比例する',
    generate: () => {
      const d1 = pick([80, 100, 125, 150, 200]); // mm
      const d2 = pick([25, 32, 40, 50, 65].filter((x) => d1 / x >= 1.5));
      const u1 = pick([0.4, 0.5, 0.6, 0.8, 1.0, 1.2]); // m/s
      const ratio = d1 / d2;
      const u2 = u1 * ratio * ratio;
      const fmt = (n: number): string => nf(n, 2) + ' m/s';
      const { choices, answer } = buildNumeric(u2, fmt, [
        u1 * ratio, // 2 乗を忘れる
        u1 / (ratio * ratio), // 比を逆に取る
        u1 * ratio * ratio * ratio, // 3 乗にしてしまう
        u1 * ratio * ratio * (4 / Math.PI), // 面積の 4/π を片側だけに付ける
        u1 / ratio, // 比を逆に取り、2 乗も忘れる
        u1 * ratio * 2, // 径の比を 2 倍する（2 乗と取り違える）
      ]);
      return {
        question:
          '内径 ' + d1 + ' mm の管を平均流速 ' + nf(u1, 1) + ' m/s で流れている水が、内径 ' + d2 +
          ' mm の管へ入る。細い管の中の平均流速はおよそいくらか。水は非圧縮性流体とし、管は満水で流れているものとする。',
        choices,
        answer,
        explanation:
          '**非圧縮性流体では、体積流量がどの断面でも等しい。**$Q=A_1u_1=A_2u_2$。\n\n' +
          '**1. 面積の比を出す。**円の面積 $\\pi d^2/4$ は径の 2 乗に比例するので、$A_1/A_2=(' + d1 + '/' + d2 + ')^2=' +
          nf(ratio * ratio, 3) + '$。$\\pi/4$ は両辺で約される。\n\n' +
          '**2. 流速に掛ける。**$u_2=u_1\\dfrac{A_1}{A_2}=' + nf(u1, 1) + '\\times' + nf(ratio * ratio, 3) + '\\approx' +
          nf(u2, 2) + '$ m/s。\n\n' +
          '**mm のままでよい。**比を取るので単位が約される。両方を同じ単位にそろえておくことだけが条件である。\n\n' +
          '**2 乗を忘れると** ' + fmt(u1 * ratio) + ' になる。**確かめ**：細くなれば速くなる。逆向きの値は消せる。',
      };
    },
  },
  {
    id: 'tf-torricelli',
    name: 'タンクの穴からの流出速度',
    categoryId: 'k2-fluid',
    sectionId: 'tf-20',
    summary: 'u ＝ √(2gh)。h は液面から穴までの深さ。開平は電卓で打てる',
    generate: () => {
      const hh = pick([3, 4, 5, 6, 8, 10]); // 底から液面まで m
      const z = pick([0.5, 1.0, 1.5, 2.0]); // 底から穴まで m
      const h = hh - z;
      const g = 9.8;
      const u = Math.sqrt(2 * g * h);
      const fmt = (n: number): string => nf(n, 2) + ' m/s';
      const { choices, answer } = buildNumeric(u, fmt, [
        Math.sqrt(2 * g * hh), // 底からの液面の高さを使う
        Math.sqrt(2 * g * z), // 穴の高さを使う
        Math.sqrt(g * h), // 2 を落とす
        2 * g * h, // 平方根を取り忘れる
        Math.sqrt(2 * h), // g を落とす
        g * h, // 平方根も 2 も落とす
      ]);
      return {
        question:
          '大きな開放タンクに、底から ' + hh + ' m の高さまで水が入っている。タンクの側面の、底から ' + nf(z, 1) +
          ' m の高さに小さな穴が開いている。穴から流れ出る水の速度はおよそいくらか。' +
          '重力加速度を 9.8 m/s² とし、損失と液面の降下速度は無視できるものとする。',
        choices,
        answer,
        explanation:
          '**1. 2 点を決める。**液面と穴の出口でベルヌーイの式を立てる。どちらも大気に開いているので、' +
          '**両辺に同じ大気圧があり、引き算で消える。**\n\n' +
          '**2. 条件を使う。**タンクは穴よりずっと大きいので、液面の降下速度は 0 と置ける。残るのは $u=\\sqrt{2gh}$。\n\n' +
          '**3. 深さを出す。**$h$ は**液面から穴までの深さ**で、$' + hh + '-' + nf(z, 1) + '=' + nf(h, 1) + '$ m。底からの高さ ' + hh +
          ' m ではない。\n\n' +
          '**4. 代入する。**$\\sqrt{2\\times9.8\\times' + nf(h, 1) + '}=\\sqrt{' + nf(2 * g * h, 2) + '}\\approx' + nf(u, 2) +
          '$ m/s。√ キーは試験の電卓で使える。\n\n' +
          '**平方根を取り忘れると** ' + nf(2 * g * h, 2) + ' になり、単位も m/s にならない。' +
          '**確かめ**：深さを 4 倍にしても、速度は 2 倍にしかならない。',
      };
    },
  },
  {
    id: 'tf-reynolds',
    name: 'レイノルズ数',
    categoryId: 'k2-fluid',
    sectionId: 'tf-21',
    summary: 'Re ＝ ρud/μ ＝ ud/ν。径は m に直す。値を出したら目安と並べて判定する',
    generate: () => {
      const useNu = pick([true, false]);
      const u = pick([0.3, 0.5, 0.8, 1.0, 1.5, 2.0, 2.5]); // m/s
      const dm = pick([15, 20, 25, 40, 50, 80, 100]); // 内径 mm
      // 管は外径と肉厚で与え、内径は引き算で出させる（外径を使う・肉厚を片側だけ引く、の誤答が正解の定数倍にならない）
      const wall = pick([1.5, 2, 2.5, 3, 3.5, 4, 5].filter((t) => t / dm >= 0.035 && t / dm <= 0.2)); // 肉厚 mm
      const dOut = dm + 2 * wall; // 外径 mm
      const d = dm / 1000;
      let re: number;
      let given: string;
      let calc: string;
      let wrongs: number[];
      if (useNu) {
        const nu = pick([
          { v: 0.8, fluid: '水' },
          { v: 1.0, fluid: '水' },
          { v: 1.3, fluid: '水' },
          { v: 20, fluid: '油' },
          { v: 50, fluid: '油' },
          { v: 100, fluid: '油' },
        ]);
        const nuSI = nu.v * 1e-6;
        re = (u * d) / nuSI;
        given = '動粘度 ' + nf(nu.v, 1).replace(/\.0$/, '') + '×10⁻⁶ m²/s の' + nu.fluid;
        calc = '$Re=\\dfrac{ud}{\\nu}=\\dfrac{' + nf(u, 1) + '\\times' + d + '}{' + nf(nu.v, 1).replace(/\.0$/, '') + '\\times10^{-6}}\\approx' +
          nf(re, 0) + '$';
        wrongs = [
          re * 1000, // 径を mm のまま
          re / 2, // 半径を使う
          re / 1000, // 10⁻⁶ を 10⁻³ と読む
          (re * dOut) / dm, // 内径ではなく外径を使う
          (re * (dOut - wall)) / dm, // 肉厚を片側だけ引く
          (re * dOut * 1000) / dm, // 外径を使い、しかも mm のまま
        ];
      } else {
        const fl = pick([
          { rho: 1000, mu: 0.001, fluid: '水' },
          { rho: 1000, mu: 0.0008, fluid: '水' },
          { rho: 1000, mu: 0.0013, fluid: '水' },
          { rho: 850, mu: 0.02, fluid: '油' },
          { rho: 900, mu: 0.05, fluid: '油' },
          { rho: 880, mu: 0.1, fluid: '油' },
        ]);
        re = (fl.rho * u * d) / fl.mu;
        given = '密度 ' + fl.rho + ' kg/m³、粘度 ' + fl.mu + ' Pa·s の' + fl.fluid;
        calc = '$Re=\\dfrac{\\rho ud}{\\mu}=\\dfrac{' + fl.rho + '\\times' + nf(u, 1) + '\\times' + d + '}{' + fl.mu + '}\\approx' +
          nf(re, 0) + '$';
        wrongs = [
          re * 1000, // 径を mm のまま
          re / 2, // 半径を使う
          (u * d) / fl.mu, // 密度を掛け忘れる
          (re * dOut) / dm, // 内径ではなく外径を使う
          (re * (dOut - wall)) / dm, // 肉厚を片側だけ引く
          (re * dOut * 1000) / dm, // 外径を使い、しかも mm のまま
        ];
      }
      const fmt = (n: number): string => nf(n, 0);
      const { choices, answer } = buildNumeric(re, fmt, wrongs);
      const judge =
        re < 2300
          ? '2,300 より小さいので層流と判定される'
          : re > 4000
            ? '4,000 より大きいので乱流と判定される'
            : '2,300 と 4,000 のあいだにあり、遷移域（どちらとも言い切れない）'
      ;
      return {
        question:
          '外径 ' + nf(dOut, 0) + ' mm、肉厚 ' + fx(wall, 1) + ' mm の円管の中を、' + given + 'が平均流速 ' + nf(u, 1) +
          ' m/s で満たして流れている。レイノルズ数はおよそいくらか。',
        choices,
        answer,
        explanation:
          '**1. 内径を出して m に直す。**流れが通るのは管の内側なので、代表長さは**内径**（外径でも半径でもない）。' +
          '肉厚は両側にあるので $' + nf(dOut, 0) + '-2\\times' + fx(wall, 1) + '=' + dm + '$ mm ＝ ' + d + ' m。\n\n' +
          '**2. 代入する。**' + calc + '。\n\n' +
          '**3. 判定する。**一般的な目安（2,300 と 4,000。問題文に基準があればそちら）と並べると、この値は ' + judge + '。\n\n' +
          '**レイノルズ数は無次元。**単位が残ったら組み方を誤っている。動粘度 $\\nu=\\mu/\\rho$ を使うときは、密度をもう一度掛けない。\n\n' +
          '**径を mm のまま入れると 1000 倍**（' + fmt(re * 1000) + '）、**外径のまま入れると** ' + fmt((re * dOut) / dm) +
          '、肉厚を片側だけ引くと ' + fmt((re * (dOut - wall)) / dm) + ' になる。',
      };
    },
  },
  {
    id: 'tf-pressure-loss',
    name: '直管の摩擦による圧力損失',
    categoryId: 'k2-fluid',
    sectionId: 'tf-22',
    summary: 'Δp ＝ λ(L/d)(ρu²/2)。ダルシーの λ。流速の 2 乗と、径を m に直すこと',
    generate: () => {
      const lam = pick([0.018, 0.02, 0.025, 0.03, 0.035]);
      const len = pick([30, 60, 80, 120, 150, 250]); // m
      const dm = pick([40, 50, 65, 80, 100, 125]); // mm
      const rho = pick([850, 900, 1000]);
      const u = pick([1.2, 1.5, 1.8, 2.5, 3.0]); // m/s（2.0 は入れない。√ や 2 倍の誤りと値が重なりやすい）
      const g = 9.8;
      const d = dm / 1000;
      const dp = lam * (len / d) * ((rho * u * u) / 2); // Pa
      const kpa = dp / 1000;
      // 有効数字 3 桁ほどにそろえる（2.6 kPa を 1 桁で丸めると 2 % ずれる）
      const dg = kpa < 10 ? 2 : kpa < 100 ? 1 : 0;
      const fmt = (n: number): string => nf(n, dg) + ' kPa';
      const { choices, answer } = buildNumeric(kpa, fmt, [
        kpa / u, // 2 乗を忘れる
        kpa * 4, // ファニングの f を λ と思って 4 を掛ける
        kpa * 2, // 2 で割り忘れ
        dp / (rho * g), // 損失水頭 m を kPa と書く
        kpa / 1000, // 径を mm のまま
        dp, // Pa のまま kPa と書く
        kpa * u, // 流速を 3 乗にする（動力の比例と取り違える）
        kpa + (rho * u * u) / 2 / 1000, // 管の出口で失う速度水頭（動圧 1 つ分）まで足す
      ]);
      return {
        question:
          '内径 ' + dm + ' mm、長さ ' + len + ' m の水平な直管を、密度 ' + rho + ' kg/m³ の液体が平均流速 ' + nf(u, 1) +
          ' m/s で流れている。管摩擦係数（ダルシー・ワイスバッハの式の λ）を ' + lam + '、重力加速度を 9.8 m/s² とするとき、' +
          'この直管の摩擦による圧力損失はおよそいくらか。',
        choices,
        answer,
        explanation:
          '**式**：$\\Delta p=\\lambda\\dfrac{L}{d}\\dfrac{\\rho u^2}{2}$（ダルシー・ワイスバッハ）。\n\n' +
          '**1. 径を m に直す。**' + dm + ' mm ＝ ' + d + ' m。$L/d=' + len + '/' + d + '=' + nf(len / d, 0) + '$。\n\n' +
          '**2. 動圧を出す。**$\\rho u^2/2=' + rho + '\\times' + nf(u, 1) + '^2/2=' + nf((rho * u * u) / 2, 1) + '$ Pa。\n\n' +
          '**3. 掛ける。**$' + lam + '\\times' + nf(len / d, 0) + '\\times' + nf((rho * u * u) / 2, 1) + '\\approx' + nf(dp, 0) +
          '$ Pa ＝ **' + fmt(kpa) + '**。\n\n' +
          '重力加速度は圧力損失には使わない。損失水頭 $h_f=\\Delta p/(\\rho g)\\approx' + nf(dp / (rho * g), 2) + '$ m を出すときに使う。' +
          '水頭（m）と圧力（kPa）を取り違えると ' + fmt(dp / (rho * g)) + ' を選ぶことになる。\n\n' +
          'ファニングの摩擦係数 $f$ で書く式では $\\lambda=4f$ になる。問題文の式の形でどちらかを確かめる。\n\n' +
          '**確かめ**：$\\lambda$ が一定なら損失は流速の 2 乗に比例する。2 乗を忘れると ' + fmt(kpa / u) + ' になる。',
      };
    },
  },

  // ------------------------------------------------------------ 課目Ⅱ 伝熱
  {
    id: 'tf-overall-k',
    name: '平板の熱通過率',
    categoryId: 'k2-heat',
    sectionId: 'tf-30',
    summary: '1/K ＝ 1/h₁ ＋ δ/λ ＋ 1/h₂。抵抗を足して逆数を取る。厚さは m に直す',
    generate: () => {
      const h1 = pick([500, 800, 1200, 1500, 2500, 4000]); // W/(m²·K)
      const h2 = pick([30, 50, 80, 150, 300, 600]);
      const dmm = pick([2, 3, 4, 5, 6, 8]);
      const lam = pick([15, 16, 20, 45, 50]); // W/(m·K)
      const res = 1 / h1 + dmm / 1000 / lam + 1 / h2;
      const k = 1 / res;
      const fmt = (n: number): string => nf(n, 1) + ' W/(m²·K)';
      const { choices, answer } = buildNumeric(k, fmt, [
        h1 + h2, // 熱伝達率を足す
        (h1 + h2) / 2, // 熱伝達率の平均
        1 / (1 / h1 + dmm / lam + 1 / h2), // 厚さを mm のまま
        1 / (1 / h1 + 1 / h2), // 壁を落とす
        1 / (1 / h1 + (dmm / 1000) * lam + 1 / h2), // 壁の抵抗を δλ と掛けてしまう
        Math.min(h1, h2), // 小さいほうの熱伝達率で代用する
      ]);
      const big =
        1 / h2 >= 1 / h1 && 1 / h2 >= dmm / 1000 / lam
          ? '外側の境膜（$1/h_2$）'
          : 1 / h1 >= dmm / 1000 / lam
            ? '内側の境膜（$1/h_1$）'
            : '壁（$\\delta/\\lambda$）';
      return {
        question:
          '厚さ ' + dmm + ' mm、熱伝導率 ' + lam + ' W/(m·K) の平板の壁を隔てて熱が伝わる。一方の面の熱伝達率は ' + nf(h1, 0) +
          ' W/(m²·K)、他方の面の熱伝達率は ' + h2 + ' W/(m²·K) である。この壁の熱通過率（総括伝熱係数）はおよそいくらか。汚れは考えない。',
        choices,
        answer,
        explanation:
          '**熱は境膜 → 壁 → 境膜を順に通る。**直列の抵抗なので、面積 1 m² あたりの抵抗を足して逆数を取る：' +
          '$\\dfrac{1}{K}=\\dfrac{1}{h_1}+\\dfrac{\\delta}{\\lambda}+\\dfrac{1}{h_2}$。\n\n' +
          '**1. 厚さを m に直す。**' + dmm + ' mm ＝ ' + dmm / 1000 + ' m。\n\n' +
          '**2. 3 つの抵抗を足す。**$1/' + h1 + '=' + nf(1 / h1, 6) + '$、$' + dmm / 1000 + '/' + lam + '=' +
          nf(dmm / 1000 / lam, 6) + '$、$1/' + h2 + '=' + nf(1 / h2, 6) + '$。合計 $' + nf(res, 6) + '$ m²·K/W。\n\n' +
          '**3. 逆数を取る。**$K=1/' + nf(res, 6) + '\\approx' + nf(k, 1) + '$ W/(m²·K)。\n\n' +
          '**確かめ**：いちばん大きい抵抗は' + big + 'で、熱通過率 $K$ は小さいほうの熱伝達率 ' + Math.min(h1, h2) +
          ' より小さくなる。熱伝達率を足したり平均したりした値は、この確かめで消せる。\n\n' +
          '**厚さを mm のまま入れると**壁の抵抗が 1000 倍になり、' + fmt(1 / (1 / h1 + dmm / lam + 1 / h2)) + ' になる。',
      };
    },
  },
  {
    id: 'tf-lmtd',
    name: '対数平均温度差（向流と並流）',
    categoryId: 'k2-heat',
    sectionId: 'tf-33',
    summary: '流れ方で両端の温度差の組を決め、差を比の対数で割る。ln の値は問題文が与える',
    generate: () => {
      const t = pick(LN_TABLE);
      const d2 = pick([10, 12, 16, 20, 24, 30, 40]);
      const d1 = d2 * t.r;
      const tcIn = pick([10, 15, 20, 25, 30]);
      let counter = pick([true, false]);
      if (!counter && d1 - d2 < 20) counter = true;
      let thIn: number;
      let thOut: number;
      let tcOut: number;
      let wrongPair: [number, number];
      if (counter) {
        // 向流：高温側の入口 ↔ 低温側の出口、高温側の出口 ↔ 低温側の入口
        let bigHot = pick([true, false]);
        let rises = [20, 30, 40, 50, 60, 80].filter((r) => r + (bigHot ? d1 - d2 : d2 - d1) >= 10);
        if (rises.length === 0) {
          bigHot = true;
          rises = [20, 30, 40, 50, 60, 80];
        }
        const dHot = bigHot ? d1 : d2;
        const dCold = bigHot ? d2 : d1;
        const rise = pick(rises);
        tcOut = tcIn + rise;
        thIn = tcOut + dHot;
        thOut = tcIn + dCold;
        wrongPair = [thIn - tcIn, thOut - tcOut];
      } else {
        // 並流：入口どうし、出口どうし
        const rise = pick([10, 15, 20, 30, 40, 50, 60].filter((r) => d1 - d2 - r >= 10));
        thIn = tcIn + d1;
        tcOut = tcIn + rise;
        thOut = tcOut + d2;
        wrongPair = [thIn - tcOut, thOut - tcIn];
      }
      const lmtd = (d1 - d2) / t.ln;
      const lmOf = (a: number, b: number): number =>
        a <= 0 || b <= 0 ? Number.NaN : a === b ? a : (a - b) / Math.log(a / b);
      const fmt = (n: number): string => nf(n, 1) + ' K';
      const { choices, answer } = buildNumeric(lmtd, fmt, [
        (d1 + d2) / 2, // 算術平均
        lmOf(wrongPair[0], wrongPair[1]), // 向流と並流の組を取り違える
        d1 - d2, // 差のまま
        (d1 - d2) * t.ln, // 対数で割らずに掛ける
        Math.sqrt(d1 * d2), // 相乗平均で代用する
        d2, // 小さいほうの端の温度差で代用する
        d1, // 大きいほうの端の温度差で代用する
        d1 + d2, // 算術平均の 2 で割り忘れ
        thIn - thOut, // 高温流体の温度変化を温度差と取り違える
        tcOut - tcIn, // 低温流体の温度変化を温度差と取り違える
      ]);
      const flow = counter ? '向流' : '並流';
      return {
        question:
          flow + '形の熱交換器で、高温流体が ' + thIn + ' ℃ から ' + thOut + ' ℃ まで冷え、低温流体が ' + tcIn + ' ℃ から ' +
          tcOut + ' ℃ まで温まる。対数平均温度差はおよそいくらか。ln ' + t.r + ' ＝ ' + t.ln.toFixed(3) + ' とする。',
        choices,
        answer,
        explanation:
          '**1. 両端の温度差の組を決める。**' +
          (counter
            ? '向流では、高温流体の入口と低温流体の出口が同じ端にある。$\\Delta T_a=' + thIn + '-' + tcOut + '=' + (thIn - tcOut) +
              '$ K、$\\Delta T_b=' + thOut + '-' + tcIn + '=' + (thOut - tcIn) + '$ K。'
            : '並流では、入口どうし・出口どうしが同じ端にある。$\\Delta T_a=' + thIn + '-' + tcIn + '=' + (thIn - tcIn) +
              '$ K、$\\Delta T_b=' + thOut + '-' + tcOut + '=' + (thOut - tcOut) + '$ K。') +
          '\n\n' +
          '**2. 大きいほうを ΔT₁ にする。**$\\Delta T_1=' + d1 + '$ K、$\\Delta T_2=' + d2 + '$ K、比は $' + d1 + '/' + d2 + '=' + t.r + '$。\n\n' +
          '**3. 代入する。**$\\Delta T_{lm}=\\dfrac{\\Delta T_1-\\Delta T_2}{\\ln(\\Delta T_1/\\Delta T_2)}=\\dfrac{' + (d1 - d2) + '}{' +
          t.ln.toFixed(3) + '}\\approx' + nf(lmtd, 1) + '$ K。\n\n' +
          '**確かめ**：対数平均は算術平均（' + nf((d1 + d2) / 2, 1) + ' K）より必ず小さく、$\\Delta T_2$ より大きい。\n\n' +
          '**相乗平均 $\\sqrt{\\Delta T_1\\Delta T_2}=' + nf(Math.sqrt(d1 * d2), 1) + '$ K で代用しない。**' +
          '3 つの平均は、相乗平均 ≦ 対数平均 ≦ 算術平均 の順に並ぶ。比 $\\Delta T_1/\\Delta T_2$ が 1 に近いと 3 つとも近い値になるが、' +
          '比が大きくなるほど離れる。ln の値が与えられているのは、対数平均を出すためである。\n\n' +
          '**流体の温度変化（高温側 ' + (thIn - thOut) + ' K、低温側 ' + (tcOut - tcIn) + ' K）は温度差ではない。**' +
          '使うのは、同じ端での高温流体と低温流体の温度の差である。\n\n' +
          '**温度差は K でも ℃ でも同じ値**なので、273 を足す必要はない。' +
          '**流れ方を取り違えて組を逆にすると**、比が与えられた ln の値に合わなくなる。そこで気づける。',
      };
    },
  },
  {
    id: 'tf-tube-length',
    name: '熱交換器の伝熱管の長さ',
    categoryId: 'k2-heat',
    sectionId: 'tf-33',
    summary: 'A ＝ Q/(KΔT_lm) で面積を出し、πd で割って長さにする。kW を W に、mm を m に',
    generate: () => {
      const q = pick([30, 40, 60, 75, 90, 120, 150]); // kW
      const k = pick([250, 350, 450, 600, 700, 900]); // W/(m²·K)
      const dt = pick([12, 18, 22, 28, 35, 45]); // K
      const dm = pick([19, 25, 32, 38, 48]); // mm
      const pi = 3.14;
      const area = (q * 1000) / (k * dt);
      const len = area / (pi * (dm / 1000));
      const fmt = (n: number): string => nf(n, 1) + ' m';
      const { choices, answer } = buildNumeric(len, fmt, [
        area, // 面積で止める
        area / (dm / 1000), // π を掛け忘れる
        2 * len, // 半径で円周を出す（πr）
        len / 2, // 円周を 2πd とする
        len / 1000, // kW を W に直し忘れる
        area / ((pi * (dm / 1000) * (dm / 1000)) / 4), // 側面積ではなく管の断面積で割る
      ]);
      return {
        question:
          '伝熱量 ' + q + ' kW、熱通過率（管の平均径基準）' + k + ' W/(m²·K)、対数平均温度差 ' + dt +
          ' K の熱交換器を、平均径 ' + dm + ' mm の伝熱管 1 本で作る。必要な管の長さはおよそいくらか。円周率は 3.14 とする。',
        choices,
        answer,
        explanation:
          '**1. 伝熱量を W に直す。**' + q + ' kW ＝ ' + nf(q * 1000, 0) + ' W。\n\n' +
          '**2. 伝熱面積を出す。**$Q=KA\\Delta T_{lm}$ から $A=\\dfrac{' + q * 1000 + '}{' + k + '\\times' + dt + '}\\approx' + nf(area, 3) + '$ m²。\n\n' +
          '**3. 長さに直す。**管の側面積は $\\pi dL$。径を m に直して（' + dm + ' mm ＝ ' + dm / 1000 + ' m）、' +
          '$L=\\dfrac{' + nf(area, 3) + '}{3.14\\times' + dm / 1000 + '}\\approx' + nf(len, 1) + '$ m。\n\n' +
          '**面積 ' + nf(area, 3) + ' m² で止めないこと。**訊かれているのは長さ。\n\n' +
          '**熱通過率の基準と面積の基準をそろえる。**今回は平均径基準なので、平均径で側面積を出す。' +
          '内径基準・外径基準で与えられたら、その径を使う。',
      };
    },
  },

  // ------------------------------------------------------------ 課目Ⅲ 燃料
  {
    id: 'fc-heating-value',
    name: '生成エンタルピーから発熱量を出す',
    categoryId: 'k3-fuel',
    sectionId: 'fc-1',
    summary: '生成物の和 − 反応物の和（ヘスの法則）。水を液体で入れれば高発熱量、気体なら低発熱量',
    generate: () => {
      const fuel = pick([
        { name: 'メタン', formula: 'CH₄', x: 1, y: 4, hf: -74.9 },
        { name: 'エタン', formula: 'C₂H₆', x: 2, y: 6, hf: -84.0 },
        { name: 'プロパン', formula: 'C₃H₈', x: 3, y: 8, hf: -104.7 },
        { name: 'ブタン', formula: 'C₄H₁₀', x: 4, y: 10, hf: -125.8 },
        { name: 'エチレン', formula: 'C₂H₄', x: 2, y: 4, hf: 52.4 },
      ]);
      const hCo2 = -393.5;
      const hLiq = -285.8;
      const hGas = -241.8;
      const high = pick([true, false]);
      const hw = high ? hLiq : hGas;
      const nw = fuel.y / 2;
      const sumProd = fuel.x * hCo2 + nw * hw;
      const q = -(sumProd - fuel.hf); // kJ/mol（放出する熱の大きさ）
      const vm = 22.4; // L/mol
      const per = q / vm; // MJ/m³N
      const qOther = -(fuel.x * hCo2 + nw * (high ? hGas : hLiq) - fuel.hf);
      const fmt = (n: number): string => nf(n, 1) + ' MJ/m³N';
      const { choices, answer } = buildNumeric(per, fmt, [
        qOther / vm, // 水の状態を取り違える
        -(sumProd + fuel.hf) / vm, // 燃料の生成エンタルピーの符号を逆に
        -sumProd / vm, // 燃料の生成エンタルピーを 0 とする
        -(fuel.x * hCo2 + fuel.y * hw - fuel.hf) / vm, // 水の係数を y にする
        q, // kJ/mol のまま MJ/m³N と書く
        (q * vm) / 1000, // モル体積で割らずに掛ける
        -(fuel.x * hCo2 + (fuel.y / 4) * hw - fuel.hf) / vm, // 水の係数に H の酸素の係数 y/4 を使う
        -(hCo2 + nw * hw - fuel.hf) / vm, // CO₂ の係数を 1 のままにする
      ]);
      const kind = high ? '高発熱量（総発熱量）' : '低発熱量（真発熱量）';
      const o2 = fuel.x + fuel.y / 4;
      const fmtCoef = (n: number): string => (n === 1 ? '' : Number.isInteger(n) ? String(n) : nf(n, 1));
      return {
        question:
          fuel.name + '（' + fuel.formula + '、気体）の' + kind + 'を、燃料 1 m³N あたりで求めるとおよそいくらか。' +
          '標準生成エンタルピーは ' + fuel.formula + ' ' + (fuel.hf > 0 ? '＋' : '−') + nf(Math.abs(fuel.hf), 1) +
          '、CO₂（気体）−393.5、H₂O（液体）−285.8、H₂O（気体）−241.8（いずれも kJ/mol）、O₂ は 0 とし、' +
          '理想気体のモル体積を 22.4 L/mol とする。',
        choices,
        answer,
        explanation:
          '**1. 反応式を書く。**$' + chem(fuel.x, fuel.y) + '+' + fmtCoef(o2) + '\\mathrm{O_2}\\to' + fmtCoef(fuel.x) + '\\mathrm{CO_2}+' +
          fmtCoef(nw) + '\\mathrm{H_2O}$。' + (high ? '高発熱量なので、**生成する水は液体の値**を使う。' : '低発熱量なので、**生成する水は気体の値**を使う。') + '\n\n' +
          '**2. 生成物の和 − 反応物の和。**反応物の $\\mathrm{O_2}$ は基準の単体なので 0。\n\n' +
          '$\\Delta H=(' + fuel.x + '\\times(-393.5)+' + nw + '\\times(' + hw + '))-(' + fuel.hf + ')=' + nf(-q, 1).replace('−', '-') +
          '$ kJ/mol。発熱量はその大きさで ' + nf(q, 1) + ' kJ/mol。\n\n' +
          '**3. 1 m³N あたりに直す。**1 m³N は $1000/22.4$ mol なので、$' + nf(q, 1) + '\\times\\dfrac{1000}{22.4}\\approx' +
          nf(per * 1000, 0) + '$ kJ/m³N ＝ **' + nf(per, 1) + ' MJ/m³N**。\n\n' +
          '**水の状態を取り違えると** ' + fmt(qOther / vm) + ' になる。2 つの差は、生成水 ' + nw +
          ' mol の凝縮熱（$44.0\\times' + nw + '$ kJ/mol）にあたる。\n\n' +
          '**燃料の生成エンタルピーは「引く」。**' +
          (fuel.hf < 0
            ? 'この燃料は負の値なので、引くと発熱量は小さくなる。足してしまうと ' + fmt(-(sumProd + fuel.hf) / vm) + ' になる。'
            : 'この燃料は正の値なので、引くと発熱量は大きくなる。'),
      };
    },
  },

  // ------------------------------------------------------------ 課目Ⅲ 燃焼計算
  {
    id: 'fc-theoretical-air',
    name: '混合ガスの理論空気量と、実際に送る空気量',
    categoryId: 'k3-calc',
    sectionId: 'fc-14',
    summary: '成分ごとに x ＋ y/4 を割合で重み付けして足し、0.21 で割る。空気比と燃料の量を掛ける',
    generate: () => {
      const b = pick(HYDROCARBONS);
      const a = pick([70, 75, 80, 85, 88, 90]);
      const n2 = pick([2, 3, 4, 5]);
      const bb = 100 - a - n2;
      const m = pick([1.05, 1.1, 1.15, 1.2, 1.25, 1.3]);
      const f = pick([40, 60, 80, 120, 150, 200, 250]); // m³N/h
      const fa = a / 100;
      const fb = bb / 100;
      const oA = fa * 2;
      const oB = fb * (b.x + b.y / 4);
      const o0 = oA + oB;
      const a0 = o0 / 0.21;
      const air = f * m * a0;
      const o0Wrong = fa * (1 + 4 / 2) + fb * (b.x + b.y / 2); // H の酸素を y/2 にする
      const g0w = fa * 3 + fb * (b.x + b.y / 2) + n2 / 100 + 0.79 * a0;
      const gw = g0w + (m - 1) * a0;
      const fmt = (n: number): string => nf(n, 0) + ' m³N/h';
      const { choices, answer } = buildNumeric(air, fmt, [
        f * a0, // 空気比を掛け忘れる
        f * (m - 1) * a0, // 過剰空気だけを答える
        f * m * o0, // 0.21 で割り忘れる（酸素量のまま）
        (f * m * o0Wrong) / 0.21, // 水素の酸素を y/2 とする
        f * gw, // 燃焼ガス量と取り違える
        (f * m * o0) / 0.79, // 0.21 ではなく 0.79 で割る
      ]);
      return {
        question:
          '体積組成がメタン（CH₄）' + a + ' %、' + b.name + '（' + b.formula + '）' + bb + ' %、窒素 ' + n2 +
          ' % の気体燃料を、毎時 ' + f + ' m³N、空気比 ' + nf(m, 2) + ' で完全燃焼させる。供給する空気量はおよそいくらか。' +
          '空気中の酸素は体積で 21 % とする。',
        choices,
        answer,
        explanation:
          '**1. 成分ごとに理論酸素量を出して足す**（燃料 1 m³N あたり）。$\\mathrm{C_xH_y}$ 1 m³N は $x+y/4$ m³N の酸素を使う。窒素は燃えない。\n\n' +
          '| 成分 | 割合 | $x+y/4$ | O₂（m³N） |\n| --- | --- | --- | --- |\n' +
          '| CH₄ | ' + nf(fa, 2) + ' | 2 | ' + nf(oA, 4) + ' |\n' +
          '| ' + b.formula + ' | ' + nf(fb, 2) + ' | ' + nf(b.x + b.y / 4, 1) + ' | ' + nf(oB, 4) + ' |\n' +
          '| N₂ | ' + nf(n2 / 100, 2) + ' | 0 | 0 |\n' +
          '| 合計 | 1.00 | | ' + nf(o0, 4) + ' |\n\n' +
          '**2. 理論空気量。**$A_{0}=O_{0}/0.21=' + nf(o0, 4) + '/0.21\\approx' + nf(a0, 3) + '$ m³N/m³N。\n\n' +
          '**3. 実際の空気量。**$A=mA_{0}=' + nf(m, 2) + '\\times' + nf(a0, 3) + '\\approx' + nf(m * a0, 3) + '$ m³N/m³N。\n\n' +
          '**4. 毎時の量にする。**$' + f + '\\times' + nf(m * a0, 3) + '\\approx' + nf(air, 0) + '$ m³N/h。\n\n' +
          '**確かめ**：理論空気量は理論酸素量の約 4.8 倍（$1/0.21$）。水素の酸素を $y/2$ にすると（H₂O の O を 2 個と数える誤り）' +
          fmt((f * m * o0Wrong) / 0.21) + ' になる。$\\mathrm{H_2}+\\tfrac{1}{2}\\mathrm{O_2}\\to\\mathrm{H_2O}$ なので、水素原子 4 個に酸素分子 1 個である。',
      };
    },
  },
  {
    id: 'fc-o2-air-ratio',
    name: '排ガスの O₂ から空気比を出す',
    categoryId: 'k3-calc',
    sectionId: 'fc-17',
    summary: '厳密には m ＝ 1 ＋ x/(0.21 − x)・G₀d/A₀。近似式 21/(21 − O₂) は G₀d ≒ A₀ のとき',
    generate: () => {
      const fuel = pick(FLUE_FUELS);
      const { a0, g0d, g0w } = flueValues(fuel);
      const o2 = pick([2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 6.0]); // 乾き %
      const x = o2 / 100;
      const exact = 1 + (x / (0.21 - x)) * (g0d / a0);
      const approx = 21 / (21 - o2);
      const askApprox = Math.random() < 0.3;
      const val = askApprox ? approx : exact;
      const fmt = (n: number): string => nf(n, 3);
      const mistakes = askApprox
        ? [
            exact, // 厳密式で解く
            1 + x / 0.21, // 分母の 21 − O₂ を 21 にする
            1 + (x / (0.21 - x)) * (a0 / g0d), // 比を逆にした厳密式
            1 + (x / (0.21 - x)) * (g0w / a0), // 湿りのガス量を使う
            1 + (x / 0.21) * (g0d / a0), // 分母の 0.21 − x を 0.21 にして比も掛ける
            approx - 1, // 過剰空気率で止める
            21 / (21 - x), // % と割合を混ぜる
            1 + approx, // 近似式に 1 を足す（m ＝ 1 ＋ 過剰空気率 の形と混ぜる）
            approx * (a0 / g0d), // ガス量の比の補正を、過剰分ではなく空気比全体に掛ける
          ]
        : [
            approx, // 近似式で済ませる
            1 + (x / (0.21 - x)) * (g0w / a0), // 湿りのガス量を使う
            1 + (x / 0.21) * (g0d / a0), // 分母の 0.21 − x を 0.21 にする
            1 + (x / (0.21 - x)) * (a0 / g0d), // 比を逆にする
            1 + x / 0.21, // 近似式の分母の − x も落とす
            exact - 1, // 過剰空気率で止める
          ];
      // 空気比は 1 からの差に意味があるので、埋め草は (m − 1) を倍率でずらす（base: 1）。
      // 近似式の問いは間隔を 2 % にする（0.6 % では、途中を 3 桁に丸めた人が隣を選ぶことがあった）
      const { choices, answer } = buildNumeric(val, fmt, mistakes, { minGap: askApprox ? 0.02 : 0.006, base: 1 });
      const u = fuel.unit;
      return {
        question:
          fuel.name + 'を完全燃焼させたところ、乾き排ガス中の O₂ が ' + nf(o2, 1) + ' % であった。この燃料の理論空気量は ' +
          nf(a0, 3) + ' m³N/' + u + '、乾き理論燃焼ガス量は ' + nf(g0d, 3) + ' m³N/' + u + '、湿り理論燃焼ガス量は ' + nf(g0w, 3) +
          ' m³N/' + u + ' である。' +
          (askApprox
            ? '乾き理論燃焼ガス量が理論空気量に等しいとみなす近似式で求めると、空気比はおよそいくらか。空気中の酸素は体積で 21 % とする。'
            : '近似を使わずに求めると、空気比はおよそいくらか。空気中の酸素は体積で 21 % とする。'),
        choices,
        answer,
        explanation:
          '**よりどころ**：余った空気 $(m-1)A_{0}$ の酸素 $0.21(m-1)A_{0}$ が排ガスに残る。乾き排ガス量は $G_{0d}+(m-1)A_{0}$。\n\n' +
          '$x=\\dfrac{0.21(m-1)A_{0}}{G_{0d}+(m-1)A_{0}}$ を $m$ について解くと $m=1+\\dfrac{x}{0.21-x}\\cdot\\dfrac{G_{0d}}{A_{0}}$。\n\n' +
          '**厳密**：$x=' + nf(x, 3) + '$、$G_{0d}/A_{0}=' + nf(g0d, 3) + '/' + nf(a0, 3) + '\\approx' + nf(g0d / a0, 4) + '$。' +
          '$m=1+\\dfrac{' + nf(x, 3) + '}{' + nf(0.21 - x, 3) + '}\\times' + nf(g0d / a0, 4) + '\\approx' + nf(exact, 3) + '$。\n\n' +
          '**近似**：$G_{0d}\\approx A_{0}$ と見なすと $m\\approx\\dfrac{21}{21-(\\mathrm{O_2})}=\\dfrac{21}{' + nf(21 - o2, 1) + '}\\approx' +
          nf(approx, 3) + '$。\n\n' +
          '訊かれているのは**' + (askApprox ? '近似式' : '近似を使わない値') + '**なので ' + nf(val, 3) + '。' +
          (g0d / a0 < 0.97
            ? 'この燃料は $G_{0d}/A_{0}$ が 1 より小さいので、近似式は厳密値より大きく出る。'
            : 'この燃料は $G_{0d}/A_{0}$ が 1 に近いので、近似と厳密の差は小さい。') + '\n\n' +
          '**この式は乾き排ガスの値から導いたもの。**湿り理論燃焼ガス量を入れると ' +
          fmt(1 + (x / (0.21 - x)) * (g0w / a0)) + ' になり、外れる。',
      };
    },
  },
  {
    id: 'fc-flue-loss',
    name: '排ガス熱損失の割合',
    categoryId: 'k3-calc',
    sectionId: 'fc-19',
    summary: 'G_w ＝ G₀w ＋ (m − 1)A₀ を出し、L ＝ G_w c_p (t_g − t₀) を低発熱量で割る。kJ と MJ をそろえる',
    generate: () => {
      const fuel = pick(FLUE_FUELS);
      const { a0, g0d, g0w } = flueValues(fuel);
      const m = pick([1.1, 1.15, 1.2, 1.25, 1.3, 1.4]);
      // 1.38 は入れない（プロパン・空気比 1.2・基準 25 ℃ と重なると、令和 6 年度の本番と条件が 4 つそろう）
      const cp = pick([1.33, 1.35, 1.37, 1.4, 1.42]); // kJ/(m³N·K)
      const tg = pick([160, 180, 200, 230, 250, 280, 300]);
      const t0 = pick([10, 15, 20, 25]);
      const gw = g0w + (m - 1) * a0;
      const loss = gw * cp * (tg - t0); // kJ/単位
      const pct = (loss / (fuel.hl * 1000)) * 100;
      const pctOf = (g: number, dt: number): number => ((g * cp * dt) / (fuel.hl * 1000)) * 100;
      const fmt = (n: number): string => nf(n, 2) + ' %';
      const { choices, answer } = buildNumeric(pct, fmt, [
        pctOf(g0w, tg - t0), // 理論燃焼ガス量のまま
        pctOf(g0d + (m - 1) * a0, tg - t0), // 乾きのガス量を使う
        pctOf(gw, tg), // 基準温度を引き忘れる
        pctOf(g0w + m * a0, tg - t0), // 余剰ではなく全空気を足す
        pctOf(m * g0w, tg - t0), // 燃焼ガス量にも空気比を掛ける（G ＝ mG₀w とする）
        pct * 1000, // kJ と MJ をそろえない
        pct / 100, // 割合のまま % を付ける
      ]);
      const u = fuel.unit;
      return {
        question:
          fuel.name + 'を空気比 ' + nf(m, 2) + ' で完全燃焼させ、排ガスが ' + tg + ' ℃ で煙突から出ている。' +
          'この燃料の理論空気量は ' + nf(a0, 3) + ' m³N/' + u + '、乾き理論燃焼ガス量は ' + nf(g0d, 3) + ' m³N/' + u +
          '、湿り理論燃焼ガス量は ' + nf(g0w, 3) + ' m³N/' + u + '、低発熱量は ' + nf(fuel.hl, 1) + ' MJ/' + u +
          '、燃焼ガスの平均比熱は ' + nf(cp, 2) + ' kJ/(m³N·K)、基準温度は ' + t0 +
          ' ℃ とする。低発熱量に対する排ガス熱損失の割合はおよそいくらか。空気中の水分は無視する。',
        choices,
        answer,
        explanation:
          '**1. 実際の湿り燃焼ガス量を出す。**余った空気がそのまま加わる。$G_{w}=G_{0w}+(m-1)A_{0}=' + nf(g0w, 3) + '+' + nf(m - 1, 2) +
          '\\times' + nf(a0, 3) + '\\approx' + nf(gw, 3) + '$ m³N/' + u + '。\n\n' +
          '**2. 排ガス熱損失を出す。**$L=G_{w}c_{p}(t_{g}-t_{0})=' + nf(gw, 3) + '\\times' + nf(cp, 2) + '\\times(' + tg + '-' + t0 +
          ')\\approx' + nf(loss, 0) + '$ kJ/' + u + '。\n\n' +
          '**3. 単位をそろえて割る。**低発熱量 ' + nf(fuel.hl, 1) + ' MJ ＝ ' + nf(fuel.hl * 1000, 0) + ' kJ。$' +
          nf(loss, 0) + '/' + nf(fuel.hl * 1000, 0) + '\\approx' + nf(pct / 100, 4) + '$、**' +
          nf(pct, 2) + ' %**。\n\n' +
          '**湿りのガス量を使う。**低発熱量基準でも、水蒸気は高温のまま顕熱を持ち去る（数えないのは潜熱だけ）。' +
          '乾きで計算すると ' + fmt(pctOf(g0d + (m - 1) * a0, tg - t0)) + ' と小さく出る。\n\n' +
          '**基準温度を引き忘れると** ' + fmt(pctOf(gw, tg)) + '。**確かめ**：損失の割合が数十 % を超えたら、kJ と MJ の取り違えを疑う。',
      };
    },
  },

  // ------------------------------------------------------------ 課目Ⅳ ボイラ
  {
    id: 'hu-equivalent-evaporation',
    name: '換算蒸発量',
    categoryId: 'k4-boiler',
    sectionId: 'hu-17',
    summary: 'h₂ ＝ h′ ＋ xr、吸収熱 G(h₂ − h₁) を 2,257 kJ/kg で割る。蒸気表は絶対圧で引く',
    generate: () => {
      const pair = pick([
        [0.4, 0.5],
        [0.6, 0.7],
        [0.7, 0.8],
        [0.9, 1.0],
        [1.4, 1.5],
      ] as const);
      const pg = pair[0] as SteamP; // 圧力計の読み（ゲージ圧）
      const pa = pair[1] as SteamP; // 絶対圧
      const st = STEAM[pa];
      const stG = STEAM[pg];
      const gt = pick([2.0, 3.5, 5.0, 6.0, 8.0, 10.0, 12.0]); // t/h
      const x = pick([0.95, 0.96, 0.97, 0.98]);
      const feed = pick([
        { t: 40, h: 167.5 },
        { t: 50, h: 209.3 },
        { t: 70, h: 293.0 },
        { t: 80, h: 334.9 },
        { t: 90, h: 377.0 },
      ]);
      const g = gt * 1000; // kg/h
      const h2 = st.hf + x * st.r;
      const ge = (g * (h2 - feed.h)) / 2257;
      const fmt = (n: number): string => nf(n, 0) + ' kg/h';
      const { choices, answer } = buildNumeric(
        ge,
        fmt,
        [
          (g * (st.hf + st.r - feed.h)) / 2257, // 乾き度を落とす（乾き飽和蒸気とみなす）
          (g * h2) / 2257, // 給水の比エンタルピーを引き忘れる
          (g * (h2 - feed.h)) / st.r, // 2257 ではなくこの圧力の蒸発熱で割る
          g, // 実際蒸発量のまま
          (g * (h2 - feed.h)) / 2676, // 100 ℃ の乾き飽和蒸気の比エンタルピーで割る
          // 「ゲージ圧のまま表を引く」は差が 0.5 % ほど以下で minGap に必ず捨てられるので、誤答には入れない（解説で触れる）
          (gt * (h2 - feed.h)) / 2257, // t/h を kg/h に直し忘れる
        ],
        { minGap: 0.01 },
      );
      return {
        question:
          'ボイラが、圧力計の読み ' + nf(pg, 1) + ' MPa、乾き度 ' + nf(x, 2) + ' の蒸気を毎時 ' + nf(gt, 1) + ' t 発生している。給水温度は ' +
          feed.t + ' ℃（比エンタルピー ' + nf(feed.h, 1) + ' kJ/kg）である。換算蒸発量はおよそいくらか。大気圧を 0.1 MPa とし、' +
          '飽和水の比エンタルピー h′ と蒸発熱 r は、絶対圧 ' + nf(pg, 1) + ' MPa で h′ ＝ ' + nf(stG.hf, 1) + '、r ＝ ' + nf(stG.r, 1) +
          '、絶対圧 ' + nf(pa, 1) + ' MPa で h′ ＝ ' + nf(st.hf, 1) + '、r ＝ ' + nf(st.r, 1) +
          '（いずれも kJ/kg）とする。100 ℃ の水の蒸発熱は 2,257 kJ/kg とする。',
        choices,
        answer,
        explanation:
          '**1. 蒸気表は絶対圧で引く。**圧力計の読みはゲージ圧なので、$' + nf(pg, 1) + '+0.1=' + nf(pa, 1) + '$ MPa の行を使う。' +
          'ゲージ圧の ' + nf(pg, 1) + ' MPa の行を引いても、換算蒸発量は ' + fmt((g * (stG.hf + x * stG.r - feed.h)) / 2257) +
          ' で、この差は 0.6 % 未満なので換算蒸発量にはほとんど効かない。' +
          'ただし比エンタルピーそのものを問われたら差が出る（' + nf(stG.hf + x * stG.r, 1) + ' と ' + nf(h2, 1) +
          ' kJ/kg）ので、絶対圧で引く癖を付けておく。\n\n' +
          '**2. 湿り蒸気の比エンタルピー。**$h_{2}=h\'+xr=' + nf(st.hf, 1) + '+' + nf(x, 2) + '\\times' + nf(st.r, 1) + '\\approx' + nf(h2, 1) +
          '$ kJ/kg。\n\n' +
          '**3. 蒸気 1 kg あたりの吸収熱。**$h_{2}-h_{1}=' + nf(h2, 1) + '-' + nf(feed.h, 1) + '=' + nf(h2 - feed.h, 1) + '$ kJ/kg。\n\n' +
          '**4. 換算蒸発量。**蒸発量を kg/h に直し（' + nf(gt, 1) + ' t/h ＝ ' + nf(g, 0) + ' kg/h）、' +
          '$G_{e}=\\dfrac{G(h_{2}-h_{1})}{2257}=\\dfrac{' + nf(g, 0) + '\\times' + nf(h2 - feed.h, 1) + '}{2257}\\approx' +
          nf(ge, 0) + '$ kg/h。\n\n' +
          '**確かめ**：給水が 100 ℃ より冷たく、蒸気が 100 ℃ より高い圧力なので、1 kg あたりの吸収熱（' + nf(h2 - feed.h, 1) +
          '）は 2,257 より大きい。だから**換算蒸発量は実際蒸発量（' + nf(g, 0) + ' kg/h）より大きい。**\n\n' +
          '**割るのは 100 ℃ の蒸発熱 2,257**。この圧力の蒸発熱 ' + nf(st.r, 1) + ' で割ると ' + fmt((g * (h2 - feed.h)) / st.r) + ' になる。',
      };
    },
  },
];
