// src/components/AppSelect.tsx
import React, { useState } from 'react';
import { Menu, TextInput, TouchableRipple } from 'react-native-paper';

export interface AppSelectOption<T extends string> {
  label: string;
  value: T;
}

export interface AppSelectProps<T extends string> {
  label: string;
  value: T | undefined;
  options: Array<AppSelectOption<T>>;
  onSelect: (value: T) => void;
}

export function AppSelect<T extends string>({ label, value, options, onSelect }: AppSelectProps<T>): React.JSX.Element {
  const [visible, setVisible] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';

  return (
    <Menu
      visible={visible}
      onDismiss={() => setVisible(false)}
      anchor={
        <TouchableRipple onPress={() => setVisible(true)}>
          <TextInput label={label} value={selectedLabel} editable={false} mode="outlined" />
        </TouchableRipple>
      }
    >
      {options.map((option) => (
        <Menu.Item
          key={option.value}
          title={option.label}
          onPress={() => {
            onSelect(option.value);
            setVisible(false);
          }}
        />
      ))}
    </Menu>
  );
}
