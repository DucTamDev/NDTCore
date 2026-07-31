// src/components/AppButton.tsx
import React from 'react';
import { Button, type ButtonProps } from 'react-native-paper';

export interface AppButtonProps extends Omit<ButtonProps, 'children'> {
  label: string;
}

export const AppButton: React.FC<AppButtonProps> = ({ label, ...rest }) => (
  <Button mode="contained" {...rest}>
    {label}
  </Button>
);
