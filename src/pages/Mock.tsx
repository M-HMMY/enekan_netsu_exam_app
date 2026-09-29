import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import type { MockResult, Question } from '../types';
import { QUESTIONS } from '../data/questions';
import { QuestionCard } from '../components/QuestionCard';
import {
  CATEGORIES,
  categoryName,
  EXAM_MINUTES,
  MOCK_QUESTIONS,
  FIELDS,
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

/**
 * 模試の問題を作る。
 *
 * **課目ごとの大問の数は、受験案内の「試験課目」欄に書いてある**ので、
 * 課目の比率は本番どおりに作れる。章ごとの重みも `categories.ts` の `questions`
 * （受験案内の括弧内の数）をそのまま使って抽選する。
 * 収録が足りない章があれば、その不足分は他章から補って総数だけは合わせる。
 *
 * `fields` を渡すと、その科目だけから作る（**科目免除の形式**で使う）。
 * このとき、不足分を他章から補うのも**同じ科目の中に限る。**
 * 免除された科目の問題が混ざったら、免除の形式にならない。
 */
function build(count: number, fields?: FieldId[]): Item[] {
  const inScope = (categoryId: string): boolean => {
    if (fields === undefined) return true;
    const f = fieldOfCategory(categoryId);
    return f !== undefined && fields.includes(f);
  };
  const weighted = CATEGORIES.filter((c) => c.questions > 0 && inScope(c.id));
  const totalWeight = weighted.reduce((n, c) => n + c.questions, 0);
  const picked: Item[] = [];
  const used = new Set<string>();

  for (const c of weighted) {
    const want = Math.round((count * c.questions) / totalWeight);
    const pool = shuffle(QUESTIONS.filter((q) => q.categoryId === c.id));
    for (const q of pool.slice(0, want)) {
      picked.push(toItem(q));
      used.add(q.id);
    }
  }

  // 端数と、収録が足りない章の不足分を補う。**絞った科目の外からは取らない。**
  if (picked.length < count) {
    const rest = shuffle(QUESTIONS.filter((q) => !used.has(q.id) && inScope(q.categoryId)));
    for (const q of rest.slice(0, count - picked.length)) picked.push(toItem(q));
  }
  return shuffle(picked).slice(0, count);
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
  count: number;
  minutes: number;
  /** 出題する科目。未指定なら全科目（本番形式） */
  fields?: FieldId[];
  /** 学習記録に残す形式名 */
  label: string;
}

/**
 * 出題セット。
 *
 * **本番形式では、課目の重みを本番どおりにすること。**
 * 課目ごとに配点の 60 % という基準がある以上、重みが違うと判定の意味がなくなる。
 *
 * **★ この試験には課目合格の制度がある**（令和 8 年度 受験案内「試験課目の免除制度」）。
 * 一部の課目が合格基準以上なら課目合格者となり、**3 年間はその課目が免除**される。
 * **だから翌年は落とした課目だけを受ける人が多い。**課目ごとの形式を置いているのはそのため。
 *
 * **★ 問題数は仮の値です。**いまは課目ごとの大問の数を入れてある。
 * 本番は大問の中に空欄が並ぶ形で、確認問題の形がまだ決まっていない（CLAUDE.md）。
 */
const PRESETS: (Config & { note: string })[] = [
  {
    label: '本番形式（4 課目）',
    count: MOCK_QUESTIONS,
    minutes: EXAM_MINUTES,
    fields: ['kamoku1', 'kamoku2', 'kamoku3', 'kamoku4'],
    note: EXAM_MINUTES + ' 分（1 日がかり。時限の間に休憩があります）。課目ごとに配点の 6 割が目安です',
  },
  {
    label: '課目Ⅰだけ（エネルギー総合管理及び法規）',
    count: 3,
    minutes: 80,
    fields: ['kamoku1'],
    note: '80 分（1 時限）。熱分野と電気分野で共通の課目です',
  },
  {
    label: '課目Ⅱだけ（熱と流体の流れの基礎）',
    count: 4,
    minutes: 110,
    fields: ['kamoku2'],
    note: '110 分（2 時限）',
  },
  {
    label: '課目Ⅲだけ（燃料と燃焼）',
    count: 3,
    minutes: 80,
    fields: ['kamoku3'],
    note: '80 分。★ 本番では 4 時限（最後）です',
  },
  {
    label: '課目Ⅳだけ（熱利用設備及びその管理）',
    count: 6,
    minutes: 110,
    fields: ['kamoku4'],
    note: '110 分。★ 本番では 3 時限です',
  },
];

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

export function Mock(): JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [now, setNow] = useState(Date.now());
  const [reviewing, setReviewing] = useState(false);

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
      preset: `${s.config.label}　${s.items.length} 問 / ${s.config.minutes} 分`,
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
        <div className="preset-grid">
          {PRESETS.map((p) => {
            // 科目を絞る形式では、**その科目の収録数**で足りるかを見る。
            // 全体の問題数で判定すると、ある課目が空でも押せてしまう。
            const pool =
              p.fields === undefined
                ? QUESTIONS.length
                : QUESTIONS.filter((q) => {
                    const f = fieldOfCategory(q.categoryId);
                    return f !== undefined && p.fields?.includes(f);
                  }).length;
            const enough = pool >= p.count;
            return (
              <button
                key={p.label}
                type="button"
                className="action"
                disabled={!enough}
                onClick={() =>
                  setSession({
                    config: { count: p.count, minutes: p.minutes, fields: p.fields, label: p.label },
                    items: build(p.count, p.fields),
                    answers: Array.from({ length: p.count }, () => [] as number[]),
                    idx: 0,
                    startedAt: Date.now(),
                    finishedAt: null,
                  })
                }
              >
                <span className="action-title">{p.label}</span>
                <span className="action-sub">
                  {enough ? p.note : `収録問題が不足しています（現在 ${pool} 問）`}
                </span>
              </button>
            );
          })}
        </div>
        <p className="hint">
          本番は 4 課目を 1 日で受けます。合計 {EXAM_MINUTES} 分ですが、
          <strong>時限の間に休憩があるので、通しで {EXAM_MINUTES} 分座るわけではありません。</strong>
          <strong>★ 課目の番号と時限の順番は違います。</strong>課目Ⅳが 3 時限、課目Ⅲが 4 時限（最後）です。
        </p>
        <p className="hint warn">
          <strong>★ この模試は、本番の問題の形ではありません。</strong>
          本番は大問の中に空欄がいくつも並び、空欄ごとに語群や数値をマークする形です。
          ここで測れるのは、解くのに必要な知識がそろっているかまでです。
        </p>
        <p className="hint">
          <strong>合格基準は、各課目とも配点の {Math.round(PASS_RATIO * 100)} % です。</strong>
          合計点ではありません。<strong>1 課目でも 6 割に届かないと合格になりません</strong>ので、この模試も課目ごとに結果を出します。
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
    // 科目を絞った形式かどうか。絞った形式では、出していない科目の行の書き方を変える
    const narrowed = session.config.fields;
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
          <h2>科目別の判定</h2>
          <p className="hint">
            <strong>合格基準は「各科目とも満点の {Math.round(PASS_RATIO * 100)} パーセント程度」</strong>と公表されています。
            <strong>「以上」とは言い切られていません。</strong>合計点ではないので、
            <strong>1 科目でも 6 割に届かないと厳しい</strong>と見てください。
            下の表は、科目ごとに<strong>この模試で 6 割に届いたか</strong>を出しているだけです。
            <strong>本番の合否を判定するものではありません。</strong>
          </p>
          {narrowed !== undefined && (
            <p className="hint">
              これは<strong>科目を絞った形式</strong>です。判定は
              <strong>{narrowed.map(fieldName).join('・')}だけ</strong>で決まります。
              <strong>本番はこの科目の組合せではありません</strong>（科目免除を受けた場合の形式です）。
            </p>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>科目</th>
                  <th>正解 / 出題</th>
                  <th>正答率</th>
                  <th>6 割に届いたか</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((f) => {
                  const met = f.total > 0 && f.correct / f.total >= PASS_RATIO;
                  // **出していない科目を「出題なし」と並べない。**
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
