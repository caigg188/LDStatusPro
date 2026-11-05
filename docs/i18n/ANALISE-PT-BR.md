# EN-US para o aplicativo LDStatusPro dentro do linux.do

**Estado atual (2026-11-05):** implementação publicada no branch `feat/i18n-topic-tools` do fork, incluindo E0/P1, E3 e correções de mensagens/formato de E4. Validação pós-rebase: 347/347 testes, 944 chaves e probes 13/13, 10/10 e 7/7. A matriz real de compatibilidade/interação de E1/E5 e a entrega E6 continuam pendentes. O plano vigente é [Auditoria e escopo E0–E6](AUDITORIA-E-ESCOPO-PT-BR.md). As seções de inventário e arquitetura abaixo preservam a análise histórica; não representam comprovação de cobertura completa.  
**Escopo confirmado pelo solicitante:** exclusivamente o userscript/aplicativo utilizado na página do `linux.do`.  
**Data:** 2026-11-01; estado reconciliado em 2026-11-05.  
**Baseline histórico:** `21a0e90a39bdf189fce519b779d41b16990cd874` (`v3.9.0.7`). **Base atual do branch:** `7f33767`, após merge da correção de layout da [PR #97](https://github.com/caigg188/LDStatusPro/pull/97) em 2026-11-05.  
**Fork:** `lulavc7221/LDStatusPro`; **upstream:** `caigg188/LDStatusPro`.  
**Proposta para apresentar ao mantenedor:** [UPSTREAM-PROPOSAL.md](UPSTREAM-PROPOSAL.md).

## 1. Recomendação

Adicionar a opção **English (US)** nas configurações do próprio plugin, mantendo `zh-CN` como padrão inicial. Extrair textos para catálogos com chaves semânticas estáveis e embutir um pequeno módulo de internacionalização no mesmo `.user.js` distribuído hoje.

A melhor forma de manter a integração saudável é propor a infraestrutura ao autor cedo, com uma primeira PR pequena que demonstre a troca de idioma. Em seguida, migrar áreas funcionais em PRs curtas. Depois da extração inicial, a maior parte da manutenção de tradução ocorre nos catálogos, com detecção automática de textos novos e traduções desatualizadas.

Não há garantia de zero conflitos: o aplicativo concentra grande parte da implementação em um único arquivo. Reduzir mudanças mecânicas e incorporar os pontos de tradução no upstream são as medidas de maior impacto.

## 2. Escopo da entrega

### Interface controlada pelo plugin dentro do linux.do

- Painel principal, cabeçalho, configurações, aparência, tamanho de fonte, objetivo de leitura e organização das ações.
- Requisitos de trust level, métricas, tendências, gráficos e rankings.
- Atividade, histórico, favoritos, seguidores e demais funcionalidades abertas pelo painel.
- Login do plugin, sincronização, atualização, notificações e mensagens de erro.
- Overlays de LDC, CDK e tickets apresentados pelo próprio aplicativo.
- Ferramentas de resumo/IA, configurações, histórico e exportação de tópicos.
- Rótulos de links/atalhos externos exibidos pelo plugin.
- Tooltips, `title`, `aria-label`, placeholders, estados vazios/carregando/erro, confirmações e cabeçalhos gerados de arquivos exportados.

### Limite desta fase

`ld-store/` e a experiência do site institucional em `website/` não são entregas de tradução desta fase. A interface nativa do fórum e as páginas externas abertas por links também não são controladas pelo plugin. Posts, nomes, títulos de tópicos, respostas livres de tickets e conteúdo de IA mantêm seu idioma original; o entorno da interface é localizado.

O mesmo userscript atende outros domínios. A implementação deve preservar sua compatibilidade, mas a cobertura funcional e visual de EN-US solicitada é a aplicação dentro do `linux.do`. Bridges em `credit.linux.do` e `cdk.linux.do` devem continuar funcionando.

**Dependência técnica a considerar:** o CI atual reconstrói o site quando o `.user.js` muda, e o gerador de previews valida hashes de screenshots. Pode ser necessário um ajuste mínimo no gerador e recaptura das imagens chinesas existentes para manter os checks verdes. Isso é manutenção da dependência de build, não tradução do site. Não contornar esse check nem incluir uma expansão de escopo disfarçada.

## 3. Contexto e método da análise inicial

- `origin` aponta para o fork; `upstream` para o original. Na coleta inicial, `origin/main...upstream/main` tinha **0 commits exclusivos de cada lado**.
- Branch de planejamento inicial: `docs/en-us-localization-plan`; implementação consolidada em `feat/i18n-topic-tools`.
- Análise estática de fontes, normas do repositório, geração e CI. Builds e suites funcionais não foram executados nesta etapa documental.

| Área pertinente | Arquivos | Linhas | Linhas contendo CJK |
|---|---:|---:|---:|
| `LDStatusPro.user.js` | 1 | 17.530 | 2.189 |
| `src/core/*.mjs` | 5 | 818 | 69 |

Contagem por linha com caracteres U+3400–U+9FFF. Inclui comentários, mensagens técnicas e código embutido; **não representa quantidade de mensagens únicas**. O inventário definitivo deverá extrair e classificar os textos realmente visíveis. Não foi encontrada infraestrutura de i18n no plugin examinado.

## 4. Achados concretos

As referências de linha são do baseline informado.

### Identificadores chineses não são todos textos de UI

Em `LDStatusPro.user.js:534–547`, `MILESTONES` e `TREND_FIELDS` usam chinês como chaves e termos de busca, além de rótulos. `NAME_MAP` (`:576–592`) normaliza nomes recebidos do fórum.

**Ação:** preservar chaves, aliases, IDs, seletores e valores persistidos. Acrescentar `labelKey` ou uma tabela de apresentação. Traduzir apenas na renderização. Substituição global de strings pode quebrar métricas e histórico.

### Rótulos também são produzidos fora dos templates

`_normalizeReadingLevels` (`:1727–1788`) reconhece aliases ingleses e os converte em chinês. Há rótulos remotos e valores em cache.

**Ação:** separar identidade canônica da apresentação. Mapear níveis conhecidos para chaves estáveis e localizar quando exibidos. Não gravar os rótulos traduzidos em histórico ou sincronização. Níveis remotos desconhecidos precisam de tratamento explícito e, se necessário, contrato de IDs/locales com o backend.

### A interface é imperativa e distribuída

| Entrada | Local aproximado | Trabalho de tradução |
|---|---|---|
| `TicketManager` | 5989 | Listas, formulários, status e erros |
| `TopicExporter` | 6531 | Controles, progresso, falhas e cabeçalhos HTML/Markdown/PDF |
| `UI` | 7154 | Helpers de apresentação compartilhados |
| `LDCManager` | 7261 | Visão geral, transações e apoio |
| `CDKManager` | 8261 | Projetos, requisitos e registros |
| `MelonHelper` | 8748 | Resumo/IA, ajustes, histórico e visualizador |
| `FollowManager` | 9968 | Seguidores e seguindo |
| `Renderer` | 10334 | Requisitos, leitura, tendências e feedback |
| `ActivityManager` | 11067 | Histórico e atividade |
| `Panel` / `_createPanel` | 11685 / 12019 | Estrutura, menus, configurações e seletor de idioma |

Esse mapa inicia o inventário; não prova cobertura total. Notificações, fluxos de rede e mensagens produzidas em `src/core/topic-ai.mjs`, `topic-content.mjs` e `topic-export.mjs` também entram na revisão.

### Persistência já oferece um ponto de integração

`Storage._globalKey` (`:1257`) inclui `CURRENT_SITE.prefix`: “global” significa global ao site, não compartilhado entre todos os sites. `getGlobal` e `setGlobalNow` (`:1312–1324`) permitem persistir uma nova preferência sem dependência do usuário.

**Ação:** usar `storage.getGlobal('locale', 'zh-CN')` e `storage.setGlobalNow('locale', locale)` com validação. Persistir antes de uma eventual recarga; não usar escrita com debounce nesse momento. Manter a preferência por site, conforme o padrão atual, e não sincronizá-la na nuvem nesta etapa.

### O arquivo principal não é totalmente gerado

`scripts/embed-core.mjs` gera somente o bloco `@@CORE_SANITIZE_*`, com esbuild. O restante do `.user.js` é editado diretamente.

**Ação:** acrescentar um bloco i18n próprio, determinístico, com fonte em `src/i18n/` e verificação de consistência. Não editar manualmente o conteúdo gerado nem reestruturar todo o monólito para introduzir traduções.

### Preview e CI são dependências reais

`website/scripts/build-plugin-preview.mjs:16–23` exige hash correspondente às capturas; `:82–95` avalia declarações de apresentação extraídas por AST. Uma chamada nova a `I18n` exige disponibilizar essa declaração pura no sandbox, sem executar rede, OAuth ou rastreadores.

`.github/workflows/ci.yml:61–63` cobre `src/core`, mas não um futuro `src/i18n`. Atualizar os filtros e `tests/ci-changes.test.mjs` na PR da infraestrutura. Mudanças no módulo/catálogos devem acionar o check do plugin e a verificação da dependência de preview. Nenhum job da loja deve ser adicionado apenas por existir um módulo de tradução do plugin; respeitar, porém, os gatilhos amplos já existentes para mudanças em scripts/workflows.

## 5. Arquitetura recomendada para o plugin

### Módulo pequeno com catálogo embutido

```text
src/i18n/
  index.mjs                     # interface, resolução de idioma e formatação
  locales/zh-CN/*.json           # fonte por domínio
  locales/en-US/*.json           # tradução por domínio
  review-manifest.json           # hash da fonte revisada por tradução
scripts/
  embed-i18n.mjs                 # bloco próprio no .user.js
  check-i18n.mjs                 # cobertura, placeholders e drift
tests/
  i18n.test.mjs
  ... fixtures e testes de interface existentes
```

Interface de uso: `t(key, params)`, `getLocale()` e inicialização/configuração de locale; formatadores com locale explícito e opções de apresentação. Persistência fica no adapter de `Storage`, não dentro de funções puras usadas nos testes/previews.

**Motor implementado e medido na Etapa 1:** runtime mínimo próprio sem dependências externas de runtime, apoiado diretamente nas APIs nativas do navegador (`Intl.PluralRules`, `Intl.NumberFormat`, `Intl.DateTimeFormat` e `Intl.RelativeTimeFormat`), embutido via `esbuild` (`scripts/embed-i18n.mjs`). Medição real com os 82 pares `zh-CN`/`en-US` da Etapa 1 (`panel` + `settings`): **8.757 bytes minificados (4.022 bytes gzip)** — contra ~48 KB minificados apenas da biblioteca `i18next` sem catálogos. Inclui pluralização CLDR nativa, interpolação de passagem única, `t()` (texto puro para DOM) e `tHtml()` (escape automático de HTML e aspas para templates).

Usar catálogos por domínio (`panel`, `settings`, `trends`, `activity`, `ldc`, `cdk`, `tickets`, `ai`, `export`, `errors`). Compartilhar mensagens somente quando o significado realmente for igual. Exemplos de chaves: `settings.language`, `trends.topicsRead`, `export.progress`.

Ambos os idiomas acompanham o userscript. Isso evita downloads de tradução, falhas de CDN, mais permissões e dependência online para abrir o painel.

### Comportamento do seletor

1. Novo item nas configurações: `简体中文` / `English (US)`, acessível mesmo sem login no plugin.
2. Preferência salva válida → idioma escolhido; sem preferência/valor inválido → `zh-CN`.
3. Para a primeira implementação, aplicar mediante recarga explícita é a opção de menor risco, pois há muitos overlays imperativos. Oferecer salvar a preferência e aplicar quando for seguro; não forçar recarga durante resumo, exportação, formulário ou operação ativa. O aviso deve deixar claro se o idioma só será aplicado no próximo carregamento.
4. Uma troca instantânea pode vir depois, se todos os pontos de renderização preservarem estado e listeners sem reiniciar rastreadores ou requisições de negócio.
5. Definir `lang` nos contêineres do plugin e em seus documentos exportados, não no `<html>` do fórum.
6. Se a persistência falhar, informar no idioma escolhido e não prometer que a preferência sobreviverá à recarga.

### Regras de tradução

- Chaves semânticas estáveis, não o próprio chinês, número de linha ou hash do texto.
- Frases completas com placeholders nomeados e plurais reais, evitando concatenação de fragmentos.
- Validar famílias de plural conforme cada idioma: inglês e chinês não precisam dos mesmos sufixos.
- Catálogos como texto por padrão. `textContent` é preferível quando possível; em templates HTML, escapar texto e atributos corretamente, mantendo `Utils.escapeHtml`/sanitização nos pontos existentes. Não concatenar HTML não confiável vindo de tradução/interpolação.
- Aplicar `Intl.NumberFormat`, `Intl.DateTimeFormat` e `Intl.RelativeTimeFormat` à apresentação. Auditar cada uso de datas antes de mudar: locale não altera parsing, armazenamento, fuso de negócio ou cortes diários.
- LDC permanece LDC; EN-US não significa moeda USD.
- Mensagens de erros conhecidas devem usar código/chave + parâmetros. Preservar contratos existentes e traduzir na apresentação. Para erros remotos sem código, usar fallback contextual e registrar a lacuna; não descartar uma instrução essencial do servidor em troca de mensagem genérica.
- Conteúdo oficial remoto exibido pelo plugin precisa de tradução ou contrato coordenado. Fallback chinês é resiliência, não cobertura concluída.
- Idioma de saída da IA é uma preferência separada da UI. Preservar prompts personalizados e referências/citações como `[第1楼]` até que parser, geração e testes sejam alterados conjuntamente.

## 6. Estratégia de atualização com upstream

### Branches e PRs pequenas

Manter `main` próxima do original. Criar branches curtas por objetivo, como `feat/i18n-foundation`, `feat/i18n-panel`, `feat/i18n-topic-tools`. Não criar uma edição inglesa permanente nem duplicar os arquivos da aplicação.

Exemplo local, somente com árvore limpa e `main` sem commits exclusivos:

```bash
git fetch --prune origin
git fetch --prune upstream
git switch main
git merge --ff-only upstream/main
git switch -c feat/i18n-foundation
```

Se houver divergência, revisar antes de integrar. Branch privada pode ser rebaseada sobre o upstream; em branch compartilhada, coordenar a estratégia. Evitar force-push rotineiro, substituição de arquivos inteiros, mudanças de formatação e refatorações alheias à tradução. Após squash-merge, partir da nova base e não reaplicar trabalho já aceito.

`AGENTS.md` exige fluxo por PR/CI gate e não trata criar branch como autorização de commit, push ou deploy. Esta análise e a proposta acompanham agora o branch de implementação; a auditoria vinculada registra as evidências e pendências atuais.

### Catálogos atualizados por diferença

Propor `check:i18n` para verificar:

1. Chaves faltantes, duplicadas, obsoletas e referências sem mensagem.
2. Placeholders incompatíveis e plurais incompletos.
3. Hash da fonte chinesa/contexto contra o hash aprovado da tradução inglesa. Mudança na fonte com a mesma chave marca **tradução desatualizada**.
4. Novas strings visíveis fora de catálogo, com extração AST de strings/templates e classificação de destino. Regex CJK ajuda na triagem; não comprova cobertura.
5. Exclusões explícitas para parser, chaves de dados, logs, comentários e conteúdo de teste.

O extrator não pode atualizar o hash aprovado automaticamente, pois isso esconderia traduções antigas. Relatório por atualização: **adicionadas / fonte alterada / removidas / aguardando revisão**. Tradução automática pode produzir rascunhos; contexto, instruções e terminologia exigem revisão.

Durante a migração, manter um baseline que diminui e impedir regressões nas áreas já migradas. Para anunciar EN-US completo, exigir cobertura revisada de todo o escopo do plugin. Fallback `en-US → zh-CN` não conta como tradução. Se uma correção urgente upstream precisar sair antes da revisão, declarar o atraso em vez de prometer cobertura inexistente.

Rotina em cada mudança upstream relevante, não apenas em tags:

1. Registrar SHA antigo e novo; integrar a atualização.
2. Gerar delta de mensagens e revisar mudanças de contratos remotos.
3. Atualizar somente traduções afetadas e revisar os hashes.
4. Regenerar i18n e núcleo quando necessário; cumprir a dependência existente de preview.
5. Rodar checks e cenários bilíngues afetados; entregar PR com cobertura e pendências.

## 7. Histórico de implementação — execução restante no plano E0–E6

| Etapa | Entrega | Critério de aceite |
|---|---|---|
| 0 | Proposta e inventário do plugin | Documentada em `UPSTREAM-PROPOSAL.md` |
| 1 | **Implementada localmente (`8eadef7`):** motor, checker, seletor e configurações | Histórico: 82 chaves, 314 testes; auditoria revelou lacunas de recarga e aprovação de revisão |
| 2 | **Implementada localmente (`fa2dde5`):** painel, requisitos, leitura, tendências, rankings e mensagens comuns | Histórico: 377 chaves, 318 testes; equivalência dos cenários testados não comprova cobertura de todo o plugin |
| 3 | **Implementada parcialmente (`3fa467e`, `afa5cf4`):** seguidores, tickets, atividade e LDC/CDK | Histórico inicial: 528 chaves, 323 testes; auditoria reproduziu tipos LDC como `undefined`, escape duplo e erros ainda chineses |
| 4 | **Implementada parcialmente (`1513b7c`):** IA, histórico, exportação e tradução injetada no núcleo | Estado agregado: 913 chaves, 328 testes; teste de HTML pulava asserções; namespace, fallback e viewer requerem correções |
| 5 | **Auditoria concluída; escopo E0–E6 em execução (E0+P1+E3 aplicados em 2026-11-04)** | 12 achados consolidados; critérios de aceite no novo documento; suíte verde após E0+P1 e E3 |

As contagens e SHAs acima são marcos históricos anteriores ao rebase, não provas de completude ou de revisão semântica humana. Para o estado atual de E0/P1, E3 e E4, consultar as seções 10–12 da auditoria. Os pacotes E0–E6 definem entregas, dependências e provas de aceite; cada correção deve acompanhar sua reprodução e teste de regressão.

## 8. Validação

Reaproveitar `node:test`, jsdom e as fixtures existentes. `tests/topic-components.test.mjs` já testa componentes reais de resumo/exportação, incluindo cancelamento e histórico. `scripts/preview-topic-tools.mjs` oferece demonstração local com dados sintéticos; ampliá-la ou criar fixture equivalente para o painel, sem depender dos serviços de produção.

Testar especialmente:

- Persistência antes da recarga; locale inválido; falha de storage; modo offline; reload com idioma escolhido.
- Painel e overlays, autenticação do plugin, estados vazios e falhas; nenhum reinício/duplicação de rastreadores por locale.
- Identificadores, parser chinês, dados de histórico, payloads e cálculos iguais em ambos os idiomas.
- Plural 0/1/2, números/datas, fusos e unidades; rótulos remotos desconhecidos.
- Interpolação de aspas, `<`, `&` e HTML malicioso.
- Exportações HTML/Markdown/PDF, idioma do documento e preservação do conteúdo do tópico.
- Layout estreito, expansão de texto, claro/escuro, teclado e nomes acessíveis; pseudolocalização como diagnóstico e inglês real como aceite.
- Verificação em linux.do com userscript de desenvolvimento; smoke de compatibilidade dos demais matches/bridges do mesmo arquivo.

Na auditoria de 2026-11-04, `npm run check` (já incluindo `check:i18n`) passou 328/328 testes. Os probes adicionais demonstraram lacunas dessa validação. O build completo do website não foi reexecutado nessa rodada; as verificações afetadas continuam requisito de entrega.

**Definição de pronto:** inventário de superfícies do plugin revisado; todas as mensagens próprias dentro do escopo traduzidas e atuais; nenhuma chave exposta ou fallback inesperado nos cenários; regressões de dados ausentes; limitações de conteúdo externo explicitadas; atualização de catálogo demonstrada a partir de uma alteração da fonte.

## 9. Publicação e contribuição

`CI.md` informa que merge em `main` publica o userscript. `@updateURL` e `@downloadURL` (`LDStatusPro.user.js:36–37`) apontam para o original. Manter o caminho oficial no PR; para testes locais, impedir que auto-update substitua o experimento por configuração de desenvolvimento adequada.

Respeitar a marca e regras em `design/`; a opção de idioma deve seguir os controles do plugin. Evitar mudanças globais de identidade, layout ou estrutura comercial.

O próximo passo é apresentar a contribuição como rascunho para discussão com o mantenedor e completar E5/E6: compatibilidade real de managers/browsers, layout/acessibilidade, viewer e impressão/PDF, proveniência das capturas, checks afetados e plano de versão/entrega. [UPSTREAM-PROPOSAL.md](UPSTREAM-PROPOSAL.md) reúne as decisões solicitadas. A PR #97 foi integrada; a versão do userscript permanece `3.9.0.7`.

## 10. Copilot e delegação

O solicitante autorizou configurar um custom agent com Copilot se necessário. Esta etapa documental não precisou disso. Na implementação, tarefas úteis seriam inventário de textos, rascunhos de tradução e revisão de placeholders/cobertura, com instruções explícitas sobre as chaves chinesas intocáveis e o escopo do plugin.

Antes de configurar, confirmar se o alvo é GitHub Copilot custom agent ou um agente local executado com um modelo do provider Copilot: os formatos e execução diferem. Verificar disponibilidade/autenticação do ambiente, limitar o agente aos arquivos pertinentes e revisar seus resultados. Não incluir PAT em arquivos de instrução, prompts de tarefas ou configurações versionadas.
