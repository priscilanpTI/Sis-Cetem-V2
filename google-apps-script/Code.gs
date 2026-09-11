/**
 * ============================================================
 * AGENDA DE SALAS - SGD
 * Google Apps Script + Google Sheets
 * Versão 3.0 - recorrência semanal + softwares por laboratório
 * ============================================================
 */

const CONFIG = Object.freeze({
  ABA_SALAS: 'SALAS',
  ABA_AGENDAMENTOS: 'AGENDAMENTOS',
  ABA_SOFTWARES: 'SOFTWARES',
  ABA_SALAS_SOFTWARES: 'SALAS_SOFTWARES',
  STATUS_SALA_ATIVA: 'ATIVA',
  STATUS_SOFTWARE_ATIVO: 'ATIVO',
  STATUS_CONFIRMADO: 'CONFIRMADO',
  STATUS_CANCELADO: 'CANCELADO',
  LOCK_TIMEOUT_MS: 10000,
  MASTER_SESSION_SECONDS: 21600,
  PERIODO_MAX_DIAS: 30,
  MASTER_USUARIO_PADRAO: 'cetem.sis.ti',
  API_VERSION: '3.0.0'
});

const DIAS_SEMANA = Object.freeze(['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB']);

const CABECALHOS = Object.freeze({
  SALAS: ['id', 'nome', 'capacidade', 'localizacao', 'status'],
  SOFTWARES: ['id', 'nome', 'status'],
  SALAS_SOFTWARES: ['sala_id', 'software_id'],
  AGENDAMENTOS: [
    'id',
    'sala_id',
    'data_inicio',
    'data_fim',
    'dias_semana',
    'hora_inicio',
    'hora_fim',
    'responsavel',
    'email_responsavel',
    'softwares',
    'observacao',
    'status',
    'criado_em',
    'atualizado_em'
  ]
});

/* ============================================================
 * CONFIGURAÇÃO E MIGRAÇÃO V0.6
 * ============================================================ */

function configurarProjeto() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  if (!planilha) throw new Error('Não foi possível identificar a planilha vinculada.');

  PropertiesService.getScriptProperties().setProperty('PLANILHA_ID', planilha.getId());
  console.log('Projeto configurado: ' + planilha.getName());
}

/**
 * EXECUTE UMA VEZ ao instalar a v0.6.
 *
 * A função:
 * - cria SOFTWARES e SALAS_SOFTWARES;
 * - cria softwares de exemplo se a aba estiver vazia;
 * - cria vínculos de exemplo para LAB201C e LAB202B;
 * - migra AGENDAMENTOS para incluir dias_semana e softwares;
 * - preserva a antiga finalidade dentro de observacao.
 */
function prepararVersao06() {
  configurarProjeto();
  criarEstruturaSoftwares();
  migrarAgendamentosVersao06();
  SpreadsheetApp.flush();
  console.log('Versão 0.6 preparada com sucesso.');
}

function criarEstruturaSoftwares() {
  const planilha = obterPlanilha();

  let abaSoftwares = planilha.getSheetByName(CONFIG.ABA_SOFTWARES);
  if (!abaSoftwares) abaSoftwares = planilha.insertSheet(CONFIG.ABA_SOFTWARES);

  let abaVinculos = planilha.getSheetByName(CONFIG.ABA_SALAS_SOFTWARES);
  if (!abaVinculos) abaVinculos = planilha.insertSheet(CONFIG.ABA_SALAS_SOFTWARES);

  if (abaSoftwares.getLastRow() === 0) {
    abaSoftwares.getRange(1, 1, 1, CABECALHOS.SOFTWARES.length).setValues([CABECALHOS.SOFTWARES]);
  }

  if (abaVinculos.getLastRow() === 0) {
    abaVinculos.getRange(1, 1, 1, CABECALHOS.SALAS_SOFTWARES.length).setValues([CABECALHOS.SALAS_SOFTWARES]);
  }

  validarCabecalhos(abaSoftwares, CABECALHOS.SOFTWARES);
  validarCabecalhos(abaVinculos, CABECALHOS.SALAS_SOFTWARES);

  if (abaSoftwares.getLastRow() === 1) {
    abaSoftwares.getRange(2, 1, 4, 3).setValues([
      ['SOFT001', 'Pacote Office', 'ATIVO'],
      ['SOFT002', 'Arduino IDE', 'ATIVO'],
      ['SOFT003', 'Visual Studio Code', 'ATIVO'],
      ['SOFT004', 'IntelliJ IDEA', 'ATIVO']
    ]);
  }

  if (abaVinculos.getLastRow() === 1) {
    const salasExistentes = listarSalas().map(sala => normalizarTexto(sala.id).toUpperCase());
    const vinculos = [];

    if (salasExistentes.includes('LAB201C')) {
      vinculos.push(['LAB201C', 'SOFT001'], ['LAB201C', 'SOFT002']);
    }

    if (salasExistentes.includes('LAB202B')) {
      vinculos.push(
        ['LAB202B', 'SOFT001'],
        ['LAB202B', 'SOFT003'],
        ['LAB202B', 'SOFT004']
      );
    }

    if (vinculos.length > 0) {
      abaVinculos.getRange(2, 1, vinculos.length, 2).setValues(vinculos);
    }
  }
}

function migrarAgendamentosVersao06() {
  const aba = obterAba(CONFIG.ABA_AGENDAMENTOS);
  const ultimaLinha = aba.getLastRow();
  const ultimaColuna = aba.getLastColumn();

  if (!ultimaColuna) throw new Error('A aba AGENDAMENTOS está vazia.');

  const valores = aba.getRange(1, 1, Math.max(ultimaLinha, 1), ultimaColuna).getValues();
  const cabecalhosAtuais = valores[0].map(normalizarTexto);

  const jaMigrada = CABECALHOS.AGENDAMENTOS.every(cabecalho => cabecalhosAtuais.includes(cabecalho));
  if (jaMigrada) {
    console.log('AGENDAMENTOS já está na estrutura da v0.6.');
    return;
  }

  const linhasMigradas = valores.slice(1)
    .filter(linha => normalizarTexto(linha[0]) !== '')
    .map(linha => {
      const atual = {};
      cabecalhosAtuais.forEach((cabecalho, indice) => atual[cabecalho] = linha[indice]);

      const dataAntiga = atual.data || '';
      const dataInicio = atual.data_inicio || dataAntiga;
      const dataFim = atual.data_fim || dataAntiga || dataInicio;
      const diasSemana = normalizarLista(atual.dias_semana).length
        ? normalizarLista(atual.dias_semana).join(',')
        : DIAS_SEMANA.join(',');

      const finalidadeAnterior = normalizarTexto(atual.finalidade);
      let observacao = normalizarTexto(atual.observacao);

      if (finalidadeAnterior) {
        const complemento = 'Finalidade anterior: ' + finalidadeAnterior;
        observacao = observacao ? observacao + ' | ' + complemento : complemento;
      }

      return [
        atual.id || '',
        atual.sala_id || '',
        dataInicio || '',
        dataFim || '',
        diasSemana,
        atual.hora_inicio || '',
        atual.hora_fim || '',
        atual.responsavel || '',
        atual.email_responsavel || '',
        atual.softwares || '',
        observacao,
        atual.status || CONFIG.STATUS_CONFIRMADO,
        atual.criado_em || '',
        atual.atualizado_em || ''
      ];
    });

  aba.clearContents();
  aba.getRange(1, 1, 1, CABECALHOS.AGENDAMENTOS.length).setValues([CABECALHOS.AGENDAMENTOS]);

  if (linhasMigradas.length > 0) {
    aba.getRange(2, 1, linhasMigradas.length, CABECALHOS.AGENDAMENTOS.length).setValues(linhasMigradas);
  }

  SpreadsheetApp.flush();
  validarCabecalhos(aba, CABECALHOS.AGENDAMENTOS);
  console.log('AGENDAMENTOS migrada para a v0.6. Registros antigos foram mantidos para todos os dias da semana.');
}

/* ============================================================
 * PLANILHA
 * ============================================================ */

function obterPlanilha() {
  const id = PropertiesService.getScriptProperties().getProperty('PLANILHA_ID');
  if (id) return SpreadsheetApp.openById(id);

  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  if (!planilha) throw new Error('Planilha não configurada. Execute configurarProjeto().');
  return planilha;
}

function obterAba(nome) {
  const aba = obterPlanilha().getSheetByName(nome);
  if (!aba) throw new Error('A aba "' + nome + '" não foi encontrada.');
  return aba;
}

function obterFusoHorario() {
  return obterPlanilha().getSpreadsheetTimeZone() || Session.getScriptTimeZone();
}

function validarCabecalhos(aba, esperados) {
  const ultimaColuna = aba.getLastColumn();
  if (!ultimaColuna) throw new Error('A aba "' + aba.getName() + '" está vazia.');

  const encontrados = aba.getRange(1, 1, 1, ultimaColuna).getValues()[0]
    .map(valor => normalizarTexto(valor));
  const faltantes = esperados.filter(item => !encontrados.includes(item));

  if (faltantes.length) {
    throw new Error('A aba "' + aba.getName() + '" possui colunas ausentes: ' + faltantes.join(', '));
  }

  return encontrados;
}

/* ============================================================
 * NORMALIZAÇÃO E DATAS
 * ============================================================ */

function normalizarTexto(valor) {
  return valor === null || valor === undefined ? '' : String(valor).trim();
}

function normalizarLista(valor) {
  if (Array.isArray(valor)) {
    return valor.map(normalizarTexto).filter(Boolean);
  }

  return normalizarTexto(valor)
    .split(',')
    .map(normalizarTexto)
    .filter(Boolean);
}

function normalizarDiasSemana(valor) {
  const dias = normalizarLista(valor).map(item => item.toUpperCase());
  const unicos = [...new Set(dias)];
  const invalidos = unicos.filter(item => !DIAS_SEMANA.includes(item));

  if (invalidos.length) {
    throw new Error('Dias da semana inválidos: ' + invalidos.join(', ') + '.');
  }

  return unicos;
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
  return resultado ? resultado[1].padStart(2, '0') + ':' + resultado[2] : texto;
}

function horaParaMinutos(hora) {
  const horario = normalizarHora(hora);
  const resultado = horario.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!resultado) throw new Error('Horário inválido: "' + horario + '".');
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
  if (!dataValida(normalizada)) throw new Error('Data inválida: "' + normalizada + '".');
  const partes = normalizada.split('-').map(Number);
  return Date.UTC(partes[0], partes[1] - 1, partes[2]);
}

function utcParaData(timestamp) {
  return Utilities.formatDate(new Date(timestamp), 'UTC', 'yyyy-MM-dd');
}

function quantidadeDiasPeriodo(dataInicio, dataFim) {
  return Math.floor((dataParaUtc(dataFim) - dataParaUtc(dataInicio)) / 86400000) + 1;
}

function obterDataHoje() {
  return Utilities.formatDate(new Date(), obterFusoHorario(), 'yyyy-MM-dd');
}

function obterHoraAtual() {
  return Utilities.formatDate(new Date(), obterFusoHorario(), 'HH:mm');
}

function codigoDiaSemana(data) {
  const timestamp = dataParaUtc(data);
  return DIAS_SEMANA[new Date(timestamp).getUTCDay()];
}

function gerarDatasOcorrencias(dataInicio, dataFim, diasSemana) {
  const dias = normalizarDiasSemana(diasSemana);
  const permitidos = new Set(dias);
  const resultado = [];
  const inicio = dataParaUtc(dataInicio);
  const fim = dataParaUtc(dataFim);

  for (let atual = inicio; atual <= fim; atual += 86400000) {
    const data = utcParaData(atual);
    if (permitidos.has(codigoDiaSemana(data))) resultado.push(data);
  }

  return resultado;
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
  return listarSalas().find(sala => normalizarTexto(sala.id).toUpperCase() === procurado);
}

/* ============================================================
 * SOFTWARES
 * ============================================================ */

function listarSoftwares() {
  const aba = obterAba(CONFIG.ABA_SOFTWARES);
  const cabecalhos = validarCabecalhos(aba, CABECALHOS.SOFTWARES);
  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return [];

  return aba.getRange(2, 1, ultimaLinha - 1, cabecalhos.length).getValues()
    .filter(linha => normalizarTexto(linha[0]) !== '')
    .map(linha => {
      const item = {};
      cabecalhos.forEach((cabecalho, indice) => item[cabecalho] = linha[indice]);
      return item;
    });
}

function listarSoftwaresAtivos() {
  return listarSoftwares().filter(
    software => normalizarTexto(software.status).toUpperCase() === CONFIG.STATUS_SOFTWARE_ATIVO
  );
}

function listarVinculosSalasSoftwares() {
  const aba = obterAba(CONFIG.ABA_SALAS_SOFTWARES);
  const cabecalhos = validarCabecalhos(aba, CABECALHOS.SALAS_SOFTWARES);
  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return [];

  return aba.getRange(2, 1, ultimaLinha - 1, cabecalhos.length).getValues()
    .filter(linha => normalizarTexto(linha[0]) !== '' && normalizarTexto(linha[1]) !== '')
    .map(linha => {
      const item = {};
      cabecalhos.forEach((cabecalho, indice) => item[cabecalho] = linha[indice]);
      return item;
    });
}

function listarSoftwaresPorSala(salaId) {
  const sala = normalizarTexto(salaId).toUpperCase();
  if (!sala) return [];

  const ids = new Set(
    listarVinculosSalasSoftwares()
      .filter(vinculo => normalizarTexto(vinculo.sala_id).toUpperCase() === sala)
      .map(vinculo => normalizarTexto(vinculo.software_id).toUpperCase())
  );

  return listarSoftwaresAtivos().filter(
    software => ids.has(normalizarTexto(software.id).toUpperCase())
  );
}

function validarSoftwaresDaSala(salaId, softwaresSelecionados) {
  const selecionados = normalizarLista(softwaresSelecionados).map(item => item.toUpperCase());
  if (selecionados.length === 0) return [];

  const permitidos = new Set(
    listarSoftwaresPorSala(salaId).map(item => normalizarTexto(item.id).toUpperCase())
  );

  const invalidos = selecionados.filter(id => !permitidos.has(id));
  if (invalidos.length) {
    throw new Error('Um ou mais softwares selecionados não estão disponíveis neste laboratório: ' + invalidos.join(', ') + '.');
  }

  return [...new Set(selecionados)];
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

      if (!normalizarLista(item.dias_semana).length) item.dias_semana = DIAS_SEMANA.join(',');
      return item;
    });
}

function listarAgendamentosPublicos() {
  return listarAgendamentos().map(item => ({
    id: item.id,
    sala_id: item.sala_id,
    data_inicio: item.data_inicio,
    data_fim: item.data_fim,
    dias_semana: item.dias_semana,
    hora_inicio: item.hora_inicio,
    hora_fim: item.hora_fim,
    softwares: item.softwares,
    status: item.status
  }));
}

function listarAgendamentosMaster(token) {
  if (!validarTokenMaster(token)) {
    return { sucesso: false, mensagem: 'Sessão Master inválida ou expirada.' };
  }

  return { sucesso: true, dados: listarAgendamentos() };
}

/* ============================================================
 * VALIDAÇÃO E CONFLITO
 * ============================================================ */

function validarAgendamento(dados) {
  if (!dados || typeof dados !== 'object') throw new Error('Dados do agendamento não informados.');

  const agendamento = {
    sala_id: normalizarTexto(dados.sala_id),
    data_inicio: normalizarData(dados.data_inicio),
    data_fim: normalizarData(dados.data_fim),
    dias_semana: normalizarDiasSemana(dados.dias_semana),
    hora_inicio: normalizarHora(dados.hora_inicio),
    hora_fim: normalizarHora(dados.hora_fim),
    responsavel: normalizarTexto(dados.responsavel),
    email_responsavel: normalizarTexto(dados.email_responsavel),
    softwares: normalizarLista(dados.softwares),
    observacao: normalizarTexto(dados.observacao)
  };

  if (!agendamento.sala_id) throw new Error('Informe o laboratório.');
  if (!agendamento.data_inicio || !dataValida(agendamento.data_inicio)) throw new Error('Informe uma data inicial válida.');
  if (!agendamento.data_fim || !dataValida(agendamento.data_fim)) throw new Error('Informe uma data final válida.');

  const hoje = obterDataHoje();
  if (agendamento.data_inicio < hoje) {
    throw new Error('Não é permitido iniciar um agendamento em uma data anterior à data atual.');
  }

  if (agendamento.data_fim < agendamento.data_inicio) {
    throw new Error('A data final deve ser igual ou posterior à data inicial.');
  }

  if (quantidadeDiasPeriodo(agendamento.data_inicio, agendamento.data_fim) > CONFIG.PERIODO_MAX_DIAS) {
    throw new Error('O período máximo permitido é de ' + CONFIG.PERIODO_MAX_DIAS + ' dias corridos.');
  }

  if (agendamento.dias_semana.length === 0) {
    throw new Error('Selecione pelo menos um dia da semana.');
  }

  const ocorrencias = gerarDatasOcorrencias(
    agendamento.data_inicio,
    agendamento.data_fim,
    agendamento.dias_semana
  );

  if (ocorrencias.length === 0) {
    throw new Error('Os dias da semana selecionados não ocorrem dentro do período informado.');
  }

  if (!agendamento.hora_inicio || !agendamento.hora_fim) throw new Error('Informe os horários inicial e final.');

  const inicio = horaParaMinutos(agendamento.hora_inicio);
  const fim = horaParaMinutos(agendamento.hora_fim);
  if (inicio >= fim) throw new Error('O horário final deve ser posterior ao horário inicial.');

  if (ocorrencias.includes(hoje) && inicio <= horaParaMinutos(obterHoraAtual())) {
    throw new Error('Para uma ocorrência de hoje, o horário inicial deve ser posterior ao horário atual.');
  }

  if (!agendamento.responsavel) throw new Error('Informe o responsável.');

  const sala = obterSalaPorId(agendamento.sala_id);
  if (!sala) throw new Error('O laboratório informado não existe.');
  if (normalizarTexto(sala.status).toUpperCase() !== CONFIG.STATUS_SALA_ATIVA) {
    throw new Error('O laboratório informado está inativo.');
  }

  agendamento.softwares = validarSoftwaresDaSala(agendamento.sala_id, agendamento.softwares);
  agendamento.ocorrencias = ocorrencias;
  return agendamento;
}

function encontrarConflitos(salaId, ocorrenciasNovas, horaInicio, horaFim) {
  const sala = normalizarTexto(salaId).toUpperCase();
  const datasNovas = new Set(ocorrenciasNovas);
  const novoInicio = horaParaMinutos(horaInicio);
  const novoFim = horaParaMinutos(horaFim);
  const conflitos = [];

  listarAgendamentos().forEach(item => {
    if (normalizarTexto(item.status).toUpperCase() === CONFIG.STATUS_CANCELADO) return;
    if (normalizarTexto(item.sala_id).toUpperCase() !== sala) return;

    const inicioExistente = horaParaMinutos(item.hora_inicio);
    const fimExistente = horaParaMinutos(item.hora_fim);
    const horariosSeSobrepoem = novoInicio < fimExistente && novoFim > inicioExistente;
    if (!horariosSeSobrepoem) return;

    const diasExistentes = normalizarDiasSemana(item.dias_semana);
    const ocorrenciasExistentes = gerarDatasOcorrencias(item.data_inicio, item.data_fim, diasExistentes);

    ocorrenciasExistentes.forEach(data => {
      if (datasNovas.has(data)) {
        conflitos.push({
          data: data,
          agendamento_id: normalizarTexto(item.id),
          hora_inicio: normalizarHora(item.hora_inicio),
          hora_fim: normalizarHora(item.hora_fim)
        });
      }
    });
  });

  const unicos = {};
  conflitos.forEach(item => {
    const chave = item.data + '|' + item.agendamento_id + '|' + item.hora_inicio + '|' + item.hora_fim;
    unicos[chave] = item;
  });

  return Object.values(unicos).sort((a, b) => a.data.localeCompare(b.data));
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
    const conflitos = encontrarConflitos(
      agendamento.sala_id,
      agendamento.ocorrencias,
      agendamento.hora_inicio,
      agendamento.hora_fim
    );

    if (conflitos.length) {
      const primeirasDatas = [...new Set(conflitos.map(item => item.data))].slice(0, 5);
      return {
        sucesso: false,
        mensagem: 'Não foi possível reservar. Existem conflitos nas datas: ' + primeirasDatas.join(', ') + (conflitos.length > 5 ? '...' : '') + '.',
        conflitos: conflitos
      };
    }

    const id = 'AG-' + Utilities.getUuid().split('-')[0].toUpperCase();
    const agora = new Date();

    obterAba(CONFIG.ABA_AGENDAMENTOS).appendRow([
      id,
      agendamento.sala_id,
      agendamento.data_inicio,
      agendamento.data_fim,
      agendamento.dias_semana.join(','),
      agendamento.hora_inicio,
      agendamento.hora_fim,
      agendamento.responsavel,
      agendamento.email_responsavel,
      agendamento.softwares.join(','),
      agendamento.observacao,
      CONFIG.STATUS_CONFIRMADO,
      agora,
      agora
    ]);

    SpreadsheetApp.flush();

    return {
      sucesso: true,
      mensagem: 'Agendamento recorrente realizado com sucesso.',
      id: id,
      ocorrencias: agendamento.ocorrencias
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
  if (senha.length < 8) throw new Error('A senha deve possuir pelo menos 8 caracteres.');

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
  return Boolean(CacheService.getScriptCache().get('MASTER_TOKEN_' + normalizado));
}

function verificarSessaoMaster(token) {
  return { sucesso: true, autenticado: validarTokenMaster(token) };
}

function logoutMaster(token) {
  const normalizado = normalizarTexto(token);
  if (normalizado) CacheService.getScriptCache().remove('MASTER_TOKEN_' + normalizado);
  return { sucesso: true, mensagem: 'Sessão encerrada.' };
}

/* ============================================================
 * CANCELAMENTO
 * ============================================================ */

function cancelarAgendamento(idAgendamento, token) {
  if (!validarTokenMaster(token)) {
    return { sucesso: false, mensagem: 'Apenas o usuário Master pode cancelar agendamentos.' };
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

    return { sucesso: true, mensagem: 'O agendamento recorrente foi cancelado com sucesso.' };
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

      case 'softwares':
        return respostaJson({ sucesso: true, dados: listarSoftwaresAtivos() });

      case 'softwaresporsala':
        return respostaJson({
          sucesso: true,
          dados: listarSoftwaresPorSala(e && e.parameter ? e.parameter.sala_id : '')
        });

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

function testarSoftwares201C() {
  const dados = listarSoftwaresPorSala('LAB201C');
  console.log(JSON.stringify(dados, null, 2));
  return dados;
}

function testarRecorrenciaQuartaQuinta() {
  const datas = gerarDatasOcorrencias(
    '2026-09-14',
    '2026-09-30',
    ['QUA', 'QUI']
  );
  console.log(JSON.stringify(datas));
  return datas;
}

function testarLeituraAgendamentos() {
  const dados = listarAgendamentos();
  console.log(JSON.stringify(dados, null, 2));
  return dados;
}
