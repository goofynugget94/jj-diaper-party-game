(function () {
  const STORE = "jj-diaper-game-v1";
  const stage = document.getElementById("stage");
  const entries = window.ENTRIES.map(e => Object.assign({ key: e.from + "|" + e.advice }, e));
  const byKey = Object.fromEntries(entries.map(e => [e.key, e]));

  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // state: started, order (keys), pos, phase (advice|clue|reveal), results {key: first|clue|wrong}
  let state = load() || fresh();
  let history = [];

  function fresh() { return { started: false, order: shuffle(entries.map(e => e.key)), pos: 0, phase: "advice", results: {} }; }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE));
      if (!s) return null;
      s.order = s.order.filter(k => byKey[k]);
      entries.forEach(e => { if (!s.order.includes(e.key)) s.order.push(e.key); }); // newly added entries go to the end
      return s;
    } catch (e) { return null; }
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} }
  function commit(fn) { history.push(JSON.stringify(state)); fn(); save(); render(); }

  function scores() {
    const v = Object.values(state.results);
    return { first: v.filter(x => x === "first").length, clue: v.filter(x => x === "clue").length, wrong: v.filter(x => x === "wrong").length };
  }
  const cur = () => byKey[state.order[state.pos]];

  function render() {
    const s = scores();
    document.getElementById("sFirst").textContent = s.first;
    document.getElementById("sClue").textContent = s.clue;
    document.getElementById("sWrong").textContent = s.wrong;
    document.getElementById("undoBtn").disabled = history.length === 0;
    document.getElementById("progress").textContent = state.started && state.pos < state.order.length ? `Question ${state.pos + 1} of ${state.order.length}` : "";

    if (!state.started) return renderStart();
    if (state.pos >= state.order.length) return renderSummary(s);
    const e = cur();
    if (state.phase === "advice") return renderAdvice(e);
    if (state.phase === "clue") return renderClue(e);
    renderReveal(e);
  }

  const advHtml = e => `<p class="advice ${e.advice.length > 180 ? "long" : ""}">“${esc(e.advice)}”</p>`;

  function renderStart() {
    const noName = entries.filter(e => !e.name).length;
    stage.innerHTML = `<div class="card">
      <div class="who">🍼 Who Said It?</div>
      <p class="advice">${entries.length} pieces of advice are coming up, JJ. Guess who sent each one!</p>
      <p class="hint">Right with no clue = best. Right after the name clue = still good. Otherwise we reveal.</p>
      ${noName ? `<div class="pending">${noName} entr${noName > 1 ? "ies don't" : "y doesn't"} have a name suggestion yet (fill in <b>entries.js</b> to add them).</div>` : ""}
      <label class="opt"><input type="checkbox" id="shuf" checked> Shuffle the order</label>
      <div class="row"><button id="go">Let's play!</button></div></div>`;
    document.getElementById("go").onclick = () => commit(() => {
      if (!document.getElementById("shuf").checked) state.order = entries.map(e => e.key);
      state.started = true;
    });
  }

  function renderAdvice(e) {
    stage.innerHTML = `<div class="card">
      <div class="label">The advice</div>${advHtml(e)}
      <div class="hint">JJ, who sent this? 🤔</div>
      <div class="row">
        <button class="good" id="ok">✅ Got it!</button>
        <button class="bad" id="no">❌ Wrong / Stumped</button>
      </div></div>`;
    document.getElementById("ok").onclick = () => commit(() => { state.results[e.key] = "first"; state.phase = "reveal"; });
    document.getElementById("no").onclick = () => commit(() => {
      if (e.name) state.phase = "clue"; else { state.results[e.key] = "wrong"; state.phase = "reveal"; }
    });
  }

  function renderClue(e) {
    stage.innerHTML = `<div class="card">
      <div class="label">The advice</div>${advHtml(e)}
      <div class="clue"><div class="label">${esc(e.clueLabel || "Name suggestion clue")}</div><div class="big ${e.clueLabel ? "text" : ""}">${esc(e.name)}</div></div>
      <div class="hint">Take another guess, JJ! 🕵️</div>
      <div class="row">
        <button class="good" id="ok">✅ Got it!</button>
        <button class="bad" id="no">❌ Still wrong</button>
      </div></div>`;
    document.getElementById("ok").onclick = () => commit(() => { state.results[e.key] = "clue"; state.phase = "reveal"; });
    document.getElementById("no").onclick = () => commit(() => { state.results[e.key] = "wrong"; state.phase = "reveal"; });
  }

  function renderReveal(e) {
    const r = state.results[e.key];
    const v = { first: ["🎉 Nailed it with no clue!", "good"], clue: ["👍 Got it after the name clue!", "mid"], wrong: ["😅 Missed this one!", "bad"] }[r];
    const last = state.pos + 1 >= state.order.length;
    stage.innerHTML = `<div class="card">
      <div class="verdict ${v[1]}">${v[0]}</div>
      <div class="label">It was from</div><div class="who">${esc(e.from)}</div>
      ${advHtml(e)}
      <div class="clue"><div class="label">${esc(e.clueLabel || "Name suggestion")}</div><div class="big ${e.clueLabel ? "text" : ""}">${e.name ? esc(e.name) : "(none sent)"}</div></div>
      <div class="row"><button id="next">${last ? "See final score 🏆" : "Next →"}</button></div></div>`;
    document.getElementById("next").onclick = () => commit(() => { state.pos++; state.phase = "advice"; });
  }

  function renderSummary(s) {
    const total = state.order.length;
    const rows = state.order.map(k => {
      const e = byKey[k], r = state.results[k];
      return `<tr><td>${esc(e.from)}</td><td>${{ first: "✅ No clue", clue: "🟡 After name", wrong: "❌ Missed" }[r] || "—"}</td></tr>`;
    }).join("");
    stage.innerHTML = `<div class="card summary">
      <div class="who">🏆 Final Score</div>
      <div class="stats">
        <div><div class="big-num" style="color:var(--good)">${s.first}</div>No clue</div>
        <div><div class="big-num" style="color:var(--mid)">${s.clue}</div>After name clue</div>
        <div><div class="big-num" style="color:var(--bad)">${s.wrong}</div>Missed</div>
      </div>
      <p class="hint">${s.first + s.clue} of ${total} identified!</p>
      <table>${rows}</table>
      <div class="pending">Got new entries? Add them in <b>entries.js</b>, refresh, and the new ones will show up at the end.</div>
      <div class="row" style="margin-top:18px"><button id="again">Play again</button></div></div>`;
    document.getElementById("again").onclick = () => { state = fresh(); history = []; save(); render(); };
  }

  document.getElementById("undoBtn").onclick = () => { if (history.length) { state = JSON.parse(history.pop()); save(); render(); } };
  document.getElementById("resetBtn").onclick = () => { if (confirm("Reset the whole game and scores?")) { state = fresh(); history = []; save(); render(); } };

  render();
})();
