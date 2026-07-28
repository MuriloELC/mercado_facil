import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Link } from 'react-router-dom';
import { intakeAdminNfce, intakeReceipt } from '../api/client';
import { NfceReviewItem, Receipt } from '../api/types';
import { StatusBadge } from '../components/StatusBadge';

type IntakePageProps = {
  token: string;
};

export function IntakePage({ token }: IntakePageProps) {
  const [mode, setMode] = useState<'receipt' | 'nfce_assisted'>('nfce_assisted');
  const [sourceType, setSourceType] = useState<'qrcode' | 'image' | 'manual'>(
    'image',
  );
  const [qrText, setQrText] = useState('');
  const [ocrHintText, setOcrHintText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdReceipt, setCreatedReceipt] = useState<Receipt | null>(null);
  const [createdNfce, setCreatedNfce] = useState<NfceReviewItem | null>(null);
  const [qrAutoExtractFeedback, setQrAutoExtractFeedback] = useState<string | null>(null);
  const [isDecodingQr, setIsDecodingQr] = useState(false);
  const decodeRequestRef = useRef(0);

  async function decodeQrFromImage(selectedFile: File): Promise<string | null> {
    const scannerId = 'intake-html5qrcode-hidden-reader';
    const scanner = new Html5Qrcode(scannerId, false);

    try {
      const decoded = await scanner.scanFile(selectedFile, true);
      const normalized = decoded.trim();
      return normalized ? normalized : null;
    } catch {
      return null;
    } finally {
      try {
        await scanner.clear();
      } catch {
        // No-op: scanner can fail clear when decode never initialized DOM rendering.
      }
    }
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(selectedFile);
    setQrAutoExtractFeedback(null);

    if (!selectedFile) {
      setIsDecodingQr(false);
      return;
    }

    const currentDecodeRequest = ++decodeRequestRef.current;
    setIsDecodingQr(true);

    const decodedQrText = await decodeQrFromImage(selectedFile);

    if (currentDecodeRequest !== decodeRequestRef.current) {
      return;
    }

    setIsDecodingQr(false);

    if (!decodedQrText) {
      setQrAutoExtractFeedback(
        'QR não detectado automaticamente nesta imagem. Você pode seguir com processamento manual.',
      );
      return;
    }

    if (mode === 'nfce_assisted') {
      setOcrHintText(decodedQrText);
    } else {
      setQrText(decodedQrText);
      setSourceType('qrcode');
    }

    setQrAutoExtractFeedback('QR detectado e preenchido automaticamente.');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const form = new FormData();
      if (file) {
        form.append('image', file);
      }

      if (mode === 'nfce_assisted') {
        if (ocrHintText.trim()) {
          form.append('ocr_hint_text', ocrHintText.trim());
        }

        const queueItem = await intakeAdminNfce(token, form);
        setCreatedNfce(queueItem);
        setCreatedReceipt(null);
      } else {
        form.append('source_type', sourceType);
        if (qrText.trim()) {
          form.append('qr_text', qrText.trim());
        }

        const receipt = await intakeReceipt(token, form);
        setCreatedReceipt(receipt);
        setCreatedNfce(null);
      }

      setQrText('');
      setOcrHintText('');
      setFile(null);
      setQrAutoExtractFeedback(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no intake.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h1 className="title">Intake de nota</h1>
      <p className="subtitle">
        Use o modo NFC-e assistida para entrar direto na fila com consulta oficial e scraping
        pós-captcha.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="mode">Modo de intake</label>
            <select
              id="mode"
              value={mode}
              onChange={(event) => setMode(event.target.value as 'receipt' | 'nfce_assisted')}
            >
              <option value="nfce_assisted">NFC-e assistida (recomendado)</option>
              <option value="receipt">Recibo padrão</option>
            </select>
          </div>

          {mode === 'receipt' ? (
            <div className="field">
              <label htmlFor="source_type">Tipo de origem</label>
              <select
                id="source_type"
                value={sourceType}
                onChange={(event) =>
                  setSourceType(event.target.value as 'qrcode' | 'image' | 'manual')
                }
              >
                <option value="image">image</option>
                <option value="qrcode">qrcode</option>
                <option value="manual">manual</option>
              </select>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="ocr_hint_text">Dica OCR (opcional)</label>
              <input
                id="ocr_hint_text"
                value={ocrHintText}
                onChange={(event) => setOcrHintText(event.target.value)}
                placeholder="Cole uma URL/chave se quiser ajudar a extração"
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="image">Imagem da nota</label>
            <input
              id="image"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageChange}
            />
            {isDecodingQr ? <span className="muted">Lendo QR automaticamente...</span> : null}
            {qrAutoExtractFeedback ? (
              <span className="muted">{qrAutoExtractFeedback}</span>
            ) : null}
          </div>
        </div>

        {mode === 'receipt' ? (
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="qr_text">QR text (opcional)</label>
            <textarea
              id="qr_text"
              value={qrText}
              onChange={(event) => setQrText(event.target.value)}
              placeholder="Cole aqui o texto/link do QR quando disponível"
            />
          </div>
        ) : null}

        {error ? <p className="error">{error}</p> : null}

        <div className="button-row">
          <button className="primary" type="submit" disabled={loading}>
            {loading
              ? 'Enviando...'
              : mode === 'nfce_assisted'
                ? 'Enviar para fila NFC-e assistida'
                : 'Registrar recibo'}
          </button>
          <Link to="/queue">Ir para fila</Link>
        </div>
      </form>

      {createdNfce ? (
        <div style={{ marginTop: 16 }} className="success">
          <p style={{ margin: 0 }}>
            Item NFC-e criado: <strong>{createdNfce.id}</strong>
          </p>
          <p style={{ margin: '8px 0 0' }}>
            <Link to="/queue">Abrir fila NFC-e</Link>
          </p>
        </div>
      ) : null}

      {createdReceipt ? (
        <div style={{ marginTop: 16 }} className="success">
          <p style={{ margin: 0 }}>
            Recibo criado: <strong>{createdReceipt.id}</strong>{' '}
            <StatusBadge status={createdReceipt.status} />
          </p>
          <p style={{ margin: '8px 0 0' }}>
            <Link to={`/receipts/${createdReceipt.id}`}>Abrir revisão manual</Link>
          </p>
        </div>
      ) : null}

      <div
        id="intake-html5qrcode-hidden-reader"
        style={{ width: 0, height: 0, overflow: 'hidden' }}
        aria-hidden="true"
      />
    </section>
  );
}
