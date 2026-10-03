import { Body, Card, Heading, Screen, t, useAuth, useFetch } from "@sms/app-core";

type Row = { id: string; sectionId: string; subjectId: string; teacherId: string };
type Named = { id: string; label?: string; name?: string };

/** The classes and subjects this teacher is assigned to, from the school's teaching assignments. */
export default function Classes() {
  const { slug, profile } = useAuth();
  const teaching = useFetch<Row[]>(`/${slug}/people/teaching`);
  const sections = useFetch<Named[]>(`/${slug}/structure/sections`);
  const subjects = useFetch<Named[]>(`/${slug}/structure/subjects`);
  const mine = (teaching.data ?? []).filter((r) => r.teacherId === profile?.teacher?.id);
  const bySection = new Map<string, string[]>();
  for (const r of mine) {
    const sub = subjects.data?.find((s) => s.id === r.subjectId)?.name ?? "";
    bySection.set(r.sectionId, [...(bySection.get(r.sectionId) ?? []), sub]);
  }
  const error = teaching.error ?? sections.error ?? subjects.error;
  return (
    <Screen>
      <Heading>{t("classes")}</Heading>
      {error ? <Body muted>{error}</Body> : null}
      {[...bySection].map(([sid, subs]) => (
        <Card key={sid}>
          <Body>{sections.data?.find((s) => s.id === sid)?.label}</Body>
          <Body muted>{subs.join(", ")}</Body>
        </Card>
      ))}
      {!teaching.loading && !bySection.size && !error ? <Body muted>{t("nothing")}</Body> : null}
    </Screen>
  );
}
