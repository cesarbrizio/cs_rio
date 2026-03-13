import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type RootStackParamList } from '../../App';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';

interface InGameScreenLayoutProps {
  children: ReactNode;
  eyebrow?: string;
  subtitle: string;
  title: string;
}

export function InGameScreenLayout({
  children,
  eyebrow = 'CS RIO',
  subtitle,
  title,
}: InGameScreenLayoutProps): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queueMapReturnCue = useAppStore((state) => state.queueMapReturnCue);
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const entranceOpacity = useRef(new Animated.Value(0)).current;
  const entranceTranslateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entranceOpacity, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(entranceTranslateY, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [entranceOpacity, entranceTranslateY]);

  return (
    <SafeAreaView edges={['right', 'bottom', 'left']} style={styles.safeArea}>
      <View style={styles.root}>
        <Pressable
          onPress={() => {
            queueMapReturnCue({
              accent: colors.info,
              message: `De volta ao mapa após ${title.toLowerCase()}. Continue desse ponto para manter o ritmo da rodada.`,
            });
            if (navigation.canGoBack()) {
              navigation.goBack();
              return;
            }

            navigation.navigate('Home');
          }}
          style={styles.backdrop}
        />

        <Animated.View
          style={[
            styles.sheet,
            {
              opacity: entranceOpacity,
              transform: [{ translateY: entranceTranslateY }],
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.hero}>
            <View style={styles.heroTopRow}>
              <Text style={styles.eyebrow}>{eyebrow}</Text>
              <Pressable
                onPress={() => {
                  queueMapReturnCue({
                    accent: colors.info,
                    message: `De volta ao mapa após ${title.toLowerCase()}. Continue desse ponto para manter o ritmo da rodada.`,
                  });
                  if (navigation.canGoBack()) {
                    navigation.goBack();
                    return;
                  }

                  navigation.navigate('Home');
                }}
                style={({ pressed }) => [
                  styles.mapReturnButton,
                  pressed ? styles.mapReturnButtonPressed : null,
                ]}
              >
                <Text style={styles.mapReturnButtonLabel}>Voltar ao mapa</Text>
              </Pressable>
            </View>
            <Text style={[styles.title, isCompact ? styles.titleCompact : null]}>{title}</Text>
            <Text style={[styles.subtitle, isCompact ? styles.subtitleCompact : null]}>{subtitle}</Text>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.content,
              isCompact ? styles.contentCompact : null,
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.body}>{children}</View>
          </ScrollView>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  sheet: {
    backgroundColor: 'rgba(17, 17, 17, 0.97)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '86%',
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    height: 5,
    marginBottom: 14,
    width: 54,
  },
  content: {
    gap: 18,
    paddingBottom: 20,
  },
  contentCompact: {
    gap: 14,
    paddingBottom: 16,
  },
  hero: {
    gap: 8,
  },
  heroTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  mapReturnButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.46)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mapReturnButtonPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  mapReturnButtonLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  titleCompact: {
    fontSize: 24,
    lineHeight: 30,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 420,
  },
  subtitleCompact: {
    fontSize: 13,
    lineHeight: 18,
    maxWidth: '100%',
  },
  body: {
    gap: 14,
  },
});
