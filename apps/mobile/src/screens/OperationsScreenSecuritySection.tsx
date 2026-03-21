import { Pressable, Text, View } from 'react-native';

import { formatOperationsCurrency } from '../features/operations';
import { styles } from './OperationsScreen.parts';
import type { OperationsScreenController } from './useOperationsScreenController';

export function OperationsScreenSecuritySection({
  controller,
}: {
  controller: OperationsScreenController;
}): JSX.Element | null {
  if (!controller.selectedProperty) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Segurança e soldados</Text>
      <View style={styles.detailCard}>
        <Text style={styles.infoBlockCopy}>
          Capacidade: {controller.selectedProperty.soldiersCount}/
          {controller.selectedProperty.definition.soldierCapacity} · Poder total{' '}
          {controller.selectedProperty.protection.soldiersPower}
        </Text>

        {controller.selectedProperty.soldierRoster.length > 0 ? (
          <View style={styles.cardList}>
            {controller.selectedProperty.soldierRoster.map((soldier) => (
              <View key={soldier.type} style={styles.rosterCard}>
                <Text style={styles.rosterTitle}>{soldier.label}</Text>
                <Text style={styles.rosterCopy}>
                  {soldier.count} alocados · Poder {soldier.totalPower} · Custo{' '}
                  {formatOperationsCurrency(soldier.dailyCost)}/dia
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.infoBlockCopy}>
            Nenhum soldado alocado. Use os modelos abaixo para reforçar o ativo.
          </Text>
        )}

        {controller.selectedProperty.definition.soldierCapacity > 0 ? (
          <>
            <View style={styles.choiceRow}>
              {controller.unlockedSoldierTemplates.map((template) => (
                <Pressable
                  key={template.type}
                  onPress={() => {
                    controller.setSelectedSoldierType(template.type);
                  }}
                  style={({ pressed }) => [
                    styles.choiceChip,
                    controller.selectedSoldierTemplate?.type === template.type
                      ? styles.choiceChipSelected
                      : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <Text style={styles.choiceChipTitle}>{template.label}</Text>
                  <Text style={styles.choiceChipCopy}>
                    {template.power} poder · {formatOperationsCurrency(template.dailyCost)}/dia
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.quantityRow}>
              {[1, 3, 5].map((quantity) => (
                <Pressable
                  key={quantity}
                  onPress={() => {
                    controller.setHireQuantity(quantity as 1 | 3 | 5);
                  }}
                  style={({ pressed }) => [
                    styles.quantityChip,
                    controller.hireQuantity === quantity
                      ? styles.quantityChipSelected
                      : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <Text style={styles.quantityChipLabel}>{quantity}x</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              disabled={!controller.canHireSoldiers}
              onPress={() => {
                void controller.actions.handleHireSoldiers();
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                !controller.canHireSoldiers ? styles.buttonDisabled : null,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <Text style={styles.primaryButtonLabel}>
                Contratar {controller.hireQuantity}x{' '}
                {controller.selectedSoldierTemplate?.label ?? 'soldado'}
              </Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.infoBlockCopy}>
            Este ativo não aceita guarda dedicada. A proteção aqui depende da facção e do domínio
            territorial.
          </Text>
        )}
      </View>
    </View>
  );
}
