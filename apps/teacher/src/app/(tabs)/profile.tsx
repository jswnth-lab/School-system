import { APP_VERSION, Body, Button, Card, Heading, Screen, t, useAuth } from "@sms/app-core";

export default function Profile() {
  const { profile, cfg, signOut, forgetSchool, baked } = useAuth();
  return (
    <Screen>
      <Heading>{t("profile")}</Heading>
      <Card>
        <Body>{profile?.name}</Body>
        {profile?.teacher ? <Body muted>{profile.teacher.employeeNo}</Body> : null}
        <Body muted>{cfg?.name}</Body>
        {profile?.impersonating ? <Body muted>Platform admin view</Body> : null}
      </Card>
      <Button label={t("signOut")} onPress={signOut} />
      {!baked ? <Button kind="plain" label={t("changeSchool")} onPress={async () => { await signOut(); await forgetSchool(); }} /> : null}
      <Body muted>Version {APP_VERSION}</Body>
    </Screen>
  );
}
