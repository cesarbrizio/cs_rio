import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.join(__dirname, '..', 'assets', 'map-structures');
const generatedDir = path.join(__dirname, '..', 'src', 'data', 'generated');
const generatedTsPath = path.join(generatedDir, 'mapStructureSvgCatalog.generated.ts');

const VIEWBOX_WIDTH = 160;
const VIEWBOX_HEIGHT = 160;

function polygon(points, fill, extra = '') {
  return `<polygon points="${points}" fill="${fill}" ${extra}/>`;
}

function rect(x, y, width, height, fill, extra = '') {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" ${extra}/>`;
}

function circle(cx, cy, r, fill, extra = '') {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
}

function pathLine(d, stroke, strokeWidth, extra = '') {
  return `<path d="${d}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none" ${extra}/>`;
}

function wrapSvg(content, defs = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}">${defs}${content}</svg>`;
}

function softShadow() {
  return `<ellipse cx="80" cy="128" rx="40" ry="16" fill="rgba(0,0,0,0.18)"/>`;
}

function isoShell({
  leftWall,
  outline,
  rightWall,
  roof,
  roofPoints = '80,26 126,50 80,72 34,50',
  leftPoints = '34,50 80,72 80,114 34,92',
  rightPoints = '126,50 80,72 80,114 126,92',
}) {
  return [
    polygon(leftPoints, leftWall),
    polygon(rightPoints, rightWall),
    polygon(roofPoints, roof),
    polygon(roofPoints, 'none', `stroke="${outline}" stroke-width="3"`),
    polygon(leftPoints, 'none', `stroke="${outline}" stroke-width="2.2"`),
    polygon(rightPoints, 'none', `stroke="${outline}" stroke-width="2.2"`),
  ].join('');
}

function buildBarraco({ roof, leftWall, rightWall, outline, detail, detailSoft, patchColor }) {
  return wrapSvg(
    [
      softShadow(),
      isoShell({
        leftWall,
        outline,
        rightWall,
        roof,
        roofPoints: '80,44 112,60 80,76 48,60',
        leftPoints: '48,60 80,76 80,102 48,86',
        rightPoints: '112,60 80,76 80,102 112,86',
      }),
      rect(62, 78, 36, 18, detail),
      rect(74, 82, 12, 14, detailSoft),
      rect(58, 82, 10, 8, patchColor),
      rect(92, 82, 10, 8, patchColor),
      pathLine('M58 72 L102 72', outline, 2),
      pathLine('M66 56 L76 48', outline, 2),
    ].join(''),
  );
}

function buildFavelaCluster({ roof, leftWall, rightWall, outline, detail, detailSoft, patchColor }) {
  return wrapSvg(
    [
      softShadow(),
      isoShell({
        leftWall,
        outline,
        rightWall,
        roof,
        roofPoints: '80,34 128,58 80,82 32,58',
        leftPoints: '32,58 80,82 80,110 32,86',
        rightPoints: '128,58 80,82 80,110 128,86',
      }),
      polygon('46,58 70,70 46,82 22,70', detailSoft, `stroke="${outline}" stroke-width="2"`),
      polygon('74,52 96,64 74,76 52,64', patchColor, `stroke="${outline}" stroke-width="2"`),
      polygon('102,58 126,70 102,82 78,70', detail, `stroke="${outline}" stroke-width="2"`),
      rect(36, 82, 22, 12, detail),
      rect(62, 84, 18, 11, detailSoft),
      rect(86, 82, 24, 12, patchColor),
      rect(112, 84, 14, 10, detailSoft),
      rect(44, 98, 18, 9, detailSoft),
      rect(68, 100, 18, 8, patchColor),
      rect(92, 98, 18, 9, detail),
      circle(50, 68, 3, '#f2d1a6'),
      circle(84, 72, 3, '#f2d1a6'),
      circle(112, 70, 3, '#f2d1a6'),
    ].join(''),
  );
}

function buildBoca({ roof, leftWall, rightWall, outline, detail, detailSoft, glow }) {
  return wrapSvg(
    [
      softShadow(),
      isoShell({
        leftWall,
        outline,
        rightWall,
        roof,
        roofPoints: '80,42 114,60 80,78 46,60',
        leftPoints: '46,60 80,78 80,104 46,86',
        rightPoints: '114,60 80,78 80,104 114,86',
      }),
      rect(58, 78, 44, 20, detail),
      rect(56, 74, 48, 8, detailSoft),
      rect(66, 84, 28, 10, '#1b1712'),
      rect(72, 86, 6, 8, glow),
      rect(82, 86, 6, 8, glow),
      rect(92, 86, 6, 8, glow),
      circle(108, 74, 5, glow),
    ].join(''),
  );
}

function buildNightlife({ roof, leftWall, rightWall, outline, detail, detailSoft, glow, variant }) {
  const accent = variant === 'rave' ? '#7ad7ff' : '#f364ff';
  return wrapSvg(
    [
      softShadow(),
      isoShell({
        leftWall,
        outline,
        rightWall,
        roof,
        roofPoints: '80,36 124,58 80,80 36,58',
        leftPoints: '36,58 80,80 80,108 36,86',
        rightPoints: '124,58 80,80 80,108 124,86',
      }),
      rect(48, 84, 64, 12, detail),
      rect(60, 70, 10, 28, detailSoft),
      rect(90, 70, 10, 28, detailSoft),
      circle(50, 68, 5, accent),
      circle(80, 58, 5, accent),
      circle(110, 68, 5, accent),
      pathLine('M48 88 L112 88', glow, 4),
      variant === 'rave'
        ? polygon('80,46 92,58 80,70 68,58', accent, `stroke="${outline}" stroke-width="2"`)
        : rect(72, 46, 16, 16, accent, `rx="3"`),
    ].join(''),
  );
}

function buildHospital({ roof, leftWall, rightWall, outline, detail, detailSoft }) {
  return wrapSvg(
    [
      softShadow(),
      isoShell({ leftWall, outline, rightWall, roof }),
      rect(50, 76, 60, 30, detail),
      rect(58, 82, 12, 10, detailSoft),
      rect(74, 82, 12, 10, detailSoft),
      rect(90, 82, 12, 10, detailSoft),
      rect(74, 66, 12, 26, '#f2f3f5'),
      rect(67, 73, 26, 12, '#f2f3f5'),
      rect(76, 98, 8, 8, '#d5e5ff'),
    ].join(''),
  );
}

function buildPrison({ roof, leftWall, rightWall, outline, detail, detailSoft }) {
  return wrapSvg(
    [
      softShadow(),
      isoShell({ leftWall, outline, rightWall, roof }),
      rect(48, 76, 64, 30, detailSoft),
      rect(56, 70, 48, 10, detail),
      rect(72, 84, 16, 22, '#2b3139'),
      ...[-14, -6, 2, 10].map((offset) => rect(80 + offset, 78, 3, 24, detail)),
      rect(110, 56, 10, 34, detail),
      rect(112, 50, 6, 10, detailSoft),
    ].join(''),
  );
}

function buildFactory({ roof, leftWall, rightWall, outline, detail, detailSoft, glow, variant }) {
  const extra = variant === 'docas'
    ? [
        rect(34, 100, 24, 10, '#4a748e'),
        rect(58, 102, 20, 8, '#c97f46'),
        rect(110, 68, 6, 26, detail),
        pathLine('M113 68 L128 56', glow, 3),
      ].join('')
    : variant === 'desmanche'
      ? [
          rect(34, 96, 24, 12, '#5a5f66'),
          rect(60, 100, 18, 8, '#8b5c46'),
          circle(44, 112, 4, '#2b2f36'),
          circle(68, 112, 4, '#2b2f36'),
        ].join('')
      : [
          rect(108, 54, 12, 42, detail),
          circle(114, 50, 7, detailSoft, `opacity="0.65"`),
          circle(120, 42, 10, detailSoft, `opacity="0.35"`),
        ].join('');

  return wrapSvg(
    [
      softShadow(),
      isoShell({
        leftWall,
        outline,
        rightWall,
        roof,
        roofPoints: '80,34 126,58 80,82 34,58',
        leftPoints: '34,58 80,82 80,112 34,88',
        rightPoints: '126,58 80,82 80,112 126,88',
      }),
      rect(50, 78, 60, 26, detail),
      rect(56, 84, 14, 10, detailSoft),
      rect(74, 84, 14, 10, detailSoft),
      rect(92, 84, 12, 10, detailSoft),
      pathLine('M48 98 L108 98', glow, 3),
      extra,
    ].join(''),
  );
}

function buildMarket({ roof, leftWall, rightWall, outline, detail, detailSoft, glow }) {
  return wrapSvg(
    [
      softShadow(),
      isoShell({
        leftWall,
        outline,
        rightWall,
        roof,
        roofPoints: '80,44 116,62 80,80 44,62',
        leftPoints: '44,62 80,80 80,104 44,86',
        rightPoints: '116,62 80,80 80,104 116,86',
      }),
      rect(50, 74, 60, 10, glow),
      rect(48, 84, 64, 16, detail),
      rect(56, 88, 14, 8, detailSoft),
      rect(74, 88, 14, 8, detailSoft),
      rect(92, 88, 12, 8, detailSoft),
      pathLine('M52 78 L108 78', '#f7d98a', 4),
    ].join(''),
  );
}

function buildTraining({ roof, leftWall, rightWall, outline, detail, detailSoft, glow }) {
  return wrapSvg(
    [
      softShadow(),
      isoShell({
        leftWall,
        outline,
        rightWall,
        roof,
        roofPoints: '80,46 112,62 80,78 48,62',
        leftPoints: '48,62 80,78 80,102 48,86',
        rightPoints: '112,62 80,78 80,102 112,86',
      }),
      rect(54, 80, 52, 18, detail),
      rect(56, 72, 48, 6, detailSoft),
      rect(58, 88, 44, 5, glow),
      circle(50, 92, 7, glow),
      circle(110, 92, 7, glow),
      rect(50, 90, 60, 4, '#3a281b'),
    ].join(''),
  );
}

function buildUniversity({ roof, leftWall, rightWall, outline, detail, detailSoft }) {
  return wrapSvg(
    [
      softShadow(),
      isoShell({ leftWall, outline, rightWall, roof }),
      polygon('80,44 102,56 80,68 58,56', detailSoft, `stroke="${outline}" stroke-width="2"`),
      rect(52, 74, 56, 28, detail),
      rect(60, 80, 8, 22, detailSoft),
      rect(74, 80, 8, 22, detailSoft),
      rect(88, 80, 8, 22, detailSoft),
      rect(74, 88, 8, 14, '#ece6d8'),
    ].join(''),
  );
}

function buildTower({ roof, leftWall, rightWall, outline, detail, detailSoft, glow, modern }) {
  return wrapSvg(
    [
      softShadow(),
      isoShell({
        leftWall,
        outline,
        rightWall,
        roof,
        roofPoints: '80,18 120,38 80,58 40,38',
        leftPoints: '40,38 80,58 80,118 40,98',
        rightPoints: '120,38 80,58 80,118 120,98',
      }),
      rect(52, 52, 56, 58, detail),
      ...[0, 1, 2, 3].flatMap((row) =>
        [0, 1, 2].map((column) =>
          rect(
            58 + column * 16,
            58 + row * 12,
            10,
            8,
            row === 3 ? detailSoft : modern ? '#8fd0ea' : '#d9d0c4',
          ),
        ),
      ),
      modern ? pathLine('M54 48 L106 48', glow, 3) : rect(72, 108, 16, 6, detailSoft),
    ].join(''),
  );
}

function buildHouse({ roof, leftWall, rightWall, outline, detail, detailSoft, glow, modern }) {
  return wrapSvg(
    [
      softShadow(),
      isoShell({
        leftWall,
        outline,
        rightWall,
        roof,
        roofPoints: '80,38 114,56 80,74 46,56',
        leftPoints: '46,56 80,74 80,102 46,84',
        rightPoints: '114,56 80,74 80,102 114,84',
      }),
      rect(56, 76, 48, 22, detail),
      rect(74, 82, 10, 16, '#f0ebe2'),
      rect(60, 82, 8, 8, detailSoft),
      rect(92, 82, 8, 8, detailSoft),
      modern ? rect(58, 70, 44, 6, glow) : pathLine('M56 74 L104 74', detailSoft, 3),
    ].join(''),
  );
}

const structures = [
  ['barraco-1', () => buildBarraco({ roof: '#a17361', leftWall: '#563c33', rightWall: '#735046', outline: '#1b120f', detail: '#2a1d18', detailSoft: '#8b6554', patchColor: '#c56f4d' })],
  ['barraco-2', () => buildBarraco({ roof: '#946959', leftWall: '#4f372f', rightWall: '#6a4a3f', outline: '#1b120f', detail: '#2a1d18', detailSoft: '#775849', patchColor: '#7a9764' })],
  ['barraco-3', () => buildBarraco({ roof: '#876152', leftWall: '#47332c', rightWall: '#5f463a', outline: '#1b120f', detail: '#291d18', detailSoft: '#6a5244', patchColor: '#5f88a0' })],
  ['barraco-4', () => buildBarraco({ roof: '#b18467', leftWall: '#5d4337', rightWall: '#7a5847', outline: '#1b120f', detail: '#291d18', detailSoft: '#907159', patchColor: '#cf9c4d' })],
  ['barraco-5', () => buildBarraco({ roof: '#9f745a', leftWall: '#583d31', rightWall: '#6f4f40', outline: '#1b120f', detail: '#271c18', detailSoft: '#8f6a4f', patchColor: '#7d7aa8' })],
  ['favela-cluster', () => buildFavelaCluster({ roof: '#8f6255', leftWall: '#4c352f', rightWall: '#68483e', outline: '#1e1411', detail: '#2a1d18', detailSoft: '#7f5b4b', patchColor: '#8a6a55' })],
  ['boca', () => buildBoca({ roof: '#9f744c', leftWall: '#4d3827', rightWall: '#6a4b34', outline: '#19120e', detail: '#211a14', detailSoft: '#8b6d4a', glow: '#d58e38' })],
  ['baile', () => buildNightlife({ roof: '#9f73b6', leftWall: '#4a3555', rightWall: '#694b7b', outline: '#1d1220', detail: '#241728', detailSoft: '#8b63a1', glow: '#d15ff1', variant: 'baile' })],
  ['rave', () => buildNightlife({ roof: '#7895c2', leftWall: '#3f4e68', rightWall: '#5d7598', outline: '#1b1421', detail: '#221b2f', detailSoft: '#668bd2', glow: '#70d7ff', variant: 'rave' })],
  ['hospital', () => buildHospital({ roof: '#96abc2', leftWall: '#556a7f', rightWall: '#7289a3', outline: '#17212c', detail: '#213040', detailSoft: '#9cb7d0' })],
  ['prison', () => buildPrison({ roof: '#97a4b2', leftWall: '#5a6673', rightWall: '#758290', outline: '#1b2128', detail: '#2a2f36', detailSoft: '#8c99a8' })],
  ['factory', () => buildFactory({ roof: '#7d8794', leftWall: '#3f454d', rightWall: '#59616c', outline: '#14181d', detail: '#182028', detailSoft: '#5b646c', glow: '#6f8ea8', variant: 'factory' })],
  ['mercado-negro', () => buildMarket({ roof: '#9b73b9', leftWall: '#4f395d', rightWall: '#694a7f', outline: '#1f1425', detail: '#281d30', detailSoft: '#806295', glow: '#b277d8' })],
  ['treino', () => buildTraining({ roof: '#9d7b56', leftWall: '#5c4630', rightWall: '#795d41', outline: '#1c140f', detail: '#271e17', detailSoft: '#87694d', glow: '#d1a042' })],
  ['universidade', () => buildUniversity({ roof: '#91a0c8', leftWall: '#57637d', rightWall: '#7383a3', outline: '#1b2232', detail: '#24314a', detailSoft: '#9aa8c7' })],
  ['docas', () => buildFactory({ roof: '#7a8fa1', leftWall: '#41515f', rightWall: '#5d7286', outline: '#182028', detail: '#1d2a34', detailSoft: '#6d8191', glow: '#72b4da', variant: 'docas' })],
  ['desmanche', () => buildFactory({ roof: '#8d7a71', leftWall: '#5f4f4a', rightWall: '#786760', outline: '#241d1b', detail: '#352d2a', detailSoft: '#9a857b', glow: '#c97f46', variant: 'desmanche' })],
  ['predio-residencial-simples-1', () => buildTower({ roof: '#a7a29a', leftWall: '#615d57', rightWall: '#7c7870', outline: '#2a2622', detail: '#3f3c37', detailSoft: '#d9d0c4', glow: '#8a847b', modern: false })],
  ['predio-residencial-simples-2', () => buildTower({ roof: '#b3aa9d', leftWall: '#6b655d', rightWall: '#877f74', outline: '#2b2723', detail: '#454038', detailSoft: '#d4cbc0', glow: '#968c7a', modern: false })],
  ['predio-residencial-moderno-1', () => buildTower({ roof: '#8cb5c3', leftWall: '#4b6c77', rightWall: '#648b98', outline: '#1e2f36', detail: '#2e4752', detailSoft: '#8fd0ea', glow: '#74d0ff', modern: true })],
  ['predio-residencial-moderno-2', () => buildTower({ roof: '#9bc3cf', leftWall: '#577682', rightWall: '#7097a2', outline: '#203138', detail: '#34505b', detailSoft: '#9fe0f3', glow: '#7fdcff', modern: true })],
  ['predio-comercial-simples-1', () => buildTower({ roof: '#b09b88', leftWall: '#6d5f52', rightWall: '#897867', outline: '#2b231c', detail: '#4e4034', detailSoft: '#dbc5af', glow: '#d3a161', modern: false })],
  ['predio-comercial-simples-2', () => buildTower({ roof: '#c1aa92', leftWall: '#775f4c', rightWall: '#95765f', outline: '#31251b', detail: '#5a4330', detailSoft: '#e4cab1', glow: '#d6aa6c', modern: false })],
  ['predio-comercial-moderno-1', () => buildTower({ roof: '#8daec7', leftWall: '#4d6779', rightWall: '#66839a', outline: '#1f2c34', detail: '#324551', detailSoft: '#90d0ec', glow: '#6ce1ff', modern: true })],
  ['predio-comercial-moderno-2', () => buildTower({ roof: '#99bacf', leftWall: '#577285', rightWall: '#7291a7', outline: '#223038', detail: '#375060', detailSoft: '#9cdcf7', glow: '#82e8ff', modern: true })],
  ['casa-residencial-simples-1', () => buildHouse({ roof: '#b98c64', leftWall: '#6c5039', rightWall: '#8a6849', outline: '#2c1f14', detail: '#4f3929', detailSoft: '#d6c0a2', glow: '#cca06a', modern: false })],
  ['casa-residencial-simples-2', () => buildHouse({ roof: '#a87a58', leftWall: '#62462f', rightWall: '#7c5a3c', outline: '#2a1c12', detail: '#473224', detailSoft: '#cfb18d', glow: '#c59156', modern: false })],
  ['casa-residencial-moderna-1', () => buildHouse({ roof: '#7d9db0', leftWall: '#47616f', rightWall: '#5f7f8f', outline: '#1f2d34', detail: '#304652', detailSoft: '#a8c9d4', glow: '#7fdcff', modern: true })],
  ['casa-residencial-moderna-2', () => buildHouse({ roof: '#8eabbc', leftWall: '#506877', rightWall: '#6b8796', outline: '#223039', detail: '#38515d', detailSoft: '#b6d5df', glow: '#90e5ff', modern: true })],
];

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(generatedDir, { recursive: true });

const generatedMap = {};

for (const [kind, builder] of structures) {
  const svg = builder();
  const filePath = path.join(outputDir, `${kind}.svg`);
  fs.writeFileSync(filePath, `${svg}\n`);
  generatedMap[kind] = svg;
}

const generatedFile = `import type { MapStructureKind } from '../mapRegionVisuals';

export const mapStructureSvgMarkupByKind: Record<MapStructureKind, string> = ${JSON.stringify(generatedMap, null, 2)} as Record<MapStructureKind, string>;
`;

fs.writeFileSync(generatedTsPath, generatedFile);

console.log(`Generated ${structures.length} map structure SVGs.`);
