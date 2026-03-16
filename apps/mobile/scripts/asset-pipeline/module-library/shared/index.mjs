import { createModuleDefinition } from './primitives.mjs';

export const sharedModules = [
  createModuleDefinition({
    id: 'anchor-shadow',
    family: 'shared',
    tags: ['shared', 'grounding'],
    description: 'Marcador tecnico opcional para ancoragem visual durante composicao.',
    footprint: { width: 26, depth: 10 },
    anchor: { x: 96, y: 122 },
    slots: ['grounding'],
    variants: { role: 'anchor' },
    fragment: '',
  }),
  createModuleDefinition({
    id: 'depth-mask',
    family: 'shared',
    tags: ['shared', 'layering'],
    description: 'Mascara de profundidade usada pelo renderer final.',
    footprint: { width: 32, depth: 12 },
    anchor: { x: 96, y: 122 },
    slots: ['mask'],
    variants: { role: 'mask' },
    fragment: '',
  }),
];
