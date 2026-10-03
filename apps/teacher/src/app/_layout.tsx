import { Slot } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthGate, AuthProvider } from "@sms/app-core";

// Principals and admins may use the teacher app too; students and parents may not.
const ROLES = ["teacher", "principal", "admin"];

export default function Root() {
  return (
    <SafeAreaProvider>
      <AuthProvider app="teacher" roles={ROLES}>
        <AuthGate wrongRoleMessage="This app is for teachers. Your account can't use it.">
          <Slot />
        </AuthGate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
