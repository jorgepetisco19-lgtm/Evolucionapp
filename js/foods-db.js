// Tabla propia de ingredientes habituales (valores aproximados por 100 g, alimento tal como se compra: crudo salvo que ponga "cocido").
// Sirve para estimar las kcal y macros de un ingrediente cuando la persona no los sabe. Fuentes de referencia: tablas BEDCA/USDA, redondeadas.
// Formato: 'nombre|otro nombre|...': [kcal, proteínas, hidratos, grasas]
const RAW = {
  // verduras y hortalizas
  'zanahoria': [41, 0.9, 9.6, 0.2], 'cebolla': [40, 1.1, 9.3, 0.1], 'cebolleta|cebolla tierna': [32, 1.8, 7.3, 0.2], 'puerro': [60, 1.5, 12, 0.3],
  'patata|papa': [77, 2, 17, 0.1], 'batata|boniato': [86, 1.6, 20, 0.1], 'champinon|seta|setas': [22, 3.1, 3.3, 0.3], 'calabaza': [26, 1, 5.5, 0.1],
  'calabacin': [17, 1.2, 3.1, 0.3], 'tomate': [18, 0.9, 3.9, 0.2], 'tomate triturado|tomate natural triturado': [24, 1.3, 4.5, 0.2], 'tomate frito': [85, 1.5, 11, 3.5],
  'pimiento': [27, 1, 6, 0.2], 'pimiento rojo': [31, 1, 6, 0.3], 'pimiento verde': [20, 0.9, 4.6, 0.2], 'berenjena': [25, 1, 6, 0.2], 'espinaca': [23, 2.9, 3.6, 0.4],
  'lechuga': [15, 1.4, 2.9, 0.2], 'pepino': [15, 0.7, 3.6, 0.1], 'brocoli|brecol': [34, 2.8, 6.6, 0.4], 'coliflor': [25, 1.9, 5, 0.3], 'judias verdes': [31, 1.8, 7, 0.2],
  'guisantes|guisante': [81, 5.4, 14, 0.4], 'ajo': [149, 6.4, 33, 0.5], 'remolacha': [43, 1.6, 9.6, 0.2], 'apio': [16, 0.7, 3, 0.2], 'col|repollo': [25, 1.3, 5.8, 0.1],
  'esparrago': [20, 2.2, 3.9, 0.1], 'maiz dulce|maiz': [86, 3.3, 19, 1.4], 'alcachofa': [47, 3.3, 11, 0.2], 'acelga': [19, 1.8, 3.7, 0.2], 'nabo': [28, 0.9, 6.4, 0.1],
  'rabano': [16, 0.7, 3.4, 0.1], 'aceituna|oliva': [115, 0.8, 6, 11], 'hierbas|especias|pimienta|oregano|comino|laurel|tomillo|romero|perejil': [250, 10, 50, 6],
  // frutas
  'manzana': [52, 0.3, 14, 0.2], 'platano|banana': [89, 1.1, 23, 0.3], 'naranja': [47, 0.9, 12, 0.1], 'mandarina': [53, 0.8, 13, 0.3], 'pera': [57, 0.4, 15, 0.1],
  'fresa|freson': [32, 0.7, 7.7, 0.3], 'uva': [69, 0.7, 18, 0.2], 'kiwi': [61, 1.1, 15, 0.5], 'melon': [34, 0.8, 8, 0.2], 'sandia': [30, 0.6, 7.6, 0.2],
  'pina': [50, 0.5, 13, 0.1], 'limon': [29, 1.1, 9.3, 0.3], 'aguacate': [160, 2, 8.5, 14.7], 'melocoton': [39, 0.9, 9.5, 0.3], 'arandano': [57, 0.7, 14, 0.3],
  'cereza': [63, 1, 16, 0.2], 'mango': [60, 0.8, 15, 0.4], 'pasas': [299, 3, 79, 0.5], 'datil': [282, 2.5, 75, 0.4],
  // carnes y embutidos
  'pechuga de pollo|pollo pechuga': [110, 23, 0, 1.5], 'pollo': [172, 20, 0, 10], 'muslo de pollo|muslo pollo': [177, 18, 0, 11], 'pavo|pechuga de pavo': [105, 23, 0, 1.2],
  'ternera': [143, 21, 0, 6.5], 'carne picada de ternera|ternera picada': [175, 19, 0, 11], 'carne picada': [215, 18, 0, 16], 'cerdo|lomo de cerdo': [143, 21, 0, 6],
  'solomillo de cerdo': [120, 21, 0, 3.5], 'jamon serrano': [241, 31, 0, 13], 'jamon cocido|jamon york': [110, 18, 1, 3.5], 'chorizo': [455, 24, 2, 38],
  'salchicha': [300, 12, 3, 27], 'bacon|beicon|panceta': [417, 14, 1, 40], 'cordero': [230, 18, 0, 17],
  // pescado y marisco
  'salmon': [208, 20, 0, 13], 'atun': [144, 23, 0, 5], 'atun lata|atun natural': [116, 26, 0, 1], 'atun aceite': [198, 29, 0, 8.2], 'merluza': [82, 17, 0, 1.3],
  'bacalao': [82, 18, 0, 0.7], 'gamba|langostino': [99, 21, 0, 1.1], 'sardina': [208, 25, 0, 11], 'lubina': [97, 18, 0, 2.5], 'dorada': [100, 20, 0, 2],
  'pescado blanco': [85, 17, 0, 1.5], 'calamar': [92, 16, 3, 1.4], 'mejillon': [86, 12, 3.7, 2.2], 'trucha': [119, 20, 0, 3.5],
  // huevos y lácteos
  'huevo': [143, 12.6, 0.7, 9.5], 'clara de huevo|clara': [52, 11, 0.7, 0.2], 'yema de huevo|yema': [322, 16, 3.6, 27], 'leche|leche entera': [61, 3.3, 4.7, 3.3],
  'leche semidesnatada': [47, 3.3, 4.8, 1.6], 'leche desnatada': [35, 3.4, 5, 0.1], 'yogur|yogur natural': [61, 3.5, 4.7, 3.3], 'yogur desnatado': [40, 4, 5.5, 0.2],
  'yogur griego': [97, 9, 4, 5], 'queso fresco': [98, 11, 3, 4.5], 'queso batido': [45, 8, 4, 0.2], 'queso curado|queso manchego': [395, 25, 0.8, 32], 'queso': [330, 22, 1.5, 26],
  'mozzarella': [280, 18, 2.5, 22], 'queso rallado': [350, 25, 2, 27], 'mantequilla': [717, 0.8, 0, 81], 'nata': [345, 2.1, 3, 36], 'nata cocinar': [195, 2.5, 3.5, 19],
  'requeson': [98, 11, 3.4, 4.3], 'leche de coco': [197, 2, 3, 21], 'leche de almendras|bebida de almendras': [24, 0.7, 3, 1.1], 'bebida de soja|leche de soja': [33, 2.9, 1.8, 1.6],
  'bebida de avena|leche de avena': [46, 1, 8, 1.5], 'leche condensada': [321, 8, 54, 9],
  // cereales, pan y legumbres
  'arroz': [350, 7, 78, 0.6], 'arroz cocido': [130, 2.7, 28, 0.3], 'pasta|espagueti|macarron|fideo|tallarin|penne': [355, 12, 72, 1.5], 'pasta cocido|espagueti cocido|macarron cocido': [158, 5.8, 31, 0.9],
  'pan': [265, 9, 49, 3.2], 'pan integral': [250, 9, 43, 3.5], 'pan de molde': [270, 8, 49, 4], 'harina|harina de trigo': [364, 10, 76, 1], 'avena|copos de avena': [372, 13, 60, 7],
  'quinoa': [368, 14, 64, 6], 'quinoa cocido': [120, 4.4, 21, 1.9], 'cuscus': [376, 13, 77, 0.6], 'cuscus cocido': [112, 3.8, 23, 0.2], 'lenteja': [336, 24, 60, 1.5],
  'lenteja cocido': [116, 9, 20, 0.4], 'garbanzo': [364, 19, 61, 6], 'garbanzo cocido': [164, 8.9, 27, 2.6], 'alubia|judia blanca': [333, 23, 60, 0.9],
  'alubia cocido|judia blanca cocido': [127, 8.7, 23, 0.5], 'tortilla de trigo|wrap': [300, 8, 50, 7], 'galletas maria|galleta': [420, 7, 74, 10],
  // frutos secos y semillas
  'almendra': [579, 21, 22, 50], 'nuez': [654, 15, 14, 65], 'cacahuete': [567, 26, 16, 49], 'avellana': [628, 15, 17, 61], 'pistacho': [560, 20, 28, 45],
  'anacardo': [553, 18, 30, 44], 'semillas de chia|chia': [486, 17, 42, 31], 'semillas de lino|linaza': [534, 18, 29, 42], 'mantequilla de cacahuete': [588, 25, 20, 50],
  // grasas, salsas y otros
  'aceite de oliva|aceite': [900, 0, 0, 100], 'aceite de girasol': [900, 0, 0, 100], 'mayonesa': [680, 1, 1, 75], 'azucar': [400, 0, 100, 0], 'miel': [304, 0.3, 82, 0],
  'chocolate negro': [546, 5, 60, 31], 'cacao en polvo|cacao': [228, 20, 58, 14], 'sal|agua': [0, 0, 0, 0], 'vinagre': [20, 0, 0.6, 0], 'salsa de soja': [53, 8, 5, 0],
  'mostaza': [66, 4, 6, 4], 'ketchup': [112, 1.7, 26, 0.1], 'caldo de pollo': [10, 0.5, 1, 0.3], 'caldo de verduras|caldo de verdura': [8, 0.3, 1.2, 0.2],
  'caldo de carne': [12, 1, 1, 0.4], 'tofu': [76, 8, 1.9, 4.8], 'seitan': [120, 25, 4, 1.5], 'tempeh': [192, 20, 8, 11], 'hummus': [177, 8, 14, 9.6],
  'proteina en polvo|whey|proteina whey': [400, 80, 8, 6], 'pimenton': [282, 14, 54, 13],
};

const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'a', 'al', 'en', 'y', 'o', 'para', 'un', 'una', 'u', 'sin']);
// Palabras que describen pero no cambian el alimento: no cuentan para decidir si la coincidencia es buena.
const SOFT = new Set(['fresco', 'natural', 'ecologico', 'bio', 'grande', 'pequeno', 'mediano', 'virgen', 'extra', 'parte', 'troceado', 'picado', 'rallado', 'congelado', 'envasado', 'blanco', 'entero', 'casero']);

export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const clean = (s) => norm(s).replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9ñ ]+/g, ' ');
const tokens = (s) => clean(s).split(/\s+/).filter((w) => w && !STOP.has(w)).map((w) => w.replace(/(cocid|hervid|crud|asad|frit)[oa]s?$/, '$1o'));
// "zanahorias" = "zanahoria", "champiñones" = "champiñon"
const same = (nameTok, keyTok) => nameTok === keyTok || nameTok === keyTok + 's' || nameTok === keyTok + 'es';

const ENTRIES = [];
for (const [names, [kcal, p, c, f]] of Object.entries(RAW)) {
  for (const n of names.split('|')) ENTRIES.push({ key: n, toks: tokens(n), v: { kcal100: kcal, p100: p, c100: c, f100: f } });
}

/** Busca un ingrediente en la tabla. Devuelve { kcal100, p100, c100, f100, key } o null si no hay una coincidencia fiable. */
export function lookupFood(name) {
  const nt = tokens(name);
  if (!nt.length) return null;
  let best = null;
  for (const e of ENTRIES) {
    if (!e.toks.length || !e.toks.every((k) => nt.some((w) => same(w, k)))) continue;
    if (!best || e.toks.length > best.toks.length) best = e;
  }
  if (!best) return null;
  const meaningful = nt.filter((w) => !SOFT.has(w));
  if (best.toks.length / Math.max(1, meaningful.length) < 0.5) return null; // el nombre trae demasiado que la tabla no conoce
  return { ...best.v, key: best.key };
}

/** Palabras de lo que se escribe en el buscador (sin las de relleno ni las de una sola letra). */
export const queryTokens = (query) => tokens(query).filter((w) => w.length >= 2);

/**
 * ¿Encaja `text` con lo escrito? Cada palabra buscada debe ser el principio de alguna palabra del texto (así «pech» encuentra «pechuga»)
 * o su plural. Devuelve null si no encaja, o un número (menor = mejor: menos palabras sobrantes en el texto).
 */
export function matchScore(qt, text) {
  const et = tokens(text);
  if (!qt.length || !et.length) return null;
  if (!qt.every((q) => et.some((w) => w.startsWith(q) || same(q, w)))) return null;
  return et.length - qt.length + (qt.every((q) => et.some((w) => w === q || same(q, w))) ? 0 : 0.5);
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// La tabla se guarda sin tildes (para comparar); al enseñar el nombre se las devolvemos a las palabras que las llevan.
const ACCENT = { arandano: 'arándano', atun: 'atún', azucar: 'azúcar', brocoli: 'brócoli', calabacin: 'calabacín', champinon: 'champiñón', cuscus: 'cuscús', datil: 'dátil', esparrago: 'espárrago', espagueti: 'espagueti', jamon: 'jamón', limon: 'limón', maiz: 'maíz', macarron: 'macarrón', mejillon: 'mejillón', melocoton: 'melocotón', melon: 'melón', oregano: 'orégano', pimenton: 'pimentón', pina: 'piña', platano: 'plátano', proteina: 'proteína', rabano: 'rábano', requeson: 'requesón', salmon: 'salmón', sandia: 'sandía', tallarin: 'tallarín', freson: 'fresón', brecol: 'brécol', maria: 'maría', lino: 'lino', nuez: 'nuez' };
const pretty = (name) => cap(name.split(' ').map((w) => ACCENT[w] || w).join(' '));

/** Busca en la tabla propia por lo que se escribe en el buscador. Devuelve [{ name, kcal100, p100, c100, f100, src: 'db' }], lo más parecido primero. */
export function searchTable(query, limit = 8) {
  const qt = queryTokens(query);
  if (!qt.length) return [];
  const found = [];
  for (const [names, [kcal, p, c, f]] of Object.entries(RAW)) {
    const list = names.split('|');
    let best = null;
    for (const n of list) {
      const sc = matchScore(qt, n);
      if (sc !== null && (!best || sc < best.sc)) best = { sc, n };
    }
    if (best) found.push({ sc: best.sc, name: pretty(best.n), kcal100: kcal, p100: p, c100: c, f100: f, src: 'db' });
  }
  return found.sort((a, b) => a.sc - b.sc || a.name.length - b.name.length).slice(0, limit).map(({ sc: _s, ...r }) => r);
}
