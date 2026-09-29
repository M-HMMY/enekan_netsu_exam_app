import { useEffect } from 'react';

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
 * 解答群の数が違う（3〜8 個）。既定値に頼ると、3 択の問題で「5」を押して
 * 存在しない選択肢を選べてしまう。
 */
export function choiceIndexOf(key: string, max: number): number | null {
  const n = Number(key);
  if (!Number.isInteger(n) || n < 1 || n > max) return null;
  return n - 1;
}
