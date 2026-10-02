/**
 * ============================================================
 * FUNCIONÁRIOS, PRIVACIDADE, CACHE E E-MAILS - SGD
 * ============================================================
 * A lista pública expõe somente id + nome.
 * Matrícula e e-mail permanecem no servidor e só são usados
 * após validação do par funcionário + matrícula.
 * ============================================================
 */

const FUNC_CONFIG = Object.freeze({
  CACHE_SEGUNDOS: 600,
  REMETENTE_NOME: 'SGD - Sistema de Gestão Docente'
});

function funcCache() {
  return CacheService.getScriptCache();
}

function funcLimparCache() {
  ['FUNC_COMPLETOS', 'FUNC_PUBLICOS']
    .forEach(function (chave) { funcCache().remove(chave); });

  if (typeof sgdLimparCacheCatalogos === 'function') {
    sgdLimparCacheCatalogos();
  }
}

/**
 * Execute uma vez após instalar esta versão.
 * Adiciona as colunas id e email à aba FUNCIONARIOS sem apagar
 * matrículas, nomes ou status existentes.
 */
function migrarCadastroFuncionarios() {
  const planilha = obterPlanilha();
  let aba = planilha.getSheetByName(CONFIG.ABA_FUNCIONARIOS);

  if (!aba) {
    aba = planilha.insertSheet(CONFIG.ABA_FUNCIONARIOS);
    aba.getRange(1, 1, 1, 5).setValues([['id', 'matricula', 'nome', 'email', 'status']]);
  }

  if (aba.getLastRow() === 0) {
    aba.getRange(1, 1, 1, 5).setValues([['id', 'matricula', 'nome', 'email', 'status']]);
  }

  let cabecalhos = aba.getRange(1, 1, 1, Math.max(aba.getLastColumn(), 1)).getValues()[0].map(normalizarTexto);

  ['id', 'matricula', 'nome', 'email', 'status'].forEach(cabecalho => {
    if (!cabecalhos.includes(cabecalho)) {
      const novaColuna = aba.getLastColumn() + 1;
      aba.getRange(1, novaColuna).setValue(cabecalho);
      cabecalhos.push(cabecalho);
    }
  });

  cabecalhos = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].map(normalizarTexto);
  const idxId = cabecalhos.indexOf('id');
  const idxMatricula = cabecalhos.indexOf('matricula');
  const idxNome = cabecalhos.indexOf('nome');
  const ultimaLinha = aba.getLastRow();
  let idsCriados = 0;

  if (ultimaLinha >= 2) {
    const dados = aba.getRange(2, 1, ultimaLinha - 1, cabecalhos.length).getValues();
    dados.forEach((linha, i) => {
      const temPessoa = normalizarTexto(linha[idxMatricula]) || normalizarTexto(linha[idxNome]);
      if (temPessoa && !normalizarTexto(linha[idxId])) {
        aba.getRange(i + 2, idxId + 1).setValue('FUN-' + Utilities.getUuid().split('-')[0].toUpperCase());
        idsCriados += 1;
      }
    });
  }

  aba.setFrozenRows(1);
  aba.getRange(1, 1, 1, aba.getLastColumn()).setFontWeight('bold');
  SpreadsheetApp.flush();
  funcLimparCache();

  return {
    sucesso: true,
    mensagem: 'Cadastro de funcionários preparado. Preencha a coluna email para cada funcionário ativo.',
    idsCriados: idsCriados,
    cabecalhos: cabecalhos
  };
}

function listarFuncionariosCompletos() {
  const cache = funcCache();
  const salvo = cache.get('FUNC_COMPLETOS');
  if (salvo) return JSON.parse(salvo);

  const aba = obterAba(CONFIG.ABA_FUNCIONARIOS);
  const cabecalhos = validarCabecalhos(aba, ['id', 'matricula', 'nome', 'email', 'status']);
  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return [];

  const indice = {};
  cabecalhos.forEach((nome, i) => indice[nome] = i);

  const dados = aba.getRange(2, 1, ultimaLinha - 1, cabecalhos.length).getValues()
    .map(linha => ({
      id: normalizarTexto(linha[indice.id]),
      matricula: normalizarTexto(linha[indice.matricula]),
      nome: normalizarTexto(linha[indice.nome]),
      email: normalizarTexto(linha[indice.email]),
      status: normalizarTexto(linha[indice.status]).toUpperCase()
    }))
    .filter(item => item.id && item.matricula && item.nome && (!item.status || item.status === CONFIG.STATUS_ATIVO))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  cache.put('FUNC_COMPLETOS', JSON.stringify(dados), FUNC_CONFIG.CACHE_SEGUNDOS);
  return dados;
}

function listarFuncionariosPublicos() {
  const cache = funcCache();
  const salvo = cache.get('FUNC_PUBLICOS');
  if (salvo) return JSON.parse(salvo);

  const dados = listarFuncionariosCompletos().map(item => ({ id: item.id, nome: item.nome }));
  cache.put('FUNC_PUBLICOS', JSON.stringify(dados), FUNC_CONFIG.CACHE_SEGUNDOS);
  return dados;
}

function obterFuncionarioValidado(funcionarioId, matricula) {
  const id = normalizarTexto(funcionarioId);
  const numero = normalizarTexto(matricula);

  if (!id || !numero) {
    throw new Error('Selecione o funcionário e digite sua matrícula.');
  }

  const funcionario = listarFuncionariosCompletos().find(item => item.id === id && item.matricula === numero);
  if (!funcionario) {
    throw new Error('A matrícula informada não corresponde ao funcionário selecionado. Verifique e tente novamente.');
  }

  if (!funcionario.email) {
    throw new Error('O funcionário selecionado ainda não possui e-mail cadastrado. Procure o responsável pelo sistema.');
  }

  return funcionario;
}

function validarFuncionarioPrivado(funcionarioId, matricula) {
  const funcionario = obterFuncionarioValidado(funcionarioId, matricula);
  return {
    sucesso: true,
    funcionario: {
      id: funcionario.id,
      nome: funcionario.nome,
      email: funcionario.email
    }
  };
}

function enviarEmailSgd(destinatario, assunto, corpoTexto, corpoHtml) {
  const email = normalizarTexto(destinatario);
  if (!email) return { enviado: false, erro: 'E-mail não cadastrado.' };

  try {
    if (MailApp.getRemainingDailyQuota() <= 0) {
      return { enviado: false, erro: 'Cota diária de e-mails esgotada.' };
    }

    MailApp.sendEmail({
      to: email,
      subject: assunto,
      body: corpoTexto,
      htmlBody: corpoHtml || corpoTexto.replace(/\n/g, '<br>'),
      name: FUNC_CONFIG.REMETENTE_NOME
    });
    return { enviado: true, erro: '' };
  } catch (erro) {
    console.error('Falha ao enviar e-mail SGD: ' + (erro.message || erro));
    return { enviado: false, erro: erro.message || String(erro) };
  }
}

function escaparHtml(valor) {
  return normalizarTexto(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Execute uma vez no editor do Apps Script depois de instalar esta versão.
 * A função não envia mensagem; apenas confirma a autorização do MailApp
 * e informa a cota disponível naquele momento.
 */
function testarPermissaoEmailSgd() {
  const restante = MailApp.getRemainingDailyQuota();
  const resultado = {
    sucesso: true,
    mensagem: 'Permissão de e-mail disponível.',
    cotaRestante: restante
  };
  console.log(JSON.stringify(resultado, null, 2));
  return resultado;
}

/**
 * Lista funcionários ativos que ainda não possuem e-mail cadastrado.
 * Uso administrativo no editor do Apps Script.
 */
function diagnosticarEmailsFuncionarios() {
  const pendentes = listarFuncionariosCompletos()
    .filter(function (item) { return !normalizarTexto(item.email); })
    .map(function (item) {
      return { id: item.id, nome: item.nome };
    });

  const resultado = {
    sucesso: pendentes.length === 0,
    quantidadeSemEmail: pendentes.length,
    funcionariosSemEmail: pendentes
  };

  console.log(JSON.stringify(resultado, null, 2));
  return resultado;
}
