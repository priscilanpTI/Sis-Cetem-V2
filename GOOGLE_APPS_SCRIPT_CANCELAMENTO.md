# Complemento do Google Apps Script — cancelamento

Antes de usar o botão **Cancelar** do front-end, adicione a função abaixo ao `Code.gs`.

```javascript
function cancelarAgendamento(id) {
  const agendamentoId = normalizarTexto(id);

  if (!agendamentoId) {
    throw new Error("Informe o ID do agendamento.");
  }

  const lock = LockService.getScriptLock();
  let lockObtido = false;

  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
    lockObtido = true;

    const aba = obterAba(CONFIG.ABA_AGENDAMENTOS);
    const cabecalhos = validarCabecalhos(aba, CABECALHOS.AGENDAMENTOS);
    const ultimaLinha = aba.getLastRow();

    if (ultimaLinha < 2) {
      throw new Error("Agendamento não encontrado.");
    }

    const indiceId = cabecalhos.indexOf("id");
    const indiceStatus = cabecalhos.indexOf("status");
    const indiceAtualizadoEm = cabecalhos.indexOf("atualizado_em");

    const dados = aba
      .getRange(2, 1, ultimaLinha - 1, cabecalhos.length)
      .getValues();

    const indiceLinha = dados.findIndex(
      linha => normalizarTexto(linha[indiceId]) === agendamentoId
    );

    if (indiceLinha === -1) {
      throw new Error("Agendamento não encontrado.");
    }

    const linhaPlanilha = indiceLinha + 2;
    const statusAtual = normalizarTexto(dados[indiceLinha][indiceStatus]).toUpperCase();

    if (statusAtual === CONFIG.STATUS_AGENDAMENTO_CANCELADO) {
      return {
        sucesso: true,
        mensagem: "O agendamento já estava cancelado."
      };
    }

    aba.getRange(linhaPlanilha, indiceStatus + 1)
      .setValue(CONFIG.STATUS_AGENDAMENTO_CANCELADO);

    aba.getRange(linhaPlanilha, indiceAtualizadoEm + 1)
      .setValue(new Date());

    SpreadsheetApp.flush();

    return {
      sucesso: true,
      mensagem: "Agendamento cancelado com sucesso."
    };

  } finally {
    if (lockObtido) {
      lock.releaseLock();
    }
  }
}
```

Depois, dentro do `switch (acao)` da função `doPost(e)`, adicione este caso antes do `default`:

```javascript
case "cancelarAgendamento":
  return respostaJson(
    cancelarAgendamento(dados.id)
  );
```

Salve, teste no editor se desejar e faça uma **nova versão da implantação** do Web App.
