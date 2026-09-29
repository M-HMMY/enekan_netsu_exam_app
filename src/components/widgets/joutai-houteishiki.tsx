import { useState, type JSX } from 'react';

/**
 * 理想気体の状態方程式を、圧力・体積・温度を動かして確かめる。
 *
 * **絶対圧力と絶対温度で入れること**が体で分かるように、
 * ゲージ圧力とセルシウス温度で操作させ、絶対の値を横に出している。
 * セルシウス温度のまま比をとると答えがどれだけ外れるかも、同時に見える。
 */
export const widgetId = 'joutai-houteishiki';

export default function JoutaiHouteishiki(): JSX.Element {
  const [pg, setPg] = useState(0.4);
  const [t1, setT1] = useState(27);
  const [t2, setT2] = useState(127);

  const atm = 0.1013;
  const pa1 = pg + atm;
  const k1 = t1 + 273.15;
  const k2 = t2 + 273.15;

  /** 体積一定なので、絶対圧力は絶対温度に比例する */
  const pa2 = (pa1 * k2) / k1;
  const pg2 = pa2 - atm;
  /** よくある誤り：ゲージ圧力のまま、セルシウス温度の比を掛ける */
  const wrong = (pg * t2) / t1;

  return (
    <div className="widget-body">
      <div className="widget-head">
        <span className="widget-title">内容積が一定の容器を温める</span>
      </div>
      <p className="widget-lead">
        体積が変わらなければ、<strong>絶対圧力は絶対温度に比例</strong>します。
        圧力計の指示とセルシウス温度を動かして、絶対の値と見比べてください。
      </p>

      <label className="widget-slider">
        <span>はじめの圧力計の指示</span>
        <input type="range" min={0} max={2} step={0.05} value={pg} onChange={(e) => setPg(Number(e.target.value))} />
        <span>{pg.toFixed(2)} MPa</span>
      </label>
      <label className="widget-slider">
        <span>はじめの温度</span>
        <input type="range" min={-20} max={100} step={1} value={t1} onChange={(e) => setT1(Number(e.target.value))} />
        <span>{t1} 度（{k1.toFixed(1)} K）</span>
      </label>
      <label className="widget-slider">
        <span>温めたあとの温度</span>
        <input type="range" min={-20} max={400} step={1} value={t2} onChange={(e) => setT2(Number(e.target.value))} />
        <span>{t2} 度（{k2.toFixed(1)} K）</span>
      </label>

      <div className="widget-result tone-safe">
        温めたあとの圧力計の指示は {pg2.toFixed(3)} MPa
      </div>

      <ul className="widget-list">
        <li className="passed">絶対圧力に直す … {pg.toFixed(2)} ＋ {atm} ＝ {pa1.toFixed(3)} MPa</li>
        <li className="passed">
          絶対温度の比を掛ける … {pa1.toFixed(3)} × {k2.toFixed(1)} ÷ {k1.toFixed(1)} ＝ {pa2.toFixed(3)} MPa
        </li>
        <li className="passed">圧力計の指示に戻す … {pa2.toFixed(3)} − {atm} ＝ {pg2.toFixed(3)} MPa</li>
      </ul>

      <p className="widget-note">
        ★ ゲージ圧力のまま、セルシウス温度の比を掛けると {Number.isFinite(wrong) ? wrong.toFixed(3) : '—'} MPa になります。
        ずれの大きさは温度と圧力によって変わり、<strong>低圧・低温ほど大きく外れます</strong>。
        行きと帰りの両方で直すことを忘れないでください。
      </p>
    </div>
  );
}
