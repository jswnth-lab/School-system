import { useState, type ReactNode } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { ApiError, } from "./api";
import { API_URL } from "./config";
import { useAuth, useTheme } from "./auth";
import { t } from "./i18n";
import { Body, Button, ErrorText, Field, Heading, Screen } from "./ui";

function Notice({ title, body, action, onAction, secondary, onSecondary }: { title: string; body?: string; action?: string; onAction?: () => void; secondary?: string; onSecondary?: () => void }) {
  return (
    <Screen>
      <Heading>{title}</Heading>
      {body ? <Body muted>{body}</Body> : null}
      {action && onAction ? <Button label={action} onPress={onAction} /> : null}
      {secondary && onSecondary ? <Button kind="plain" label={secondary} onPress={onSecondary} /> : null}
    </Screen>
  );
}

function SchoolCode() {
  const { setSchool, message } = useAuth();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setErr(null);
    try { await setSchool(code); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <Screen>
      <Heading>{t("schoolCode")}</Heading>
      <Body muted>{t("schoolCodeHint")}</Body>
      <Field label={t("schoolCode")} value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} returnKeyType="go" onSubmitEditing={go} />
      {(err ?? message) ? <ErrorText>{err ?? message}</ErrorText> : null}
      <Button label={t("continue")} onPress={go} busy={busy} />
    </Screen>
  );
}

function SignIn() {
  const { cfg, signIn, forgetSchool, baked } = useAuth();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setErr(null);
    try { await signIn(id.trim(), pw); } catch (e) { setErr(e instanceof ApiError ? e.message : t("offline")); setBusy(false); }
  };
  return (
    <Screen>
      <View style={{ alignItems: "center", gap: 10, marginTop: 24 }}>
        {cfg?.logoUrl ? <Image accessibilityIgnoresInvertColors source={{ uri: `${API_URL}${cfg.logoUrl}` }} style={{ width: 88, height: 88 }} resizeMode="contain" /> : null}
        <Heading>{cfg?.name}</Heading>
      </View>
      <Field label={t("identifier")} value={id} onChangeText={setId} autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" />
      <Field label={t("password")} value={pw} onChangeText={setPw} secureTextEntry autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={go} />
      {err ? <ErrorText>{err}</ErrorText> : null}
      <Button label={busy ? t("signingIn") : t("signIn")} onPress={go} busy={busy} />
      {!baked ? <Button kind="plain" label={t("changeSchool")} onPress={forgetSchool} /> : null}
    </Screen>
  );
}

/** Shows the right screen for the auth state; renders `children` only for a signed-in user with an allowed role. */
export function AuthGate({ children, wrongRoleMessage }: { children: ReactNode; wrongRoleMessage: string }) {
  const a = useAuth();
  const th = useTheme();
  switch (a.status) {
    case "loading": return <View style={{ flex: 1, backgroundColor: th.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={th.accent} size="large" /></View>;
    case "update-required": return <Notice title={t("updateTitle")} body={t("updateBody")} />;
    case "error": return <Notice title={a.message ?? t("offline")} action={t("retry")} onAction={a.retry} secondary={a.baked ? undefined : t("changeSchool")} onSecondary={a.forgetSchool} />;
    case "needs-school": return <SchoolCode />;
    case "signed-out": return <SignIn />;
    case "wrong-app": return <Notice title={wrongRoleMessage} action={t("signOut")} onAction={a.signOut} />;
    case "signed-in": return <>{children}</>;
  }
}
