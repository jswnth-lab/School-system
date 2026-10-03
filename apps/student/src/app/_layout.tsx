import { Slot } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthGate, AuthProvider } from "@sms/app-core";
import { ChildProvider } from "@/child";

// Students and their parents/guardians share this app; staff use the teacher app.
const ROLES = ["student", "parent"];

export default function Root() {
  return (
    <SafeAreaProvider>
      <AuthProvider app="student" roles={ROLES}>
        <AuthGate wrongRoleMessage="This app is for students and parents. Your account can't use it.">
          <ChildProvider>
            <Slot />
          </ChildProvider>
        </AuthGate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
