import { useState, type JSX } from 'react';

/**
 * 対数平均温度差と算術平均温度差を並べて、**どれだけ違うか**を見る。
 *
 * 高圧ガス甲種版で作ったもの。エネルギー管理士の課目Ⅱ（伝熱）にもそのまま効く。
 * 教本では「既定は対数平均」「算術平均は指示があるときだけ」と書けるが、
 * **どのくらい違うのかは数字を動かさないと掴めない。**
 *
 * つまみを動かすと、次の 2 つが見える。
 *   - **対数平均は、いつでも算術平均より小さい**（検算に使える）
 *   - **両端の温度差の比が 1 に近いと、ほとんど差がない**
 *     （だから「比が小さければ算術平均でもよい」という目安が出てくる）
 *
 * ★ 両端が等しいと比が 1 になり、対数の分母が 0 になる。
 *   **極限では対数平均は温度差そのもの**なので、そう返す。
 */
export const widgetId = 'taisuu-heikin';

export default function TaisuuHeikin(): JSX.Element {
  const [d1, setD1] = useState(80);
  const [d2, setD2] = useState(20);

  const hi = Math.max(d1, d2);
  const lo = Math.min(d1, d2);
  const ratio = hi / lo;
  // ★ 比が 1 のとき、(Δ1 − Δ2) / ln(Δ1/Δ2) は 0 ÷ 0 になる。極限は Δ そのもの。
  const lmtd = Math.abs(hi - lo) < 1e-9 ? hi : (hi - lo) / Math.log(ratio);
  const arith = (hi + lo) / 2;
  const gap = ((arith - lmtd) / lmtd) * 100;

  const tone = gap < 2 ? 'tone-safe' : gap < 10 ? 'tone-warn' : 'tone-danger';

  return (
    <div className="widget-body">
      <div className="widget-head">
        <span className="widget-title">対数平均温度差と算術平均温度差</span>
      </div>
      <p className="widget-lead">
        熱交換器の両端で、高温側と低温側の温度差は違います。その 2 つから
        <strong>平均の温度差</strong>を作るとき、既定は<strong>対数平均</strong>です。
        算術平均を使ってよいのは、問題文がそう指示している場合だけです。
      </p>

      <label className="widget-slider">
        <span>一方の端の温度差</span>
        <input type="range" min={5} max={200} step={5} value={d1} onChange={(e) => setD1(Number(e.target.value))} />
        <span>{d1} K</span>
      </label>
      <label className="widget-slider">
        <span>もう一方の端の温度差</span>
        <input type="range" min={5} max={200} step={5} value={d2} onChange={(e) => setD2(Number(e.target.value))} />
        <span>{d2} K</span>
      </label>

      <div className={'widget-result ' + tone}>
        対数平均 {lmtd.toFixed(1)} K ／ 算術平均 {arith.toFixed(1)} K
      </div>

      <table className="widget-table">
        <thead>
          <tr>
            <th>量</th>
            <th>出し方</th>
            <th>値</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>両端の温度差の比</td>
            <td>大きいほう ÷ 小さいほう</td>
            <td>{ratio.toFixed(2)}</td>
          </tr>
          <tr>
            <td>対数平均温度差</td>
            <td>差 ÷ 比の自然対数</td>
            <td className="hit">{lmtd.toFixed(1)} K</td>
          </tr>
          <tr>
            <td>算術平均温度差</td>
            <td>和 ÷ 2</td>
            <td>{arith.toFixed(1)} K</td>
          </tr>
          <tr>
            <td>算術平均で置き換えたときのずれ</td>
            <td>対数平均に対する割合</td>
            <td className={gap >= 10 ? 'miss' : ''}>{gap.toFixed(1)} パーセント</td>
          </tr>
        </tbody>
      </table>

      {gap >= 10 && (
        <p className="widget-warn">
          両端の温度差の比が {ratio.toFixed(1)} 倍になっています。ここまで開くと、
          算術平均で置き換えた値は対数平均より {gap.toFixed(0)} パーセントも大きくなります。
          <strong>必要な伝熱面積を、そのぶん小さく見積もってしまいます。</strong>
        </p>
      )}

      <p className="widget-note">
        ★ どう動かしても、<strong>対数平均は算術平均より小さいまま</strong>です。
        逆になったら、どこかで割る相手を間違えています。<strong>検算に使えます。</strong>
      </p>
      <p className="widget-note">
        ★ 2 つのつまみを近づけると、比が 1 に近づいてずれが消えます。
        <strong>「比が小さければ算術平均でもよい」という目安は、ここから来ています。</strong>
        ただしそれは目安であって、<strong>置き換えてよいという許可ではありません。</strong>
        答案には、どちらを使ったかとその理由を書きます。
      </p>
      <p className="widget-note">
        ★ 並流と向流では、<strong>どの温度どうしの差を取るか</strong>が変わります。
        この道具はその先の話なので、まず流れ方を確かめてから両端の差を出してください。
      </p>
    </div>
  );
}
