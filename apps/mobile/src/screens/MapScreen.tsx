import { REGIONS } from '@cs-rio/shared';
import { useNavigation } from '@react-navigation/native';
import {
  estimateMacroRegionTravel,
  getMacroRegionMeta,
} from '@cs-rio/ui/hooks';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { InGameScreenLayout } from '../components/InGameScreenLayout';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';
import rjMapSource from '../../assets/maps/rj.webp';
import { type RootStackParamList } from '../../App';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

export function MapScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const player = useAuthStore((state) => state.player);
  const travelToRegion = useAuthStore((state) => state.travelToRegion);
  const queueMapReturnCue = useAppStore((state) => state.queueMapReturnCue);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const [isTraveling, setIsTraveling] = useState(false);
  const [selectedRegionId, setSelectedRegionId] = useState(player?.regionId ?? REGIONS[0]?.id ?? 'centro');
  const currentRegionId = player?.regionId ?? REGIONS[0]?.id ?? 'centro';
  const currentRegion = useMemo(
    () => REGIONS.find((region) => region.id === currentRegionId) ?? REGIONS[0],
    [currentRegionId],
  );
  const selectedRegion = useMemo(
    () => REGIONS.find((region) => region.id === selectedRegionId) ?? REGIONS[0],
    [selectedRegionId],
  );
  const routeEstimate = useMemo(
    () => estimateMacroRegionTravel(currentRegionId, selectedRegionId),
    [currentRegionId, selectedRegionId],
  );

  return (
    <InGameScreenLayout
      subtitle="Macro mapa do Rio para deslocamento regional. Veja onde você está, escolha o destino e viaje sem perder a leitura da cidade."
      title="Mapa"
    >
      <View style={styles.mapBoard}>
        <ImageBackground imageStyle={styles.mapImage} source={rjMapSource} style={styles.mapImageFrame}>
          <View style={styles.mapScrim} />
          <View pointerEvents="box-none" style={styles.mapHeader}>
            <View pointerEvents="none" style={[styles.mapBadge, styles.currentBadge]}>
              <Text style={styles.mapBadgeEyebrow}>Você está aqui</Text>
              <Text style={styles.mapBadgeLabel}>{currentRegion?.label ?? 'Região atual'}</Text>
            </View>
          </View>

          {selectedRegionId !== currentRegionId ? (
            <RouteRibbon
              from={getMacroRegionMeta(currentRegionId)}
              to={getMacroRegionMeta(selectedRegionId)}
            />
          ) : null}

          {REGIONS.map((region) => (
            <Pressable
              key={region.id}
              onPress={() => {
                setSelectedRegionId(region.id);
              }}
              style={({ pressed }) => [
                styles.regionNode,
                {
                  left: `${getMacroRegionMeta(region.id).x}%`,
                  top: `${getMacroRegionMeta(region.id).y}%`,
                },
                player?.regionId === region.id ? styles.regionNodeCurrent : null,
                selectedRegionId === region.id ? styles.regionNodeSelected : null,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <View
                style={[
                  styles.regionNodeHalo,
                  { backgroundColor: `${getMacroRegionMeta(region.id).accent}22` },
                  selectedRegionId === region.id ? styles.regionNodeHaloSelected : null,
                ]}
              />
              <Text style={styles.regionNodeLabel}>{region.label}</Text>
            </Pressable>
          ))}
        </ImageBackground>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>
          {currentRegion?.label ?? 'Origem'} → {selectedRegion?.label ?? 'Destino'}
        </Text>
        <Text style={styles.cardTitle}>
          {selectedRegionId === currentRegionId ? 'Você já está nessa região.' : `Ir para ${selectedRegion?.label ?? 'destino'}`}
        </Text>
        <Text style={styles.cardCopy}>
          {selectedRegionId === currentRegionId
            ? 'Use o macro mapa para se localizar, comparar regiões e preparar o próximo deslocamento da rodada.'
            : `Mototáxi estimado: R$ ${routeEstimate.cost} · ${routeEstimate.minutes} min. Toque em outra região para comparar a rota antes de viajar.`}
        </Text>
        <Text style={styles.cardCopy}>
          Densidade: {selectedRegion?.density ?? '--'} · Riqueza: {selectedRegion?.wealth ?? '--'}
        </Text>
        <Text style={styles.cardCopy}>
          {getMacroRegionMeta(selectedRegionId).note ??
            'Use este mapa para entender a macro-região atual e preparar deslocamento, domínio e expansão.'}
        </Text>
      </View>

      <View style={styles.regionList}>
        <Text style={styles.regionListTitle}>Regiões do Rio</Text>
        <Text style={styles.regionListCopy}>Toque numa região do mapa ou escolha abaixo para comparar deslocamento.</Text>
        {REGIONS.map((region) => (
          <Pressable
            key={region.id}
            onPress={() => {
              setSelectedRegionId(region.id);
            }}
            style={({ pressed }) => [
              styles.regionCard,
              player?.regionId === region.id ? styles.regionCardCurrent : null,
              selectedRegionId === region.id ? styles.regionCardSelected : null,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.regionCardTitle}>
              {region.label}
              {player?.regionId === region.id ? ' · Você está aqui' : ''}
            </Text>
            <Text style={styles.regionCardCopy}>
              {player?.regionId === region.id
                ? 'Região atual da rodada'
                : `Mototáxi: R$ ${estimateMacroRegionTravel(currentRegionId, region.id).cost} · ${estimateMacroRegionTravel(currentRegionId, region.id).minutes} min`}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        disabled={isTraveling}
        onPress={async () => {
          if (selectedRegionId === player?.regionId) {
            setBootstrapStatus(`Você já está em ${selectedRegion?.label}.`);
            return;
          }

          if (!player) {
            setBootstrapStatus('Perfil indisponível para viajar agora.');
            return;
          }

          try {
            setIsTraveling(true);
            setBootstrapStatus(
              `Mototáxi acionado para ${selectedRegion?.label}. Custo: R$ ${routeEstimate.cost} · ${routeEstimate.minutes} min.`,
            );
            await travelToRegion(selectedRegionId);
            queueMapReturnCue({
              accent: colors.info,
              message: `Você chegou em ${selectedRegion?.label}. Continue o corre dessa região.`,
            });
            navigation.goBack();
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Falha ao viajar de região.';
            setBootstrapStatus(message);
          } finally {
            setIsTraveling(false);
          }
        }}
        style={({ pressed }) => [
          styles.primaryButton,
          isTraveling ? styles.primaryButtonDisabled : null,
          pressed ? styles.buttonPressed : null,
        ]}
      >
        <Text style={styles.primaryButtonLabel}>
          {selectedRegionId === player?.regionId
            ? 'Região atual'
            : isTraveling
              ? 'Viajando...'
              : `Ir para ${selectedRegion?.label ?? 'destino'}`}
        </Text>
        {isTraveling ? <ActivityIndicator color="#14110c" size="small" /> : null}
      </Pressable>
    </InGameScreenLayout>
  );
}

const styles = StyleSheet.create({
  mapBoard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    aspectRatio: 2326 / 1690,
    overflow: 'hidden',
    position: 'relative',
  },
  mapImageFrame: {
    flex: 1,
  },
  mapImage: {
    height: '100%',
    width: '100%',
  },
  mapScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 5, 9, 0.12)',
  },
  mapHeader: {
    gap: 8,
    left: 12,
    position: 'absolute',
    right: 12,
    top: 12,
    zIndex: 4,
  },
  mapBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(8, 11, 16, 0.78)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  currentBadge: {
    borderColor: 'rgba(123, 178, 255, 0.32)',
  },
  destinationBadge: {
    borderColor: 'rgba(224, 176, 75, 0.42)',
  },
  mapBadgeMuted: {
    opacity: 0.8,
  },
  mapBadgeEyebrow: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  mapBadgeLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  routeRibbon: {
    backgroundColor: 'rgba(224, 176, 75, 0.2)',
    borderColor: 'rgba(224, 176, 75, 0.55)',
    borderRadius: 999,
    borderWidth: 1,
    height: 4,
    position: 'absolute',
    transformOrigin: 'left center',
    zIndex: 1,
  },
  regionNode: {
    backgroundColor: 'rgba(9, 11, 15, 0.88)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 18,
    borderWidth: 1,
    minWidth: 92,
    overflow: 'visible',
    paddingHorizontal: 14,
    paddingVertical: 11,
    position: 'absolute',
    zIndex: 3,
  },
  regionNodeHalo: {
    borderRadius: 999,
    height: 56,
    left: '50%',
    marginLeft: -28,
    marginTop: -28,
    position: 'absolute',
    top: '50%',
    width: 56,
  },
  regionNodeHaloSelected: {
    height: 68,
    marginLeft: -34,
    marginTop: -34,
    width: 68,
  },
  regionNodeCurrent: {
    borderColor: colors.info,
    shadowColor: colors.info,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
  },
  regionNodeSelected: {
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
  },
  regionCurrentChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(123, 178, 255, 0.18)',
    borderRadius: 999,
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  regionCurrentChipLabel: {
    color: colors.info,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  regionNodeLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  regionNodeMeta: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.panelAlt,
    borderRadius: 18,
    gap: 8,
    padding: 16,
  },
  cardEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  cardCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  regionList: {
    gap: 10,
  },
  regionListTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  regionListCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  regionCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  regionCardCurrent: {
    borderColor: colors.info,
  },
  regionCardSelected: {
    borderColor: colors.accent,
  },
  regionCardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  regionCardCopy: {
    color: colors.muted,
    fontSize: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    opacity: 0.92,
  },
  primaryButtonLabel: {
    color: '#14110c',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  buttonPressed: {
    opacity: 0.88,
  },
});

interface RouteRibbonProps {
  from: ReturnType<typeof getMacroRegionMeta>;
  to: ReturnType<typeof getMacroRegionMeta>;
}

function RouteRibbon({ from, to }: RouteRibbonProps): JSX.Element {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = `${Math.atan2(dy, dx)}rad`;
  const length = Math.max(80, Math.round(Math.hypot(dx, dy) * 3.1));

  return (
    <View
      pointerEvents="none"
      style={[
        styles.routeRibbon,
        {
          left: `${from.x}%`,
          top: `${from.y}%`,
          transform: [{ rotate: angle }],
          width: length,
        },
      ]}
    />
  );
}
