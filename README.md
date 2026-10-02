# SGD — Sistema de Gestão Docente

Versão final consolidada com Agenda de Salas, Atividades Extraclasse e Mapa de Competências.

## Alterações desta versão

- Login **Master único e global** no menu lateral. A mesma sessão habilita:
  - dados completos e cancelamento em Agendamentos;
  - Relatório Extraclasse;
  - Relatório do Mapa de Competências.
- Matrícula deixou de ser preenchida automaticamente. O usuário digita a matrícula e o Apps Script valida no servidor.
- A lista pública de funcionários contém somente **ID interno + nome**. Matrículas e e-mails não são enviados em listas ao navegador.
- Depois de validar funcionário + matrícula, o e-mail oficial é retornado e preenchido como somente leitura.
- Novo Agendamento, Extraclasse e Mapa usam lista suspensa de funcionários.
- Mapa de Competências permite selecionar **vários cursos por checkbox** e faz a união das UCs sem duplicá-las.
- Nova aba `FUNCIONARIOS_CURSOS` registra os cursos efetivamente selecionados pelo instrutor.
- Confirmações por e-mail para:
  - novo agendamento;
  - atividade extraclasse;
  - mapa de competências;
  - cancelamento de agendamento pelo Master.
- Otimizações:
  - cache no navegador para catálogos estáticos;
  - `CacheService` no Apps Script para funcionários, salas, softwares, categorias e catálogo do mapa;
  - atualização em lote no Mapa de Competências;
  - sessão Master validada uma única vez por sessão do navegador.

## Front-end

```bash
npm install
npm run dev
```

A URL do Web App fica em `.env`:

```env
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/SEU_ID/exec
```

## Google Apps Script

Use somente os arquivos da pasta `google-apps-script/`:

- `Code.gs`
- `Funcionarios.gs`
- `MapaCompetencias.gs`
- `CargaInicialMapaCompetencias.gs`

Consulte `ATUALIZACAO_FINAL.md` antes de publicar a nova versão.
