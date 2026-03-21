import type { GpTemplateSummary, OwnedPropertySummary, RegionId } from '@cs-rio/shared';

import type { OperationsDashboardData, OperationsTab } from '../features/operations';
import type {
  HireQuantity,
  OperationResultState,
  SlotMachineActionMode,
} from './operationsScreenSupport';

export interface UseOperationsScreenMutationsInput {
  gpHireQuantity: HireQuantity;
  hireQuantity: HireQuantity;
  loadDashboard: () => Promise<OperationsDashboardData | null>;
  playerMoney: number;
  playerRegionId: RegionId | null;
  puteiroAcquisition: ReturnType<
    typeof import('../features/operations').buildPuteiroAcquisitionState
  >;
  selectedGpTemplate: GpTemplateSummary | null;
  selectedOperation: ReturnType<
    typeof import('../features/operations').resolvePropertyOperationSnapshot
  > | null;
  selectedProperty: OwnedPropertySummary | null;
  selectedPuteiro: Awaited<
    ReturnType<typeof import('../services/api').puteiroApi.list>
  >['puteiros'][number] | null;
  selectedSoldierTemplate:
    | OperationsDashboardData['propertyBook']['soldierTemplates'][number]
    | null;
  setActiveTab: (tab: OperationsTab) => void;
  setBootstrapStatus: (status: string) => void;
  setError: (value: string | null) => void;
  setFeedback: (value: string | null) => void;
  setIsSubmitting: (value: boolean) => void;
  setOperationResult: (value: OperationResultState | null) => void;
  setPendingFocusPropertyId: (value: string | null) => void;
  setSelectedPropertyId: (value: string | null) => void;
  setSlotMachineActionMode: (value: SlotMachineActionMode) => void;
  slotMachineAcquisition: ReturnType<
    typeof import('../features/operations').buildSlotMachineAcquisitionState
  >;
  slotMachineHouseEdgeInput: string;
  slotMachineInstallQuantityInput: string;
  slotMachineJackpotInput: string;
  slotMachineMaxBetInput: string;
  slotMachineMinBetInput: string;
}
