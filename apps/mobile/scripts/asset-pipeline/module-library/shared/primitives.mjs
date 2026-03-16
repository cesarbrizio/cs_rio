import { ellipse, group, line, pathTag, polygon, rect, svgDocument } from '../../utils/svg.mjs';

const DEFAULT_STROKE = '#2f241f';

function diamondPoints(cx, cy, width, depth) {
  return [
    `${cx},${cy - depth / 2}`,
    `${cx + width / 2},${cy}`,
    `${cx},${cy + depth / 2}`,
    `${cx - width / 2},${cy}`,
  ].join(' ');
}

export function isoPrism({
  cx,
  cy,
  width,
  depth,
  height,
  topFill,
  leftFill,
  rightFill,
  stroke = DEFAULT_STROKE,
  strokeWidth = 1.8,
}) {
  const topFront = [cx, cy - height];
  const topRight = [cx + width / 2, cy - height + depth / 2];
  const topBack = [cx, cy - height + depth];
  const topLeft = [cx - width / 2, cy - height + depth / 2];

  const baseFront = [cx, cy];
  const baseRight = [cx + width / 2, cy + depth / 2];
  const baseBack = [cx, cy + depth];
  const baseLeft = [cx - width / 2, cy + depth / 2];

  return group(
    [
      polygon(
        [topFront, topRight, topBack, topLeft].map(([x, y]) => `${x},${y}`).join(' '),
        { fill: topFill, stroke, 'stroke-width': strokeWidth, 'stroke-linejoin': 'round' },
      ),
      polygon(
        [topLeft, topBack, baseBack, baseLeft].map(([x, y]) => `${x},${y}`).join(' '),
        { fill: leftFill, stroke, 'stroke-width': strokeWidth, 'stroke-linejoin': 'round' },
      ),
      polygon(
        [topFront, topRight, baseRight, baseFront].map(([x, y]) => `${x},${y}`).join(' '),
        { fill: rightFill, stroke, 'stroke-width': strokeWidth, 'stroke-linejoin': 'round' },
      ),
    ].join(''),
  );
}

export function faceWindow({
  x,
  y,
  width,
  height,
  tilt = 'right',
  fill = '#8ac3dc',
  stroke = DEFAULT_STROKE,
}) {
  const skew = tilt === 'left' ? -4 : 4;
  const points = [
    `${x},${y}`,
    `${x + width},${y + skew}`,
    `${x + width},${y + height + skew}`,
    `${x},${y + height}`,
  ].join(' ');
  return polygon(points, { fill, stroke, 'stroke-width': 1.1, 'stroke-linejoin': 'round' });
}

export function rooftopSlab({ x, y, width = 26, depth = 12, fill = '#d7d0c7', stroke = DEFAULT_STROKE }) {
  return polygon(diamondPoints(x, y, width, depth), {
    fill,
    stroke,
    'stroke-width': 1.4,
    'stroke-linejoin': 'round',
  });
}

export function corrugatedRoof({ x, y, width = 34, depth = 16, fill = '#8a7869', stroke = DEFAULT_STROKE }) {
  const roof = rooftopSlab({ x, y, width, depth, fill, stroke });
  const ribs = [
    line(x - width / 4, y - depth / 6, x - width / 10, y + depth / 8, { stroke: '#65564b', 'stroke-width': 1 }),
    line(x - width / 12, y - depth / 4, x + width / 14, y + depth / 10, { stroke: '#65564b', 'stroke-width': 1 }),
    line(x + width / 6, y - depth / 5, x + width / 3.4, y + depth / 7, { stroke: '#65564b', 'stroke-width': 1 }),
  ].join('');
  return group(`${roof}${ribs}`);
}

export function waterTank({ x, y, fill = '#3f6790', stroke = DEFAULT_STROKE }) {
  return group(
    [
      ellipse(x, y + 8, 10, 4.5, { fill: '#314b67', opacity: 0.28 }),
      rect(x - 7, y - 6, 14, 11, { fill, stroke, 'stroke-width': 1.3, rx: 2 }),
      ellipse(x, y - 6, 7, 2.2, { fill: '#6a97be', stroke, 'stroke-width': 1 }),
    ].join(''),
  );
}

export function externalPipe({ x, y, height = 24, stroke = '#74655a' }) {
  return group(
    [
      line(x, y, x, y + height, { stroke, 'stroke-width': 2.2, 'stroke-linecap': 'round' }),
      line(x, y + 2, x + 6, y, { stroke, 'stroke-width': 2.2, 'stroke-linecap': 'round' }),
      line(x, y + height - 3, x + 5, y + height + 2, { stroke, 'stroke-width': 2.2, 'stroke-linecap': 'round' }),
    ].join(''),
  );
}

export function awning({ x, y, width = 24, fill = '#567362', stroke = DEFAULT_STROKE }) {
  return group(
    [
      polygon(`${x},${y} ${x + width},${y + 4} ${x + width - 3},${y + 12} ${x - 3},${y + 8}`, {
        fill,
        stroke,
        'stroke-width': 1.2,
        'stroke-linejoin': 'round',
      }),
      line(x + 3, y + 2, x, y + 9, { stroke: '#3f5144', 'stroke-width': 1 }),
      line(x + width / 2, y + 4, x + width / 2 - 2, y + 11, { stroke: '#3f5144', 'stroke-width': 1 }),
    ].join(''),
  );
}

export function stair({ x, y, steps = 5, fill = '#78685d', stroke = DEFAULT_STROKE }) {
  let content = '';
  for (let index = 0; index < steps; index += 1) {
    content += polygon(
      `${x + index * 5},${y + index * 4} ${x + index * 5 + 8},${y + index * 4 + 2} ${x + index * 5 + 8},${y + index * 4 + 7} ${x + index * 5},${y + index * 4 + 5}`,
      { fill, stroke, 'stroke-width': 1.1, 'stroke-linejoin': 'round' },
    );
  }
  return group(content);
}

export function acUnit({ x, y, fill = '#a3a7ad', stroke = DEFAULT_STROKE }) {
  return group(
    [
      rect(x, y, 12, 8, { fill, stroke, 'stroke-width': 1.1, rx: 1.5 }),
      circleFan(x + 4, y + 4, 2.3, '#6d737b'),
      line(x + 12, y + 4, x + 16, y + 7, { stroke: '#60574f', 'stroke-width': 1.2 }),
    ].join(''),
  );
}

function circleFan(cx, cy, radius, fill) {
  return [
    ellipse(cx, cy, radius, radius, { fill }),
    line(cx - radius, cy, cx + radius, cy, { stroke: '#bfc2c6', 'stroke-width': 0.8 }),
    line(cx, cy - radius, cx, cy + radius, { stroke: '#bfc2c6', 'stroke-width': 0.8 }),
  ].join('');
}

export function sideWall({ x, y, width = 26, height = 38, fill = '#796d63', stroke = DEFAULT_STROKE }) {
  return polygon(`${x},${y} ${x + width},${y + 8} ${x + width},${y + height} ${x},${y + height - 8}`, {
    fill,
    stroke,
    'stroke-width': 1.4,
    'stroke-linejoin': 'round',
  });
}

export function crowdMass({ x, y, width = 42, fill = '#342824' }) {
  return group(
    [
      ellipse(x, y + 8, width / 2 + 6, 10, { fill: '#251c18', opacity: 0.22 }),
      ellipse(x - 10, y, 10, 7, { fill }),
      ellipse(x + 2, y - 4, 11, 8, { fill: '#3a2e29' }),
      ellipse(x + 15, y + 1, 9, 6, { fill: '#2c231f' }),
      ellipse(x - 20, y + 3, 7, 5, { fill: '#4a3a32' }),
    ].join(''),
  );
}

export function stageDeck({ x, y, width = 40, fill = '#584845', stroke = DEFAULT_STROKE }) {
  return group(
    [
      polygon(`${x},${y} ${x + width},${y + 8} ${x + width - 2},${y + 22} ${x - 2},${y + 14}`, {
        fill,
        stroke,
        'stroke-width': 1.5,
        'stroke-linejoin': 'round',
      }),
      rect(x + 4, y + 4, width - 8, 4, { fill: '#8a7669', opacity: 0.5 }),
    ].join(''),
  );
}

export function truss({ x, y, width = 42, height = 24, stroke = '#4c4749' }) {
  return group(
    [
      rect(x, y, 4, height, { fill: '#665f61', stroke, 'stroke-width': 1 }),
      rect(x + width - 4, y + 8, 4, height - 8, { fill: '#665f61', stroke, 'stroke-width': 1 }),
      line(x + 2, y, x + width - 2, y + 8, { stroke, 'stroke-width': 1.2 }),
      line(x + 2, y + height, x + width - 2, y + height, { stroke, 'stroke-width': 1.2 }),
      line(x + 2, y + 10, x + width - 2, y + 18, { stroke, 'stroke-width': 1.1 }),
    ].join(''),
  );
}

export function speakerStack({ x, y, fill = '#2a2527', stroke = DEFAULT_STROKE }) {
  return group(
    [
      rect(x, y, 14, 22, { fill, stroke, 'stroke-width': 1.2, rx: 1.5 }),
      rect(x + 1.5, y + 1.5, 11, 8, { fill: '#40373a', stroke: '#61585b', 'stroke-width': 0.8, rx: 1 }),
      rect(x + 1.5, y + 12, 11, 8, { fill: '#40373a', stroke: '#61585b', 'stroke-width': 0.8, rx: 1 }),
      ellipse(x + 7, y + 5.5, 2.6, 2.2, { fill: '#6f6567' }),
      ellipse(x + 7, y + 16, 3.2, 2.8, { fill: '#6f6567' }),
    ].join(''),
  );
}

export function streetSegment({ x, y, width = 64, depth = 28, fill = '#575351', stroke = DEFAULT_STROKE }) {
  return group(
    [
      polygon(diamondPoints(x, y, width, depth), {
        fill,
        stroke,
        'stroke-width': 1.4,
        'stroke-linejoin': 'round',
      }),
      line(x - width / 5, y - depth / 7, x + width / 4, y + depth / 10, {
        stroke: '#9a948c',
        'stroke-width': 1,
        opacity: 0.7,
      }),
    ].join(''),
  );
}

export function pole({ x, y, height = 34, stroke = '#5f554e' }) {
  return group(
    [
      line(x, y, x, y - height, { stroke, 'stroke-width': 2.4, 'stroke-linecap': 'round' }),
      line(x - 3, y - height + 6, x + 8, y - height + 4, { stroke, 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
    ].join(''),
  );
}

export function wires({ x1, y1, x2, y2, stroke = '#4f4a4a' }) {
  return pathTag(`M ${x1} ${y1} C ${(x1 + x2) / 2 - 8} ${y1 + 6}, ${(x1 + x2) / 2 + 8} ${y2 + 6}, ${x2} ${y2}`, {
    stroke,
    'stroke-width': 1.1,
    fill: 'none',
    'stroke-linecap': 'round',
  });
}

export function tent({ x, y, fill = '#756f77', stroke = DEFAULT_STROKE }) {
  return group(
    [
      polygon(`${x},${y} ${x + 22},${y + 5} ${x + 10},${y + 16}`, {
        fill,
        stroke,
        'stroke-width': 1.2,
        'stroke-linejoin': 'round',
      }),
      line(x + 5, y + 16, x + 5, y + 26, { stroke: '#605558', 'stroke-width': 1.2 }),
      line(x + 17, y + 19, x + 17, y + 28, { stroke: '#605558', 'stroke-width': 1.2 }),
    ].join(''),
  );
}

export function createModuleDefinition({
  id,
  family,
  tags,
  description,
  footprint,
  anchor,
  fragment,
  viewBox = '0 0 192 160',
  slots = [],
  variants = {},
}) {
  return {
    id,
    family,
    tags,
    description,
    footprint,
    anchor,
    viewBox,
    slots,
    variants,
    fragment,
    previewSvg: svgDocument({
      viewBox,
      content: group(fragment, { id: `${id}-module` }),
    }),
  };
}

export { line, polygon, rect };
