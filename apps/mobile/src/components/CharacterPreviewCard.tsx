import { type VocationType } from '@cs-rio/shared';
import {
  Canvas,
  Circle,
  Group,
  Rect,
  RoundedRect,
} from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { buildCharacterPreviewModel } from '../features/characterPreview';
import { colors } from '../theme/colors';

interface CharacterPreviewCardProps {
  hairId: string;
  hairLabel: string;
  outfitId: string;
  outfitLabel: string;
  skinId: string;
  skinLabel: string;
  vocation: VocationType;
  vocationLabel: string;
}

export function CharacterPreviewCard({
  hairId,
  hairLabel,
  outfitId,
  outfitLabel,
  skinId,
  skinLabel,
  vocation,
  vocationLabel,
}: CharacterPreviewCardProps): JSX.Element {
  const floatValue = useRef(new Animated.Value(0)).current;
  const [frameIndex, setFrameIndex] = useState(0);
  const preview = useMemo(
    () => buildCharacterPreviewModel({ hairId, outfitId, skinId, vocation }),
    [hairId, outfitId, skinId, vocation],
  );

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatValue, {
          duration: 900,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(floatValue, {
          duration: 900,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [floatValue]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setFrameIndex((currentFrame) => (currentFrame + 1) % 4);
    }, 170);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const pose = WALK_POSES[frameIndex];

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Preview</Text>
      <Animated.View
        style={[
          styles.previewSprite,
          {
            transform: [
              {
                translateY: floatValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -6],
                }),
              },
            ],
          },
        ]}
      >
        <View style={[styles.vocationChip, { backgroundColor: preview.accentColor }]}>
          <Text style={styles.vocationChipLabel}>{vocationLabel}</Text>
        </View>
        <View style={[styles.previewGlow, { backgroundColor: preview.accentSoftColor }]} />
        <Canvas style={styles.spriteCanvas}>
          <RoundedRect color="rgba(10, 10, 10, 0.12)" height={18} r={10} width={86} x={45} y={138} />
          <RoundedRect color={preview.skinColor} height={46} r={7} width={14} x={63} y={pose.leftArmY} />
          <RoundedRect color={preview.skinColor} height={46} r={7} width={14} x={99} y={pose.rightArmY} />
          <RoundedRect color={preview.skinColor} height={34} r={15} width={34} x={62} y={34} />
          <Rect color={preview.skinShadow} height={6} width={20} x={69} y={63} />
          <RoundedRect color={preview.outfitPrimary} height={50} r={10} width={42} x={58} y={74} />
          <RoundedRect color={preview.outfitTrim} height={8} r={5} width={18} x={70} y={78} />

          {preview.outfitVariant === 'stripes' ? (
            <>
              <Rect color={preview.outfitSecondary} height={8} width={42} x={58} y={88} />
              <Rect color={preview.outfitSecondary} height={8} width={42} x={58} y={102} />
            </>
          ) : null}

          {preview.outfitVariant === 'vest' ? (
            <>
              <RoundedRect color={preview.outfitSecondary} height={44} r={8} width={14} x={58} y={78} />
              <RoundedRect color={preview.outfitSecondary} height={44} r={8} width={14} x={86} y={78} />
              <Rect color={preview.outfitTrim} height={38} width={4} x={77} y={82} />
            </>
          ) : null}

          <RoundedRect color={preview.pantsColor} height={50} r={7} width={14} x={66} y={pose.leftLegY} />
          <RoundedRect color={preview.pantsColor} height={50} r={7} width={14} x={80} y={pose.rightLegY} />
          <Rect color="#f2efe6" height={6} width={16} x={65} y={pose.leftLegY + 44} />
          <Rect color="#f2efe6" height={6} width={16} x={79} y={pose.rightLegY + 44} />

          <Group>
            {preview.hairShape === 'short' ? (
              <RoundedRect color={preview.hairColor} height={14} r={8} width={30} x={64} y={32} />
            ) : null}

            {preview.hairShape === 'buzz' ? (
              <>
                <RoundedRect color={preview.hairColor} height={8} r={5} width={22} x={68} y={35} />
                <Rect color={preview.skinShadow} height={3} width={14} x={72} y={39} />
              </>
            ) : null}

            {preview.hairShape === 'braids' ? (
              <>
                <RoundedRect color={preview.hairColor} height={14} r={8} width={30} x={64} y={32} />
                <RoundedRect color={preview.hairColor} height={22} r={4} width={6} x={60} y={42} />
                <RoundedRect color={preview.hairColor} height={22} r={4} width={6} x={94} y={42} />
                <Circle color={preview.outfitTrim} cx={63} cy={64} r={2} />
                <Circle color={preview.outfitTrim} cx={97} cy={64} r={2} />
              </>
            ) : null}
          </Group>

          <Circle color={preview.accentSoftColor} cx={114} cy={46} r={12} />
          <Circle color={preview.accentColor} cx={114} cy={46} r={5} />
        </Canvas>
      </Animated.View>
      <View style={styles.badges}>
        <Badge label={vocationLabel} value="Vocação" />
        <Badge label={skinLabel} value="Pele" />
        <Badge label={hairLabel} value="Cabelo" />
        <Badge label={outfitLabel} value="Roupa" />
      </View>
    </View>
  );
}

function Badge({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeValue}>{value}</Text>
      <Text style={styles.badgeLabel}>{label}</Text>
    </View>
  );
}

const WALK_POSES = [
  {
    leftArmY: 82,
    leftLegY: 116,
    rightArmY: 92,
    rightLegY: 120,
  },
  {
    leftArmY: 88,
    leftLegY: 120,
    rightArmY: 84,
    rightLegY: 116,
  },
  {
    leftArmY: 92,
    leftLegY: 120,
    rightArmY: 82,
    rightLegY: 116,
  },
  {
    leftArmY: 86,
    leftLegY: 116,
    rightArmY: 90,
    rightLegY: 120,
  },
] as const;

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
    borderRadius: 20,
    gap: 16,
    padding: 18,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    alignSelf: 'flex-start',
  },
  previewSprite: {
    alignItems: 'center',
    backgroundColor: '#15120d',
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    height: 180,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  previewGlow: {
    borderRadius: 999,
    height: 110,
    position: 'absolute',
    top: 26,
    width: 110,
  },
  vocationChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    position: 'absolute',
    right: 12,
    top: 12,
    zIndex: 1,
  },
  vocationChipLabel: {
    color: '#14110c',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  spriteCanvas: {
    height: 168,
    width: 176,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  badge: {
    backgroundColor: '#171717',
    borderRadius: 999,
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeValue: {
    color: colors.muted,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  badgeLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
});
