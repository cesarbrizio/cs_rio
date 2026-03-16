import { svgDocument, group, polygon, rect, ellipse, pathTag, line } from './utils/svg.mjs';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function colorSet(analysis) {
  const category = analysis.category;
  const guideVisual = analysis.resolvedStyleGuide?.visual ?? {};
  const shadowAlpha = guideVisual.shadowAlpha ?? 0.16;
  const outlineWidth = guideVisual.baseStrokeWidth ?? 2;
  if (category === 'favela') {
    return {
      outline: '#22303A',
      shadow: `rgba(23, 31, 38, ${shadowAlpha})`,
      outlineWidth,
      concreteLight: '#BEB7AF',
      concreteMid: '#998E84',
      concreteDark: '#7D7268',
      roofRust: '#8A5D4A',
      roofTin: '#6F777D',
      brick: '#9C6751',
      accentBlue: '#77A8C3',
      accentGreen: '#6D8D6B',
      highlight: '#CFE6EF',
    };
  }

  if (category === 'nightlife') {
    return {
      outline: '#251E29',
      shadow: `rgba(18, 12, 20, ${guideVisual.shadowAlpha ?? 0.22})`,
      outlineWidth,
      concreteLight: '#56505D',
      concreteMid: '#433C48',
      concreteDark: '#2E2932',
      roofRust: '#71435C',
      roofTin: '#5A4C6A',
      brick: '#854A58',
      accentBlue: '#65D8FF',
      accentGreen: '#E66AF2',
      highlight: '#F6E7FF',
    };
  }

  if (category === 'hospital') {
    return {
      outline: '#2F404A',
      shadow: `rgba(29, 43, 55, ${shadowAlpha})`,
      outlineWidth,
      concreteLight: '#E4E7E4',
      concreteMid: '#CDD2D2',
      concreteDark: '#B3B8BA',
      roofRust: '#D45455',
      roofTin: '#B7C5CD',
      brick: '#C8DDE6',
      accentBlue: '#96D6FA',
      accentGreen: '#D84F50',
      highlight: '#F8FAFC',
    };
  }

  if (category === 'factory' || category === 'junkyard') {
    return {
      outline: '#2E373E',
      shadow: `rgba(27, 33, 38, ${shadowAlpha})`,
      outlineWidth,
      concreteLight: '#A5A19A',
      concreteMid: '#7D7972',
      concreteDark: '#615D56',
      roofRust: '#926951',
      roofTin: '#6D747B',
      brick: '#86614D',
      accentBlue: '#90B7CF',
      accentGreen: '#D38E4F',
      highlight: '#D9E4EB',
    };
  }

  if (category === 'wealthy') {
    return {
      outline: '#404247',
      shadow: `rgba(24, 31, 38, ${guideVisual.shadowAlpha ?? 0.15})`,
      outlineWidth,
      concreteLight: '#EDE5D8',
      concreteMid: '#CFC6B9',
      concreteDark: '#B7AFA3',
      roofRust: '#8A664F',
      roofTin: '#A89F94',
      brick: '#6D4F3D',
      accentBlue: '#D7EDF4',
      accentGreen: '#B7B0A5',
      highlight: '#F6F2E9',
    };
  }

  return {
    outline: '#2F3C45',
    shadow: `rgba(25, 33, 40, ${shadowAlpha})`,
    outlineWidth,
    concreteLight: '#D8D1C6',
    concreteMid: '#B8B0A4',
    concreteDark: '#948B80',
    roofRust: '#8B644E',
    roofTin: '#84919B',
    brick: '#956A52',
    accentBlue: '#A0D9F8',
    accentGreen: '#7E9D7A',
    highlight: '#EDF4F7',
  };
}

function isoBox({ x, y, w, h, d, topFill, leftFill, rightFill, outline }) {
  const strokeWidth = outline.strokeWidth ?? 2;
  const strokeColor = outline.color ?? outline;
  const top = `${x},${y} ${x + w},${y + h / 2} ${x},${y + h} ${x - w},${y + h / 2}`;
  const left = `${x - w},${y + h / 2} ${x},${y + h} ${x},${y + h + d} ${x - w},${y + h / 2 + d}`;
  const right = `${x + w},${y + h / 2} ${x},${y + h} ${x},${y + h + d} ${x + w},${y + h / 2 + d}`;
  return [
    polygon(left, { fill: leftFill, stroke: strokeColor, 'stroke-width': strokeWidth }),
    polygon(right, { fill: rightFill, stroke: strokeColor, 'stroke-width': strokeWidth }),
    polygon(top, { fill: topFill, stroke: strokeColor, 'stroke-width': strokeWidth }),
  ].join('');
}

function windowsRow({ x, y, count, width, gap, fill }) {
  const chunks = [];
  for (let index = 0; index < count; index += 1) {
    chunks.push(
      rect(x + index * (width + gap), y, width, clamp(width * 0.72, 6, 14), {
        rx: 1.5,
        fill,
      }),
    );
  }
  return chunks.join('');
}

function buildFavelaScene(analysis, palette) {
  const clusterScale = analysis.volumetry.stackCountHint.includes('9') ? 6 : 4;
  const masses = [];
  const anchors = [
    { x: 82, y: 36, w: 30, h: 16, d: 34, roof: palette.roofTin },
    { x: 56, y: 48, w: 22, h: 12, d: 24, roof: palette.roofRust },
    { x: 108, y: 52, w: 20, h: 11, d: 22, roof: palette.roofRust },
    { x: 72, y: 60, w: 18, h: 10, d: 18, roof: palette.roofTin },
    { x: 96, y: 63, w: 18, h: 10, d: 16, roof: palette.brick },
    { x: 48, y: 67, w: 16, h: 9, d: 14, roof: palette.roofRust },
  ].slice(0, clusterScale);

  anchors.forEach((anchor, index) => {
    const bodyLight = index % 3 === 0 ? palette.concreteLight : index % 3 === 1 ? palette.brick : palette.concreteMid;
    const bodyDark = index % 2 === 0 ? palette.concreteDark : palette.concreteMid;
    masses.push(
      group(
        [
          isoBox({
            x: anchor.x,
            y: anchor.y,
            w: anchor.w,
            h: anchor.h,
            d: anchor.d,
            topFill: anchor.roof,
            leftFill: bodyDark,
            rightFill: bodyLight,
            outline: { color: palette.outline, strokeWidth: palette.outlineWidth },
          }),
          windowsRow({
            x: anchor.x - 8,
            y: anchor.y + anchor.h + 8,
            count: 2,
            width: 7,
            gap: 4,
            fill: palette.highlight,
          }),
        ].join(''),
      ),
    );
  });

  const utility = [
    ellipse(90, 126, 34, 10, { fill: palette.shadow }),
    polygon('99,30 107,34 99,38 91,34', { fill: palette.accentBlue, stroke: palette.outline, 'stroke-width': 2 }),
    rect(96, 34, 6, 12, { rx: 1.5, fill: palette.accentBlue, stroke: palette.outline, 'stroke-width': Math.max(1.25, palette.outlineWidth - 0.5) }),
    pathTag('M44 86 L57 76 L57 92', { stroke: palette.outline, 'stroke-width': palette.outlineWidth, fill: 'none', 'stroke-linecap': 'round' }),
    line(52, 83, 58, 80, { stroke: palette.outline, 'stroke-width': Math.max(1.25, palette.outlineWidth - 0.5) }),
    line(50, 87, 56, 84, { stroke: palette.outline, 'stroke-width': Math.max(1.25, palette.outlineWidth - 0.5) }),
    line(48, 91, 54, 88, { stroke: palette.outline, 'stroke-width': Math.max(1.25, palette.outlineWidth - 0.5) }),
    rect(36, 93, 18, 8, { rx: 1.5, fill: palette.accentGreen, opacity: 0.85 }),
  ].join('');

  return svgDocument({
    content: group([utility, ...masses].join('')),
  });
}

function buildNightlifeScene(analysis, palette) {
  const openCore = [
    ellipse(82, 126, 32, 9, { fill: palette.shadow }),
    isoBox({
      x: 80,
      y: 54,
      w: 34,
      h: 18,
      d: 24,
      topFill: palette.roofRust,
      leftFill: palette.concreteDark,
      rightFill: palette.concreteMid,
      outline: { color: palette.outline, strokeWidth: palette.outlineWidth },
    }),
    rect(48, 86, 64, 8, { rx: 2, fill: palette.accentBlue, opacity: 0.85 }),
    rect(58, 76, 10, 24, { rx: 2, fill: palette.concreteDark }),
    rect(92, 76, 10, 24, { rx: 2, fill: palette.concreteDark }),
    rect(43, 82, 5, 22, { rx: 1.5, fill: palette.concreteDark }),
    rect(112, 82, 5, 22, { rx: 1.5, fill: palette.concreteDark }),
    circleLike(48, 78, 5, palette.accentGreen, palette.outline),
    circleLike(80, 66, 6, palette.accentBlue, palette.outline),
    circleLike(112, 78, 5, palette.accentGreen, palette.outline),
    pathTag('M46 88 L114 88', { stroke: palette.accentGreen, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }),
  ].join('');

  return svgDocument({
    content: group(openCore),
  });
}

function circleLike(cx, cy, r, fill, outline) {
  const strokeColor = typeof outline === 'string' ? outline : outline.color;
  const strokeWidth = typeof outline === 'string' ? 2 : outline.strokeWidth ?? 2;
  return ellipse(cx, cy, r, r, { fill, stroke: strokeColor, 'stroke-width': strokeWidth });
}

function buildHospitalScene(analysis, palette) {
  const campus = [
    ellipse(84, 126, 33, 10, { fill: palette.shadow }),
    isoBox({
      x: 82,
      y: 42,
      w: 28,
      h: 15,
      d: 34,
      topFill: palette.concreteLight,
      leftFill: palette.concreteDark,
      rightFill: palette.concreteMid,
      outline: { color: palette.outline, strokeWidth: palette.outlineWidth },
    }),
    isoBox({
      x: 54,
      y: 60,
      w: 18,
      h: 10,
      d: 18,
      topFill: palette.concreteLight,
      leftFill: palette.concreteDark,
      rightFill: palette.concreteMid,
      outline: { color: palette.outline, strokeWidth: palette.outlineWidth },
    }),
    isoBox({
      x: 112,
      y: 64,
      w: 18,
      h: 10,
      d: 16,
      topFill: palette.concreteLight,
      leftFill: palette.concreteDark,
      rightFill: palette.concreteMid,
      outline: { color: palette.outline, strokeWidth: palette.outlineWidth },
    }),
    windowsRow({ x: 70, y: 73, count: 3, width: 8, gap: 4, fill: palette.accentBlue }),
    windowsRow({ x: 46, y: 75, count: 2, width: 6, gap: 4, fill: palette.accentBlue }),
    windowsRow({ x: 106, y: 79, count: 2, width: 6, gap: 4, fill: palette.accentBlue }),
    rect(76, 94, 10, 14, { rx: 2, fill: palette.highlight }),
    pathTag('M71 84 H91', { stroke: palette.accentGreen, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }),
    pathTag('M81 74 V94', { stroke: palette.accentGreen, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }),
  ].join('');

  return svgDocument({ content: group(campus) });
}

function buildFactoryScene(analysis, palette) {
  const factory = [
    ellipse(84, 127, 35, 10, { fill: palette.shadow }),
    isoBox({
      x: 82,
      y: 48,
      w: 34,
      h: 18,
      d: 30,
      topFill: palette.roofTin,
      leftFill: palette.concreteDark,
      rightFill: palette.concreteMid,
      outline: { color: palette.outline, strokeWidth: palette.outlineWidth },
    }),
    rect(54, 82, 18, 12, { rx: 1.5, fill: palette.highlight }),
    rect(76, 82, 18, 12, { rx: 1.5, fill: palette.highlight }),
    rect(98, 82, 10, 12, { rx: 1.5, fill: palette.highlight }),
    rect(109, 55, 10, 34, { rx: 1.5, fill: palette.concreteDark }),
    ellipse(114, 51, 7, 5, { fill: palette.accentBlue, opacity: 0.55 }),
    ellipse(120, 43, 10, 6, { fill: palette.accentBlue, opacity: 0.28 }),
    rect(34, 100, 22, 8, { rx: 1.5, fill: palette.accentGreen, opacity: 0.9 }),
  ].join('');

  return svgDocument({ content: group(factory) });
}

function buildWealthyScene(analysis, palette) {
  const villa = [
    ellipse(84, 127, 34, 9, { fill: palette.shadow }),
    isoBox({
      x: 80,
      y: 50,
      w: 34,
      h: 18,
      d: 28,
      topFill: palette.concreteLight,
      leftFill: palette.concreteDark,
      rightFill: palette.concreteMid,
      outline: { color: palette.outline, strokeWidth: palette.outlineWidth },
    }),
    isoBox({
      x: 98,
      y: 34,
      w: 20,
      h: 11,
      d: 18,
      topFill: palette.accentGreen,
      leftFill: palette.concreteDark,
      rightFill: palette.concreteMid,
      outline: { color: palette.outline, strokeWidth: palette.outlineWidth },
    }),
    rect(56, 82, 18, 16, { rx: 1.5, fill: '#4A443E' }),
    rect(86, 78, 18, 18, { rx: 1.5, fill: '#4F463F' }),
    rect(72, 67, 12, 21, { rx: 1.5, fill: palette.brick }),
    rect(54, 66, 15, 14, { rx: 1.5, fill: palette.accentBlue }),
    rect(90, 62, 15, 14, { rx: 1.5, fill: palette.accentBlue }),
    pathTag('M46 106 H112', { stroke: '#DADCD8', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' }),
  ].join('');

  return svgDocument({ content: group(villa) });
}

function buildGenericScene(analysis, palette) {
  const generic = [
    ellipse(80, 127, 32, 9, { fill: palette.shadow }),
    isoBox({
      x: 80,
      y: 50,
      w: 30,
      h: 16,
      d: 28,
      topFill: palette.concreteLight,
      leftFill: palette.concreteDark,
      rightFill: palette.concreteMid,
      outline: { color: palette.outline, strokeWidth: palette.outlineWidth },
    }),
    rect(62, 83, 14, 14, { rx: 1.5, fill: palette.highlight }),
    rect(84, 79, 14, 18, { rx: 1.5, fill: palette.highlight }),
  ].join('');

  return svgDocument({ content: group(generic) });
}

export async function composeIsometricScene({ analysis }) {
  const palette = colorSet(analysis);
  const sceneViewBox = analysis.projectStyleGuide.baseViewBox;

  let sceneSvg;
  if (analysis.category === 'favela') {
    sceneSvg = buildFavelaScene(analysis, palette);
  } else if (analysis.category === 'nightlife') {
    sceneSvg = buildNightlifeScene(analysis, palette);
  } else if (analysis.category === 'hospital') {
    sceneSvg = buildHospitalScene(analysis, palette);
  } else if (analysis.category === 'factory' || analysis.category === 'junkyard') {
    sceneSvg = buildFactoryScene(analysis, palette);
  } else if (analysis.category === 'wealthy') {
    sceneSvg = buildWealthyScene(analysis, palette);
  } else {
    sceneSvg = buildGenericScene(analysis, palette);
  }

  return {
    version: 1,
    stage: 'composition',
    generatedAt: new Date().toISOString(),
    assetType: analysis.assetType,
    category: analysis.category,
    sceneViewBox,
    sceneSvg,
    sceneMetrics: {
      requiredElementsCount: analysis.requiredElements.length,
      materialsCount: analysis.materials.length,
      referenceCount: analysis.referenceFiles.length,
    },
    appliedStyleGuide: {
      selected: analysis.styleGuide,
      resolvedProfile: analysis.resolvedStyleGuide?.resolvedProfile ?? 'default',
      visual: analysis.resolvedStyleGuide?.visual ?? {},
    },
  };
}
