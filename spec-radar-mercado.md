# Especificação de Projeto — Painel de Inteligência de Mercado

> Documento de briefing para construção autônoma via agente de desenvolvimento (Google Antigravity). Siga as instruções abaixo com precisão. Onde houver decisão técnica em aberto marcada como "assumir", pode prosseguir com a suposição indicada; onde houver algo que dependa de nomes de modelo/versão de API, verifique a documentação oficial mais recente antes de implementar, pois modelos de IA mudam de nome com frequência.

## 1. Visão geral

Aplicativo web que gera automaticamente, 3 vezes ao dia, um relatório de inteligência de mercado (macroeconomia, calendário de volatilidade, hedge e uma tabela de oportunidades táticas), usando um modelo de IA com busca na web ativada para trazer dados atuais. Os relatórios são compartilhados entre várias pessoas que usam o mesmo app.

Em vez de login, o app usa **perfis públicos sem senha**: qualquer pessoa pode criar um perfil digitando um nome, e alternar entre perfis existentes por abas. Cada perfil pode deixar notas e marcar/favoritar linhas específicas da tabela de oportunidades em qualquer relatório, e todo mundo enxerga as marcações de todos os perfis — a ideia é dar visibilidade do que cada pessoa está de olho, não privacidade entre os usuários. Recebe notificação (e-mail + push) quando um novo relatório é gerado.

**Isto não é uma ferramenta de recomendação de investimento para terceiros — é um assistente de pesquisa pessoal.** Todo relatório gerado deve exibir um aviso de isenção de responsabilidade (ver seção 6).

## 2. Stack técnica

- **Frontend + Backend:** Next.js (App Router), deploy na **Vercel**.
- **Banco de dados:** **Firebase Firestore**.
- **Autenticação:** **nenhuma autenticação ativa por enquanto.** O app é público para quem tiver o link. Em vez disso, usa um sistema leve de "perfis" sem senha (ver seção 3) para diferenciar quem está anotando o quê. **Deixar o Firebase Authentication pré-configurado no projeto (SDK instalado, config presente, uma página `/login` construída porém não vinculada em nenhum menu/rota protegida)**, para que no futuro seja simples ativar um gate de login real sem precisar reestruturar o projeto.
- **IA geradora dos relatórios:** **Google Gemini API**, usando a ferramenta nativa de grounding com Google Search (`google_search`) para garantir dados atuais. Usar o modelo mais recente disponível na família Gemini 3 (ex.: `gemini-3-pro-preview` para qualidade ou `gemini-3-flash-preview` para custo/velocidade — confirmar nome exato do modelo vigente na documentação da Gemini API no momento da implementação, pois aliases mudam).
- **Agendamento (cron):** o plano gratuito da Vercel só permite 1 execução de cron por dia e sem precisão de minuto. Como são necessários 3 horários fixos, **usar GitHub Actions como agendador externo** (grátis), disparando via HTTP as rotas de API protegidas por token secreto. (Alternativa documentada na seção 4.3 caso o usuário prefira migrar para Vercel Pro no futuro.)
- **E-mail transacional:** Resend (tem free tier generoso e integra bem com Next.js).
- **Push notification:** Web Push API nativo (VAPID keys) + Service Worker, tornando o app um PWA instalável.

## 3. Modelo de dados (Firestore)

### Coleção `promptTemplates`
Um documento por horário/tipo de relatório:
- `id`: `"pre-market"` | `"midday"` | `"closing"`
- `title`: string (ex.: "Pré-Market e Projeção")
- `scheduledTimeBRT`: string (ex.: "08:00")
- `promptText`: string (texto completo do prompt — ver seção 6)
- `updatedAt`: timestamp

*(Os 3 documentos permitem que o usuário edite cada prompt individualmente pelo dashboard, sem precisar redeploy.)*

### Coleção `reports`
Um documento por relatório gerado. **Importante:** para permitir que os perfis marquem/favoritem linhas específicas da tabela, o relatório não pode ser salvo só como um bloco único de Markdown — a tabela de oportunidades táticas precisa vir estruturada (ver seção 4.1, que pede à IA uma saída em JSON com esses campos separados).

- `id`: auto-gerado
- `type`: `"pre-market"` | `"midday"` | `"closing"`
- `generatedAt`: timestamp
- `macroSection`: string (Markdown — tópico 1: Macroeconomia e Fluxo Institucional)
- `calendarSection`: string (Markdown — tópico 2: Calendário e Choques de Volatilidade)
- `hedgeSection`: string (Markdown — tópico 3: Hedge e Visão Estratégica)
- `tacticalTable`: array de objetos, cada um representando uma linha da matriz de oportunidades:
  - `rowId`: string (ex.: `"{reportId}-{índice}"`, gerado no momento de salvar)
  - `segment`: `"Ações da B3"` | `"Forex"` | `"Criptomoedas"` | `"Altcoins fora do radar"` | `"Commodities"`
  - `asset`: string
  - `market`: string
  - `bias`: `"Compra"` | `"Venda"`
  - `rationale`: string
  - `riskPoints`: string
- `sources`: array de strings/URLs (fontes citadas pelo grounding, quando disponíveis na resposta da API)
- `status`: `"success"` | `"error"`
- `errorMessage`: string opcional

### Coleção `profiles`
- `id`: auto-gerado (ou slug do nome)
- `name`: string (digitado livremente por quem cria — sem validação de unicidade forte, mas evitar nomes duplicados idênticos na UI)
- `color`: string (código hex), **escolhida no momento da criação do perfil**, a partir de uma paleta fixa pré-definida (ex.: 8–12 cores bem distintas entre si). Ao abrir o formulário de criação, sugerir automaticamente a primeira cor da paleta que ainda não está em uso por nenhum perfil existente (evitando duas pessoas com a mesma cor, o que quebraria a identificação visual nas marcações). Se todas as cores da paleta já estiverem em uso, permitir repetição.
- `createdAt`: timestamp

*(Sem senha, sem dono — qualquer pessoa com o link do app pode criar um perfil novo a qualquer momento pela própria tela.)*

### Coleção `annotations`
Notas e/ou favoritos que um perfil deixa em um relatório:
- `id`: auto-gerado
- `profileId`: referência a `profiles`
- `profileName`: string (denormalizado, pra não precisar de join pra exibir)
- `reportId`: referência a `reports`
- `rowId`: string opcional (referência a uma linha específica de `tacticalTable` — presente quando é uma marcação/favorito sobre um ativo específico; ausente quando é uma nota geral sobre o relatório como um todo)
- `note`: string opcional (texto livre)
- `createdAt`: timestamp

### Coleção `pushSubscriptions`
- `id`: auto-gerado
- `subscription`: objeto de subscription do Web Push (endpoint + keys)
- `createdAt`: timestamp

### Documento `config/notifications`
- `emailTo`: array de strings (vários e-mails, já que mais de uma pessoa usa o app)
- `emailEnabled`: boolean
- `pushEnabled`: boolean

## 4. Fluxo de geração e agendamento

### 4.1 Rota de API de geração
Criar `app/api/generate-report/route.ts` (ou equivalente) que:
1. Recebe o `type` do relatório (`pre-market` | `midday` | `closing`) via query param ou body.
2. Valida um header `Authorization: Bearer <CRON_SECRET>` — rejeita com 401 se não bater.
3. Busca o `promptText` correspondente em `promptTemplates`.
4. Chama a Gemini API com a ferramenta `google_search` habilitada, pedindo saída estruturada em **JSON** (usar `responseSchema`/modo de saída estruturada da API, se disponível na versão do modelo usada) com os campos: `macroSection`, `calendarSection`, `hedgeSection` (cada um em Markdown) e `tacticalTable` (array de objetos com `segment`, `asset`, `market`, `bias`, `rationale`, `riskPoints`). Isso é necessário para que cada linha da tabela vire uma entidade que os perfis possam marcar/anotar individualmente (ver seção 3).
5. Ao salvar em `reports`, gerar um `rowId` estável para cada linha de `tacticalTable` (ex.: `${reportId}-${índice}`).
6. Dispara notificações (e-mail via Resend + push via Web Push) para os inscritos, com um link/preview do relatório.
7. Retorna 200 com o id do relatório criado.

### 4.2 Agendamento via GitHub Actions (gratuito)
Criar `.github/workflows/reports.yml` com 3 jobs agendados (horários em UTC — Brasília é UTC-3, sem horário de verão atualmente):

| Relatório | Horário BRT | Horário UTC | Cron |
|---|---|---|---|
| pre-market | 08:00 | 11:00 | `0 11 * * *` |
| midday | 11:00 | 14:00 | `0 14 * * *` |
| closing | 18:00 | 21:00 | `0 21 * * *` |

Cada job faz um `curl` autenticado para `https://<seu-dominio>.vercel.app/api/generate-report?type=<tipo>`, enviando o header `Authorization: Bearer ${{ secrets.CRON_SECRET }}`. O `CRON_SECRET` deve ser o mesmo valor configurado como variável de ambiente na Vercel.

*Observação: o agendamento do GitHub Actions também não é garantido no segundo exato (pode atrasar alguns minutos em horários de pico), mas é consideravelmente mais confiável e mais barato que pagar Vercel Pro só por causa disso.*

### 4.3 Alternativa (caso opte por Vercel Pro no futuro)
Bastaria mover os 3 horários para `vercel.json` como `crons`, remover o workflow do GitHub Actions e manter o mesmo `CRON_SECRET` (a Vercel já envia o header de autenticação de cron automaticamente em rotas protegidas).

## 5. Frontend / páginas

- **Seletor de perfil (componente global, não uma rota):** uma barra de abas fixa (ex.: topo do app) mostrando os perfis existentes, cada aba com a cor do respectivo perfil, e um botão **"+"** ao final da barra para criar um novo. Ao clicar no "+", abrir um formulário simples com dois campos: **nome** e **cor** (grade de cores da paleta pra escolher, já vindo pré-selecionada a primeira cor ainda não usada por ninguém). Ao salvar, o novo perfil vira uma aba e passa a ser o perfil ativo. Trocar de perfil a qualquer momento é só clicar em outra aba. Guardar o `profileId` ativo em `localStorage`.
- `/` — Dashboard: lista dos relatórios mais recentes (cards com tipo, data/hora, preview), com destaque para o mais recente.
- `/relatorio/[id]` — Visualização completa de um relatório: as 3 seções em Markdown renderizado + a tabela de oportunidades táticas renderizada como tabela de verdade (não Markdown cru). Em cada linha da tabela, permitir favoritar/marcar (ícone de estrela, por exemplo) como o perfil ativo, e mostrar pequenos indicadores coloridos (usando a `color` de cada perfil) de quem mais já marcou aquela linha. Abaixo da tabela ou em um painel lateral, mostrar as notas gerais do relatório, organizadas por abas de perfil (ex.: aba "João", aba "Maria", aba "Todos"), e as fontes citadas ao final.
- `/configuracoes` — Editar os 3 prompts (`promptTemplates`), ativar/desativar e-mail e push, testar geração manual de um relatório (botão "gerar agora"), gerenciar perfis existentes (ver lista, opcionalmente remover algum).
- `/login` — Página construída mas **não usada/linkada** por enquanto (auth pré-montada, ver seção 2).
- Nenhuma rota fica atrás de autenticação por enquanto (o app inteiro é público para quem tiver o link). A rota de API de geração continua protegida por token (`CRON_SECRET`), já que é chamada pelo GitHub Actions, não por sessão de usuário.

## 6. Templates de prompt (versões adaptadas por horário)

Adaptei o texto original em 3 versões — mesma estrutura de 4 tópicos e a tabela, mudando o foco conforme o momento do dia. Também adicionei: instrução explícita de busca na web, pedido de fonte+data por afirmação relevante, aviso de isenção de responsabilidade obrigatório no final, e deixei claro que a referência a Mark Tilbury é de **estilo/filosofia**, não citação literal.

### 6.1 `pre-market` (08:00) — "Pré-Market e Projeção"

```
Atue como Estrategista-Chefe de Investimentos e Analista de Macroeconomia Global. Use a busca na web para obter informações das últimas 12 horas antes de responder. Gere o relatório de PRÉ-MARKET do dia, com foco no que aconteceu durante a madrugada nos mercados asiáticos e americanos (futuros) e na expectativa para a abertura da B3 e demais mercados. Estruture a resposta rigorosamente nos seguintes tópicos:

1. Macroeconomia e Fluxo Institucional: síntese do sentimento global overnight e direcionamento do capital institucional, cruzando análises e notícias recentes da Bloomberg, The Wall Street Journal, CNN Brasil Money e Seeking Alpha. Cite a fonte e a data/hora aproximada de cada informação relevante.
2. Calendário e Choques de Volatilidade: principais eventos e dados econômicos previstos para a sessão de hoje, com projeção de impacto na liquidez dos ativos.
3. Hedge e Visão Estratégica: recomendações de proteção de portfólio para a abertura do dia, inspiradas no estilo e na filosofia de negócios publicamente conhecida de Mark Tilbury (não atribua citações literais a ele — apenas inspire-se na abordagem).
4. Matriz de Oportunidades Táticas: apresente em formato de TABELA as melhores assimetrias de risco/retorno para a abertura do dia. Colunas obrigatórias: 'Ativo', 'Mercado', 'Viés (Compra/Venda)', 'Racional/Gatilho', 'Pontos de Atenção (Stop/Risco)'. Segmente as linhas em: Ações da B3, Forex, Criptomoedas, Altcoins fora do radar, Commodities.

Responda em Markdown. Ao final, inclua obrigatoriamente a linha: "⚠️ Este relatório é gerado por IA com fins informativos e não constitui recomendação de investimento."
```

### 6.2 `midday` (11:00) — "Atualização de Metade de Pregão"

```
Atue como Estrategista-Chefe de Investimentos e Analista de Macroeconomia Global. Use a busca na web para obter informações das últimas horas antes de responder. Gere o relatório de ATUALIZAÇÃO DE PREGÃO, cobrindo o desempenho da B3 e demais mercados desde a abertura até o momento presente, e a reação a dados/eventos econômicos já publicados nesta manhã. Estruture a resposta rigorosamente nos seguintes tópicos:

1. Macroeconomia e Fluxo Institucional: síntese do sentimento global e do direcionamento do capital institucional observado até agora no pregão, cruzando análises e notícias recentes da Bloomberg, The Wall Street Journal, CNN Brasil Money e Seeking Alpha. Cite a fonte e a data/hora aproximada de cada informação relevante.
2. Calendário e Choques de Volatilidade: eventos e dados já divulgados nesta manhã e o que ainda falta divulgar até o fechamento, com projeção de impacto na liquidez dos ativos.
3. Hedge e Visão Estratégica: ajustes de proteção de portfólio recomendados para o restante do pregão, inspirados no estilo e na filosofia de negócios publicamente conhecida de Mark Tilbury (não atribua citações literais a ele).
4. Matriz de Oportunidades Táticas: apresente em formato de TABELA as melhores assimetrias de risco/retorno identificadas até este momento do dia. Colunas obrigatórias: 'Ativo', 'Mercado', 'Viés (Compra/Venda)', 'Racional/Gatilho', 'Pontos de Atenção (Stop/Risco)'. Segmente as linhas em: Ações da B3, Forex, Criptomoedas, Altcoins fora do radar, Commodities.

Responda em Markdown. Ao final, inclua obrigatoriamente a linha: "⚠️ Este relatório é gerado por IA com fins informativos e não constitui recomendação de investimento."
```

### 6.3 `closing` (18:00) — "Fechamento e Balanço"

```
Atue como Estrategista-Chefe de Investimentos e Analista de Macroeconomia Global. Use a busca na web para obter informações das últimas horas antes de responder. Gere o relatório de FECHAMENTO E BALANÇO DO DIA, cobrindo o resultado consolidado da sessão da B3, o comportamento de Forex, commodities e criptomoedas ao longo do dia, e o que permanece em aberto durante a noite (Forex e cripto operam 24h). Estruture a resposta rigorosamente nos seguintes tópicos:

1. Macroeconomia e Fluxo Institucional: síntese do sentimento global do dia e do direcionamento do capital institucional, cruzando análises e notícias recentes da Bloomberg, The Wall Street Journal, CNN Brasil Money e Seeking Alpha. Cite a fonte e a data/hora aproximada de cada informação relevante.
2. Calendário e Choques de Volatilidade: balanço dos eventos/dados econômicos do dia e o que está agendado para a noite ou para amanhã cedo, com projeção de impacto na liquidez dos ativos.
3. Hedge e Visão Estratégica: recomendações de proteção de portfólio para a noite e para a abertura de amanhã, inspiradas no estilo e na filosofia de negócios publicamente conhecida de Mark Tilbury (não atribua citações literais a ele).
4. Matriz de Oportunidades Táticas: apresente em formato de TABELA as melhores assimetrias de risco/retorno para o período noturno e para amanhã. Colunas obrigatórias: 'Ativo', 'Mercado', 'Viés (Compra/Venda)', 'Racional/Gatilho', 'Pontos de Atenção (Stop/Risco)'. Segmente as linhas em: Ações da B3, Forex, Criptomoedas, Altcoins fora do radar, Commodities.

Responda em Markdown. Ao final, inclua obrigatoriamente a linha: "⚠️ Este relatório é gerado por IA com fins informativos e não constitui recomendação de investimento."
```

## 7. Variáveis de ambiente necessárias

```
GEMINI_API_KEY=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_APP_ID=
CRON_SECRET=
RESEND_API_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

## 8. Roteiro sugerido de implementação (fases)

1. Scaffold do projeto Next.js + configuração do Firebase (Firestore + Authentication pré-instalado mas dormente) + deploy inicial na Vercel.
2. Modelo de dados no Firestore (criar os 3 documentos iniciais de `promptTemplates` com os textos da seção 6).
3. Rota `/api/generate-report` integrando a Gemini API com `google_search` grounding e saída estruturada em JSON, salvando em `reports` (incluindo geração dos `rowId` da tabela).
4. Sistema de perfis: componente de seleção/criação de perfil, persistência do perfil ativo em `localStorage`, coleção `profiles`.
5. Dashboard e página de visualização de relatório (seções em Markdown + tabela estruturada renderizada).
6. Sistema de anotações: favoritar/marcar linhas da tabela e deixar notas gerais, com abas por perfil (coleção `annotations`).
7. Página de configurações (editar prompts, ativar notificações, gerenciar perfis, botão "gerar agora" para teste manual).
8. Integração de e-mail (Resend) disparado após geração.
9. Integração de push (Service Worker + VAPID + tela de permissão) disparado após geração.
10. Workflow do GitHub Actions com os 3 horários agendados, testado manualmente antes de confiar no agendamento automático.
11. Revisão final: aviso de responsabilidade visível em todo relatório, tratamento de erros na chamada da IA (retry simples e log em `status: "error"`).

## 9. Observações finais para o agente de construção

- Priorize simplicidade: é um app compartilhado entre poucas pessoas conhecidas, não precisa de sistema de permissões complexo nem moderação de perfis.
- Perfis são de "honra": qualquer um pode criar quantos quiser e anotar em nome de qualquer perfil (não há senha por perfil). Isso é intencional por enquanto — não implementar nenhuma trava de propriedade sobre perfil/anotação.
- Trate falhas na chamada da IA com tolerância (ex.: se a busca na web falhar, ou o modelo não retornar o JSON no formato esperado, salvar o erro em vez de quebrar o cron — vale ter um parsing defensivo/retry antes de marcar como erro).
- Sempre que possível, exiba a data/hora de geração do relatório de forma bem visível no dashboard, já que o conteúdo tem validade curta.
- Os textos dos prompts (seção 6) são editáveis pela tela de configurações — o usuário já sabe que pode ajustá-los depois, então não é necessário travar esse texto no código.
- Paleta de cores sugerida para os perfis (pode ajustar tonalidade, mas manter bem distintas entre si para leitura rápida): `#EF4444` (vermelho), `#F97316` (laranja), `#EAB308` (amarelo), `#22C55E` (verde), `#14B8A6` (teal), `#3B82F6` (azul), `#8B5CF6` (roxo), `#EC4899` (rosa), `#78716C` (cinza), `#0EA5E9` (azul claro).
