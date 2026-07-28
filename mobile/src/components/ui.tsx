import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { colors, spacing } from './theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function ScreenScroll({
  children,
  refreshing,
}: {
  children?: React.ReactNode;
  refreshing?: boolean;
}) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        gap: spacing.lg,
        padding: spacing.lg,
        paddingBottom: 40,
        backgroundColor: colors.background,
      }}
    >
      {refreshing ? <ActivityIndicator color={colors.primary} /> : null}
      {children}
    </ScrollView>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
}) {
  const palette = {
    primary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      color: '#FFFFFF',
    },
    secondary: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      color: colors.text,
    },
    danger: {
      backgroundColor: colors.dangerMuted,
      borderColor: colors.dangerMuted,
      color: colors.danger,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      color: colors.primary,
    },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        backgroundColor: palette.backgroundColor,
        borderColor: palette.borderColor,
      })}
    >
      <Text
        selectable
        style={{
          color: palette.color,
          fontSize: 16,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text
        selectable
        style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}
      >
        {label}
      </Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        style={{
          minHeight: 48,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          color: colors.text,
          fontSize: 16,
          paddingHorizontal: spacing.md,
        }}
        value={value}
      />
    </View>
  );
}

export function Section({
  title,
  children,
  subtitle,
}: {
  title: string;
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <View
      style={{
        gap: spacing.md,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.lg,
      }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text
          selectable
          style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text selectable style={{ color: colors.textMuted, fontSize: 14 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function Message({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'error' | 'success' | 'warning';
}) {
  const palette = {
    neutral: { backgroundColor: colors.surfaceMuted, color: colors.text },
    error: { backgroundColor: colors.dangerMuted, color: colors.danger },
    success: { backgroundColor: colors.primaryMuted, color: colors.primary },
    warning: { backgroundColor: colors.warningMuted, color: colors.warning },
  }[tone];

  return (
    <View
      style={{
        borderRadius: 8,
        backgroundColor: palette.backgroundColor,
        padding: spacing.md,
      }}
    >
      <Text selectable style={{ color: palette.color, fontSize: 14 }}>
        {children}
      </Text>
    </View>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            key={option.value}
            onPress={() => onChange(option.value)}
            style={{
              minHeight: 38,
              justifyContent: 'center',
              borderRadius: 99,
              borderWidth: 1,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected ? colors.primaryMuted : colors.surface,
              paddingHorizontal: spacing.md,
            }}
          >
            <Text
              selectable
              style={{
                color: selected ? colors.primary : colors.text,
                fontWeight: selected ? '800' : '600',
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
