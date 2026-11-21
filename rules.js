/* Moteur de règles - repris de Calcul_temps_sécurité_V16 (créneaux de 15 min). Seuils en minutes. */
(function (g) {
  const Q = 15, R = { t7: 420, t9: 540, h4: 240, t6: 360, d24: 1440, def: 885 };
  const mm = t => { const [a, b] = t.split(':'); return +a * 60 + +b; };
  const hm = m => Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0');
  // Créneaux : true = intervention (travail). Début arrondi au quart d'heure inférieur, fin au supérieur.
  const slots = (iv, n) => { const a = Array(n).fill(false); for (const v of iv) for (let i = Math.floor(v.s / Q); i < Math.ceil(v.e / Q); i++) if (i >= 0 && i < n) a[i] = true; return a; };
  const longest = a => { let b = 0, c = 0; for (const w of a) { c = w ? 0 : c + 1; if (c > b) b = c; } return b * Q; };
  // Semaine : fenêtre 17h30 -> 8h00 (58 créneaux)
  const wOff = t => { const m = mm(t); if (m >= 1050) return m - 1050; if (m <= 480) return m + 390; return null; };
  // Week-end : fenêtre vendredi 16h -> lundi 8h (256 créneaux). d : 0=ven 1=sam 2=dim 3=lun
  const wkOff = (d, t) => { const o = d * 1440 + mm(t) - 960; return o >= 0 && o <= 3840 ? o : null; };

  function week(iv, nights, idx) {
    const s = slots(iv, 58), A = longest(s), w = s.slice(18, 54), B = w.filter(x => x).length * Q, C = longest(w), st = [];
    let out = null;
    st.push({ q: 'Plus grand repos entre 17h30 et 8h00 inférieur à 7h ?', v: hm(A), a: A < R.t7 });
    if (A < R.t7) out = 'R11';
    else {
      const l9 = A < R.t9;
      st.push({ q: 'Plus grand repos inférieur à 9h ?', v: hm(A), a: l9 });
      if (l9) {
        const n = nights.map((x, i) => i === idx ? A : x).filter(x => x < R.t9).length + (idx < 0 ? 1 : 0);
        st.push({ q: 'Deux temps de repos de la semaine inférieurs à 9h ?', v: n + ' nuit(s)', a: n > 1 });
        if (n > 1) out = 'R11';
      }
    }
    if (!out) {
      st.push({ q: "Durée d'intervention entre 22h et 7h supérieure à 4h ?", v: hm(B), a: B > R.h4 });
      if (B > R.h4) out = 'R11';
      else {
        st.push({ q: 'Plus grand repos continu entre 22h et 7h inférieur à 6h ? (règle Morbihan)', v: hm(C), a: C < R.t6 });
        out = C < R.t6 ? 'PM' : 'NONE';
      }
    }
    return { A, B, C, out, st, slots: s };
  }

  function wk(iv) {
    const s = slots(iv, 256), L = longest(s);
    return { L, out: L >= R.d24 ? 'NONE' : 'R35', st: [{ q: 'Plus grand repos consécutif supérieur ou égal à 24h ?', v: hm(L), a: L >= R.d24 }], slots: s };
  }

  const TXT = {
    R11: 'Repos récupérateur de 11h (9h si astreinte la nuit suivante)',
    PM: "Après-midi de repos (règle Morbihan) - soumis à l'accord du chef d'agence",
    NONE: 'Pas de repos compensateur',
    R35: 'Repos de 35h à partir de lundi matin'
  };
  const api = { R, mm, hm, wOff, wkOff, week, wk, TXT };
  if (typeof module !== 'undefined') module.exports = api; else g.RT = api;
})(this);
