// Uso: node sortear.js
// Lee nombres.txt, hace el sorteo, guarda el resultado cifrado en index.html
// y escribe claves.txt (nombre -> clave) para que el organizador las reparta.
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const dir = __dirname;
const nombres = fs.readFileSync(path.join(dir, 'nombres.txt'), 'utf8')
  .split(/\r?\n/).map(s => s.trim()).filter(Boolean);
if (nombres.length < 3) throw new Error('Se necesitan al menos 3 personas');

// Mezcla y arma un solo círculo: nadie se saca a sí mismo y no hay parejas que se regalen entre ellas
const orden = [...nombres];
for (let i = orden.length - 1; i > 0; i--) {
  const j = crypto.randomInt(i + 1);
  [orden[i], orden[j]] = [orden[j], orden[i]];
}

const palabras = ['ESTRELLA', 'RENO', 'PINO', 'NIEVE', 'REGALO', 'CAMPANA', 'TAMAL', 'ROMPOPE',
  'ANGEL', 'LUCES', 'TRINEO', 'BASTON', 'GALLETA', 'MUNECO', 'VELA', 'CORONA', 'ELFO', 'PORTAL'];
const usadas = new Set();
function nuevaClave() {
  let c;
  do c = palabras[crypto.randomInt(palabras.length)] + '-' + (10 + crypto.randomInt(90));
  while (usadas.has(c));
  usadas.add(c);
  return c;
}

const sha = t => crypto.createHash('sha256').update(t, 'utf8').digest();
function cifrar(clave, obj) {
  const datos = Buffer.from(JSON.stringify(obj), 'utf8');
  const out = Buffer.alloc(datos.length);
  for (let i = 0; i < datos.length; i += 32) {
    const k = sha('k|' + (i / 32) + '|' + clave);
    for (let j = 0; j < 32 && i + j < datos.length; j++) out[i + j] = datos[i + j] ^ k[j];
  }
  return out.toString('base64');
}

const e = {};
const claves = [];
orden.forEach((de, i) => {
  const para = orden[(i + 1) % orden.length];
  const clave = nuevaClave();
  e[sha('id|' + clave).toString('hex')] = cifrar(clave, { de, para });
  claves.push([de, clave]);
});
claves.sort((a, b) => nombres.indexOf(a[0]) - nombres.indexOf(b[0]));

const html = path.join(dir, 'index.html');
const pagina = fs.readFileSync(html, 'utf8')
  .replace(/\/\*DATOS\*\/.*?\/\*FIN\*\//s, '/*DATOS*/' + JSON.stringify({ e }) + '/*FIN*/');
fs.writeFileSync(html, pagina);

// Para el Worker de listas de deseos (después: cd worker && npx wrangler deploy)
const participantes = Object.fromEntries(claves.map(([n, c]) => [sha('id|' + c).toString('hex'), n]));
const dirWorker = path.join(dir, 'worker');
if (fs.existsSync(dirWorker)) fs.writeFileSync(path.join(dirWorker, 'participantes.json'), JSON.stringify(participantes, null, 1));

const texto = 'CLAVES DEL AMIGO SECRETO (dale a cada quien SOLO la suya)\n\n' +
  claves.map(([n, c]) => n.padEnd(14) + c).join('\n') + '\n';
fs.writeFileSync(path.join(dir, 'claves.txt'), texto);
console.log(texto);
