// Copia SOLO los archivos de la web a la carpeta www/ (lo que se mete dentro de la APK).
// No entran: pruebas (_test), SQL y funciones de Supabase, guías, el proyecto Android ni node_modules.
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');
const ENTRIES = ['index.html', 'manifest.webmanifest', 'privacidad.html', 'terminos.html', 'css', 'js', 'icons', 'vendor'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const e of ENTRIES) {
  const from = join(root, e);
  if (!existsSync(from)) throw new Error(`Falta ${e} en la raíz del repositorio`);
  cpSync(from, join(out, e), { recursive: true });
}

// Dentro de la APK, Android debe encargarse de las barras del sistema (hora/batería arriba, gestos abajo) y dejar la web
// entre ellas, como en la web instalada. Sin «viewport-fit=cover» lo hace Capacitor por su cuenta.
const indexPath = join(out, 'index.html');
const before = readFileSync(indexPath, 'utf8');
const after = before.replace(/,\s*viewport-fit=cover/, '');
if (after === before) throw new Error('No encuentro «viewport-fit=cover» en index.html: revisa scripts/prepare-www.mjs');
writeFileSync(indexPath, after);
console.log('www/ listo con:', ENTRIES.join(', '));
