import fs from 'node:fs/promises';

function parseAttributes(raw = '') {
  const attributes = {};
  const attributeRegex = /([:\w-]+)\s*=\s*"([^"]*)"/g;
  let match = attributeRegex.exec(raw);

  while (match) {
    attributes[match[1]] = match[2];
    match = attributeRegex.exec(raw);
  }

  return attributes;
}

function parseTags(svgText) {
  const tags = [];
  const tagRegex = /<([a-zA-Z][\w:-]*)(\s[^<>]*?)?\s*\/?>/g;
  let match = tagRegex.exec(svgText);

  while (match) {
    if (!match[0].startsWith('</')) {
      tags.push({
        name: match[1],
        attributes: parseAttributes(match[2] ?? ''),
      });
    }
    match = tagRegex.exec(svgText);
  }

  return tags;
}

function parseViewBox(viewBox) {
  const parts = String(viewBox ?? '')
    .trim()
    .split(/\s+/)
    .map((value) => Number(value));

  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) {
    return null;
  }

  const [minX, minY, width, height] = parts;
  return {
    raw: viewBox,
    minX,
    minY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
  };
}

function isRenderableColor(value) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized !== 'none' && normalized !== 'transparent' && normalized !== 'currentcolor';
}

function extractColors(tags) {
  const colors = new Set();

  for (const tag of tags) {
    for (const key of ['fill', 'stroke']) {
      const value = tag.attributes[key];
      if (isRenderableColor(value)) {
        colors.add(value.trim().toLowerCase());
      }
    }
  }

  return [...colors];
}

function extractAlphaFromColor(value) {
  if (!value) {
    return null;
  }

  const rgbaMatch = value.match(/rgba?\(([^)]+)\)/i);
  if (!rgbaMatch) {
    return null;
  }

  const parts = rgbaMatch[1].split(',').map((piece) => piece.trim());
  if (parts.length < 4) {
    return null;
  }

  const alpha = Number(parts[3]);
  return Number.isFinite(alpha) ? alpha : null;
}

function collectTransparencyIssues(tags, validationConfig) {
  const issues = [];
  const minAllowedAlpha = validationConfig.minAllowedAlpha ?? 0.1;

  for (const tag of tags) {
    const opacityCandidates = [
      ['opacity', tag.attributes.opacity],
      ['fill-opacity', tag.attributes['fill-opacity']],
      ['stroke-opacity', tag.attributes['stroke-opacity']],
      ['fill', extractAlphaFromColor(tag.attributes.fill)],
      ['stroke', extractAlphaFromColor(tag.attributes.stroke)],
    ];

    for (const [source, rawValue] of opacityCandidates) {
      const alpha = Number(rawValue);
      if (Number.isFinite(alpha) && alpha > 0 && alpha < minAllowedAlpha) {
        issues.push({
          tag: tag.name,
          source,
          alpha,
        });
      }
    }
  }

  return issues;
}

function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function updateBounds(bounds, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return;
  }

  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
}

function collectPointsFromTag(tag) {
  const points = [];
  const attrs = tag.attributes;

  switch (tag.name) {
    case 'rect': {
      const x = parseNumber(attrs.x) ?? 0;
      const y = parseNumber(attrs.y) ?? 0;
      const width = parseNumber(attrs.width) ?? 0;
      const height = parseNumber(attrs.height) ?? 0;
      points.push([x, y], [x + width, y + height]);
      break;
    }
    case 'ellipse':
    case 'circle': {
      const cx = parseNumber(attrs.cx) ?? 0;
      const cy = parseNumber(attrs.cy) ?? 0;
      const rx = parseNumber(attrs.rx ?? attrs.r) ?? 0;
      const ry = parseNumber(attrs.ry ?? attrs.r) ?? 0;
      points.push([cx - rx, cy - ry], [cx + rx, cy + ry]);
      break;
    }
    case 'line': {
      points.push(
        [parseNumber(attrs.x1), parseNumber(attrs.y1)],
        [parseNumber(attrs.x2), parseNumber(attrs.y2)],
      );
      break;
    }
    case 'polygon':
    case 'polyline': {
      const values = String(attrs.points ?? '')
        .trim()
        .split(/[\s,]+/)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));

      for (let index = 0; index < values.length - 1; index += 2) {
        points.push([values[index], values[index + 1]]);
      }
      break;
    }
    case 'path': {
      const values = String(attrs.d ?? '')
        .match(/-?\d*\.?\d+/g)
        ?.map((value) => Number(value))
        .filter((value) => Number.isFinite(value));

      if (values) {
        for (let index = 0; index < values.length - 1; index += 2) {
          points.push([values[index], values[index + 1]]);
        }
      }
      break;
    }
    default:
      break;
  }

  return points;
}

function computeContentBounds(tags) {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };

  for (const tag of tags) {
    const points = collectPointsFromTag(tag);
    for (const [x, y] of points) {
      updateBounds(bounds, x, y);
    }
  }

  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY) || !Number.isFinite(bounds.maxX) || !Number.isFinite(bounds.maxY)) {
    return null;
  }

  return {
    ...bounds,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    centerX: bounds.minX + (bounds.maxX - bounds.minX) / 2,
    centerY: bounds.minY + (bounds.maxY - bounds.minY) / 2,
  };
}

function hasOpaqueFullBackground(tags, viewBox) {
  if (!viewBox) {
    return false;
  }

  return tags.some((tag) => {
    if (tag.name !== 'rect') {
      return false;
    }

    const x = parseNumber(tag.attributes.x) ?? 0;
    const y = parseNumber(tag.attributes.y) ?? 0;
    const width = parseNumber(tag.attributes.width);
    const height = parseNumber(tag.attributes.height);
    const fill = tag.attributes.fill;
    const opacity = parseNumber(tag.attributes.opacity) ?? extractAlphaFromColor(fill) ?? 1;

    return (
      isRenderableColor(fill) &&
      opacity >= 0.98 &&
      Math.abs(x - viewBox.minX) < 0.01 &&
      Math.abs(y - viewBox.minY) < 0.01 &&
      Math.abs((width ?? -1) - viewBox.width) < 0.01 &&
      Math.abs((height ?? -1) - viewBox.height) < 0.01
    );
  });
}

function validateCentering(viewBox, contentBounds, validationConfig) {
  if (!viewBox || !contentBounds) {
    return {
      ok: false,
      reason: 'missing-bounds',
    };
  }

  const toleranceRatio = validationConfig.centerToleranceRatio ?? 0.2;
  const deltaX = Math.abs(contentBounds.centerX - viewBox.centerX);
  const deltaY = Math.abs(contentBounds.centerY - viewBox.centerY);
  const allowedDeltaX = viewBox.width * toleranceRatio;
  const allowedDeltaY = viewBox.height * toleranceRatio;

  return {
    ok: deltaX <= allowedDeltaX && deltaY <= allowedDeltaY,
    deltaX,
    deltaY,
    allowedDeltaX,
    allowedDeltaY,
  };
}

function resolveCategoryLimit(validationConfig, category, key) {
  const categoryMap = validationConfig[`${key}ByCategory`] ?? {};
  if (category && Number.isFinite(categoryMap[category])) {
    return categoryMap[category];
  }
  return validationConfig[key] ?? Number.POSITIVE_INFINITY;
}

export async function validateSvg({ svgPath, validationConfig, category = null }) {
  const svgText = await fs.readFile(svgPath, 'utf8');
  const tags = parseTags(svgText);
  const svgTag = tags.find((tag) => tag.name === 'svg');
  const viewBox = parseViewBox(svgTag?.attributes.viewBox);
  const colors = extractColors(tags);
  const contentTags = tags.filter((tag) => tag.name !== 'svg' && tag.name !== 'defs');
  const pathCount = contentTags.filter((tag) => tag.name === 'path').length;
  const transparencyIssues = collectTransparencyIssues(contentTags, validationConfig);
  const contentBounds = computeContentBounds(contentTags);
  const centerCheck = validateCentering(viewBox, contentBounds, validationConfig);
  const opaqueBackgroundDetected =
    validationConfig.rejectOpaqueFullBackground === true && hasOpaqueFullBackground(contentTags, viewBox);
  const maxColors = resolveCategoryLimit(validationConfig, category, 'maxColors');
  const maxPaths = resolveCategoryLimit(validationConfig, category, 'maxPaths');

  const checks = {
    viewBox: {
      ok: Boolean(viewBox),
      expected: validationConfig.baseViewBox ?? null,
      actual: viewBox?.raw ?? null,
    },
    dimensions: {
      ok: Boolean(viewBox) && (!validationConfig.baseViewBox || viewBox.raw === validationConfig.baseViewBox),
      expected: validationConfig.baseViewBox ?? null,
      actual: viewBox?.raw ?? null,
    },
    centralization: centerCheck,
    colors: {
      ok: colors.length <= maxColors,
      count: colors.length,
      max: Number.isFinite(maxColors) ? maxColors : null,
      palette: colors,
    },
    paths: {
      ok: pathCount <= maxPaths,
      count: pathCount,
      max: Number.isFinite(maxPaths) ? maxPaths : null,
    },
    transparency: {
      ok: transparencyIssues.length <= (validationConfig.maxLowAlphaElements ?? 0),
      issues: transparencyIssues,
      max: validationConfig.maxLowAlphaElements ?? 0,
    },
    background: {
      ok: !opaqueBackgroundDetected,
      rejectOpaqueFullBackground: validationConfig.rejectOpaqueFullBackground === true,
      opaqueBackgroundDetected,
    },
  };

  const failedChecks = Object.entries(checks)
    .filter(([, value]) => value.ok === false)
    .map(([key]) => key);

  return {
    ok: failedChecks.length === 0,
    stage: 'validation',
    svgPath,
    checks,
    failedChecks,
    metrics: {
      tagCount: contentTags.length,
      pathCount,
      colorCount: colors.length,
      resolvedMaxColors: Number.isFinite(maxColors) ? maxColors : null,
      resolvedMaxPaths: Number.isFinite(maxPaths) ? maxPaths : null,
      bounds: contentBounds,
    },
    note:
      failedChecks.length === 0
        ? 'SVG validado com sucesso pelas regras automaticas atuais.'
        : `SVG reprovado nas verificacoes: ${failedChecks.join(', ')}.`,
  };
}
