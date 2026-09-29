import { useState, type JSX } from 'react';
import { Widget, widgetIds } from '../components/Widget';
import { navigate } from '../lib/router';

/**
 * 体験ツール（対話ウィジェット）の一覧。教本の該当箇所にも同じものが埋め込まれている。
 *
 * ここに並べた id は、`src/components/widgets/<id>.tsx` を作れば自動で有効になる
 * （`Widget.tsx` がファイルを走査して登録する）。まだ書いていない id は表示されない。
 *
 * **先頭のグループを 1 つも実装しないまま置かないこと。**姉妹アプリでは、
 * 既定で開くグループが空で「この分類のツールはまだ用意されていません」だけの
 * 画面になる不具合が出た（下の `firstFilled` はその回避）。
 *
 * 並びは `docs/section-plan.md` の章立てに合わせてある。
 * **数値を動かすと結論が変わるところ**を選ぶこと（読めば分かるものはウィジェットにしない）。
 *
 * **★ ここに書き漏らすと「その他」へ落ちます**（2026 年 9 月 23 日に実際に起きた）。
 * 画面から消えるわけではないので、**目で見ても不具合に見えません。**
 * `check.ts` に**「ウィジェットのファイルが全部どれかのグループに入っているか」の検査**を
 * 足してあるので、足し忘れれば鳴ります。
 */
const GROUPS: { name: string; note: string; ids: string[] }[] = [
  // ★ 立ち上げのときに、高圧ガス甲種版から課目Ⅱ・Ⅲにそのまま効く 5 つだけを持ってきた。
  //   **まだ教本のどこにも埋め込んでいない**（教本が無いので）。節を書いたら必ず埋めること。
  {
    name: '熱力学（課目Ⅱ）',
    note: '状態方程式で、圧力・体積・温度・物質量のどれかを動かすと残りがどう動くかを確かめます',
    ids: ['joutai-houteishiki'],
  },
  {
    name: '流体（課目Ⅱ）',
    note: 'レイノルズ数を出し、その下に「何と比べたか」を並べます。値だけでは判定になりません',
    ids: ['reynolds'],
  },
  {
    name: '伝熱（課目Ⅱ・Ⅳ）',
    note: '直列の抵抗のうちどれが全体を支配するか、対数平均が算術平均とどれだけ違うかを見ます',
    ids: ['netsu-teikou', 'taisuu-heikin'],
  },
  {
    name: '燃焼計算（課目Ⅲ）',
    note: '燃料の組成から理論酸素量・理論空気量を出します',
    ids: ['riron-kuuki'],
  },
];

export function Tools(): JSX.Element {
  const [openGroup, setOpenGroup] = useState<string>(GROUPS[0].name);
  const known = new Set(GROUPS.flatMap((g) => g.ids));
  const others = widgetIds.filter((id) => !known.has(id));

  if (widgetIds.length === 0) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>体験ツール</h1>
          <p className="lead">
            文章だけでは掴みにくいところを、数値を動かして確かめるための道具です。教本の該当セクションにも同じものが埋め込まれます。
          </p>
        </header>
        <section className="section">
          <p className="hint">
            体験ツールはまだ 1 つも用意されていません。
            <code>src/components/widgets/</code> にファイルを追加すると、この画面と教本本文の両方で自動的に使えるようになります。
          </p>
        </section>
        <div className="read-actions">
          <button type="button" className="btn primary" onClick={() => navigate('textbook')}>
            教本を読む
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>体験ツール</h1>
        <p className="lead">
          文章だけでは掴みにくいところを、数値を動かして確かめるための道具です。教本の該当セクションにも同じものが埋め込まれています。
        </p>
      </header>

      <div className="chips">
        {GROUPS.map((g) => (
          <button
            key={g.name}
            type="button"
            className={`chip ${openGroup === g.name ? 'on' : ''}`}
            onClick={() => setOpenGroup(g.name)}
          >
            {g.name}（{g.ids.filter((id) => widgetIds.includes(id)).length}）
          </button>
        ))}
      </div>

      {GROUPS.filter((g) => g.name === openGroup).map((g) => {
        const ready = g.ids.filter((id) => widgetIds.includes(id));
        return (
          <section key={g.name} className="section">
            <h2>{g.name}</h2>
            <p className="hint">{g.note}</p>
            {ready.length === 0 && <p className="hint">この分類のツールはまだ用意されていません。</p>}
            {ready.map((id) => (
              <Widget key={id} id={id} />
            ))}
          </section>
        );
      })}

      {others.length > 0 && (
        <section className="section">
          <h2>その他</h2>
          {others.map((id) => (
            <Widget key={id} id={id} />
          ))}
        </section>
      )}
    </div>
  );
}
