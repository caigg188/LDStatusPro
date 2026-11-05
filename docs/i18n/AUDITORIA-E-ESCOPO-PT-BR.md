# Auditoria da localização e novo escopo de correções

**Data:** 2026-11-04. **Estado:** auditoria e plano local; implementação parcial, com regressões reproduzidas.

**Base autorizada:** `6f8eddf...1513b7c`, branch `feat/i18n-topic-tools`, userscript `3.9.0.7`.
**Abrangência examinada:** 5 commits de localização, 57 arquivos alterados, 6.579 inserções e 1.044 remoções; código, catálogos, testes, checker, geração, documentação e dependência de previews.

## 1. Conclusão executiva

A infraestrutura é aproveitável: preferência explícita por site, chinês como padrão, catálogos embarcados, preservação de identificadores canônicos e build reproduzível. Entretanto, **não há sustentação para considerar as etapas 3 e 4 100% concluídas nem para tratar a etapa 5 como mera revisão cosmética**.

A execução atual de `npm run check` passou **328/328 testes**, com **913 chaves** aceitas pelo checker. Os novos probes de auditoria executaram **26 verificações: 22 falharam e 4 controles passaram**. Esses números representam cenários deliberadamente dirigidos a defeitos, com repetições bilíngues; **não são 22 bugs independentes nem uma taxa de falhas do produto**.

Resultados que alteram o plano:

- A aplicação do idioma por recarga não protege chat de acompanhamento ativo nem configurações de IA não salvas.
- LDC mostra `undefined` em tipos conhecidos, inclusive em chinês.
- A exportação de mídia pode mostrar `https://linux.do.media.audioNote` como texto, nos dois idiomas.
- Há escape duplo de conteúdo, fallback incompleto e mensagens próprias ainda em chinês.
- O teste de HTML da etapa 4 nunca executa suas asserções de HTML.
- O fluxo de revisão pode aprovar automaticamente hashes novos sem revisão efetiva do inglês.

**Recomendação:** substituir a antiga “etapa 5” por quatro marcos: confiabilidade da validação → correções funcionais → completude e experiência → manutenção e preparação upstream.

## 2. Evidência e limites da auditoria

### Verificações executadas nesta rodada

| Verificação | Resultado |
|---|---|
| `FONTCONFIG_FILE=/tmp/opencode/ldsp-issue62/fonts.conf npm run check` | PASS: 328 testes; lint, catálogo e bundles consistentes |
| `node scripts/embed-i18n.mjs --stats --check` | 73.239 bytes raw / 28.448 bytes gzip |
| `node design/scripts/sync-assets.mjs --check` | PASS: 44 arquivos |
| `node docs/i18n/reproduce-audit.mjs` | 13 probes: 2 controles passam, 11 falham |
| `node docs/i18n/reproduce-workflow-audit.mjs` | 9 probes falham |
| `node docs/i18n/reproduce-checker-audit.mjs` | 4 probes: 2 controles passam, 2 falham |
| GitHub, PR #97 | OPEN, `mergedAt: null` |
| GitHub, issue #95 | OPEN; causa real continua sem reprodução |
| Comparação remota `21a0e90...main` upstream | `identical`, 0 commits à frente/atrás na consulta |

Os três scripts de auditoria estão ao lado deste documento. Usam código real com estado sintético e rede simulada; não alteram catálogos, persistência real ou serviços. Retornam **exit code 1 de propósito enquanto os contratos verificados estiverem violados**. O probe de nome de método descreve um defeito do teste, e deve ser substituído pela chamada correta ao reparar a suíte, não por um alias desnecessário na produção.

Logs locais desta rodada:

- `/tmp/opencode/ldsp-audit-check.log`
- `/tmp/opencode/ldsp-audit-probes.json`
- `/tmp/opencode/ldsp-audit-workflows.json`
- `/tmp/opencode/ldsp-audit-checker.json`

As reproduções de recarga exercitam métodos reais com controllers/campos simulados. Provam uma lacuna na proteção, mas **não constituem reprodução ponta a ponta de cliques nem perda de dados observada em uma conta real**. A suíte existente inclui Chromium; os probes novos usam Node/jsdom. Layout, teclado, Tampermonkey/Violentmonkey, conta real, bridges e PDF impresso ainda exigem validação específica. O build completo do website e a comparação de pixels da rodada anterior são histórico, não verificações reexecutadas aqui.

Referências de código abaixo correspondem ao commit `1513b7c`; devem ser acompanhadas pelo símbolo citado, pois o arquivo gerado muda de tamanho. Citações dos planos anteriores referem-se ao conteúdo examinado antes da reconciliação documental desta auditoria.

## 3. Revisão independente: Standards

### Desvio documental

`website/public/product-preview/capture.json:2–6` e espelho em `design/assets/product/plugin/`: o hash foi atualizado mantendo `capturedOn: 2026-10-20` e os WebP anteriores. `CI.md:21` e `design/MOTION_AND_MEDIA.md:44–46` requerem o fluxo de captura após mudanças do script. A comparação histórica de quatro previews com pixels idênticos é evidência útil de equivalência visual, mas o manifesto não registra essa revalidação separadamente da captura original. Regularizar a proveniência pelo fluxo prescrito ou por um formato de revalidação expressamente aceito pelo mantenedor.

### Heurísticas de manutenção, não violações obrigatórias

1. **Duplicação de extração AST:** `build*Bundle` em `tests/panel-{core,workflows,topic-tools}-i18n.test.mjs` repete o extrator; a resolução de declarações já divergiu. Criar helper consciente do escopo léxico.
2. **Duplicação da aplicação dentro da fixture:** `tests/helpers/panel-fixture.mjs:73–101` reimplementa partes da inicialização e dos handlers do idioma; um teste pode continuar verde quando a produção perder esses passos. Exercitar os métodos reais e reservar mocks às dependências externas.
3. **Duplicação de fonte/interpolação:** `src/core/messages.mjs:6–59` duplica catálogo e interpolador. Há diferenças para `null`/`undefined` e faltam entradas. Derivar fallback de fonte única.

**Síntese Standards:** 1 desvio documental e 3 heurísticas; maior problema documental: proveniência das capturas. Bugs funcionais encontrados durante essa revisão estão detalhados na seção de achados, sem tratá-los como violações de estilo.

## 4. Revisão independente: Spec

Fonte: plano anterior `LDStatusPro/docs/i18n/ANALISE-PT-BR.md` e `UPSTREAM-PROPOSAL.md`.

1. **Recarga insegura:** contraria proposta `:27`, “Do not interrupt unsaved forms, active summaries, exports or other operations”. A proteção não inclui `_chatAbortController` nem campos de IA alterados.
2. **LDC incompleto:** `.labelKey` foi introduzido, mas consumidores ainda usam `.label`; contraria análise `:62`, “Acrescentar `labelKey` … Traduzir apenas na renderização”, e compatibilidade chinesa da proposta `:84`.
3. **Conteúdo alterado por escape duplo:** contraria proposta `:18`, “user names … retain their original content”, e análise `:145`, “escapar texto e atributos corretamente”.
4. **Mensagens próprias não localizadas:** erros de atividade, expiração de autenticação e ações sem login contrariam proposta `:16`, que inclui “login/sync feedback … loading/empty/error states”.
5. **Formatação parcial:** LDC/CDK ainda forçam `zh-CN`; contraria análise `:146`, “Aplicar `Intl.NumberFormat`, `Intl.DateTimeFormat` e `Intl.RelativeTimeFormat` à apresentação”.

**Síntese Spec:** 5 achados nesse eixo; maior impacto: recarga durante trabalho ativo/não salvo. Não foi identificada expansão funcional alheia ao escopo nos componentes examinados. Os achados adicionais de núcleo, exportação e manutenção abaixo complementam esse eixo.

## 5. Achados técnicos consolidados

Prioridade: **P1** bloqueia a próxima entrega confiável; **P2** necessária para declarar completude; **P3** aperfeiçoamento posterior. “Reproduzido” significa execução de cenário, não só leitura de fonte.

### A01 — P1 · proteção incompleta na aplicação do idioma

- **Local:** `LDStatusPro.user.js:13547–13553`, `_hasActiveOperationBeforeReload`; chat em `:9799`, prompts em `:9362–9377`.
- **Evidência:** `_reloadForLocaleChange()` retorna `true` com chat ativo e com prompt não salvo. O reload foi interceptado pela fixture.
- **Impacto:** potencial interrupção do chat ou descarte de edição. Lacuna introduzida pelo novo fluxo de idioma.
- **Correção proposta:** consultar estado de atividade e alterações pendentes de cada ferramenta; incluir teste de conexão, resumo, chat, exportação e formulários. Permitir salvar a preferência e aplicar depois. Evitar classificar campos persistidos e inalterados como edição pendente.
- **Aceite:** cliques reais de troca/aplicação durante cada operação; ausência de reload, POST duplicado ou perda de texto; após concluir/salvar/descartar, recarga permitida.

### A02 — P1 · namespace de tradução colide com origem HTTP

- **Local:** `src/core/topic-export.mjs:5,140,158–161,202`, `prepareExportHTML`.
- **Causa:** `const origin = 'core'` é sombreado pelo parâmetro `origin` que contém `https://linux.do`. Assim, `${origin}.media.audioNote` deixa de ser uma chave de catálogo.
- **Evidência reproduzida em ambos os idiomas:** `<figcaption>https://linux.do.media.audioNotehttps://linux.do.media.visitOriginal</figcaption>`.
- **Alcance:** exportação HTML/Markdown/PDF e preparação de conteúdo para IA, pois `_fetchDialogues` também chama esse helper (`LDStatusPro.user.js:9049`).
- **Correção proposta:** chaves literais `core.media.*`, separando domínio de tradução da origem de rede.
- **Aceite:** mídia com/sem URL, poster, imagem inválida, ambos os idiomas e núcleo sem tradutor; URLs reais preservadas e nenhuma chave técnica em texto ou payload IA.

### A03 — P1 · migração LDC deixa tipos conhecidos como `undefined`

- **Local:** `LDStatusPro.user.js:7358–7366` define `labelKey`; `:8133–8134,8153,8262` ainda lê `.label`.
- **Evidência reproduzida:** tipo `receive` → `undefined` na lista e `📥 undefined` no detalhe; filtros de período/tipo perdem a explicação no vazio, em zh-CN/en-US.
- **Correção proposta:** resolver todas as apresentações a partir de `labelKey`; preservar códigos enviados ao serviço e mostrar tipos desconhecidos sem inventar significado.
- **Aceite:** todas as opções conhecidas, desconhecidas, lista cheia/vazia, detalhe, paginação e filtros; payloads idênticos nos dois idiomas. Não foi encontrado defeito equivalente de `.label` no CDK.

### A04 — P1 · validação de HTML dá falso positivo

- **Local:** `tests/panel-topic-tools-i18n.test.mjs:134,155–160`; implementação real em `LDStatusPro.user.js:6859`.
- **Evidência:** o teste chama opcionalmente `_genHtml`, mas o método é `_genHTML`; resultado vazio faz todas as asserções de HTML serem puladas.
- **Outras lacunas:** seletores opcionais com `|| ''` permitem ausência de superfície; o histórico vazio usa `.ldsp-melon-history-empty`, não a lista consultada. A fixture dos novos testes não injeta estilos reais nem percorre geração completa/download/print.
- **Correção proposta:** chamadas obrigatórias, presença de superfície antes da inspeção, captura de erros de página e testes de fluxos com dados completos.
- **Aceite:** mutações propositais no `lang`, título, metadados e rótulos do HTML fazem testes falhar; casos HTML, Markdown e impressão executam seus respectivos caminhos.

### A05 — P2 · escape aplicado duas vezes

- **Reproduzido:** título exportado `LDStatusPro.user.js:6974`; criador CDK `:8703`. `A & B <topic>` aparece como `A &amp; B &lt;topic&gt;` no título DOM.
- **Mesmo padrão confirmado na fonte:** atualização LDC `:7923`, modelo do histórico IA `:9638`, tooltips de autor em atividade `:11150,11194`.
- **Correção proposta:** parâmetros crus para `tHtml`; escape uma vez na fronteira de saída. Não remover sanitização de HTML de posts/Markdown.
- **Aceite:** `& < > " '` preservados como texto em DOM e atributos; nenhum elemento/handler malicioso criado. Verificar tanto entidades literais legítimas quanto caracteres originais.

### A06 — P1 · contrato de fallback do núcleo está quebrado

- **Local:** `src/core/messages.mjs:6–51` vs. `src/i18n/locales/zh-CN/core.json`.
- **Evidência:** 13 entradas do catálogo core ausentes em `CORE_TEXT`: 6 de progresso, título sem nome e 6 de mídia. Sem tradutor, a espera retorna literalmente `core.progress.waiting` e `core.progress.waitDetail`.
- **Distinção:** uso normal do plugin injeta tradutor e resolve parte dessas entradas; a falha atinge o contrato standalone declarado na etapa 4 e rotas de fallback. A02 continua quebrada mesmo com tradutor.
- **Correção proposta:** fonte única de mensagens chinesas; fallback determinístico e auditável, sem converter silenciosamente defeitos de chave em sucesso.
- **Aceite:** paridade automatizada; todas as mensagens com tradutor en-US, zh-CN, ausente e falhando; testes de parâmetros ausentes/nulos definidos pelo contrato.

### A07 — P2 · núcleo e fluxos ainda exibem mensagens próprias em chinês

- **Reproduzido:** erro de acesso do fórum em inglês, falha/progresso de imagens e resposta inválida de atividade.
- **Locais adicionais:** `topic-content.mjs:95–101,178`; `topic-export.mjs:92,98,123,132,151,251,292–294`; autenticação em `LDStatusPro.user.js:12104–12116,13018`, ações sem login `:12937,12959`.
- **Exemplos:** 429 esgotado, HTTP/genérico, resposta não JSON, download/encoding, contador de imagens, fallback de imagem, pseudo-elemento de spoiler. A definição de chaves de timeout no catálogo não prova uso nas chamadas.
- **Correção proposta:** inventário de produtores e consumidores, incluindo CSS, atributos e erros em módulos. Preservar texto de usuário e detalhe remoto desconhecido com contexto traduzido.
- **Aceite:** matriz por estado e superfície; nenhuma mensagem própria sem tradução; toda exceção classificada como protocolo, conteúdo externo ou dívida explícita. Não substituir instruções úteis do servidor apenas para remover CJK.

### A08 — P2 · datas, plurais, terminologia e marcação incompletos

- **Reproduzido:** HTML exportado continua com `toLocaleString('zh-CN')` em `:6884` quando o documento diz `en-US`.
- **Fonte:** LDC `:8281–8282`, CDK `:8726,8732`, viewer `:9693`; datas manuais no histórico `:9510,9624`; números usam combinações de `toFixed`/locale ambiente.
- **Texto:** `melon.history.count` produz `1 records`; a descrição inglesa “~150-word” não corresponde ao prompt preservado de cerca de 150 caracteres chineses. Revisar “floor”, “post”, “reply”, “summary” e “digest” por contexto, sem alterar IDs/citações.
- **Marcação:** `:8577` passa `<strong>${total}</strong>` ao catálogo que já contém `<strong>{total}</strong>`; HTML redundante confirmado por fonte, sem dano funcional demonstrado.
- **Aceite:** valores 0/1/2/grandes, idioma do navegador distinto do plugin, datas válidas/inválidas; UTC, fuso local e cortes de negócio preservados; nenhuma conversão de LDC para USD. Traduzir UI não equivale a mudar idioma da IA.

### A09 — P2 · viewer fora do painel perde o idioma acessível

- **Local:** `_showViewer`, `LDStatusPro.user.js:9709–9768`, anexa overlay em `document.body` sem `lang` próprio.
- **Reproduzido:** documento zh-CN + painel en-US → viewer herda zh-CN apesar da interface inglesa.
- **Correção proposta:** declarar locale nos roots destacados; mapear todos os overlays/portais. Validar nomes acessíveis, foco, Escape e controles de fonte operáveis por teclado.
- **Aceite:** idioma correto na árvore de acessibilidade, sem modificar `<html>` do fórum. Layout estreito/zoom/temas e foco testados com CSS real. Clipping de todos os overlays ainda é hipótese a investigar, não bug demonstrado nesta rodada.

### A10 — P1 · revisão de tradução pode ser aprovada sem revisão

- **Local:** `scripts/check-i18n.mjs:191–207,398–402`.
- **Evidência por mutação em memória:** chinês alterado + inglês antigo + manifesto anterior falha corretamente; regenerar via `buildReviewManifest(zh)` faz passar. Esse é o mesmo caminho usado por `--sync-manifest`.
- **Impacto:** “913 revisadas” significa hashes presentes/compatíveis; não atesta revisão semântica humana. Contraria a distinção entre extração e aprovação do plano (`ANALISE-PT-BR.md:182`, proposta `:64`).
- **Correção proposta:** comando de relatório sem escrita, aprovação seletiva de chaves com diff fonte/tradução/contexto e estado pendente persistente. Revisão humana pode legitimamente manter o inglês, mas precisa ser decisão explícita.
- **Aceite:** alterar uma fonte não aprova outras; traduções ausentes/obsoletas e contexto mudado permanecem pendentes; procedimento demonstrado em fixture de atualização upstream.

### A11 — P2 · checker tem pontos cegos reais

- **Local:** `scripts/check-i18n.mjs:288–327,329–380`. Varre recortes do userscript; os módulos core não são analisados como fontes de mensagens. Valida referência somente quando o argumento de `I18n.t/tHtml` é literal direto.
- **Reproduzido:** `I18n.t(true ? 'audit.missingKey' : 'common.time.justNow')` passa sem chave correspondente.
- **Fonte:** exceções globais por texto e escapes Unicode podem mascarar texto visível; JSON é lido por `JSON.parse` (`:176`), que descarta duplicatas antes da checagem; chave morta nos dois idiomas não é equivalente a chave inglesa obsoleta.
- **Correção proposta:** cobrir arquivos fonte core, arrays/mapas `labelKey`, condições estaticamente resolvíveis e destinos DOM/CSS; exceções locais com motivo; detectar JSON duplicado antes da desserialização e registrar referências dinâmicas explicitamente.
- **Aceite:** mutation tests para cada ponto cego; relatório de cobertura com locais não inspecionados. Ausência de CJK não pode ser usada como prova de ausência de chave exposta, `undefined` ou texto inglês incorreto.

### A12 — P2 · documentação, custo e proveniência precisam reconciliação

- Na versão examinada, `ANALISE-PT-BR.md` mantinha tabelas e próximos passos antigos; `UPSTREAM-PROPOSAL.md:3` dizia “not implemented yet” e `:98` perguntava por i18next, embora a opção implementada fosse runtime próprio. **Reconciliação documental realizada nesta auditoria:** estado, histórico, métricas e próximos passos atualizados nos dois documentos, com links para este escopo. As demais entregas de A12 continuam pendentes.
- O budget subiu de 60/22 KB para 90/32 KB durante a etapa 4. Isso é uma ampliação de limite, não otimização. A medição atual é apenas do bundle i18n; `CORE_TEXT` também aumenta o bundle core.
- Capturas: ver desvio Standards. Quatro previews fechados chineses não comprovam layout dos overlays ingleses.
- **Aceite:** documento de estado único, métricas datadas com baseline, custo total/delta de ambos os bundles, medição de parse/inicialização sob ambiente documentado e proveniência fiel.

## 6. Novo escopo executável

Escopo de produto mantido: plugin dentro de `linux.do`, seus overlays, mensagens e documentos exportados. A compatibilidade dos demais matches/bridges permanece requisito. Website entra somente pela dependência existente de preview/build.

| Pacote | Prioridade / dependência | Entrega | Prova de aceite |
|---|---|---|---|
| E0 — testes confiáveis | P1, primeiro | A04 + testes de caracterização dos bugs A01–A06; reduzir duplicação de fixture no necessário | RED real antes do fix; GREEN após, sem condições que pulem asserções |
| E1 — proteção de trabalho | P1, após E0 | A01: operações ativas e edições pendentes | Resumo, chat, conexão, exportação, tickets e configurações cobertos por interação |
| E2 — regressões de apresentação/núcleo | P1, após E0 | A02, A03, A05, A06; chaves corretas, fallback único, escape único | Probes bilíngues passam, URLs/identidades/payloads preservados |
| E3 — manutenção verificável | P1/P2, após E0 | A10 e A11; aprovação seletiva, scanner expandido, mutation tests | Fonte alterada permanece pendente até revisão explícita |
| E4 — completar mensagens e formato | P2, após E2/E3 | A07/A08; inventário final, plurais e terminologia | Todos os estados próprios classificados e exercitados |
| E5 — experiência e acessibilidade | P2, após E1/E4 | A09; testes reais de layout/foco/idioma | Matriz visual/interativa abaixo sem truncamento funcional |
| E6 — entrega sustentável | P2, após anteriores | A12; documentação, orçamento, capturas e plano de integração | CI afetado completo, proveniência fiel, diffs pequenos e descrição de limites |

Cada pacote pode virar um commit/PR focado. Os ajustes funcionais devem acompanhar seus testes; a infraestrutura adicional de testes não justifica reescrever o monólito. A pilha atual depende de #97: a estratégia de base deve ser definida conforme o upstream aceite ou não esse commit. A consulta remota desta auditoria não revelou commits novos no main que exijam rebase imediato.

### Matriz mínima de completude

| Superfície | Estados e verificações |
|---|---|
| Idioma/configurações | Sem login, preferência inválida, storage falhando, recarga adiada, operação ativa, texto não salvo |
| Painel/trends/ranking | Sem dados, carregando, dados reais sintéticos, API falha, valores desconhecidos, cálculos e chaves canônicas |
| Atividade/bookmarks/follow | Todas as abas, busca/paginação, filtros, grupos, exclusão/exportação, autenticação expirada |
| LDC/CDK | Visão geral, dados cheios/vazios, tipos/status conhecidos e desconhecidos, filtros, detalhes, requisitos e claims |
| IA | Configurar/salvar/resetar, testar conexão, streaming/JSON, truncamento, interrupção, cancelamento, retry, histórico legado/atual, viewer/chat |
| Exportação | HTML/Markdown/PDF, mídia, imagens locais/remotas, falhas parciais, limites, título com caracteres especiais, impressão bloqueada/fechada |
| UI/acessibilidade | zh-CN/en-US, claro/escuro, 320/390/desktop, menor/maior fonte, zoom, teclado, idioma herdado, nomes acessíveis |
| Compatibilidade | Firefox/Chromium e managers representativos conforme suporte declarado; smoke bridges e demais matches |

Não multiplicar todas as combinações cegamente: testar limites e combinações de risco, registrando quais foram cobertas. Testes de rede devem ser determinísticos e locais; o smoke real deve usar instalação de desenvolvimento e ambiente identificado.

## 7. Critério de conclusão revisado

1. Todos os P1 resolvidos com reprodução RED/GREEN; P2 necessários ao escopo encerrados ou explicitamente excluídos antes de anunciar cobertura.
2. Nenhum `undefined`, chave técnica, escape duplo ou fallback inesperado nos cenários de aceite.
3. Catálogo e inventário coerentes; revisão semântica distinta da validação mecânica; exceções justificadas por local.
4. Dados originais, chaves persistidas, contratos de rede, citações e comportamento de cancelamento preservados.
5. Testes obrigatórios de HTML/Markdown/impressão e operação real do seletor; matriz de overlays documentada.
6. `npm run check`, checks de website realmente afetados e espelhos passam; capturas têm proveniência adequada.
7. Uma alteração simulada de fonte upstream produz delta, pendência, revisão seletiva, regeneração e validação demonstráveis.
8. Custo de distribuição e startup medido; nenhum aumento de threshold apresentado como otimização.

## 8. Melhorias posteriores, fora do caminho crítico

- Idioma de saída da IA configurável separadamente: produto opcional, não consequência automática do locale. Exige revisar prompts, tamanho da saída, orçamento, histórico e testes de citações.
- Troca instantânea de idioma: somente após modelar estado dos overlays e provar ausência de reinícios/listeners/requisições duplicados.
- Pseudolocalização e automação adicional de screenshots para antecipar expansão de texto.
- Outros idiomas depois de estabilizar o fluxo de manutenção e a terminologia inglesa.
- Extração incremental de módulos apenas onde reduz conflitos/testes frágeis de forma demonstrável.

## 9. Decisões e comunicação de estado

**Estado correto agora:** E0/P1, E3 e as correções de mensagens/formato de E4 estão implementados localmente nesta branch e verificados pelos probes e pela suíte descritos na seção 12. A matriz completa de compatibilidade/interação de E1/E5 e a entrega E6 continuam pendentes. **Não declarar “100%”, cobertura completa de managers/browsers ou “944 revisões humanas” a partir do checker.**

A PR #97 continua sendo uma correção independente submetida, sem merge registrado na consulta. A issue #95 continua candidata a diagnóstico/suporte: a mensagem antiga de CORS e a troca histórica de transporte não provam a causa nem a resolução do caso do usuário.

O próximo trabalho recomendado é **E5**, começando pela matriz real de acessibilidade/layout, viewer, impressão/PDF e smoke nos userscript managers. Este documento registra escopo e aceite; os scripts anexos preservam evidências executáveis da auditoria.

## 10. Atualização de implementação: E0 + correções P1 (2026-11-04)

Pacote aplicado localmente sobre `1513b7c`, sem commit ou push:

| Item | Estado |
|---|---|
| A04 — teste de HTML | `_genHTML` chamado obrigatoriamente; histórico com fixture real; erros de página capturados; asserções incondicionais |
| A01 — recarga segura | `_chatAbortController` e `MelonHelper.hasUnsavedSettings()` considerados; liberação após salvar/descartar coberta por teste |
| A02 — namespace | chaves literais `core.media.*`; nenhuma origem HTTP em chave de tradução |
| A03 — LDC | lista, detalhe e filtros resolvem `labelKey`; tipo desconhecido permanece literal |
| A05 — escape único | título exportado, criador CDK, horário LDC, modelo do histórico e tooltips de atividade |
| A06 — fallback | 13 entradas restauradas em `CORE_TEXT`, com teste de paridade exata com o catálogo zh-CN |

Verificação: `npm run check` com **334/334 testes** (328 anteriores + 6 novos), checker 913 chaves e bundles consistentes. Probes reexecutados: núcleo **8/13**, workflows **9/10**, checker **2/4**; as falhas restantes pertencem a E3 (aprovação do checker), E4 (mensagens próprias em chinês, datas fixas em zh-CN, rótulo de spoiler) e E5 (idioma acessível do viewer). O probe do método inexistente foi substituído por uma verificação de que a suíte chama `_genHTML` sem condições; nenhum alias de produção foi criado.

Evidências RED (falhas antes das correções) e GREEN desta rodada: `/tmp/opencode/red-core.log`, `/tmp/opencode/red-panel.log` e `/tmp/opencode/check-after-p1.log`; contagens finais em `/tmp/opencode/probes-final.json`, `/tmp/opencode/workflows-final.json` e `/tmp/opencode/checker-final.json`. Nada foi commitado ou enviado ao upstream; a PR #97 continua aberta e independente.

## 11. Atualização de implementação: E3 — manutenção verificável (2026-11-04)

- **A10 — aprovação seletiva:** `--sync-manifest` foi removido. A única escrita no manifesto agora é `node scripts/check-i18n.mjs --approve <key> [key...]`, que atualiza apenas as chaves listadas via `approveManifestEntries`; `buildReviewManifest` permanece como bootstrap inicial documentado. `--status` é somente leitura e lista pendências e referências dinâmicas. O teste “manifest approval is explicit per key…” simula a atualização upstream: fonte alterada permanece pendente até a aprovação explícita daquela chave.
- **A11 — pontos cegos fechados:**
  - Módulos `src/core/*.mjs` passam a ser analisados: chaves de `tr()` são validadas contra o catálogo zh-CN. Para isso, o padrão `${origin}.` foi eliminado dos três módulos (52 chaves viraram literais `'core.*'`), removendo a classe de risco que causou A02.
  - Argumentos condicionais/lógicos e templates sem expressões são resolvidos estaticamente; todas as ramificações precisam existir. Argumentos dinâmicos são reportados com arquivo, linha e chamada no `--status` (16 ocorrências hoje), em vez de ignorados em silêncio.
  - Duplicatas de chave em JSON são detectadas antes do `JSON.parse` em `loadDiskCatalogs`.
  - A exceção por escapes Unicode foi removida: o valor decodificado decide. A varredura revelou dois tokens legítimos antes escondidos (`所有时间`, `前一日`) — ambos matchers de valores remotos, agora na allowlist.
  - A allowlist de CJK deixou de ser global por texto: cada token é permitido apenas no método que o usa, com motivo registrado; o erro sugere onde o mesmo texto é permitido.
- **Verificação:** `npm run check` com **336/336 testes**; checker 913 chaves; probe do checker **7/7** (exit 0); probes de núcleo e workflows inalterados em **8/13** e **9/10**, com as falhas restantes pertencendo a E4/E5.

## 12. Atualização de implementação: E4 — mensagens e formato (2026-11-04)

- **Mensagens próprias classificadas:** erros de acesso, rate limit, respostas não JSON/HTTP, falhas de rede e timeout, autorização, upload, atividade/bookmarks e autenticação agora usam catálogos `zh-CN`/`en-US`. Mensagens não vazias vindas do servidor continuam sendo preservadas; códigos, status, URLs, payloads, retry e cancelamento não foram alterados.
- **Exportação e mídia:** progresso e falhas de imagens, texto alternativo, fonte matemática e rótulos CSS usam o translator injetado. O CSS escapa controles, delimitadores e sequências de fechamento HTML. `htmlToMarkdown` aceita translator somente para exportação; o caminho de Markdown enviado à IA continua sem translator para preservar prompts e comportamento de saída.
- **Formato:** datas de exportação, posts, histórico, LDC/CDK e utilitários seguem `I18n.getLocale()`, com `—` para datas inválidas. O contador de histórico em inglês usa formas plurais para 0/1/2/valores grandes; a descrição do modo breve mantém o orçamento em caracteres chineses, não “words”. O viewer destacado declara `lang`, `role=dialog`, `aria-modal` e rótulo acessível próprios.
- **Verificação GREEN:** `npm run check` passou com **347/347 testes**, checker com **944 chaves** e ambos os bundles consistentes. Os probes executáveis passaram em **13/13 no núcleo**, **10/10 nos workflows** e **7/7 no checker**. A aprovação seletiva registrou **31 chaves** novas no `review-manifest.json`.
- **Classificação/exclusões do inventário:** aliases de parsing, identificadores canônicos, logs e prompts não são texto de apresentação a traduzir. `abortError()` mantém o fallback chinês standalone e o nome `AbortError`; os consumidores de UI substituem a mensagem por seu estado localizado de cancelamento. Os primeiros retornos das páginas bridge e seu aviso independente não recebem preferência do painel: ficam explicitamente pendentes da revisão de protocolo/smoke de bridges em E1/E5, sem alterar contratos de `postMessage` nesta rodada. A mensagem de possível bloqueio de IP preserva a incerteza do diagnóstico original, em vez de afirmar que todo 403 é bloqueio.
- **Evidência RED:** `/tmp/opencode/e4-red-core.json` (**8/13**), `/tmp/opencode/e4-red-workflows.json` (**9/10**), `/tmp/opencode/e4-red-tests.log` e `/tmp/opencode/e4-red-final-tests.log`; os testes atuais foram copiados para uma cópia isolada do commit `2c5e967`, sem alterar o código de produção do baseline. Logs intermediários `e4-red-owned-errors.log`/`e4-red-extended.log` não são o aceite final (incluíam problemas da fixture/import resolvidos depois).
- **Artefatos GREEN:** `/tmp/opencode/e4-final-check.log`, `/tmp/opencode/e4-final-core.json`, `/tmp/opencode/e4-final-workflows.json` e `/tmp/opencode/e4-final-checker.json`. Nenhum commit, push ou PR foi feito nesta rodada.
- **Limites restantes:** não declarar ainda cobertura completa de instalação real em Tampermonkey/Violentmonkey, Firefox, bridges externas, PDF/print em browsers reais ou matriz visual completa de acessibilidade. Esses itens permanecem em E5/E6; a issue #95 continua não reproduzida por falta de evidências do ambiente do relato.
