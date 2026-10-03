import { Pressable, Text, View } from "react-native";
import { Body, Card, Heading, Screen, t, useAuth, useTheme } from "@sms/app-core";
import { useChild } from "@/child";

export default function Home() {
  const { cfg } = useAuth();
  const th = useTheme();
  const { people, current, isParent, select } = useChild();
  return (
    <Screen>
      <Body muted>{cfg?.name}</Body>
      {isParent && people.length > 1 ? (
        <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {people.map((p) => {
            const on = p.id === current?.id;
            return (
              <Pressable key={p.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => select(p.id)}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: on ? th.accent : th.line, backgroundColor: on ? th.accent : "transparent" }}>
                <Text style={{ color: on ? th.accentFg : th.text, fontSize: 15 }}>{p.firstName}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {current ? (
        <>
          <Heading>{current.firstName} {current.lastName}</Heading>
          <Card>
            <Body>{current.grade ? `${current.grade} ${current.section}` : "Not in a class yet"}</Body>
            <Body muted>{current.admissionNo}</Body>
          </Card>
        </>
      ) : <Body muted>{t("nothing")}</Body>}
      <Card><Body muted>Timetable, attendance and homework arrive in the next updates.</Body></Card>
    </Screen>
  );
}
