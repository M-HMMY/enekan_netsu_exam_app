import { useState, type JSX } from 'react';

/**
 * 炭化水素の組成から、理論酸素量・理論空気量・化学量論組成を出す。
 *
 * **x + y/4 という式ひとつで主な炭化水素が出せる**ことと、
 * **理論空気量は 0.21 で「割る」**ことを、動かして確かめる道具。
 * 化学量論組成まで出すので、燃焼の章と爆発範囲の章がつながる。
 */
export const widgetId = 'riron-kuuki';

export default function RironKuuki(): JSX.Element {
  const [x, setX] = useState(3); // 炭素の数
  const [y, setY] = useState(8); // 水素の数

  /** ★ 炭素の原子価から、鎖状の炭化水素では y は 2x+2 を超えられない。 */
  const real = y <= 2 * x + 2;

  const o2 = x + y / 4;
  const air = o2 / 0.21;
  /** 燃料 1 に対し空気 air のとき、燃料の占める割合 */
  const stoich = (1 / (1 + air)) * 100;

  const name =
    x === 1 && y === 4
      ? 'メタン'
      : x === 2 && y === 6
        ? 'エタン'
        : x === 2 && y === 4
          ? 'エチレン'
          : x === 3 && y === 8
            ? 'プロパン'
            : x === 4 && y === 10
              ? 'ブタン'
              : null;

  return (
    <div className="widget-body">
      <div className="widget-head">
        <span className="widget-title">理論酸素量と理論空気量</span>
      </div>
      <p className="widget-lead">
        炭化水素 C<sub>x</sub>H<sub>y</sub> の完全燃焼に必要な理論酸素量は、
        <strong>x ＋ y/4</strong> モルです。反応式を書かなくても、この式ひとつで出せます。
      </p>

      <label className="widget-slider">
        <span>炭素の数 x</span>
        <input type="range" min={1} max={8} step={1} value={x} onChange={(e) => setX(Number(e.target.value))} />
        <span>{x}</span>
      </label>
      <label className="widget-slider">
        <span>水素の数 y</span>
        <input type="range" min={2} max={18} step={2} value={y} onChange={(e) => setY(Number(e.target.value))} />
        <span>{y}</span>
      </label>

      <div className={`widget-result ${real ? 'tone-safe' : 'tone-warn'}`}>
        C<sub>{x}</sub>H<sub>{y}</sub>
        {name ? `（${name}）` : ''} … 理論空気量は燃料の約 {air.toFixed(1)} 倍
      </div>

      {!real && (
        <p className="widget-warn">
          C<sub>{x}</sub>H<sub>{y}</sub> は、炭素の手の数から実在しない組合せです
          （鎖状の炭化水素では、水素の数は <strong>2x ＋ 2 ＝ {2 * x + 2}</strong> を超えられません）。
          式の練習にはなりますが、このガスはありません。
        </p>
      )}

      <ul className="widget-list">
        <li className="passed">
          理論酸素量 … {x} ＋ {y} ÷ 4 ＝ {o2.toFixed(2)} モル
        </li>
        <li className="passed">
          理論空気量 … {o2.toFixed(2)} ÷ 0.21 ＝ {air.toFixed(2)}（空気中の酸素は体積で約 21 パーセント）
        </li>
        <li className="passed">
          化学量論組成 … 1 ÷（1 ＋ {air.toFixed(2)}）＝ 約 {stoich.toFixed(1)} 体積パーセント
        </li>
      </ul>

      <p className="widget-note">
        ★ 0.21 で<strong>割る</strong>のであって、掛けるのではありません。掛けてしまうと、
        必要な空気が酸素より少ないという、あり得ない答えになります。1 ÷ 0.21 はおよそ 4.8 なので、
        <strong>理論空気量は理論酸素量のおよそ 4.8 倍</strong>と覚えておくと検算になります。
      </p>
      <p className="widget-note">
        ★ 最後に出した化学量論組成は、<strong>燃焼速度が最大になる組成</strong>のおおよその位置でもあります。
        最小発火エネルギーと消炎距離が最小になるのも、このあたりです。
        ただし<strong>爆発範囲の中央ではありません</strong>。多くの炭化水素では、
        上で出した化学量論組成は<strong>中央より下限界寄り</strong>にあります。
        実際の下限界・上限界は、爆発範囲のツールに入れて確かめてください。
      </p>
    </div>
  );
}
