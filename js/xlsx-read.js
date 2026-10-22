// Lector mínimo de archivos .xlsx (Excel, LibreOffice, Google Sheets) SIN librerías: un .xlsx es un zip con XML dentro.
// Devuelve la primera hoja (o la que se llame "recetas") como tabla: array de filas, cada una array de celdas.
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const dec = (u8) => new TextDecoder('utf-8').decode(u8);

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador no puede leer Excel; guarda el archivo como CSV.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function unzip(buf) {
  const b = new Uint8Array(buf);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('No es un archivo .xlsx válido.');
  const total = u16(b, eocd + 10);
  let p = u32(b, eocd + 16);
  const files = new Map();
  for (let n = 0; n < total; n++) {
    if (u32(b, p) !== 0x02014b50) throw new Error('El archivo .xlsx está dañado.');
    const flags = u16(b, p + 8), method = u16(b, p + 10), csize = u32(b, p + 20);
    const nl = u16(b, p + 28), el = u16(b, p + 30), cl = u16(b, p + 32), lho = u32(b, p + 42);
    const name = dec(b.subarray(p + 46, p + 46 + nl));
    if (flags & 1) throw new Error('El archivo está protegido con contraseña.');
    files.set(name, { method, csize, lho });
    p += 46 + nl + el + cl;
  }
  const read = async (name) => {
    const f = files.get(name);
    if (!f) return null;
    const o = f.lho;
    if (u32(b, o) !== 0x04034b50) throw new Error('El archivo .xlsx está dañado.');
    const start = o + 30 + u16(b, o + 26) + u16(b, o + 28);
    const data = b.subarray(start, start + f.csize);
    if (f.method === 0) return data;
    if (f.method === 8) return inflateRaw(data);
    throw new Error('Compresión de Excel no soportada; guarda el archivo como CSV.');
  };
  return { files, read };
}

const xml = (u8) => new DOMParser().parseFromString(dec(u8), 'application/xml');
const colIndex = (ref) => { let n = 0; for (const ch of ref.replace(/[^A-Z]/gi, '').toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
const text = (el) => [...el.getElementsByTagName('t')].filter((t) => !t.closest || !t.closest('rPh')).map((t) => t.textContent).join('');

export async function readXlsx(buf) {
  const head = new Uint8Array(buf, 0, 4);
  if (head[0] === 0xd0 && head[1] === 0xcf) throw new Error('Es un Excel antiguo (.xls). Guárdalo como .xlsx o como CSV.');
  const z = unzip(buf);
  const wbRaw = await z.read('xl/workbook.xml');
  if (!wbRaw) throw new Error('No es un archivo .xlsx válido.');
  const wb = xml(wbRaw);
  const sheets = [...wb.getElementsByTagName('sheet')];
  if (!sheets.length) throw new Error('El Excel no tiene hojas.');
  const pick = sheets.find((s) => /receta|recipe/i.test(s.getAttribute('name') || '')) || sheets[0];
  const rid = pick.getAttribute('r:id') || [...pick.attributes].find((a) => a.name.endsWith(':id') || a.localName === 'id')?.value;
  const relsRaw = await z.read('xl/_rels/workbook.xml.rels');
  let target = 'worksheets/sheet1.xml';
  if (relsRaw) {
    const rel = [...xml(relsRaw).getElementsByTagName('Relationship')].find((r) => r.getAttribute('Id') === rid);
    if (rel) target = rel.getAttribute('Target');
  }
  const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
  const sheetRaw = await z.read(path);
  if (!sheetRaw) throw new Error('No se encontró la hoja en el archivo.');
  let shared = [];
  const ssRaw = await z.read('xl/sharedStrings.xml');
  if (ssRaw) shared = [...xml(ssRaw).getElementsByTagName('si')].map(text);
  const table = [];
  let maxRow = 0;
  for (const rowEl of xml(sheetRaw).getElementsByTagName('row')) {
    const ri = Number(rowEl.getAttribute('r')) - 1;
    const row = [];
    let next = 0;
    for (const c of rowEl.getElementsByTagName('c')) {
      const ref = c.getAttribute('r');
      const ci = ref ? colIndex(ref) : next;
      next = ci + 1;
      const t = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0];
      let val = '';
      if (t === 's') val = v ? shared[Number(v.textContent)] ?? '' : '';
      else if (t === 'inlineStr') val = text(c);
      else if (t === 'str' || t === 'b') val = v ? v.textContent : '';
      else if (t === 'e') val = '';
      else if (v && v.textContent !== '') { const x = Number(v.textContent); val = Number.isFinite(x) ? x : v.textContent; }
      row[ci] = val;
    }
    for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = '';
    const idx = Number.isFinite(ri) && ri >= 0 ? ri : table.length;
    table[idx] = row;
    maxRow = Math.max(maxRow, idx);
  }
  for (let i = 0; i <= maxRow; i++) if (!table[i]) table[i] = [];
  return table;
}
