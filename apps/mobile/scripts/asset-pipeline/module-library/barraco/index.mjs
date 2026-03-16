import {
  createModuleDefinition,
  isoPrism,
  corrugatedRoof,
  awning,
  stair,
  externalPipe,
  waterTank,
} from '../shared/primitives.mjs';

function barracoUnit() {
  return [
    isoPrism({
      cx: 92,
      cy: 116,
      width: 48,
      depth: 18,
      height: 26,
      topFill: '#c5b59f',
      leftFill: '#7a6558',
      rightFill: '#8a7466',
    }),
    corrugatedRoof({ x: 92, y: 88, width: 48, depth: 18 }),
    awning({ x: 78, y: 100, width: 18 }),
  ].join('');
}

function barracoStacked() {
  return [
    isoPrism({
      cx: 86,
      cy: 118,
      width: 42,
      depth: 18,
      height: 22,
      topFill: '#baa694',
      leftFill: '#725e52',
      rightFill: '#816c60',
    }),
    isoPrism({
      cx: 108,
      cy: 98,
      width: 32,
      depth: 14,
      height: 22,
      topFill: '#d5c3b4',
      leftFill: '#886f61',
      rightFill: '#997d6d',
    }),
    corrugatedRoof({ x: 108, y: 74, width: 30, depth: 12 }),
    stair({ x: 62, y: 98, steps: 4 }),
  ].join('');
}

function barracoCorner() {
  return [
    isoPrism({
      cx: 92,
      cy: 114,
      width: 40,
      depth: 22,
      height: 28,
      topFill: '#c8b7a8',
      leftFill: '#776257',
      rightFill: '#8b7568',
    }),
    corrugatedRoof({ x: 92, y: 84, width: 44, depth: 16 }),
    externalPipe({ x: 110, y: 88, height: 22 }),
    waterTank({ x: 78, y: 80 }),
  ].join('');
}

function barracoRoofPatch() {
  return [
    corrugatedRoof({ x: 84, y: 102, width: 30, depth: 12 }),
    corrugatedRoof({ x: 108, y: 96, width: 24, depth: 10, fill: '#725d52' }),
    awning({ x: 98, y: 106, width: 16, fill: '#8b7d58' }),
  ].join('');
}

export const barracoModules = [
  createModuleDefinition({
    id: 'barraco-unit',
    family: 'barraco',
    tags: ['barraco', 'single', 'core'],
    description: 'Unidade base de barraco com cobertura metalica.',
    footprint: { width: 48, depth: 18 },
    anchor: { x: 92, y: 118 },
    slots: ['roof-detail', 'facade-front'],
    variants: { floors: 1 },
    fragment: barracoUnit(),
  }),
  createModuleDefinition({
    id: 'barraco-stacked',
    family: 'barraco',
    tags: ['barraco', 'stacked', 'vertical'],
    description: 'Barraco empilhado para beira de escada e encosta.',
    footprint: { width: 44, depth: 18 },
    anchor: { x: 92, y: 118 },
    slots: ['circulation', 'roof-detail'],
    variants: { floors: 2 },
    fragment: barracoStacked(),
  }),
  createModuleDefinition({
    id: 'barraco-corner',
    family: 'barraco',
    tags: ['barraco', 'corner', 'service'],
    description: 'Barraco de esquina com utilitarios aparentes.',
    footprint: { width: 40, depth: 22 },
    anchor: { x: 92, y: 116 },
    slots: ['utility-top', 'utility-side'],
    variants: { corner: true },
    fragment: barracoCorner(),
  }),
  createModuleDefinition({
    id: 'barraco-roof-patch',
    family: 'barraco',
    tags: ['barraco', 'roofline', 'detail'],
    description: 'Conjunto de remendos e coberturas para quebra de silhueta.',
    footprint: { width: 34, depth: 14 },
    anchor: { x: 96, y: 112 },
    slots: ['roof-detail'],
    variants: { patchwork: true },
    fragment: barracoRoofPatch(),
  }),
];
