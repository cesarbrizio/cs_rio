import path from 'node:path';
import fs from 'node:fs/promises';

import { analyzeReferences } from './analyze-reference.mjs';
import { buildSceneGraph } from './build-scene-graph.mjs';
import { composeFromModules } from './compose-from-modules.mjs';
import { buildModuleLibraryManifest } from './module-library/manifest.mjs';
import { composeIsometricScene } from './compose-isometric-scene.mjs';
import { loadModuleLibrary } from './module-library/index.mjs';
import { detectSvgo, optimizeSvg } from './optimize-svg.mjs';
import { detectPreviewRenderer, renderPreview } from './render-preview.mjs';
import { renderSvg } from './render-svg.mjs';
import { loadProjectConfigs } from './style-guide.mjs';
import { validateSvg } from './validate-svg.mjs';
import { detectInkscape, vectorizeWithInkscape } from './vectorize-with-inkscape.mjs';
import { ensureDir, fileExists, writeJsonFile } from './utils/fs.mjs';

export function resolvePipelinePaths(cliDir) {
  const pipelineRoot = cliDir;
  const scriptsRoot = path.resolve(cliDir, '..');
  const mobileRoot = path.resolve(scriptsRoot, '..');
  const assetsRoot = path.join(mobileRoot, 'assets');
  const workingRoot = path.join(assetsRoot, 'asset-pipeline');

  return {
    pipelineRoot,
    scriptsRoot,
    mobileRoot,
    assetsRoot,
    workingRoot,
    analysisDir: path.join(workingRoot, 'analysis'),
    sceneGraphsDir: path.join(workingRoot, 'scene-graphs'),
    intermediateDir: path.join(workingRoot, 'intermediate'),
    outputDir: path.join(workingRoot, 'output'),
    previewsDir: path.join(workingRoot, 'previews'),
    examplesDir: path.join(workingRoot, 'examples'),
    moduleLibraryDir: path.join(pipelineRoot, 'module-library'),
  };
}

export async function ensurePipelineWorkspace(paths) {
  await ensureDir(paths.workingRoot);
  await ensureDir(paths.analysisDir);
  await ensureDir(paths.sceneGraphsDir);
  await ensureDir(paths.intermediateDir);
  await ensureDir(paths.outputDir);
  await ensureDir(paths.previewsDir);
  await ensureDir(paths.examplesDir);
}

export async function inspectExternalTools() {
  const inkscape = await detectInkscape();
  const svgo = await detectSvgo();
  const previewRenderer = await detectPreviewRenderer();
  return {
    inkscape: inkscape.available ? inkscape.version ?? 'available' : 'missing',
    svgo: svgo.available ? svgo.version ?? 'available' : 'missing',
    resvg: previewRenderer.available ? previewRenderer.version ?? 'available' : 'missing',
  };
}

export async function runModularStageOneStructure({
  cwd,
  pipelinePaths,
  assetType,
  referenceFiles,
  outputFile,
  styleGuide,
  keepIntermediate,
}) {
  const resolvedRefs = referenceFiles.map((file) => path.resolve(cwd, file));
  const resolvedOut = path.resolve(cwd, outputFile);
  const outputBaseName = path.basename(resolvedOut, path.extname(resolvedOut));
  const analysisPath = path.join(pipelinePaths.analysisDir, `${outputBaseName}.analysis.json`);
  const sceneGraphPath = path.join(pipelinePaths.sceneGraphsDir, `${outputBaseName}.scene-graph.json`);
  const structurePath = path.join(pipelinePaths.analysisDir, `${outputBaseName}.stage1-structure.json`);
  const moduleManifestPath = path.join(pipelinePaths.analysisDir, `${outputBaseName}.module-library.json`);

  const missingRefs = [];
  for (const ref of resolvedRefs) {
    if (!(await fileExists(ref))) {
      missingRefs.push(ref);
    }
  }

  if (missingRefs.length > 0) {
    await writeJsonFile(structurePath, {
      version: 2,
      stage: 'stage-1-structure',
      status: 'blocked-missing-reference',
      assetType,
      styleGuide,
      referenceFiles: resolvedRefs,
      outputFile: resolvedOut,
      generatedAt: new Date().toISOString(),
      missingReferences: missingRefs,
    });

    return {
      ok: false,
      stage: 'stage-1-structure',
      pipelineRoot: pipelinePaths.pipelineRoot,
      structurePath,
      missingReferences: missingRefs,
      note: 'Etapa 1 estrutural bloqueada por referencias ausentes.',
    };
  }

  const analysis = await analyzeReferences({
    assetType,
    referenceFiles: resolvedRefs,
    styleGuideName: styleGuide,
    pipelinePaths,
  });

  const projectConfigs = await loadProjectConfigs(pipelinePaths.pipelineRoot, styleGuide);
  const moduleLibrary = await loadModuleLibrary();
  const moduleManifest = await buildModuleLibraryManifest();
  const sceneGraph = await buildSceneGraph({
    analysis,
    styleGuide: analysis.resolvedStyleGuide ?? projectConfigs.styleGuide,
  });
  const compositionBlueprint = await composeFromModules({
    sceneGraph,
    moduleLibrary,
  });
  const renderBlueprint = await renderSvg({
    sceneGraph,
    compositionResult: compositionBlueprint,
  });
  const previewBlueprint = {
    stage: 'render-preview',
    assetType,
    category: analysis.category,
    status: 'pending-stage-6',
    ok: false,
    message: 'Preview PNG agora e gerado apenas na Etapa 6, a partir do SVG final.',
  };

  await writeJsonFile(analysisPath, analysis);
  await writeJsonFile(sceneGraphPath, sceneGraph);
  await writeJsonFile(moduleManifestPath, moduleManifest);
  await writeJsonFile(structurePath, {
    version: 2,
    stage: 'stage-1-structure',
    status: 'ready-for-stage-2',
    assetType,
    styleGuide,
    keepIntermediate,
    referenceFiles: resolvedRefs,
    outputFile: resolvedOut,
    generatedAt: new Date().toISOString(),
    architecture: {
      moduleLibraryFamilies: moduleLibrary.families,
      moduleCount: moduleLibrary.moduleCount,
      outputs: {
        analysisPath,
        sceneGraphPath,
        moduleManifestPath,
      },
      pendingStages: ['module-library-base', 'scene-graph-enrichment', 'modular-composer', 'svg-renderer', 'preview-renderer'],
    },
    compositionBlueprint,
    renderBlueprint,
    previewBlueprint,
  });

  return {
    ok: true,
    stage: 'stage-1-structure',
    pipelineRoot: pipelinePaths.pipelineRoot,
    analysisPath,
    sceneGraphPath,
    moduleManifestPath,
    structurePath,
    assetType,
    category: analysis.category,
    referenceFiles: resolvedRefs,
    outputFile: resolvedOut,
    note:
      'Etapa 1 estrutural concluida: nova arquitetura modular criada, analysis e scene graph basicos gerados, sem ainda prometer qualidade visual final.',
  };
}

export async function runModularStageFourComposition({
  cwd,
  pipelinePaths,
  assetType,
  referenceFiles,
  outputFile,
  styleGuide,
  keepIntermediate,
}) {
  const structureResult = await runModularStageOneStructure({
    cwd,
    pipelinePaths,
    assetType,
    referenceFiles,
    outputFile,
    styleGuide,
    keepIntermediate,
  });

  if (!structureResult.ok) {
    return structureResult;
  }

  const sceneGraph = JSON.parse(await fs.readFile(structureResult.sceneGraphPath, 'utf8'));
  const moduleLibrary = await loadModuleLibrary();
  const compositionResult = await composeFromModules({
    sceneGraph,
    moduleLibrary,
  });

  const outputBaseName = path.basename(structureResult.outputFile, path.extname(structureResult.outputFile));
  const compositionPath = path.join(pipelinePaths.intermediateDir, `${outputBaseName}.composition.svg`);
  const compositionManifestPath = path.join(pipelinePaths.intermediateDir, `${outputBaseName}.composition.json`);

  await fs.writeFile(compositionPath, `${compositionResult.compositionSvg}\n`, 'utf8');
  await writeJsonFile(compositionManifestPath, {
    ...compositionResult,
    compositionSvg: undefined,
    compositionPath,
  });

  return {
    ok: true,
    stage: 'stage-4-composition',
    pipelineRoot: pipelinePaths.pipelineRoot,
    analysisPath: structureResult.analysisPath,
    sceneGraphPath: structureResult.sceneGraphPath,
    moduleManifestPath: structureResult.moduleManifestPath,
    structurePath: structureResult.structurePath,
    compositionPath,
    compositionManifestPath,
    assetType: structureResult.assetType,
    category: structureResult.category,
    referenceFiles: structureResult.referenceFiles,
    outputFile: structureResult.outputFile,
    note: 'Etapa 4 concluida: a composicao modular agora gera uma cena SVG intermediaria real, ainda antes do renderer final.',
  };
}

export async function runModularStageFiveRender({
  cwd,
  pipelinePaths,
  assetType,
  referenceFiles,
  outputFile,
  styleGuide,
  keepIntermediate,
}) {
  const compositionStage = await runModularStageFourComposition({
    cwd,
    pipelinePaths,
    assetType,
    referenceFiles,
    outputFile,
    styleGuide,
    keepIntermediate,
  });

  if (!compositionStage.ok) {
    return compositionStage;
  }

  const sceneGraph = JSON.parse(await fs.readFile(compositionStage.sceneGraphPath, 'utf8'));
  const compositionResult = JSON.parse(await fs.readFile(compositionStage.compositionManifestPath, 'utf8'));
  const projectConfigs = await loadProjectConfigs(pipelinePaths.pipelineRoot, styleGuide);
  const renderResult = await renderSvg({
    sceneGraph,
    compositionResult: {
      ...compositionResult,
      compositionSvg: await fs.readFile(compositionStage.compositionPath, 'utf8'),
    },
    targetViewBox: projectConfigs.validation.baseViewBox,
  });

  const outputBaseName = path.basename(compositionStage.outputFile, path.extname(compositionStage.outputFile));
  const renderManifestPath = path.join(pipelinePaths.outputDir, `${outputBaseName}.render.json`);

  await fs.writeFile(compositionStage.outputFile, `${renderResult.finalSvg}\n`, 'utf8');
  await writeJsonFile(renderManifestPath, {
    ...renderResult,
    finalSvg: undefined,
    outputFile: compositionStage.outputFile,
  });

  return {
    ok: true,
    stage: 'stage-5-render',
    pipelineRoot: pipelinePaths.pipelineRoot,
    analysisPath: compositionStage.analysisPath,
    sceneGraphPath: compositionStage.sceneGraphPath,
    moduleManifestPath: compositionStage.moduleManifestPath,
    structurePath: compositionStage.structurePath,
    compositionPath: compositionStage.compositionPath,
    compositionManifestPath: compositionStage.compositionManifestPath,
    renderManifestPath,
    assetType: compositionStage.assetType,
    category: compositionStage.category,
    referenceFiles: compositionStage.referenceFiles,
    outputFile: compositionStage.outputFile,
    note: 'Etapa 5 concluida: o SVG final agora e gravado em output/ a partir do scene graph e da composicao modular.',
  };
}

export async function runModularStageSixPreview({
  cwd,
  pipelinePaths,
  assetType,
  referenceFiles,
  outputFile,
  previewFile,
  styleGuide,
  keepIntermediate,
}) {
  const renderStage = await runModularStageFiveRender({
    cwd,
    pipelinePaths,
    assetType,
    referenceFiles,
    outputFile,
    styleGuide,
    keepIntermediate,
  });

  if (!renderStage.ok) {
    return renderStage;
  }

  const outputBaseName = path.basename(renderStage.outputFile, path.extname(renderStage.outputFile));
  const previewPath = previewFile
    ? path.resolve(cwd, previewFile)
    : path.join(pipelinePaths.previewsDir, `${outputBaseName}.preview.png`);
  const previewManifestPath = path.join(pipelinePaths.previewsDir, `${outputBaseName}.preview.json`);
  const renderManifest = JSON.parse(await fs.readFile(renderStage.renderManifestPath, 'utf8'));
  const svgMarkup = await fs.readFile(renderStage.outputFile, 'utf8');
  const previewResult = await renderPreview({
    assetType: renderStage.assetType,
    category: renderStage.category,
    svgMarkup,
    previewPath,
    targetViewBox: renderManifest.targetViewBox,
  });

  await writeJsonFile(previewManifestPath, previewResult);

  if (!previewResult.ok) {
    return {
      ok: false,
      stage: 'stage-6-preview',
      pipelineRoot: pipelinePaths.pipelineRoot,
      analysisPath: renderStage.analysisPath,
      sceneGraphPath: renderStage.sceneGraphPath,
      moduleManifestPath: renderStage.moduleManifestPath,
      structurePath: renderStage.structurePath,
      compositionPath: renderStage.compositionPath,
      compositionManifestPath: renderStage.compositionManifestPath,
      renderManifestPath: renderStage.renderManifestPath,
      previewManifestPath,
      assetType: renderStage.assetType,
      category: renderStage.category,
      referenceFiles: renderStage.referenceFiles,
      outputFile: renderStage.outputFile,
      previewPath,
      note: previewResult.message,
    };
  }

  return {
    ok: true,
    stage: 'stage-6-preview',
    pipelineRoot: pipelinePaths.pipelineRoot,
    analysisPath: renderStage.analysisPath,
    sceneGraphPath: renderStage.sceneGraphPath,
    moduleManifestPath: renderStage.moduleManifestPath,
    structurePath: renderStage.structurePath,
    compositionPath: renderStage.compositionPath,
    compositionManifestPath: renderStage.compositionManifestPath,
    renderManifestPath: renderStage.renderManifestPath,
    previewManifestPath,
    assetType: renderStage.assetType,
    category: renderStage.category,
    referenceFiles: renderStage.referenceFiles,
    outputFile: renderStage.outputFile,
    previewPath,
    note: 'Etapa 6 concluida: preview PNG gravado para revisao visual rapida.',
  };
}

export async function runModularStageEightValidation({
  cwd,
  pipelinePaths,
  assetType,
  referenceFiles,
  outputFile,
  previewFile,
  styleGuide,
  keepIntermediate,
}) {
  const previewStage = await runModularStageSixPreview({
    cwd,
    pipelinePaths,
    assetType,
    referenceFiles,
    outputFile,
    previewFile,
    styleGuide,
    keepIntermediate,
  });

  if (!previewStage.ok) {
    return previewStage;
  }

  const outputBaseName = path.basename(previewStage.outputFile, path.extname(previewStage.outputFile));
  const validationManifestPath = path.join(pipelinePaths.outputDir, `${outputBaseName}.validation.json`);
  const projectConfigs = await loadProjectConfigs(pipelinePaths.pipelineRoot, styleGuide);
  const validation = await validateSvg({
    svgPath: previewStage.outputFile,
    validationConfig: projectConfigs.validation,
    category: previewStage.category,
  });

  await writeJsonFile(validationManifestPath, {
    ...validation,
    assetType: previewStage.assetType,
    category: previewStage.category,
    previewPath: previewStage.previewPath,
    renderManifestPath: previewStage.renderManifestPath,
    previewManifestPath: previewStage.previewManifestPath,
  });

  if (!validation.ok) {
    return {
      ok: false,
      stage: 'stage-8-validation',
      pipelineRoot: pipelinePaths.pipelineRoot,
      analysisPath: previewStage.analysisPath,
      sceneGraphPath: previewStage.sceneGraphPath,
      moduleManifestPath: previewStage.moduleManifestPath,
      structurePath: previewStage.structurePath,
      compositionPath: previewStage.compositionPath,
      compositionManifestPath: previewStage.compositionManifestPath,
      renderManifestPath: previewStage.renderManifestPath,
      previewManifestPath: previewStage.previewManifestPath,
      validationManifestPath,
      assetType: previewStage.assetType,
      category: previewStage.category,
      referenceFiles: previewStage.referenceFiles,
      outputFile: previewStage.outputFile,
      previewPath: previewStage.previewPath,
      failedChecks: validation.failedChecks,
      note: validation.note,
    };
  }

  return {
    ok: true,
    stage: 'stage-8-validation',
    pipelineRoot: pipelinePaths.pipelineRoot,
    analysisPath: previewStage.analysisPath,
    sceneGraphPath: previewStage.sceneGraphPath,
    moduleManifestPath: previewStage.moduleManifestPath,
    structurePath: previewStage.structurePath,
    compositionPath: previewStage.compositionPath,
    compositionManifestPath: previewStage.compositionManifestPath,
    renderManifestPath: previewStage.renderManifestPath,
    previewManifestPath: previewStage.previewManifestPath,
    validationManifestPath,
    assetType: previewStage.assetType,
    category: previewStage.category,
    referenceFiles: previewStage.referenceFiles,
    outputFile: previewStage.outputFile,
    previewPath: previewStage.previewPath,
    note: 'Etapa 8 concluida: o SVG final foi validado tecnicamente e aprovado pelas regras automaticas do pipeline.',
  };
}

export async function runStageOneScaffold({
  cwd,
  pipelinePaths,
  assetType,
  referenceFiles,
  outputFile,
  styleGuide,
  keepIntermediate,
}) {
  const resolvedRefs = referenceFiles.map((file) => path.resolve(cwd, file));
  const resolvedOut = path.resolve(cwd, outputFile);
  const outputBaseName = path.basename(resolvedOut, path.extname(resolvedOut));
  const analysisPlanPath = path.join(pipelinePaths.analysisDir, `${outputBaseName}.stage1-plan.json`);

  const missingRefs = [];
  for (const ref of resolvedRefs) {
    if (!(await fileExists(ref))) {
      missingRefs.push(ref);
    }
  }

  const stagePlan = {
    version: 1,
    stage: 'stage-1-scaffold',
    status: missingRefs.length > 0 ? 'blocked-missing-reference' : 'ready-for-stage-2',
    assetType,
    styleGuide,
    keepIntermediate,
    referenceFiles: resolvedRefs,
    outputFile: resolvedOut,
    generatedAt: new Date().toISOString(),
    missingReferences: missingRefs,
    nextStages: [
      'analyze-reference',
      'compose-isometric-scene',
      'vectorize-with-inkscape',
      'optimize-svg',
      'validate-svg',
    ],
    notes: [
      'A Etapa 1 cria apenas a infraestrutura do pipeline.',
      'Nenhum SVG final e gerado nesta fase.',
      'O plano intermediario fica salvo em analysis/ para servir de ponto de partida das proximas etapas.',
    ],
  };

  await writeJsonFile(analysisPlanPath, stagePlan);

  return {
    ok: missingRefs.length === 0,
    stage: 'stage-1-scaffold',
    pipelineRoot: pipelinePaths.pipelineRoot,
    analysisPlanPath,
    assetType,
    referenceFiles: resolvedRefs,
    outputFile: resolvedOut,
    missingReferences: missingRefs,
    note:
      missingRefs.length > 0
        ? 'Infraestrutura criada, mas ha referencias ausentes. Corrija os caminhos antes da Etapa 2.'
        : 'Infraestrutura criada. O proximo passo e implementar a analise das referencias.',
  };
}

export async function runStageTwoAnalysis({
  cwd,
  pipelinePaths,
  assetType,
  referenceFiles,
  outputFile,
  styleGuide,
  keepIntermediate,
}) {
  const scaffoldResult = await runStageOneScaffold({
    cwd,
    pipelinePaths,
    assetType,
    referenceFiles,
    outputFile,
    styleGuide,
    keepIntermediate,
  });

  if (!scaffoldResult.ok) {
    return scaffoldResult;
  }

  const outputBaseName = path.basename(scaffoldResult.outputFile, path.extname(scaffoldResult.outputFile));
  const analysisPath = path.join(pipelinePaths.analysisDir, `${outputBaseName}.analysis.json`);

  const analysis = await analyzeReferences({
    assetType,
    referenceFiles: scaffoldResult.referenceFiles,
    styleGuideName: styleGuide,
    pipelinePaths,
  });

  await writeJsonFile(analysisPath, analysis);

  return {
    ok: true,
    stage: 'stage-2-analysis',
    pipelineRoot: pipelinePaths.pipelineRoot,
    analysisPlanPath: scaffoldResult.analysisPlanPath,
    analysisPath,
    assetType,
    category: analysis.category,
    referenceFiles: scaffoldResult.referenceFiles,
    outputFile: scaffoldResult.outputFile,
    note: 'Analise de referencia gerada. O proximo passo e implementar a composicao isometrica intermediaria.',
  };
}

export async function runStageThreeComposition({
  cwd,
  pipelinePaths,
  assetType,
  referenceFiles,
  outputFile,
  styleGuide,
  keepIntermediate,
}) {
  const stageTwo = await runStageTwoAnalysis({
    cwd,
    pipelinePaths,
    assetType,
    referenceFiles,
    outputFile,
    styleGuide,
    keepIntermediate,
  });

  if (!stageTwo.ok) {
    return stageTwo;
  }

  const analysis = JSON.parse(await fs.readFile(stageTwo.analysisPath, 'utf8'));
  const outputBaseName = path.basename(stageTwo.outputFile, path.extname(stageTwo.outputFile));
  const scenePath = path.join(pipelinePaths.intermediateDir, `${outputBaseName}.scene.svg`);
  const sceneManifestPath = path.join(pipelinePaths.intermediateDir, `${outputBaseName}.scene.json`);

  const composition = await composeIsometricScene({ analysis });
  await fs.writeFile(scenePath, `${composition.sceneSvg}\n`, 'utf8');
  await writeJsonFile(sceneManifestPath, {
    ...composition,
    sceneSvg: undefined,
    scenePath,
  });

  return {
    ok: true,
    stage: 'stage-3-composition',
    pipelineRoot: pipelinePaths.pipelineRoot,
    analysisPlanPath: stageTwo.analysisPlanPath,
    analysisPath: stageTwo.analysisPath,
    scenePath,
    sceneManifestPath,
    assetType,
    category: composition.category,
    referenceFiles: stageTwo.referenceFiles,
    outputFile: stageTwo.outputFile,
    note: 'Cena isometrica intermediaria gerada. O proximo passo e integrar vetorizacao com Inkscape CLI.',
  };
}

export async function runStageFourVectorization({
  cwd,
  pipelinePaths,
  assetType,
  referenceFiles,
  outputFile,
  styleGuide,
  keepIntermediate,
}) {
  const stageThree = await runStageThreeComposition({
    cwd,
    pipelinePaths,
    assetType,
    referenceFiles,
    outputFile,
    styleGuide,
    keepIntermediate,
  });

  if (!stageThree.ok) {
    return stageThree;
  }

  const outputBaseName = path.basename(stageThree.outputFile, path.extname(stageThree.outputFile));
  const vectorizedPath = path.join(pipelinePaths.intermediateDir, `${outputBaseName}.vectorized.svg`);
  const vectorizeManifestPath = path.join(pipelinePaths.intermediateDir, `${outputBaseName}.vectorized.json`);

  const vectorization = await vectorizeWithInkscape({
    scenePath: stageThree.scenePath,
    vectorizedPath,
  });

  await writeJsonFile(vectorizeManifestPath, vectorization);

  if (!vectorization.ok) {
    return {
      ok: false,
      stage: 'stage-4-vectorization',
      pipelineRoot: pipelinePaths.pipelineRoot,
      analysisPlanPath: stageThree.analysisPlanPath,
      analysisPath: stageThree.analysisPath,
      scenePath: stageThree.scenePath,
      sceneManifestPath: stageThree.sceneManifestPath,
      vectorizeManifestPath,
      assetType,
      category: stageThree.category,
      referenceFiles: stageThree.referenceFiles,
      outputFile: stageThree.outputFile,
      missingDependency: vectorization.status === 'missing-dependency' ? 'inkscape' : null,
      note: vectorization.message,
    };
  }

  return {
    ok: true,
    stage: 'stage-4-vectorization',
    pipelineRoot: pipelinePaths.pipelineRoot,
    analysisPlanPath: stageThree.analysisPlanPath,
    analysisPath: stageThree.analysisPath,
    scenePath: stageThree.scenePath,
    sceneManifestPath: stageThree.sceneManifestPath,
    vectorizedPath,
    vectorizeManifestPath,
    assetType,
    category: stageThree.category,
    referenceFiles: stageThree.referenceFiles,
    outputFile: stageThree.outputFile,
    note: 'Vetorizacao com Inkscape concluida. O proximo passo e integrar otimizacao com SVGO.',
  };
}

export async function runStageFiveOptimization({
  cwd,
  pipelinePaths,
  assetType,
  referenceFiles,
  outputFile,
  styleGuide,
  keepIntermediate,
}) {
  const stageFour = await runStageFourVectorization({
    cwd,
    pipelinePaths,
    assetType,
    referenceFiles,
    outputFile,
    styleGuide,
    keepIntermediate,
  });

  if (!stageFour.ok) {
    return {
      ...stageFour,
      stage: 'stage-5-optimization',
      blockedBy: stageFour.stage,
      note:
        stageFour.missingDependency === 'inkscape'
          ? 'Otimizacao bloqueada porque a vetorizacao da Etapa 4 depende de `inkscape`, ausente no ambiente atual.'
          : stageFour.note,
    };
  }

  const outputBaseName = path.basename(stageFour.outputFile, path.extname(stageFour.outputFile));
  const optimizeManifestPath = path.join(pipelinePaths.outputDir, `${outputBaseName}.optimized.json`);
  const optimization = await optimizeSvg({
    inputPath: stageFour.vectorizedPath,
    optimizedPath: stageFour.outputFile,
  });

  await writeJsonFile(optimizeManifestPath, optimization);

  if (!optimization.ok) {
    return {
      ok: false,
      stage: 'stage-5-optimization',
      pipelineRoot: pipelinePaths.pipelineRoot,
      analysisPlanPath: stageFour.analysisPlanPath,
      analysisPath: stageFour.analysisPath,
      scenePath: stageFour.scenePath,
      sceneManifestPath: stageFour.sceneManifestPath,
      vectorizedPath: stageFour.vectorizedPath,
      vectorizeManifestPath: stageFour.vectorizeManifestPath,
      optimizeManifestPath,
      assetType,
      category: stageFour.category,
      referenceFiles: stageFour.referenceFiles,
      outputFile: stageFour.outputFile,
      missingDependency: optimization.status === 'missing-dependency' ? 'svgo' : null,
      note: optimization.message,
    };
  }

  return {
    ok: true,
    stage: 'stage-5-optimization',
    pipelineRoot: pipelinePaths.pipelineRoot,
    analysisPlanPath: stageFour.analysisPlanPath,
    analysisPath: stageFour.analysisPath,
    scenePath: stageFour.scenePath,
    sceneManifestPath: stageFour.sceneManifestPath,
    vectorizedPath: stageFour.vectorizedPath,
    vectorizeManifestPath: stageFour.vectorizeManifestPath,
    optimizeManifestPath,
    assetType,
    category: stageFour.category,
    referenceFiles: stageFour.referenceFiles,
    outputFile: stageFour.outputFile,
    optimizedPath: stageFour.outputFile,
    note: 'Otimizacao com SVGO integrada. O proximo passo e validar automaticamente o SVG final.',
  };
}

export async function runStageSixValidation({
  cwd,
  pipelinePaths,
  assetType,
  referenceFiles,
  outputFile,
  styleGuide,
  keepIntermediate,
}) {
  const stageFive = await runStageFiveOptimization({
    cwd,
    pipelinePaths,
    assetType,
    referenceFiles,
    outputFile,
    styleGuide,
    keepIntermediate,
  });

  if (!stageFive.ok) {
    return {
      ...stageFive,
      stage: 'stage-6-validation',
      blockedBy: stageFive.stage,
      note:
        stageFive.blockedBy || stageFive.missingDependency === 'inkscape'
          ? 'Validacao bloqueada porque as etapas anteriores ainda nao geraram um SVG final otimizado.'
          : stageFive.note,
    };
  }

  const outputBaseName = path.basename(stageFive.outputFile, path.extname(stageFive.outputFile));
  const validationManifestPath = path.join(pipelinePaths.outputDir, `${outputBaseName}.validation.json`);
  const projectConfigs = await loadProjectConfigs(pipelinePaths.pipelineRoot, styleGuide);
  const validation = await validateSvg({
    svgPath: stageFive.outputFile,
    validationConfig: projectConfigs.validation,
  });

  await writeJsonFile(validationManifestPath, validation);

  if (!validation.ok) {
    return {
      ok: false,
      stage: 'stage-6-validation',
      pipelineRoot: pipelinePaths.pipelineRoot,
      analysisPlanPath: stageFive.analysisPlanPath,
      analysisPath: stageFive.analysisPath,
      scenePath: stageFive.scenePath,
      sceneManifestPath: stageFive.sceneManifestPath,
      vectorizedPath: stageFive.vectorizedPath,
      vectorizeManifestPath: stageFive.vectorizeManifestPath,
      optimizeManifestPath: stageFive.optimizeManifestPath,
      validationManifestPath,
      assetType,
      category: stageFive.category,
      referenceFiles: stageFive.referenceFiles,
      outputFile: stageFive.outputFile,
      optimizedPath: stageFive.optimizedPath,
      failedChecks: validation.failedChecks,
      note: validation.note,
    };
  }

  return {
    ok: true,
    stage: 'stage-6-validation',
    pipelineRoot: pipelinePaths.pipelineRoot,
    analysisPlanPath: stageFive.analysisPlanPath,
    analysisPath: stageFive.analysisPath,
    scenePath: stageFive.scenePath,
    sceneManifestPath: stageFive.sceneManifestPath,
    vectorizedPath: stageFive.vectorizedPath,
    vectorizeManifestPath: stageFive.vectorizeManifestPath,
    optimizeManifestPath: stageFive.optimizeManifestPath,
    validationManifestPath,
    assetType,
    category: stageFive.category,
    referenceFiles: stageFive.referenceFiles,
    outputFile: stageFive.outputFile,
    optimizedPath: stageFive.optimizedPath,
    note: 'Validacao automatica integrada. O proximo passo e consolidar o style guide fixo do projeto.',
  };
}
