import { baileModules } from './baile/index.mjs';
import { barracoModules } from './barraco/index.mjs';
import { catalogModules } from './catalog/index.mjs';
import { favelaModules } from './favela/index.mjs';
import { favelaClusterModules } from './favela-cluster/index.mjs';
import { sharedModules } from './shared/index.mjs';

function toDictionary(modules) {
  return Object.fromEntries(modules.map((moduleDefinition) => [moduleDefinition.id, moduleDefinition]));
}

export async function loadModuleLibrary() {
  const allModules = [...sharedModules, ...favelaModules, ...favelaClusterModules, ...barracoModules, ...baileModules, ...catalogModules];

  return {
    families: [
      'shared',
      'favela',
      'favela-cluster',
      'barraco',
      'baile',
      'boca',
      'market-clandestino',
      'gym',
      'hospital',
      'prison',
      'university',
      'factory',
      'dock-industrial',
      'junkyard',
      'residential-tower-simple',
      'residential-tower-modern',
      'commercial-block-simple',
      'commercial-block-modern',
      'house-simple',
      'house-wealthy',
    ],
    modules: toDictionary(allModules),
    moduleCount: allModules.length,
  };
}
