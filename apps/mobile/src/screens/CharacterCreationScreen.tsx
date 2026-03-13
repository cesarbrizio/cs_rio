import { type PlayerCreationInput, VocationType } from '@cs-rio/shared';
import { type ReactNode, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CharacterPreviewCard } from '../components/CharacterPreviewCard';
import { useAuthStore } from '../stores/authStore';
import { colors } from '../theme/colors';

const VOCATION_OPTIONS = [
  {
    id: VocationType.Cria,
    label: 'Cria',
    stats: '30 FOR / 10 INT / 20 RES / 10 CAR',
    summary: 'Rua, roubo e pressão física.',
  },
  {
    id: VocationType.Gerente,
    label: 'Gerente',
    stats: '10 FOR / 30 INT / 20 RES / 10 CAR',
    summary: 'Gestão de boca, fábrica e logística.',
  },
  {
    id: VocationType.Soldado,
    label: 'Soldado',
    stats: '25 FOR / 20 INT / 15 RES / 10 CAR',
    summary: 'Combate, defesa territorial e execução.',
  },
  {
    id: VocationType.Politico,
    label: 'Politico',
    stats: '10 FOR / 20 INT / 10 RES / 30 CAR',
    summary: 'Influência social, PM e negociação.',
  },
  {
    id: VocationType.Empreendedor,
    label: 'Empreendedor',
    stats: '10 FOR / 25 INT / 10 RES / 25 CAR',
    summary: 'Lavagem, investimento e negócio ilícito.',
  },
];

const SKIN_OPTIONS = [
  { id: 'pele_clara', label: 'Clara', swatch: '#f3c9a3' },
  { id: 'pele_media', label: 'Média', swatch: '#d7a070' },
  { id: 'pele_escura', label: 'Escura', swatch: '#8b5d3c' },
];

const HAIR_OPTIONS = [
  { id: 'corte_curto', label: 'Curto' },
  { id: 'tranca_media', label: 'Tranca' },
  { id: 'raspado', label: 'Raspado' },
];

const OUTFIT_OPTIONS = [
  { id: 'camisa_branca', label: 'Básica' },
  { id: 'camisa_flamengo', label: 'Fla' },
  { id: 'colete_preto', label: 'Colete' },
];

export function CharacterCreationScreen(): JSX.Element {
  const createCharacter = useAuthStore((state) => state.createCharacter);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vocation, setVocation] = useState<VocationType>(VocationType.Cria);
  const [skin, setSkin] = useState('pele_media');
  const [hair, setHair] = useState('corte_curto');
  const [outfit, setOutfit] = useState('camisa_branca');

  const selectedVocation = useMemo(
    () => VOCATION_OPTIONS.find((option) => option.id === vocation) ?? VOCATION_OPTIONS[0],
    [vocation],
  );
  const selectedSkin = useMemo(
    () => SKIN_OPTIONS.find((option) => option.id === skin) ?? SKIN_OPTIONS[1],
    [skin],
  );
  const selectedHair = useMemo(
    () => HAIR_OPTIONS.find((option) => option.id === hair) ?? HAIR_OPTIONS[0],
    [hair],
  );
  const selectedOutfit = useMemo(
    () => OUTFIT_OPTIONS.find((option) => option.id === outfit) ?? OUTFIT_OPTIONS[0],
    [outfit],
  );

  const handleSubmit = async () => {
    try {
      setErrorMessage(null);
      const payload: PlayerCreationInput = {
        appearance: {
          hair,
          outfit,
          skin,
        },
        vocation,
      };
      await createCharacter(payload);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Falha inesperada ao criar o personagem.',
      );
    }
  };

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>CS RIO</Text>
    <Text style={styles.title}>Criação de Personagem</Text>
        <Text style={styles.subtitle}>
          Escolha a vocação e a aparência inicial para entrar no mapa com o perfil persistido.
        </Text>

        <CharacterPreviewCard
          hairId={hair}
          hairLabel={selectedHair.label}
          outfitId={outfit}
          outfitLabel={selectedOutfit.label}
          skinId={skin}
          skinLabel={selectedSkin.label}
          vocation={vocation}
          vocationLabel={selectedVocation.label}
        />

        <Section title="Vocação">
          {VOCATION_OPTIONS.map((option) => (
            <ChoiceCard
              description={option.summary}
              isSelected={vocation === option.id}
              key={option.id}
              label={option.label}
              meta={option.stats}
              onPress={() => setVocation(option.id)}
            />
          ))}
        </Section>

        <Section title="Pele">
          <ToneSlider onSelect={setSkin} options={SKIN_OPTIONS} selectedId={skin} />
        </Section>

        <Section title="Cabelo">
          <ChoiceRow
            onSelect={setHair}
            options={HAIR_OPTIONS}
            selectedId={hair}
          />
        </Section>

        <Section title="Roupa">
          <ChoiceRow
            onSelect={setOutfit}
            options={OUTFIT_OPTIONS}
            selectedId={outfit}
          />
        </Section>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <Pressable
          disabled={isLoading}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed || isLoading ? styles.primaryButtonPressed : null,
          ]}
        >
          <Text style={styles.primaryButtonLabel}>
            {isLoading ? 'Criando personagem...' : 'Confirmar e entrar no jogo'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChoiceCard({
  description,
  isSelected,
  label,
  meta,
  onPress,
}: {
  description: string;
  isSelected: boolean;
  label: string;
  meta: string;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceCard,
        isSelected ? styles.choiceCardSelected : null,
        pressed ? styles.choiceCardPressed : null,
      ]}
    >
      <Text style={styles.choiceLabel}>{label}</Text>
      <Text style={styles.choiceMeta}>{meta}</Text>
      <Text style={styles.choiceDescription}>{description}</Text>
    </Pressable>
  );
}

function ChoiceRow({
  onSelect,
  options,
  selectedId,
}: {
  onSelect: (id: string) => void;
  options: Array<{ id: string; label: string }>;
  selectedId: string;
}): JSX.Element {
  return (
    <View style={styles.choiceRow}>
      {options.map((option) => (
        <Pressable
          key={option.id}
          onPress={() => onSelect(option.id)}
          style={({ pressed }) => [
            styles.choicePill,
            selectedId === option.id ? styles.choicePillSelected : null,
            pressed ? styles.choiceCardPressed : null,
          ]}
        >
          <Text style={styles.choicePillLabel}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ToneSlider({
  onSelect,
  options,
  selectedId,
}: {
  onSelect: (id: string) => void;
  options: Array<{ id: string; label: string; swatch: string }>;
  selectedId: string;
}): JSX.Element {
  return (
    <View style={styles.toneSlider}>
      <View style={styles.toneTrack} />
      <View style={styles.toneRail}>
        {options.map((option) => {
          const isSelected = option.id === selectedId;

          return (
            <Pressable
              key={option.id}
              onPress={() => onSelect(option.id)}
              style={({ pressed }) => [
                styles.toneStop,
                isSelected ? styles.toneStopSelected : null,
                pressed ? styles.choiceCardPressed : null,
              ]}
            >
              <View
                style={[
                  styles.toneSwatch,
                  {
                    backgroundColor: option.swatch,
                  },
                ]}
              />
              <Text style={styles.toneLabel}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Section({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}): JSX.Element {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: 18,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.4,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  choiceCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  choiceCardSelected: {
    borderColor: colors.accent,
    backgroundColor: '#1e1810',
  },
  choiceCardPressed: {
    opacity: 0.88,
  },
  choiceLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  choiceMeta: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  choiceDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  choicePill: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  choicePillSelected: {
    backgroundColor: '#1e1810',
    borderColor: colors.accent,
  },
  choicePillLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  toneSlider: {
    gap: 14,
  },
  toneTrack: {
    backgroundColor: '#25211c',
    borderRadius: 999,
    height: 6,
    marginHorizontal: 18,
  },
  toneRail: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  toneStop: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  toneStopSelected: {
    borderColor: colors.accent,
    backgroundColor: '#1e1810',
  },
  toneSwatch: {
    borderColor: 'rgba(17, 17, 17, 0.35)',
    borderRadius: 999,
    borderWidth: 2,
    height: 28,
    width: 28,
  },
  toneLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  error: {
    color: '#ff8f7a',
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 999,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  primaryButtonPressed: {
    opacity: 0.84,
  },
  primaryButtonLabel: {
    color: '#14110c',
    fontSize: 15,
    fontWeight: '800',
  },
});
