import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Text, View } from 'react-native';
import { login } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import { colors, spacing } from '@/components/theme';
import { Button, Field, Message, ScreenScroll } from '@/components/ui';

export default function LoginRoute() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      const response = await login(email.trim(), password);
      await signIn({ token: response.access_token, user: response.user });
      router.replace('/(tabs)/scanner');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScreenScroll>
        <View style={{ gap: spacing.sm }}>
          <Text selectable style={{ color: colors.text, fontSize: 28, fontWeight: '900' }}>Mercado Facil</Text>
          <Text selectable style={{ color: colors.textMuted, fontSize: 15 }}>Entre para escanear NFC-e e gerenciar suas listas.</Text>
        </View>
        <View style={{ gap: spacing.lg }}>
          <Field keyboardType="email-address" label="E-mail" onChangeText={setEmail} placeholder="voce@exemplo.com" value={email} />
          <Field label="Senha" onChangeText={setPassword} placeholder="Sua senha" secureTextEntry value={password} />
          {error ? <Message tone="error">{error}</Message> : null}
          <Button disabled={loading || !email.trim() || !password} label={loading ? 'Entrando...' : 'Entrar'} onPress={handleLogin} />
        </View>
      </ScreenScroll>
    </KeyboardAvoidingView>
  );
}
