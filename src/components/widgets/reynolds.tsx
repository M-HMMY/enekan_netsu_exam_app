import { useState, type JSX } from 'react';

/**
 * レイノルズ数を動かして、**値を出すことと判定することは別**だと分かってもらう。
 *
 * 高圧ガス甲種版で作ったもの。エネルギー管理士の課目Ⅱ（流体）にもそのまま効く。
 * 数値を出しただけでは点にならない。**比べた基準を答案に残す**ところまでが答えである。
 * だからこの道具は、値の横に**必ず「何と比べたか」を出す。**
 *
 * ★ 2,300 と 4,000 は**教科書ごとに幅のある目安**で、台帳にも
 *   「目安」として入れてある（docs/primary-numbers.md §16）。
 *   **入口の乱れや管の状態で動く**ことを、画面にも書いておく。
 *   問題文が基準を示している場合は、そちらが優先する。
 */
export const widgetId = 'reynolds';

export default function Reynolds(): JSX.Element {
  const [rho, setRho] = useState(1000);
  const [u, setU] = useState(1.0);
  const [dmm, setDmm] = useState(50);
  const [mu, setMu] = useState(0.001);

  const d = dmm / 1000;
  const re = (rho * u * d) / mu;
  const nu = mu / rho; // 動粘性係数

  const state = re < 2300 ? '層流' : re > 4000 ? '乱流' : '遷移域';
  const tone = re < 2300 ? 'tone-safe' : re > 4000 ? 'tone-danger' : 'tone-warn';
  const basis =
    re < 2300
      ? '2,300 より小さい'
      : re > 4000
        ? '4,000 より大きい'
        : '2,300 と 4,000 の間にある';

  return (
    <div className="widget-body">
      <div className="widget-head">
        <span className="widget-title">レイノルズ数と、流れの判定</span>
      </div>
      <p className="widget-lead">
        レイノルズ数は<strong>慣性力と粘性力の比</strong>を表す無次元数です。
        密度・平均流速・代表長さを掛けて、粘性係数で割ります。
        <strong>単位が残ったら、どこかで組み方を間違えています。</strong>
      </p>

      <label className="widget-slider">
        <span>密度</span>
        <input type="range" min={100} max={2000} step={50} value={rho} onChange={(e) => setRho(Number(e.target.value))} />
        <span>{rho} kg/m³</span>
      </label>
      <label className="widget-slider">
        <span>平均流速</span>
        <input type="range" min={0.05} max={10} step={0.05} value={u} onChange={(e) => setU(Number(e.target.value))} />
        <span>{u.toFixed(2)} m/s</span>
      </label>
      <label className="widget-slider">
        <span>管の内径</span>
        <input type="range" min={5} max={500} step={5} value={dmm} onChange={(e) => setDmm(Number(e.target.value))} />
        <span>{dmm} mm</span>
      </label>
      <label className="widget-slider">
        <span>粘性係数</span>
        <input type="range" min={0.0002} max={0.5} step={0.0002} value={mu} onChange={(e) => setMu(Number(e.target.value))} />
        <span>{mu.toFixed(4)} Pa・s</span>
      </label>

      <div className={'widget-result ' + tone}>
        レイノルズ数 {re.toFixed(0)} ／ {state}
      </div>

      <table className="widget-table">
        <thead>
          <tr>
            <th>答案に残すこと</th>
            <th>中身</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>単位をそろえる</td>
            <td>
              内径 {dmm} mm を {d.toFixed(3)} m へ直す
            </td>
          </tr>
          <tr>
            <td>値を計算して示す</td>
            <td className="hit">{re.toFixed(0)}</td>
          </tr>
          <tr>
            <td>比べた基準を書く</td>
            <td>層流と乱流の目安として 2,300 と 4,000 を用いた</td>
          </tr>
          <tr>
            <td>比較して結論を述べる</td>
            <td>
              {re.toFixed(0)} は{basis}ので、{state}と判定される
            </td>
          </tr>
        </tbody>
      </table>

      <p className="widget-note">
        ★ <strong>値を出しただけでは判定になりません。</strong>
        令和 7 年度は「判定基準を示して確認せよ」という問い方でした。
        <strong>比べた基準そのものを答案に書き、どちら側にあるかを述べる</strong>ところまでが答えです。
        ここを落とすと、計算が合っていても点が入りません。
      </p>
      <p className="widget-note">
        ★ 2,300 と 4,000 は<strong>目安であって、絶対的な定数ではありません。</strong>
        入口の乱れや管の状態で動きます。<strong>問題文が基準を示している場合は、それに従ってください。</strong>
        いまの値のように{state === '遷移域' ? '遷移域に入ると、どちらとも言い切れません。' : '境界から離れていれば、判定は揺れません。'}
      </p>
      <p className="widget-note">
        ★ 動粘性係数を使って出すこともできます。いまの値なら {nu.toFixed(7)} m²/s です。
        ただし<strong>動粘性係数はすでに密度で割ってある</strong>ので、
        <strong>もう一度密度を掛けてはいけません。</strong>掛けると無次元になりません。
      </p>
      <p className="widget-note">
        ★ 粘性係数のつまみを右へ振ると、水から重油のような流体へ移っていきます。
        <strong>同じ管、同じ流速でも層流になる</strong>のが見えるはずです。
      </p>
    </div>
  );
}
