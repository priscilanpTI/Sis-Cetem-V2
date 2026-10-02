/**
 * ============================================================
 * AGENDA DE SALAS - SGD
 * Google Apps Script + Google Sheets
 * Versão 3.3.0 - privacidade + e-mails + master global + otimizações
 * ============================================================
 */

const CONFIG = Object.freeze({
  // Abas principais
  ABA_SALAS: 'SALAS',
  ABA_AGENDAMENTOS: 'AGENDAMENTOS',
  ABA_SOFTWARES: 'SOFTWARES',
  ABA_SALAS_SOFTWARES: 'SALAS_SOFTWARES',

  // Módulo Extraclasse
  ABA_FUNCIONARIOS: 'FUNCIONARIOS',
  ABA_CATEGORIAS_EXTRACLASSE: 'CATEGORIAS_EXTRACLASSE',
  ABA_ATIVIDADES_EXTRACLASSE: 'ATIVIDADES_EXTRACLASSE',

  // Status
  STATUS_SALA_ATIVA: 'ATIVA',
  STATUS_SOFTWARE_ATIVO: 'ATIVO',
  STATUS_ATIVO: 'ATIVO',
  STATUS_CONFIRMADO: 'CONFIRMADO',
  STATUS_CANCELADO: 'CANCELADO',

  // Regras do sistema
  PERIODO_MAX_DIAS: 30,
  LOCK_TIMEOUT_MS: 10000,

  // Master
  MASTER_USUARIO_PADRAO: 'master',
  MASTER_SESSION_SECONDS: 21600, // 6 horas

  // API
  API_VERSION: '3.3.0'
});

// Formato canônico utilizado internamente por Agendamentos e Extraclasse.
const DIAS_SEMANA = Object.freeze(['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB']);

const CABECALHOS = Object.freeze({
  SALAS: [
    'id',
    'nome',
    'capacidade',
    'localizacao',
    'status'
  ],

  SOFTWARES: [
    'id',
    'nome',
    'status'
  ],

  SALAS_SOFTWARES: [
    'sala_id',
    'software_id'
  ],

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
  ],

  FUNCIONARIOS: [
    'id',
    'matricula',
    'nome',
    'email',
    'status'
  ],

  CATEGORIAS_EXTRACLASSE: [
    'id',
    'categoria',
    'status'
  ],

  ATIVIDADES_EXTRACLASSE: [
    'id',
    'nome',
    'matricula',
    'data_inicio',
    'data_fim',
    'dias_semana',
    'datas_realizadas',
    'categoria',
    'carga_horaria_diaria',
    'qtd_dias',
    'carga_horaria_total',
    'descricao',
    'criado_em'
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
  sgdLimparCacheCatalogos();
  console.log('Versão 0.6 preparada com sucesso.');
}


/**
 * EXECUTE UMA VEZ após colar esta versão completa.
 * É seguro executar novamente: as funções de criação são idempotentes
 * e a migração de AGENDAMENTOS só ocorre se a estrutura ainda for antiga.
 */
function prepararSistemaCompleto() {
  configurarProjeto();
  criarEstruturaSoftwares();
  migrarAgendamentosVersao06();
  migrarCadastroFuncionarios();
  configurarModuloExtraclasse();

  if (typeof configurarModuloMapaCompetencias === 'function') {
    configurarModuloMapaCompetencias();
  }

  SpreadsheetApp.flush();

  return {
    sucesso: true,
    mensagem: 'Sistema preparado: agenda, softwares, extraclasse e mapa de competências.'
  };
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

function removerAcentos(texto) {
  return normalizarTexto(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizarDiasSemana(valor) {
  const aliases = {
    DOM: 'DOM', DOMINGO: 'DOM',
    SEG: 'SEG', SEGUNDA: 'SEG', 'SEGUNDA-FEIRA': 'SEG', 'SEGUNDA FEIRA': 'SEG',
    TER: 'TER', TERCA: 'TER', 'TERCA-FEIRA': 'TER', 'TERCA FEIRA': 'TER',
    QUA: 'QUA', QUARTA: 'QUA', 'QUARTA-FEIRA': 'QUA', 'QUARTA FEIRA': 'QUA',
    QUI: 'QUI', QUINTA: 'QUI', 'QUINTA-FEIRA': 'QUI', 'QUINTA FEIRA': 'QUI',
    SEX: 'SEX', SEXTA: 'SEX', 'SEXTA-FEIRA': 'SEX', 'SEXTA FEIRA': 'SEX',
    SAB: 'SAB', SABADO: 'SAB'
  };

  const informados = normalizarLista(valor);
  const convertidos = [];
  const invalidos = [];

  informados.forEach(item => {
    const chave = removerAcentos(item).toUpperCase();
    const codigo = aliases[chave];
    if (codigo) convertidos.push(codigo);
    else invalidos.push(item);
  });

  if (invalidos.length) {
    throw new Error('Dias da semana inválidos: ' + invalidos.join(', ') + '.');
  }

  return [...new Set(convertidos)];
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
 * CACHE DE CATÁLOGOS
 * ============================================================ */

function sgdComCacheJson(chave, segundos, construtor) {
  const cache = CacheService.getScriptCache();

  try {
    const salvo = cache.get(chave);
    if (salvo) return JSON.parse(salvo);
  } catch (erro) {
    console.warn('Cache ignorado (' + chave + '): ' + (erro.message || erro));
  }

  const dados = construtor();

  try {
    const serializado = JSON.stringify(dados);
    // O CacheService possui limite por item. Se exceder, apenas seguimos sem cache.
    if (serializado.length < 90000) cache.put(chave, serializado, segundos || 300);
  } catch (erro) {
    console.warn('Não foi possível gravar cache (' + chave + '): ' + (erro.message || erro));
  }

  return dados;
}

function sgdLimparCacheCatalogos() {
  const cache = CacheService.getScriptCache();
  [
    'SGD_SALAS',
    'SGD_SOFTWARES',
    'SGD_SALAS_SOFTWARES',
    'SGD_CATEGORIAS_EXTRA',
    'MC_AREAS',
    'MC_UCS',
    'MC_VINCULOS',
    'MC_MOTIVOS'
  ].forEach(function (chave) {
    try { cache.remove(chave); } catch (erro) {}
  });
}

/* ============================================================
 * SALAS
 * ============================================================ */

function listarSalas() {
  return sgdComCacheJson('SGD_SALAS', 600, function () {
    const aba = obterAba(CONFIG.ABA_SALAS);
    const cabecalhos = validarCabecalhos(aba, CABECALHOS.SALAS);
    const ultimaLinha = aba.getLastRow();
    if (ultimaLinha < 2) return [];

    return aba.getRange(2, 1, ultimaLinha - 1, cabecalhos.length).getValues()
      .filter(function (linha) { return normalizarTexto(linha[0]) !== ''; })
      .map(function (linha) {
        const sala = {};
        cabecalhos.forEach(function (cabecalho, indice) { sala[cabecalho] = linha[indice]; });
        return sala;
      });
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
  return sgdComCacheJson('SGD_SOFTWARES', 600, function () {
    const aba = obterAba(CONFIG.ABA_SOFTWARES);
    const cabecalhos = validarCabecalhos(aba, CABECALHOS.SOFTWARES);
    const ultimaLinha = aba.getLastRow();
    if (ultimaLinha < 2) return [];

    return aba.getRange(2, 1, ultimaLinha - 1, cabecalhos.length).getValues()
      .filter(function (linha) { return normalizarTexto(linha[0]) !== ''; })
      .map(function (linha) {
        const item = {};
        cabecalhos.forEach(function (cabecalho, indice) { item[cabecalho] = linha[indice]; });
        return item;
      });
  });
}

function listarSoftwaresAtivos() {
  return listarSoftwares().filter(
    software => normalizarTexto(software.status).toUpperCase() === CONFIG.STATUS_SOFTWARE_ATIVO
  );
}

function listarVinculosSalasSoftwares() {
  return sgdComCacheJson('SGD_SALAS_SOFTWARES', 600, function () {
    const aba = obterAba(CONFIG.ABA_SALAS_SOFTWARES);
    const cabecalhos = validarCabecalhos(aba, CABECALHOS.SALAS_SOFTWARES);
    const ultimaLinha = aba.getLastRow();
    if (ultimaLinha < 2) return [];

    return aba.getRange(2, 1, ultimaLinha - 1, cabecalhos.length).getValues()
      .filter(function (linha) {
        return normalizarTexto(linha[0]) !== '' && normalizarTexto(linha[1]) !== '';
      })
      .map(function (linha) {
        const item = {};
        cabecalhos.forEach(function (cabecalho, indice) { item[cabecalho] = linha[indice]; });
        return item;
      });
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

    const funcionario = obterFuncionarioValidado(
      dados.funcionario_id,
      dados.matricula
    );

    const dadosValidados = Object.assign({}, dados, {
      responsavel: funcionario.nome,
      email_responsavel: funcionario.email
    });

    const agendamento = validarAgendamento(dadosValidados);
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
      funcionario.nome,
      funcionario.email,
      agendamento.softwares.join(','),
      agendamento.observacao,
      CONFIG.STATUS_CONFIRMADO,
      agora,
      agora
    ]);

    SpreadsheetApp.flush();

    const sala = obterSalaPorId(agendamento.sala_id);
    const nomesSoftwares = listarSoftwaresAtivos()
      .filter(item => agendamento.softwares.includes(normalizarTexto(item.id).toUpperCase()))
      .map(item => normalizarTexto(item.nome));
    const dias = agendamento.dias_semana.join(', ');

    const texto = [
      'Olá, ' + funcionario.nome + '.',
      '',
      'Seu agendamento foi confirmado.',
      'Laboratório: ' + (sala ? normalizarTexto(sala.nome) : agendamento.sala_id),
      'Período: ' + agendamento.data_inicio + ' a ' + agendamento.data_fim,
      'Dias: ' + dias,
      'Horário: ' + agendamento.hora_inicio + ' - ' + agendamento.hora_fim,
      'Softwares: ' + (nomesSoftwares.length ? nomesSoftwares.join(', ') : 'Nenhum informado'),
      'Código: ' + id
    ].join('\n');

    const email = enviarEmailSgd(
      funcionario.email,
      'Confirmação de agendamento - ' + id,
      texto,
      '<p>Olá, <strong>' + escaparHtml(funcionario.nome) + '</strong>.</p>' +
      '<p>Seu agendamento foi confirmado.</p>' +
      '<ul>' +
      '<li><strong>Laboratório:</strong> ' + escaparHtml(sala ? sala.nome : agendamento.sala_id) + '</li>' +
      '<li><strong>Período:</strong> ' + escaparHtml(agendamento.data_inicio) + ' a ' + escaparHtml(agendamento.data_fim) + '</li>' +
      '<li><strong>Dias:</strong> ' + escaparHtml(dias) + '</li>' +
      '<li><strong>Horário:</strong> ' + escaparHtml(agendamento.hora_inicio) + ' - ' + escaparHtml(agendamento.hora_fim) + '</li>' +
      '<li><strong>Softwares:</strong> ' + escaparHtml(nomesSoftwares.length ? nomesSoftwares.join(', ') : 'Nenhum informado') + '</li>' +
      '<li><strong>Código:</strong> ' + escaparHtml(id) + '</li>' +
      '</ul>'
    );

    return {
      sucesso: true,
      mensagem: 'Agendamento recorrente realizado com sucesso.',
      id: id,
      ocorrencias: agendamento.ocorrencias,
      email_enviado: email.enviado
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
    const indice = {};
    cabecalhos.forEach((nome, i) => indice[nome] = i);
    const ultimaLinha = aba.getLastRow();
    if (ultimaLinha < 2) throw new Error('Nenhum agendamento encontrado.');

    const linhas = aba.getRange(2, 1, ultimaLinha - 1, cabecalhos.length).getValues();
    const posicao = linhas.findIndex(linha => normalizarTexto(linha[indice.id]).toUpperCase() === id.toUpperCase());
    if (posicao === -1) throw new Error('Agendamento não encontrado.');

    const registro = linhas[posicao];
    const statusAtual = normalizarTexto(registro[indice.status]).toUpperCase();
    if (statusAtual === CONFIG.STATUS_CANCELADO) {
      return { sucesso: false, mensagem: 'Este agendamento já está cancelado.' };
    }

    const linhaPlanilha = posicao + 2;
    aba.getRange(linhaPlanilha, indice.status + 1).setValue(CONFIG.STATUS_CANCELADO);
    aba.getRange(linhaPlanilha, indice.atualizado_em + 1).setValue(new Date());
    SpreadsheetApp.flush();

    const salaId = normalizarTexto(registro[indice.sala_id]);
    const sala = obterSalaPorId(salaId);
    const responsavel = normalizarTexto(registro[indice.responsavel]);
    const emailResponsavel = normalizarTexto(registro[indice.email_responsavel]);
    const dataInicio = normalizarData(registro[indice.data_inicio]);
    const dataFim = normalizarData(registro[indice.data_fim]);
    const horaInicio = normalizarHora(registro[indice.hora_inicio]);
    const horaFim = normalizarHora(registro[indice.hora_fim]);

    const texto = [
      'Olá, ' + (responsavel || 'responsável') + '.',
      '',
      'O agendamento ' + id + ' foi cancelado pelo usuário Master.',
      'Laboratório: ' + (sala ? normalizarTexto(sala.nome) : salaId),
      'Período: ' + dataInicio + ' a ' + dataFim,
      'Horário: ' + horaInicio + ' - ' + horaFim
    ].join('\n');

    const email = enviarEmailSgd(
      emailResponsavel,
      'Agendamento cancelado - ' + id,
      texto,
      '<p>Olá, <strong>' + escaparHtml(responsavel || 'responsável') + '</strong>.</p>' +
      '<p>O agendamento <strong>' + escaparHtml(id) + '</strong> foi cancelado pelo usuário Master.</p>' +
      '<ul><li><strong>Laboratório:</strong> ' + escaparHtml(sala ? sala.nome : salaId) + '</li>' +
      '<li><strong>Período:</strong> ' + escaparHtml(dataInicio) + ' a ' + escaparHtml(dataFim) + '</li>' +
      '<li><strong>Horário:</strong> ' + escaparHtml(horaInicio) + ' - ' + escaparHtml(horaFim) + '</li></ul>'
    );

    return {
      sucesso: true,
      mensagem: 'O agendamento recorrente foi cancelado com sucesso.',
      email_enviado: email.enviado
    };
  } finally {
    if (obtido) lock.releaseLock();
  }
}

/* ============================================================
 * RESPOSTAS DA API
 * ============================================================ */

/**
 * Converte qualquer objeto simples em resposta JSON do Web App.
 */
function respostaJson(dados) {
  const payload =
    dados === undefined
      ? { sucesso: true }
      : dados;

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Padroniza erros da API e evita que uma exceção derrube a resposta HTTP.
 */
function respostaErro(erro) {
  const mensagem =
    erro && erro.message
      ? erro.message
      : String(erro || 'Erro interno não identificado.');

  const detalhe =
    erro && erro.stack
      ? String(erro.stack)
      : '';

  console.error(detalhe || mensagem);

  return respostaJson({
    sucesso: false,
    mensagem: mensagem
  });
}

/* ============================================================
 * API
 * ============================================================ */

function doGet(e) {
  try {
    const parametros = e && e.parameter ? e.parameter : {};
    const acao = normalizarTexto(parametros.acao).toLowerCase();

    switch (acao) {
      /* =========================
       * MAPA DE COMPETÊNCIAS
       * ========================= */
      case 'mapa-dados-iniciais':
        return respostaJson(
          obterDadosIniciaisMapaCompetencias()
        );

      case 'mapa-formulario':
        return respostaJson({
          sucesso: false,
          mensagem: 'Esta rota foi descontinuada. Use a validação segura do funcionário por POST.'
        });

      /* =========================
       * AGENDA DE SALAS
       * ========================= */
      case 'salas':
        return respostaJson({
          sucesso: true,
          dados: listarSalasAtivas()
        });

      case 'softwares':
        return respostaJson({
          sucesso: true,
          dados: listarSoftwaresAtivos()
        });

      case 'softwaresporsala':
        return respostaJson({
          sucesso: true,
          dados: listarSoftwaresPorSala(
            parametros.sala_id || ''
          )
        });

      case 'agendamentos':
        return respostaJson({
          sucesso: true,
          dados: listarAgendamentosPublicos()
        });

      /* =========================
       * FUNCIONÁRIOS / EXTRACLASSE
       * ========================= */
      case 'funcionarios-publicos':
      case 'funcionarios-extraclasse':
        return respostaJson({
          sucesso: true,
          dados: listarFuncionariosPublicos()
        });

      case 'categorias-extraclasse':
        return respostaJson({
          sucesso: true,
          dados: listarCategoriasExtraclasse()
        });

      /* =========================
       * API
       * ========================= */
      default:
        return respostaJson({
          sucesso: true,
          mensagem: 'API Agenda de Salas - SGD funcionando',
          versao:
            typeof CONFIG.API_VERSION !== 'undefined'
              ? CONFIG.API_VERSION
              : 'SGD',
          periodoMaximoDias:
            typeof CONFIG.PERIODO_MAX_DIAS !== 'undefined'
              ? CONFIG.PERIODO_MAX_DIAS
              : null
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
      /* =========================
       * MAPA DE COMPETÊNCIAS
       * ========================= */
      case 'mapa-validar-funcionario':
        return respostaJson(
          obterDadosFuncionarioMapaSeguro(dados)
        );

      case 'salvarMapaCompetencias':
        return respostaJson(
          salvarMapaCompetencias(dados)
        );

      case 'consultarRelatorioCompetencias':
        return respostaJson(
          consultarRelatorioCompetencias(
            dados.token,
            dados.filtros || {}
          )
        );

      case 'obterFiltrosRelatorioCompetencias':
        return respostaJson(
          obterFiltrosRelatorioCompetencias(
            dados.token
          )
        );

      case 'consultarHistoricoCompetencias':
        return respostaJson(
          consultarHistoricoCompetencias(
            dados.token,
            dados.filtros || {}
          )
        );

      /* =========================
       * FUNCIONÁRIOS
       * ========================= */
      case 'validarFuncionario':
        return respostaJson(
          validarFuncionarioPrivado(
            dados.funcionario_id,
            dados.matricula
          )
        );

      /* =========================
       * AGENDA DE SALAS
       * ========================= */
      case 'criarAgendamento':
        return respostaJson(
          criarAgendamento(dados)
        );

      case 'cancelarAgendamento':
        return respostaJson(
          cancelarAgendamento(
            dados.id,
            dados.token
          )
        );

      case 'listarAgendamentosMaster':
        return respostaJson(
          listarAgendamentosMaster(
            dados.token
          )
        );

      /* =========================
       * MASTER
       * ========================= */
      case 'loginMaster':
        return respostaJson(
          autenticarMaster(
            dados.usuario,
            dados.senha
          )
        );

      case 'validarSessaoMaster':
        return respostaJson(
          verificarSessaoMaster(
            dados.token
          )
        );

      case 'logoutMaster':
        return respostaJson(
          logoutMaster(
            dados.token
          )
        );

      /* =========================
       * EXTRACLASSE
       * ========================= */
      case 'registrarAtividadeExtraclasse':
        return respostaJson(
          registrarAtividadeExtraclasse(dados)
        );

      case 'listarRelatorioExtraclasse':
        return respostaJson(
          listarRelatorioExtraclasse(
            dados.filtros || dados,
            dados.token
          )
        );

      default:
        return respostaJson({
          sucesso: false,
          mensagem: 'Ação inválida.'
        });
    }
  } catch (erro) {
    return respostaErro(erro);
  }
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

function diagnosticarModuloExtraclasse() {
  const planilha = obterPlanilha();

  const resultado = {
    planilha: planilha.getName(),
    funcionarios: null,
    categorias: null,
    atividades: null
  };

  [
    ['funcionarios', CONFIG.ABA_FUNCIONARIOS, CABECALHOS.FUNCIONARIOS],
    ['categorias', CONFIG.ABA_CATEGORIAS_EXTRACLASSE, CABECALHOS.CATEGORIAS_EXTRACLASSE],
    ['atividades', CONFIG.ABA_ATIVIDADES_EXTRACLASSE, CABECALHOS.ATIVIDADES_EXTRACLASSE]
  ].forEach(([chave, nomeAba, esperados]) => {
    const aba = planilha.getSheetByName(nomeAba);

    if (!aba) {
      resultado[chave] = { existe: false };
      return;
    }

    let cabecalhosOk = true;
    let erroCabecalho = '';

    try {
      validarCabecalhos(aba, esperados);
    } catch (erro) {
      cabecalhosOk = false;
      erroCabecalho = erro.message || String(erro);
    }

    resultado[chave] = {
      existe: true,
      linhasComCabecalho: aba.getLastRow(),
      cabecalhosOk: cabecalhosOk,
      erroCabecalho: erroCabecalho
    };
  });

  try {
    resultado.funcionarios.listados = listarFuncionariosExtraclasse();
  } catch (erro) {
    resultado.funcionarios.erroLeitura = erro.message || String(erro);
  }

  try {
    resultado.categorias.listadas = listarCategoriasExtraclasse();
  } catch (erro) {
    resultado.categorias.erroLeitura = erro.message || String(erro);
  }

  console.log(JSON.stringify(resultado, null, 2));
  return resultado;
}

function testarFuncionariosExtraclasse() {
  const dados = listarFuncionariosExtraclasse();
  console.log(JSON.stringify(dados, null, 2));
  return dados;
}

/* ============================================================
 * MÓDULO EXTRACLASSE
 * ============================================================ */

function configurarModuloExtraclasse() {

  migrarCadastroFuncionarios();
  const planilha = obterPlanilha();

  function criarAbaSeNecessario(nome, cabecalhos) {

    let aba = planilha.getSheetByName(nome);

    if (!aba) {
      aba = planilha.insertSheet(nome);
    }

    if (aba.getLastRow() === 0) {

      aba
        .getRange(
          1,
          1,
          1,
          cabecalhos.length
        )
        .setValues([cabecalhos]);

      aba
        .getRange(
          1,
          1,
          1,
          cabecalhos.length
        )
        .setFontWeight("bold");

      aba.setFrozenRows(1);
    }

    return aba;
  }


  const abaFuncionarios =
    criarAbaSeNecessario(
      CONFIG.ABA_FUNCIONARIOS,
      CABECALHOS.FUNCIONARIOS
    );


  const abaCategorias =
    criarAbaSeNecessario(
      CONFIG.ABA_CATEGORIAS_EXTRACLASSE,
      CABECALHOS.CATEGORIAS_EXTRACLASSE
    );


  const abaAtividades =
    criarAbaSeNecessario(
      CONFIG.ABA_ATIVIDADES_EXTRACLASSE,
      CABECALHOS.ATIVIDADES_EXTRACLASSE
    );

  validarCabecalhos(abaFuncionarios, CABECALHOS.FUNCIONARIOS);
  validarCabecalhos(abaCategorias, CABECALHOS.CATEGORIAS_EXTRACLASSE);
  validarCabecalhos(abaAtividades, CABECALHOS.ATIVIDADES_EXTRACLASSE);


  /*
   * Insere categorias iniciais somente
   * se ainda não existirem registros.
   */

  if (abaCategorias.getLastRow() < 2) {

    const categorias = [
      ['CAT-001', 'Planejamento de aulas', 'ATIVO'],
      ['CAT-002', 'Elaboração de material didático', 'ATIVO'],
      ['CAT-003', 'Reunião pedagógica', 'ATIVO'],
      ['CAT-004', 'Capacitação / treinamento', 'ATIVO'],
      ['CAT-005', 'Atendimento ao aluno', 'ATIVO'],
      ['CAT-006', 'Participação em evento', 'ATIVO'],
      ['CAT-007', 'Visita técnica', 'ATIVO'],
      ['CAT-008', 'Projeto institucional', 'ATIVO'],
      ['CAT-009', 'Outros', 'ATIVO']
    ];

    abaCategorias
      .getRange(
        2,
        1,
        categorias.length,
        3
      )
      .setValues(categorias);
  }


  SpreadsheetApp.flush();
  sgdLimparCacheCatalogos();

  return {
    sucesso: true,
    mensagem:
      "Módulo de atividades extraclasse configurado com sucesso."
  };
}

function listarFuncionariosExtraclasse() {
  const aba = obterAba(CONFIG.ABA_FUNCIONARIOS);
  const cabecalhos = validarCabecalhos(aba, CABECALHOS.FUNCIONARIOS);
  const ultimaLinha = aba.getLastRow();

  if (ultimaLinha < 2) return [];

  const indiceMatricula = cabecalhos.indexOf('matricula');
  const indiceNome = cabecalhos.indexOf('nome');
  const indiceStatus = cabecalhos.indexOf('status');

  return aba
    .getRange(2, 1, ultimaLinha - 1, cabecalhos.length)
    .getValues()
    .map(linha => ({
      matricula: normalizarTexto(linha[indiceMatricula]),
      nome: normalizarTexto(linha[indiceNome]),
      status: normalizarTexto(linha[indiceStatus]).toUpperCase()
    }))
    .filter(item => {
      // Matrícula e nome são obrigatórios.
      if (!item.matricula || !item.nome) return false;

      // Para facilitar o cadastro inicial, status vazio é tratado como ATIVO.
      // Apenas INATIVO (ou outro status diferente de ATIVO) é excluído.
      return !item.status || item.status === CONFIG.STATUS_ATIVO;
    })
    .map(item => ({
      matricula: item.matricula,
      nome: item.nome
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function listarCategoriasExtraclasse() {
  return sgdComCacheJson('SGD_CATEGORIAS_EXTRA', 600, function () {
    const aba = obterAba(CONFIG.ABA_CATEGORIAS_EXTRACLASSE);
    const cabecalhos = validarCabecalhos(
      aba,
      CABECALHOS.CATEGORIAS_EXTRACLASSE
    );

    const ultimaLinha = aba.getLastRow();
    if (ultimaLinha < 2) return [];

    const indiceId = cabecalhos.indexOf('id');
    const indiceCategoria = cabecalhos.indexOf('categoria');
    const indiceStatus = cabecalhos.indexOf('status');

    return aba
      .getRange(2, 1, ultimaLinha - 1, cabecalhos.length)
      .getValues()
      .map(function (linha) {
        return {
          id: normalizarTexto(linha[indiceId]),
          categoria: normalizarTexto(linha[indiceCategoria]),
          status: indiceStatus >= 0
            ? normalizarTexto(linha[indiceStatus]).toUpperCase()
            : ''
        };
      })
      .filter(function (item) {
        if (!item.id || !item.categoria) return false;
        return !item.status || item.status === CONFIG.STATUS_ATIVO;
      })
      .map(function (item) {
        return { id: item.id, categoria: item.categoria };
      })
      .sort(function (a, b) {
        return a.categoria.localeCompare(b.categoria, 'pt-BR');
      });
  });
}

function calcularDatasExtraclasse(dataInicio, dataFim, diasSemana) {
  const inicio = normalizarData(dataInicio);
  const fim = normalizarData(dataFim);

  if (!dataValida(inicio)) throw new Error('Data inicial inválida.');
  if (!dataValida(fim)) throw new Error('Data final inválida.');
  if (inicio > fim) throw new Error('A data inicial não pode ser posterior à data final.');

  const dias = normalizarDiasSemana(diasSemana);
  if (!dias.length) throw new Error('Selecione pelo menos um dia de realização.');

  return gerarDatasOcorrencias(inicio, fim, dias);
}

function validarAtividadeExtraclasse(dados) {

  if (
    !dados ||
    typeof dados !== "object"
  ) {
    throw new Error(
      "Dados da atividade não informados."
    );
  }


  const funcionarioValidado = obterFuncionarioValidado(
    dados.funcionario_id,
    dados.matricula
  );

  const atividade = {

    nome: funcionarioValidado.nome,

    matricula: funcionarioValidado.matricula,

    email: funcionarioValidado.email,

    data_inicio:
      normalizarData(
        dados.data_inicio
      ),

    data_fim:
      normalizarData(
        dados.data_fim
      ),

    dias_semana:
      normalizarDiasSemana(
        dados.dias_semana
      ),

    categoria:
      normalizarTexto(
        dados.categoria
      ),

    carga_horaria_diaria:
      Number(
        dados.carga_horaria_diaria
      ),

    descricao:
      normalizarTexto(
        dados.descricao
      )

  };


  if (!atividade.nome) {
    throw new Error(
      "Informe o funcionário."
    );
  }


  if (!atividade.matricula) {
    throw new Error(
      "Informe a matrícula."
    );
  }


  if (
    !dataValida(
      atividade.data_inicio
    )
  ) {
    throw new Error(
      "Informe uma data inicial válida."
    );
  }


  if (
    !dataValida(
      atividade.data_fim
    )
  ) {
    throw new Error(
      "Informe uma data final válida."
    );
  }


  if (
    atividade.data_inicio >
    atividade.data_fim
  ) {
    throw new Error(
      "A data inicial não pode ser posterior à data final."
    );
  }


  const hoje = obterDataHoje();

  if (atividade.data_inicio > hoje || atividade.data_fim > hoje) {
    throw new Error(
      "Atividades extraclasse realizadas não podem possuir datas futuras."
    );
  }


  if (
    !atividade.dias_semana.length
  ) {
    throw new Error(
      "Selecione os dias de realização da atividade."
    );
  }


  if (!atividade.categoria) {
    throw new Error(
      "Selecione a categoria da atividade."
    );
  }


  if (
    !Number.isFinite(
      atividade.carga_horaria_diaria
    ) ||
    atividade.carga_horaria_diaria <= 0 ||
    atividade.carga_horaria_diaria > 24
  ) {
    throw new Error(
      "Informe uma carga horária diária válida."
    );
  }


  if (!atividade.descricao) {
    throw new Error(
      "Informe a descrição da atividade."
    );
  }


  /*
   * Confere Nome + Matrícula.
   */

  const funcionario =
    listarFuncionariosExtraclasse()
      .find(item =>
        item.matricula ===
        atividade.matricula
      );


  if (!funcionario) {
    throw new Error(
      "Matrícula não encontrada ou funcionário inativo."
    );
  }


  if (
    funcionario.nome !==
    atividade.nome
  ) {
    throw new Error(
      "O nome informado não corresponde à matrícula selecionada."
    );
  }


  const categorias =
    listarCategoriasExtraclasse();


  const categoriaExiste =
    categorias.some(
      item =>
        item.categoria ===
        atividade.categoria
    );


  if (!categoriaExiste) {
    throw new Error(
      "Categoria de atividade inválida."
    );
  }


  const datas =
    calcularDatasExtraclasse(
      atividade.data_inicio,
      atividade.data_fim,
      atividade.dias_semana
    );


  if (!datas.length) {
    throw new Error(
      "Nenhuma data de realização foi encontrada no período informado."
    );
  }


  atividade.datas_realizadas =
    datas;

  atividade.qtd_dias =
    datas.length;

  atividade.carga_horaria_total =
    Number(
      (
        atividade.qtd_dias *
        atividade.carga_horaria_diaria
      ).toFixed(2)
    );


  return atividade;
}

function atividadeExtraclasseDuplicada(atividade) {
  const aba = obterAba(CONFIG.ABA_ATIVIDADES_EXTRACLASSE);
  const cabecalhos = validarCabecalhos(aba, CABECALHOS.ATIVIDADES_EXTRACLASSE);
  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return false;

  const indice = {};
  cabecalhos.forEach((nome, i) => indice[nome] = i);

  const diasNovos = normalizarDiasSemana(atividade.dias_semana).sort().join(',');
  const descricaoNova = normalizarTexto(atividade.descricao).toLowerCase();

  return aba.getRange(2, 1, ultimaLinha - 1, cabecalhos.length).getValues().some(linha => {
    const diasExistentes = normalizarDiasSemana(linha[indice.dias_semana]).sort().join(',');
    const descricaoExistente = normalizarTexto(linha[indice.descricao]).toLowerCase();

    return normalizarTexto(linha[indice.matricula]) === atividade.matricula &&
      normalizarData(linha[indice.data_inicio]) === atividade.data_inicio &&
      normalizarData(linha[indice.data_fim]) === atividade.data_fim &&
      diasExistentes === diasNovos &&
      normalizarTexto(linha[indice.categoria]) === atividade.categoria &&
      Number(linha[indice.carga_horaria_diaria]) === Number(atividade.carga_horaria_diaria) &&
      descricaoExistente === descricaoNova;
  });
}

function registrarAtividadeExtraclasse(dados) {

  const lock =
    LockService.getScriptLock();

  let lockObtido = false;


  try {

    lock.waitLock(
      CONFIG.LOCK_TIMEOUT_MS
    );

    lockObtido = true;


    const atividade =
      validarAtividadeExtraclasse(
        dados
      );


    if (atividadeExtraclasseDuplicada(atividade)) {
      return {
        sucesso: false,
        mensagem: "Esta atividade extraclasse já foi registrada com os mesmos dados."
      };
    }


    const id =
      "EXT-" +
      Utilities
        .getUuid()
        .split("-")[0]
        .toUpperCase();


    const agora =
      new Date();


    obterAba(
      CONFIG.ABA_ATIVIDADES_EXTRACLASSE
    )
      .appendRow([

        id,

        atividade.nome,

        atividade.matricula,

        atividade.data_inicio,

        atividade.data_fim,

        atividade.dias_semana
          .join(","),

        atividade.datas_realizadas
          .join(","),

        atividade.categoria,

        atividade.carga_horaria_diaria,

        atividade.qtd_dias,

        atividade.carga_horaria_total,

        atividade.descricao,

        agora

      ]);


    SpreadsheetApp.flush();

    const textoEmail = [
      'Olá, ' + atividade.nome + '.',
      '',
      'Sua atividade extraclasse foi registrada com sucesso.',
      'Categoria: ' + atividade.categoria,
      'Período: ' + atividade.data_inicio + ' a ' + atividade.data_fim,
      'Dias realizados: ' + atividade.qtd_dias,
      'Carga diária: ' + atividade.carga_horaria_diaria + 'h',
      'Carga total: ' + atividade.carga_horaria_total + 'h',
      'Código: ' + id
    ].join('\n');

    const emailResultado = enviarEmailSgd(
      atividade.email,
      'Confirmação de atividade extraclasse - ' + id,
      textoEmail,
      '<p>Olá, <strong>' + escaparHtml(atividade.nome) + '</strong>.</p>' +
      '<p>Sua atividade extraclasse foi registrada com sucesso.</p>' +
      '<ul><li><strong>Categoria:</strong> ' + escaparHtml(atividade.categoria) + '</li>' +
      '<li><strong>Período:</strong> ' + escaparHtml(atividade.data_inicio) + ' a ' + escaparHtml(atividade.data_fim) + '</li>' +
      '<li><strong>Dias realizados:</strong> ' + atividade.qtd_dias + '</li>' +
      '<li><strong>Carga diária:</strong> ' + atividade.carga_horaria_diaria + 'h</li>' +
      '<li><strong>Carga total:</strong> ' + atividade.carga_horaria_total + 'h</li>' +
      '<li><strong>Código:</strong> ' + escaparHtml(id) + '</li></ul>'
    );


    return {

      sucesso: true,

      mensagem:
        "Atividade extraclasse registrada com sucesso.",

      id: id,

      email_enviado: emailResultado.enviado,

      calculo: {

        quantidadeDias:
          atividade.qtd_dias,

        cargaHorariaDiaria:
          atividade.carga_horaria_diaria,

        cargaHorariaTotal:
          atividade.carga_horaria_total,

        datasRealizadas:
          atividade.datas_realizadas

      }

    };


  } finally {

    if (lockObtido) {
      lock.releaseLock();
    }

  }

}

function listarRelatorioExtraclasse(
  filtros,
  token
) {

  if (
    !validarTokenMaster(token)
  ) {

    return {
      sucesso: false,
      mensagem:
        "Acesso permitido somente ao usuário master."
    };

  }


  filtros =
    filtros || {};


  const nome =
    normalizarTexto(
      filtros.nome
    );


  const categoria =
    normalizarTexto(
      filtros.categoria
    );


  const dataInicio =
    filtros.data_inicio
      ? normalizarData(
          filtros.data_inicio
        )
      : "";


  const dataFim =
    filtros.data_fim
      ? normalizarData(
          filtros.data_fim
        )
      : "";


  if (dataInicio && !dataValida(dataInicio)) {
    throw new Error("Data inicial do filtro inválida.");
  }

  if (dataFim && !dataValida(dataFim)) {
    throw new Error("Data final do filtro inválida.");
  }

  if (dataInicio && dataFim && dataInicio > dataFim) {
    throw new Error("No relatório, a data inicial não pode ser posterior à data final.");
  }


  const aba =
    obterAba(
      CONFIG.ABA_ATIVIDADES_EXTRACLASSE
    );


  const cabecalhos =
    validarCabecalhos(
      aba,
      CABECALHOS.ATIVIDADES_EXTRACLASSE
    );


  const ultimaLinha =
    aba.getLastRow();


  if (ultimaLinha < 2) {

    return {
      sucesso: true,
      dados: [],
      resumo: {
        quantidadeAtividades: 0,
        quantidadeDias: 0,
        cargaHorariaTotal: 0
      }
    };

  }


  const linhas =
    aba
      .getRange(
        2,
        1,
        ultimaLinha - 1,
        cabecalhos.length
      )
      .getValues();


  const atividades = [];


  linhas.forEach(linha => {

    const item = {};


    cabecalhos.forEach(
      (cabecalho, indice) => {

        let valor =
          linha[indice];


        if (
          cabecalho ===
            "data_inicio" ||
          cabecalho ===
            "data_fim"
        ) {

          valor =
            normalizarData(
              valor
            );

        }


        item[cabecalho] =
          valor;

      }
    );


    if (
      nome &&
      normalizarTexto(
        item.nome
      ) !== nome
    ) {
      return;
    }


    if (
      categoria &&
      normalizarTexto(
        item.categoria
      ) !== categoria
    ) {
      return;
    }


    const datas =
      normalizarTexto(
        item.datas_realizadas
      )
        .split(",")
        .map(item =>
          item.trim()
        )
        .filter(Boolean);


    const datasFiltradas =
      datas.filter(data => {

        if (
          dataInicio &&
          data < dataInicio
        ) {
          return false;
        }


        if (
          dataFim &&
          data > dataFim
        ) {
          return false;
        }


        return true;

      });


    if (
      (
        dataInicio ||
        dataFim
      ) &&
      !datasFiltradas.length
    ) {
      return;
    }


    const cargaDiaria =
      Number(
        item.carga_horaria_diaria
      ) || 0;


    item.datas_periodo =
      datasFiltradas;

    item.qtd_dias_periodo =
      datasFiltradas.length;

    item.carga_horaria_periodo =
      Number(
        (
          datasFiltradas.length *
          cargaDiaria
        ).toFixed(2)
      );


    atividades.push(
      item
    );

  });


  const quantidadeDias =
    atividades.reduce(
      (total, item) =>
        total +
        item.qtd_dias_periodo,
      0
    );


  const cargaHorariaTotal =
    atividades.reduce(
      (total, item) =>
        total +
        item.carga_horaria_periodo,
      0
    );


  return {

    sucesso: true,

    dados:
      atividades,

    resumo: {

      quantidadeAtividades:
        atividades.length,

      quantidadeDias:
        quantidadeDias,

      cargaHorariaTotal:
        Number(
          cargaHorariaTotal
            .toFixed(2)
        )

    }

  };

}

/* ============================================================
 * TESTES DO MÓDULO EXTRACLASSE
 * ============================================================ */

function testarCalculoExtraclasse() {
  const datas = calcularDatasExtraclasse(
    '2026-09-14',
    '2026-09-30',
    ['quarta', 'quinta']
  );

  const resultado = {
    datas: datas,
    quantidadeDias: datas.length,
    cargaDiaria: 4,
    cargaTotal: datas.length * 4
  };

  console.log(JSON.stringify(resultado, null, 2));
  return resultado;
}

function testarEstruturaSistema() {
  const planilha = obterPlanilha();
  const verificacoes = [
    [CONFIG.ABA_SALAS, CABECALHOS.SALAS],
    [CONFIG.ABA_AGENDAMENTOS, CABECALHOS.AGENDAMENTOS],
    [CONFIG.ABA_SOFTWARES, CABECALHOS.SOFTWARES],
    [CONFIG.ABA_SALAS_SOFTWARES, CABECALHOS.SALAS_SOFTWARES],
    [CONFIG.ABA_FUNCIONARIOS, CABECALHOS.FUNCIONARIOS],
    [CONFIG.ABA_CATEGORIAS_EXTRACLASSE, CABECALHOS.CATEGORIAS_EXTRACLASSE],
    [CONFIG.ABA_ATIVIDADES_EXTRACLASSE, CABECALHOS.ATIVIDADES_EXTRACLASSE]
  ];

  if (typeof MC_CONFIG !== 'undefined' && typeof MC_CABECALHOS !== 'undefined') {
    verificacoes.push(
      [MC_CONFIG.ABA_AREAS, MC_CABECALHOS.AREAS],
      [MC_CONFIG.ABA_UNIDADES_CURRICULARES, MC_CABECALHOS.UNIDADES_CURRICULARES],
      [MC_CONFIG.ABA_AREAS_UCS, MC_CABECALHOS.AREAS_UCS],
      [MC_CONFIG.ABA_COMPETENCIAS, MC_CABECALHOS.COMPETENCIAS],
      [MC_CONFIG.ABA_HISTORICO, MC_CABECALHOS.HISTORICO],
      [MC_CONFIG.ABA_MOTIVOS, MC_CABECALHOS.MOTIVOS]
    );
  }

  const resultado = verificacoes.map(([nome, cabecalhos]) => {
    const aba = planilha.getSheetByName(nome);
    if (!aba) return { aba: nome, ok: false, mensagem: 'Aba não encontrada.' };

    try {
      validarCabecalhos(aba, cabecalhos);
      return { aba: nome, ok: true };
    } catch (erro) {
      return { aba: nome, ok: false, mensagem: erro.message };
    }
  });

  console.log(JSON.stringify(resultado, null, 2));
  return resultado;
}
