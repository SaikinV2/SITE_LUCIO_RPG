import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const sourcePath = path.join(os.tmpdir(), 'rpg-spells-source.js');
const classesPath = path.join(os.tmpdir(), 'rpg-spells-classes.js');
const outputPath = path.resolve('static/data/spells-5e.json');

const source = fs.readFileSync(sourcePath, 'utf8');
const classSource = fs.readFileSync(classesPath, 'utf8');

function decodeHtml(value) {
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    aacute: 'á', Aacute: 'Á', acirc: 'â', Acirc: 'Â', agrave: 'à',
    atilde: 'ã', Atilde: 'Ã', ccedil: 'ç', Ccedil: 'Ç',
    eacute: 'é', Eacute: 'É', ecirc: 'ê', Ecirc: 'Ê',
    iacute: 'í', Iacute: 'Í', oacute: 'ó', Oacute: 'Ó',
    ocirc: 'ô', Ocirc: 'Ô', otilde: 'õ', Otilde: 'Õ',
    uacute: 'ú', Uacute: 'Ú', ndash: '–', mdash: '—', hellip: '…'
  };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      return String.fromCodePoint(parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10));
    }
    return named[entity] ?? named[entity.toLowerCase()] ?? ('&' + entity + ';');
  });
}

function textFromHtml(html) {
  return decodeHtml(html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<\/li\s*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function slug(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const classesBySpell = new Map();
for (const match of classSource.matchAll(/spellByClass\["([^"]+)"\]\s*=\s*\[([\s\S]*?)\]/g)) {
  const className = match[1];
  for (const spell of match[2].matchAll(/"([^"]+)"/g)) {
    const key = spell[1];
    if (!classesBySpell.has(key)) classesBySpell.set(key, []);
    classesBySpell.get(key).push(className);
  }
}

const chunks = source.split(/(?=<div data-name="[^"]+" data-level=")/g).slice(1);
const spells = chunks.map(chunk => {
  const identity = chunk.match(/<div data-name="([^"]+)" data-level="(\d+)"/);
  const title = chunk.match(/<div class="name">\s*<p>([\s\S]*?)<\/p>/);
  const school = chunk.match(/<p class="school">([\s\S]*?)<\/p>/);
  const metas = [...chunk.matchAll(/<div class="meta-content">([\s\S]*?)<\/div>/g)].map(m => textFromHtml(m[1]));
  const description = chunk.match(/<div class="description">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/);
  if (!identity || !title) return null;
  const sourceKey = decodeHtml(identity[1]);
  const name = textFromHtml(title[1]);
  const schoolText = school ? textFromHtml(school[1]).replace(/\s+\d+$/, '') : '';
  return {
    id: 'catalog-' + slug(name),
    source_key: sourceKey,
    name,
    circle: Number(identity[2]),
    school: schoolText,
    casting_time: metas[0] || '',
    range: metas[1] || '',
    components: metas[2] || '',
    duration: metas[3] || '',
    description: description ? textFromHtml(description[1]) : '',
    classes: classesBySpell.get(sourceKey) || []
  };
}).filter(Boolean);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(spells, null, 2) + '\n', 'utf8');
console.log('Catálogo criado: ' + spells.length + ' magias em ' + outputPath);
