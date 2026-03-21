import { Text, TextInput, View } from 'react-native';

import {
  formatTerritoryCountdown,
  formatTerritoryCurrency,
  formatTerritoryTimestamp,
  resolveBaileStatusLabel,
  resolveServiceStatusLabel,
} from '../features/territory';
import { colors } from '../theme/colors';
import { ActionButton, MiniToggle, StatusTag, styles } from './TerritoryScreen.parts';
import { type TerritoryScreenController } from './useTerritoryScreenController';
import { BAILE_TIERS, resolveBaileTierLabel } from './territoryScreenSupport';

export function TerritoryScreenServicesBaileSection({
  controller,
}: {
  controller: TerritoryScreenController;
}): JSX.Element | null {
  const {
    baileBook,
    baileBudgetInput,
    baileEntryPriceInput,
    handleInstallService,
    handleOrganizeBaile,
    handleUpgradeService,
    isMutating,
    nowMs,
    selectedActionVisibility,
    selectedBaileTier,
    selectedFavela,
    selectedServices,
    servicesBook,
    setBaileBudgetInput,
    setBaileEntryPriceInput,
    setSelectedBaileTier,
  } = controller;

  if (!selectedFavela) {
    return null;
  }

  return (
    <>
      {!selectedActionVisibility.showServices ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gestão territorial</Text>
          <Text style={styles.sectionSubtitle}>
            Arrego, serviços e baile só entram em cena quando a favela está sob a sua facção.
          </Text>
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Comando local indisponível</Text>
            <Text style={styles.detailCopy}>
              Enquanto {selectedFavela.name} não estiver dominada pela sua facção, esta tela mostra só leitura operacional, pressão, guerra e histórico de perdas.
            </Text>
          </View>
        </View>
      ) : null}

      {selectedActionVisibility.showServices ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Serviços</Text>
          <Text style={styles.sectionSubtitle}>
            Caixa da facção: {formatTerritoryCurrency(servicesBook?.factionBankMoney ?? 0)} · gerenciamento {servicesBook?.canManage ? 'liberado' : 'restrito'}
          </Text>

          {servicesBook ? (
            selectedServices.map((service) => (
              <View key={service.definition.type} style={styles.serviceCard}>
                <View style={styles.serviceHeader}>
                  <View style={styles.serviceHeaderCopy}>
                    <Text style={styles.serviceTitle}>{service.definition.label}</Text>
                    <Text style={styles.serviceSubtitle}>
                      {resolveServiceStatusLabel(service)} · receita atual {formatTerritoryCurrency(service.currentDailyRevenue)}/dia
                    </Text>
                  </View>
                  <StatusTag
                    label={service.installed ? `Nível ${service.level}` : 'Disponível'}
                    tone={service.active ? 'success' : 'neutral'}
                  />
                </View>

                <Text style={styles.serviceCopy}>
                  Mult. total x{service.revenueBreakdown.totalMultiplier.toFixed(2)} · dominação x{service.revenueBreakdown.territoryDominationMultiplier.toFixed(2)} · propina x{service.revenueBreakdown.propinaPenaltyMultiplier.toFixed(2)}
                </Text>
                <Text style={styles.serviceCopy}>
                  Receita acumulada {formatTerritoryCurrency(service.grossRevenueTotal)} · upgrade {service.nextUpgradeCost ? formatTerritoryCurrency(service.nextUpgradeCost) : '--'}
                </Text>

                <View style={styles.actionRow}>
                  {!service.installed ? (
                    <ActionButton
                      disabled={isMutating || !servicesBook.canManage}
                      label={`Instalar ${formatTerritoryCurrency(service.definition.installCost)}`}
                      onPress={() => {
                        void handleInstallService(service.definition.type);
                      }}
                      tone="accent"
                    />
                  ) : null}
                  {service.installed && service.isUpgradeable ? (
                    <ActionButton
                      disabled={isMutating || !servicesBook.canManage}
                      label={`Upgrade ${formatTerritoryCurrency(service.nextUpgradeCost ?? 0)}`}
                      onPress={() => {
                        void handleUpgradeService(service.definition.type);
                      }}
                      tone="info"
                    />
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.detailCard}>
              <Text style={styles.detailTitle}>Serviços indisponíveis no momento</Text>
              <Text style={styles.detailCopy}>
                A favela está sob sua facção, mas a leitura dos serviços falhou nesta atualização.
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {selectedActionVisibility.showBaile ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Baile funk</Text>
          <Text style={styles.sectionSubtitle}>
            Status {resolveBaileStatusLabel(baileBook?.baile.status ?? 'ready')} · último baile {formatTerritoryTimestamp(baileBook?.baile.lastOrganizedAt ?? null)}
          </Text>

          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Leitura do evento</Text>
            <Text style={styles.detailCopy}>
              Cooldown {formatTerritoryCountdown(baileBook?.baile.cooldownEndsAt ?? null, nowMs) ?? '--'} · ativo até {formatTerritoryTimestamp(baileBook?.baile.activeEndsAt ?? null)} · ressaca até {formatTerritoryTimestamp(baileBook?.baile.hangoverEndsAt ?? null)}
            </Text>
            <Text style={styles.detailCopy}>
              Último resultado {baileBook?.baile.resultTier ?? '--'} · boost de cansaço {baileBook?.baile.cansacoBoostPercent ?? 0}% · delta de satisfação {baileBook?.baile.satisfactionDelta ?? 0}
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formLabel}>Orçamento do baile</Text>
            <TextInput
              keyboardType="number-pad"
              onChangeText={setBaileBudgetInput}
              placeholder="45000"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={baileBudgetInput}
            />
            <Text style={styles.formLabel}>Ingresso</Text>
            <TextInput
              keyboardType="number-pad"
              onChangeText={setBaileEntryPriceInput}
              placeholder="120"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={baileEntryPriceInput}
            />
            <Text style={styles.formLabel}>Nível do MC</Text>
            <View style={styles.optionRow}>
              {BAILE_TIERS.map((tier) => (
                <MiniToggle
                  active={selectedBaileTier === tier}
                  key={tier}
                  label={resolveBaileTierLabel(tier)}
                  onPress={() => {
                    setSelectedBaileTier(tier);
                  }}
                />
              ))}
            </View>

            <View style={styles.actionRow}>
              <ActionButton
                disabled={isMutating || !servicesBook?.canManage}
                label="Organizar baile"
                onPress={() => {
                  void handleOrganizeBaile();
                }}
                tone="accent"
              />
            </View>
          </View>
        </View>
      ) : null}
    </>
  );
}
