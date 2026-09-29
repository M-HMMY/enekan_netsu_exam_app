import { useState, type JSX } from 'react';

/**
 * 総括伝熱係数を、3 つの抵抗の内訳つきで見る。
 *
 * 教本には「直列の抵抗では、いちばん大きい抵抗が全体を支配する」と書いてある。
 * **文章では当たり前に読めるが、どれが支配しているかは数字を動かさないと掴めない。**
 *
 * つまみを動かすと、次の 3 つが見える。
 *   - **総括伝熱係数は、いちばん小さい熱伝達率より必ず小さい**
 *   - **いちばん通りにくいところを直さないと、全体はよくならない**
 *     （支配していない側をいくら上げても、総括伝熱係数はほとんど動かない）
 *   - **金属の壁は、たいてい抵抗として効かない**（境膜のほうがずっと大きい）
 *
 * ★ 汚れは入れていない。教本どおり**独立した直列抵抗として足す**ものなので、
 *   ここで熱伝達率に押し込めると、その扱いを覚え違える。
 */
export const widgetId = 'netsu-teikou';

export default function NetsuTeikou(): JSX.Element {
  const [hi, setHi] = useState(2000);
  const [ho, setHo] = useState(300);
  const [t, setT] = useState(4);
  const [lam, setLam] = useState(45);

  const ri = 1 / hi;
  const rw = t / 1000 / lam;
  const ro = 1 / ho;
  const total = ri + rw + ro;
  const u = 1 / total;

  const share = (r: number): number => (r / total) * 100;
  const biggest = ri >= rw && ri >= ro ? '内側の境膜' : ro >= rw ? '外側の境膜' : '壁';
  const smallestH = Math.min(hi, ho);

  return (
    <div className="widget-body">
      <div className="widget-head">
        <span className="widget-title">総括伝熱係数と、3 つの抵抗の内訳</span>
      </div>
      <p className="widget-lead">
        熱は<strong>内側の境膜 → 壁 → 外側の境膜</strong>を順に通ります。
        順に通るので<strong>直列につながった抵抗</strong>として扱い、足してから逆数を取ります。
        足すのは抵抗であって、熱伝達率ではありません。
      </p>

      <label className="widget-slider">
        <span>内側の熱伝達率</span>
        <input type="range" min={100} max={5000} step={100} value={hi} onChange={(e) => setHi(Number(e.target.value))} />
        <span>{hi} W/(m²・K)</span>
      </label>
      <label className="widget-slider">
        <span>外側の熱伝達率</span>
        <input type="range" min={20} max={5000} step={20} value={ho} onChange={(e) => setHo(Number(e.target.value))} />
        <span>{ho} W/(m²・K)</span>
      </label>
      <label className="widget-slider">
        <span>壁の厚さ</span>
        <input type="range" min={1} max={40} step={1} value={t} onChange={(e) => setT(Number(e.target.value))} />
        <span>{t} mm</span>
      </label>
      <label className="widget-slider">
        <span>壁の熱伝導率</span>
        <input type="range" min={1} max={400} step={1} value={lam} onChange={(e) => setLam(Number(e.target.value))} />
        <span>{lam} W/(m・K)</span>
      </label>

      <div className="widget-result tone-warn">総括伝熱係数 {u.toFixed(1)} W/(m²・K)</div>

      <table className="widget-table">
        <thead>
          <tr>
            <th>どこ</th>
            <th>抵抗 (m²・K)/W</th>
            <th>全体に占める割合</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>内側の境膜</td>
            <td>{ri.toFixed(5)}</td>
            <td className={biggest === '内側の境膜' ? 'hit' : ''}>{share(ri).toFixed(1)} パーセント</td>
          </tr>
          <tr>
            <td>壁</td>
            <td>{rw.toFixed(5)}</td>
            <td className={biggest === '壁' ? 'hit' : ''}>{share(rw).toFixed(1)} パーセント</td>
          </tr>
          <tr>
            <td>外側の境膜</td>
            <td>{ro.toFixed(5)}</td>
            <td className={biggest === '外側の境膜' ? 'hit' : ''}>{share(ro).toFixed(1)} パーセント</td>
          </tr>
          <tr>
            <td>合計</td>
            <td>{total.toFixed(5)}</td>
            <td>逆数が総括伝熱係数</td>
          </tr>
        </tbody>
      </table>

      <p className="widget-note">
        ★ いま全体を支配しているのは<strong>{biggest}</strong>です。
        ここを改善しないかぎり、ほかをいくらよくしても総括伝熱係数はほとんど動きません。
        支配していない側のつまみを動かして、値がどれだけ動かないかを見てください。
      </p>
      <p className="widget-note">
        ★ 総括伝熱係数 {u.toFixed(1)} は、<strong>いちばん小さい熱伝達率 {smallestH} より必ず小さく</strong>なります。
        直列の抵抗を足しているのだから、当然そうなります。<strong>桁の検算に使えます。</strong>
      </p>
      <p className="widget-note">
        ★ 壁の厚さを動かしても、ほとんど効かないことが多いはずです。
        <strong>金属の熱伝導率は境膜に比べてずっと大きい</strong>からです。
        熱伝導率のつまみを 1 まで下げると、はじめて壁が効いてきます。断熱材はその側にいます。
      </p>
      <p className="widget-note">
        ★ 汚れはここに入れていません。教本のとおり
        <strong>独立した直列抵抗として足す</strong>ものだからです。
        熱伝達率の変化として押し込めると、運転中の汚れの進み具合を別に追えなくなります。
      </p>
      <p className="widget-note">
        ★ 総括伝熱係数には<strong>基準</strong>があります。内面基準・外面基準・平均径基準のどれかを
        必ず添えて、<strong>掛ける面積と基準をそろえます。</strong>ここは平板とみなした話なので、
        基準の区別は出てきません。
      </p>
    </div>
  );
}
