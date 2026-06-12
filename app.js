// Ideal points of Polish Sejm MPs — interactive 1D visualization (D3 v7).
// Loads ideal_points.json (precomputed MCMC results) and renders a beeswarm.

const CLUB_COLORS = {
  "PiS": "#003087", "KO": "#F5821F", "PSL-TD": "#00A550",
  "Polska2050": "#FACC15", "Polska2050-TD": "#FACC15", "Lewica": "#E31E24",
  "Razem": "#951B81", "Konfederacja": "#1A1A1A", "Konfederacja_KP": "#4A4A4A",
  "Centrum": "#1DACD6", "Demokracja": "#00BFA5", "niez.": "#AAAAAA",
  // IX kadencja (2019–2023)
  "KP": "#00A550", "Kukiz15": "#16A085", "LD": "#C0398B", "PS": "#5D6D7E",
  // VIII kadencja (2015–2019)
  "PO": "#F5821F", "PO-KO": "#F5821F", "PSL-KP": "#00A550", "PSL-UED": "#4CAF50",
  "UPR": "#5D3A9B", "PP": "#A0522D", "TERAZ!": "#00ACC1", "WiS": "#9C27B0",
  // V–VII kadencja (2005–2015)
  "PSL": "#00A550", "SLD": "#E31E24", "ZP": "#2C5AA0", "RP": "#C2185B",
  "TR": "#AD1457", "BC": "#795548", "KPSP": "#8D6E63",
  "Samoobrona": "#C9A227", "LPR": "#922B21", "RLN": "#117864",
  "Prawica": "#7E5109", "SDPL": "#CB4335", "PJN": "#2471A3", "Polska_Plus": "#5499C7",
};
const color = (c) => CLUB_COLORS[c] || "#888";
const R = 4;                                  // dot radius
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

let DATA = null;
let activeClub = null;                         // club isolation filter
let showCI = false;
let selected = null;                           // MP shown in the profile panel
let XEXT = null;                               // global ideal-point extent
let CLUB_MEAN = {};                            // club -> mean position
let VOTES = null;                              // lazy-loaded votes.json (metadata)
let MPVOTES = null;                            // lazy-loaded mp_votes.json (per-MP codes)
let MODELPARAMS = null;                         // lazy-loaded model_params.json (beta/alpha)

// Each term has its own precomputed JSON set. term10 keeps the bare filenames
// (ideal_points.json …); other terms add a suffix (…_term9.json). `apiTerm` feeds
// the official PDF link.
const TERMS = {
  "10": { label: "X kadencja", years: "od 2023",   suffix: "",       apiTerm: "term10" },
  "9":  { label: "IX kadencja", years: "2019–2023", suffix: "_term9", apiTerm: "term9" },
  "8":  { label: "VIII kadencja", years: "2015–2019", suffix: "_term8", apiTerm: "term8" },
  "7":  { label: "VII kadencja", years: "2011–2015", suffix: "_term7", apiTerm: "term7" },
  "6":  { label: "VI kadencja", years: "2007–2011", suffix: "_term6", apiTerm: "term6" },
  "5":  { label: "V kadencja", years: "2005–2007", suffix: "_term5", apiTerm: "term5" },
};
let CURRENT_TERM = "10";
const sfx = () => TERMS[CURRENT_TERM].suffix;

const tooltip = document.getElementById("tooltip");

// Load (or switch to) a term: reset state, fetch its ideal_points, re-render.
function loadTerm(key) {
  if (!TERMS[key]) return;
  CURRENT_TERM = key;

  // reset all per-term state (clubs, lazy history data, selection differ by term)
  DATA = null; activeClub = null; selected = null;
  VOTES = MPVOTES = MODELPARAMS = null; CLUB_MEAN = {};
  closeHistory(); closeProfile();
  const s = document.getElementById("search"); if (s) s.value = "";
  updateTermButtons();
  document.getElementById("subtitle").textContent = `${TERMS[key].label} · ładowanie…`;

  fetch(`ideal_points${TERMS[key].suffix}.json`)
    .then((r) => r.json())
    .then((data) => {
      if (CURRENT_TERM !== key) return;          // a newer switch superseded this load
      DATA = data;
      XEXT = d3.extent(data.mps, (d) => d.x);
      data.clubs.forEach((c) => { CLUB_MEAN[c.club] = c.mean; });
      document.getElementById("subtitle").textContent =
        `${data.meta.term} · ${data.meta.n_mps} posłów · ${data.meta.n_votes} spornych głosowań`;
      buildLegend(data);
      render();
      renderClubs(data);
    })
    .catch((e) => {
      document.getElementById("subtitle").textContent = "Błąd ładowania danych.";
      console.error(e);
    });
}

// ---------- legend ----------
function buildLegend(data) {
  const legend = document.getElementById("legend");
  const clubs = data.clubs.map((c) => c.club);
  legend.innerHTML = "";
  clubs.forEach((club) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.dataset.club = club;
    chip.innerHTML = `<span class="dot" style="background:${color(club)}"></span>${club}`;
    chip.onclick = () => {
      activeClub = activeClub === club ? null : club;
      updateChips();
      applyFilter();
    };
    legend.appendChild(chip);
  });
}
function updateChips() {
  document.querySelectorAll(".chip").forEach((c) => {
    c.classList.toggle("dim", activeClub !== null && c.dataset.club !== activeClub);
  });
}

// ---------- main beeswarm ----------
function render() {
  const svg = d3.select("#chart");
  svg.selectAll("*").remove();
  const width = document.querySelector(".chart-wrap").clientWidth - 28;
  const height = 440;
  const margin = { top: 28, right: 24, bottom: 40, left: 24 };
  svg.attr("viewBox", `0 0 ${width} ${height}`).attr("height", height);

  const ext = d3.extent(DATA.mps, (d) => d.x);
  const pad = (ext[1] - ext[0]) * 0.05;
  const x = d3.scaleLinear().domain([ext[0] - pad, ext[1] + pad])
    .range([margin.left, width - margin.right]);

  // axis + zero line + label
  svg.append("g").attr("class", "axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(7));
  svg.append("line").attr("class", "zero-line")
    .attr("x1", x(0)).attr("x2", x(0))
    .attr("y1", margin.top).attr("y2", height - margin.bottom);
  svg.append("text").attr("class", "axis-label").attr("x", width / 2)
    .attr("y", height - 8).attr("text-anchor", "middle").text("główna oś podziału (z głosowań imiennych)");

  // beeswarm layout. Nodes carry the MP data in .mp; the force simulation freely
  // mutates .x/.y as PIXEL coordinates (so we must NOT read d.x as the ideal point).
  const nodes = DATA.mps.map((d) => ({ mp: d }));
  const sim = d3.forceSimulation(nodes)
    .force("x", d3.forceX((n) => x(n.mp.x)).strength(1))
    .force("y", d3.forceY((height - margin.top - margin.bottom) / 2 + margin.top).strength(0.05))
    .force("collide", d3.forceCollide(R + 0.6))
    .stop();
  for (let i = 0; i < 220; i++) sim.tick();
  const yMin = margin.top + R, yMax = height - margin.bottom - R;
  nodes.forEach((n) => { n.y = Math.max(yMin, Math.min(yMax, n.y)); });

  // CI lines (optional)
  svg.append("g").attr("id", "ci-group").attr("display", showCI ? null : "none")
    .selectAll("line").data(nodes).join("line")
    .attr("class", "ci-line").attr("stroke", (n) => color(n.mp.club))
    .attr("x1", (n) => x(n.mp.lo)).attr("x2", (n) => x(n.mp.hi))
    .attr("y1", (n) => n.y).attr("y2", (n) => n.y);

  // dots
  svg.append("g").selectAll("circle").data(nodes).join("circle")
    .attr("class", "dot-mp").attr("r", R)
    .attr("cx", (n) => n.x).attr("cy", (n) => n.y)
    .attr("fill", (n) => color(n.mp.club))
    .classed("selected", (n) => selected && n.mp.id === selected.id)
    .on("mousemove", (e, n) => showTip(e, n.mp)).on("mouseleave", hideTip)
    .on("click", (e, n) => openProfile(n.mp));

  applyFilter();
}

function showTip(event, mp) {
  tooltip.hidden = false;
  tooltip.innerHTML =
    `<b>${mp.name}</b><br><span class="club">${mp.club}</span>` +
    `<div class="pos">pozycja: ${mp.x.toFixed(2)} &nbsp;(90% CI: ${mp.lo.toFixed(2)}…${mp.hi.toFixed(2)})</div>`;
  const wrap = document.querySelector(".chart-wrap").getBoundingClientRect();
  let left = event.clientX - wrap.left + 12;
  if (left > wrap.width - 250) left = event.clientX - wrap.left - 250;
  tooltip.style.left = left + "px";
  tooltip.style.top = (event.clientY - wrap.top + 12) + "px";
}
function hideTip() { tooltip.hidden = true; }

// ---------- filtering / search ----------
function applyFilter() {
  const q = norm(document.getElementById("search").value.trim());
  d3.selectAll(".dot-mp")
    .classed("dimmed", (n) => {
      if (activeClub && n.mp.club !== activeClub) return true;
      if (q && !norm(n.mp.name).includes(q)) return true;
      return false;
    })
    .classed("hit", (n) => q && norm(n.mp.name).includes(q));
}

document.getElementById("search").addEventListener("input", applyFilter);
document.getElementById("ci-toggle").addEventListener("change", (e) => {
  showCI = e.target.checked;
  const g = document.getElementById("ci-group");
  if (g) g.setAttribute("display", showCI ? "inline" : "none");
});
// ---------- club averages panel ----------
function renderClubs(data) {
  const svg = d3.select("#clubs");
  svg.selectAll("*").remove();
  const width = document.querySelector(".chart-wrap").clientWidth - 28;
  const rowH = 26, margin = { top: 10, right: 24, bottom: 30, left: 110 };
  const height = margin.top + margin.bottom + data.clubs.length * rowH;
  svg.attr("viewBox", `0 0 ${width} ${height}`).attr("height", height);

  const ext = d3.extent(data.clubs, (d) => d.mean);
  const x = d3.scaleLinear().domain([ext[0] - 0.2, ext[1] + 0.2])
    .range([margin.left, width - margin.right]);

  svg.append("line").attr("class", "zero-line")
    .attr("x1", x(0)).attr("x2", x(0)).attr("y1", margin.top).attr("y2", height - margin.bottom);
  svg.append("g").attr("class", "axis")
    .attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(7));

  const rows = svg.selectAll("g.row").data(data.clubs).join("g")
    .attr("transform", (d, i) => `translate(0,${margin.top + i * rowH + rowH / 2})`);
  rows.append("text").attr("x", margin.left - 10).attr("dy", "0.32em")
    .attr("text-anchor", "end").style("font-size", "12px").style("fill", "#333")
    .text((d) => `${d.club} (${d.n})`);
  rows.append("line").attr("x1", x(0)).attr("x2", (d) => x(d.mean))
    .attr("stroke", (d) => color(d.club)).attr("stroke-width", 2).attr("stroke-opacity", .4);
  rows.append("circle").attr("cx", (d) => x(d.mean)).attr("r", 6)
    .attr("fill", (d) => color(d.club));
}

// ---------- MP profile panel ----------
const fmtPct = (v) => (v == null ? "—" : Math.round(v * 100) + "%");

function openProfile(mp) {
  selected = mp;
  d3.selectAll(".dot-mp").classed("selected", (n) => n.mp.id === mp.id);

  const neighbors = DATA.mps
    .filter((d) => d.id !== mp.id)
    .map((d) => ({ ...d, dist: Math.abs(d.x - mp.x) }))
    .sort((a, b) => a.dist - b.dist).slice(0, 3);

  const rhatOk = mp.rhat < 1.05;
  const el = document.getElementById("profile");
  el.innerHTML = `
    <button class="close" aria-label="Zamknij">×</button>
    <h2>${mp.name}</h2>
    <div class="club-chip"><span class="dot" style="background:${color(mp.club)}"></span>${mp.club}</div>
    <div class="big-pos">${mp.x.toFixed(2)}
      <span class="ci">90% CI: ${mp.lo.toFixed(2)} … ${mp.hi.toFixed(2)}</span></div>
    <svg id="mini-axis" role="img" aria-label="Pozycja na osi"></svg>
    <dl class="stats">
      <dt>Pozycja na osi podziału</dt><dd>#${mp.rank} / ${DATA.meta.n_mps}</dd>
      <dt>W klubie</dt><dd>#${mp.club_rank} / ${mp.club_size}</dd>
      <dt>Frekwencja</dt><dd>${fmtPct(mp.turnout)} <span class="muted">(${mp.votes}/${DATA.meta.n_votes})</span></dd>
      <dt>Lojalność klubowa</dt><dd>${fmtPct(mp.loyalty)}</dd>
      <dt>Zbieżność (R̂)</dt><dd>${mp.rhat.toFixed(3)} <span class="${rhatOk ? "ok" : "warn"}">${rhatOk ? "✓" : "⚠"}</span></dd>
    </dl>
    <button class="hist-btn" id="hist-open">📜 Historia głosowań →</button>
    <h3>Najbliżsi na osi</h3>
    <ul class="neighbors">
      ${neighbors.map((d) => `<li data-id="${d.id}"><span class="dot" style="background:${color(d.club)}"></span><span class="nm">${d.name}</span><span class="nx">${d.x.toFixed(2)}</span></li>`).join("")}
    </ul>`;

  el.querySelector(".close").onclick = closeProfile;
  el.querySelector("#hist-open").onclick = () => openHistory(mp);
  el.querySelectorAll(".neighbors li").forEach((li) => {
    li.onclick = () => {
      const m = DATA.mps.find((d) => d.id === +li.dataset.id);
      if (m) openProfile(m);
    };
  });

  el.hidden = false; el.classList.add("open");
  document.getElementById("backdrop").hidden = false;
  renderMiniAxis(mp);
}

function closeProfile() {
  selected = null;
  d3.selectAll(".dot-mp").classed("selected", false);
  const el = document.getElementById("profile");
  el.classList.remove("open"); el.hidden = true;
  document.getElementById("backdrop").hidden = true;
}

function renderMiniAxis(mp) {
  // Histogram of the whole chamber on the main axis (stacked by club),
  // with the selected MP's position + 90% CI marked. x = position, y = # MPs.
  const svg = d3.select("#mini-axis");
  svg.selectAll("*").remove();
  const width = document.getElementById("profile").clientWidth - 40;
  const height = 140;
  const m = { top: 8, right: 8, bottom: 20, left: 26 };
  svg.attr("viewBox", `0 0 ${width} ${height}`).attr("height", height);

  const x = d3.scaleLinear().domain([XEXT[0] - 0.1, XEXT[1] + 0.1]).range([m.left, width - m.right]);
  const bins = d3.bin().domain(x.domain()).thresholds(22).value((d) => d.x)(DATA.mps);
  const maxCount = d3.max(bins, (b) => b.length) || 1;
  const y = d3.scaleLinear().domain([0, maxCount]).range([height - m.bottom, m.top]);
  const clubOrder = DATA.clubs.map((c) => c.club);   // sorted by mean -> stable stacking

  // y-axis (count) with faint gridlines
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.left},0)`)
    .call(d3.axisLeft(y).ticks(3).tickSize(-(width - m.left - m.right)))
    .call((g) => g.selectAll(".tick line").attr("stroke", "#eee"))
    .call((g) => g.select(".domain").remove());

  // stacked histogram bars
  bins.forEach((bin) => {
    const x0 = x(bin.x0), x1 = x(bin.x1), w = Math.max(1, x1 - x0 - 1);
    const byClub = {};
    bin.forEach((d) => { byClub[d.club] = (byClub[d.club] || 0) + 1; });
    let acc = 0;
    clubOrder.forEach((club) => {
      const c = byClub[club]; if (!c) return;
      svg.append("rect").attr("x", x0 + 0.5).attr("width", w)
        .attr("y", y(acc + c)).attr("height", y(acc) - y(acc + c))
        .attr("fill", color(club)).attr("opacity", 0.85);
      acc += c;
    });
  });

  // zero line
  svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", m.top).attr("y2", height - m.bottom)
    .attr("stroke", "#bbb").attr("stroke-dasharray", "3 2");

  // selected MP: CI band + vertical line + dot on top
  svg.append("rect").attr("x", x(mp.lo)).attr("width", Math.max(1, x(mp.hi) - x(mp.lo)))
    .attr("y", m.top).attr("height", height - m.bottom - m.top)
    .attr("fill", color(mp.club)).attr("opacity", 0.13);
  svg.append("line").attr("x1", x(mp.x)).attr("x2", x(mp.x)).attr("y1", m.top).attr("y2", height - m.bottom)
    .attr("stroke", "#000").attr("stroke-width", 1.5);
  svg.append("circle").attr("cx", x(mp.x)).attr("cy", m.top + 4).attr("r", 4)
    .attr("fill", color(mp.club)).attr("stroke", "#000").attr("stroke-width", 1);

  // x labels
  svg.append("text").attr("x", m.left).attr("y", height - 4).attr("class", "axis-label").text("");
  svg.append("text").attr("x", width - m.right).attr("y", height - 4).attr("text-anchor", "end")
    .attr("class", "axis-label").text("");
}

// ---------- voting history modal ----------
const esc = (s) => (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function voteBadge(code) {
  if (code === "Y") return '<span class="badge za">Za</span>';
  if (code === "N") return '<span class="badge pr">Przeciw</span>';
  if (code === "A") return '<span class="badge ab">Wstrzymał</span>';
  return '<span class="badge none" title="nieobecny">—</span>';
}

async function openHistory(mp) {
  const modal = document.getElementById("history");
  modal.hidden = false;
  modal.innerHTML = `<div class="modal-card"><div class="loading">Ładowanie historii…</div></div>`;
  if (!VOTES) {
    try {
      const [v, mv, mpar] = await Promise.all([
        fetch(`votes${sfx()}.json`).then((r) => r.json()),
        fetch(`mp_votes${sfx()}.json`).then((r) => r.json()),
        fetch(`model_params${sfx()}.json`).then((r) => r.json()).catch(() => ({})),
      ]);
      VOTES = v.votes; MPVOTES = mv; MODELPARAMS = mpar;
    } catch (e) {
      modal.innerHTML = `<div class="modal-card"><button class="close">×</button><p>Błąd ładowania historii.</p></div>`;
      modal.querySelector(".close").onclick = closeHistory;
      return;
    }
  }
  renderHistory(mp);
}

function closeHistory() {
  const m = document.getElementById("history");
  m.hidden = true; m.innerHTML = "";
}

function renderHistory(mp) {
  const code = (MPVOTES && MPVOTES[String(mp.id)]) || "";
  const modal = document.getElementById("history");
  modal.innerHTML = `
    <div class="modal-card">
      <button class="close" aria-label="Zamknij">×</button>
      <h2>Historia głosowań — ${esc(mp.name)}
        <span class="club-chip"><span class="dot" style="background:${color(mp.club)}"></span>${mp.club}</span></h2>
      <div class="hist-controls">
        <input id="hist-search" type="search" placeholder="Szukaj w tytule / opisie…" autocomplete="off" />
        <label class="toggle"><input type="checkbox" id="hist-contested" /> tylko sporne</label>
        <span id="hist-count" class="muted"></span>
      </div>
      <div id="hist-list" class="hist-list"></div>
      <div class="hist-more"><button id="hist-more-btn">pokaż więcej</button></div>`;
  modal.querySelector(".close").onclick = closeHistory;
  modal.onclick = (e) => { if (e.target === modal) closeHistory(); };

  const search = modal.querySelector("#hist-search");
  const contested = modal.querySelector("#hist-contested");
  let limit = 120;

  function update() {
    const q = norm(search.value.trim());
    const onlyC = contested.checked;
    const filtered = [];
    for (let i = VOTES.length - 1; i >= 0; i--) {       // newest first
      const v = VOTES[i];
      if (onlyC && !v.c) continue;
      if (q && !(norm(v.t).includes(q) || norm(v.o).includes(q))) continue;
      filtered.push(v);
    }
    modal.querySelector("#hist-count").textContent = `${filtered.length} głosowań`;
    modal.querySelector("#hist-list").innerHTML =
      filtered.slice(0, limit).map((v) => rowHtml(v, code[v.i], mp.club)).join("");
    modal.querySelector(".hist-more").style.display = filtered.length > limit ? "block" : "none";
  }
  search.oninput = () => { limit = 120; update(); };
  contested.onchange = () => { limit = 120; update(); };
  modal.querySelector("#hist-more-btn").onclick = () => { limit += 200; update(); };
  modal.querySelector("#hist-list").addEventListener("click", onBreakdownClick);
  update();
}

// expand/collapse the per-vote breakdown
function onBreakdownClick(e) {
  const btn = e.target.closest(".bd-toggle");
  if (!btn) return;
  const wrap = btn.closest(".hist-item").querySelector(".bd-wrap");
  if (wrap.childElementCount) {
    wrap.innerHTML = ""; btn.textContent = "▾ rozkład głosów";
  } else {
    renderBreakdown(VOTES[+btn.dataset.i], wrap); btn.textContent = "▴ ukryj rozkład";
  }
}

const VOTE_COL = { Y: "#1a9850", N: "#d73027", A: "#e0a800" };
const voteName = (c) => (c === "Y" ? "Za" : c === "N" ? "Przeciw" : c === "A" ? "Wstrzymał się" : "nieobecny");

function ncdf(z) {                                  // standard normal CDF (approx)
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function renderBreakdown(vote, wrap) {
  const vi = vote.i;
  const W = wrap.clientWidth || 760, H = 150;
  const m = { top: 10, right: 12, bottom: 22, left: 12 }, R2 = 3.2;
  const params = MODELPARAMS && MODELPARAMS[`${vote.s}_${vote.v}`];   // [beta, alpha] or undefined
  const voters = DATA.mps.map((mp) => ({ mp, v: (MPVOTES[String(mp.id)] || "")[vi] || "." }));
  const x = d3.scaleLinear().domain([XEXT[0] - 0.1, XEXT[1] + 0.1]).range([m.left, W - m.right]);

  const nodes = voters.map((o) => ({ o }));
  d3.forceSimulation(nodes)
    .force("x", d3.forceX((n) => x(n.o.mp.x)).strength(1))
    .force("y", d3.forceY((H - m.top - m.bottom) / 2 + m.top).strength(0.06))
    .force("collide", d3.forceCollide(R2 + 0.5))
    .stop().tick(180);
  const yMin = m.top + R2, yMax = H - m.bottom - R2;
  nodes.forEach((n) => { n.y = Math.max(yMin, Math.min(yMax, n.y)); });

  const za = voters.filter((o) => o.v === "Y").length;
  const pr = voters.filter((o) => o.v === "N").length;
  const ws = voters.filter((o) => o.v === "A").length;
  const ni = voters.length - za - pr - ws;
  const decided = voters.filter((o) => o.v === "Y" || o.v === "N").map((o) => ({ x: o.mp.x, y: o.v === "Y" ? 1 : 0 }));

  const svg = d3.select(wrap).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("height", H);

  // --- model mode: probability heatmap Phi(beta*x - alpha) + cutting point alpha/beta ---
  let capRight = "";
  if (params) {
    const [beta, alpha] = params;
    const defs = svg.append("defs");
    const gid = "g" + vote.s + "_" + vote.v;
    const lg = defs.append("linearGradient").attr("id", gid).attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", x(x.domain()[0])).attr("x2", x(x.domain()[1])).attr("y1", 0).attr("y2", 0);
    const NS = 24;
    for (let k = 0; k <= NS; k++) {
      const xv = x.domain()[0] + (k / NS) * (x.domain()[1] - x.domain()[0]);
      lg.append("stop").attr("offset", `${100 * k / NS}%`)
        .attr("stop-color", d3.interpolateRgb("#d73027", "#1a9850")(ncdf(beta * xv - alpha)));
    }
    svg.append("rect").attr("x", m.left).attr("y", m.top)
      .attr("width", W - m.left - m.right).attr("height", H - m.top - m.bottom)
      .attr("fill", `url(#${gid})`).attr("opacity", 0.20);
    const xstar = alpha / beta;
    if (xstar > x.domain()[0] && xstar < x.domain()[1])
      svg.append("line").attr("x1", x(xstar)).attr("x2", x(xstar)).attr("y1", m.top - 2).attr("y2", H - m.bottom)
        .attr("stroke", "#333").attr("stroke-dasharray", "4 3").attr("stroke-width", 1.2);
    const hit = decided.length
      ? decided.filter((d) => (beta * d.x - alpha > 0) === (d.y === 1)).length / decided.length : 0;
    capRight = `<span class="coh">model · x*=${xstar.toFixed(2)} · β=${beta.toFixed(1)} · ${Math.round(hit * 100)}% trafień</span>`;
  }

  svg.append("line").attr("x1", m.left).attr("x2", W - m.right)
    .attr("y1", H - m.bottom).attr("y2", H - m.bottom).attr("stroke", "#ddd");
  svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", m.top).attr("y2", H - m.bottom).attr("stroke", "#ccc");

  svg.append("g").selectAll("circle").data(nodes).join("circle")
    .attr("cx", (n) => n.x).attr("cy", (n) => n.y).attr("r", R2)
    .attr("fill", (n) => VOTE_COL[n.o.v] || "#cfcfcf").attr("stroke", "#fff").attr("stroke-width", 0.4)
    .append("title").text((n) => `${n.o.mp.name} (${n.o.mp.club}): ${voteName(n.o.v)}`);

  // hover (model votes only): vertical cursor + modelled P(za) = Phi(beta*x - alpha)
  if (params) {
    const [beta, alpha] = params;
    const midX = (m.left + (W - m.right)) / 2;        // horizontal middle of the plot
    const hoverLine = svg.append("line").attr("y1", m.top).attr("y2", H - m.bottom)
      .attr("stroke", "#111").attr("stroke-width", 1).attr("opacity", 0).attr("pointer-events", "none");
    wrap.style.position = "relative";
    const tip = document.createElement("div");
    tip.className = "bd-tip"; tip.hidden = true; wrap.appendChild(tip);
    svg.on("mousemove", (event) => {
      const [px] = d3.pointer(event, svg.node());
      const cx = Math.max(m.left, Math.min(W - m.right, px));
      const xv = x.invert(cx);
      const prob = ncdf(beta * xv - alpha);
      hoverLine.attr("x1", cx).attr("x2", cx).attr("opacity", 0.55);
      const r = wrap.getBoundingClientRect();
      tip.hidden = false;
      tip.innerHTML = `x = ${xv.toFixed(2)} | Prawdopodobieństwo głosowania za: <b>${prob.toFixed(2)}</b>`;
      tip.style.left = (event.clientX - r.left) + "px";
      tip.style.top = (event.clientY - r.top) + "px";
      // flip the tip across the plot's horizontal middle so it always stays in-bounds
      tip.style.transform = (cx > midX)
        ? "translate(calc(-100% - 8px), -130%)"        // cursor right of middle -> tip on the left
        : "translate(8px, -130%)";                     // cursor left of middle -> tip on the right
    }).on("mouseleave", () => { hoverLine.attr("opacity", 0); tip.hidden = true; });
  }

  svg.append("text").attr("x", m.left).attr("y", H - 6).attr("class", "axis-label").text("");
  svg.append("text").attr("x", W - m.right).attr("y", H - 6).attr("text-anchor", "end")
    .attr("class", "axis-label").text("");

  const cap = document.createElement("div");
  cap.className = "bd-cap";
  cap.innerHTML =
    `<span class="k"><i style="background:#1a9850"></i>za ${za}</span>` +
    `<span class="k"><i style="background:#d73027"></i>przeciw ${pr}</span>` +
    `<span class="k"><i style="background:#e0a800"></i>wstrzym. ${ws}</span>` +
    `<span class="k"><i style="background:#cfcfcf"></i>nieob. ${ni}</span>` + capRight;
  wrap.appendChild(cap);
}

function partyBadge(pctZa) {
  if (pctZa == null) return '<span class="badge none">—</span>';
  const za = pctZa >= 50;
  const dir = za ? "Za" : "Przeciw";
  const cohesion = za ? pctZa : 100 - pctZa;     // party loyalty on this vote
  return `<span class="badge ${za ? "za" : "pr"}">${dir} ${cohesion}%</span>`;
}

function rowHtml(v, mpCode, mpClub) {
  const pdf = `https://api.sejm.gov.pl/sejm/${TERMS[CURRENT_TERM].apiTerm}/votings/${v.s}/${v.v}/pdf`;
  return `<div class="hist-item">
    <div class="hist-row">
      <div class="hr-date">${v.d}</div>
      <div class="hr-votes">
        <span class="hr-lab">poseł</span>${voteBadge(mpCode)}
        <span class="hr-lab">klub</span>${partyBadge(v.m[mpClub])}
      </div>
      <div class="hr-main">
        <div class="hr-title">${esc(v.t)}</div>
        <div class="hr-topic">${esc(v.o)}</div>
        <div class="hr-result">Wynik: <b class="za">${v.y}</b> za · <b class="pr">${v.n}</b> przeciw · ${v.a} wstrzym.
          ${v.c ? "" : '<span class="tag">jednomyślne</span>'}
          · <a href="${pdf}" target="_blank" rel="noopener">PDF ↗</a>
          · <button class="bd-toggle" data-i="${v.i}">▾ rozkład głosów</button></div>
      </div>
    </div>
    <div class="bd-wrap"></div>
  </div>`;
}

// ---------- close handlers (history on top of profile) ----------
document.getElementById("backdrop").addEventListener("click", closeProfile);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!document.getElementById("history").hidden) closeHistory();
  else closeProfile();
});

// ---------- responsive ----------
let rt;
window.addEventListener("resize", () => {
  clearTimeout(rt);
  rt = setTimeout(() => {
    if (DATA) { render(); renderClubs(DATA); if (selected) renderMiniAxis(selected); }
  }, 200);
});

// ---------- term (kadencja) switcher ----------
function updateTermButtons() {
  document.querySelectorAll(".term-btn").forEach((b) => {
    const on = b.dataset.term === CURRENT_TERM;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
}
document.querySelectorAll(".term-btn").forEach((b) => {
  b.addEventListener("click", () => loadTerm(b.dataset.term));
});

loadTerm("10");   // initial load (X kadencja, default)
