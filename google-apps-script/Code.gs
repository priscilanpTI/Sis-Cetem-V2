/**
 * ============================================================
 * AGENDA DE SALAS - SGD
 * Google Apps Script + Google Sheets
 * Versão 2.0 - agendamento por período
 * ============================================================
 */

const CONFIG = Object.freeze({
  ABA_SALAS: 'SALAS',
  ABA_AGENDAMENTOS: 'AGENDAMENTOS',
  STATUS_SALA_ATIVA: 'ATIVA',
  STATUS_CONFIRMADO: 'CONFIRMADO',
  STATUS_CANCELADO: 'CANCELADO',
  LOCK_TIMEOUT_MS: 10000,
  MASTER_SESSION_SECONDS: 21600,
  PERIODO_MAX_DIAS: 30,
  MASTER_USUARIO_PADRAO: 'cetem.sis.ti',
  API_VERSION: '2.0.0'
});

const CABECALHOS = Object.freeze({
  SALAS: ['id', 'nome', 'capacidade', 'localizacao', 'status'],
  AGENDAMENTOS: [
    'id',
    'sala_id',
    'data_inicio',
    'data_fim',
    'hora_inicio',
    'hora_fim',
    'responsavel',
    'email_responsavel',
    'finalidade',
    'observacao',
    'status',
    'criado_em',
    'atualizado_em'
  ]
});

/* ============================================================
 * CONFIGURAÇÃO E MIGRAÇÃO
 * ============================================================ */

function configurarProjeto() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();

  if (!planilha) {
    throw new Error('Não foi possível identificar a planilha vinculada.');
  }

  PropertiesService.getScriptProperties().setProperty('PLANILHA_ID', planilha.getId());
  console.log('Projeto configurado: ' + planilha.getName());
}

/**
 * Execute UMA VEZ ao migrar da versão de agendamento por dia.
 *
 * Antes:
 * data
 *
 * Depois:
 * data_inicio | data_fim
 *
 * Para os registros antigos, data_fim recebe a mesma data de data_inicio,
 * preservando-os como reservas de um único dia.
 */
function migrarAgendamentosParaPeriodo() {
  const aba = obterAba(CONFIG.ABA_AGENDAMENTOS);
  const ultimaColuna = aba.getLastColumn();

  if (!ultimaColuna) {
    throw new Error('A aba AGENDAMENTOS está vazia.');
  }

  let cabecalhos = aba.getRange(1, 1, 1, ultimaColuna).getValues()[0]
    .map(valor => normalizarTexto(valor));

  const indiceInicioExistente = cabecalhos.indexOf('data_inicio');
  const indiceFimExistente = cabecalhos.indexOf('data_fim');

  if (indiceInicioExistente >= 0 && indiceFimExistente >= 0) {
    console.log('A planilha já está no formato de período. Nenhuma migração foi necessária.');
    validarCabecalhos(aba, CABECALHOS.AGENDAMENTOS);
    return;
  }

  const indiceDataAntiga = cabecalhos.indexOf('data');

  if (indiceDataAntiga >= 0) {
    const colunaData = indiceDataAntiga + 1;

    aba.getRange(1, colunaData).setValue('data_inicio');
    aba.insertColumnAfter(colunaData);
    aba.getRange(1, colunaData + 1).setValue('data_fim');

    const ultimaLinha = aba.getLastRow();

    if (ultimaLinha >= 2) {
      const datasAntigas = aba.getRange(2, colunaData, ultimaLinha - 1, 1).getValues();
      aba.getRange(2, colunaData + 1, ultimaLinha - 1, 1).setValues(datasAntigas);
    }
  } else if (indiceInicioExistente >= 0 && indiceFimExistente === -1) {
    const colunaInicio = indiceInicioExistente + 1;
    aba.insertColumnAfter(colunaInicio);
    aba.getRange(1, colunaInicio + 1).setValue('data_fim');

    const ultimaLinha = aba.getLastRow();

    if (ultimaLinha >= 2) {
      const datasInicio = aba.getRange(2, colunaInicio, ultimaLinha - 1, 1).getValues();
      aba.getRange(2, colunaInicio + 1, ultimaLinha - 1, 1).setValues(datasInicio);
    }
  } else {
    throw new Error(
      'Não foi encontrada a coluna "data" nem uma estrutura compatível com data_inicio/data_fim.'
    );
  }

  SpreadsheetApp.flush();
  validarCabecalhos(aba, CABECALHOS.AGENDAMENTOS);
  console.log('Migração concluída. Os agendamentos antigos foram preservados como períodos de um dia.');
}

/* ============================================================
 * PLANILHA
 * ============================================================ */

function obterPlanilha() {
  const id = PropertiesService.getScriptProperties().getProperty('PLANILHA_ID');

  if (id) {
    return SpreadsheetApp.openById(id);
  }

  const planilha = SpreadsheetApp.getActiveSpreadsheet();

  if (!planilha) {
    throw new Error('Planilha não configurada. Execute configurarProjeto().');
  }

  return planilha;
}

function obterAba(nome) {
  const aba = obterPlanilha().getSheetByName(nome);

  if (!aba) {
    throw new Error('A aba "' + nome + '" não foi encontrada.');
  }

  return aba;
}

function obterFusoHorario() {
  return obterPlanilha().getSpreadsheetTimeZone() || Session.getScriptTimeZone();
}

function validarCabecalhos(aba, esperados) {
  const ultimaColuna = aba.getLastColumn();

  if (!ultimaColuna) {
    throw new Error('A aba "' + aba.getName() + '" está vazia.');
  }

  const encontrados = aba.getRange(1, 1, 1, ultimaColuna).getValues()[0]
    .map(valor => normalizarTexto(valor));

  const faltantes = esperados.filter(item => !encontrados.includes(item));

  if (faltantes.length) {
    throw new Error(
      'A aba "' + aba.getName() + '" possui colunas ausentes: ' + faltantes.join(', ')
    );
  }

  return encontrados;
}

/* ============================================================
 * NORMALIZAÇÃO E DATAS
 * ============================================================ */

function normalizarTexto(valor) {
  return valor === null || valor === undefined ? '' : String(valor).trim();
}

function normalizarData(data) {
  if (data instanceof Date) {
    return Utilities.formatDate(data, obterFusoHorario(), 'yyyy-MM-dd');
  }

  const texto = normalizarTexto(data);
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];

  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return br[3] + '-' + br[2] + '-' + br[1];

  return texto;
}

function normalizarHora(hora) {
  if (hora instanceof Date) {
    return Utilities.formatDate(hora, obterFusoHorario(), 'HH:mm');
  }

  const texto = normalizarTexto(hora);
  const resultado = texto.match(/^(\d{1,2}):(\d{2})/);

  return resultado
    ? resultado[1].padStart(2, '0') + ':' + resultado[2]
    : texto;
}

function horaParaMinutos(hora) {
  const horario = normalizarHora(hora);
  const resultado = horario.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!resultado) {
    throw new Error('Horário inválido: "' + horario + '".');
  }

  return Number(resultado[1]) * 60 + Number(resultado[2]);
}

function dataValida(data) {
  const resultado = data.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!resultado) return false;

  const ano = Number(resultado[1]);
  const mes = Number(resultado[2]);
  const dia = Number(resultado[3]);
  const teste = new Date(Date.UTC(ano, mes - 1, dia));

  return teste.getUTCFullYear() === ano &&
    teste.getUTCMonth() === mes - 1 &&
    teste.getUTCDate() === dia;
}

function dataParaUtc(data) {
  const normalizada = normalizarData(data);

  if (!dataValida(normalizada)) {
    throw new Error('Data inválida: "' + normalizada + '".');
  }

  const partes = normalizada.split('-').map(Number);
  return Date.UTC(partes[0], partes[1] - 1, partes[2]);
}

/**
 * Contagem inclusiva:
 * 01/09 a 30/09 = 30 dias.
 */
function quantidadeDiasPeriodo(dataInicio, dataFim) {
  const inicio = dataParaUtc(dataInicio);
  const fim = dataParaUtc(dataFim);
  return Math.floor((fim - inicio) / 86400000) + 1;
}

function obterDataHoje() {
  return Utilities.formatDate(new Date(), obterFusoHorario(), 'yyyy-MM-dd');
}

function obterHoraAtual() {
  return Utilities.formatDate(new Date(), obterFusoHorario(), 'HH:mm');
}

/* ============================================================
 * SALAS
 * ============================================================ */

function listarSalas() {
  const aba = obterAba(CONFIG.ABA_SALAS);
  const cabecalhos = validarCabecalhos(aba, CABECALHOS.SALAS);
  const ultimaLinha = aba.getLastRow();

  if (ultimaLinha < 2) return [];

  return aba.getRange(2, 1, ultimaLinha - 1, cabecalhos.length).getValues()
    .filter(linha => normalizarTexto(linha[0]) !== '')
    .map(linha => {
      const sala = {};
      cabecalhos.forEach((cabecalho, indice) => sala[cabecalho] = linha[indice]);
      return sala;
    });
}

function listarSalasAtivas() {
  return listarSalas().filter(
    sala => normalizarTexto(sala.status).toUpperCase() === CONFIG.STATUS_SALA_ATIVA
  );
}

function obterSalaPorId(id) {
  const procurado = normalizarTexto(id).toUpperCase();
  return listarSalas().find(
    sala => normalizarTexto(sala.id).toUpperCase() === procurado
  );
}

/* ============================================================
 * AGENDAMENTOS
 * ============================================================ */

function listarAgendamentos() {
  const aba = obterAba(CONFIG.ABA_AGENDAMENTOS);
  const cabecalhos = validarCabecalhos(aba, CABECALHOS.AGENDAMENTOS);
  const ultimaLinha = aba.getLastRow();

  if (ultimaLinha < 2) return [];

  return aba.getRange(2, 1, ultimaLinha - 1, cabecalhos.length).getValues()
    .filter(linha => normalizarTexto(linha[0]) !== '')
    .map(linha => {
      const item = {};

      cabecalhos.forEach((cabecalho, indice) => {
        let valor = linha[indice];

        if (cabecalho === 'data_inicio' || cabecalho === 'data_fim') {
          valor = normalizarData(valor);
        } else if (cabecalho === 'hora_inicio' || cabecalho === 'hora_fim') {
          valor = normalizarHora(valor);
        } else if (valor instanceof Date) {
          valor = Utilities.formatDate(valor, obterFusoHorario(), "yyyy-MM-dd'T'HH:mm:ss");
        }

        item[cabecalho] = valor;
      });

      return item;
    });
}

function listarAgendamentosPublicos() {
  return listarAgendamentos().map(item => ({
    id: item.id,
    sala_id: item.sala_id,
    data_inicio: item.data_inicio,
    data_fim: item.data_fim,
    hora_inicio: item.hora_inicio,
    hora_fim: item.hora_fim,
    finalidade: item.finalidade,
    status: item.status
  }));
}

function listarAgendamentosMaster(token) {
  if (!validarTokenMaster(token)) {
    return {
      sucesso: false,
      mensagem: 'Sessão Master inválida ou expirada.'
    };
  }

  return {
    sucesso: true,
    dados: listarAgendamentos()
  };
}

/* ============================================================
 * VALIDAÇÃO E CONFLITO
 * ============================================================ */

function validarAgendamento(dados) {
  if (!dados || typeof dados !== 'object') {
    throw new Error('Dados do agendamento não informados.');
  }

  const agendamento = {
    sala_id: normalizarTexto(dados.sala_id),
    data_inicio: normalizarData(dados.data_inicio),
    data_fim: normalizarData(dados.data_fim),
    hora_inicio: normalizarHora(dados.hora_inicio),
    hora_fim: normalizarHora(dados.hora_fim),
    responsavel: normalizarTexto(dados.responsavel),
    email_responsavel: normalizarTexto(dados.email_responsavel),
    finalidade: normalizarTexto(dados.finalidade),
    observacao: normalizarTexto(dados.observacao)
  };

  if (!agendamento.sala_id) throw new Error('Informe a sala.');

  if (!agendamento.data_inicio) throw new Error('Informe a data inicial.');
  if (!dataValida(agendamento.data_inicio)) throw new Error('A data inicial informada é inválida.');

  if (!agendamento.data_fim) throw new Error('Informe a data final.');
  if (!dataValida(agendamento.data_fim)) throw new Error('A data final informada é inválida.');

  const hoje = obterDataHoje();

  if (agendamento.data_inicio < hoje) {
    throw new Error('Não é permitido iniciar um agendamento em uma data anterior à data atual.');
  }

  if (agendamento.data_fim < agendamento.data_inicio) {
    throw new Error('A data final deve ser igual ou posterior à data inicial.');
  }

  const quantidadeDias = quantidadeDiasPeriodo(
    agendamento.data_inicio,
    agendamento.data_fim
  );

  if (quantidadeDias > CONFIG.PERIODO_MAX_DIAS) {
    throw new Error(
      'O período máximo permitido é de ' + CONFIG.PERIODO_MAX_DIAS + ' dias corridos.'
    );
  }

  if (!agendamento.hora_inicio) throw new Error('Informe o horário inicial.');
  if (!agendamento.hora_fim) throw new Error('Informe o horário final.');

  const inicio = horaParaMinutos(agendamento.hora_inicio);
  const fim = horaParaMinutos(agendamento.hora_fim);

  if (inicio >= fim) {
    throw new Error('O horário final deve ser posterior ao horário inicial.');
  }

  if (agendamento.data_inicio === hoje) {
    const minutosAgora = horaParaMinutos(obterHoraAtual());

    if (inicio <= minutosAgora) {
      throw new Error(
        'Para períodos que começam hoje, o horário inicial deve ser posterior ao horário atual.'
      );
    }
  }

  if (!agendamento.responsavel) throw new Error('Informe o responsável.');
  if (!agendamento.finalidade) throw new Error('Informe a finalidade.');

  const sala = obterSalaPorId(agendamento.sala_id);

  if (!sala) throw new Error('A sala informada não existe.');

  if (normalizarTexto(sala.status).toUpperCase() !== CONFIG.STATUS_SALA_ATIVA) {
    throw new Error('A sala informada está inativa.');
  }

  return agendamento;
}

/**
 * Há conflito quando, para a mesma sala:
 * 1) os períodos de datas se sobrepõem; E
 * 2) os horários diários se sobrepõem.
 */
function existeConflito(salaId, dataInicio, dataFim, horaInicio, horaFim) {
  const sala = normalizarTexto(salaId).toUpperCase();
  const novoInicioData = normalizarData(dataInicio);
  const novoFimData = normalizarData(dataFim);
  const novoInicioHora = horaParaMinutos(horaInicio);
  const novoFimHora = horaParaMinutos(horaFim);

  return listarAgendamentos().some(item => {
    if (normalizarTexto(item.status).toUpperCase() === CONFIG.STATUS_CANCELADO) return false;
    if (normalizarTexto(item.sala_id).toUpperCase() !== sala) return false;

    const periodosSeSobrepoem =
      novoInicioData <= normalizarData(item.data_fim) &&
      novoFimData >= normalizarData(item.data_inicio);

    if (!periodosSeSobrepoem) return false;

    const inicioExistente = horaParaMinutos(item.hora_inicio);
    const fimExistente = horaParaMinutos(item.hora_fim);

    const horariosSeSobrepoem =
      novoInicioHora < fimExistente &&
      novoFimHora > inicioExistente;

    return horariosSeSobrepoem;
  });
}

/* ============================================================
 * CRIAÇÃO
 * ============================================================ */

function criarAgendamento(dados) {
  const lock = LockService.getScriptLock();
  let obtido = false;

  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
    obtido = true;

    const agendamento = validarAgendamento(dados);

    if (existeConflito(
      agendamento.sala_id,
      agendamento.data_inicio,
      agendamento.data_fim,
      agendamento.hora_inicio,
      agendamento.hora_fim
    )) {
      return {
        sucesso: false,
        mensagem:
          'A sala já possui um agendamento que conflita com alguma data e horário deste período.'
      };
    }

    const id = 'AG-' + Utilities.getUuid().split('-')[0].toUpperCase();
    const agora = new Date();

    obterAba(CONFIG.ABA_AGENDAMENTOS).appendRow([
      id,
      agendamento.sala_id,
      agendamento.data_inicio,
      agendamento.data_fim,
      agendamento.hora_inicio,
      agendamento.hora_fim,
      agendamento.responsavel,
      agendamento.email_responsavel,
      agendamento.finalidade,
      agendamento.observacao,
      CONFIG.STATUS_CONFIRMADO,
      agora,
      agora
    ]);

    SpreadsheetApp.flush();

    return {
      sucesso: true,
      mensagem: 'Agendamento por período realizado com sucesso.',
      id: id
    };
  } finally {
    if (obtido) lock.releaseLock();
  }
}

/* ============================================================
 * MASTER
 * ============================================================ */

function hashSenha(senha, salt) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + String(senha),
    Utilities.Charset.UTF_8
  );

  return bytes.map(byte => {
    const valor = byte < 0 ? byte + 256 : byte;
    return valor.toString(16).padStart(2, '0');
  }).join('');
}

/**
 * Define o usuário Master como cetem.sis.ti e solicita apenas a senha.
 * Execute manualmente somente se quiser criar/trocar a senha Master.
 */
function configurarUsuarioMaster() {
  const ui = SpreadsheetApp.getUi();
  const usuario = CONFIG.MASTER_USUARIO_PADRAO;

  const respostaSenha = ui.prompt(
    'Configuração do usuário Master',
    'Usuário: ' + usuario + '\n\nInforme a nova senha do usuário Master:',
    ui.ButtonSet.OK_CANCEL
  );

  if (respostaSenha.getSelectedButton() !== ui.Button.OK) return;

  const senha = respostaSenha.getResponseText();

  if (senha.length < 8) {
    throw new Error('A senha deve possuir pelo menos 8 caracteres.');
  }

  const salt = Utilities.getUuid();
  const senhaHash = hashSenha(senha, salt);

  PropertiesService.getScriptProperties().setProperties({
    MASTER_USUARIO: usuario,
    MASTER_SALT: salt,
    MASTER_SENHA_HASH: senhaHash
  });

  ui.alert('Usuário Master configurado com sucesso.\n\nUsuário: ' + usuario);
}

function autenticarMaster(usuario, senha) {
  const propriedades = PropertiesService.getScriptProperties();
  const usuarioConfigurado = propriedades.getProperty('MASTER_USUARIO');
  const salt = propriedades.getProperty('MASTER_SALT');
  const senhaHashConfigurada = propriedades.getProperty('MASTER_SENHA_HASH');

  if (!usuarioConfigurado || !salt || !senhaHashConfigurada) {
    throw new Error('O usuário Master ainda não foi configurado.');
  }

  const usuarioInformado = normalizarTexto(usuario).toLowerCase();
  const senhaHashInformada = hashSenha(String(senha || ''), salt);

  if (
    usuarioInformado !== normalizarTexto(usuarioConfigurado).toLowerCase() ||
    senhaHashInformada !== senhaHashConfigurada
  ) {
    return { sucesso: false, mensagem: 'Usuário ou senha inválidos.' };
  }

  const token = Utilities.getUuid() + Utilities.getUuid();

  CacheService.getScriptCache().put(
    'MASTER_TOKEN_' + token,
    usuarioConfigurado,
    CONFIG.MASTER_SESSION_SECONDS
  );

  return {
    sucesso: true,
    mensagem: 'Login realizado com sucesso.',
    token: token,
    usuario: usuarioConfigurado,
    validadeSegundos: CONFIG.MASTER_SESSION_SECONDS
  };
}

function validarTokenMaster(token) {
  const normalizado = normalizarTexto(token);
  if (!normalizado) return false;

  return Boolean(
    CacheService.getScriptCache().get('MASTER_TOKEN_' + normalizado)
  );
}

function verificarSessaoMaster(token) {
  return {
    sucesso: true,
    autenticado: validarTokenMaster(token)
  };
}

function logoutMaster(token) {
  const normalizado = normalizarTexto(token);

  if (normalizado) {
    CacheService.getScriptCache().remove('MASTER_TOKEN_' + normalizado);
  }

  return { sucesso: true, mensagem: 'Sessão encerrada.' };
}

/* ============================================================
 * CANCELAMENTO
 * ============================================================ */

function cancelarAgendamento(idAgendamento, token) {
  if (!validarTokenMaster(token)) {
    return {
      sucesso: false,
      mensagem: 'Apenas o usuário Master pode cancelar agendamentos.'
    };
  }

  const id = normalizarTexto(idAgendamento);
  if (!id) throw new Error('Informe o ID do agendamento.');

  const lock = LockService.getScriptLock();
  let obtido = false;

  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
    obtido = true;

    const aba = obterAba(CONFIG.ABA_AGENDAMENTOS);
    const cabecalhos = validarCabecalhos(aba, CABECALHOS.AGENDAMENTOS);
    const indiceId = cabecalhos.indexOf('id');
    const indiceStatus = cabecalhos.indexOf('status');
    const indiceAtualizado = cabecalhos.indexOf('atualizado_em');
    const ultimaLinha = aba.getLastRow();

    if (ultimaLinha < 2) throw new Error('Nenhum agendamento encontrado.');

    const dados = aba.getRange(2, 1, ultimaLinha - 1, cabecalhos.length).getValues();
    const indiceLinha = dados.findIndex(
      linha => normalizarTexto(linha[indiceId]).toUpperCase() === id.toUpperCase()
    );

    if (indiceLinha === -1) throw new Error('Agendamento não encontrado.');

    const statusAtual = normalizarTexto(dados[indiceLinha][indiceStatus]).toUpperCase();

    if (statusAtual === CONFIG.STATUS_CANCELADO) {
      return { sucesso: false, mensagem: 'Este agendamento já está cancelado.' };
    }

    const linhaPlanilha = indiceLinha + 2;

    aba.getRange(linhaPlanilha, indiceStatus + 1).setValue(CONFIG.STATUS_CANCELADO);
    aba.getRange(linhaPlanilha, indiceAtualizado + 1).setValue(new Date());
    SpreadsheetApp.flush();

    return {
      sucesso: true,
      mensagem: 'Todo o período do agendamento foi cancelado com sucesso.'
    };
  } finally {
    if (obtido) lock.releaseLock();
  }
}

/* ============================================================
 * API
 * ============================================================ */

function doGet(e) {
  try {
    const acao = normalizarTexto(e && e.parameter ? e.parameter.acao : '').toLowerCase();

    switch (acao) {
      case 'salas':
        return respostaJson({ sucesso: true, dados: listarSalasAtivas() });

      case 'agendamentos':
        return respostaJson({ sucesso: true, dados: listarAgendamentosPublicos() });

      default:
        return respostaJson({
          sucesso: true,
          mensagem: 'API Agenda de Salas - SGD funcionando',
          versao: CONFIG.API_VERSION,
          periodoMaximoDias: CONFIG.PERIODO_MAX_DIAS
        });
    }
  } catch (erro) {
    return respostaErro(erro);
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Corpo da requisição não informado.');
    }

    let dados;

    try {
      dados = JSON.parse(e.postData.contents);
    } catch (erroJson) {
      throw new Error('O corpo da requisição possui JSON inválido.');
    }

    const acao = normalizarTexto(dados.acao);

    switch (acao) {
      case 'criarAgendamento':
        return respostaJson(criarAgendamento(dados));

      case 'loginMaster':
        return respostaJson(autenticarMaster(dados.usuario, dados.senha));

      case 'validarSessaoMaster':
        return respostaJson(verificarSessaoMaster(dados.token));

      case 'logoutMaster':
        return respostaJson(logoutMaster(dados.token));

      case 'cancelarAgendamento':
        return respostaJson(cancelarAgendamento(dados.id, dados.token));

      case 'listarAgendamentosMaster':
        return respostaJson(listarAgendamentosMaster(dados.token));

      default:
        return respostaJson({ sucesso: false, mensagem: 'Ação inválida.' });
    }
  } catch (erro) {
    return respostaErro(erro);
  }
}

function respostaJson(conteudo) {
  return ContentService
    .createTextOutput(JSON.stringify(conteudo))
    .setMimeType(ContentService.MimeType.JSON);
}

function respostaErro(erro) {
  const mensagem = erro && erro.message ? erro.message : String(erro);
  console.error(mensagem);
  return respostaJson({ sucesso: false, mensagem: mensagem });
}

/* ============================================================
 * TESTES
 * ============================================================ */

function testarLeituraSalas() {
  const dados = listarSalasAtivas();
  console.log(JSON.stringify(dados, null, 2));
  return dados;
}

function testarLeituraAgendamentos() {
  const dados = listarAgendamentos();
  console.log(JSON.stringify(dados, null, 2));
  return dados;
}

function testarPeriodo30Dias() {
  const quantidade = quantidadeDiasPeriodo('2026-09-01', '2026-09-30');
  console.log('Quantidade de dias: ' + quantidade);
  return quantidade;
}

function testarConflitoPeriodo() {
  const resultado = existeConflito(
    'LAB201C',
    '2026-09-01',
    '2026-09-23',
    '08:00',
    '10:00'
  );

  console.log('Existe conflito no período? ' + resultado);
  return resultado;
}
