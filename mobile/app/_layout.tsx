import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/auth/auth-context';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: 'Login' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="list/[id]" options={{ title: 'Lista' }} />
      </Stack>
    </AuthProvider>
  );
}
