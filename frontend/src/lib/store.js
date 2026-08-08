import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import * as XLSX from "xlsx";

/* ---------- constants ---------- */
export const DAYS = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];
export const DAY_LABEL = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
};

/* ---------- helpers ---------- */
const sanitize = (s) =>
  (s || "").toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

export const selectionDocId = (menuId, userName) =>
  `${menuId}__${sanitize(userName)}`;

/* ---------- menus ---------- */
export async function listMenus(provider) {
  const q = provider
    ? query(collection(db, "menus"), where("provider", "==", provider))
    : collection(db, "menus");
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  return items;
}

export async function getActiveMenus() {
  const result = { mara: null, sabrositos: null };
  for (const p of ["mara", "sabrositos"]) {
    const list = await listMenus(p);
    result[p] = list[0] || null;
  }
  return result;
}

export async function createMenu(data) {
  const payload = { ...data, created_at: Date.now() };
  const ref = await addDoc(collection(db, "menus"), payload);
  return { id: ref.id, ...payload };
}

export async function updateMenu(id, data) {
  await updateDoc(doc(db, "menus", id), data);
  const snap = await getDoc(doc(db, "menus", id));
  return { id: snap.id, ...snap.data() };
}

export async function deleteMenu(id) {
  // delete menu + cascade selections
  await deleteDoc(doc(db, "menus", id));
  const q = query(collection(db, "selections"), where("menu_id", "==", id));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  if (snap.docs.length) await batch.commit();
}

/* ---------- selections ---------- */
export async function saveSelection({
  userName,
  provider,
  menu,
  choices,
}) {
  const id = selectionDocId(menu.id, userName);
  const payload = {
    user_name: userName.trim(),
    provider,
    menu_id: menu.id,
    week_start: menu.week_start || null,
    week_end: menu.week_end || null,
    choices,
    created_at: Date.now(),
  };
  await setDoc(doc(db, "selections", id), payload, { merge: true });
  return { id, ...payload };
}

export async function getMySelection(menuId, userName) {
  const id = selectionDocId(menuId, userName);
  const snap = await getDoc(doc(db, "selections", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listSelections({ provider, menuId }) {
  const constraints = [];
  if (provider) constraints.push(where("provider", "==", provider));
  if (menuId) constraints.push(where("menu_id", "==", menuId));
  const q = constraints.length
    ? query(collection(db, "selections"), ...constraints)
    : collection(db, "selections");
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
  return items;
}

export async function resetSelections(provider) {
  const q = query(collection(db, "selections"), where("provider", "==", provider));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  if (snap.docs.length) await batch.commit();
  return snap.docs.length;
}

/* ---------- Excel parsers (client-side) ---------- */
const DAY_KEYWORDS = {
  lunes: "lunes",
  martes: "martes",
  miercoles: "miercoles",
  miércoles: "miercoles",
  jueves: "jueves",
  viernes: "viernes",
  sabado: "sabado",
  sábado: "sabado",
  "lunch sabado": "sabado",
  "lunch sábado": "sabado",
};

function isDayHeader(v) {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  return DAY_KEYWORDS[s] || null;
}

function emptyDay(day) {
  return { day, date: null, breakfast: [], main: [], diet: [], sides: [] };
}

/** Parse Mara's xlsx as ArrayBuffer */
export function parseMaraExcel(arrayBuffer) {
  const data = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  const dayBlocks = {};
  const breakfast = [];

  const scanBlock = (startIdx, itemCol, dateVal) => {
    const block = { main: [], diet: [], sides: [], date: null };
    if (dateVal instanceof Date) {
      block.date = dateVal.toISOString().slice(0, 10);
    } else if (typeof dateVal === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
      block.date = dateVal.slice(0, 10);
    }
    for (let i = startIdx + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const first = row[itemCol - 1];
      const item = row[itemCol];
      if (typeof item === "string" && isDayHeader(item)) break;
      if (first instanceof Date) break;
      if (typeof item === "string" && item.trim()) {
        const txt = item.trim();
        const marker = String(first || "").toLowerCase();
        const up = txt.toUpperCase();
        if (marker.includes("dieta") || txt.toLowerCase().includes("dieta")) {
          block.diet.push(txt.replace(/dieta/gi, "").trim());
        } else if (
          up.startsWith("ENS") ||
          up.startsWith("PAN") ||
          up.startsWith("MANDIOCA")
        ) {
          block.sides.push(txt);
        } else {
          block.main.push(txt);
        }
      }
    }
    return block;
  };

  let inBreakfast = false;
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx] || [];
    // left half
    const leftFlag = row[0];
    const leftVal = row[1];
    if (typeof leftFlag === "string" && leftFlag.trim().toUpperCase().startsWith("DESAYUNO")) {
      inBreakfast = true;
      continue;
    }
    const leftDay = isDayHeader(leftVal);
    if (leftDay) {
      const blk = scanBlock(idx, 1, leftFlag instanceof Date ? leftFlag : null);
      dayBlocks[leftDay] = { ...(dayBlocks[leftDay] || {}), ...blk };
    }
    // right half
    const rightFlag = row[8];
    const rightVal = row[9];
    const rightDay = isDayHeader(rightVal);
    if (rightDay) {
      const blk = scanBlock(idx, 9, rightFlag instanceof Date ? rightFlag : null);
      dayBlocks[rightDay] = { ...(dayBlocks[rightDay] || {}), ...blk };
    }
    // breakfast items in col 0
    if (inBreakfast && idx > 0) {
      const v = row[0];
      if (typeof v === "string") {
        const s = v.trim();
        if (s && !s.toUpperCase().startsWith("DESAYUNO")) breakfast.push(s);
      }
    }
  }

  const days = DAYS.map((d) => {
    const blk = dayBlocks[d] || {};
    return {
      day: d,
      date: blk.date || null,
      main: blk.main || [],
      diet: blk.diet || [],
      sides: blk.sides || [],
      breakfast: d === "sabado" ? [] : breakfast,
    };
  });

  const dates = days.map((d) => d.date).filter(Boolean);
  const week_start = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
  const week_end = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;

  return { provider: "mara", week_start, week_end, days };
}

/** Parse Sabrositos WhatsApp text.
 * Detects 4 sections:
 *   - Desayuno (global Mon-Fri) -> breakfast
 *   - Almuerzo: (per day, Mon-Fri) -> main
 *   - Acompañamientos: (global Mon-Fri) -> sides
 *   - Menú Opcional: (global Mon-Fri) -> diet
 * Saturday items ("Opciones:" or plain lines after Sábado header) go to main.
 */
export function parseSabrositosText(text) {
  if (!text) return { provider: "sabrositos", week_start: null, week_end: null, days: DAYS.map(emptyDay) };

  // Normalize: put section markers on their own line so they can be
  // detected even when the original text runs them together.
  let normalized = text
    .replace(/\bAcompa[nñ]amientos\s*:?/gi, "\nAcompañamientos:\n")
    .replace(/\bMen[uú]\s*Opcional\s*:?/gi, "\nMenú Opcional:\n")
    .replace(/\bAlmuerzo\s*:?/gi, "\nAlmuerzo:\n")
    .replace(/\bOpciones\s*:?/gi, "\nOpciones:\n")
    .replace(/\bDesayuno\s*:?/gi, "\nDesayuno\n");

  const lines = normalized.split("\n").map((l) => l.trim()).filter(Boolean);

  const breakfast = [];        // global Mon-Fri
  const sides = [];            // global Mon-Fri (Acompañamientos)
  const diet = [];             // global Mon-Fri (Menú Opcional)
  const mainByDay = {};        // per-day almuerzo
  const saturdayItems = [];    // sábado items

  let section = null;   // 'breakfast' | 'main' | 'sides' | 'diet' | 'saturday'
  let currentDay = null;

  const isSectionHeader = (low) => {
    const l = low.replace(/[:.]/g, "").trim();
    if (l === "desayuno") return "breakfast";
    if (l === "almuerzo") return "main";
    if (l.startsWith("acompa")) return "sides";
    if (l === "menú opcional" || l === "menu opcional") return "diet";
    if (l === "opciones") return "sat_options";
    return null;
  };

  const isDayHeader = (low) => {
    const clean = low.replace(/[():*#]/g, "").trim();
    for (const [kw, key] of Object.entries(DAY_KEYWORDS)) {
      if (clean === kw || clean.startsWith(kw + " ") || clean.endsWith(" " + kw)) return key;
    }
    return null;
  };

  const cleanItem = (line) => {
    // Strip leading emojis/bullets/quantities
    let s = line.replace(/^[^\wáéíóúñÁÉÍÓÚÑ¡¿]+/u, "").trim();
    // Remove leading list markers like "1.", "-", "•"
    s = s.replace(/^[-*•]\s*/, "").trim();
    return s;
  };

  // Deduplicated push (case-insensitive) — used for global lists that may
  // receive the same items multiple times (e.g. "Desayuno:" repeated per day).
  const pushDedup = (arr, item) => {
    const k = item.toLowerCase().trim();
    if (!arr.some((x) => x.toLowerCase().trim() === k)) arr.push(item);
  };

  for (const line of lines) {
    const low = line.toLowerCase();

    // Day header?
    const dayKey = isDayHeader(low);
    if (dayKey) {
      currentDay = dayKey;
      if (dayKey === "sabado") {
        section = "saturday";
      } else {
        section = null; // wait for "Almuerzo:" or apply defaults
      }
      continue;
    }

    // Section header?
    const sec = isSectionHeader(low);
    if (sec) {
      if (sec === "sat_options") {
        section = "saturday";
        currentDay = "sabado";
      } else {
        section = sec;
      }
      continue;
    }

    // Skip annotation lines like "(Disponible todos los días)"
    if (line.startsWith("(")) continue;

    // Data line — append to appropriate bucket
    const item = cleanItem(line);
    if (!item) continue;
    // Skip generic titles
    if (/^men[uú]\b/i.test(item) && !/^men[uú]\s*opcional/i.test(item)) continue;

    if (section === "saturday") {
      saturdayItems.push(item);
    } else if (section === "breakfast") {
      pushDedup(breakfast, item);
    } else if (section === "sides") {
      pushDedup(sides, item);
    } else if (section === "diet") {
      pushDedup(diet, item);
    } else if (section === "main") {
      if (!currentDay || currentDay === "sabado") continue;
      if (!mainByDay[currentDay]) mainByDay[currentDay] = [];
      mainByDay[currentDay].push(item);
    } else if (currentDay && currentDay !== "sabado") {
      // fallback: items right under a day header without "Almuerzo:" prefix
      if (!mainByDay[currentDay]) mainByDay[currentDay] = [];
      mainByDay[currentDay].push(item);
    }
  }

  const days = DAYS.map((d) => {
    if (d === "sabado") {
      return {
        ...emptyDay(d),
        main: saturdayItems,
      };
    }
    return {
      day: d,
      date: null,
      breakfast: [...breakfast],
      main: mainByDay[d] || [],
      diet: [...diet],
      sides: [...sides],
    };
  });

  return { provider: "sabrositos", week_start: null, week_end: null, days };
}

/* ---------- Excel export (client-side) ----------
 * Formato: UNA sola hoja "Pedidos".
 *   Fila 1: nombre del día (fusionado sobre las columnas de categoría del día).
 *   Fila 2: categorías (Desayuno / Principal / Acompañamiento).
 *   Fila 3+: nombre del funcionario + texto del plato elegido en cada categoría.
 * "Principal" combina Almuerzo (main) y Menú Opcional (diet): lo que el usuario haya elegido.
 * Solo se incluyen las categorías que tienen opciones en el menú.
 */
function fmtDateHuman(iso) {
  if (!iso || typeof iso !== "string") return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

const EXCEL_CATS = [
  { key: "breakfast", label: "Desayuno", choiceField: "breakfast" },
  { key: "main", label: "Principal", choiceField: "main", altField: "diet" },
  { key: "side", label: "Acompañamiento", choiceField: "side" },
];

function dayHasCategory(dayData, catKey) {
  const bf = (dayData.breakfast || []).length;
  const mn = (dayData.main || []).length;
  const dt = (dayData.diet || []).length;
  const sd = (dayData.sides || []).length;
  if (catKey === "breakfast") return bf > 0;
  if (catKey === "main") return mn > 0 || dt > 0;
  if (catKey === "side") return sd > 0;
  return false;
}

export function exportSelectionsToExcel({ provider, menu, selections }) {
  const daysData = menu?.days || [];

  // 1. Determine layout: which days appear and which categories per day.
  const layout = [];
  for (const d of DAYS) {
    const dd = daysData.find((x) => x.day === d);
    if (!dd) continue;
    const cats = EXCEL_CATS.filter((c) => dayHasCategory(dd, c.key));
    if (!cats.length) continue;
    layout.push({ day: d, dayData: dd, cats });
  }

  const wb = XLSX.utils.book_new();

  if (!layout.length) {
    const ws = XLSX.utils.aoa_to_sheet([["Sin datos para exportar"]]);
    XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
    XLSX.writeFile(wb, `pedidos_${provider}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    return;
  }

  // 2. Build header rows.
  const dayRow = ["Nombre"];
  const catRow = [""];
  const merges = [];
  let colIdx = 1;
  const colWidths = [{ wch: 22 }];

  for (const item of layout) {
    const { day, dayData, cats } = item;
    const dateStr = fmtDateHuman(dayData.date);
    const dayLabel = `${DAY_LABEL[day]}${dateStr ? " (" + dateStr + ")" : ""}`;
    dayRow.push(dayLabel);
    catRow.push(cats[0].label);
    for (let i = 1; i < cats.length; i++) {
      dayRow.push("");
      catRow.push(cats[i].label);
    }
    if (cats.length > 1) {
      merges.push({ s: { r: 0, c: colIdx }, e: { r: 0, c: colIdx + cats.length - 1 } });
    }
    colIdx += cats.length;
    for (const _ of cats) colWidths.push({ wch: 16 });
  }

  // Merge "Nombre" in first column across the two header rows
  merges.push({ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } });

  // 3. Data rows.
  const aoa = [dayRow, catRow];
  for (const s of selections) {
    const row = [s.user_name || ""];
    for (const { day, cats } of layout) {
      const c = (s.choices || {})[day] || {};
      for (const cat of cats) {
        let val = "";
        if (cat.key === "main") {
          const mainChoice = (c.main || "").trim();
          const dietChoice = (c.diet || "").trim();
          const mainExtra = (c.mainExtra || "").trim();
          const dietExtra = (c.dietExtra || "").trim();
          if (mainChoice) {
            val = mainExtra ? `${mainChoice} con ${mainExtra}` : mainChoice;
          } else if (dietChoice) {
            val = dietExtra ? `${dietChoice} con ${dietExtra}` : dietChoice;
          }
        } else if (cat.key === "breakfast") {
          const bf = (c.breakfast || "").trim();
          const bfExtra = (c.breakfastExtra || "").trim();
          val = bf && bfExtra ? `${bf} con ${bfExtra}` : bf;
        } else if (cat.key === "side") {
          const sideChoice = (c.side || "").trim();
          const sideExtra = (c.sideExtra || "").trim();
          val = sideChoice && sideExtra ? `${sideChoice} (${sideExtra})` : sideChoice;
        }
        row.push(val);
      }
    }
    aoa.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = merges;
  ws["!cols"] = colWidths;
  ws["!rows"] = aoa.map((_, i) => ({ hpt: i < 2 ? 24 : 30 }));

  Object.keys(ws)
    .filter((key) => key[0] !== "!")
    .forEach((cell) => {
      ws[cell].s = {
        alignment: {
          wrapText: true,
          vertical: "top",
          horizontal: "left",
        },
      };
    });

  XLSX.utils.book_append_sheet(wb, ws, "Pedidos");

  const filename = `pedidos_${provider}_${
    menu?.week_start || new Date().toISOString().slice(0, 10)
  }.xlsx`;
  XLSX.writeFile(wb, filename);
}
