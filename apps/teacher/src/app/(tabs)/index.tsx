import { useEffect, useState } from "react";
import { Body, Card, Heading, Screen, queue, useAuth } from "@sms/app-core";

export default function Today() {
  const { profile, cfg } = useAuth();
  const [pending, setPending] = useState(0);
  useEffect(() => { queue.size().then(setPending); }, []);
  const name = profile?.teacher ? `${profile.teacher.firstName} ${profile.teacher.lastName}` : profile?.name;
  return (
    <Screen>
      <Heading>{name}</Heading>
      <Body muted>{cfg?.name}</Body>
      <Card>
        <Body>{pending ? `${pending} change${pending > 1 ? "s" : ""} waiting to sync` : "Everything is synced"}</Body>
        <Body muted>Attendance and the day's timetable arrive in the next update.</Body>
      </Card>
    </Screen>
  );
}
