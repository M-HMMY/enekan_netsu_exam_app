import { useEffect } from 'react';
import { MAX_KEY_CHOICES } from './answer';

/** 画面の案内に出す「1〜n」の n。数字キーで選べるのは 9 個目まで */
export const keyChoiceCount = (choices: number): number => Math.min(choices, MAX_KEY_CHOICES);

/** 10 個目以降がキーで選べないときに、案内へ添える一言。9 個以下なら空文字 */
export const keyChoiceNote = (choices: number): string =>
  choices > MAX_KEY_CHOICES ? `（${MAX_KEY_CHOICES + 1} 個目以降はクリック）` : '';

/**
 * 画面全体のキーボードショートカット。
 * 入力欄にフォーカスがあるときと、修飾キーを伴うときは何もしない
 * （ブラウザ標準の操作を奪わないため）。
 */
export function useKeys(handler: (key: string) => void): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      handler(e.key);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handler]);
}

/**
 * 「1」〜「max」が押されたら 0〜max-1 を返す。それ以外は null。
 *
 * **`max` は、その問題の選択肢の数を渡すこと。既定値は無い。**この試験は空欄ごとに
 * 解答群の数が違う（2〜20 個）。既定値に頼ると、2 択の問題で「5」を押して
 * 存在しない選択肢を選べてしまう。10 個目以降はキーでは選べない（クリックで選ぶ）。
 */
export function choiceIndexOf(key: string, max: number): number | null {
  const n = Number(key);
  if (!Number.isInteger(n) || n < 1 || n > Math.min(max, MAX_KEY_CHOICES)) return null;
  return n - 1;
}
