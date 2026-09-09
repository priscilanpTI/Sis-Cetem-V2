# Agenda de Salas

Primeira versão funcional do módulo independente de agendamento de salas.

## Estado atual
- React + TypeScript + Vite
- Dashboard
- Cadastro de agendamentos
- Listagem e cancelamento
- Regra de conflito de horários
- Salas mockadas
- Agendamentos temporariamente persistidos no localStorage

O `localStorage` é usado apenas nesta etapa de desenvolvimento para permitir testar o fluxo completo. A camada `bookingService` foi isolada para ser substituída pela integração Google Apps Script + Google Sheets sem alterar as páginas.

## Rodar
```bash
npm install
npm run dev
```

## Próxima etapa
1. Criar Google Sheet com abas SALAS e AGENDAMENTOS.
2. Criar Web App no Google Apps Script.
3. Implementar endpoints/listagem, criação, atualização e cancelamento.
4. Substituir a implementação de `src/services/bookingService.ts` por chamadas HTTP ao Apps Script.

## Versão 0.2 — integração com Google Apps Script

Esta versão usa a variável `VITE_APPS_SCRIPT_URL` do arquivo `.env` para carregar salas e agendamentos e para criar/cancelar reservas no Google Sheets.

Antes de usar o botão Cancelar, siga `GOOGLE_APPS_SCRIPT_CANCELAMENTO.md` e publique uma nova versão do Web App.
