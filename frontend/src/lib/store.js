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
import * as pdfjsLib from "pdfjs-dist/build/pdf";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

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

/* ---------- Sabor Casero: catálogo fijo de desayuno ----------
 * El desayuno de Sabor Casero nunca cambia, así que va fijo en el código
 * (no se sube por PDF). Lunes a viernes comparten el mismo catálogo;
 * el sábado tiene uno distinto.
 */
export const SABOR_CASERO_DESAYUNO_SEMANA = [
  "Reviro con 2 huevos fritos, café negro",
  "Sandwich de verduras con jugo",
  "Mixto con café con leche",
  "Pote de frutas",
  "Omelette con jugo o 2 huevos duros",
  "Empanada frita con mandioca y jugo",
  "Torta de naranja con yogurt",
  "Chipa con cocido negro o con leche",
];

export const SABOR_CASERO_DESAYUNO_SABADO = [
  "Sandwich de milanesa de carne o pollo",
  "Bocadito x 12 unidades + jugo de 140ml",
  "Pote de frutas",
  "Omelette con queso y jamón + jugo",
  "Empanadón + gaseosa",
  "Pasta frola + yogurt",
];

const SC_DAY_ORDER = ["lunes", "martes", "miercoles", "jueves", "viernes"];

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
  const result = { mara: null, saborcasero: null };
  for (const p of ["mara", "saborcasero"]) {
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

/* ---------- Sabor Casero: parser de PDF de almuerzo (client-side) ----------
 * El PDF tiene siempre el mismo formato de tabla: 5 columnas (Lunes a
 * Viernes) y, para cada día, 3 bloques "Primera/Segunda/Tercera Opción"
 * (el primero sin rótulo explícito), cada uno con su plato fuerte y su(s)
 * fila(s) de "GUARNICION" (una o varias, cada una elegible por separado).
 *
 * Estrategia: en vez de depender solo del texto (las celdas se cortan en
 * varias líneas físicas de forma distinta por columna), usamos también los
 * rectángulos vectoriales del PDF (líneas/fondos de la tabla) para
 * reconstruir los límites reales de fila y columna, igual que haría una
 * librería de extracción de tablas. Así cada celda —aunque su texto haya
 * quedado partido en 2 o 3 líneas— se recompone completa.
 */
function scNormText(s) {
  return (s || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function scClusterValues(vals, tol) {
  const sorted = [...vals].sort((a, b) => a - b);
  const out = [];
  for (const v of sorted) {
    if (out.length && Math.abs(out[out.length - 1] - v) < tol) continue;
    out.push(v);
  }
  return out;
}

/** Parsea el PDF de almuerzo de Sabor Casero (ArrayBuffer) y devuelve
 * { provider: "saborcasero", week_start: null, week_end: null, days }
 * con `days[].opciones` = [{ titulo, plato, guarnicion: [] }] (3 por día,
 * lunes a viernes). El sábado no tiene almuerzo (solo desayuno fijo).
 */
export async function parseSaborCaseroPdf(arrayBuffer) {
  const data =
    arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const pageHeight = viewport.height;

  const opList = await page.getOperatorList();
  const OPS = pdfjsLib.OPS;

  // 1. Rectángulos vectoriales -> límites de fila/columna de la tabla.
  const rects = [];
  for (let i = 0; i < opList.fnArray.length; i++) {
    if (opList.fnArray[i] === OPS.constructPath) {
      const coords = opList.argsArray[i][1];
      if (coords && coords.length === 4) {
        const [x, y, w, h] = coords;
        rects.push({
          x0: x,
          top: pageHeight - (y + h),
          bottom: pageHeight - y,
          w,
          h,
        });
      }
    }
  }

  const rowBoundSet = new Set();
  rects
    .filter((r) => r.w > 400)
    .forEach((r) => {
      rowBoundSet.add(Math.round(r.top * 10) / 10);
      rowBoundSet.add(Math.round(r.bottom * 10) / 10);
    });
  const rowBounds = scClusterValues([...rowBoundSet], 1);

  const colBoundSet = new Set();
  rects
    .filter((r) => r.h > 50)
    .forEach((r) => colBoundSet.add(Math.round(r.x0 * 10) / 10));
  const colBounds = scClusterValues([...colBoundSet], 1);

  if (rowBounds.length < 4 || colBounds.length < 6) {
    throw new Error(
      "No se pudo detectar la tabla del PDF. Verificá que sea el PDF de almuerzo de Sabor Casero (formato habitual)."
    );
  }

  // 2. Palabras del PDF -> celda (fila, columna) según su posición.
  const tc = await page.getTextContent();
  const words = tc.items
    .map((it) => {
      const x = it.transform[4];
      const yBottom = it.transform[5];
      const height = it.height || Math.abs(it.transform[3]) || 8;
      return { str: it.str, x, top: pageHeight - yBottom - height * 0.85 };
    })
    .filter((w) => w.str && w.str.trim());

  const rowOf = (top) => {
    for (let i = 0; i < rowBounds.length - 1; i++) {
      if (top >= rowBounds[i] - 1 && top < rowBounds[i + 1] + 1) return i;
    }
    return -1;
  };
  const colOf = (x) => {
    for (let i = 0; i < colBounds.length - 1; i++) {
      if (x >= colBounds[i] - 1 && x < colBounds[i + 1] + 1) return i;
    }
    return -1;
  };

  const grid = {};
  for (const w of words) {
    const r = rowOf(w.top);
    const c = colOf(w.x);
    if (r < 0 || c < 0) continue;
    const key = `${r}_${c}`;
    (grid[key] = grid[key] || []).push(w);
  }

  const numRows = rowBounds.length - 1;
  const numCols = colBounds.length - 1;
  const tableRows = [];
  for (let r = 0; r < numRows; r++) {
    const row = [];
    for (let c = 0; c < numCols; c++) {
      const arr = (grid[`${r}_${c}`] || []).sort(
        (a, b) => a.top - b.top || a.x - b.x
      );
      row.push(
        arr
          .map((x) => x.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
      );
    }
    tableRows.push(row);
  }

  // 3. Ubicar la fila de encabezados de día (Lunes..Viernes) y sus columnas.
  const DAY_NAMES = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"];
  let headerRowIdx = -1;
  let dayCols = [];
  for (let r = 0; r < tableRows.length && headerRowIdx < 0; r++) {
    const row = tableRows[r];
    for (let c = 0; c < row.length; c++) {
      if (scNormText(row[c]) !== "LUNES") continue;
      const seq = DAY_NAMES.map((_, i) => scNormText(row[c + i] || ""));
      if (DAY_NAMES.every((d, i) => seq[i] === d)) {
        headerRowIdx = r;
        dayCols = DAY_NAMES.map((_, i) => c + i);
        break;
      }
    }
  }
  if (headerRowIdx < 0) {
    throw new Error(
      "No se encontró la fila de días (Lunes a Viernes) en el PDF."
    );
  }

  // 4. Recorrer filas después del encabezado, armando 3 opciones por día.
  const dayData = {};
  SC_DAY_ORDER.forEach((d) => (dayData[d] = []));

  let state = "plato"; // 'plato' | 'guarnicion'
  let opcionCount = 0;
  let currentPlato = {};
  let currentGuarnicion = {};

  const isMarkerRow = (row, marker) =>
    dayCols.every((c) => scNormText(row[c]) === marker);

  const flushOpcion = () => {
    opcionCount += 1;
    const titulo =
      opcionCount === 1
        ? "Primera Opción"
        : opcionCount === 2
        ? "Segunda Opción"
        : "Tercera Opción";
    SC_DAY_ORDER.forEach((d, i) => {
      const c = dayCols[i];
      dayData[d].push({
        titulo,
        plato: (currentPlato[c] || "").trim(),
        guarnicion: (currentGuarnicion[c] || []).filter(Boolean),
      });
    });
    currentPlato = {};
    currentGuarnicion = {};
  };

  for (let r = headerRowIdx + 1; r < tableRows.length; r++) {
    const row = tableRows[r];
    const nonEmpty = dayCols.some((c) => row[c] && row[c].trim());
    if (!nonEmpty) continue;

    if (isMarkerRow(row, "GUARNICION")) {
      state = "guarnicion";
      continue;
    }
    if (isMarkerRow(row, "SEGUNDA OPCION") || isMarkerRow(row, "TERCERA OPCION")) {
      flushOpcion();
      state = "plato";
      continue;
    }
    if (/^OBSERVACION/.test(scNormText(row[dayCols[0]]))) break;

    if (state === "plato") {
      dayCols.forEach((c) => {
        currentPlato[c] = currentPlato[c] ? `${currentPlato[c]} ${row[c]}`.trim() : row[c];
      });
    } else {
      dayCols.forEach((c) => {
        if (!currentGuarnicion[c]) currentGuarnicion[c] = [];
        if (row[c] && row[c].trim()) currentGuarnicion[c].push(row[c].trim());
      });
    }
  }
  flushOpcion(); // tercera opción (no hay marcador de cierre)

  if (opcionCount < 3) {
    throw new Error(
      "Se detectaron menos de 3 opciones de almuerzo. Revisá el PDF o completá el menú manualmente."
    );
  }

  const days = DAYS.map((d) => {
    if (d === "sabado") {
      return {
        day: d,
        date: null,
        breakfast: [...SABOR_CASERO_DESAYUNO_SABADO],
        main: [],
        diet: [],
        sides: [],
        opciones: [],
      };
    }
    const opciones = dayData[d] || [];
    return {
      day: d,
      date: null,
      breakfast: [...SABOR_CASERO_DESAYUNO_SEMANA],
      main: opciones.map((o) => o.plato).filter(Boolean),
      diet: [],
      sides: opciones.flatMap((o) => o.guarnicion),
      opciones,
    };
  });

  return { provider: "saborcasero", week_start: null, week_end: null, days };
}

/** Arma el esqueleto (sin PDF) de un menú nuevo de Sabor Casero, con el
 * desayuno fijo ya cargado y 3 opciones vacías por día para completar a mano.
 */
export function emptySaborCaseroDays() {
  return DAYS.map((d) => {
    if (d === "sabado") {
      return {
        day: d,
        date: null,
        breakfast: [...SABOR_CASERO_DESAYUNO_SABADO],
        main: [],
        diet: [],
        sides: [],
        opciones: [],
      };
    }
    return {
      day: d,
      date: null,
      breakfast: [...SABOR_CASERO_DESAYUNO_SEMANA],
      main: [],
      diet: [],
      sides: [],
      opciones: [
        { titulo: "Primera Opción", plato: "", guarnicion: [] },
        { titulo: "Segunda Opción", plato: "", guarnicion: [] },
        { titulo: "Tercera Opción", plato: "", guarnicion: [] },
      ],
    };
  });
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
