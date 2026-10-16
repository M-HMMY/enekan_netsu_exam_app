import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import type { MockResult, Question } from '../types';
import { QUESTIONS } from '../data/questions';
import { QuestionCard } from '../components/QuestionCard';
import {
  CATEGORIES,
  categoryName,
  ELECTIVES_TO_ANSWER,
  EXAM_MINUTES,
  FIELDS,
  KAMOKU_EXAM,
  MOCK_SCALE,
  fieldName,
  fieldOfCategory,
  PASS_RATIO,
} from '../data/categories';
import type { FieldId } from '../types';
import { actions } from '../store';
import { navigate } from '../lib/router';
import { choiceIndexOf, keyChoiceCount, keyChoiceNote, useKeys } from '../lib/useKeys';
import { isCorrectAnswer, toggleChoice } from '../lib/answer';

interface Item {
  qid: string;
  categoryId: string;
  q: Question;
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const toItem = (q: Question): Item => ({ qid: q.id, categoryId: q.categoryId, q });

/** 収録順。同じ前置き（passage）を共有する問題は隣り合っているので、この順に並べれば前置きが続けて出る */
const ORDER = new Map(QUESTIONS.map((q, i) => [q.id, i]));

/**
 * `total` 問を、重みに比例して割り当てる（**最大剰余法**）。各項目は `cap`（収録数）を超えない。
 *
 * **章ごとに `Math.round` してから足すと、端数の合計が総数とずれる。**章が 18 に増えると、
 * 余りの切り捨てで必須の章が抽選から落ちうる（`docs/section-plan.md` §2 の注）。だから割当を先に確定する。
 * 収録が足りない章の不足分は、残りの章に同じ方法で配り直す。
 */
function allocate(total: number, entries: { id: string; weight: number; cap: number }[]): Map<string, number> {
  const out = new Map(entries.map((e) => [e.id, 0]));
  const room = (e: { id: string; cap: number }) => e.cap - (out.get(e.id) ?? 0);
  let active = entries.filter((e) => e.cap > 0 && e.weight > 0);
  // 上限は**配る相手（重みが正の章）の収録の合計**で取る。重み 0 の章の収録まで数えると、配りきれずに抜ける
  let remaining = Math.min(total, active.reduce((n, e) => n + e.cap, 0));
  while (remaining > 0 && active.length > 0) {
    const weight = active.reduce((n, e) => n + e.weight, 0);
    const shares = active.map((e) => ({ e, exact: (remaining * e.weight) / weight }));
    let given = 0;
    for (const s of shares) {
      const n = Math.min(Math.floor(s.exact), room(s.e));
      out.set(s.e.id, (out.get(s.e.id) ?? 0) + n);
      given += n;
    }
    // 端数の大きい順。**同じ端数の章どうしは乱数で順を決める**（並び順で決めると、毎回同じ章が 1 問多く取る）
    const tie = new Map(shares.map((s) => [s.e.id, Math.random()]));
    shares.sort(
      (a, b) =>
        b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)) || (tie.get(a.e.id) ?? 0) - (tie.get(b.e.id) ?? 0),
    );
    for (const s of shares) {
      if (given >= remaining) break;
      if (room(s.e) <= 0) continue;
      out.set(s.e.id, (out.get(s.e.id) ?? 0) + 1);
      given += 1;
    }
    if (given === 0) break;
    remaining -= given;
    active = active.filter((e) => room(e) > 0);
  }
  return out;
}

/** 課目の模試の問題数。本番の空欄の数に縮尺を掛ける */
const kamokuCount = (k: { blanks: number }): number => Math.round(k.blanks * MOCK_SCALE);
const kamokuMinutes = (k: { minutes: number }): number => Math.round(k.minutes * MOCK_SCALE);

/** その課目で出題する章。課目Ⅳの＊選択の章は、選んだものだけ */
function chaptersOf(field: FieldId, electives: readonly string[]) {
  return CATEGORIES.filter((c) => c.field === field && c.questions > 0 && (!c.elective || electives.includes(c.id)));
}

/**
 * 模試の問題を作る。
 *
 * **課目ごとの問題数は、本番の空欄の数 × `MOCK_SCALE`**（`categories.ts` の `KAMOKU_EXAM`）。
 * 課目の中では、**章の配点（`points`）に比例して**最大剰余法で割り当ててから抽選する。
 * だから課目の中の正答率が、そのまま配点の割合のおおよその目安になる。
 * 収録が足りない章の不足分は、**同じ課目の中の**別の章から補う。課目をまたいで補うと、
 * 課目ごとの判定が崩れる（課目ごとに 60 % の基準がある）。
 *
 * 並びは本番と同じく**時限の順**（Ⅰ → Ⅱ → Ⅳ → Ⅲ）、課目の中は章の順、章の中は収録順
 * （同じ前置きの問題が続けて出る）。本番は大問ごとに解くので、混ぜない。
 *
 * `fields` は出題する課目（**課目合格の免除**を受けた人の形式で使う）。
 * `electives` は課目Ⅳの＊選択の章のうち、選んだ 2 つ。
 */
function build(fields: readonly FieldId[], electives: readonly string[]): Item[] {
  const items: Item[] = [];
  for (const k of KAMOKU_EXAM) {
    if (!fields.includes(k.id)) continue;
    const chapters = chaptersOf(k.id, electives);
    const pools = new Map(chapters.map((c) => [c.id, QUESTIONS.filter((q) => q.categoryId === c.id)]));
    const counts = allocate(
      kamokuCount(k),
      chapters.map((c) => ({ id: c.id, weight: c.points, cap: pools.get(c.id)?.length ?? 0 })),
    );
    for (const c of chapters) {
      const picked = shuffle(pools.get(c.id) ?? []).slice(0, counts.get(c.id) ?? 0);
      picked.sort((a, b) => (ORDER.get(a.id) ?? 0) - (ORDER.get(b.id) ?? 0));
      items.push(...picked.map(toItem));
    }
  }
  return items;
}

/** その形式で出せる問題の数（収録の上限で頭打ち）。設定画面で「不足」を出すのに使う */
function available(fields: readonly FieldId[], electives: readonly string[]): number {
  return KAMOKU_EXAM.filter((k) => fields.includes(k.id)).reduce((n, k) => {
    const pool = chaptersOf(k.id, electives).reduce(
      (m, c) => m + QUESTIONS.filter((q) => q.categoryId === c.id).length,
      0,
    );
    return n + Math.min(kamokuCount(k), pool);
  }, 0);
}

/**
 * 分野ごとの正解数。
 *
 * **この試験は合格基準が公表されている**ので、課目ごとの結果を出してよい。
 * 「各課目の合格基準（配点の 60％）」（令和 8 年度 受験案内）。
 *
 * **ただし出してよいのは「この模試の結果が 6 割に届いたか」まで。**
 * 収録した問題は本番ではない。**画面に「合格」「基準を満たす」と書かないこと。**
 */
function fieldScores(items: Item[], answers: number[][]): { id: FieldId; total: number; correct: number }[] {
  return FIELDS.filter((f) => f.questions > 0).map((f) => {
    let total = 0;
    let correct = 0;
    items.forEach((item, i) => {
      if (fieldOfCategory(item.categoryId) !== f.id) return;
      total += 1;
      if (isCorrectAnswer(item.q.answer, answers[i])) correct += 1;
    });
    return { id: f.id, total, correct };
  });
}

interface Config {
  minutes: number;
  /** 出題する課目 */
  fields: FieldId[];
  /** 課目Ⅳの＊選択の章のうち、選んだもの */
  electives: string[];
  /** 学習記録に残す形式名 */
  label: string;
}

/**
 * 出題セット。
 *
 * **本番形式では、課目の重みを本番どおりにすること。**
 * 課目ごとに配点の 60 % という基準がある以上、重みが違うと判定の意味がなくなる。
 * 問題数と時間は `KAMOKU_EXAM` × `MOCK_SCALE` から出す（ここに数を手で書かない）。
 *
 * **★ この試験には課目合格の制度がある**（令和 8 年度 受験案内「試験課目の免除制度」）。
 * 一部の課目が合格基準以上なら課目合格者となり、**3 年間はその課目が免除**される。
 * **だから翌年は落とした課目だけを受ける人が多い。**課目ごとの形式を置いているのはそのため。
 */
const PRESETS: { label: string; fields: FieldId[]; note: string }[] = [
  {
    label: '本番形式（4 課目）',
    fields: ['kamoku1', 'kamoku2', 'kamoku4', 'kamoku3'],
    note: '本番と同じ時限の順（Ⅰ → Ⅱ → Ⅳ → Ⅲ）に通しで解きます。課目ごとに配点の 6 割が目安です',
  },
  {
    label: '課目Ⅰだけ（エネルギー総合管理及び法規）',
    fields: ['kamoku1'],
    note: '本番は 1 時限 80 分。熱分野と電気分野で共通の課目です',
  },
  {
    label: '課目Ⅱだけ（熱と流体の流れの基礎）',
    fields: ['kamoku2'],
    note: '本番は 2 時限 110 分',
  },
  {
    label: '課目Ⅲだけ（燃料と燃焼）',
    fields: ['kamoku3'],
    note: '本番は 80 分。★ 4 時限（最後）です',
  },
  {
    label: '課目Ⅳだけ（熱利用設備及びその管理）',
    fields: ['kamoku4'],
    note: '本番は 110 分。★ 3 時限です',
  },
];

const presetMinutes = (fields: readonly FieldId[]): number =>
  KAMOKU_EXAM.filter((k) => fields.includes(k.id)).reduce((n, k) => n + kamokuMinutes(k), 0);
const presetCount = (fields: readonly FieldId[]): number =>
  KAMOKU_EXAM.filter((k) => fields.includes(k.id)).reduce((n, k) => n + kamokuCount(k), 0);

/** 課目Ⅳの＊選択の章。本番は 4 つから `ELECTIVES_TO_ANSWER`（2）つを選ぶ */
const ELECTIVE_CHAPTERS = CATEGORIES.filter((c) => c.elective);
/** 最初に選んでおく章。収録のある章から先頭の 2 つ */
const DEFAULT_ELECTIVES = ELECTIVE_CHAPTERS.filter((c) => QUESTIONS.some((q) => q.categoryId === c.id))
  .slice(0, ELECTIVES_TO_ANSWER)
  .map((c) => c.id);

interface Session {
  config: Config;
  items: Item[];
  /** 各問の選択。未解答は空配列（複数選択があるので配列で持つ） */
  answers: number[][];
  idx: number;
  startedAt: number;
  /** 採点済みなら経過秒数を保持 */
  finishedAt: number | null;
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** 画面に出す課目の番号 */
const ROMAN: Partial<Record<FieldId, string>> = { kamoku1: 'Ⅰ', kamoku2: 'Ⅱ', kamoku3: 'Ⅲ', kamoku4: 'Ⅳ' };

export function Mock(): JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [now, setNow] = useState(Date.now());
  const [reviewing, setReviewing] = useState(false);
  const [electives, setElectives] = useState<string[]>(DEFAULT_ELECTIVES);

  const running = session !== null && session.finishedAt === null;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const remaining = session ? session.config.minutes * 60 - (now - session.startedAt) / 1000 : 0;

  const finish = (s: Session) => {
    const elapsed = Math.round((Date.now() - s.startedAt) / 1000);
    const byCategory: MockResult['byCategory'] = {};
    let correct = 0;
    s.items.forEach((item, i) => {
      const ok = isCorrectAnswer(item.q.answer, s.answers[i]);
      if (ok) correct += 1;
      const entry = byCategory[item.categoryId] ?? { total: 0, correct: 0 };
      entry.total += 1;
      if (ok) entry.correct += 1;
      byCategory[item.categoryId] = entry;
      // 未解答も含めて記録し、SRS へ反映する
      actions.answer({ qid: item.qid, categoryId: item.categoryId, correct: ok, mode: 'mock' });
    });
    actions.addMock({
      id: `mock-${Date.now()}`,
      at: Date.now(),
      // 課目Ⅳを含む回は、選んだ＊選択の章も残す（履歴で、どの 2 つを選んだ回か見分けられるように）
      preset:
        `${s.config.label}　${s.items.length} 問 / ${s.config.minutes} 分` +
        (s.config.fields.includes('kamoku4') ? `（選択：${s.config.electives.map(categoryName).join('・')}）` : ''),
      total: s.items.length,
      correct,
      elapsed,
      byCategory,
    });
    setSession({ ...s, finishedAt: Date.now() });
    setReviewing(false);
  };

  // 制限時間の到達で自動採点する
  useEffect(() => {
    if (session && session.finishedAt === null && remaining <= 0) finish(session);
    // finish は session を引数に取るため依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, session]);

  // 数字キーで選択（その問題の選択肢の数まで）、← → で前後の問題へ
  useKeys(
    useCallback(
      (key: string) => {
        if (session === null || session.finishedAt !== null) return;
        const choice = choiceIndexOf(key, session.items[session.idx].q.choices.length);
        if (choice !== null) {
          setSession((s) => {
            if (s === null) return s;
            const answers = [...s.answers];
            answers[s.idx] = toggleChoice(s.items[s.idx].q.answer, answers[s.idx], choice);
            return { ...s, answers };
          });
          return;
        }
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
          setSession((s) => {
            if (s === null) return s;
            const delta = key === 'ArrowLeft' ? -1 : 1;
            return { ...s, idx: Math.min(s.items.length - 1, Math.max(0, s.idx + delta)) };
          });
        }
      },
      [session],
    ),
  );

  const unanswered = useMemo(
    () => (session ? session.answers.reduce<number[]>((acc, a, i) => (a.length === 0 ? [...acc, i] : acc), []) : []),
    [session],
  );

  // ---- 設定画面 ----
  if (!session) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>模試</h1>
          <p className="lead">
            時間制限つきで通しで解きます。途中で正誤は表示されません。時間配分の感覚をつかむことが目的です。
          </p>
        </header>
        <section className="section">
          <h2>課目Ⅳの選択問題（{ELECTIVES_TO_ANSWER} つ選ぶ）</h2>
          <p className="hint">
            本番の課目Ⅳは、＊印の 4 問題から {ELECTIVES_TO_ANSWER} 問題を選んで解答します。本番で選ぶつもりの分野を選んでください。
          </p>
          <div className="chips">
            {ELECTIVE_CHAPTERS.map((c) => {
              const n = QUESTIONS.filter((q) => q.categoryId === c.id).length;
              const on = electives.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`chip ${on ? 'on' : ''}`}
                  disabled={n === 0}
                  onClick={() =>
                    setElectives((cur) =>
                      cur.includes(c.id)
                        ? cur.filter((id) => id !== c.id)
                        : // 3 つ目を押したら、いちばん古い選択を外す
                          [...cur, c.id].slice(-ELECTIVES_TO_ANSWER),
                    )
                  }
                >
                  {c.name}
                  {n === 0 ? '（未収録）' : ''}
                </button>
              );
            })}
          </div>
        </section>
        <div className="preset-grid">
          {PRESETS.map((p) => {
            // 課目を絞る形式では、**その課目の収録数**で足りるかを見る。
            // 全体の問題数で判定すると、ある課目が空でも押せてしまう。
            const needsElectives = p.fields.includes('kamoku4') && electives.length !== ELECTIVES_TO_ANSWER;
            const count = presetCount(p.fields);
            const minutes = presetMinutes(p.fields);
            const pool = available(p.fields, electives);
            const enough = !needsElectives && pool >= count;
            return (
              <button
                key={p.label}
                type="button"
                className="action"
                disabled={!enough}
                onClick={() => {
                  const items = build(p.fields, electives);
                  setSession({
                    config: { minutes, fields: p.fields, electives, label: p.label },
                    items,
                    answers: Array.from({ length: items.length }, () => [] as number[]),
                    idx: 0,
                    startedAt: Date.now(),
                    finishedAt: null,
                  });
                }}
              >
                <span className="action-title">{p.label}</span>
                <span className="action-sub">
                  {needsElectives
                    ? `課目Ⅳの選択問題を ${ELECTIVES_TO_ANSWER} つ選んでください`
                    : enough
                      ? `${count} 問 / ${minutes} 分。${p.note}`
                      : `収録問題が不足しています（${count} 問に対して ${pool} 問）`}
                </span>
              </button>
            );
          })}
        </div>
        <p className="hint">
          <strong>問題数と時間は、どちらも本番の半分です。</strong>
          本番で 1 人が解く空欄は 4 課目でおよそ {KAMOKU_EXAM.reduce((n, k) => n + k.blanks, 0)} 個（
          {KAMOKU_EXAM.map((k) => `課目${ROMAN[k.id]} ${k.blanks}`).join('・')}）で、
          その半分を出し、時間も半分にしています。<strong>1 問あたりの持ち時間は本番とほぼ同じ</strong>です（半分にして端数を丸めた分だけずれます）。
          課目の中では、大問の配点に比例して問題を割り当てています。
        </p>
        <p className="hint">
          本番は 4 課目を 1 日で受けます。合計 {EXAM_MINUTES} 分ですが、
          <strong>時限の間に休憩があるので、通しで {EXAM_MINUTES} 分座るわけではありません。</strong>
          <strong>★ 課目の番号と時限の順番は違います。</strong>課目Ⅳが 3 時限、課目Ⅲが 4 時限（最後）です。
        </p>
        <p className="hint warn">
          <strong>★ この模試は、本番の問題の形ではありません。</strong>
          本番は大問の中に空欄がいくつも並び、空欄ごとに解答群から記号を選んでマークする形です。
          ここで測れるのは、解くのに必要な知識がそろっているかまでです。
        </p>
        <p className="hint">
          <strong>合格基準は、各課目とも配点の {Math.round(PASS_RATIO * 100)} % です。</strong>
          合計点ではありません。<strong>1 課目でも 6 割に届かないと試験合格になりません</strong>ので、この模試も課目ごとに結果を出します。
          <strong>合格した課目は 3 年間免除</strong>されるので、落とした課目だけを受ける形式も置いてあります。
        </p>
        <p className="hint">
          ※ 出すのは<strong>この模試の結果が 6 割に届いたか</strong>までです。
          本番の合否を予想するものではありません。
          この記述は 2026 年 9 月 29 日時点のものです（令和 8 年度 受験案内）。
          最新の試験要項は省エネルギーセンターの公式サイトで確認してください。
        </p>
      </div>
    );
  }

  // ---- 採点結果 ----
  if (session.finishedAt !== null) {
    const correct = session.items.filter((item, i) => isCorrectAnswer(item.q.answer, session.answers[i])).length;
    const rate = Math.round((correct / session.items.length) * 100);
    const elapsed = Math.round((session.finishedAt - session.startedAt) / 1000);
    const scores = fieldScores(session.items, session.answers);
    // 課目を絞った形式かどうか。絞った形式では、出していない課目の行の書き方を変える
    const narrowed = session.config.fields.length < KAMOKU_EXAM.length ? session.config.fields : undefined;
    const blank = session.answers.filter((a) => a.length === 0).length;
    // この試験で問われるのは速度でもある。持ち時間と実際のペースを比べる
    const perQuestion = elapsed / session.items.length;
    const budget = (session.config.minutes * 60) / session.items.length;
    const byCat = new Map<string, { total: number; correct: number }>();
    session.items.forEach((item, i) => {
      const e = byCat.get(item.categoryId) ?? { total: 0, correct: 0 };
      e.total += 1;
      if (isCorrectAnswer(item.q.answer, session.answers[i])) e.correct += 1;
      byCat.set(item.categoryId, e);
    });

    if (reviewing) {
      return (
        <div className="page">
          <header className="page-head">
            <h1>模試の見直し</h1>
            <p className="hint">誤答と未解答を中心に確認してください。</p>
          </header>
          {session.items.map((item, i) => (
            <QuestionCard
              key={item.qid}
              q={item.q}
              selected={session.answers[i]}
              revealed
              onSelect={() => undefined}
              counter={`${i + 1} / ${session.items.length}`}
            />
          ))}
          <div className="read-actions">
            <button type="button" className="btn" onClick={() => setReviewing(false)}>
              結果へ戻る
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="page">
        <header className="page-head">
          <h1>模試の結果</h1>
        </header>
        <div className="cards">
          <div className="card stat">
            <span className="stat-label">得点</span>
            <span className="stat-value">
              {correct} / {session.items.length}
            </span>
            <span className="stat-sub">正答率 {rate}%</span>
          </div>
          <div className="card stat">
            <span className="stat-label">所要時間</span>
            <span className="stat-value">{formatTime(elapsed)}</span>
            <span className="stat-sub">制限 {session.config.minutes} 分</span>
          </div>
          <div className="card stat">
            <span className="stat-label">解答のペース</span>
            <span className="stat-value">{Math.round(perQuestion)} 秒 / 問</span>
            <span className="stat-sub">
              {blank > 0
                ? `未解答が ${blank} 問。持ち時間は 1 問 ${Math.round(budget)} 秒です`
                : `全問に解答。持ち時間 1 問 ${Math.round(budget)} 秒に対して${perQuestion <= budget ? '間に合っています' : '超えています'}`}
            </span>
          </div>
        </div>

        <section className="section">
          <h2>課目別の判定</h2>
          <p className="hint">
            <strong>合格基準は、各課目とも配点の {Math.round(PASS_RATIO * 100)} %</strong> です（令和 8 年度 受験案内）。
            合計点ではないので、<strong>1 課目でも 6 割に届かないと試験合格になりません</strong>（届いた課目は課目合格）。
            この模試は、課目の中の問題数を大問の配点に比例させているので、正答率は配点の割合のおおよその目安になります。
            下の表は、課目ごとに<strong>この模試で 6 割に届いたか</strong>を出しているだけです。
            <strong>本番の合否を判定するものではありません。</strong>
          </p>
          {narrowed !== undefined && (
            <p className="hint">
              これは<strong>課目を絞った形式</strong>です。判定は
              <strong>{narrowed.map(fieldName).join('・')}だけ</strong>で決まります。
              （課目合格で免除を受けた場合の形式です）
            </p>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>課目</th>
                  <th>正解 / 出題</th>
                  <th>正答率</th>
                  <th>6 割に届いたか</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((f) => {
                  const met = f.total > 0 && f.correct / f.total >= PASS_RATIO;
                  // **出していない課目を「出題なし」と並べない。**
                  // 空欄に見えると、点が取れなかったのかと読める。
                  const excluded = narrowed !== undefined && !narrowed.includes(f.id);
                  return (
                    <tr key={f.id} className={f.total > 0 && !met ? 'low' : ''}>
                      <td>{fieldName(f.id)}</td>
                      <td>{excluded ? '対象外' : `${f.correct} / ${f.total}`}</td>
                      <td>
                        {excluded ? '—' : f.total === 0 ? '出題なし' : `${Math.round((f.correct / f.total) * 100)}%`}
                      </td>
                      <td>{excluded ? '対象外' : f.total === 0 ? '—' : met ? '届いた' : '届かない'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section">
          <h2>章別の結果</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>分野</th>
                  <th>正解 / 出題</th>
                  <th>正答率</th>
                </tr>
              </thead>
              <tbody>
                {[...byCat.entries()]
                  .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
                  .map(([cat, e]) => (
                    <tr key={cat} className={e.correct / e.total < 0.6 ? 'low' : ''}>
                      <td>{categoryName(cat)}</td>
                      <td>
                        {e.correct} / {e.total}
                      </td>
                      <td>{Math.round((e.correct / e.total) * 100)}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="read-actions">
          <button type="button" className="btn primary" onClick={() => setReviewing(true)}>
            解説を見て復習する
          </button>
          <button type="button" className="btn" onClick={() => setSession(null)}>
            もう一度受ける
          </button>
          <button type="button" className="btn ghost" onClick={() => navigate('stats')}>
            成績分析へ
          </button>
        </div>
      </div>
    );
  }

  // ---- 受験中 ----
  const item = session.items[session.idx];
  const setAnswer = (choice: number) => {
    const answers = [...session.answers];
    answers[session.idx] = toggleChoice(item.q.answer, answers[session.idx], choice);
    setSession({ ...session, answers });
  };
  const move = (delta: number) => {
    const idx = Math.min(session.items.length - 1, Math.max(0, session.idx + delta));
    setSession({ ...session, idx });
  };

  return (
    <div className="page">
      <div className={`exam-bar ${remaining < 300 ? 'urgent' : ''}`}>
        <span className="exam-timer">残り {formatTime(remaining)}</span>
        <span className="exam-count">
          解答済み {session.answers.filter((a) => a.length > 0).length} / {session.items.length}
        </span>
        <button type="button" className="btn small" onClick={() => finish(session)}>
          採点する
        </button>
      </div>

      <QuestionCard
        q={item.q}
        selected={session.answers[session.idx]}
        revealed={false}
        onSelect={setAnswer}
        counter={`${session.idx + 1} / ${session.items.length}`}
        hideResult
      />

      <div className="exam-nav">
        <button type="button" className="btn" disabled={session.idx === 0} onClick={() => move(-1)}>
          ← 前の問題
        </button>
        <button
          type="button"
          className="btn"
          disabled={session.idx === session.items.length - 1}
          onClick={() => move(1)}
        >
          次の問題 →
        </button>
      </div>
      <p className="kbd-hint">
        <kbd>1</kbd>〜<kbd>{keyChoiceCount(item.q.choices.length)}</kbd> で選択{keyChoiceNote(item.q.choices.length)}、<kbd>←</kbd> <kbd>→</kbd> で問題を移動できます
      </p>

      <section className="section">
        <h2>解答状況</h2>
        <div className="grid-nav">
          {session.items.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`grid-cell ${session.answers[i].length > 0 ? 'filled' : ''} ${i === session.idx ? 'current' : ''}`}
              onClick={() => setSession({ ...session, idx: i })}
            >
              {i + 1}
            </button>
          ))}
        </div>
        {unanswered.length > 0 && <p className="hint">未解答が {unanswered.length} 問あります。</p>}
      </section>
    </div>
  );
}
