import type { JSX, ReactNode } from 'react';
import type { Question } from '../types';
import { ChoiceList, CHOICE_LABELS } from './ChoiceList';
import { LAW_PREAMBLE, categoryName } from '../data/categories';
import { Markdown } from '../lib/markdown';
import { sectionById } from '../data/textbook';
import { passageById } from '../data/questions/passages';
import { navigate } from '../lib/router';
import { answerIndices, isCorrectAnswer, isMultiAnswer } from '../lib/answer';

interface Props {
  q: Question;
  /** 選択済みの添字。未選択は空配列 */
  selected: readonly number[];
  /** 解答を確定して解説を表示している状態か */
  revealed: boolean;
  onSelect: (index: number) => void;
  /** 進捗表示（例: 3 / 20） */
  counter?: string;
  /** 解説の下に置く操作ボタン群 */
  footer?: ReactNode;
  /** 模試モードでは正誤も解説も伏せる */
  hideResult?: boolean;
}

/** コード断片を行番号付きで表示する。空欄は本文中で ___ と書く */
function CodeBlock({ code }: { code: string }): JSX.Element {
  const lines = code.replace(/\r\n/g, LF).split(LF);
  return (
    <div className="pseudo">
      <ol className="pseudo-lines">
        {lines.map((line, i) => (
          <li key={i}>
            <span className="pseudo-code">{line === '' ? ' ' : line}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** ヒアドキュメント経由の編集で壊れやすいので、改行はここで一度だけ作る */
const LF = String.fromCharCode(10);

export function QuestionCard({
  q,
  selected,
  revealed,
  onSelect,
  counter,
  footer,
  hideResult = false,
}: Props): JSX.Element {
  const section = q.sectionId ? sectionById(q.sectionId) : undefined;
  // 法令の問題には、本番と同じ前置きを置く。**飾りではない。**
  // 基準日（令和 8 年 4 月 1 日時点の法令）を示さないと、改正の前後で記述の正誤が割れる。`LAW_PREAMBLE` の注記を読むこと。
  const isLaw = q.categoryId === 'k1-law';
  // 大問の前置き。本番と同じく、問いより先に設定を読ませる
  const passage = q.passage ? passageById(q.passage) : undefined;
  const multi = isMultiAnswer(q.answer);
  const right = answerIndices(q.answer);
  const isCorrect = isCorrectAnswer(q.answer, selected);

  return (
    <article className="qcard">
      <header className="qcard-head">
        <div className="qcard-tags">
          <span className="tag">確認問題</span>
          <span className="tag tag-cat">{categoryName(q.categoryId)}</span>
          <span className="tag tag-level">{'★'.repeat(q.level)}</span>
          {multi && <span className="tag tag-multi">複数選択</span>}
          {q.source && <span className="tag tag-src">公式過去問</span>}
        </div>
        {counter && <span className="counter">{counter}</span>}
      </header>

      {isLaw && (
        <ul className="law-preamble">
          {LAW_PREAMBLE.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      {passage && (
        <div className="qpassage">
          <Markdown source={passage.body} />
        </div>
      )}
      {/*
        前置きが見つからないときは、黙って消さずに知らせる。前置きには問題の条件が書いてあるので、
        消えると問題が解けなくなるのに、画面からは気づけない。`npm run check` はエラーにするが、
        `npm run build` は check を通らないので、ここでも見えるようにしておく。
      */}
      {q.passage && !passage && (
        <p className="qpassage qpassage-missing">
          この問題の前提となる文章（{q.passage}）が見つかりません。問題データの不具合です。
        </p>
      )}

      <div className="qbody">
        <Markdown source={q.question} />
      </div>

      {q.code && <CodeBlock code={q.code} />}

      {/*
        操作の説明だけを出す。**いくつ選ぶのかは書かない。**
        本番でそれを教えてくれる保証はないので、必要なら問題文の側に書く
        （`npm run check` が問題文への記載を required にしている）。
      */}
      {multi && !revealed && <p className="multi-hint">押すたびに選択が入り切りします。</p>}

      <ChoiceList
        choices={q.choices}
        selected={selected}
        answer={hideResult ? null : right}
        revealed={revealed}
        multi={multi}
        onSelect={onSelect}
      />

      {revealed && !hideResult && (
        <div className={`result ${isCorrect ? 'ok' : 'ng'}`}>
          <p className="verdict">
            {isCorrect ? '正解' : '不正解'}　正解は {right.map((i) => CHOICE_LABELS[i]).join('・')}
          </p>
          <div className="explanation">
            <Markdown source={q.explanation} />
          </div>
          {section && (
            <button type="button" className="link-btn" onClick={() => navigate(`textbook/${section.id}`)}>
              教本で復習する：{section.title}
            </button>
          )}
        </div>
      )}

      {q.source && <p className="qsource">出典：{q.source}</p>}

      {footer && <div className="qcard-footer">{footer}</div>}
    </article>
  );
}
