// Parser for the "Node Weekrooster" PDF export (Persnr. / Naam / <7 day columns> / Totaal table).
// Pure function: given a pdfjsLib handle and an ArrayBuffer, returns { employees, dayLabels, weekDates }.
// employees: [{ persnr, name, dept, shifts: { <dayLabel>: ["HH:MM-HH:MM", ...] } }]
(function (global) {
  "use strict";

  const FURNITURE_EXACT = new Set(["Node Weekrooster (incl. inleen)", "Ziekte", "Verlof", "Feestdag"]);
  const TIME_RANGE_RE = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/;
  const PERSNR_RE = /^\d{5,9}$/;
  const COSTCENTER_RE = /^\d+\(\d+\)$/;
  const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;
  const DURATION_RE = /^\d{1,3}:\d{2}$/;
  const FOOTER_RE = /^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}$/;
  const GUILLEMET = "»"; // literal "»" — kept as an escape so byte/charset quirks can't break the match
  const NAME_COL_MAX_X0 = 150; // empirically: name text never starts past this x0 in the source template

  async function parseRosterPdf(pdfjsLib, arrayBuffer) {
    const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const employees = [];
    let currentEmp = null;
    let currentDept = null;
    let dayBounds = null; // upper x0 bound for each of the 7 day columns (last = boundary with Totaal)
    let dayLabels = null; // the 7 header cell texts, in left-to-right order
    let weekDates = null; // { [dayLabel]: 'dd/mm/yyyy' }

    for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent();
      const view = page.view;
      const pageHeight = view[3] - view[1];
      const pageLeft = view[0];

      const items = [];
      for (const it of content.items) {
        const str = it.str;
        if (!str || !str.trim()) continue;
        items.push({
          text: str.trim(),
          x0: it.transform[4] - pageLeft,
          top: pageHeight - it.transform[5],
        });
      }

      // --- Locate the header row structurally: Persnr. / Naam ... <7 day headers> ... Totaal ---
      const totaalItem = items.find((it) => it.text === "Totaal" && it.top < 130);
      const naamItem = items.find((it) => it.text === "Naam" && it.top < 130);
      if (totaalItem && naamItem) {
        const headerTop = totaalItem.top;
        const dayItems = items
          .filter((it) => Math.abs(it.top - headerTop) < 1.5 && it.x0 > naamItem.x0 + 5 && it.text !== "Totaal")
          .sort((a, b) => a.x0 - b.x0);
        if (dayItems.length === 7) {
          dayLabels = dayItems.map((d) => d.text);
          const xs = dayItems.map((d) => d.x0);
          const bounds = [];
          for (let i = 0; i < xs.length - 1; i++) bounds.push((xs[i] + xs[i + 1]) / 2);
          bounds.push((xs[xs.length - 1] + totaalItem.x0) / 2);
          dayBounds = bounds;

          if (!weekDates) {
            weekDates = {};
            for (const it of items) {
              if (DATE_RE.test(it.text) && it.top > headerTop + 5 && it.top < headerTop + 30) {
                for (let di = 0; di < xs.length; di++) {
                  const lo = di === 0 ? -Infinity : bounds[di - 1];
                  const hi = bounds[di];
                  if (it.x0 >= lo - 60 && it.x0 < hi) {
                    weekDates[dayLabels[di]] = it.text;
                    break;
                  }
                }
              }
            }
          }
        }
      }

      // --- Group words into visual rows by top (with tolerance) ---
      const rows = [];
      for (const it of items) {
        let row = rows.find((r) => Math.abs(r.top - it.top) < 1.2);
        if (!row) { row = { top: it.top, items: [] }; rows.push(row); }
        row.items.push(it);
      }
      rows.sort((a, b) => a.top - b.top);
      for (const row of rows) row.items.sort((a, b) => a.x0 - b.x0);

      // The "Totaal" column sits to the right of the last day column and holds the
      // employee's weekly hours. It is an independent number the import check
      // reconciles the parsed shifts against, so it is worth capturing.
      const assignTotal = (emp, text, x0) => {
        if (!dayBounds || emp.totaal != null) return false;
        if (x0 <= dayBounds[dayBounds.length - 1]) return false;
        if (!DURATION_RE.test(text)) return false;
        emp.totaal = text;
        return true;
      };

      const assignShift = (emp, text, x0) => {
        const m = TIME_RANGE_RE.exec(text);
        if (!m || !dayBounds || !dayLabels) return false;
        let dayIdx = null;
        for (let di = 0; di < dayBounds.length; di++) {
          if (x0 < dayBounds[di]) { dayIdx = di; break; }
        }
        if (dayIdx === null) return false;
        emp.shifts[dayLabels[dayIdx]].push(`${m[1]}-${m[2]}`);
        return true;
      };

      for (const row of rows) {
        const texts = row.items.map((w) => w.text);
        const first = texts[0];
        const x0First = row.items[0].x0;
        const joined = texts.join(" ");

        if (FURNITURE_EXACT.has(joined)) continue;
        if (texts.some((t) => FURNITURE_EXACT.has(t))) continue;
        if (texts.every((t) => DATE_RE.test(t))) continue;
        if (texts.length === 1 && /^\d{1,2}$/.test(first) && x0First < 40) continue;
        if (texts.length <= 2 && FOOTER_RE.test(joined)) continue;
        if (dayLabels && dayLabels.includes(first)) continue;
        if (joined.includes(GUILLEMET)) continue;

        if (PERSNR_RE.test(first) && x0First < 40) {
          const nameParts = [];
          const shiftItems = [];
          for (const w of row.items.slice(1)) {
            if (w.x0 < NAME_COL_MAX_X0) nameParts.push(w.text);
            else shiftItems.push(w);
          }
          currentEmp = {
            persnr: first,
            name: nameParts.join(" "),
            dept: currentDept,
            totaal: null,
            shifts: dayLabels ? Object.fromEntries(dayLabels.map((d) => [d, []])) : {},
          };
          employees.push(currentEmp);
          for (const w of shiftItems) {
            if (!assignShift(currentEmp, w.text, w.x0)) assignTotal(currentEmp, w.text, w.x0);
          }
          continue;
        }

        const alphaChars = texts.join("").split("").filter((c) => /[a-zA-Z]/.test(c));
        const upperRatio = alphaChars.length
          ? alphaChars.filter((c) => c === c.toUpperCase()).length / alphaChars.length
          : 0;
        const hasTime = texts.some((t) => TIME_RANGE_RE.test(t));
        if (upperRatio > 0.8 && x0First < 30 && !hasTime) {
          currentDept = joined;
          currentEmp = null;
          continue;
        }

        if (texts.length && texts.every((t) => COSTCENTER_RE.test(t))) continue;

        if (currentEmp) {
          const nameExtra = [];
          const shiftItems = [];
          for (const w of row.items) {
            if (w.x0 < NAME_COL_MAX_X0) nameExtra.push(w.text);
            else shiftItems.push(w);
          }
          if (nameExtra.length && !shiftItems.length) {
            currentEmp.name += " " + nameExtra.join(" ");
          } else if (shiftItems.length) {
            for (const w of shiftItems) {
              if (!assignShift(currentEmp, w.text, w.x0)) assignTotal(currentEmp, w.text, w.x0);
            }
          }
          continue;
        }
      }

      // if this page never had shifts assignable (dayLabels missing), still fix up employees
      // added before dayLabels was discovered — backfill empty shift maps for consistency.
      if (dayLabels) {
        for (const emp of employees) {
          if (!emp.shifts || Object.keys(emp.shifts).length === 0) {
            emp.shifts = Object.fromEntries(dayLabels.map((d) => [d, []]));
          }
        }
      }
    }

    return { employees, dayLabels: dayLabels || [], weekDates: weekDates || {} };
  }

  global.parseRosterPdf = parseRosterPdf;
})(window);
