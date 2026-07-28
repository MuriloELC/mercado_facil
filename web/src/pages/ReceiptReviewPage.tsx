import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  claimReceipt,
  classifyProduct,
  getAdminNfceManualPrefill,
  getReceipt,
  listMarkets,
  listProducts,
  manualProcessReceipt,
  markDuplicate,
  markFailed,
} from '../api/client';
import {
  ManualProcessPayload,
  Market,
  Product,
  ProductClassificationCandidate,
  Receipt,
} from '../api/types';
import { StatusBadge } from '../components/StatusBadge';

type ReceiptReviewPageProps = {
  token: string;
};

type ItemDraft = {
  raw_description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  total_price: string;
  canonical_product_id: string;
  new_product_name: string;
  new_product_category: string;
  alias_text: string;
  classification_source: 'manual' | 'rag_confirmed';
  classification_confidence?: number;
};

type SuggestionState = {
  loading: boolean;
  error: string | null;
  candidates: ProductClassificationCandidate[];
};

const emptyItem = (): ItemDraft => ({
  raw_description: '',
  quantity: '1',
  unit: '',
  unit_price: '',
  total_price: '',
  canonical_product_id: '',
  new_product_name: '',
  new_product_category: '',
  alias_text: '',
  classification_source: 'manual',
  classification_confidence: undefined,
});

export function ReceiptReviewPage({ token }: ReceiptReviewPageProps) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const nfceQueueId = searchParams.get('nfceQueueId');

  const navigate = useNavigate();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [selectedMarketId, setSelectedMarketId] = useState('');
  const [newMarketName, setNewMarketName] = useState('');
  const [newMarketCity, setNewMarketCity] = useState('');
  const [newMarketStateCode, setNewMarketStateCode] = useState('');
  const [newMarketNeighborhood, setNewMarketNeighborhood] = useState('');
  const [newMarketAddressLine, setNewMarketAddressLine] = useState('');
  const [newMarketCnpj, setNewMarketCnpj] = useState('');
  const [newMarketPostalCode, setNewMarketPostalCode] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [suggestions, setSuggestions] = useState<Record<number, SuggestionState>>(
    {},
  );

  const [nfceHint, setNfceHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const productOptions = useMemo(() => {
    return products.map((product) => `${product.id} | ${product.canonical_name}`);
  }, [products]);

  async function loadData() {
    if (!id) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [receiptData, marketData, productData] = await Promise.all([
        getReceipt(token, id),
        listMarkets(token),
        listProducts(token),
      ]);

      setReceipt(receiptData);
      setMarkets(marketData);
      setProducts(productData);

      setSelectedMarketId(receiptData.market_id ?? '');
      setPurchaseDate(receiptData.purchase_date ?? '');
      setTotalAmount(receiptData.total_amount ?? '');

      if (receiptData.items.length > 0) {
        setItems(
          receiptData.items.map((item) => ({
            raw_description: item.raw_description,
            quantity: item.quantity,
            unit: item.unit ?? '',
            unit_price: item.unit_price ?? '',
            total_price: item.total_price ?? '',
            canonical_product_id: item.canonical_product_id ?? '',
            new_product_name: '',
            new_product_category: '',
            alias_text: item.raw_description,
            classification_source: item.classification_source ?? 'manual',
            classification_confidence: item.confidence_score
              ? Number(item.confidence_score)
              : undefined,
          })),
        );
      } else {
        setItems([emptyItem()]);
      }

      if (nfceQueueId) {
        const prefillResp = await getAdminNfceManualPrefill(token, nfceQueueId);
        applyNfcePrefill(prefillResp.prefill);
        setNfceHint(
          `NFC-e: captcha=${prefillResp.captcha_status}, scraping=${prefillResp.scraping_status}`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar recibo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [id, nfceQueueId]);

  function applyNfcePrefill(prefill: {
    market?: {
      name: string;
      city: string;
      state_code?: string;
      neighborhood?: string;
      address_line?: string;
      cnpj?: string;
      postal_code?: string;
    } | null;
    purchase_date?: string;
    total_amount?: number;
    items?: Array<{
      raw_description: string;
      quantity: number;
      unit?: string;
      unit_price?: number;
      total_price?: number;
      alias_text?: string;
    }>;
  }) {
    if (!prefill) {
      return;
    }

    if (prefill.market && !selectedMarketId) {
      setNewMarketName(prefill.market.name ?? '');
      setNewMarketCity(prefill.market.city ?? '');
      setNewMarketStateCode(prefill.market.state_code ?? '');
      setNewMarketNeighborhood(prefill.market.neighborhood ?? '');
      setNewMarketAddressLine(prefill.market.address_line ?? '');
      setNewMarketCnpj(prefill.market.cnpj ?? '');
      setNewMarketPostalCode(prefill.market.postal_code ?? '');
    }

    if (prefill.purchase_date) {
      setPurchaseDate(prefill.purchase_date);
    }

    if (typeof prefill.total_amount === 'number' && Number.isFinite(prefill.total_amount)) {
      setTotalAmount(String(prefill.total_amount));
    }

    if (prefill.items && prefill.items.length > 0) {
      setItems(
        prefill.items.map((item) => ({
          raw_description: item.raw_description,
          quantity: String(item.quantity ?? 1),
          unit: item.unit ?? '',
          unit_price:
            typeof item.unit_price === 'number' ? String(item.unit_price) : '',
          total_price:
            typeof item.total_price === 'number' ? String(item.total_price) : '',
          canonical_product_id: '',
          new_product_name: '',
          new_product_category: '',
          alias_text: item.alias_text ?? item.raw_description,
          classification_source: 'manual',
          classification_confidence: undefined,
        })),
      );
    }
  }

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  async function runClassifyItem(index: number) {
    const item = items[index];
    const description = item?.raw_description.trim();
    if (!item || !description) return;

    setSuggestions((current) => ({
      ...current,
      [index]: { loading: true, error: null, candidates: [] },
    }));

    try {
      const response = await classifyProduct(token, {
        raw_description: description,
        unit: item.unit.trim() || undefined,
        top_k: 5,
      });
      setSuggestions((current) => ({
        ...current,
        [index]: { loading: false, error: null, candidates: response.candidates },
      }));
    } catch (err) {
      setSuggestions((current) => ({
        ...current,
        [index]: {
          loading: false,
          error:
            err instanceof Error
              ? err.message
              : 'Classificador indisponível. Continue a revisão manual.',
          candidates: [],
        },
      }));
    }
  }

  function selectSuggestion(
    index: number,
    candidate: ProductClassificationCandidate,
  ) {
    updateItem(index, {
      canonical_product_id: candidate.canonical_product_id,
      new_product_name: '',
      new_product_category: '',
      classification_source: 'rag_confirmed',
      classification_confidence: candidate.confidence,
    });
  }

  async function runClaim() {
    if (!id) return;
    setWorking(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await claimReceipt(token, id);
      setReceipt(updated);
      setSuccess('Recibo marcado como in_review.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao claim.');
    } finally {
      setWorking(false);
    }
  }

  async function runMarkFailed() {
    if (!id) return;
    setWorking(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await markFailed(token, id);
      setReceipt(updated);
      setSuccess('Recibo marcado como failed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao marcar failed.');
    } finally {
      setWorking(false);
    }
  }

  async function runMarkDuplicate() {
    if (!id) return;
    setWorking(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await markDuplicate(token, id);
      setReceipt(updated);
      setSuccess('Recibo marcado como duplicate.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao marcar duplicate.');
    } finally {
      setWorking(false);
    }
  }

  async function runManualProcess() {
    if (!id) {
      return;
    }

    setWorking(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = buildPayload();
      const updated = await manualProcessReceipt(token, id, payload);
      setReceipt(updated);
      setSuccess('Recibo processado manualmente com sucesso.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao processar manualmente.');
    } finally {
      setWorking(false);
    }
  }

  function buildPayload(): ManualProcessPayload {
    if (!selectedMarketId && (!newMarketName.trim() || !newMarketCity.trim())) {
      throw new Error('Selecione um mercado existente ou informe nome/cidade de um novo mercado.');
    }

    const normalizedItems = items
      .map((item) => ({ ...item, raw_description: item.raw_description.trim() }))
      .filter((item) => item.raw_description.length > 0)
      .map((item) => {
        const quantity = Number(item.quantity || '0');
        const unitPrice = item.unit_price ? Number(item.unit_price) : undefined;
        const totalPrice = item.total_price ? Number(item.total_price) : undefined;

        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error('Todos os itens devem ter quantidade maior que zero.');
        }

        if (unitPrice !== undefined && (!Number.isFinite(unitPrice) || unitPrice <= 0)) {
          throw new Error('unit_price deve ser maior que zero.');
        }

        if (totalPrice !== undefined && (!Number.isFinite(totalPrice) || totalPrice <= 0)) {
          throw new Error('total_price deve ser maior que zero.');
        }

        const normalizedProductId = item.canonical_product_id.includes('|')
          ? item.canonical_product_id.split('|')[0].trim()
          : item.canonical_product_id.trim();

        return {
          raw_description: item.raw_description,
          quantity,
          unit: item.unit || undefined,
          unit_price: unitPrice,
          total_price: totalPrice,
          canonical_product_id: normalizedProductId || undefined,
          classification_source: normalizedProductId
            ? item.classification_source
            : undefined,
          classification_confidence: normalizedProductId
            ? item.classification_confidence
            : undefined,
          canonical_product: normalizedProductId
            ? undefined
            : item.new_product_name.trim()
              ? {
                  canonical_name: item.new_product_name.trim(),
                  category: item.new_product_category.trim() || undefined,
                }
              : undefined,
          alias_text: item.alias_text.trim() || item.raw_description,
        };
      });

    if (normalizedItems.length === 0) {
      throw new Error('Adicione ao menos um item valido para processar.');
    }

    const payload: ManualProcessPayload = {
      purchase_date: purchaseDate || undefined,
      total_amount: totalAmount ? Number(totalAmount) : undefined,
      items: normalizedItems,
    };

    if (selectedMarketId) {
      payload.market_id = selectedMarketId;
    } else {
      payload.market = {
        name: newMarketName.trim(),
        city: newMarketCity.trim(),
        state_code: newMarketStateCode.trim() || undefined,
        neighborhood: newMarketNeighborhood.trim() || undefined,
        address_line: newMarketAddressLine.trim() || undefined,
        cnpj: newMarketCnpj.trim() || undefined,
        postal_code: newMarketPostalCode.trim() || undefined,
      };
    }

    return payload;
  }

  if (!id) {
    return <p className="error">ID do recibo nao informado.</p>;
  }

  if (loading) {
    return <p className="muted">Carregando dados do recibo...</p>;
  }

  if (!receipt) {
    return <p className="error">Recibo nao encontrado.</p>;
  }

  return (
    <section className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 className="title">Revisao manual</h1>
          <p className="subtitle">
            Recibo <code>{receipt.id}</code>
          </p>
        </div>
        <div>
          <StatusBadge status={receipt.status} />
        </div>
      </div>

      <div className="muted">
        Criado em {new Date(receipt.created_at).toLocaleString()} | source_type:{' '}
        {receipt.source_type}
      </div>
      {nfceHint ? <div className="muted">{nfceHint}</div> : null}

      <div className="button-row" style={{ marginTop: 12 }}>
        <button className="secondary" type="button" onClick={() => navigate('/queue')}>
          Voltar para fila
        </button>
        <button className="secondary" type="button" onClick={() => void runClaim()} disabled={working}>
          Claim (in_review)
        </button>
        <button className="danger" type="button" onClick={() => void runMarkFailed()} disabled={working}>
          Marcar failed
        </button>
        <button className="secondary" type="button" onClick={() => void runMarkDuplicate()} disabled={working}>
          Marcar duplicate
        </button>
      </div>

      {error ? <p className="error" style={{ marginTop: 12 }}>{error}</p> : null}
      {success ? <p className="success" style={{ marginTop: 12 }}>{success}</p> : null}

      <hr style={{ margin: '18px 0' }} />

      <div className="form-grid">
        <div className="field">
          <label htmlFor="market_id">Mercado existente</label>
          <select
            id="market_id"
            value={selectedMarketId}
            onChange={(event) => setSelectedMarketId(event.target.value)}
          >
            <option value="">Criar novo mercado abaixo</option>
            {markets.map((market) => (
              <option key={market.id} value={market.id}>
                {market.name} - {market.city}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="new_market_name">Novo mercado (nome)</label>
          <input
            id="new_market_name"
            value={newMarketName}
            onChange={(event) => setNewMarketName(event.target.value)}
            placeholder="Usado apenas se mercado existente nao for selecionado"
          />
        </div>

        <div className="field">
          <label htmlFor="new_market_city">Novo mercado (cidade)</label>
          <input
            id="new_market_city"
            value={newMarketCity}
            onChange={(event) => setNewMarketCity(event.target.value)}
            placeholder="Cidade do novo mercado"
          />
        </div>

        <div className="field">
          <label htmlFor="new_market_state">Novo mercado (UF)</label>
          <input
            id="new_market_state"
            value={newMarketStateCode}
            onChange={(event) => setNewMarketStateCode(event.target.value.toUpperCase())}
            placeholder="RO"
            maxLength={2}
          />
        </div>

        <div className="field">
          <label htmlFor="new_market_cnpj">Novo mercado (CNPJ)</label>
          <input
            id="new_market_cnpj"
            value={newMarketCnpj}
            onChange={(event) => setNewMarketCnpj(event.target.value)}
            placeholder="00.000.000/0000-00"
          />
        </div>

        <div className="field">
          <label htmlFor="new_market_neighborhood">Novo mercado (bairro)</label>
          <input
            id="new_market_neighborhood"
            value={newMarketNeighborhood}
            onChange={(event) => setNewMarketNeighborhood(event.target.value)}
            placeholder="Bairro"
          />
        </div>

        <div className="field">
          <label htmlFor="new_market_address">Novo mercado (endereco)</label>
          <input
            id="new_market_address"
            value={newMarketAddressLine}
            onChange={(event) => setNewMarketAddressLine(event.target.value)}
            placeholder="Rua e numero"
          />
        </div>

        <div className="field">
          <label htmlFor="new_market_postal_code">Novo mercado (CEP)</label>
          <input
            id="new_market_postal_code"
            value={newMarketPostalCode}
            onChange={(event) => setNewMarketPostalCode(event.target.value)}
            placeholder="00000-000"
          />
        </div>
        <div className="field">
          <label htmlFor="purchase_date">Data da compra (ISO)</label>
          <input
            id="purchase_date"
            value={purchaseDate}
            onChange={(event) => setPurchaseDate(event.target.value)}
            placeholder="2026-03-19T16:00:00.000Z"
          />
        </div>

        <div className="field">
          <label htmlFor="total_amount">Total da compra</label>
          <input
            id="total_amount"
            value={totalAmount}
            onChange={(event) => setTotalAmount(event.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      <h2 style={{ marginTop: 22, marginBottom: 10 }}>Itens do recibo</h2>

      {items.map((item, index) => (
        <div className="item-editor" key={`item-${index}`}>
          <div className="form-grid">
            <div className="field">
              <label>Descricao</label>
              <input
                value={item.raw_description}
                onChange={(event) =>
                  updateItem(index, { raw_description: event.target.value })
                }
              />
            </div>

            <div className="field">
              <label>Quantidade</label>
              <input
                value={item.quantity}
                onChange={(event) => updateItem(index, { quantity: event.target.value })}
              />
            </div>

            <div className="field">
              <label>Unidade</label>
              <input
                value={item.unit}
                onChange={(event) => updateItem(index, { unit: event.target.value })}
              />
            </div>

            <div className="field">
              <label>Preco unitario</label>
              <input
                value={item.unit_price}
                onChange={(event) => updateItem(index, { unit_price: event.target.value })}
              />
            </div>

            <div className="field">
              <label>Preco total</label>
              <input
                value={item.total_price}
                onChange={(event) => updateItem(index, { total_price: event.target.value })}
              />
            </div>

            <div className="field">
              <label>Produto canonico existente (ID)</label>
              <input
                value={item.canonical_product_id}
                onChange={(event) => {
                  updateItem(index, {
                    canonical_product_id: event.target.value,
                    classification_source: 'manual',
                    classification_confidence: undefined,
                  });
                }}
                list="product-suggestions"
                placeholder="UUID ou selecao da lista"
              />
            </div>

            <div className="field">
              <label>Novo produto canonico (nome)</label>
              <input
                value={item.new_product_name}
                onChange={(event) =>
                  updateItem(index, { new_product_name: event.target.value })
                }
                placeholder="Usado se canonical_product_id estiver vazio"
              />
            </div>

            <div className="field">
              <label>Novo produto (categoria)</label>
              <input
                value={item.new_product_category}
                onChange={(event) =>
                  updateItem(index, { new_product_category: event.target.value })
                }
              />
            </div>

            <div className="field">
              <label>Alias observado</label>
              <input
                value={item.alias_text}
                onChange={(event) => updateItem(index, { alias_text: event.target.value })}
              />
            </div>
          </div>

          <div className="rag-suggestions" aria-live="polite">
            <button
              className="secondary"
              type="button"
              onClick={() => void runClassifyItem(index)}
              disabled={working || suggestions[index]?.loading || !item.raw_description.trim()}
            >
              {suggestions[index]?.loading ? 'Consultando RAG...' : 'Sugerir produto'}
            </button>

            {suggestions[index]?.error ? (
              <p className="error">{suggestions[index].error}</p>
            ) : null}

            {suggestions[index] &&
            !suggestions[index].loading &&
            !suggestions[index].error &&
            suggestions[index].candidates.length === 0 ? (
              <p className="muted">Nenhum candidato encontrado. Continue a revisão manual.</p>
            ) : null}

            {suggestions[index]?.candidates.map((candidate) => (
              <button
                className="suggestion-card"
                type="button"
                key={candidate.canonical_product_id}
                onClick={() => selectSuggestion(index, candidate)}
                aria-pressed={item.canonical_product_id === candidate.canonical_product_id}
              >
                <strong>{candidate.canonical_name}</strong>
                <span>
                  Confiança {(candidate.confidence * 100).toFixed(0)}% · Similaridade{' '}
                  {(candidate.similarity * 100).toFixed(0)}%
                </span>
                <small>{candidate.reason}</small>
              </button>
            ))}

            {item.classification_source === 'rag_confirmed' ? (
              <p className="success">
                Sugestão confirmada
                {item.classification_confidence !== undefined
                  ? ` (${(item.classification_confidence * 100).toFixed(0)}%)`
                  : ''}
                .
              </p>
            ) : null}
          </div>

          <div className="button-row">
            <button
              className="secondary"
              type="button"
              onClick={() =>
                setItems((current) => current.filter((_, rowIndex) => rowIndex !== index))
              }
              disabled={items.length === 1}
            >
              Remover item
            </button>
          </div>
        </div>
      ))}

      <datalist id="product-suggestions">
        {productOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>

      <div className="button-row">
        <button
          className="secondary"
          type="button"
          onClick={() => setItems((current) => [...current, emptyItem()])}
        >
          Adicionar item
        </button>
        <button className="primary" type="button" onClick={() => void runManualProcess()} disabled={working}>
          {working ? 'Processando...' : 'Concluir processamento manual'}
        </button>
        <button className="secondary" type="button" onClick={() => void loadData()}>
          Recarregar
        </button>
      </div>
    </section>
  );
}
