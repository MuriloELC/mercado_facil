# Mercado Fácil

Monorepo do Mercado Fácil: API NestJS, painel React/Vite, aplicativo Expo e classificador de produtos com FastAPI, pgvector e Ollama. A classificação é apenas assistiva: nenhum UUID canônico é salvo sem confirmação explícita do administrador.

## Requisitos

- Node.js `24.18.0` e npm `11.16.0`
- Docker Desktop com Docker Compose
- Ollama no host somente para classificação RAG

Python local é opcional; o fluxo oficial do RAG usa Docker com Python 3.12.

## Portas locais

| Serviço | Porta |
| --- | ---: |
| PostgreSQL de desenvolvimento | `5501` |
| PostgreSQL E2E | `5502` |
| Backend | `3001` |
| RAG | `8001` |
| Ollama no host | `11434` |

## Inicialização

Instale as dependências e copie os ambientes:

```powershell
npm install
Copy-Item backend/.env.example backend/.env
Copy-Item web/.env.example web/.env
Copy-Item mobile/.env.example mobile/.env
```

Suba o banco, aplique as migrações e crie os usuários locais:

```powershell
npm run db:up
npm run db:migrate
npm run db:seed
```

O migrador registra cada arquivo em `schema_migrations`; novas execuções aplicam apenas migrações pendentes. O seed pode ser executado novamente sem duplicar usuários.

Inicie backend e web em terminais separados:

```powershell
npm run dev:backend
npm run dev:web
```

O backend responde em `http://localhost:3001` e `GET /health` verifica também o banco.

## Classificador RAG

Instale o Ollama no host e baixe os modelos:

```powershell
ollama pull embeddinggemma
ollama pull qwen2.5:7b
```

Depois, suba e indexe o catálogo:

```powershell
npm run rag:up
npm run rag:index
```

O indexador importa `canonical-rag/data/canonical_products.csv`, mantém NCM, unidade e palavras-chave em `attributes_json` e recalcula embeddings apenas para registros novos ou alterados. Os modelos podem ser trocados por `OLLAMA_EMBED_MODEL` e `OLLAMA_CHAT_MODEL`.

A busca usa similaridade de cosseno no pgvector e reordenação estruturada pelo endpoint de chat do Ollama. Consulte a documentação de [embeddings do Ollama](https://docs.ollama.com/api/embed), [saídas estruturadas](https://docs.ollama.com/capabilities/structured-outputs) e [pgvector](https://github.com/pgvector/pgvector).

Sem Ollama ou sem os modelos, `GET /health` e `POST /classify` do RAG retornam `503`. Login, listas e processamento manual continuam funcionando normalmente.

## Mobile

Para execução web local, mantenha:

```env
EXPO_PUBLIC_API_URL=http://localhost:3001
```

No Expo Go, quando essa URL usa `localhost`, o aplicativo troca automaticamente o host pelo IP LAN anunciado pelo Metro. O celular e o computador precisam estar na mesma rede.

Se a detecção não estiver disponível, ou em um build instalado, informe explicitamente o IP LAN do computador, mantendo a porta `3001`:

```env
EXPO_PUBLIC_API_URL=http://192.168.0.10:3001
```

Inicie com:

```powershell
npm run dev:mobile
```

## Usuários locais

- Administrador: `admin@local.dev` / `admin123`
- Usuário: `user@local.dev` / `user123`

Essas credenciais existem apenas no ambiente local e não aparecem preenchidas nas telas de login. Fora dos testes, `JWT_SECRET` é obrigatório.

## Testes e validação

Suba o banco E2E efêmero e execute a validação completa:

```powershell
npm run db:test:up
npm run check
```

A suíte usa exclusivamente `postgres://postgres:postgres@localhost:5502/lista_compras_test`. Ela recusa qualquer banco cujo nome não termine em `_test` e informa como iniciar o contêiner quando `5502` estiver indisponível.

Comandos individuais:

```powershell
npm run build
npm run typecheck:mobile
npm test
npm start --workspace backend
```

O build do backend sempre recria `backend/dist/main.js`. O painel web carrega as páginas e o scanner de QR sob demanda.

## Interfaces principais

- `GET /health` — saúde do backend e do banco
- `POST /auth/login`
- `GET|POST /admin/products`
- `POST /admin/products/classify` — proxy admin para o RAG
- `GET|POST /admin/receipts`
- `PUT /admin/receipts/:id/manual-process`
- `GET|POST /user/lists`
- `POST /user/nfce/intake`
- RAG: `GET /health` e `POST /classify`

`POST /admin/products/classify` recebe `raw_description`, `ncm?`, `unit?`, `brand?` e `top_k?` (`1..10`). A resposta contém até os candidatos solicitados, similaridade, confiança e justificativa. Somente a seleção explícita na revisão salva o UUID, `classification_source = rag_confirmed` e a confiança.

## Estrutura

- `backend/` — API, migrações, seeds e E2E
- `web/` — painel administrativo e área do usuário
- `mobile/` — aplicativo Expo Router
- `canonical-rag/` — FastAPI, indexador e catálogo
- `docker-compose.yml` — bancos e RAG
