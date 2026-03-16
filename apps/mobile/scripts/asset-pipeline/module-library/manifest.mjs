import { loadModuleLibrary } from './index.mjs';

export async function buildModuleLibraryManifest() {
  const library = await loadModuleLibrary();
  const modules = Object.values(library.modules).map((moduleDefinition) => ({
    id: moduleDefinition.id,
    family: moduleDefinition.family,
    tags: moduleDefinition.tags,
    description: moduleDefinition.description,
    footprint: moduleDefinition.footprint,
    anchor: moduleDefinition.anchor,
    slots: moduleDefinition.slots,
    previewLength: moduleDefinition.previewSvg?.length ?? 0,
  }));

  return {
    families: library.families,
    moduleCount: library.moduleCount,
    modules,
  };
}
