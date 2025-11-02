import { Stack } from "expo-router";
import { ToastProvider } from "../src/components/Toast";
import { ApiConfigProvider } from "../src/hooks/useApiConfig";

export default function RootLayout() {
  return (
    <ApiConfigProvider>
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ToastProvider>
    </ApiConfigProvider>
  );
}
