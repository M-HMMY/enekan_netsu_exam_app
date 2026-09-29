/** アプリ全体で使う型定義 */

/**
 * 試験科目。
 *
 * エネルギー管理士試験（熱分野）は 4 課目で、**課目ごとに配点の 60 % 以上を取らないと
 * 合格にならない**（令和 8 年度 受験案内）。だから課目は表示の都合ではなく、
 * 成績を出す単位そのものである。前に範囲外の入門編を置く。
 *
 * | 分野 | 課目 |
 * | --- | --- |
 * | `kamoku1` | Ⅰ エネルギー総合管理及び法規（必須基礎区分。電気分野と共通） |
 * | `kamoku2` | Ⅱ 熱と流体の流れの基礎 |
 * | `kamoku3` | Ⅲ 燃料と燃焼 |
 * | `kamoku4` | Ⅳ 熱利用設備及びその管理 |
 *
 * **★ 課目の番号と試験の時限は一致しない。**課目Ⅳが 3 時限、課目Ⅲが 4 時限。
 *
 * **★ 問題数はここに書かない。**`src/data/categories.ts` の `FIELDS` が持っている。
 * **手で二重に持つと、必ず片方が古くなる**（高圧ガス甲種版で実際に食い違った）。
 */
export type FieldId = 'intro' | 'kamoku1' | 'kamoku2' | 'kamoku3' | 'kamoku4';

/** 中分類（シラバスの「項目」相当）。教本の章と問題のタグを兼ねる */
export interface Category {
  id: string;
  field: FieldId;
  /** 表示名（例: 線形代数） */
  name: string;
  /** 一行説明 */
  summary: string;
  /** この章が公式シラバスのどの項目に当たるか（例: 技術分野 7〜10）。章の扉に出す */
  syllabus: string;
  /** 本番の大問の数。受験案内の「試験課目」欄の括弧内の数（categories.ts の注記を参照） */
  questions: number;
  /**
   * 章の扉に出す導入文（Markdown）。この章で何をやり、なぜ必要で、
   * どれくらい力を入れるべきかを、節を読む前に伝える。
   */
  intro: string;
}

/** 教本の 1 セクション（＝ひとつの学習単位） */
export interface TextbookSection {
  id: string;
  categoryId: string;
  title: string;
  /** 学習の狙い。一覧に出す */
  goal: string;
  /** 本文。Markdown サブセット（見出し/表/箇条書き/コード/強調/$数式$） */
  body: string;
  /** 目安学習時間（分） */
  minutes: number;
}

/**
 * 確認問題。**本番の空欄 1 つぶん**を 1 問にする（CLAUDE.md「確認問題の形」、決定は 2026 年 9 月 29 日）。
 *
 * 本番は、大問の文章に番号付きの空欄が 10〜20 個並び、
 * **空欄ごとに解答群（2〜20 択。複数の空欄で共有することもある）が付いて、1 つずつマークする形**だった
 * （`docs/public-questions.md` §2）。その最小単位を 1 問にしている。
 *
 * - 大問の前置き（全空欄に共通する設定と与条件だけ）は `passage` で共有する。
 *   **前の空欄で求めた値は前置きに書かず、各問題の問題文で与える**（`passage` の説明を参照）
 * - 選択肢の数は空欄によって違う。**5 に揃えない**（語句は 4、数値は 5、組合せは 7 が多い）
 *
 * `answer` は配列も取れる（複数選択）。読むときも比べるときも
 * `src/lib/answer.ts` を通すこと（画面ごとに場合分けを書くとずれる）。
 */
export interface Question {
  id: string;
  categoryId: string;
  /** 関連する教本セクション（解説からの復習導線に使う）。全問に付けるのが望ましい */
  sectionId?: string;
  /**
   * 大問の前置きの ID（`src/data/questions/passages.ts`）。
   *
   * 本番の大問は、1 つの設定（燃料の組成、サイクルの条件、事業者の事例など）に
   * 空欄が十数個ぶら下がる。**その設定を問題ごとに書き写すと、1 か所直して他を直し忘れる。**
   * 前置きは 1 回だけ書き、問題からは ID で指す。
   *
   * **計算が連鎖するときは、前の空欄の答えを `question` の側に与えること**
   * （「理論空気量を ○○ m³N/m³N とすると」）。前の問題を解いた前提にしない。
   * 復習キューは問題を 1 つずつ、ばらばらの順で出すため。
   */
  passage?: string;
  question: string;
  /** 条文の引用など、原文のまま見せたい断片。等幅・行番号付きで表示する */
  code?: string;
  /**
   * 解答群。**2〜20 個**（`MIN_CHOICES`〜`MAX_CHOICES`）。
   *
   * 本番の解答群の数に合わせる。語句と式は 4、数値は 5、「①〜③から全て挙げると」の組合せは 7 が多い。
   * 複数の空欄で共有する語群は 10 個を超えることがある（令和 6 年度に 20 個）。
   * **五肢択一の姉妹アプリから写すと 5 に揃えたくなるが、揃えないこと。**
   */
  choices: readonly string[];
  /**
   * 正解の添字。0 始まり（0=ア, 1=イ, …, 19=ト）。
   *
   * 複数選択の問題を作る場合は、正解の添字を昇順の配列で書く（例: `[0, 2]`）。
   * そのときは**問題文に「2 つ選びなさい」などと必ず書くこと。**
   * いくつ選ぶのかを画面側が教えてしまうと、本番より易しくなる。
   * `npm run check` が、書き忘れをエラーにする。
   *
   * 本番で近いのは「明らかに間違っているものは [1] 及び [2]」（順不同の 2 空欄）。
   * 本番では空欄 2 つだが、このアプリでは 1 問・2 つ選ぶ形で表してよい。
   */
  answer: number | readonly number[];
  explanation: string;
  /** 体感難易度 1（易）〜3（難） */
  level: 1 | 2 | 3;
  /**
   * 出典。省エネルギーセンターが公表している過去の試験問題などを参照した場合に設定する。
   *
   * **`source` が付いた問題は、文章の作りを検査しない。**原文どおりに収録するものなので、
   * 長さも正解の位置も直せない（`scripts/check.ts` を参照）。
   */
  source?: string;
}

/**
 * 大問の前置き。複数の確認問題が `Question.passage` で共有する。
 *
 * 本番の大問の冒頭（「プロパンとブタンの混合燃料を…」のような設定と与条件）に当たる。
 * **公開問題の設定を写さないこと。**数値も場面も自前で作る（CLAUDE.md「公開のルール」）。
 */
export interface Passage {
  id: string;
  /** 前置きを使う問題と同じ章。章をまたいで共有しない */
  categoryId: string;
  /** Markdown。数式・表が使える */
  body: string;
}

/** 解答履歴の 1 レコード */
export interface AttemptLog {
  qid: string;
  categoryId: string;
  correct: boolean;
  /** epoch ms */
  at: number;
  /** 出題モード */
  mode: 'practice' | 'review' | 'mock' | 'check' | 'drill';
}

/** SRS（間隔反復）のカード状態。SM-2 を簡略化したもの */
export interface SrsCard {
  qid: string;
  categoryId: string;
  /** 難易度係数 */
  ease: number;
  /** 次回までの間隔（日） */
  interval: number;
  /** 連続正解数 */
  streak: number;
  /** 次回出題日時 epoch ms */
  due: number;
  /** 総解答回数 */
  reps: number;
  lapses: number;
}

/** 模試 1 回分の結果 */
export interface MockResult {
  id: string;
  at: number;
  /** 出題セットの名前（例: 本番形式 60 問） */
  preset: string;
  total: number;
  correct: number;
  /** 所要時間（秒） */
  elapsed: number;
  /** 分野別の正誤 */
  byCategory: Record<string, { total: number; correct: number }>;
}

/**
 * 節ごとの理解度。読了フラグだけでは「読んだが自信がない節」を拾えないため、
 * 3 段階で記録して復習の優先順位に使う。
 */
export type Understanding = 1 | 2 | 3;

/** localStorage に保存する状態のすべて */
export interface AppState {
  version: number;
  /** 読了した教本セクション ID */
  readSections: string[];
  logs: AttemptLog[];
  srs: Record<string, SrsCard>;
  mocks: MockResult[];
  /** 教本の栞（最後に開いたセクション） */
  bookmark?: string;
  /** セクション ID ごとの読了日時（epoch ms）。「今日の進捗」の集計に使う */
  readAt?: Record<string, number>;
  /** 試験日（YYYY-MM-DD）。未設定ならカウントダウン非表示 */
  examDate?: string;
  /** 表示テーマ。既定は 'auto'（OS 追従） */
  theme?: 'light' | 'dark' | 'auto';
  /**
   * セクション ID ごとの理解度（1=もう一度読みたい / 2=だいたい分かった / 3=だいじょうぶ）。
   * 記録がない読了済みの節は「水準は未記録」として扱う。
   */
  understanding?: Record<string, Understanding>;
}
