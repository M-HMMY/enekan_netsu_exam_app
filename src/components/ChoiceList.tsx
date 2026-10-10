import type { JSX } from 'react';
import { MathInline } from '../lib/math';

/**
 * 選択肢の文字。`$...$` の部分だけを行内数式として描く。
 *
 * 本番の解答群には式が並ぶ空欄がある（課目Ⅱ・Ⅲ・Ⅳ。`docs/public-questions.md` §2）。
 * 選択肢を Markdown 全体で描くと `**` や行頭の記号まで解釈されるので、数式だけに絞る。
 * `scripts/check.ts` は選択肢の数式の命令も検査している。
 */
function ChoiceText({ text }: { text: string }): JSX.Element {
  const parts = text.split(/\$([^$]+)\$/);
  if (parts.length === 1) return <>{text}</>;
  return <>{parts.map((p, i) => (i % 2 === 1 ? <MathInline key={i} expr={p} /> : p))}</>;
}

/**
 * 解答群の記号。本番と同じくア・イ・ウ…と振る。
 * **長さは `MAX_CHOICES`（20）と揃えること。**足りないと、あふれた選択肢の記号が空になる。
 */
export const CHOICE_LABELS = [
  'ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ',
  'サ', 'シ', 'ス', 'セ', 'ソ', 'タ', 'チ', 'ツ', 'テ', 'ト',
];

interface Props {
  choices: readonly string[];
  /** 選択済みの添字。未選択は空配列（単一選択でも配列で持つ） */
  selected: readonly number[];
  /** 正解の添字。正誤を伏せる場合は null */
  answer: readonly number[] | null;
  /** 解答が確定して正誤を表示している状態か */
  revealed: boolean;
  /** 複数選択の問題か。押したときの挙動は呼び出し側が決めるので、ここでは見た目だけに使う */
  multi?: boolean;
  onSelect: (index: number) => void;
}

export function ChoiceList({
  choices,
  selected,
  answer,
  revealed,
  multi = false,
  onSelect,
}: Props): JSX.Element {
  const picked = new Set(selected);
  const right = answer === null ? null : new Set(answer);

  return (
    <ul className={`choices${multi ? ' choices-multi' : ''}`}>
      {choices.map((c, i) => {
        const classes = ['choice'];
        if (picked.has(i)) classes.push('selected');
        if (revealed && right !== null) {
          if (right.has(i)) classes.push('correct');
          else if (picked.has(i)) classes.push('wrong');
        }
        return (
          <li key={i}>
            <button
              type="button"
              className={classes.join(' ')}
              onClick={() => onSelect(i)}
              disabled={revealed}
              // 複数選択は入り切りするので、押しボタンではなくチェックボックスとして読ませる
              role={multi ? 'checkbox' : undefined}
              aria-checked={multi ? picked.has(i) : undefined}
              aria-pressed={multi ? undefined : picked.has(i)}
            >
              <span className="choice-label">{CHOICE_LABELS[i]}</span>
              <span className="choice-text">
                <ChoiceText text={c} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
