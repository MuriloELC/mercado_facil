import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  closeAdminNfcePlaywrightSession,
  getAdminNfcePlaywrightState,
  listAdminNfceReviewQueue,
  listReceipts,
  reprocessAdminNfceReviewItem,
  scrapeAdminNfceViaPlaywright,
  selectAdminNfceReviewItem,
  startAdminNfcePlaywrightSession,
} from '../api/client';
import { NfceReviewItem, ReceiptListItem, ReceiptStatus } from '../api/types';
import { StatusBadge } from '../components/StatusBadge';

type QueuePageProps = {
  token: string;
};

export function QueuePage({ token }: QueuePageProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ReceiptStatus | ''>('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<ReceiptListItem[]>([]);
  const [nfceStatus, setNfceStatus] = useState('');
  const [nfceItems, setNfceItems] = useState<NfceReviewItem[]>([]);
  const [sessionStateById, setSessionStateById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      const rows = await listReceipts(token, {
        status: status || undefined,
        search: search || undefined,
      });
      setItems(rows);

      const nfceRows = await listAdminNfceReviewQueue(token, nfceStatus || undefined);
      setNfceItems(nfceRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao listar filas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchData();
  }, []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void fetchData();
  }

  async function selectNfce(id: string) {
    try {
      await selectAdminNfceReviewItem(token, id);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao selecionar item NFC-e.');
    }
  }

  async function reprocessNfce(id: string) {
    const hint = window.prompt('Dica OCR opcional (URL/chave)');
    try {
      await reprocessAdminNfceReviewItem(token, id, hint ?? undefined);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao reprocessar NFC-e.');
    }
  }

  async function startPlaywright(item: NfceReviewItem) {
    try {
      await startAdminNfcePlaywrightSession(token, item.id);
      await fetchData();
      setSessionStateById((current) => ({
        ...current,
        [item.id]: 'Playwright iniciado. Resolva o captcha na janela aberta e depois clique em Scrape via Playwright.',
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao iniciar Playwright assistido.');
    }
  }

  async function refreshPlaywrightState(item: NfceReviewItem) {
    try {
      const state = await getAdminNfcePlaywrightState(token, item.id);
      const text = state.active
        ? `ativo | url: ${String(state.current_url ?? '')}`
        : 'sem sessao ativa';
      setSessionStateById((current) => ({
        ...current,
        [item.id]: text,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao consultar sessao Playwright.');
    }
  }

  async function scrapeViaPlaywright(item: NfceReviewItem) {
    try {
      await scrapeAdminNfceViaPlaywright(token, item.id);
      await fetchData();
      navigate(`/receipts/${item.receipt_id}?nfceQueueId=${item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no scraping via Playwright.');
    }
  }

  async function closePlaywright(item: NfceReviewItem) {
    try {
      await closeAdminNfcePlaywrightSession(token, item.id);
      setSessionStateById((current) => ({
        ...current,
        [item.id]: 'sessao encerrada',
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao encerrar sessao Playwright.');
    }
  }

  return (
    <section className="card">
      <h1 className="title">Filas de revisao</h1>
      <p className="subtitle">
        Fluxo recomendado: Start Playwright - resolver captcha na janela controlada - Scrape via Playwright.
      </p>

      <form onSubmit={onSubmit} className="form-grid" style={{ marginBottom: 14 }}>
        <div className="field">
          <label htmlFor="status">Status recibos</label>
          <select
            id="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as ReceiptStatus | '')}
          >
            <option value="">Todos</option>
            <option value="pending">pending</option>
            <option value="in_review">in_review</option>
            <option value="processed">processed</option>
            <option value="failed">failed</option>
            <option value="duplicate">duplicate</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="search">Busca recibos</label>
          <input
            id="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="access_key, mercado, cidade"
          />
        </div>

        <div className="field">
          <label htmlFor="nfce_status">Status NFC-e</label>
          <select
            id="nfce_status"
            value={nfceStatus}
            onChange={(event) => setNfceStatus(event.target.value)}
          >
            <option value="">Todos</option>
            <option value="received">received</option>
            <option value="extracting_reference">extracting_reference</option>
            <option value="reference_extracted">reference_extracted</option>
            <option value="pending_review">pending_review</option>
            <option value="in_review">in_review</option>
            <option value="extraction_failed">extraction_failed</option>
          </select>
        </div>

        <div className="button-row" style={{ alignSelf: 'end' }}>
          <button className="primary" type="submit" disabled={loading}>
            {loading ? 'Carregando...' : 'Filtrar'}
          </button>
          <button className="secondary" type="button" onClick={() => void fetchData()}>
            Atualizar
          </button>
        </div>
      </form>

      {error ? <p className="error">{error}</p> : null}

      <h2>Fila NFC-e (Playwright assistido)</h2>
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Status</th>
            <th>Referencia</th>
            <th>Captcha/Scraping</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          {nfceItems.length === 0 ? (
            <tr>
              <td colSpan={5} className="muted">Nenhum item NFC-e na fila.</td>
            </tr>
          ) : null}
          {nfceItems.map((item) => (
            <tr key={item.id}>
              <td>
                <code>{item.id.slice(0, 8)}...</code>
                <div className="muted">{item.original_filename ?? 'arquivo'}</div>
              </td>
              <td>{item.status}</td>
              <td className="nfce-reference">
                {item.extracted_type ? `${item.extracted_type}: ${item.extracted_value}` : '-'}
                <div className="muted">tentativas extracao: {item.extraction_attempts}</div>
              </td>
              <td>
                captcha: {item.captcha_status}
                <div className="muted">scraping: {item.scraping_status}</div>
                <div className="muted">{item.last_error ?? ''}</div>
                <div className="muted">{sessionStateById[item.id] ?? ''}</div>
              </td>
              <td className="nfce-actions">
                <div className="button-row">
                  <button className="secondary" type="button" onClick={() => void selectNfce(item.id)}>
                    Selecionar
                  </button>
                  <button className="secondary" type="button" onClick={() => void startPlaywright(item)}>
                    Start Playwright
                  </button>
                  <button className="secondary" type="button" onClick={() => void refreshPlaywrightState(item)}>
                    Estado sessao
                  </button>
                  <button className="secondary" type="button" onClick={() => void scrapeViaPlaywright(item)}>
                    Scrape via Playwright
                  </button>
                  <button className="secondary" type="button" onClick={() => void closePlaywright(item)}>
                    Fechar Playwright
                  </button>
                  <button className="secondary" type="button" onClick={() => void reprocessNfce(item.id)}>
                    Reprocessar referencia
                  </button>
                  <Link to={`/receipts/${item.receipt_id}?nfceQueueId=${item.id}`}>Revisar</Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 18 }}>Fila de recibos</h2>
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Status</th>
            <th>Mercado</th>
            <th>Criado em</th>
            <th>Uploads</th>
            <th>Acao</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <code>{item.id.slice(0, 8)}...</code>
                <div className="muted">{item.access_key ?? 'sem access_key'}</div>
              </td>
              <td>
                <StatusBadge status={item.status} />
              </td>
              <td>
                {item.market_name ?? '-'}
                <div className="muted">{item.market_city ?? ''}</div>
              </td>
              <td>{new Date(item.created_at).toLocaleString()}</td>
              <td>{item.upload_count}</td>
              <td>
                <Link to={`/receipts/${item.id}`}>Abrir</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
