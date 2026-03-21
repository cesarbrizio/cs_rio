import { LEVELS } from '@cs-rio/shared';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type RootStackParamList } from '../../App';
import { InGameScreenLayout } from '../components/InGameScreenLayout';
import {
  buildVocationScopeLines,
  PROFILE_VISIBILITY_COPY,
  PROFILE_VISIBILITY_TITLE,
} from '../features/vocationScope';
import { useAuthStore } from '../stores/authStore';
import { colors } from '../theme/colors';

const ACHIEVEMENT_LABELS = [
  'Primeiro login no servidor',
  'Personagem autenticado',
  'Presença em tempo real ativa',
] as const;

const ATTRIBUTE_TONES = {
  carisma: colors.accent,
  forca: colors.danger,
  inteligencia: colors.info,
  resistencia: colors.success,
} as const;

const RESOURCE_TONES = {
  addiction: colors.warning,
  brisa: '#f2b94b',
  conceito: colors.accent,
  hp: '#f49d9d',
  money: colors.text,
  disposicao: '#7bb2ff',
  cansaco: colors.success,
} as const;

export function ProfileScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const player = useAuthStore((state) => state.player);
  const [isLevelGuideOpen, setIsLevelGuideOpen] = useState(false);

  const currentLevel = player?.level ?? 1;
  const currentTitle = player?.title ?? '--';
  const nextLevel = LEVELS.find((entry) => entry.level === currentLevel + 1) ?? null;
  const conceito = player?.resources.conceito ?? 0;
  const nextTarget = nextLevel?.conceitoRequired ?? null;
  const conceitoRemaining = nextTarget === null ? 0 : Math.max(nextTarget - conceito, 0);

  return (
    <InGameScreenLayout
      subtitle="Veja seus atributos, recursos e o caminho de progressão da rodada sem misturar tudo no mesmo bloco."
      title="Ver perfil"
    >
      <View style={styles.heroCard}>
        <Text style={styles.nickname}>{player?.nickname ?? '--'}</Text>
        <Text style={styles.vocation}>{player?.vocation ?? '--'}</Text>
      </View>

      <Pressable
        onPress={() => {
          setIsLevelGuideOpen((current) => !current);
        }}
        style={({ pressed }) => [
          styles.levelCard,
          isLevelGuideOpen ? styles.levelCardOpen : null,
          pressed ? styles.buttonPressed : null,
        ]}
      >
        <View style={styles.levelCardHeader}>
          <View style={styles.levelCopy}>
            <Text style={styles.levelEyebrow}>Progressão</Text>
            <Text style={styles.levelTitle}>
              Level {currentLevel}º · {currentTitle}
            </Text>
            <Text style={styles.levelDescription}>
              {nextLevel
                ? `Faltam ${conceitoRemaining.toLocaleString('pt-BR')} de conceito para chegar ao ${nextLevel.level}º nível.`
                : 'Você já está no topo da progressão atual da rodada.'}
            </Text>
          </View>

          <View style={styles.levelChip}>
            <Text style={styles.levelChipLabel}>{isLevelGuideOpen ? 'Fechar' : 'Ver níveis'}</Text>
          </View>
        </View>
      </Pressable>

      {isLevelGuideOpen ? (
        <View style={styles.card}>
          <Text style={styles.guideTitle}>Como subir</Text>
          <Text style={styles.guideCopy}>
            Ganhe conceito praticando crimes, roubos, PvP, Tribunal do Tráfico, domínio
            territorial e negócios que fortaleçam sua posição na rodada.
          </Text>

          <View style={styles.levelGuideTable}>
            {LEVELS.map((entry) => {
              const isCurrent = entry.level === currentLevel;
              return (
                <View
                  key={entry.level}
                  style={[styles.levelGuideRow, isCurrent ? styles.levelGuideRowCurrent : null]}
                >
                  <Text style={styles.levelGuideLevel}>{entry.level}º</Text>
                  <View style={styles.levelGuideMeta}>
                    <Text style={styles.levelGuideName}>{entry.title}</Text>
                    <Text style={styles.levelGuideConcept}>
                      {entry.conceitoRequired.toLocaleString('pt-BR')} de conceito
                    </Text>
                  </View>
                  {isCurrent ? <Text style={styles.levelGuideCurrent}>Atual</Text> : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Atributos</Text>
        <View style={styles.statsGrid}>
          <StatTile
            label="Força"
            tone={ATTRIBUTE_TONES.forca}
            value={`${player?.attributes.forca ?? '--'}`}
          />
          <StatTile
            label="Inteligência"
            tone={ATTRIBUTE_TONES.inteligencia}
            value={`${player?.attributes.inteligencia ?? '--'}`}
          />
          <StatTile
            label="Resistência"
            tone={ATTRIBUTE_TONES.resistencia}
            value={`${player?.attributes.resistencia ?? '--'}`}
          />
          <StatTile
            label="Carisma"
            tone={ATTRIBUTE_TONES.carisma}
            value={`${player?.attributes.carisma ?? '--'}`}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recursos</Text>
        <View style={styles.resourceGrid}>
          <StatTile
            compact
            label="Cansaço"
            tone={RESOURCE_TONES.cansaco}
            value={`${player?.resources.cansaco ?? '--'}`}
          />
          <StatTile
            compact
            label="Disposição"
            tone={RESOURCE_TONES.disposicao}
            value={`${player?.resources.disposicao ?? '--'}`}
          />
          <StatTile
            compact
            label="Brisa"
            tone={RESOURCE_TONES.brisa}
            value={`${player?.resources.brisa ?? '--'}`}
          />
          <StatTile
            compact
            label="HP"
            tone={RESOURCE_TONES.hp}
            value={`${player?.resources.hp ?? '--'}`}
          />
          <StatTile
            compact
            label="Conceito"
            tone={RESOURCE_TONES.conceito}
            value={`${player?.resources.conceito ?? '--'}`}
          />
          <StatTile
            compact
            label="Vício"
            tone={RESOURCE_TONES.addiction}
            value={`${player?.resources.addiction ?? '--'}`}
          />
          <StatTile
            compact
            label="Caixa"
            tone={RESOURCE_TONES.money}
            value={`R$ ${player?.resources.money.toLocaleString('pt-BR') ?? '--'}`}
          />
        </View>
        <View style={styles.card}>
          <Text style={styles.detailCopy}>
            Brisa sobe no consumo de drogas, aparece no efeito imediato da viagem e zera quando o personagem entra em overdose.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Histórico de Conquistas</Text>
        <View style={styles.card}>
          {ACHIEVEMENT_LABELS.map((achievement) => (
            <Text key={achievement} style={styles.listItem}>
              • {achievement}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{PROFILE_VISIBILITY_TITLE}</Text>
        <View style={styles.card}>
          <Text style={styles.detailCopy}>{PROFILE_VISIBILITY_COPY}</Text>
          <Text style={styles.detailCopy}>Inventário visível: {player?.inventory.length ?? 0} itens</Text>
          <Text style={styles.detailCopy}>Propriedades: {player?.properties.length ?? 0}</Text>
          <Text style={styles.detailCopy}>
            Facção: {player?.faction ? `${player.faction.name} (${player.faction.abbreviation})` : 'sem facção'}
          </Text>
          <Text style={styles.detailCopy}>
            Posição visível hoje: {player ? `${player.location.positionX}, ${player.location.positionY}` : '--'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vocação nesta rodada</Text>
        <View style={styles.card}>
          {buildVocationScopeLines(player?.vocation).map((line) => (
            <Text key={line} style={styles.listItem}>
              • {line}
            </Text>
          ))}
        </View>
        <Pressable
          onPress={() => {
            navigation.navigate('Vocation');
          }}
          style={({ pressed }) => [styles.primaryButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.primaryButtonLabel}>Abrir central de vocação</Text>
        </Pressable>
      </View>
    </InGameScreenLayout>
  );
}

function StatTile({
  compact = false,
  label,
  tone,
  value,
}: {
  compact?: boolean;
  label: string;
  tone: string;
  value: string;
}): JSX.Element {
  return (
    <View style={[styles.statTile, compact ? styles.resourceTile : null]}>
      <Text style={[styles.statValue, { color: tone }, compact ? styles.resourceValue : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    padding: 18,
  },
  nickname: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  vocation: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  levelCard: {
    backgroundColor: '#231d13',
    borderColor: '#57472a',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  levelCardOpen: {
    borderColor: colors.accent,
  },
  levelCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  levelCopy: {
    flex: 1,
    gap: 4,
  },
  levelEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  levelTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  levelDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  levelChip: {
    backgroundColor: '#14110c',
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  levelChipLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  resourceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statTile: {
    backgroundColor: colors.panelAlt,
    borderRadius: 18,
    gap: 4,
    minWidth: '47%',
    padding: 14,
  },
  resourceTile: {
    minWidth: '31%',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  resourceValue: {
    fontSize: 18,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.panelAlt,
    borderRadius: 18,
    gap: 8,
    padding: 16,
  },
  guideTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  guideCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  levelGuideTable: {
    gap: 8,
    marginTop: 6,
  },
  levelGuideRow: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  levelGuideRowCurrent: {
    borderColor: colors.accent,
  },
  levelGuideLevel: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
    width: 26,
  },
  levelGuideMeta: {
    flex: 1,
    gap: 2,
  },
  levelGuideName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  levelGuideConcept: {
    color: colors.muted,
    fontSize: 12,
  },
  levelGuideCurrent: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  detailCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  listItem: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 14,
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
