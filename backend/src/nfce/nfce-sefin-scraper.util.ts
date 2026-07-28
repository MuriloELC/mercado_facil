export type ScrapedNfceItem = {
  raw_description: string;
  quantity?: number;
  unit?: string;
  unit_price?: number;
  total_price?: number;
};

export type ScrapedNfcePayment = {
  method?: string;
  amount?: number;
  acquirer_cnpj?: string;
  authorization_code?: string;
};

export type ScrapedNfceData = {
  access_key?: string;
  consultation_url?: string;
  market_name?: string;
  market_legal_name?: string;
  market_city?: string;
  market_state_code?: string;
  market_neighborhood?: string;
  market_address_line?: string;
  market_cnpj?: string;
  market_postal_code?: string;
  market_state_registration?: string;
  purchase_date?: string;
  total_amount?: number;
  total_taxes_amount?: number;
  nfce_number?: string;
  nfce_series?: string;
  authorization_protocol?: string;
  authorization_date?: string;
  payment_methods?: ScrapedNfcePayment[];
  items: ScrapedNfceItem[];
};

export function scrapeNfceFromSefinHtml(
  html: string,
  consultationUrl?: string,
): {
  captchaRequired: boolean;
  data?: ScrapedNfceData;
  diagnostics: Record<string, unknown>;
} {
  const raw = html || '';
  const normalized = normalizeWhitespace(stripTags(raw));
  const fields = extractLabeledFields(raw);

  const captchaMarkers = [
    /captcha/i,
    /nao\s+sou\s+robo/i,
    /n[ãa]o\s+sou\s+rob[oô]/i,
    /digite\s+os\s+caracteres/i,
  ];

  const hasCaptchaMarker = captchaMarkers.some((marker) => marker.test(normalized));

  const items = extractItems(raw);
  const accessKey = extractAccessKey(raw, normalized);
  const totalAmount = extractTotalAmount(raw, normalized, fields);
  const totalTaxesAmount = extractTotalTaxesAmount(fields);
  const purchaseDate = extractPurchaseDate(normalized, fields);
  const market = extractMarket(raw, normalized, fields);
  const nfceMeta = extractNfceMetadata(raw, fields);
  const paymentMethods = extractPaymentMethods(raw);

  const hasMeaningfulData =
    Boolean(accessKey) ||
    Boolean(totalAmount) ||
    Boolean(purchaseDate) ||
    items.length > 0 ||
    Boolean(market.name) ||
    Boolean(nfceMeta.number) ||
    Boolean(nfceMeta.protocol);

  if (hasCaptchaMarker && !hasMeaningfulData) {
    return {
      captchaRequired: true,
      diagnostics: {
        hasCaptchaMarker,
        hasMeaningfulData,
      },
    };
  }

  return {
    captchaRequired: false,
    data: {
      access_key: accessKey ?? undefined,
      consultation_url: consultationUrl,
      market_name: market.name ?? undefined,
      market_legal_name: market.legal_name ?? undefined,
      market_city: market.city ?? undefined,
      market_state_code: market.state_code ?? undefined,
      market_neighborhood: market.neighborhood ?? undefined,
      market_address_line: market.address_line ?? undefined,
      market_cnpj: market.cnpj ?? undefined,
      market_postal_code: market.postal_code ?? undefined,
      market_state_registration: market.state_registration ?? undefined,
      purchase_date: purchaseDate ?? undefined,
      total_amount: totalAmount ?? undefined,
      total_taxes_amount: totalTaxesAmount ?? undefined,
      nfce_number: nfceMeta.number ?? undefined,
      nfce_series: nfceMeta.series ?? undefined,
      authorization_protocol: nfceMeta.protocol ?? undefined,
      authorization_date: nfceMeta.authorization_date ?? undefined,
      payment_methods: paymentMethods,
      items,
    },
    diagnostics: {
      hasCaptchaMarker,
      hasMeaningfulData,
      itemCount: items.length,
    },
  };
}

function extractAccessKey(raw: string, normalized: string): string | null {
  const directKey = normalized.match(/\b\d{44}\b/);
  if (directKey?.[0]) {
    return directKey[0];
  }

  const groupedKey = raw.match(
    /<span[^>]*class="chave"[^>]*>\s*([\d\s]{44,80})\s*<\/span>/i,
  );
  if (groupedKey?.[1]) {
    const onlyDigits = groupedKey[1].replace(/\D/g, '');
    if (onlyDigits.length >= 44) {
      return onlyDigits.slice(0, 44);
    }
  }

  const chNFe = raw.match(/(?:chNFe|chave\s+de\s+acesso)[^\d]*(\d{44})/i);
  if (chNFe?.[1]) {
    return chNFe[1];
  }

  return null;
}

function extractTotalAmount(
  raw: string,
  normalized: string,
  fields: Map<string, string[]>,
): number | null {
  const valueFromLabel = pickFirstParsedNumber(
    fields,
    ['valor total da nfe', 'valor total da nota fiscal', 'valor a pagar r'],
  );
  if (valueFromLabel !== null) {
    return valueFromLabel;
  }

  const explicitTotal = raw.match(
    /Valor\s+a\s+pagar\s*R\$:\s*<\/label>\s*<span[^>]*class="[^"]*txtMax[^"]*"[^>]*>\s*([\d\.,]+)\s*<\/span>/i,
  );
  if (explicitTotal?.[1]) {
    const parsed = parseBrazilianNumber(explicitTotal[1]);
    if (parsed !== null) {
      return parsed;
    }
  }

  const patterns = [
    /valor\s+(?:a\s+pagar|total|total\s+da\s+nota)\s*(?:r\$)?\s*([\d\.,]+)/i,
    /vl\.?\s*total\s*(?:r\$)?\s*([\d\.,]+)/i,
    /total\s*(?:r\$)?\s*([\d\.,]+)/i,
  ];

  for (const pattern of patterns) {
    const matchNormalized = normalized.match(pattern);
    if (matchNormalized?.[1]) {
      const parsed = parseBrazilianNumber(matchNormalized[1]);
      if (parsed !== null) {
        return parsed;
      }
    }

    const matchRaw = raw.match(pattern);
    if (matchRaw?.[1]) {
      const parsed = parseBrazilianNumber(matchRaw[1]);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  return null;
}

function extractPurchaseDate(
  text: string,
  fields: Map<string, string[]>,
): string | null {
  const valueFromLabel = pickFirstValue(fields, ['data de emissao']);
  const parsedFromLabel = parseBrazilianDate(valueFromLabel);
  if (parsedFromLabel) {
    return parsedFromLabel;
  }

  return parseBrazilianDate(text);
}

function extractMarket(
  raw: string,
  normalized: string,
  fields: Map<string, string[]>,
): {
  name: string | null;
  legal_name: string | null;
  city: string | null;
  state_code: string | null;
  neighborhood: string | null;
  address_line: string | null;
  cnpj: string | null;
  postal_code: string | null;
  state_registration: string | null;
} {
  const fantasy = pickFirstValue(fields, ['nome fantasia']);
  const legalName = pickFirstValue(fields, ['nome razao social']);
  const name = fantasy ?? legalName ?? extractMarketNameFallback(raw, normalized);

  const city = extractMarketCity(fields, raw, normalized);
  const stateCode = extractMarketStateCode(fields, normalized);
  const neighborhood = pickFirstValue(fields, ['bairro distrito']);
  const addressLine = pickFirstValue(fields, ['endereco']) ?? extractAddressFallback(raw);
  const cnpj = extractCnpj(fields, normalized);
  const postalCode = pickFirstValue(fields, ['cep']);
  const stateRegistration = pickFirstValue(fields, ['inscricao estadual']);

  return {
    name: cleanEntityText(name ?? '') || null,
    legal_name: cleanEntityText(legalName ?? '') || null,
    city: cleanEntityText(city ?? '') || null,
    state_code: cleanEntityText(stateCode ?? '') || null,
    neighborhood: cleanEntityText(neighborhood ?? '') || null,
    address_line: cleanEntityText(addressLine ?? '') || null,
    cnpj: cleanEntityText(cnpj ?? '') || null,
    postal_code: cleanEntityText(postalCode ?? '') || null,
    state_registration: cleanEntityText(stateRegistration ?? '') || null,
  };
}

function extractNfceMetadata(
  raw: string,
  fields: Map<string, string[]>,
): {
  number: string | null;
  series: string | null;
  protocol: string | null;
  authorization_date: string | null;
} {
  const number = pickFirstValue(fields, ['numero']);
  const series = pickFirstValue(fields, ['serie']);
  let protocol = pickFirstValue(fields, ['protocolo']);
  let authorizationDate = parseBrazilianDate(pickFirstValue(fields, ['data hora']));

  if (!protocol || !authorizationDate) {
    const eventsScope = captureFirst(raw, /Eventos da NF-e[\s\S]{0,3000}/i) ?? raw;

    if (!protocol) {
      const protocolMatch = eventsScope.match(
        /<label[^>]*>\s*Protocolo\s*<\/label>[\s\S]{0,500}?<span[^>]*class="linha"[^>]*>\s*(\d{10,})/i,
      );
      if (protocolMatch?.[1]) {
        protocol = protocolMatch[1];
      }
    }

    if (!authorizationDate) {
      const dateMatch = eventsScope.match(
        /<label[^>]*>\s*Data\s*\/?\s*Hora\s*<\/label>[\s\S]{0,500}?<span[^>]*class="linha"[^>]*>\s*([\s\S]*?)<\/span>/i,
      );
      authorizationDate = parseBrazilianDate(dateMatch?.[1] ?? null);

      if (!authorizationDate) {
        const genericDateMatch = eventsScope.match(
          /(\d{2}\/\d{2}\/\d{4}[^\d]{0,10}\d{2}:\d{2}:\d{2}\s*[+-]\d{2}:\d{2})/i,
        );
        authorizationDate = parseBrazilianDate(genericDateMatch?.[1] ?? null);
      }
    }
  }

  return {
    number: number ? number.replace(/[^\d]/g, '') || number : null,
    series: series ? series.replace(/[^\d]/g, '') || series : null,
    protocol: protocol ? protocol.replace(/[^\d]/g, '') || protocol : null,
    authorization_date: authorizationDate,
  };
}

function extractTotalTaxesAmount(fields: Map<string, string[]>): number | null {
  return pickMaxParsedNumber(fields, ['valor aproximado dos tributos']);
}

function extractPaymentMethods(raw: string): ScrapedNfcePayment[] {
  const payments: ScrapedNfcePayment[] = [];
  const rowPattern =
    /<tr>\s*<td>\s*<span[^>]*class="linha"[^>]*>([\s\S]*?)<\/span>\s*<\/td>\s*<td>\s*<span[^>]*class="linha"[^>]*>([\s\S]*?)<\/span>\s*<\/td>\s*<td>\s*<span[^>]*class="linha"[^>]*>([\s\S]*?)<\/span>\s*<\/td>[\s\S]*?<td>\s*<span[^>]*class="linha"[^>]*>([\s\S]*?)<\/span>\s*<\/td>\s*<\/tr>/gi;

  for (const match of raw.matchAll(rowPattern)) {
    const method = cleanEntityText(stripTags(match[1] ?? ''));
    const amount = parseBrazilianNumber(cleanEntityText(stripTags(match[2] ?? '')));
    const acquirerCnpj = cleanEntityText(stripTags(match[3] ?? ''));
    const authorizationCode = cleanEntityText(stripTags(match[4] ?? ''));

    if (!method && amount === null && !acquirerCnpj && !authorizationCode) {
      continue;
    }

    payments.push({
      method: method || undefined,
      amount: amount ?? undefined,
      acquirer_cnpj: acquirerCnpj || undefined,
      authorization_code: authorizationCode || undefined,
    });
  }

  return payments;
}

function extractItems(raw: string): ScrapedNfceItem[] {
  const detailedItems = extractDetailedItems(raw);
  if (detailedItems.length > 0) {
    return dedupeItems(detailedItems);
  }

  const items: ScrapedNfceItem[] = [];

  const rowPattern = /<tr[^>]*id="Item\s*\+\s*\d+"[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const row of raw.matchAll(rowPattern)) {
    const block = row[1] ?? '';

    const description = normalizeWhitespace(
      stripTags(captureFirst(block, /<span[^>]*class="txtTit"[^>]*>([\s\S]*?)<\/span>/i) ?? ''),
    );
    if (!description) {
      continue;
    }

    const quantity = parseBrazilianNumber(
      captureFirst(block, /<span[^>]*class="Rqtd"[^>]*>[\s\S]*?Qtde\.?:<\/strong>\s*([\d\.,]+)/i) ?? '',
    );
    const unit = normalizeWhitespace(
      stripTags(captureFirst(block, /<span[^>]*class="RUN"[^>]*>[\s\S]*?UN:\s*<\/strong>\s*([^<\s]+)/i) ?? ''),
    );
    const unitPrice = parseBrazilianNumber(
      captureFirst(block, /<span[^>]*class="RvlUnit"[^>]*>[\s\S]*?Vl\.\s*Unit\.?:<\/strong>\s*&nbsp;\s*([\d\.,]+)/i) ?? '',
    );
    const totalPrice = parseBrazilianNumber(
      captureFirst(block, /<span[^>]*class="valor"[^>]*>\s*([\d\.,]+)\s*<\/span>/i) ?? '',
    );

    items.push({
      raw_description: description,
      quantity: quantity ?? undefined,
      unit: unit || undefined,
      unit_price: unitPrice ?? undefined,
      total_price: totalPrice ?? undefined,
    });
  }

  if (items.length > 0) {
    return dedupeItems(items);
  }

  const fallbackPattern =
    /<span[^>]*class="txtTit2?"[^>]*>(.*?)<\/span>[\s\S]*?(?:Qtde\.?\s*:?\s*([\d\.,]+))?[\s\S]*?(?:UN\.?\s*:?\s*([A-Za-z]+))?[\s\S]*?(?:Vl\.?\s*Total\s*(?:R\$)?\s*:?\s*([\d\.,]+))?/gi;

  for (const match of raw.matchAll(fallbackPattern)) {
    const description = normalizeWhitespace(stripTags(match[1] ?? ''));
    if (!description) {
      continue;
    }

    const quantity = parseBrazilianNumber(match[2] ?? '');
    const unit = normalizeWhitespace(match[3] ?? '');
    const totalPrice = parseBrazilianNumber(match[4] ?? '');

    items.push({
      raw_description: description,
      quantity: quantity ?? undefined,
      unit: unit || undefined,
      total_price: totalPrice ?? undefined,
    });
  }

  return dedupeItems(items);
}

function extractDetailedItems(raw: string): ScrapedNfceItem[] {
  const items: ScrapedNfceItem[] = [];
  const pattern =
    /<td[^>]*class="fixo-prod-serv-descricao"[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/td>\s*<td[^>]*class="fixo-prod-serv-qtd"[^>]*>\s*<span[^>]*>\s*([\d\.,]+)\s*<\/span>\s*<\/td>\s*<td[^>]*class="fixo-prod-serv-uc"[^>]*>\s*<span[^>]*>\s*([^<]*)<\/span>\s*<\/td>\s*<td[^>]*class="fixo-prod-serv-vb"[^>]*>\s*<span[^>]*>\s*([\d\.,]+)\s*<\/span>/gi;

  for (const match of raw.matchAll(pattern)) {
    const description = normalizeWhitespace(stripTags(match[1] ?? ''));
    if (!description) {
      continue;
    }

    const quantity = parseBrazilianNumber(match[2] ?? '');
    const unit = normalizeWhitespace(match[3] ?? '');
    const totalPrice = parseBrazilianNumber(match[4] ?? '');
    const unitPrice =
      quantity && totalPrice && quantity > 0 ? Number((totalPrice / quantity).toFixed(6)) : null;

    items.push({
      raw_description: description,
      quantity: quantity ?? undefined,
      unit: unit || undefined,
      unit_price: unitPrice ?? undefined,
      total_price: totalPrice ?? undefined,
    });
  }

  return items;
}

function captureFirst(input: string, pattern: RegExp): string | null {
  const match = input.match(pattern);
  return match?.[1] ?? null;
}

function parseBrazilianNumber(value: string): number | null {
  const cleaned = (value || '').trim();
  if (!cleaned) {
    return null;
  }

  const keepNumbers = cleaned.replace(/[^\d,.-]/g, '');
  if (!keepNumbers) {
    return null;
  }

  let normalized = keepNumbers;
  const hasComma = normalized.includes(',');
  const dotCount = (normalized.match(/\./g) ?? []).length;

  if (hasComma) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (dotCount > 1) {
    normalized = normalized.replace(/\./g, '');
  }

  const number = Number(normalized);
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }

  return number;
}

function stripTags(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function cleanEntityText(input: string): string {
  return normalizeWhitespace(input)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function extractLabeledFields(raw: string): Map<string, string[]> {
  const fields = new Map<string, string[]>();
  const pattern = /<label[^>]*>([^<]{1,220})<\/label>\s*<span[^>]*>([\s\S]{0,1200}?)<\/span>/gi;

  for (const match of raw.matchAll(pattern)) {
    const label = normalizeLabel(match[1] ?? '');
    const value = cleanEntityText(stripTags(match[2] ?? ''));

    if (!label) {
      continue;
    }

    const list = fields.get(label) ?? [];
    list.push(value);
    fields.set(label, list);
  }

  return fields;
}

function normalizeLabel(label: string): string {
  const normalized = cleanEntityText(stripTags(label))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  return normalized;
}

function pickFirstValue(fields: Map<string, string[]>, labels: string[]): string | null {
  const values = findValuesByAliases(fields, labels);
  for (const value of values) {
    const cleaned = cleanEntityText(value);
    if (cleaned) {
      return cleaned;
    }
  }

  return null;
}

function pickFirstParsedNumber(
  fields: Map<string, string[]>,
  labels: string[],
): number | null {
  const values = findValuesByAliases(fields, labels);
  for (const value of values) {
    const parsed = parseBrazilianNumber(value);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function pickMaxParsedNumber(fields: Map<string, string[]>, labels: string[]): number | null {
  const values = findValuesByAliases(fields, labels);
  let max: number | null = null;

  for (const value of values) {
    const parsed = parseBrazilianNumber(value);
    if (parsed !== null && (max === null || parsed > max)) {
      max = parsed;
    }
  }

  return max;
}

function findValuesByAliases(fields: Map<string, string[]>, labels: string[]): string[] {
  const collected: string[] = [];
  const used = new Set<string>();

  for (const alias of labels) {
    const normalizedAlias = normalizeLabel(alias);

    for (const [key, values] of fields.entries()) {
      if (!isAliasMatch(key, normalizedAlias)) {
        continue;
      }

      for (const value of values) {
        const dedupeKey = `${key}|${value}`;
        if (used.has(dedupeKey)) {
          continue;
        }

        used.add(dedupeKey);
        collected.push(value);
      }
    }
  }

  return collected;
}

function isAliasMatch(key: string, alias: string): boolean {
  if (!key || !alias) {
    return false;
  }

  if (key === alias || key.includes(alias) || alias.includes(key)) {
    return true;
  }

  const keyCompact = key.replace(/\s+/g, '');
  const aliasCompact = alias.replace(/\s+/g, '');
  const minLen = Math.min(keyCompact.length, aliasCompact.length);
  if (minLen >= 6 && keyCompact.slice(0, 6) === aliasCompact.slice(0, 6)) {
    return true;
  }

  const keyTokens = key.split(' ').filter((token) => token.length >= 3);
  const aliasTokens = alias.split(' ').filter((token) => token.length >= 3);
  if (aliasTokens.length === 0 || keyTokens.length === 0) {
    return false;
  }

  return aliasTokens.every((aliasToken) =>
    keyTokens.some((keyToken) => tokensRoughlyMatch(aliasToken, keyToken)),
  );
}

function tokensRoughlyMatch(a: string, b: string): boolean {
  if (a === b || a.includes(b) || b.includes(a)) {
    return true;
  }

  if (a.length >= 4 && b.length >= 4) {
    return a.slice(0, 4) === b.slice(0, 4);
  }

  return false;
}

function extractMarketNameFallback(raw: string, normalized: string): string | null {
  const labelPatterns = [
    /(?:emitente|razao\s+social|raz[ãa]o\s+social)\s*:?\s*([^\n\r]{4,120})/i,
    /(?:nome\s+fantasia|nome\s+do\s+estabelecimento)\s*:?\s*([^\n\r]{4,120})/i,
  ];

  for (const pattern of labelPatterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      return cleanEntityText(match[1]);
    }
  }

  const topoPattern = /<(?:span|div)[^>]*class="txtTopo"[^>]*>([^<]{4,220})<\/(?:span|div)>/i;
  const topoMatch = raw.match(topoPattern);
  if (topoMatch?.[1]) {
    return cleanEntityText(topoMatch[1]);
  }

  return null;
}

function extractMarketCity(
  fields: Map<string, string[]>,
  raw: string,
  normalized: string,
): string | null {
  const municipioValues = findValuesByAliases(fields, ['municipio']);
  for (const value of municipioValues) {
    const parsed = parseCityFromMunicipioValue(value);
    if (parsed) {
      return parsed;
    }
  }

  const addressTextPattern = /<div[^>]*class="text"[^>]*>([\s\S]*?)<\/div>/gi;
  for (const match of raw.matchAll(addressTextPattern)) {
    const parsed = parseCityFromAddressLine(cleanEntityText(stripTags(match[1] ?? '')));
    if (parsed) {
      return parsed;
    }
  }

  const cityMatch = normalized.match(/\b([A-Za-zÀ-ú\s]{3,40})\s*[-/]\s*([A-Z]{2})\b/);
  if (!cityMatch?.[1]) {
    return null;
  }

  const city = cleanEntityText(cityMatch[1]);
  return city.length >= 3 ? city : null;
}

function extractMarketStateCode(
  fields: Map<string, string[]>,
  normalized: string,
): string | null {
  const stateValues = findValuesByAliases(fields, ['uf']);
  for (const value of stateValues) {
    const maybeUf = cleanEntityText(value).toUpperCase().replace(/[^A-Z]/g, '');
    if (maybeUf.length === 2) {
      return maybeUf;
    }
  }

  const match = normalized.match(/\b([A-Z]{2})\b/);
  return match?.[1] ?? null;
}

function extractAddressFallback(raw: string): string | null {
  const match = raw.match(
    /<div[^>]*class="text"[^>]*>\s*([^\n<]*?),\s*([\dA-Za-z\-\/\s]+)\s*,/i,
  );
  if (!match) {
    return null;
  }

  return cleanEntityText(`${match[1]}, ${match[2]}`);
}

function extractCnpj(fields: Map<string, string[]>, normalized: string): string | null {
  const cnpjValues = findValuesByAliases(fields, ['cnpj']);
  for (const value of cnpjValues) {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 14) {
      return value.trim();
    }
  }

  const fallback = normalized.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/);
  return fallback?.[0] ?? null;
}

function parseCityFromMunicipioValue(value: string): string | null {
  const cleaned = cleanEntityText(value);
  if (!cleaned) {
    return null;
  }

  const codeThenName = cleaned.match(/^\s*\d+\s*-\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]+)$/);
  if (codeThenName?.[1]) {
    return normalizeWhitespace(codeThenName[1]);
  }

  const withoutSymbols = normalizeWhitespace(cleaned.replace(/\d+/g, ' ').replace(/\s*-\s*/g, ' '));
  if (!withoutSymbols || withoutSymbols.length < 3) {
    return null;
  }

  return /[A-Za-zÀ-ÿ]{3,}/.test(withoutSymbols) ? withoutSymbols : null;
}

function parseCityFromAddressLine(line: string): string | null {
  if (!line) {
    return null;
  }

  const parts = line
    .split(',')
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i];
    if (/^[A-Z]{2}$/.test(part.toUpperCase())) {
      continue;
    }

    if (/[A-Za-zÀ-ÿ]{3,}/.test(part)) {
      return part;
    }
  }

  return null;
}

function parseBrazilianDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const compact = normalizeWhitespace(value).replace(/\s+às\s+/i, ' ');
  const match = compact.match(
    /(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?(?:\s*([+-]\d{2}:\d{2}))?/,
  );
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4] ?? '0');
  const minute = Number(match[5] ?? '0');
  const second = Number(match[6] ?? '0');
  const timezone = match[7] ?? null;

  const isoCandidate = timezone
    ? `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
        .toString()
        .padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute
        .toString()
        .padStart(2, '0')}:${second.toString().padStart(2, '0')}${timezone}`
    : new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();

  const parsedDate = new Date(isoCandidate);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
}

function dedupeItems(items: ScrapedNfceItem[]): ScrapedNfceItem[] {
  const seen = new Set<string>();
  const output: ScrapedNfceItem[] = [];

  for (const item of items) {
    const key = `${item.raw_description.toLowerCase()}|${item.total_price ?? ''}|${item.quantity ?? ''}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(item);
  }

  return output;
}
