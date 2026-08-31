(function () {
  "use strict";

  const STORE_KEY = "rota-planner-state-v1";
  const DAY_START = 7 * 60;        // 07:00
  const DAY_END = 22 * 60 + 30;    // 22:30
  const SPAN = DAY_END - DAY_START;

  let STATE = loadState() || {
    roster: null,          // { employees, dayLabels, weekDates }
    manualEntries: [],      // [{ id, name, day, start, end }]
    positions: [],          // [{ id, label }]
    assignments: {},        // { [day]: { [positionId]: [shiftId, ...] } }
    activeDay: null,
    deptFilter: null,       // department the pool is narrowed to, or null for all
  };

  let armedChipId = null;   // click-to-place selection (not persisted)
  let draggingShiftId = null; // shift currently being dragged, for the drop preview
  // Rows live inside named groups (one per fitting room), so ids are counted across all of them.
  function allPositions() {
    return (STATE.groups || []).reduce((acc, g) => acc.concat(g.positions || []), []);
  }
  let posCounter = allPositions().concat(STATE.positions || [])
    .reduce((m, p) => Math.max(m, idNum(p.id)), 0);
  let groupCounter = (STATE.groups || []).reduce((m, g) => Math.max(m, idNum(g.id)), 0);
  let manualCounter = (STATE.manualEntries || []).reduce((m, e) => Math.max(m, idNum(e.id)), 0);

  function idNum(id) {
    const m = /(\d+)$/.exec(String(id || ""));
    return m ? parseInt(m[1], 10) : 0;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      parsed.manualEntries = parsed.manualEntries || [];
      parsed.positions = parsed.positions || [];
      parsed.assignments = parsed.assignments || {};
      return parsed;
    } catch (e) { return null; }
  }

  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(STATE)); } catch (e) { /* storage full/unavailable */ }
  }

  function parseTime(t) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }
  function fmtTime(mins) {
    mins = ((mins % 1440) + 1440) % 1440;
    const h = Math.floor(mins / 60), m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  // ---- derive the flat list of placeable shift instances from roster + manual entries ----
  function buildShiftInstances() {
    const list = [];
    const dayLabels = getDayLabels();
    if (STATE.roster) {
      for (const emp of STATE.roster.employees) {
        for (const day of dayLabels) {
          const ranges = (emp.shifts && emp.shifts[day]) || [];
          ranges.forEach((range, idx) => {
            const [start, end] = range.split("-");
            list.push({
              id: `r::${emp.persnr}::${day}::${idx}`,
              name: emp.name,
              day, start, end,
              dept: emp.dept,
              manual: false,
            });
          });
        }
      }
    }
    for (const m of STATE.manualEntries) {
      list.push({ id: m.id, name: m.name, day: m.day, start: m.start, end: m.end, manual: true });
    }
    return list;
  }

  function getDayLabels() {
    return (STATE.roster && STATE.roster.dayLabels && STATE.roster.dayLabels.length)
      ? STATE.roster.dayLabels
      : [];
  }

  function assignedIdsForDay(day) {
    const set = new Set();
    const byPos = STATE.assignments[day] || {};
    for (const posId in byPos) for (const id of byPos[posId]) set.add(id);
    return set;
  }

  function assignShift(day, positionId, shiftId) {
    // remove from any position on this day first (single placement)
    unassignShift(day, shiftId);
    if (!STATE.assignments[day]) STATE.assignments[day] = {};
    if (!STATE.assignments[day][positionId]) STATE.assignments[day][positionId] = [];
    STATE.assignments[day][positionId].push(shiftId);
    saveState();
  }

  function unassignShift(day, shiftId) {
    const byPos = STATE.assignments[day];
    if (!byPos) return;
    for (const posId in byPos) {
      const idx = byPos[posId].indexOf(shiftId);
      if (idx !== -1) byPos[posId].splice(idx, 1);
    }
  }

  function pruneStaleAssignments() {
    const validIds = new Set(buildShiftInstances().map((s) => s.id));
    for (const day in STATE.assignments) {
      const byPos = STATE.assignments[day];
      for (const posId in byPos) {
        byPos[posId] = byPos[posId].filter((id) => validIds.has(id));
      }
    }
  }

  // The fitting rooms this rota covers. All names are editable, and groups can be
  // added or removed, so this is only a starting point.
  const DEFAULT_GROUPS = [
    "Fitting Room Lower Ground",
    "Fitting Room 1st Floor",
    "Fitting Room 2nd Floor",
    "Fitting Room 3rd Floor",
    "Fitting Room 5th Floor",
  ];
  // Bumped when a room is added to the list above, with the list as it stood at each
  // version. A save made before the bump is topped up with exactly the rooms added
  // since — the delta, not a name match, because a room the user renamed would fail a
  // name match and be added a second time. Guarded by the version, so a room deleted
  // afterwards stays deleted.
  const ROOMS_SEED_VERSION = 2;
  const ROOMS_SEEDED_AT = {
    1: ["Fitting Room Lower Ground", "Fitting Room 1st Floor",
        "Fitting Room 2nd Floor", "Fitting Room 5th Floor"],
    2: DEFAULT_GROUPS,
  };

  function newGroup(label, positionCount) {
    groupCounter++;
    const positions = [];
    for (let i = 1; i <= positionCount; i++) {
      posCounter++;
      positions.push({ id: `pos-${posCounter}`, label: `Position ${i}` });
    }
    return { id: `grp-${groupCounter}`, label, positions };
  }

  function ensureDefaultPositions() {
    let changed = false;
    if (!STATE.groups) { STATE.groups = []; changed = true; }
    // Saves written before grouping existed keep their rows and their assignments:
    // the position ids are unchanged, so nothing placed is lost.
    if (STATE.positions && STATE.positions.length) {
      groupCounter++;
      STATE.groups.push({ id: `grp-${groupCounter}`, label: "Fitting Room", positions: STATE.positions });
      delete STATE.positions;
      changed = true;
    }
    if (STATE.groups.length === 0) {
      STATE.groups = DEFAULT_GROUPS.map((label) => newGroup(label, 4));
      changed = true;
    } else if ((STATE.roomsSeedVersion || 1) < ROOMS_SEED_VERSION) {
      const alreadySeeded = ROOMS_SEEDED_AT[STATE.roomsSeedVersion || 1] || [];
      DEFAULT_GROUPS.forEach((label, i) => {
        if (alreadySeeded.includes(label)) return;
        STATE.groups.splice(Math.min(i, STATE.groups.length), 0, newGroup(label, 4));
        changed = true;
      });
    }
    if (STATE.roomsSeedVersion !== ROOMS_SEED_VERSION) {
      STATE.roomsSeedVersion = ROOMS_SEED_VERSION;
      changed = true;
    }
    // Persist the migration/seed right away, so the stored shape matches what is on
    // screen even if the user changes nothing this session.
    if (changed) saveState();
  }

  // ------------------------------- rendering -------------------------------

  const rosterStatusEl = document.getElementById("rosterStatus");
  const appEl = document.getElementById("app");
  const parseWarningEl = document.getElementById("parseWarning");
  const btnManual = document.getElementById("btnManual");
  const btnPrint = document.getElementById("btnPrint");
  const fileInput = document.getElementById("fileInput");
  const manualForm = document.getElementById("manualForm");
  const mDay = document.getElementById("mDay");
  const mName = document.getElementById("mName");
  const mStart = document.getElementById("mStart");
  const mEnd = document.getElementById("mEnd");

  function renderRosterStatus() {
    if (!STATE.roster) {
      rosterStatusEl.innerHTML = `<span>No roster loaded yet.</span>`;
      return;
    }
    const r = STATE.roster;
    const dates = r.dayLabels.map((d) => r.weekDates[d]).filter(Boolean);
    const range = dates.length ? `${dates[0]} – ${dates[dates.length - 1]}` : "";
    rosterStatusEl.innerHTML =
      `<span><b>${r.employees.length}</b> staff loaded${range ? " &middot; " + range : ""}</span>`;
  }

  function renderManualDayOptions() {
    const dayLabels = getDayLabels();
    mDay.innerHTML = dayLabels.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
    btnManual.disabled = dayLabels.length === 0;
    btnManual.title = dayLabels.length === 0 ? "Upload a roster PDF first" : "";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function render() {
    renderRosterStatus();
    renderManualDayOptions();

    const dayLabels = getDayLabels();
    if (dayLabels.length === 0) {
      appEl.innerHTML = `
        <div class="empty-state">
          <h2>Upload your roster PDF to get started</h2>
          <p>Every name and hour from the PDF will show up here as a selectable block, split by day.<br>
             You then drag each person onto a position row to build the day's rota.</p>
          <button class="primary" data-upload>Upload PDF</button>
        </div>`;
      return;
    }

    if (!STATE.activeDay || !dayLabels.includes(STATE.activeDay)) STATE.activeDay = dayLabels[0];
    ensureDefaultPositions();

    const day = STATE.activeDay;
    const allShifts = buildShiftInstances();
    const assigned = assignedIdsForDay(day);
    const dayShifts = allShifts.filter((s) => s.day === day);
    const pool = dayShifts.filter((s) => !assigned.has(s.id));

    appEl.innerHTML = "";
    const title = document.createElement("div");
    title.className = "print-only print-title";
    const dDate = STATE.roster.weekDates[day];
    title.innerHTML = `Fitting Room Rota &mdash; <b>${escapeHtml(day)}</b>${dDate ? " " + escapeHtml(dDate) : ""}
      <span class="pt-right">07:00 &ndash; 22:30</span>`;
    appEl.appendChild(title);
    appEl.appendChild(renderDayTabs(dayLabels, allShifts));
    appEl.appendChild(renderPool(pool, day, dayShifts));
    appEl.appendChild(renderGrid(day, dayShifts));

    wireDayTabEvents();
    wirePoolEvents(day);
    wireGridEvents(day, dayShifts);
  }

  function renderDayTabs(dayLabels, allShifts) {
    const wrap = document.createElement("div");
    wrap.className = "daytabs";
    wrap.innerHTML = dayLabels.map((d) => {
      const date = STATE.roster.weekDates[d];
      const shortDate = date ? date.slice(0, 5) : "";
      const count = allShifts.filter((s) => s.day === d).length;
      const active = d === STATE.activeDay ? " active" : "";
      return `<div class="daytab${active}" data-day="${escapeHtml(d)}">${escapeHtml(d)}<span class="count">${count}</span>${shortDate ? `<span class="n">${shortDate}</span>` : ""}</div>`;
    }).join("");
    return wrap;
  }

  let poolFilterText = "";

  // The export prints each department as NAME(costcentre) into a fixed-width column and
  // CLIPS anything past it — 10 of the 33 in the sample file come out of the PDF already
  // cut, e.g. "FITTING ROOMS 1ST FLOOR(33". The characters are not in the file, so nothing
  // can recover them; what we can do is not show the mess. The cost centre is noise for a
  // filter, so it goes; a name that is itself cut keeps an ellipsis so it reads as
  // truncated rather than as a typo of ours.
  const COSTCENTRE_TAIL = /\s*\([A-Za-z0-9]{0,8}\)?$/;   // "(201)", "(T3f)", or a cut-off "(33"
  function prettyDept(raw) {
    const dept = String(raw || "").trim();
    if (!dept) return "";
    const tail = COSTCENTRE_TAIL.exec(dept);
    // A clipped name has no closing bracket. If what was cut is only the cost centre we
    // still have the whole name; if there is no bracket at all, the name itself lost letters.
    const nameClipped = !dept.endsWith(")") && !tail;
    const base = tail ? dept.slice(0, tail.index) : dept;
    return titleCase(base) + (nameClipped ? "\u2026" : "");
  }
  function titleCase(text) {
    return text.toLowerCase().replace(/[^\s-]+/g, (word, at) => {
      // An ampersand or a dot marks a real acronym (P&C), and those keep their capitals.
      // Length alone does not: it kept MENS, AND and the clipped FLOO shouting.
      const original = text.substr(at, word.length);
      if (/[&.]/.test(original)) return original;
      // Capitalise the first LETTER, not the first character — "(health" starts with a
      // bracket, and upper-casing that left the word lower-case.
      return word.replace(/[a-z]/, (c) => c.toUpperCase());
    }).replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, (m, n, suf) => n + suf.toLowerCase());
  }

  // Every department rostered on the day being built, with how many of its people are
  // still unplaced. Built from everyone rostered rather than only the unplaced, so a
  // department doesn't vanish out of the list the moment you place its last person —
  // and the chosen one is kept even on a day it has nobody, so the control never
  // silently forgets what you picked. Alphabetical: this is a list you look a known
  // name up in, and an order that shifts as you work is worse than a ranked one.
  function deptsForDay(dayShifts, pool) {
    const rostered = new Map();
    for (const s of dayShifts) {
      const key = s.dept || "";
      rostered.set(key, (rostered.get(key) || 0) + 1);
    }
    const unplaced = new Map();
    for (const s of pool) {
      const key = s.dept || "";
      unplaced.set(key, (unplaced.get(key) || 0) + 1);
    }
    if (STATE.deptFilter != null && !rostered.has(STATE.deptFilter)) rostered.set(STATE.deptFilter, 0);
    return [...rostered.keys()]
      .map((dept) => ({ dept, left: unplaced.get(dept) || 0, label: prettyDept(dept) || "No department" }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  function renderPool(pool, day, dayShifts) {
    const section = document.createElement("section");
    section.className = "pool";
    const depts = deptsForDay(dayShifts, pool);
    // A department chosen from last week's roster may not be in this week's export at
    // all. Falling back to everyone beats showing an empty pool with no explanation.
    const chosen = depts.some((d) => d.dept === STATE.deptFilter) ? STATE.deptFilter : null;
    const rosteredHere = chosen === null ? 0 : dayShifts.filter((s) => (s.dept || "") === chosen).length;
    const byDept = chosen === null ? pool : pool.filter((s) => (s.dept || "") === chosen);
    const filtered = poolFilterText
      ? byDept.filter((s) => s.name.toLowerCase().includes(poolFilterText.toLowerCase()))
      : byDept;
    const narrowed = poolFilterText || chosen !== null;
    const countLabel = narrowed ? `${filtered.length} of ${pool.length}` : `${pool.length}`;
    section.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <h3 style="margin:0">Available for ${escapeHtml(day)} (${countLabel})</h3>
        <span style="font-size:11.5px;color:var(--text-dim);font-weight:500">
          🔒 Hours are fixed by the roster — drop anywhere on a row, the person keeps their own times
        </span>
        ${depts.length > 1 ? `<select id="deptFilter" title="Show only one department">
            <option value="">All departments (${pool.length})</option>
            ${depts.map((d) => `<option value="${escapeHtml(d.dept)}"${d.dept === chosen ? " selected" : ""}
              >${escapeHtml(d.label)} (${d.left})</option>`).join("")}
          </select>` : ""}
        ${pool.length > 8 ? `<input type="search" id="poolFilter" placeholder="Filter by name…" value="${escapeHtml(poolFilterText)}"
            style="font:inherit;font-size:12.5px;padding:5px 9px;border:1px solid var(--border-strong);border-radius:6px;width:180px">` : ""}
      </div>
      <div class="chips" id="poolChips" style="margin-top:10px">
        ${pool.length === 0
          ? `<span class="pool-empty">Everyone scheduled this day has been placed.</span>`
          : filtered.length === 0
          ? `<span class="pool-empty">${poolFilterText
              ? `No one matches &quot;${escapeHtml(poolFilterText)}&quot;${chosen !== null ? " in this department" : ""}.`
              : rosteredHere === 0
              ? `Nobody from this department works ${escapeHtml(day)}.`
              : "Everyone in this department has been placed."}</span>`
          : filtered.map(chipHtml).join("")}
      </div>`;
    return section;
  }

  function chipHtml(s) {
    return `<div class="chip" draggable="true" data-id="${escapeHtml(s.id)}" title="${escapeHtml(s.name)} · ${s.start}–${s.end}">
      <span class="n">${escapeHtml(s.name)}</span><span class="t">${s.start}–${s.end}</span>
    </div>`;
  }

  function renderGrid(day, dayShifts) {
    const wrap = document.createElement("div");
    wrap.className = "grid-wrap";

    const ticks = [];
    // Mark every half hour, right through to the 22:30 close, so a 17:30 start is
    // readable off the ruler rather than guessed at between two hour marks.
    for (let m = DAY_START; m <= DAY_END; m += 30) {
      const pct = ((m - DAY_START) / SPAN) * 100;
      const cls = "tick" + (m % 60 === 0 ? " hour" : " half") + (m === DAY_END ? " last" : "");
      const label = `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
      ticks.push(`<div class="${cls}" style="left:${pct}%">${label}</div>`);
    }

    // The half-hour gridlines inside every row. They used to be a repeating-linear-
    // gradient on .track, which prints as nothing at all: the browser rasterises the
    // gradient far too coarsely for 1px stripes, so the printed rows came out blank
    // white with only the ruler and the On duty strip to read a time against. Real
    // elements are vector-drawn, so every line survives onto paper.
    const gridLines = [];
    for (let m = DAY_START + 30; m <= DAY_END; m += 30) {
      const pct = ((m - DAY_START) / SPAN) * 100;
      gridLines.push(`<i class="gl${m % 60 === 0 ? " h" : ""}" style="left:${pct}%"></i>`);
    }
    const gridLinesHtml = gridLines.join("");

    const rowHtml = (pos) => {
      const ids = (STATE.assignments[day] && STATE.assignments[day][pos.id]) || [];
      const items = ids.map((id) => dayShifts.find((s) => s.id === id)).filter(Boolean);
      items.sort((a, b) => parseTime(a.start) - parseTime(b.start));
      const lanes = assignLanes(items);
      const laneCount = Math.max(1, ...items.map((s) => lanes.get(s.id) + 1));
      // Up to eight deep the lanes keep a comfortable height and the row grows. Past
      // that they share a fixed budget instead: ten people stacked on one position at
      // 44px a lane is taller than an A4, and the row ran onto a second sheet that
      // carries neither the room name nor the hour scale.
      const laneHeight = laneCount <= 8 ? 44 : Math.max(34, Math.round(360 / laneCount));
      // min-height, not height: the lanes set the floor, but the row is free to grow
      // taller (print gives each room a whole page and shares the spare height out
      // among its rows). A fixed height there was overridden and the stacked lanes,
      // which are positioned absolutely, spilled into the row below.
      const trackMinHeight = laneCount * laneHeight + 8;
      const blocks = items.map((s) => blockHtml(s, lanes.get(s.id), laneHeight)).join("");
      return `<div class="row" data-pos="${escapeHtml(pos.id)}">
        <div class="label-cell">
          <input type="text" value="${escapeHtml(pos.label)}" data-pos-label="${escapeHtml(pos.id)}">
          <button class="del" data-del-pos="${escapeHtml(pos.id)}" title="Remove row">&times;</button>
        </div>
        <div class="track lanes-${laneCount}${laneHeight < 44 ? " dense" : ""}" data-track="${escapeHtml(pos.id)}" style="min-height:${trackMinHeight}px">${gridLinesHtml}${blocks}</div>
      </div>`;
    };

    const placedIn = (positionIds) => {
      const out = [];
      for (const pid of positionIds) {
        const ids = (STATE.assignments[day] && STATE.assignments[day][pid]) || [];
        for (const id of ids) {
          const s = dayShifts.find((x) => x.id === id);
          if (s) out.push(s);
        }
      }
      return out;
    };

    // Printed pages break between rooms, and only the first page would carry the
    // scale at the top of the grid — leaving later pages as rows of blocks with no
    // way to read a time off them. Each room repeats it, on paper only, directly
    // UNDER its own header: above the header it reads as belonging to the room
    // before it, sandwiched between that room's On duty numbers and this one's name.
    const dDateForHead = (STATE.roster.weekDates && STATE.roster.weekDates[day]) || "";
    const rulerBlock = (cls) =>
      `<div class="ruler ${cls}"><div class="ruler-label"></div>` +
      `<div class="ruler-scale">${ticks.join("")}</div></div>`;

    const rows = STATE.groups.map((g) => `
      <div class="group">
        <div class="group-head">
          <input type="text" value="${escapeHtml(g.label)}" data-group-label="${escapeHtml(g.id)}"
                 title="Rename this fitting room">
          <button class="ghost addpos" data-add-pos="${escapeHtml(g.id)}">+ Position</button>
          <button class="del" data-del-group="${escapeHtml(g.id)}" title="Remove this fitting room">&times;</button>
          <span class="gh-date">${escapeHtml(day)}${dDateForHead ? " " + escapeHtml(dDateForHead) : ""}</span>
        </div>
        ${rulerBlock("print-only ruler-repeat")}
        ${g.positions.map(rowHtml).join("")}
        ${coverageRowHtml("On duty", coverageCounts(placedIn(g.positions.map((p) => p.id))))}
      </div>`).join("");

    const everyPositionId = STATE.groups.reduce((a, g) => a.concat(g.positions.map((p) => p.id)), []);
    const totalRow = coverageRowHtml("Total on duty", coverageCounts(placedIn(everyPositionId)), "total");

    wrap.innerHTML = `
      <div class="grid-scroll">
        <div class="grid-inner">
          ${rulerBlock("ruler-top")}
          <div class="rows">${rows}${totalRow}</div>
          <div class="addrow"><button id="btnAddGroup">+ Add fitting room</button></div>
        </div>
      </div>`;
    return wrap;
  }

  // While dragging, show exactly where the block will land. The drop x is ignored
  // — a person always occupies their rostered hours — so the preview snaps to those
  // hours no matter where the cursor is, which makes the rule visible rather than
  // something the user has to take on trust.
  function clearGhosts() {
    document.querySelectorAll(".drop-preview").forEach((g) => g.remove());
  }

  function showGhost(track, dayShifts) {
    if (!draggingShiftId) return;
    const s = dayShifts.find((x) => x.id === draggingShiftId);
    if (!s) return;
    clearGhosts();
    const startMin = parseTime(s.start);
    let endMin = parseTime(s.end);
    if (endMin <= startMin) endMin = DAY_END;
    const left = clamp((startMin - DAY_START) / SPAN * 100, 0, 100);
    const right = clamp((endMin - DAY_START) / SPAN * 100, 0, 100);
    const g = document.createElement("div");
    g.className = "drop-preview";
    g.style.left = left + "%";
    g.style.width = Math.max(right - left, 1.4) + "%";
    g.textContent = `${s.start}–${s.end}`;
    track.appendChild(g);
  }

  function normEnd(s) {
    const start = parseTime(s.start);
    let end = parseTime(s.end);
    if (end <= start) end += 1440; // shift crosses midnight
    return end;
  }

  // How many people are on at each half hour. A slot counts a placement if the two
  // overlap at all, so somebody on 09:00-14:00 is counted in every slot they cover.
  const SLOT_MINUTES = 30;
  const SLOT_COUNT = SPAN / SLOT_MINUTES; // 31 half hours across 07:00-22:30

  function coverageCounts(items) {
    const counts = new Array(SLOT_COUNT).fill(0);
    for (const s of items) {
      const start = parseTime(s.start);
      let end = parseTime(s.end);
      if (end <= start) end = DAY_END; // overnight shift, clipped to the close
      for (let i = 0; i < SLOT_COUNT; i++) {
        const slotStart = DAY_START + i * SLOT_MINUTES;
        if (start < slotStart + SLOT_MINUTES && end > slotStart) counts[i]++;
      }
    }
    return counts;
  }

  function coverageRowHtml(label, counts, extraClass) {
    const cells = counts.map((c, i) => {
      const onHour = (DAY_START + i * SLOT_MINUTES) % 60 === 0;
      return `<div class="cov-cell${c === 0 ? " zero" : ""}${onHour ? " onhour" : ""}">${c}</div>`;
    }).join("");
    return `<div class="row cov ${extraClass || ""}">
      <div class="label-cell"><span class="cov-label">${escapeHtml(label)}</span></div>
      <div class="cov-scale">${cells}</div>
    </div>`;
  }

  // Two people can legitimately cover the same position at overlapping times — a
  // handover, or extra cover at a busy hour — so an overlap is not an error. Greedy
  // interval scheduling puts them in separate lanes so both stay readable.
  function assignLanes(items) {
    const laneEnds = []; // end time (minutes) currently occupied in each lane
    const lanes = new Map();
    for (const s of items) {
      const start = parseTime(s.start);
      const end = normEnd(s);
      let lane = laneEnds.findIndex((e) => e <= start);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(end); }
      else { laneEnds[lane] = end; }
      lanes.set(s.id, lane);
    }
    return lanes;
  }

  function blockHtml(s, lane, laneHeight) {
    const startMin = parseTime(s.start);
    let endMin = parseTime(s.end);
    if (endMin <= startMin) endMin = DAY_END; // overnight shift: clip to close of window
    const left = clamp((startMin - DAY_START) / SPAN * 100, 0, 100);
    const rightRaw = clamp((endMin - DAY_START) / SPAN * 100, 0, 100);
    const width = Math.max(rightRaw - left, 1.4);
    const top = 4 + (lane || 0) * laneHeight;
    return `<div class="block" draggable="true" data-block-id="${escapeHtml(s.id)}"
        style="left:${left}%;width:${width}%;top:${top}px;height:${laneHeight - 6}px" title="${escapeHtml(s.name)} · ${s.start}–${s.end}">
      <span class="x" data-unassign="${escapeHtml(s.id)}">&times;</span>
      <span class="nm">${escapeHtml(s.name)}</span>
      <span class="tm">${s.start}–${s.end}</span>
    </div>`;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ------------------------------- event wiring -------------------------------

  function wireDayTabEvents() {
    appEl.querySelectorAll(".daytab").forEach((el) => {
      el.addEventListener("click", () => {
        STATE.activeDay = el.dataset.day;
        armedChipId = null;
        saveState();
        render();
      });
    });
  }

  function wirePoolEvents(day) {
    const deptSelect = document.getElementById("deptFilter");
    if (deptSelect) {
      deptSelect.addEventListener("change", () => {
        // Persisted: whoever runs the fitting rooms wants the same department every day,
        // and re-picking it on every reload is exactly the tedium this is meant to remove.
        STATE.deptFilter = deptSelect.value || null;
        saveState();
        render();
      });
    }

    const filterInput = document.getElementById("poolFilter");
    if (filterInput) {
      filterInput.addEventListener("input", () => {
        poolFilterText = filterInput.value;
        render();
        const el = document.getElementById("poolFilter");
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      });
    }
    const chips = appEl.querySelectorAll("#poolChips .chip");
    chips.forEach((chip) => {
      chip.addEventListener("dragstart", (e) => {
        chip.classList.add("dragging");
        draggingShiftId = chip.dataset.id;
        e.dataTransfer.setData("text/plain", chip.dataset.id);
        e.dataTransfer.effectAllowed = "move";
      });
      chip.addEventListener("dragend", () => {
        chip.classList.remove("dragging");
        draggingShiftId = null;
        clearGhosts();
      });
      chip.addEventListener("click", () => {
        if (armedChipId === chip.dataset.id) { armedChipId = null; }
        else { armedChipId = chip.dataset.id; }
        render();
        // re-apply armed highlight after re-render since armedChipId is transient
        if (armedChipId) {
          const el = appEl.querySelector(`#poolChips .chip[data-id="${cssEscape(armedChipId)}"]`);
          if (el) el.classList.add("armed");
        }
      });
    });
  }

  function cssEscape(s) {
    return window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function wireGridEvents(day, dayShifts) {
    appEl.querySelectorAll(".track").forEach((track) => {
      const posId = track.dataset.track;
      track.addEventListener("dragover", (e) => {
        e.preventDefault();
        track.classList.add("dragover");
        showGhost(track, dayShifts);
      });
      track.addEventListener("dragleave", () => { track.classList.remove("dragover"); clearGhosts(); });
      track.addEventListener("drop", (e) => {
        e.preventDefault();
        track.classList.remove("dragover");
        clearGhosts();
        draggingShiftId = null;
        const id = e.dataTransfer.getData("text/plain");
        if (id) { assignShift(day, posId, id); armedChipId = null; render(); }
      });
      track.addEventListener("click", (e) => {
        if (e.target.closest(".block")) return;
        if (armedChipId) { assignShift(day, posId, armedChipId); armedChipId = null; render(); }
      });
    });

    appEl.querySelectorAll(".block").forEach((block) => {
      block.addEventListener("dragstart", (e) => {
        draggingShiftId = block.dataset.blockId;
        e.dataTransfer.setData("text/plain", block.dataset.blockId);
        e.dataTransfer.effectAllowed = "move";
      });
      block.addEventListener("dragend", () => { draggingShiftId = null; clearGhosts(); });
    });

    appEl.querySelectorAll("[data-unassign]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        unassignShift(day, btn.dataset.unassign);
        saveState();
        render();
      });
    });

    appEl.querySelectorAll("[data-pos-label]").forEach((input) => {
      input.addEventListener("change", () => {
        const pos = allPositions().find((p) => p.id === input.dataset.posLabel);
        if (pos) { pos.label = input.value.trim() || pos.label; saveState(); }
      });
      input.addEventListener("click", (e) => e.stopPropagation());
    });

    appEl.querySelectorAll("[data-del-pos]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const posId = btn.dataset.delPos;
        for (const g of STATE.groups) g.positions = g.positions.filter((p) => p.id !== posId);
        for (const d in STATE.assignments) delete STATE.assignments[d][posId];
        saveState();
        render();
      });
    });

    appEl.querySelectorAll("[data-group-label]").forEach((input) => {
      input.addEventListener("change", () => {
        const g = STATE.groups.find((x) => x.id === input.dataset.groupLabel);
        if (g) { g.label = input.value.trim() || g.label; saveState(); }
      });
      input.addEventListener("click", (e) => e.stopPropagation());
    });

    appEl.querySelectorAll("[data-add-pos]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const g = STATE.groups.find((x) => x.id === btn.dataset.addPos);
        if (!g) return;
        posCounter++;
        g.positions.push({ id: `pos-${posCounter}`, label: `Position ${g.positions.length + 1}` });
        saveState();
        render();
      });
    });

    appEl.querySelectorAll("[data-del-group]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const g = STATE.groups.find((x) => x.id === btn.dataset.delGroup);
        if (!g) return;
        // Drop the assignments belonging to this room's rows, so nothing is orphaned.
        for (const pos of g.positions) {
          for (const d in STATE.assignments) delete STATE.assignments[d][pos.id];
        }
        STATE.groups = STATE.groups.filter((x) => x.id !== g.id);
        saveState();
        render();
      });
    });

    const addGroupBtn = document.getElementById("btnAddGroup");
    if (addGroupBtn) addGroupBtn.addEventListener("click", () => {
      STATE.groups.push(newGroup(`Fitting Room ${STATE.groups.length + 1}`, 4));
      saveState();
      render();
    });
  }

  // ------------------------------- import check -------------------------------
  // The PDF states each person's weekly hours in its Totaal column. That number is
  // independent of the shift times, so reconciling the two catches a shift (or a
  // whole person) that failed to parse. Breaks are deducted from the stated total,
  // never more than an hour per shift, so the stated figure must land in
  // [sum of shift lengths - 1h per shift, sum of shift lengths].

  function parseHM(s) {
    const m = /^(\d{1,3}):(\d{2})$/.exec(s || "");
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
  }
  function rangeLength(range) {
    const [a, b] = String(range).split("-");
    const s = parseHM(a);
    let e = parseHM(b);
    if (s == null || e == null) return 0;
    if (e <= s) e += 1440; // crosses midnight
    return e - s;
  }
  function fmtHours(mins) {
    const h = Math.floor(mins / 60), m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  function verifyImport(roster) {
    const issues = [];
    const perDay = {};
    let totalShifts = 0;
    for (const d of roster.dayLabels) perDay[d] = 0;

    for (const emp of roster.employees) {
      const shifts = [];
      for (const d of roster.dayLabels) {
        const r = (emp.shifts && emp.shifts[d]) || [];
        perDay[d] += r.length;
        for (const one of r) shifts.push(one);
      }
      totalShifts += shifts.length;

      if (!emp.name || emp.name.replace(/[^A-Za-zÀ-ÿ]/g, "").length < 2) {
        issues.push({ emp, reason: "the name came out blank or unreadable" });
        continue;
      }
      const stated = parseHM(emp.totaal);
      if (stated == null) {
        issues.push({ emp, reason: "no weekly total in the PDF to check against" });
        continue;
      }
      const raw = shifts.reduce((a, r) => a + rangeLength(r), 0);
      if (shifts.length === 0) {
        if (stated > 0) {
          issues.push({ emp, reason: `roster says ${emp.totaal} this week, but no shifts were read` });
        }
        continue;
      }
      const lo = raw - 60 * shifts.length;
      if (stated < lo || stated > raw) {
        issues.push({
          emp,
          reason: `hours don't add up — read ${fmtHours(raw)} across ${shifts.length} shift(s), ` +
                  `roster total says ${emp.totaal}`,
        });
      }
    }
    return { issues, totalShifts, people: roster.employees.length, perDay };
  }

  function renderCheckReport() {
    if (!STATE.roster) return;
    const r = verifyImport(STATE.roster);
    const ok = r.issues.length === 0;
    const dayRows = STATE.roster.dayLabels
      .map((d) => `<span style="display:inline-block;margin:0 14px 4px 0">${escapeHtml(d)}: <b>${r.perDay[d]}</b></span>`)
      .join("");
    parseWarningEl.innerHTML = `
      <div class="${ok ? "ok-banner" : "warning-banner"}" style="display:block">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <b>${ok ? "✅ Import looks complete" : `⚠️ ${r.issues.length} ${r.issues.length === 1 ? "person needs" : "people need"} checking`}</b>
          <span>· ${r.people} people · ${r.totalShifts} shifts read</span>
          <span class="spacer" style="flex:1"></span>
          <button class="ghost" id="btnCloseCheck" style="padding:2px 8px">Close</button>
        </div>
        <div style="margin-top:8px;font-size:12.5px;opacity:.85">${dayRows}</div>
        ${ok
          ? `<div style="margin-top:8px;font-size:12.5px">Every person's shifts add up to the weekly total printed
             in the PDF, so nobody was missed or misread.</div>`
          : `<div style="margin-top:10px;font-size:12.5px">
               These didn't match the weekly totals in the PDF — check them against the paper copy
               and add anyone missing with <b>+ Add person</b>:
             </div>
             <ul style="margin:8px 0 0;padding-left:20px;font-size:12.5px;line-height:1.6;max-height:220px;overflow:auto">
               ${r.issues.map((i) => `<li><b>${escapeHtml(i.emp.name || "(no name)")}</b>
                  <span style="opacity:.7">${escapeHtml(i.emp.persnr || "")}</span> — ${escapeHtml(i.reason)}</li>`).join("")}
             </ul>`}
      </div>`;
    const close = document.getElementById("btnCloseCheck");
    if (close) close.addEventListener("click", () => { parseWarningEl.innerHTML = ""; });
  }

  // ------------------------------- top bar actions -------------------------------

  // The worker lives in vendor/ in the multi-file build, but is inlined into a
  // <script type="text/plain"> block in the single-file build (see build-single-file.js).
  // Resolving it at runtime keeps one source working for both.
  let cachedWorkerSrc = null;
  function resolveWorkerSrc() {
    if (cachedWorkerSrc) return cachedWorkerSrc;
    const inlined = document.getElementById("pdfjs-worker-src");
    if (inlined && inlined.textContent.length > 1000) {
      cachedWorkerSrc = URL.createObjectURL(
        new Blob([inlined.textContent], { type: "application/javascript" })
      );
    } else {
      cachedWorkerSrc = "vendor/pdf.worker.min.js";
    }
    return cachedWorkerSrc;
  }

  // Some browsers refuse to spawn a blob: Worker from a file:// page. pdf.js will
  // skip the real worker and parse on the main thread if globalThis.pdfjsWorker is
  // already defined, so running the inlined worker source here is a safe fallback
  // (slower, but needs no blob URL at all). Only reached if the worker path failed.
  function enableMainThreadWorker() {
    if (globalThis.pdfjsWorker) return true;
    const inlined = document.getElementById("pdfjs-worker-src");
    if (!inlined || inlined.textContent.length < 1000) return false;
    try {
      new Function(inlined.textContent)(); // UMD wrapper assigns globalThis.pdfjsWorker
      return !!globalThis.pdfjsWorker;
    } catch (e) {
      return false;
    }
  }

  async function parsePdfResilient(buf) {
    // pdf.js may transfer (and thus detach) the buffer it is given, so keep a
    // pristine copy for the retry before the first attempt touches it.
    const retryCopy = buf.slice(0);
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = resolveWorkerSrc();
      return await parseRosterPdf(pdfjsLib, buf);
    } catch (err) {
      if (!enableMainThreadWorker()) throw err;
      return await parseRosterPdf(pdfjsLib, retryCopy);
    }
  }

  // Open the picker from JS rather than a <label for>: iOS Safari is unreliable
  // about labels bound to a hidden file input. Delegated so the button rendered
  // into the empty state works too.
  document.addEventListener("click", (e) => {
    if (e.target.closest("#btnUpload, [data-upload]")) {
      e.preventDefault();
      fileInput.click();
    }
  });

  // Anything that blows up should say so on screen — on a phone there is no
  // console to check, and a silent failure looks like "the button is broken".
  window.addEventListener("error", (e) => {
    parseWarningEl.innerHTML =
      `<div class="warning-banner">⚠️ Something went wrong: ${escapeHtml(e.message || "unknown error")}</div>`;
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      rosterStatusEl.innerHTML = `<span>Reading PDF…</span>`;
      const buf = await file.arrayBuffer();
      const { employees, dayLabels, weekDates } = await parsePdfResilient(buf);
      if (!dayLabels.length) {
        parseWarningEl.innerHTML = `<div class="warning-banner">⚠️ Could not find the day columns in this PDF — the layout may differ from the expected export. Try a different file, or add people manually.</div>`;
      } else {
        parseWarningEl.innerHTML = "";
      }
      const totalShifts = employees.reduce((n, e) => n + Object.values(e.shifts).reduce((a, r) => a + r.length, 0), 0);
      if (dayLabels.length && totalShifts === 0) {
        parseWarningEl.innerHTML = `<div class="warning-banner">⚠️ Found ${employees.length} names but no shift times — double check the PDF is the "Node Weekrooster" schedule export.</div>`;
      }
      STATE.roster = { employees, dayLabels, weekDates };
      STATE.activeDay = dayLabels[0] || null;
      pruneStaleAssignments();
      ensureDefaultPositions();
      saveState();
      render();
      // Always report on the import, so a silent mis-parse can't go unnoticed.
      if (dayLabels.length && totalShifts > 0) renderCheckReport();
    } catch (err) {
      parseWarningEl.innerHTML = `<div class="warning-banner">⚠️ Couldn't read that PDF (${escapeHtml(err.message || String(err))}). Make sure it's the weekly roster export.</div>`;
      renderRosterStatus();
    } finally {
      fileInput.value = "";
    }
  });

  btnPrint.addEventListener("click", () => window.print());

  const btnCheck = document.getElementById("btnCheck");
  btnCheck.addEventListener("click", () => {
    if (!STATE.roster) {
      parseWarningEl.innerHTML = `<div class="warning-banner">Upload a roster PDF first, then this will check it imported completely.</div>`;
      return;
    }
    renderCheckReport();
  });

  btnManual.addEventListener("click", () => manualForm.classList.add("open"));
  document.getElementById("mCancel").addEventListener("click", () => manualForm.classList.remove("open"));
  document.getElementById("mAdd").addEventListener("click", () => {
    const name = mName.value.trim();
    const day = mDay.value;
    const start = mStart.value;
    const end = mEnd.value;
    if (!name || !day || !start || !end) return;
    // Adding someone who is already in the roster by hand is almost always a
    // mistake — their hours are already fixed — so say so rather than silently
    // creating a second entry with different times.
    parseWarningEl.innerHTML = ""; // don't leave a previous person's warning standing
    const clash = STATE.roster && STATE.roster.employees.find(
      (e) => (e.name || "").trim().toLowerCase() === name.toLowerCase());
    if (clash) {
      parseWarningEl.innerHTML =
        `<div class="warning-banner">⚠️ <b>${escapeHtml(name)}</b> is already in the roster with hours set by the PDF. ` +
        `Added as a separate manual entry anyway — remove it with the × on its block if that wasn't what you wanted.</div>`;
    }
    manualCounter++;
    STATE.manualEntries.push({ id: `m::${manualCounter}`, name, day, start, end });
    mName.value = "";
    manualForm.classList.remove("open");
    saveState();
    render();
  });

  render();
})();
