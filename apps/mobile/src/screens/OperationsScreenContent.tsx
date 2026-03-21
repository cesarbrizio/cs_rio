import { InGameScreenLayout } from '../components/InGameScreenLayout';
import { OperationResultModal } from './OperationsScreen.parts';
import { OperationsScreenCatalogSection } from './OperationsScreenCatalogSection';
import { OperationsScreenDiscoverySection } from './OperationsScreenDiscoverySection';
import { OperationsScreenOverviewSection } from './OperationsScreenOverviewSection';
import { OperationsScreenPortfolioSection } from './OperationsScreenPortfolioSection';
import { OperationsScreenPropertyPanelSection } from './OperationsScreenPropertyPanelSection';
import { OperationsScreenSecuritySection } from './OperationsScreenSecuritySection';
import { useOperationsScreenController } from './useOperationsScreenController';

export function OperationsScreen(): JSX.Element {
  const controller = useOperationsScreenController();

  return (
    <InGameScreenLayout
      subtitle="Separe o que gira caixa do que sustenta mobilidade, proteção, slots e recuperação do personagem."
      title="Gerir ativos"
    >
      <OperationsScreenOverviewSection controller={controller} />
      <OperationsScreenDiscoverySection controller={controller} />
      <OperationsScreenCatalogSection controller={controller} />
      <OperationsScreenPortfolioSection controller={controller} />
      <OperationsScreenPropertyPanelSection controller={controller} />
      <OperationsScreenSecuritySection controller={controller} />
      <OperationResultModal
        message={controller.operationResult?.message ?? null}
        onClose={() => {
          controller.setOperationResult(null);
        }}
        title={controller.operationResult?.title ?? 'Operação atualizada'}
      />
    </InGameScreenLayout>
  );
}
