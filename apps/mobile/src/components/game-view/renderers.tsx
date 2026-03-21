import { Circle, ImageSVG, Path } from '@shopify/react-native-skia';

import { getMapStructureDefinition } from '../../data/mapStructureCatalog';
import type { MapStructureSvgCatalog } from '../../data/mapStructureSvgCatalog';
import { type GameEntity, type WorldStructureOverlay } from './types';
import {
  createDiamondPath,
  createLinePath,
  createPolygonPath,
  createRectPath,
  toAlphaHex,
} from './geometry';

export function renderMapEntityMarker(entity: GameEntity & { worldPoint: { x: number; y: number } }) {
  const accent = entity.color ?? '#ff7b54';
  const x = entity.worldPoint.x;
  const y = entity.worldPoint.y - 10;

  if (entity.kind === 'market') {
    return (
      <>
        <Circle color={`${accent}22`} cx={x} cy={y} r={20} />
        <Path color={`${accent}c8`} path={createDiamondPath(x, y, 26, 18)} />
        <Path color="rgba(25, 18, 10, 0.72)" path={createDiamondPath(x, y, 14, 10)} />
        <Circle color="#f4f1e8" cx={x} cy={y} r={3} />
      </>
    );
  }

  if (entity.kind === 'boca') {
    return (
      <>
        <Circle color={`${accent}24`} cx={x} cy={y} r={21} />
        <Path color={`${accent}d0`} path={createDiamondPath(x, y, 24, 16)} />
        <Circle color="rgba(15, 15, 15, 0.72)" cx={x - 6} cy={y} r={3} />
        <Circle color="rgba(15, 15, 15, 0.72)" cx={x} cy={y - 4} r={3} />
        <Circle color="rgba(15, 15, 15, 0.72)" cx={x + 6} cy={y} r={3} />
      </>
    );
  }

  if (entity.kind === 'factory') {
    return (
      <>
        <Circle color={`${accent}22`} cx={x} cy={y} r={22} />
        <Path color={`${accent}d6`} path={createRectPath(x - 10, y - 8, 20, 16)} />
        <Path color="rgba(18, 18, 18, 0.72)" path={createRectPath(x - 5, y - 12, 4, 7)} />
        <Path color="rgba(18, 18, 18, 0.72)" path={createRectPath(x + 2, y - 14, 4, 9)} />
      </>
    );
  }

  if (entity.kind === 'party') {
    return (
      <>
        <Circle color={`${accent}1f`} cx={x} cy={y} r={24} />
        <Circle color={`${accent}44`} cx={x} cy={y} r={18} />
        <Circle color={`${accent}cf`} cx={x} cy={y} r={9} />
        <Circle color="#f4f1e8" cx={x - 8} cy={y - 6} r={2} />
        <Circle color="#f4f1e8" cx={x + 7} cy={y - 2} r={2} />
      </>
    );
  }

  if (entity.kind === 'hospital') {
    return (
      <>
        <Circle color={`${accent}22`} cx={x} cy={y} r={21} />
        <Path color={`${accent}d2`} path={createRectPath(x - 10, y - 10, 20, 20)} />
        <Path color="#f4f1e8" path={createRectPath(x - 2, y - 7, 4, 14)} />
        <Path color="#f4f1e8" path={createRectPath(x - 7, y - 2, 14, 4)} />
      </>
    );
  }

  if (entity.kind === 'university') {
    return (
      <>
        <Circle color={`${accent}1f`} cx={x} cy={y} r={21} />
        <Path color={`${accent}cf`} path={createDiamondPath(x, y - 2, 24, 10)} />
        <Path color="rgba(20, 20, 20, 0.72)" path={createRectPath(x - 8, y - 1, 16, 10)} />
        <Path color="#f4f1e8" path={createRectPath(x - 1, y + 3, 2, 6)} />
      </>
    );
  }

  if (entity.kind === 'docks') {
    return (
      <>
        <Circle color={`${accent}20`} cx={x} cy={y} r={22} />
        <Path color={`${accent}cf`} path={createRectPath(x - 11, y - 8, 22, 14)} />
        <Path
          color="rgba(16, 22, 30, 0.72)"
          path={createLinePath({ x: x - 11, y: y + 8 }, { x: x + 11, y: y + 8 })}
          style="stroke"
          strokeWidth={3}
        />
      </>
    );
  }

  if (entity.kind === 'scrapyard') {
    return (
      <>
        <Circle color={`${accent}20`} cx={x} cy={y} r={22} />
        <Path color={`${accent}d0`} path={createRectPath(x - 10, y - 8, 20, 14)} />
        <Path color="rgba(15, 15, 15, 0.78)" path={createRectPath(x - 6, y - 4, 5, 5)} />
        <Path color="rgba(15, 15, 15, 0.78)" path={createRectPath(x + 1, y - 1, 5, 5)} />
      </>
    );
  }

  return (
    <>
      <Circle color={`${accent}33`} cx={x} cy={y} r={18} />
      <Circle color={`${accent}99`} cx={x} cy={y} r={13} />
      <Circle color={accent} cx={x} cy={y} r={8} />
    </>
  );
}

export function renderMapStructure(
  structure: WorldStructureOverlay,
  svg: MapStructureSvgCatalog[keyof MapStructureSvgCatalog],
) {
  const definition = getMapStructureDefinition(structure.kind);
  const {
    palette: { roof, leftWall, rightWall, outline, detail, detailSoft },
  } = definition;
  const [nw, ne, se, sw] = structure.basePoints;
  const [lnw, lne, lse, lsw] = structure.lotPoints;
  const [tnw, tne, tse, tsw] = structure.topPoints;
  const centerX = (tse.x + tsw.x) / 2;
  const centerY = (tse.y + tsw.y) / 2;
  const width = Math.abs(ne.x - nw.x);
  const depth = Math.abs(sw.y - nw.y);
  const placement = definition.placement;
  const lotCenter = {
    x: (lnw.x + lse.x) / 2,
    y: (lnw.y + lse.y) / 2,
  };
  const lotMinX = Math.min(lnw.x, lne.x, lse.x, lsw.x);
  const lotMaxX = Math.max(lnw.x, lne.x, lse.x, lsw.x);
  const lotMinY = Math.min(lnw.y, lne.y, lse.y, lsw.y);
  const lotMaxY = Math.max(lnw.y, lne.y, lse.y, lsw.y);
  const lotWidth = Math.max(1, lotMaxX - lotMinX);
  const lotHeight = Math.max(1, lotMaxY - lotMinY);
  const spriteSize =
    Math.max(lotWidth, lotHeight * 1.8) * placement.sprite.scale +
    structure.height * 1.05;
  const spriteX = lotCenter.x - spriteSize / 2 + lotWidth * placement.sprite.offsetX;
  const spriteY =
    lotMaxY -
    spriteSize * 0.18 +
    lotHeight * placement.sprite.offsetY -
    structure.height * 0.01;

  return (
    <>
      {svg ? (
        <ImageSVG
          height={spriteSize}
          svg={svg}
          width={spriteSize}
          x={spriteX}
          y={spriteY}
        />
      ) : (
        <>
          <Path color={leftWall} path={createPolygonPath([tnw, tsw, sw, nw])} />
          <Path color={rightWall} path={createPolygonPath([tne, tse, se, ne])} />
          <Path color={roof} path={createPolygonPath([tnw, tne, tse, tsw])} />
          <Path
            color={toAlphaHex('#f4f1e8', 0.16)}
            path={createPolygonPath([
              { x: tnw.x + (tne.x - tnw.x) * 0.08, y: tnw.y + 1 },
              { x: tne.x - (tne.x - tnw.x) * 0.08, y: tne.y + 1 },
              { x: tse.x - (tse.x - tsw.x) * 0.12, y: tse.y - 3 },
              { x: tsw.x + (tse.x - tsw.x) * 0.12, y: tsw.y - 3 },
            ])}
          />
          <Path color={outline} path={createPolygonPath([tnw, tne, tse, tsw])} style="stroke" strokeWidth={2.2} />
          <Path color={toAlphaHex(outline, 0.7)} path={createPolygonPath([tnw, tsw, sw, nw])} style="stroke" strokeWidth={1.6} />
          <Path color={toAlphaHex(outline, 0.7)} path={createPolygonPath([tne, tse, se, ne])} style="stroke" strokeWidth={1.6} />
          {renderStructureDetails(structure, {
            centerX,
            centerY,
            depth,
            detail,
            detailSoft,
            width,
          })}
        </>
      )}
    </>
  );
}

function renderStructureDetails(
  structure: WorldStructureOverlay,
  metrics: {
    centerX: number;
    centerY: number;
    depth: number;
    detail: string;
    detailSoft: string;
    width: number;
  },
) {
  const { centerX, centerY, depth, detail, detailSoft, width } = metrics;
  const definition = getMapStructureDefinition(structure.kind);

  if (definition.detailPreset === 'barraco') {
    return (
      <>
        <Path color={detailSoft} path={createDiamondPath(centerX - 3, centerY - structure.height + 1, 18, 10)} />
        <Path color={detail} path={createRectPath(centerX - 7, centerY - structure.height + 5, 14, 8)} />
        <Path color="rgba(244, 232, 214, 0.42)" path={createRectPath(centerX - 2, centerY - structure.height + 7, 4, 6)} />
        <Path color="rgba(25, 18, 14, 0.74)" path={createRectPath(centerX - 6, centerY - structure.height + 8, 2, 3)} />
        <Path color="rgba(25, 18, 14, 0.74)" path={createRectPath(centerX + 4, centerY - structure.height + 8, 2, 3)} />
      </>
    );
  }

  if (definition.detailPreset === 'favela-cluster') {
    return (
      <>
        {[-20, -8, 4, 16].map((offset, index) => (
          <Path
            key={`${structure.id}:roof:${offset}`}
            color={index % 2 === 0 ? detailSoft : detail}
            path={createDiamondPath(centerX + offset, centerY - structure.height + (index % 2 === 0 ? 2 : 10), 22, 12)}
          />
        ))}
        {[-18, -8, 2, 12, 20].map((offset, index) => (
          <Path
            key={`${structure.id}:hut:${offset}`}
            color={index % 2 === 0 ? detail : detailSoft}
            path={createRectPath(centerX + offset - 5, centerY - structure.height + 12 + (index % 2 === 0 ? 0 : 4), 10, 7)}
          />
        ))}
      </>
    );
  }

  if (definition.detailPreset === 'boca') {
    return (
      <>
        <Path color={detailSoft} path={createRectPath(centerX - 12, centerY - structure.height + 6, 24, 8)} />
        <Path color={detail} path={createRectPath(centerX - 9, centerY - structure.height + 14, 18, 6)} />
        <Circle color={detail} cx={centerX - 8} cy={centerY - structure.height + 9} r={2.5} />
        <Circle color={detail} cx={centerX} cy={centerY - structure.height + 6} r={2.5} />
        <Circle color={detail} cx={centerX + 8} cy={centerY - structure.height + 9} r={2.5} />
        <Path color="rgba(244, 190, 74, 0.76)" path={createRectPath(centerX - 3, centerY - structure.height + 15, 6, 3)} />
      </>
    );
  }

  if (definition.detailPreset === 'factory') {
    return (
      <>
        <Path color={detailSoft} path={createRectPath(centerX - width * 0.22, centerY - structure.height + 4, width * 0.44, 18)} />
        <Path color={detail} path={createRectPath(centerX + width * 0.08, centerY - structure.height - 10, 10, 24)} />
        <Path color={detail} path={createRectPath(centerX - width * 0.16, centerY - structure.height + 14, width * 0.3, 4)} />
        <Circle color={toAlphaHex(detailSoft, 0.7)} cx={centerX + width * 0.12} cy={centerY - structure.height - 12} r={4} />
        <Circle color={toAlphaHex(detailSoft, 0.44)} cx={centerX + width * 0.16} cy={centerY - structure.height - 18} r={6} />
      </>
    );
  }

  if (definition.detailPreset === 'nightlife') {
    return (
      <>
        <Path color={detailSoft} path={createRectPath(centerX - width * 0.22, centerY - structure.height + 8, width * 0.44, 10)} />
        <Path color={detail} path={createRectPath(centerX - width * 0.1, centerY - structure.height + 4, width * 0.2, 5)} />
        <Circle color={detail} cx={centerX - 12} cy={centerY - structure.height + 2} r={3} />
        <Circle color={detail} cx={centerX} cy={centerY - structure.height - 4} r={3} />
        <Circle color={detail} cx={centerX + 12} cy={centerY - structure.height + 2} r={3} />
        <Path color={toAlphaHex(detailSoft, 0.48)} path={createRectPath(centerX - 2, centerY - structure.height - 10, 4, 8)} />
      </>
    );
  }

  if (definition.detailPreset === 'tower') {
    const baseLeft = centerX - width * 0.22;
    const baseTop = centerY - structure.height + 4;
    const buildingWidth = Math.max(14, width * 0.44);
    const paneWidth = Math.max(4, buildingWidth * 0.16);
    const paneGap = Math.max(3, buildingWidth * 0.07);

    return (
      <>
        {[0, 1, 2, 3].map((row) =>
          [0, 1, 2].map((column) => (
            <Path
              key={`${structure.id}:tower:${row}:${column}`}
              color={row === 3 ? detail : detailSoft}
              path={createRectPath(
                baseLeft + column * (paneWidth + paneGap),
                baseTop + row * 9,
                paneWidth,
                5,
              )}
            />
          )),
        )}
        <Path color={detail} path={createRectPath(centerX - 6, centerY - structure.height + 40, 12, 4)} />
        <Path color={toAlphaHex(detailSoft, 0.48)} path={createRectPath(centerX - 4, centerY - structure.height - 8, 8, 6)} />
      </>
    );
  }

  if (definition.detailPreset === 'casa') {
    return (
      <>
        <Path color={detailSoft} path={createDiamondPath(centerX, centerY - structure.height + 2, 22, 12)} />
        <Path color={detail} path={createRectPath(centerX - 10, centerY - structure.height + 8, 20, 10)} />
        <Path color="rgba(244, 232, 214, 0.44)" path={createRectPath(centerX - 2, centerY - structure.height + 10, 4, 8)} />
        <Path color="rgba(35, 28, 22, 0.72)" path={createRectPath(centerX - 7, centerY - structure.height + 11, 3, 3)} />
        <Path color="rgba(35, 28, 22, 0.72)" path={createRectPath(centerX + 4, centerY - structure.height + 11, 3, 3)} />
      </>
    );
  }

  if (definition.detailPreset === 'market') {
    return (
      <>
        <Path color={detailSoft} path={createRectPath(centerX - 14, centerY - structure.height + 6, 28, 8)} />
        <Path color={detail} path={createRectPath(centerX - 12, centerY - structure.height + 14, 24, 7)} />
        <Path color="rgba(244, 199, 98, 0.8)" path={createRectPath(centerX - 10, centerY - structure.height + 10, 20, 4)} />
        <Path color="rgba(244, 241, 232, 0.46)" path={createRectPath(centerX - 8, centerY - structure.height + 16, 6, 4)} />
      </>
    );
  }

  if (
    definition.detailPreset === 'service' ||
    definition.detailPreset === 'prison' ||
    definition.detailPreset === 'university'
  ) {
    const left = centerX - width * 0.18;
    const top = centerY - structure.height + 6;
    const paneWidth = Math.max(6, width * 0.08);
    const paneGap = Math.max(4, width * 0.05);

    return (
      <>
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((column) => (
            <Path
              key={`${structure.id}:pane:${row}:${column}`}
              color={row === 1 ? detail : detailSoft}
              path={createRectPath(
                left + column * (paneWidth + paneGap),
                top + row * 10,
                paneWidth,
                6,
              )}
            />
          )),
        )}
        {definition.detailPreset === 'service' ? (
          <>
            <Path color="#f4f1e8" path={createRectPath(centerX - 2, centerY - structure.height - 4, 4, 16)} />
            <Path color="#f4f1e8" path={createRectPath(centerX - 9, centerY - structure.height + 2, 18, 4)} />
          </>
        ) : null}
        {definition.detailPreset === 'prison' ? (
          <>
            {[-12, -4, 4, 12].map((offset) => (
              <Path
                key={`${structure.id}:bar:${offset}`}
                color={detail}
                path={createRectPath(centerX + offset, centerY - structure.height + 2, 2, 22)}
              />
            ))}
          </>
        ) : null}
      </>
    );
  }

  return (
    <Path color={detailSoft} path={createRectPath(centerX - 8, centerY - structure.height + 8, 16, Math.max(6, depth * 0.26))} />
  );
}
