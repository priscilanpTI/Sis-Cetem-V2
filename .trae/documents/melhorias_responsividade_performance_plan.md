# Melhorias de Responsividade e Performance — Plano de Implementação

## Repository Research

Arquitetura atual do projeto:
- **Frontend**: React 18 + TypeScript + Vite
- **Estilização**: CSS global (styles.css) + CSS modular por página (*.css na pasta pages)
- **Roteamento**: React Router DOM com Layout persistente (sidebar + content)
- **Backend**: Google Apps Script via apiClient.ts com cache em sessionStorage (10min)
- **Páginas**: 7 telas principais: Dashboard, Bookings (agenda), NewBooking, MapaCompetencias, RegistroExtraclasse, RelatorioCompetencias, RelatorioExtraclasse

### Problemas críticos identificados

**1. Responsividade:**
- Sidebar em mobile vira grade 1fr mas sem menu colapsável → ocupando muito espaço vertical
- Master planner (`master-planner-header`, `master-planner-room`) tem `min-width: 1400px` hardcoded, causando overflow horizontal massivo
- Breakpoints inconsistentes entre telas: styles.css usa 900/700/600; RelatorioCompetencias usa 1180/820; MapaCompetencias usa 1000/640
- `.rc-indicators` com 5 colunas quebra em 1180 mas falta breakpoint em 768 para 2 colunas
- RelatorioExtraclasse.tsx usa classes `report-cards`, `report-filter`, `report-table-panel`, `report-description` — NÃO existentes em nenhum CSS
- Planner em NewBooking e Bookings não tem sticky column no mobile (quando faz scroll lateral o horário/some)
- `.mc-summary` em MapaCompetencias com 5 colunas — telas 700-1000px ficam apertadas

**2. Performance / Agilidade de Leitura:**
- `bookingMatchesDateRange` em bookingDates.ts: faz loop while de TODOS os dias do overlap quando poderia pular diretamente para os próximos dias da semana selecionados (O(n) → O(k), k = dias da semana)
- `generateOccurrences`: idem, poderia calcular dias pulando de semana em semana em vez de dia-a-dia
- Bookings.tsx `plannerRooms.map`: para cada sala, roda `flatMap + generateOccurrences` dentro do render sem useMemo adequado — se 10 salas * 30 dias = 300 iterações repetidas
- Chamadas repetidas a `listarFuncionariosPublicos()` em 3 páginas diferentes (NewBooking, RegistroExtraclasse, RelatorioExtraclasse) sem cache compartilhado
- Todas as telas de relatório e MapaCompetencias têm listas que podem crescer para centenas de itens SEM paginação virtual/lazy
- Loading states são só texto "Carregando..." sem skeleton visual (piora percepção de velocidade)
- `bookingService.list()` SEM cache (diferente de salas/softwares que têm 10min)

**3. UX/Leitura Rápida:**
- Sem sticky headers em tabelas grandes (ex: MapaCompetencias com 50+ UCs)
- Sem filtro de busca rápida nas listas de funcionários/salas (select nativo com 100+ opções é difícil)
- Sem scroll suave e sem indicador de progresso em formulários longos

## Files and Modules

| Arquivo | Mudança Esperada |
|---|---|
| `src/utils/bookingDates.ts` | Otimizar `bookingMatchesDateRange` e `generateOccurrences` com algoritmo de saltos de semana |
| `src/components/Layout.tsx` | Adicionar sidebar colapsável (hambúrguer) em mobile |
| `src/styles.css` | Corrigir `min-width:1400px` do planner; unificar breakpoints; adicionar sticky horizontal; adicionar skeleton styles |
| `src/pages/Bookings.tsx` | Memoizar cálculos pesados; extrair componente de evento |
| `src/pages/NewBooking.tsx` | Memoizar planner grid; extrair componentes |
| `src/pages/MapaCompetencias.tsx` | Sticky header do summary; barra de progresso; busca em UCs |
| `src/pages/RegistroExtraclasse.tsx` | (Sem mudanças estruturais, CSS já ok) |
| `src/pages/RelatorioExtraclasse.tsx` | Criar/mapear classes CSS faltantes; adicionar overflow-x wrapper |
| `src/pages/RelatorioExtraclasse.css` | (Criar se não existir ou preencher classes vazias) |
| `src/pages/RelatorioCompetencias.css` | Adicionar breakpoint 768px para 2 colunas nos indicadores |
| `src/services/apiClient.ts` | Adicionar `listFuncionarios` com cache 10min |
| `src/services/bookingService.ts` | Adicionar cache em `list()` (5min) |
| `src/services/funcionarioService.ts` | Usar cache do apiClient |

## Implementation Steps

1. **Otimizar algoritmos de data** (`bookingDates.ts`):
   - Reescrever `generateOccurrences` para calcular primeira ocorrência de cada dia da semana e depois pular 7 dias por vez
   - Reescrever `bookingMatchesDateRange` para validar apenas dias da semana dentro do overlap, não todos os dias

2. **Responsividade do Shell** (`Layout.tsx + styles.css`):
   - Criar state `sidebarOpen` com toggle hambúrguer em telas < 900px
   - Sidebar em mobile vira drawer fixo com overlay
   - Melhorar brand e links para ficarem compactos

3. **Corrigir Planner e Breakpoints Globais** (`styles.css`):
   - Remover `min-width: 1400px` hardcoded; fazer grid responsivo com valores minmax
   - Adicionar estilos de skeleton (`.skeleton`, `.skeleton-pulse`)
   - Unificar breakpoints padrão: 1200, 900, 700, 500
   - Fixar `.master-planner-room-info` e `.master-planner-times` como sticky left

4. **Performance em Bookings.tsx**:
   - Adicionar cache/ttl 5min no bookingService.list()
   - Criar useMemo para `roomBookingsByRoom` (Map<roomId, Booking[]>) fora do loop
   - Extrair `<PlannerEvent />` como React.memo para evitar re-render de 100+ eventos

5. **MapaCompetencias.tsx**:
   - Deixar `.mc-summary` sticky no topo durante scroll
   - Adicionar campo de busca/filtrar unidades curriculares
   - Barra de progresso linear de respondidas

6. **Relatórios**:
   - RelatorioExtraclasse.tsx: renomear classes ou criar CSS correspondente `.report-cards`, `.report-filter`, etc
   - RelatorioCompetencias.css: breakpoint 768px → 2 colunas nos indicadores
   - Ambas: adicionar wrapper de scroll horizontal com sombra indicativa

7. **Cache Compartilhado**:
   - bookingService.list() com ttl 5min
   - funcionarioService.listarFuncionariosPublicos com ttl 10min via apiClient cache
   - Remover chamadas duplicadas de validação de funcionário (debounce 300ms)

8. **Skeletons**:
   - Criar `<SkeletonCard />` inline ou direto no CSS para dashboard cards, tabelas, planners
   - Substituir "Carregando..." por skeleton em todas as páginas

9. **NewBooking.tsx**:
   - Memoizar resultado do planner grid com useMemo
   - Separar horários já calculados em useMemo

10. **Build/Validação**:
    - `npm install` (se necessário)
    - `npm run build` para TypeScript + Vite
    - Corrigir erros de tipagem

## Dependencies and Considerations

- Nenhuma dependência nova a ser instalada (React, date-fns, lucide já disponíveis)
- Google Apps Script não precisa de alterações (todas as otimizações são client-side)
- Breakpoints: unificar para `>= 1200px desktop`, `900-1199 tablet-lg`, `700-899 tablet-sm`, `500-699 mobile-lg`, `<500 mobile-sm`
- Não alterar tipos/API de services — apenas adicionar cache e uso interno

## Validation

1. Build TypeScript: `npm run build` deve passar sem erros
2. Teste responsivo manual em DevTools:
   - 360px (mobile): sidebar em drawer, 1 coluna em todos os grids, planner com scroll lateral
   - 768px (tablet): 2 colunas em cards, sidebar compacta ou drawer
   - 1440px (desktop): layout original intacto
3. Performance: DevTools → Performance, gravar uma navegação completa:
   - generateOccurrences e bookingMatchesDateRange não devem aparecer no topo
   - Render de planner com 10 salas e 50 eventos < 200ms
4. Cache: DevTools → Application → sessionStorage, verificar entradas `sgd-cache:*` sendo criadas e reutilizadas

## Risks

- **Risco: Regressão em cálculo de ocorrências** → mitigação: comparar output antigo vs novo em 20 casos teste (dias da semana isolados, períodos longos, finais de semana) em script temporário ou durante validação
- **Risco: Sidebar drawer quebra navegação** → mitigação: manter NavLink idênticos, apenas trocar wrapper CSS
- **Risco: Cache stale apresentando dados desatualizados após criar agendamento** → mitigação: `clearSessionCache('agendamentos')` já existe em `cancel()` e deve ser adicionado em `create()` do bookingService também
