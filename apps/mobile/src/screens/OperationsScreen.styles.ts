import { StyleSheet } from 'react-native';

import { operationsScreenActionStyles } from './OperationsScreen.actionStyles';
import { operationsScreenContentStyles } from './OperationsScreen.contentStyles';

export const styles = StyleSheet.create({
  ...operationsScreenActionStyles,
  ...operationsScreenContentStyles,
});
