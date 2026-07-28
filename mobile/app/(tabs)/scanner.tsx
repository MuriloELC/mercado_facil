import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { sendNfceQrText } from '@/api/client';
import { NfceReviewItem } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import { colors, spacing } from '@/components/theme';
import { Button, Field, Message, ScreenScroll, Section } from '@/components/ui';

export default function ScannerRoute() {
  const { session } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [detectedText, setDetectedText] = useState('');
  const [manualText, setManualText] = useState('');
  const [createdItem, setCreatedItem] = useState<NfceReviewItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const qrText = detectedText || manualText.trim();

  function handleBarcodeScanned(result: BarcodeScanningResult) {
    const value = result.data?.trim();
    if (!value || detectedText) {
      return;
    }

    setDetectedText(value);
    setCreatedItem(null);
    setError(null);
  }

  async function handleSend() {
    if (!session || !qrText) {
      return;
    }

    setSending(true);
    setError(null);
    setCreatedItem(null);

    try {
      const item = await sendNfceQrText(session.token, qrText);
      setCreatedItem(item);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar NFC-e.');
    } finally {
      setSending(false);
    }
  }

  function resetScan() {
    setDetectedText('');
    setManualText('');
    setCreatedItem(null);
    setError(null);
  }

  if (!permission) {
    return <ScreenScroll refreshing />;
  }

  if (!permission.granted) {
    return (
      <ScreenScroll>
        <Section
          title="Camera"
          subtitle="A permissao de camera e necessaria para ler o QR Code."
        >
          <Button label="Permitir camera" onPress={requestPermission} />
        </Section>
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll>
      <View
        style={{
          overflow: 'hidden',
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: '#000000',
          aspectRatio: 3 / 4,
        }}
      >
        <CameraView
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          facing="back"
          onBarcodeScanned={detectedText ? undefined : handleBarcodeScanned}
          style={{ flex: 1 }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: '12%',
            right: '12%',
            top: '28%',
            height: '32%',
            borderColor: '#FFFFFF',
            borderRadius: 16,
            borderWidth: 2,
          }}
        />
      </View>

      <Section title="QR Code NFC-e">
        {detectedText ? (
          <Message tone="success">QR lido. Confirme o envio para a fila NFC-e.</Message>
        ) : (
          <Message>Posicione o QR Code dentro da area marcada.</Message>
        )}

        {detectedText ? (
          <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
            {detectedText}
          </Text>
        ) : (
          <Field
            label="Entrada manual"
            onChangeText={setManualText}
            placeholder="Cole a URL ou chave da NFC-e"
            value={manualText}
          />
        )}

        {error ? <Message tone="error">{error}</Message> : null}
        {createdItem ? (
          <Message tone="success">
            NFC-e enviada: {createdItem.status} ({createdItem.id})
          </Message>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <Button
            disabled={!qrText || sending}
            label={sending ? 'Enviando...' : 'Enviar'}
            onPress={handleSend}
          />
          <Button label="Ler novamente" onPress={resetScan} variant="secondary" />
        </View>
      </Section>
    </ScreenScroll>
  );
}
