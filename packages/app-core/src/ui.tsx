import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "./auth";

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const th = useTheme();
  const inset = useSafeAreaInsets();
  const pad = { paddingTop: inset.top + 16, paddingBottom: inset.bottom + 16, paddingHorizontal: 20 };
  return scroll
    ? <ScrollView style={{ backgroundColor: th.bg }} contentContainerStyle={[pad, { gap: 14, flexGrow: 1 }]} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    : <View style={[{ flex: 1, backgroundColor: th.bg, gap: 14 }, pad]}>{children}</View>;
}

export const Heading = ({ children }: { children: ReactNode }) => <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "700", color: useTheme().text }}>{children}</Text>;
export const Body = ({ children, muted }: { children: ReactNode; muted?: boolean }) => { const th = useTheme(); return <Text style={{ fontSize: 16, color: muted ? th.muted : th.text }}>{children}</Text>; };
export const ErrorText = ({ children }: { children: ReactNode }) => <Text accessibilityRole="alert" style={{ color: useTheme().danger, fontSize: 15 }}>{children}</Text>;

export function Button({ label, onPress, busy, kind = "primary" }: { label: string; onPress: () => void; busy?: boolean; kind?: "primary" | "plain" }) {
  const th = useTheme();
  const primary = kind === "primary";
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!busy, busy: !!busy }} disabled={busy} onPress={onPress}
      style={({ pressed }) => [s.btn, { backgroundColor: primary ? th.accent : "transparent", opacity: pressed || busy ? 0.7 : 1 }]}>
      {busy ? <ActivityIndicator color={primary ? th.accentFg : th.accent} /> : <Text style={{ color: primary ? th.accentFg : th.accent, fontSize: 16, fontWeight: "600" }}>{label}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const th = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: th.muted, fontSize: 14 }}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={th.muted} {...props}
        style={{ borderWidth: 1, borderColor: th.line, backgroundColor: th.surface, color: th.text, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16 }} />
    </View>
  );
}

export const Card = ({ children }: { children: ReactNode }) => { const th = useTheme(); return <View style={{ backgroundColor: th.surface, borderColor: th.line, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 16, gap: 6 }}>{children}</View>; };
const s = StyleSheet.create({ btn: { minHeight: 48, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 } });
