import {
  awning,
  corrugatedRoof,
  createModuleDefinition,
  externalPipe,
  faceWindow,
  isoPrism,
  line,
  polygon,
  rect,
  rooftopSlab,
  sideWall,
  stair,
  waterTank,
} from '../shared/primitives.mjs';

function windowGrid({
  startX,
  startY,
  cols,
  rows,
  gapX = 4,
  gapY = 5,
  width = 8,
  height = 8,
  tilt = 'right',
  fill = '#8fc8df',
}) {
  const fragments = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      fragments.push(
        faceWindow({
          x: startX + col * (width + gapX),
          y: startY + row * (height + gapY),
          width,
          height,
          tilt,
          fill,
        }),
      );
    }
  }
  return fragments.join('');
}

function bocaCore() {
  return [
    isoPrism({
      cx: 94,
      cy: 118,
      width: 44,
      depth: 18,
      height: 28,
      topFill: '#bfa287',
      leftFill: '#6a4b37',
      rightFill: '#7c5a42',
    }),
    isoPrism({
      cx: 102,
      cy: 92,
      width: 32,
      depth: 14,
      height: 18,
      topFill: '#d0b9a4',
      leftFill: '#7a5b47',
      rightFill: '#8d6c57',
    }),
    awning({ x: 74, y: 99, width: 30, fill: '#4d6158' }),
    rect(86, 94, 18, 22, { fill: '#201815', rx: 1.5 }),
    rect(90, 97, 5, 14, { fill: '#dca145', rx: 1 }),
    rect(98, 97, 5, 14, { fill: '#dca145', rx: 1 }),
    faceWindow({ x: 74, y: 103, width: 8, height: 7, tilt: 'left', fill: '#739db0' }),
    faceWindow({ x: 108, y: 89, width: 8, height: 8, tilt: 'right', fill: '#84b3c8' }),
    corrugatedRoof({ x: 101, y: 74, width: 22, depth: 9, fill: '#726156' }),
    waterTank({ x: 86, y: 77, fill: '#45698d' }),
    externalPipe({ x: 76, y: 94, height: 24, stroke: '#63564d' }),
  ].join('');
}

function bocaGuardedEntry() {
  return [
    isoPrism({
      cx: 94,
      cy: 122,
      width: 28,
      depth: 16,
      height: 20,
      topFill: '#b08968',
      leftFill: '#614633',
      rightFill: '#735441',
    }),
    rect(88, 102, 16, 18, { fill: '#181312', rx: 1.5 }),
    awning({ x: 82, y: 97, width: 20, fill: '#6f5a3c' }),
    rect(80, 111, 6, 10, { fill: '#2a201c', rx: 1 }),
    rect(106, 111, 6, 10, { fill: '#2a201c', rx: 1 }),
    line(83, 100, 83, 88, { stroke: '#5f554e', 'stroke-width': 2 }),
    line(107, 103, 114, 92, { stroke: '#5f554e', 'stroke-width': 2 }),
  ].join('');
}

function marketCore() {
  return [
    isoPrism({
      cx: 92,
      cy: 122,
      width: 52,
      depth: 20,
      height: 18,
      topFill: '#c6b4a3',
      leftFill: '#726256',
      rightFill: '#87756a',
    }),
    awning({ x: 63, y: 101, width: 26, fill: '#5a6d61' }),
    awning({ x: 87, y: 103, width: 22, fill: '#767062' }),
    awning({ x: 106, y: 107, width: 22, fill: '#904b57' }),
    rect(70, 108, 40, 10, { fill: '#2d2520', rx: 1.5 }),
    faceWindow({ x: 116, y: 108, width: 8, height: 7, tilt: 'right', fill: '#87b4c9' }),
  ].join('');
}

function marketStallRow() {
  return [
    rooftopSlab({ x: 76, y: 109, width: 20, depth: 8, fill: '#ded6ca' }),
    rooftopSlab({ x: 94, y: 112, width: 18, depth: 8, fill: '#c05c61' }),
    rooftopSlab({ x: 111, y: 115, width: 18, depth: 8, fill: '#d6bf96' }),
    rect(72, 113, 10, 7, { fill: '#47382f', rx: 1 }),
    rect(90, 116, 10, 7, { fill: '#47382f', rx: 1 }),
    rect(108, 119, 10, 7, { fill: '#47382f', rx: 1 }),
  ].join('');
}

function gymCore() {
  return [
    isoPrism({
      cx: 94,
      cy: 122,
      width: 56,
      depth: 20,
      height: 22,
      topFill: '#b9a17b',
      leftFill: '#69543b',
      rightFill: '#806746',
    }),
    rect(66, 99, 46, 10, { fill: '#30251d', rx: 2 }),
    rect(72, 101, 34, 5, { fill: '#e4b84e', rx: 1.5 }),
    rect(84, 108, 16, 16, { fill: '#241b15', rx: 1.5 }),
    rect(69, 111, 10, 8, { fill: '#8d7456', rx: 1 }),
    rect(104, 111, 10, 8, { fill: '#8d7456', rx: 1 }),
  ].join('');
}

function gymSign() {
  return [
    rect(78, 96, 28, 8, { fill: '#e4b84e', rx: 2 }),
    line(82, 100, 102, 100, { stroke: '#4a3524', 'stroke-width': 2 }),
    rect(86, 103, 4, 12, { fill: '#4a3524', rx: 1 }),
    rect(94, 103, 4, 12, { fill: '#4a3524', rx: 1 }),
  ].join('');
}

function hospitalCore() {
  return [
    isoPrism({
      cx: 92,
      cy: 118,
      width: 62,
      depth: 24,
      height: 28,
      topFill: '#d7dde3',
      leftFill: '#81909d',
      rightFill: '#97a5b2',
    }),
    isoPrism({
      cx: 116,
      cy: 106,
      width: 26,
      depth: 14,
      height: 18,
      topFill: '#e4eaef',
      leftFill: '#97a5b2',
      rightFill: '#abb8c2',
    }),
    windowGrid({ startX: 70, startY: 94, cols: 3, rows: 2, width: 10, height: 8, gapX: 6, gapY: 6, fill: '#98cde3' }),
    rect(86, 102, 14, 20, { fill: '#f3f5f7', rx: 1.5 }),
    rect(80, 109, 26, 8, { fill: '#f3f5f7', rx: 1.5 }),
  ].join('');
}

function hospitalEntry() {
  return [
    awning({ x: 82, y: 104, width: 24, fill: '#d8e4eb' }),
    rect(89, 108, 10, 14, { fill: '#d8edf8', rx: 1 }),
    line(94, 108, 94, 122, { stroke: '#87a8bb', 'stroke-width': 1.2 }),
    rect(116, 91, 10, 10, { fill: '#ffffff', rx: 1 }),
    rect(119, 88, 4, 16, { fill: '#ffffff', rx: 1 }),
  ].join('');
}

function prisonCore() {
  return [
    isoPrism({
      cx: 94,
      cy: 120,
      width: 58,
      depth: 24,
      height: 24,
      topFill: '#c6ccd3',
      leftFill: '#68727d',
      rightFill: '#7c8791',
    }),
    rect(78, 102, 20, 20, { fill: '#293038', rx: 1 }),
    line(82, 102, 82, 122, { stroke: '#78838d', 'stroke-width': 1.2 }),
    line(88, 102, 88, 122, { stroke: '#78838d', 'stroke-width': 1.2 }),
    line(94, 102, 94, 122, { stroke: '#78838d', 'stroke-width': 1.2 }),
    line(100, 102, 100, 122, { stroke: '#78838d', 'stroke-width': 1.2 }),
    rect(68, 96, 52, 6, { fill: '#343b42', rx: 1 }),
  ].join('');
}

function prisonWall() {
  return [
    polygon('58,104 120,130 120,138 58,112', { fill: '#7c858f', stroke: '#283038', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }),
    line(64, 106, 64, 118, { stroke: '#3a434b', 'stroke-width': 2 }),
    line(76, 111, 76, 123, { stroke: '#3a434b', 'stroke-width': 2 }),
    line(88, 116, 88, 128, { stroke: '#3a434b', 'stroke-width': 2 }),
    line(100, 121, 100, 133, { stroke: '#3a434b', 'stroke-width': 2 }),
    line(112, 126, 112, 138, { stroke: '#3a434b', 'stroke-width': 2 }),
  ].join('');
}

function guardTower() {
  return [
    isoPrism({
      cx: 118,
      cy: 108,
      width: 16,
      depth: 10,
      height: 28,
      topFill: '#d1d7dc',
      leftFill: '#7a848d',
      rightFill: '#8d98a0',
    }),
    rect(112, 83, 14, 6, { fill: '#3b4247', rx: 1 }),
  ].join('');
}

function universityCore() {
  return [
    isoPrism({
      cx: 92,
      cy: 118,
      width: 60,
      depth: 24,
      height: 24,
      topFill: '#d4d6cf',
      leftFill: '#818175',
      rightFill: '#97978b',
    }),
    windowGrid({ startX: 68, startY: 97, cols: 3, rows: 2, width: 10, height: 8, gapX: 7, gapY: 6, fill: '#9ebcd0' }),
    rect(86, 104, 14, 18, { fill: '#f0ede4', rx: 1 }),
    rect(79, 88, 26, 8, { fill: '#b28f59', rx: 2 }),
  ].join('');
}

function universityWing() {
  return [
    isoPrism({
      cx: 116,
      cy: 110,
      width: 26,
      depth: 12,
      height: 16,
      topFill: '#e2e0da',
      leftFill: '#969488',
      rightFill: '#a9a79b',
    }),
    awning({ x: 102, y: 101, width: 18, fill: '#d5d0c4' }),
  ].join('');
}

function factoryHall() {
  return [
    isoPrism({
      cx: 94,
      cy: 120,
      width: 64,
      depth: 24,
      height: 24,
      topFill: '#b2bac1',
      leftFill: '#5f6770',
      rightFill: '#727b84',
    }),
    corrugatedRoof({ x: 78, y: 93, width: 24, depth: 9, fill: '#6d747a' }),
    corrugatedRoof({ x: 100, y: 98, width: 28, depth: 10, fill: '#7a8389' }),
    rect(74, 105, 18, 12, { fill: '#24303a', rx: 1 }),
    rect(96, 109, 22, 10, { fill: '#24303a', rx: 1 }),
  ].join('');
}

function factoryStack() {
  return [
    isoPrism({
      cx: 118,
      cy: 104,
      width: 12,
      depth: 8,
      height: 36,
      topFill: '#c8ced4',
      leftFill: '#656b72',
      rightFill: '#797f86',
    }),
    rect(124, 66, 4, 22, { fill: '#8b9298', rx: 1 }),
    rect(121, 60, 10, 8, { fill: '#565d63', rx: 1 }),
  ].join('');
}

function dockWarehouse() {
  return [
    isoPrism({
      cx: 94,
      cy: 120,
      width: 66,
      depth: 24,
      height: 22,
      topFill: '#aebcc8',
      leftFill: '#5e7384',
      rightFill: '#6c8394',
    }),
    rect(76, 108, 18, 12, { fill: '#23313b', rx: 1 }),
    rect(98, 111, 20, 10, { fill: '#23313b', rx: 1 }),
    line(68, 121, 122, 121, { stroke: '#7ec5eb', 'stroke-width': 2.2 }),
  ].join('');
}

function containerStack() {
  return [
    rect(68, 116, 18, 8, { fill: '#c36f45', rx: 1 }),
    rect(86, 120, 18, 8, { fill: '#4e7fa3', rx: 1 }),
    rect(104, 124, 18, 8, { fill: '#8c9da7', rx: 1 }),
    line(110, 109, 124, 92, { stroke: '#6f8ca1', 'stroke-width': 2 }),
    line(124, 92, 128, 94, { stroke: '#6f8ca1', 'stroke-width': 2 }),
  ].join('');
}

function junkyardShed() {
  return [
    isoPrism({
      cx: 92,
      cy: 122,
      width: 44,
      depth: 18,
      height: 18,
      topFill: '#b9aba2',
      leftFill: '#6d625c',
      rightFill: '#827770',
    }),
    corrugatedRoof({ x: 92, y: 102, width: 34, depth: 10, fill: '#7c736d' }),
    rect(78, 112, 18, 10, { fill: '#3d332d', rx: 1 }),
  ].join('');
}

function scrapPile() {
  return [
    polygon('70,118 88,111 105,118 95,126 78,126', { fill: '#8e5e49', stroke: '#40342f', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }),
    polygon('92,121 108,115 122,121 114,128 98,128', { fill: '#69747a', stroke: '#40342f', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }),
    polygon('80,127 92,122 104,127 98,133 86,133', { fill: '#a08d6a', stroke: '#40342f', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }),
  ].join('');
}

function towerSimpleCore() {
  return [
    isoPrism({
      cx: 92,
      cy: 120,
      width: 40,
      depth: 18,
      height: 54,
      topFill: '#cfc9c1',
      leftFill: '#747067',
      rightFill: '#88837b',
    }),
    windowGrid({ startX: 82, startY: 74, cols: 2, rows: 4, width: 8, height: 7, gapX: 6, gapY: 5, fill: '#ddd4c8' }),
    rect(86, 110, 12, 10, { fill: '#e6d8c8', rx: 1 }),
  ].join('');
}

function towerModernCore() {
  return [
    isoPrism({
      cx: 92,
      cy: 120,
      width: 40,
      depth: 18,
      height: 56,
      topFill: '#c7d2db',
      leftFill: '#607786',
      rightFill: '#6f8999',
    }),
    windowGrid({ startX: 82, startY: 72, cols: 2, rows: 4, width: 8, height: 7, gapX: 6, gapY: 5, fill: '#96d0ea' }),
    rect(76, 88, 32, 6, { fill: '#7fe2ff', rx: 2, opacity: 0.85 }),
    rect(86, 110, 12, 10, { fill: '#d2eef8', rx: 1 }),
  ].join('');
}

function commercialSimpleCore() {
  return [
    isoPrism({
      cx: 92,
      cy: 120,
      width: 52,
      depth: 22,
      height: 38,
      topFill: '#c4b29f',
      leftFill: '#705949',
      rightFill: '#846957',
    }),
    windowGrid({ startX: 76, startY: 88, cols: 3, rows: 2, width: 8, height: 7, gapX: 6, gapY: 5, fill: '#dbcab5' }),
    awning({ x: 72, y: 104, width: 34, fill: '#6b5a49' }),
    rect(84, 108, 18, 12, { fill: '#2e241d', rx: 1 }),
  ].join('');
}

function commercialModernCore() {
  return [
    isoPrism({
      cx: 92,
      cy: 120,
      width: 52,
      depth: 22,
      height: 40,
      topFill: '#c7d3db',
      leftFill: '#5b7585',
      rightFill: '#6c8898',
    }),
    windowGrid({ startX: 76, startY: 86, cols: 3, rows: 2, width: 8, height: 7, gapX: 6, gapY: 5, fill: '#91d5f0' }),
    rect(72, 104, 38, 8, { fill: '#e2ecef', rx: 2 }),
    rect(84, 108, 18, 12, { fill: '#d8f3fb', rx: 1 }),
  ].join('');
}

function houseSimpleCore() {
  return [
    isoPrism({
      cx: 92,
      cy: 122,
      width: 48,
      depth: 20,
      height: 22,
      topFill: '#cfba9f',
      leftFill: '#7a614c',
      rightFill: '#91745d',
    }),
    corrugatedRoof({ x: 92, y: 100, width: 38, depth: 12, fill: '#8c7259' }),
    rect(86, 108, 12, 14, { fill: '#f2eadf', rx: 1 }),
    faceWindow({ x: 72, y: 111, width: 8, height: 7, tilt: 'left', fill: '#dcc6ab' }),
    faceWindow({ x: 104, y: 110, width: 8, height: 7, tilt: 'right', fill: '#dcc6ab' }),
  ].join('');
}

function houseWealthyCore() {
  return [
    isoPrism({
      cx: 88,
      cy: 122,
      width: 48,
      depth: 20,
      height: 22,
      topFill: '#d9ddd9',
      leftFill: '#798a82',
      rightFill: '#8f9f96',
    }),
    isoPrism({
      cx: 112,
      cy: 112,
      width: 22,
      depth: 12,
      height: 18,
      topFill: '#edf1ec',
      leftFill: '#98a79f',
      rightFill: '#adbab2',
    }),
    rect(74, 108, 20, 12, { fill: '#d5eff5', rx: 1.5 }),
    rect(98, 100, 18, 12, { fill: '#d5eff5', rx: 1.5 }),
    awning({ x: 82, y: 112, width: 20, fill: '#cab795' }),
    rect(68, 122, 24, 4, { fill: '#7ea47c', rx: 2, opacity: 0.8 }),
  ].join('');
}

export const catalogModules = [
  createModuleDefinition({
    id: 'boca-core',
    family: 'boca',
    tags: ['favela', 'clandestine', 'boca'],
    description: 'Nucleo principal de frente clandestina em favela.',
    footprint: { width: 44, depth: 18 },
    anchor: { x: 94, y: 122 },
    slots: ['core'],
    variants: { role: 'core' },
    fragment: bocaCore(),
  }),
  createModuleDefinition({
    id: 'boca-guarded-entry',
    family: 'boca',
    tags: ['favela', 'entry', 'boca'],
    description: 'Entrada protegida e comprimida da boca.',
    footprint: { width: 28, depth: 16 },
    anchor: { x: 94, y: 122 },
    slots: ['entry'],
    variants: { role: 'entry' },
    fragment: bocaGuardedEntry(),
  }),
  createModuleDefinition({
    id: 'market-core',
    family: 'market-clandestino',
    tags: ['market', 'clandestine', 'core'],
    description: 'Nucleo principal do mercado clandestino.',
    footprint: { width: 52, depth: 20 },
    anchor: { x: 92, y: 122 },
    slots: ['core'],
    variants: { role: 'core' },
    fragment: marketCore(),
  }),
  createModuleDefinition({
    id: 'market-stall-row',
    family: 'market-clandestino',
    tags: ['market', 'stall', 'detail'],
    description: 'Fila de bancas e toldos do mercado clandestino.',
    footprint: { width: 50, depth: 18 },
    anchor: { x: 92, y: 122 },
    slots: ['detail'],
    variants: { role: 'stall' },
    fragment: marketStallRow(),
  }),
  createModuleDefinition({
    id: 'gym-core',
    family: 'gym',
    tags: ['gym', 'training', 'core'],
    description: 'Predio base de academia ou centro de treino.',
    footprint: { width: 56, depth: 20 },
    anchor: { x: 94, y: 122 },
    slots: ['core'],
    variants: { role: 'core' },
    fragment: gymCore(),
  }),
  createModuleDefinition({
    id: 'gym-sign',
    family: 'gym',
    tags: ['gym', 'sign', 'detail'],
    description: 'Faixa e aparelhos sugeridos para leitura de treino.',
    footprint: { width: 28, depth: 8 },
    anchor: { x: 92, y: 122 },
    slots: ['detail'],
    variants: { role: 'sign' },
    fragment: gymSign(),
  }),
  createModuleDefinition({
    id: 'hospital-core',
    family: 'hospital',
    tags: ['hospital', 'institutional', 'core'],
    description: 'Bloco principal de hospital.',
    footprint: { width: 62, depth: 24 },
    anchor: { x: 92, y: 122 },
    slots: ['core'],
    variants: { role: 'core' },
    fragment: hospitalCore(),
  }),
  createModuleDefinition({
    id: 'hospital-entry',
    family: 'hospital',
    tags: ['hospital', 'entry', 'detail'],
    description: 'Entrada e sinalização discreta do hospital.',
    footprint: { width: 26, depth: 12 },
    anchor: { x: 92, y: 122 },
    slots: ['entry'],
    variants: { role: 'entry' },
    fragment: hospitalEntry(),
  }),
  createModuleDefinition({
    id: 'prison-core',
    family: 'prison',
    tags: ['prison', 'institutional', 'core'],
    description: 'Bloco principal da prisão.',
    footprint: { width: 58, depth: 24 },
    anchor: { x: 94, y: 122 },
    slots: ['core'],
    variants: { role: 'core' },
    fragment: prisonCore(),
  }),
  createModuleDefinition({
    id: 'prison-wall',
    family: 'prison',
    tags: ['prison', 'wall', 'detail'],
    description: 'Muro perimetral da prisão.',
    footprint: { width: 62, depth: 18 },
    anchor: { x: 94, y: 122 },
    slots: ['detail'],
    variants: { role: 'wall' },
    fragment: prisonWall(),
  }),
  createModuleDefinition({
    id: 'guard-tower',
    family: 'prison',
    tags: ['prison', 'tower', 'detail'],
    description: 'Torre de vigilância.',
    footprint: { width: 16, depth: 10 },
    anchor: { x: 118, y: 122 },
    slots: ['detail'],
    variants: { role: 'tower' },
    fragment: guardTower(),
  }),
  createModuleDefinition({
    id: 'university-core',
    family: 'university',
    tags: ['university', 'institutional', 'core'],
    description: 'Bloco principal de universidade.',
    footprint: { width: 60, depth: 24 },
    anchor: { x: 92, y: 122 },
    slots: ['core'],
    variants: { role: 'core' },
    fragment: universityCore(),
  }),
  createModuleDefinition({
    id: 'university-wing',
    family: 'university',
    tags: ['university', 'wing', 'detail'],
    description: 'Ala de apoio do equipamento universitário.',
    footprint: { width: 26, depth: 12 },
    anchor: { x: 116, y: 122 },
    slots: ['detail'],
    variants: { role: 'wing' },
    fragment: universityWing(),
  }),
  createModuleDefinition({
    id: 'factory-hall',
    family: 'factory',
    tags: ['factory', 'industrial', 'core'],
    description: 'Galpão principal da fábrica.',
    footprint: { width: 64, depth: 24 },
    anchor: { x: 94, y: 122 },
    slots: ['core'],
    variants: { role: 'hall' },
    fragment: factoryHall(),
  }),
  createModuleDefinition({
    id: 'factory-stack',
    family: 'factory',
    tags: ['factory', 'industrial', 'stack'],
    description: 'Chaminé e corpo vertical da fábrica.',
    footprint: { width: 12, depth: 8 },
    anchor: { x: 118, y: 122 },
    slots: ['detail'],
    variants: { role: 'stack' },
    fragment: factoryStack(),
  }),
  createModuleDefinition({
    id: 'dock-warehouse',
    family: 'dock-industrial',
    tags: ['dock', 'industrial', 'warehouse'],
    description: 'Galpão de doca e armazenamento.',
    footprint: { width: 66, depth: 24 },
    anchor: { x: 94, y: 122 },
    slots: ['core'],
    variants: { role: 'warehouse' },
    fragment: dockWarehouse(),
  }),
  createModuleDefinition({
    id: 'container-stack',
    family: 'dock-industrial',
    tags: ['dock', 'industrial', 'container'],
    description: 'Pilha de containers e braço de carga.',
    footprint: { width: 54, depth: 18 },
    anchor: { x: 94, y: 122 },
    slots: ['detail'],
    variants: { role: 'container' },
    fragment: containerStack(),
  }),
  createModuleDefinition({
    id: 'junkyard-shed',
    family: 'junkyard',
    tags: ['junkyard', 'industrial', 'shed'],
    description: 'Galpão precário do desmanche.',
    footprint: { width: 44, depth: 18 },
    anchor: { x: 92, y: 122 },
    slots: ['core'],
    variants: { role: 'shed' },
    fragment: junkyardShed(),
  }),
  createModuleDefinition({
    id: 'scrap-pile',
    family: 'junkyard',
    tags: ['junkyard', 'scrap', 'detail'],
    description: 'Pilha de sucata para leitura imediata de ferro velho.',
    footprint: { width: 52, depth: 16 },
    anchor: { x: 94, y: 122 },
    slots: ['detail'],
    variants: { role: 'scrap' },
    fragment: scrapPile(),
  }),
  createModuleDefinition({
    id: 'tower-simple-core',
    family: 'residential-tower-simple',
    tags: ['residential', 'tower', 'simple'],
    description: 'Torre residencial simples.',
    footprint: { width: 40, depth: 18 },
    anchor: { x: 92, y: 122 },
    slots: ['core'],
    variants: { role: 'tower' },
    fragment: towerSimpleCore(),
  }),
  createModuleDefinition({
    id: 'tower-modern-core',
    family: 'residential-tower-modern',
    tags: ['residential', 'tower', 'modern'],
    description: 'Torre residencial moderna.',
    footprint: { width: 40, depth: 18 },
    anchor: { x: 92, y: 122 },
    slots: ['core'],
    variants: { role: 'tower' },
    fragment: towerModernCore(),
  }),
  createModuleDefinition({
    id: 'commercial-simple-core',
    family: 'commercial-block-simple',
    tags: ['commercial', 'block', 'simple'],
    description: 'Bloco comercial simples.',
    footprint: { width: 52, depth: 22 },
    anchor: { x: 92, y: 122 },
    slots: ['core'],
    variants: { role: 'block' },
    fragment: commercialSimpleCore(),
  }),
  createModuleDefinition({
    id: 'commercial-modern-core',
    family: 'commercial-block-modern',
    tags: ['commercial', 'block', 'modern'],
    description: 'Bloco comercial moderno.',
    footprint: { width: 52, depth: 22 },
    anchor: { x: 92, y: 122 },
    slots: ['core'],
    variants: { role: 'block' },
    fragment: commercialModernCore(),
  }),
  createModuleDefinition({
    id: 'house-simple-core',
    family: 'house-simple',
    tags: ['residential', 'house', 'simple'],
    description: 'Casa residencial simples.',
    footprint: { width: 48, depth: 20 },
    anchor: { x: 92, y: 122 },
    slots: ['core'],
    variants: { role: 'house' },
    fragment: houseSimpleCore(),
  }),
  createModuleDefinition({
    id: 'house-wealthy-core',
    family: 'house-wealthy',
    tags: ['residential', 'house', 'wealthy'],
    description: 'Casa residencial nobre.',
    footprint: { width: 52, depth: 20 },
    anchor: { x: 92, y: 122 },
    slots: ['core'],
    variants: { role: 'house' },
    fragment: houseWealthyCore(),
  }),
];
