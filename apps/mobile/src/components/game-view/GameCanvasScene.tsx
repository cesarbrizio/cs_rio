import {
  Atlas,
  Canvas,
  Circle,
  Group,
  Path,
  type SkImage,
} from '@shopify/react-native-skia';
import type { useRSXformBuffer, useRectBuffer } from '@shopify/react-native-skia';
import { type ScreenPoint } from '@engine/types';
import { type SharedValue } from 'react-native-reanimated';

import { colors } from '../../theme/colors';
import { type MapStructureSvgCatalog } from '../../data/mapStructureSvgCatalog';
import { createDiamondPath, createPolylinePath, toAlphaHex } from './geometry';
import { renderMapEntityMarker, renderMapStructure } from './renderers';
import {
  type GameEntityWorldPoint,
  type WorldLandmarkOverlay,
  type WorldStructureOverlay,
} from './types';

interface GameCanvasSceneProps {
  cameraMatrixValue: SharedValue<number[]>;
  entityWorldPoints: GameEntityWorldPoint[];
  landmarkWorldOverlays: WorldLandmarkOverlay[];
  pathWorldPoints: ScreenPoint[];
  playerBeaconYValue: SharedValue<number>;
  playerHaloYValue: SharedValue<number>;
  playerImage: SkImage | null;
  playerMarkerYValue: SharedValue<number>;
  playerSpriteBuffer: ReturnType<typeof useRectBuffer>;
  playerTransformBuffer: ReturnType<typeof useRSXformBuffer>;
  playerWorldXValue: SharedValue<number>;
  playerWorldYValue: SharedValue<number>;
  selectedTileWorldPoint: ScreenPoint | null;
  structureSvgCatalog: MapStructureSvgCatalog;
  structureWorldOverlays: WorldStructureOverlay[];
  tileSize: {
    height: number;
    width: number;
  };
}

export function GameCanvasScene({
  cameraMatrixValue,
  entityWorldPoints,
  landmarkWorldOverlays,
  pathWorldPoints,
  playerBeaconYValue,
  playerHaloYValue,
  playerImage,
  playerMarkerYValue,
  playerSpriteBuffer,
  playerTransformBuffer,
  playerWorldXValue,
  playerWorldYValue,
  selectedTileWorldPoint,
  structureSvgCatalog,
  structureWorldOverlays,
  tileSize,
}: GameCanvasSceneProps): JSX.Element {
  return (
    <Canvas style={styles.canvas}>
      <Group matrix={cameraMatrixValue}>
        {landmarkWorldOverlays.map((landmark) => (
          <Group key={landmark.id}>
            <Path
              color={toAlphaHex(landmark.accent, 0.18)}
              path={createDiamondPath(
                landmark.positionWorldPoint.x,
                landmark.positionWorldPoint.y,
                landmark.shape === 'warehouse' ? 26 : 22,
                landmark.shape === 'tower' ? 18 : 16,
              )}
            />
            <Path
              color={toAlphaHex(landmark.accent, 0.64)}
              path={createDiamondPath(
                landmark.positionWorldPoint.x,
                landmark.positionWorldPoint.y,
                landmark.shape === 'warehouse' ? 18 : 16,
                landmark.shape === 'tower' ? 14 : 12,
              )}
            />
            <Circle
              color={toAlphaHex(landmark.accent, 0.96)}
              cx={landmark.positionWorldPoint.x}
              cy={landmark.positionWorldPoint.y - (landmark.shape === 'tower' ? 16 : 10)}
              r={landmark.shape === 'plaza' ? 4 : 5}
            />
          </Group>
        ))}

        {structureWorldOverlays.map((structure) => (
          <Group key={structure.id}>
            {renderMapStructure(structure, structureSvgCatalog[structure.kind])}
          </Group>
        ))}

        {selectedTileWorldPoint ? (
          <>
            <Path
              color="rgba(224, 176, 75, 0.22)"
              path={createDiamondPath(
                selectedTileWorldPoint.x,
                selectedTileWorldPoint.y,
                tileSize.width * 1.36,
                tileSize.height * 1.36,
              )}
            />
            <Path
              color="rgba(224, 176, 75, 0.54)"
              path={createDiamondPath(
                selectedTileWorldPoint.x,
                selectedTileWorldPoint.y,
                tileSize.width * 1.12,
                tileSize.height * 1.12,
              )}
              style="stroke"
              strokeWidth={4}
            />
            <Circle
              color="rgba(244, 241, 232, 0.76)"
              cx={selectedTileWorldPoint.x}
              cy={selectedTileWorldPoint.y - 10}
              r={5}
            />
            <Circle
              color="rgba(244, 241, 232, 0.28)"
              cx={selectedTileWorldPoint.x}
              cy={selectedTileWorldPoint.y - 10}
              r={11}
            />
          </>
        ) : null}

        {pathWorldPoints.length > 1 ? (
          <Path
            color="rgba(244, 225, 174, 0.5)"
            path={createPolylinePath(pathWorldPoints.map((point) => ({ x: point.x, y: point.y - 10 })))}
            style="stroke"
            strokeCap="round"
            strokeJoin="round"
            strokeWidth={4}
          />
        ) : null}

        {pathWorldPoints.map((point, index) => (
          <Circle
            color="rgba(244, 241, 232, 0.58)"
            cx={point.x}
            cy={point.y - 10}
            key={`${point.x}:${point.y}:${index}`}
            r={index === pathWorldPoints.length - 1 ? 7 : 4}
          />
        ))}

        {entityWorldPoints.map((entity) => (
          <Group key={entity.id}>
            {renderMapEntityMarker(entity)}
          </Group>
        ))}

        <Circle color="rgba(17, 17, 17, 0.28)" cx={playerWorldXValue} cy={playerWorldYValue} r={18} />
        <Circle color="rgba(63, 163, 77, 0.24)" cx={playerWorldXValue} cy={playerHaloYValue} r={34} />
        <Circle color="rgba(63, 163, 77, 0.42)" cx={playerWorldXValue} cy={playerHaloYValue} r={24} />
        <Circle color="rgba(244, 241, 232, 0.84)" cx={playerWorldXValue} cy={playerBeaconYValue} r={6} />

        {playerImage ? (
          <Atlas image={playerImage} sprites={playerSpriteBuffer} transforms={playerTransformBuffer} />
        ) : (
          <Circle color={colors.success} cx={playerWorldXValue} cy={playerWorldYValue} r={12} />
        )}

        <Circle color="rgba(63, 163, 77, 0.96)" cx={playerWorldXValue} cy={playerMarkerYValue} r={7} />
      </Group>
    </Canvas>
  );
}

const styles = {
  canvas: {
    flex: 1,
  },
};
