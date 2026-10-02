/**
 * ============================================================
 * MAPA DE COMPETÊNCIAS - SGD
 * Google Apps Script + Google Sheets
 * Versão 1.3 - múltiplos cursos + privacidade + e-mail
 * ============================================================
 *
 * Este arquivo deve SUBSTITUIR integralmente o arquivo
 * MapaCompetencias.gs criado na etapa anterior.
 *
 * O módulo:
 * - reutiliza a aba FUNCIONARIOS;
 * - cria/valida as abas do Mapa de Competências;
 * - lista funcionários ativos;
 * - lista áreas e UCs;
 * - carrega respostas anteriores;
 * - salva competências sem duplicidade;
 * - registra histórico de criação e alteração;
 * - exige motivo em alterações posteriores;
 * - disponibiliza relatório do gestor com filtros;
 * - disponibiliza histórico para o gestor Master.
 *
 * IMPORTANTE:
 * Este arquivo NÃO possui doGet/doPost para não conflitar com
 * a API já existente. A integração das rotas será feita na
 * próxima etapa.
 * ============================================================
 */

const MC_CONFIG = Object.freeze({
  ABA_FUNCIONARIOS: 'FUNCIONARIOS',
  ABA_AREAS: 'AREAS_COMPETENCIA',
  ABA_UNIDADES_CURRICULARES: 'UNIDADES_CURRICULARES',
  ABA_AREAS_UCS: 'AREAS_UCS',
  ABA_COMPETENCIAS: 'COMPETENCIAS',
  ABA_HISTORICO: 'HISTORICO_COMPETENCIAS',
  ABA_MOTIVOS: 'MOTIVOS_ALTERACAO_COMPETENCIA',
  ABA_FUNCIONARIOS_CURSOS: 'FUNCIONARIOS_CURSOS',

  STATUS_ATIVO: 'ATIVO',
  STATUS_APTO: 'APTO',
  STATUS_PARCIAL: 'PARCIALMENTE_APTO',
  STATUS_INAPTO: 'INAPTO',

  LOCK_TIMEOUT_MS: 10000
});

const MC_CABECALHOS = Object.freeze({
  FUNCIONARIOS: [
    'id',
    'matricula',
    'nome',
    'email',
    'status'
  ],

  AREAS: [
    'id',
    'area',
    'status'
  ],

  UNIDADES_CURRICULARES: [
    'id',
    'codigo',
    'unidade_curricular',
    'status'
  ],

  AREAS_UCS: [
    'id',
    'area_id',
    'uc_id',
    'status'
  ],

  COMPETENCIAS: [
    'id',
    'matricula',
    'funcionario',
    'uc_id',
    'unidade_curricular',
    'status_competencia',
    'primeiro_preenchimento',
    'ultima_atualizacao'
  ],

  HISTORICO: [
    'id',
    'competencia_id',
    'matricula',
    'funcionario',
    'uc_id',
    'unidade_curricular',
    'status_anterior',
    'status_novo',
    'motivo',
    'justificativa',
    'data_hora'
  ],

  MOTIVOS: [
    'id',
    'motivo',
    'exige_justificativa',
    'status'
  ],

  FUNCIONARIOS_CURSOS: [
    'id',
    'matricula',
    'funcionario',
    'area_id',
    'area',
    'atualizado_em'
  ]
});

/* ============================================================
 * CONFIGURAÇÃO INICIAL
 * ============================================================ */

function configurarModuloMapaCompetencias() {
  if (typeof migrarCadastroFuncionarios === 'function') migrarCadastroFuncionarios();
  const planilha = mcObterPlanilha();

  const abaFuncionarios = planilha.getSheetByName(MC_CONFIG.ABA_FUNCIONARIOS);
  if (!abaFuncionarios) {
    throw new Error(
      'A aba FUNCIONARIOS não foi encontrada. Configure primeiro o cadastro de funcionários.'
    );
  }

  mcValidarCabecalhos(abaFuncionarios, MC_CABECALHOS.FUNCIONARIOS);

  const abaAreas = mcCriarAba(
    planilha,
    MC_CONFIG.ABA_AREAS,
    MC_CABECALHOS.AREAS
  );

  const abaUCs = mcCriarAba(
    planilha,
    MC_CONFIG.ABA_UNIDADES_CURRICULARES,
    MC_CABECALHOS.UNIDADES_CURRICULARES
  );

  const abaAreasUCs = mcCriarAba(
    planilha,
    MC_CONFIG.ABA_AREAS_UCS,
    MC_CABECALHOS.AREAS_UCS
  );

  const abaCompetencias = mcCriarAba(
    planilha,
    MC_CONFIG.ABA_COMPETENCIAS,
    MC_CABECALHOS.COMPETENCIAS
  );

  const abaHistorico = mcCriarAba(
    planilha,
    MC_CONFIG.ABA_HISTORICO,
    MC_CABECALHOS.HISTORICO
  );

  const abaMotivos = mcCriarAba(
    planilha,
    MC_CONFIG.ABA_MOTIVOS,
    MC_CABECALHOS.MOTIVOS
  );

  const abaFuncionariosCursos = mcCriarAba(
    planilha,
    MC_CONFIG.ABA_FUNCIONARIOS_CURSOS,
    MC_CABECALHOS.FUNCIONARIOS_CURSOS
  );

  mcInserirMotivosPadrao(abaMotivos);

  mcFormatarAba(abaAreas, MC_CABECALHOS.AREAS.length);
  mcFormatarAba(abaUCs, MC_CABECALHOS.UNIDADES_CURRICULARES.length);
  mcFormatarAba(abaAreasUCs, MC_CABECALHOS.AREAS_UCS.length);
  mcFormatarAba(abaCompetencias, MC_CABECALHOS.COMPETENCIAS.length);
  mcFormatarAba(abaHistorico, MC_CABECALHOS.HISTORICO.length);
  mcFormatarAba(abaMotivos, MC_CABECALHOS.MOTIVOS.length);
  mcFormatarAba(abaFuncionariosCursos, MC_CABECALHOS.FUNCIONARIOS_CURSOS.length);

  mcConfigurarValidacoes(
    abaAreas,
    abaUCs,
    abaAreasUCs,
    abaCompetencias,
    abaMotivos
  );

  SpreadsheetApp.flush();
  mcLimparCacheCatalogos();

  return {
    sucesso: true,
    mensagem: 'Módulo Mapa de Competências configurado com sucesso.',
    abas: [
      MC_CONFIG.ABA_AREAS,
      MC_CONFIG.ABA_UNIDADES_CURRICULARES,
      MC_CONFIG.ABA_AREAS_UCS,
      MC_CONFIG.ABA_COMPETENCIAS,
      MC_CONFIG.ABA_HISTORICO,
      MC_CONFIG.ABA_MOTIVOS,
      MC_CONFIG.ABA_FUNCIONARIOS_CURSOS
    ]
  };
}

/* ============================================================
 * PLANILHA E LEITURA GENÉRICA
 * ============================================================ */

function mcObterPlanilha() {
  const id = PropertiesService
    .getScriptProperties()
    .getProperty('PLANILHA_ID');

  if (id) {
    return SpreadsheetApp.openById(id);
  }

  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  if (!planilha) {
    throw new Error('Planilha não configurada. Execute configurarProjeto().');
  }

  return planilha;
}

function mcObterAba(nome) {
  const aba = mcObterPlanilha().getSheetByName(nome);

  if (!aba) {
    throw new Error('A aba "' + nome + '" não foi encontrada.');
  }

  return aba;
}

function mcCriarAba(planilha, nome, cabecalhos) {
  let aba = planilha.getSheetByName(nome);

  if (!aba) {
    aba = planilha.insertSheet(nome);
  }

  if (aba.getLastRow() === 0) {
    aba
      .getRange(1, 1, 1, cabecalhos.length)
      .setValues([cabecalhos]);
  } else {
    mcValidarCabecalhos(aba, cabecalhos);
  }

  return aba;
}

function mcValidarCabecalhos(aba, esperados) {
  const ultimaColuna = aba.getLastColumn();

  if (!ultimaColuna) {
    throw new Error('A aba "' + aba.getName() + '" está vazia.');
  }

  const encontrados = aba
    .getRange(1, 1, 1, ultimaColuna)
    .getValues()[0]
    .map(mcNormalizarTexto);

  const faltantes = esperados.filter(function (item) {
    return !encontrados.includes(item);
  });

  if (faltantes.length) {
    throw new Error(
      'A aba "' +
        aba.getName() +
        '" possui colunas ausentes: ' +
        faltantes.join(', ')
    );
  }

  return encontrados;
}

function mcLerObjetos(nomeAba, cabecalhosEsperados) {
  const aba = mcObterAba(nomeAba);
  const cabecalhos = mcValidarCabecalhos(aba, cabecalhosEsperados);
  const ultimaLinha = aba.getLastRow();

  if (ultimaLinha < 2) {
    return [];
  }

  const dados = aba
    .getRange(2, 1, ultimaLinha - 1, cabecalhos.length)
    .getValues();

  const fuso =
    mcObterPlanilha().getSpreadsheetTimeZone() ||
    Session.getScriptTimeZone();

  return dados
    .filter(function (linha) {
      return linha.some(function (valor) {
        return mcNormalizarTexto(valor) !== '';
      });
    })
    .map(function (linha, indice) {
      const item = {
        _linha: indice + 2
      };

      cabecalhos.forEach(function (cabecalho, coluna) {
        let valor = linha[coluna];

        if (valor instanceof Date) {
          valor = Utilities.formatDate(
            valor,
            fuso,
            "yyyy-MM-dd'T'HH:mm:ss"
          );
        }

        item[cabecalho] = valor;
      });

      return item;
    });
}

/* ============================================================
 * FORMATAÇÃO E VALIDAÇÕES
 * ============================================================ */

function mcFormatarAba(aba, quantidadeColunas) {
  aba.setFrozenRows(1);

  aba
    .getRange(1, 1, 1, quantidadeColunas)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  aba.autoResizeColumns(1, quantidadeColunas);
}

function mcInserirMotivosPadrao(aba) {
  if (aba.getLastRow() >= 2) {
    return;
  }

  const motivos = [
    ['MOT-001', 'Capacitação ou treinamento concluído', 'NAO', 'ATIVO'],
    ['MOT-002', 'Experiência prática adquirida', 'NAO', 'ATIVO'],
    ['MOT-003', 'Atualização profissional', 'NAO', 'ATIVO'],
    ['MOT-004', 'Revisão da autoavaliação', 'SIM', 'ATIVO'],
    ['MOT-005', 'Mudança no conteúdo da unidade curricular', 'SIM', 'ATIVO'],
    ['MOT-006', 'Outro motivo', 'SIM', 'ATIVO']
  ];

  aba
    .getRange(2, 1, motivos.length, MC_CABECALHOS.MOTIVOS.length)
    .setValues(motivos);
}

function mcConfigurarValidacoes(
  abaAreas,
  abaUCs,
  abaAreasUCs,
  abaCompetencias,
  abaMotivos
) {
  const regraStatusAtivo = SpreadsheetApp
    .newDataValidation()
    .requireValueInList(['ATIVO', 'INATIVO'], true)
    .setAllowInvalid(false)
    .build();

  const regraCompetencia = SpreadsheetApp
    .newDataValidation()
    .requireValueInList(
      [
        MC_CONFIG.STATUS_APTO,
        MC_CONFIG.STATUS_PARCIAL,
        MC_CONFIG.STATUS_INAPTO
      ],
      true
    )
    .setAllowInvalid(false)
    .build();

  const regraSimNao = SpreadsheetApp
    .newDataValidation()
    .requireValueInList(['SIM', 'NAO'], true)
    .setAllowInvalid(false)
    .build();

  abaAreas.getRange('C2:C').setDataValidation(regraStatusAtivo);
  abaUCs.getRange('D2:D').setDataValidation(regraStatusAtivo);
  abaAreasUCs.getRange('D2:D').setDataValidation(regraStatusAtivo);
  abaCompetencias.getRange('F2:F').setDataValidation(regraCompetencia);
  abaMotivos.getRange('C2:C').setDataValidation(regraSimNao);
  abaMotivos.getRange('D2:D').setDataValidation(regraStatusAtivo);
}

/* ============================================================
 * NORMALIZAÇÃO
 * ============================================================ */

function mcNormalizarTexto(valor) {
  if (valor === null || valor === undefined) {
    return '';
  }

  return String(valor).trim();
}

function mcNormalizarMaiusculo(valor) {
  return mcNormalizarTexto(valor).toUpperCase();
}

function mcRemoverAcentos(valor) {
  return mcNormalizarTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function mcNormalizarStatusCompetencia(valor) {
  const status = mcRemoverAcentos(valor)
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  const equivalencias = {
    APTO: MC_CONFIG.STATUS_APTO,
    PARCIAL: MC_CONFIG.STATUS_PARCIAL,
    PARCIALMENTE_APTO: MC_CONFIG.STATUS_PARCIAL,
    NAO_APTO: MC_CONFIG.STATUS_INAPTO,
    INAPTO: MC_CONFIG.STATUS_INAPTO
  };

  const normalizado = equivalencias[status] || status;

  const permitidos = [
    MC_CONFIG.STATUS_APTO,
    MC_CONFIG.STATUS_PARCIAL,
    MC_CONFIG.STATUS_INAPTO
  ];

  if (!permitidos.includes(normalizado)) {
    throw new Error('Status de competência inválido: "' + valor + '".');
  }

  return normalizado;
}

function mcFormatarDataHora(data) {
  const fuso =
    mcObterPlanilha().getSpreadsheetTimeZone() ||
    Session.getScriptTimeZone();

  return Utilities.formatDate(
    data,
    fuso,
    "yyyy-MM-dd'T'HH:mm:ss"
  );
}

function mcGerarId(prefixo) {
  return (
    prefixo +
    '-' +
    Utilities.getUuid().split('-')[0].toUpperCase()
  );
}

function mcCompararTexto(a, b) {
  return mcNormalizarTexto(a).localeCompare(
    mcNormalizarTexto(b),
    'pt-BR',
    { sensitivity: 'base' }
  );
}

function mcNormalizarLista(valor) {
  if (Array.isArray(valor)) {
    return valor
      .map(mcNormalizarTexto)
      .filter(Boolean);
  }

  return mcNormalizarTexto(valor)
    .split(',')
    .map(mcNormalizarTexto)
    .filter(Boolean);
}

/* ============================================================
 * FUNCIONÁRIOS
 * ============================================================ */

function listarFuncionariosMapaCompetencias() {
  return mcLerObjetos(
    MC_CONFIG.ABA_FUNCIONARIOS,
    MC_CABECALHOS.FUNCIONARIOS
  )
    .filter(function (item) {
      const status = mcNormalizarMaiusculo(item.status);

      return (
        mcNormalizarTexto(item.matricula) &&
        mcNormalizarTexto(item.nome) &&
        (!status || status === MC_CONFIG.STATUS_ATIVO)
      );
    })
    .map(function (item) {
      return {
        matricula: mcNormalizarTexto(item.matricula),
        nome: mcNormalizarTexto(item.nome)
      };
    })
    .sort(function (a, b) {
      return mcCompararTexto(a.nome, b.nome);
    });
}

function mcObterFuncionarioAtivo(matricula) {
  const procurada = mcNormalizarTexto(matricula);

  if (!procurada) {
    throw new Error('Informe a matrícula do funcionário.');
  }

  const funcionario = listarFuncionariosMapaCompetencias().find(function (item) {
    return item.matricula === procurada;
  });

  if (!funcionario) {
    throw new Error('Matrícula não encontrada ou funcionário inativo.');
  }

  return funcionario;
}

/* ============================================================
 * CACHE DO CATÁLOGO DE COMPETÊNCIAS
 * ============================================================ */

function mcComCache(chave, construtor) {
  if (typeof sgdComCacheJson === 'function') {
    return sgdComCacheJson(chave, 600, construtor);
  }
  return construtor();
}

function mcLimparCacheCatalogos() {
  if (typeof sgdLimparCacheCatalogos === 'function') {
    sgdLimparCacheCatalogos();
    return;
  }

  const cache = CacheService.getScriptCache();
  ['MC_AREAS', 'MC_UCS', 'MC_VINCULOS', 'MC_MOTIVOS'].forEach(function (chave) {
    try { cache.remove(chave); } catch (erro) {}
  });
}

/* ============================================================
 * ÁREAS, UCs E VÍNCULOS
 * ============================================================ */

function listarAreasCompetencia() {
  return mcComCache('MC_AREAS', function () {
    return mcLerObjetos(
      MC_CONFIG.ABA_AREAS,
      MC_CABECALHOS.AREAS
    )
      .filter(function (item) {
        return (
          mcNormalizarTexto(item.id) &&
          mcNormalizarTexto(item.area) &&
          mcNormalizarMaiusculo(item.status) === MC_CONFIG.STATUS_ATIVO
        );
      })
      .map(function (item) {
        return {
          id: mcNormalizarTexto(item.id),
          area: mcNormalizarTexto(item.area)
        };
      })
      .sort(function (a, b) {
        return mcCompararTexto(a.area, b.area);
      });
  });
}

function listarUnidadesCurricularesCompetencia() {
  return mcComCache('MC_UCS', function () {
    return mcLerObjetos(
      MC_CONFIG.ABA_UNIDADES_CURRICULARES,
      MC_CABECALHOS.UNIDADES_CURRICULARES
    )
      .filter(function (item) {
        return (
          mcNormalizarTexto(item.id) &&
          mcNormalizarTexto(item.unidade_curricular) &&
          mcNormalizarMaiusculo(item.status) === MC_CONFIG.STATUS_ATIVO
        );
      })
      .map(function (item) {
        return {
          id: mcNormalizarTexto(item.id),
          codigo: mcNormalizarTexto(item.codigo),
          unidade_curricular: mcNormalizarTexto(item.unidade_curricular)
        };
      })
      .sort(function (a, b) {
        return mcCompararTexto(a.unidade_curricular, b.unidade_curricular);
      });
  });
}

function listarVinculosAreasUcsCompetencia() {
  return mcComCache('MC_VINCULOS', function () {
    return mcLerObjetos(
      MC_CONFIG.ABA_AREAS_UCS,
      MC_CABECALHOS.AREAS_UCS
    )
      .filter(function (item) {
        return (
          mcNormalizarTexto(item.area_id) &&
          mcNormalizarTexto(item.uc_id) &&
          mcNormalizarMaiusculo(item.status) === MC_CONFIG.STATUS_ATIVO
        );
      })
      .map(function (item) {
        return {
          id: mcNormalizarTexto(item.id),
          area_id: mcNormalizarTexto(item.area_id),
          uc_id: mcNormalizarTexto(item.uc_id)
        };
      });
  });
}

function listarUnidadesCurricularesPorArea(areaId) {
  const area = mcNormalizarTexto(areaId);

  if (!area) {
    return [];
  }

  const areaExiste = listarAreasCompetencia().some(function (item) {
    return item.id === area;
  });

  if (!areaExiste) {
    throw new Error('Área de atuação inválida ou inativa.');
  }

  const ids = new Set(
    listarVinculosAreasUcsCompetencia()
      .filter(function (vinculo) {
        return vinculo.area_id === area;
      })
      .map(function (vinculo) {
        return vinculo.uc_id;
      })
  );

  return listarUnidadesCurricularesCompetencia().filter(function (uc) {
    return ids.has(uc.id);
  });
}

function listarMotivosAlteracaoCompetencia() {
  return mcComCache('MC_MOTIVOS', function () {
    return mcLerObjetos(
      MC_CONFIG.ABA_MOTIVOS,
      MC_CABECALHOS.MOTIVOS
    )
      .filter(function (item) {
        return (
          mcNormalizarTexto(item.id) &&
          mcNormalizarTexto(item.motivo) &&
          mcNormalizarMaiusculo(item.status) === MC_CONFIG.STATUS_ATIVO
        );
      })
      .map(function (item) {
        return {
          id: mcNormalizarTexto(item.id),
          motivo: mcNormalizarTexto(item.motivo),
          exige_justificativa:
            mcNormalizarMaiusculo(item.exige_justificativa) === 'SIM'
        };
      });
  });
}

/* ============================================================
 * DADOS INICIAIS DO FRONTEND
 * ============================================================ */

function obterDadosIniciaisMapaCompetencias() {
  return {
    sucesso: true,
    funcionarios: listarFuncionariosPublicos(),
    areas: listarAreasCompetencia(),
    unidades_curriculares: listarUnidadesCurricularesCompetencia(),
    vinculos: listarVinculosAreasUcsCompetencia().map(function (item) {
      return { area_id: item.area_id, uc_id: item.uc_id };
    }),
    motivos: listarMotivosAlteracaoCompetencia(),
    status: [
      { id: MC_CONFIG.STATUS_APTO, rotulo: 'Apto' },
      { id: MC_CONFIG.STATUS_PARCIAL, rotulo: 'Parcialmente apto' },
      { id: MC_CONFIG.STATUS_INAPTO, rotulo: 'Não apto' }
    ]
  };
}

function mcListarCursosFuncionarios() {
  return mcLerObjetos(
    MC_CONFIG.ABA_FUNCIONARIOS_CURSOS,
    MC_CABECALHOS.FUNCIONARIOS_CURSOS
  ).filter(function (item) {
    return mcNormalizarTexto(item.matricula) && mcNormalizarTexto(item.area_id);
  }).map(function (item) {
    return {
      _linha: item._linha,
      id: mcNormalizarTexto(item.id),
      matricula: mcNormalizarTexto(item.matricula),
      funcionario: mcNormalizarTexto(item.funcionario),
      area_id: mcNormalizarTexto(item.area_id),
      area: mcNormalizarTexto(item.area),
      atualizado_em: mcNormalizarTexto(item.atualizado_em)
    };
  });
}

function mcSincronizarCursosFuncionario(funcionario, areaIds) {
  const aba = mcObterAba(MC_CONFIG.ABA_FUNCIONARIOS_CURSOS);
  const cabecalhos = mcValidarCabecalhos(
    aba,
    MC_CABECALHOS.FUNCIONARIOS_CURSOS
  );

  const ultimaLinha = aba.getLastRow();
  const existentes = ultimaLinha >= 2
    ? aba.getRange(2, 1, ultimaLinha - 1, cabecalhos.length).getValues()
    : [];

  const indiceMatricula = cabecalhos.indexOf('matricula');
  const preservadas = existentes.filter(function (linha) {
    return mcNormalizarTexto(linha[indiceMatricula]) !== funcionario.matricula;
  });

  const areasPorId = {};
  listarAreasCompetencia().forEach(function (area) {
    areasPorId[area.id] = area.area;
  });

  const agora = new Date();
  const novas = areaIds.map(function (areaId) {
    return [
      mcGerarId('FC'),
      funcionario.matricula,
      funcionario.nome,
      areaId,
      areasPorId[areaId] || areaId,
      agora
    ];
  });

  const todas = preservadas.concat(novas);

  if (ultimaLinha >= 2) {
    aba.getRange(2, 1, ultimaLinha - 1, cabecalhos.length).clearContent();
  }

  if (todas.length) {
    aba.getRange(2, 1, todas.length, cabecalhos.length).setValues(todas);
  }
}

function obterDadosFuncionarioMapaSeguro(dados) {
  const funcionario = obterFuncionarioValidado(dados.funcionario_id, dados.matricula);
  const areasSelecionadas = mcListarCursosFuncionarios()
    .filter(function (item) { return item.matricula === funcionario.matricula; })
    .map(function (item) { return item.area_id; });

  const competencias = mcListarCompetenciasAtuais()
    .filter(function (item) { return item.matricula === funcionario.matricula; })
    .map(function (item) {
      return {
        uc_id: item.uc_id,
        unidade_curricular: item.unidade_curricular,
        status_competencia: item.status_competencia,
        primeiro_preenchimento: item.primeiro_preenchimento,
        ultima_atualizacao: item.ultima_atualizacao
      };
    });

  return {
    sucesso: true,
    funcionario: { id: funcionario.id, nome: funcionario.nome, email: funcionario.email },
    areas_selecionadas: areasSelecionadas,
    competencias_atuais: competencias
  };
}

/* ============================================================
 * COMPETÊNCIAS ATUAIS
 * ============================================================ */

function mcListarCompetenciasAtuais() {
  return mcLerObjetos(
    MC_CONFIG.ABA_COMPETENCIAS,
    MC_CABECALHOS.COMPETENCIAS
  )
    .filter(function (item) {
      return (
        mcNormalizarTexto(item.id) &&
        mcNormalizarTexto(item.matricula) &&
        mcNormalizarTexto(item.uc_id)
      );
    })
    .map(function (item) {
      return {
        _linha: item._linha,
        id: mcNormalizarTexto(item.id),
        matricula: mcNormalizarTexto(item.matricula),
        funcionario: mcNormalizarTexto(item.funcionario),
        uc_id: mcNormalizarTexto(item.uc_id),
        unidade_curricular: mcNormalizarTexto(item.unidade_curricular),
        status_competencia: mcNormalizarTexto(item.status_competencia),
        primeiro_preenchimento: mcNormalizarTexto(item.primeiro_preenchimento),
        ultima_atualizacao: mcNormalizarTexto(item.ultima_atualizacao)
      };
    });
}

function obterFormularioMapaCompetencias(matricula, areaId) {
  const funcionario = mcObterFuncionarioAtivo(matricula);
  const area = mcNormalizarTexto(areaId);

  if (!area) {
    throw new Error('Selecione a área de atuação.');
  }

  const areas = listarAreasCompetencia();
  const areaSelecionada = areas.find(function (item) {
    return item.id === area;
  });

  if (!areaSelecionada) {
    throw new Error('Área de atuação inválida ou inativa.');
  }

  const ucs = listarUnidadesCurricularesPorArea(area);
  const atuais = mcListarCompetenciasAtuais();

  const porUc = {};

  atuais
    .filter(function (item) {
      return item.matricula === funcionario.matricula;
    })
    .forEach(function (item) {
      porUc[item.uc_id] = item;
    });

  const competencias = ucs.map(function (uc) {
    const atual = porUc[uc.id] || null;

    return {
      uc_id: uc.id,
      codigo: uc.codigo,
      unidade_curricular: uc.unidade_curricular,
      status_competencia: atual ? atual.status_competencia : '',
      respondida: Boolean(atual),
      primeira_resposta: atual ? atual.primeiro_preenchimento : '',
      ultima_atualizacao: atual ? atual.ultima_atualizacao : ''
    };
  });

  return {
    sucesso: true,
    funcionario: funcionario,
    area: areaSelecionada,
    competencias: competencias,
    total: competencias.length,
    respondidas: competencias.filter(function (item) {
      return item.respondida;
    }).length
  };
}

/* ============================================================
 * VALIDAÇÃO DE ALTERAÇÃO
 * ============================================================ */

function mcResolverMotivoAlteracao(item, dadosGerais) {
  const motivoInformado = mcNormalizarTexto(
    item.motivo || item.motivo_id || dadosGerais.motivo || dadosGerais.motivo_id
  );

  const justificativa = mcNormalizarTexto(
    item.justificativa || dadosGerais.justificativa
  );

  if (!motivoInformado) {
    throw new Error(
      'Informe o motivo da alteração da unidade curricular "' +
        item.unidade_curricular +
        '".'
    );
  }

  const motivos = listarMotivosAlteracaoCompetencia();

  const motivo = motivos.find(function (opcao) {
    return (
      opcao.id === motivoInformado ||
      mcNormalizarMaiusculo(opcao.motivo) === mcNormalizarMaiusculo(motivoInformado)
    );
  });

  if (!motivo) {
    throw new Error('Motivo de alteração inválido ou inativo.');
  }

  if (motivo.exige_justificativa && !justificativa) {
    throw new Error(
      'A justificativa é obrigatória para o motivo "' +
        motivo.motivo +
        '".'
    );
  }

  return {
    motivo: motivo.motivo,
    justificativa: justificativa
  };
}

function mcValidarEnvioMapaCompetencias(dados) {
  if (!dados || typeof dados !== 'object') {
    throw new Error('Dados do Mapa de Competências não informados.');
  }

  const funcionario = obterFuncionarioValidado(dados.funcionario_id, dados.matricula);
  const areaIds = Array.isArray(dados.area_ids)
    ? dados.area_ids.map(mcNormalizarTexto).filter(Boolean)
    : [];

  if (!areaIds.length) {
    throw new Error('Selecione pelo menos um curso.');
  }

  const areasAtivas = listarAreasCompetencia();
  const idsAreasAtivas = new Set(areasAtivas.map(function (area) { return area.id; }));
  areaIds.forEach(function (id) {
    if (!idsAreasAtivas.has(id)) throw new Error('Curso inválido ou inativo: ' + id + '.');
  });

  const idsUcs = new Set(
    listarVinculosAreasUcsCompetencia()
      .filter(function (vinculo) { return areaIds.includes(vinculo.area_id); })
      .map(function (vinculo) { return vinculo.uc_id; })
  );
  const ucsSelecionadas = listarUnidadesCurricularesCompetencia()
    .filter(function (uc) { return idsUcs.has(uc.id); });

  if (!ucsSelecionadas.length) {
    throw new Error('Os cursos selecionados não possuem unidades curriculares ativas.');
  }

  const recebidas = Array.isArray(dados.competencias) ? dados.competencias : [];
  const recebidasPorUc = {};
  recebidas.forEach(function (item) {
    const ucId = mcNormalizarTexto(item.uc_id || item.ucId);
    if (!ucId || !idsUcs.has(ucId)) throw new Error('Unidade curricular inválida para os cursos selecionados.');
    if (recebidasPorUc[ucId]) throw new Error('A unidade curricular ' + ucId + ' foi enviada mais de uma vez.');
    recebidasPorUc[ucId] = item;
  });

  const faltantes = ucsSelecionadas.filter(function (uc) { return !recebidasPorUc[uc.id]; });
  if (faltantes.length) {
    throw new Error('Classifique todas as unidades curriculares. Pendentes: ' + faltantes.map(function (uc) { return uc.unidade_curricular; }).join(', ') + '.');
  }

  return {
    funcionario: funcionario,
    area_ids: [...new Set(areaIds)],
    competencias: ucsSelecionadas.map(function (uc) {
      const recebida = recebidasPorUc[uc.id];
      return {
        uc_id: uc.id,
        codigo: uc.codigo,
        unidade_curricular: uc.unidade_curricular,
        status_competencia: mcNormalizarStatusCompetencia(recebida.status_competencia || recebida.status),
        motivo: mcNormalizarTexto(recebida.motivo || recebida.motivo_id),
        justificativa: mcNormalizarTexto(recebida.justificativa)
      };
    }),
    motivo: mcNormalizarTexto(dados.motivo || dados.motivo_id),
    justificativa: mcNormalizarTexto(dados.justificativa)
  };
}

/* ============================================================
 * SALVAMENTO DO MAPA
 * ============================================================ */

function salvarMapaCompetencias(dados) {
  const lock = LockService.getScriptLock();
  let lockObtido = false;

  try {
    lock.waitLock(MC_CONFIG.LOCK_TIMEOUT_MS);
    lockObtido = true;

    const envio = mcValidarEnvioMapaCompetencias(dados);
    const abaCompetencias = mcObterAba(MC_CONFIG.ABA_COMPETENCIAS);
    const abaHistorico = mcObterAba(MC_CONFIG.ABA_HISTORICO);

    const atuais = mcListarCompetenciasAtuais();
    const porChave = {};

    atuais.forEach(function (item) {
      const chave = item.matricula + '|' + item.uc_id;

      if (porChave[chave]) {
        throw new Error(
          'Foram encontrados registros duplicados na aba COMPETENCIAS para a matrícula ' +
            item.matricula +
            ' e UC ' +
            item.uc_id +
            '. Corrija a duplicidade antes de continuar.'
        );
      }

      porChave[chave] = item;
    });

    const agora = new Date();
    const novasLinhas = [];
    const alteracoesPlanilha = [];
    const historicos = [];

    let criadas = 0;
    let alteradas = 0;
    let mantidas = 0;

    envio.competencias.forEach(function (competencia) {
      const chave = envio.funcionario.matricula + '|' + competencia.uc_id;
      const existente = porChave[chave] || null;

      if (!existente) {
        const competenciaId = mcGerarId('COMP');

        novasLinhas.push([
          competenciaId,
          envio.funcionario.matricula,
          envio.funcionario.nome,
          competencia.uc_id,
          competencia.unidade_curricular,
          competencia.status_competencia,
          agora,
          agora
        ]);

        historicos.push([
          mcGerarId('HIST'),
          competenciaId,
          envio.funcionario.matricula,
          envio.funcionario.nome,
          competencia.uc_id,
          competencia.unidade_curricular,
          '',
          competencia.status_competencia,
          'Primeiro preenchimento',
          '',
          agora
        ]);

        criadas += 1;
        return;
      }

      const statusAnterior = mcNormalizarStatusCompetencia(
        existente.status_competencia
      );

      if (statusAnterior === competencia.status_competencia) {
        mantidas += 1;
        return;
      }

      const motivo = mcResolverMotivoAlteracao(competencia, envio);

      alteracoesPlanilha.push({
        linha: existente._linha,
        status: competencia.status_competencia,
        data: agora
      });

      historicos.push([
        mcGerarId('HIST'),
        existente.id,
        envio.funcionario.matricula,
        envio.funcionario.nome,
        competencia.uc_id,
        competencia.unidade_curricular,
        statusAnterior,
        competencia.status_competencia,
        motivo.motivo,
        motivo.justificativa,
        agora
      ]);

      alteradas += 1;
    });

    if (novasLinhas.length) {
      abaCompetencias
        .getRange(
          abaCompetencias.getLastRow() + 1,
          1,
          novasLinhas.length,
          MC_CABECALHOS.COMPETENCIAS.length
        )
        .setValues(novasLinhas);
    }

    if (alteracoesPlanilha.length) {
      const cabecalhos = mcValidarCabecalhos(
        abaCompetencias,
        MC_CABECALHOS.COMPETENCIAS
      );
      const ultimaLinhaCompetencias = abaCompetencias.getLastRow();
      const matriz = abaCompetencias
        .getRange(2, 1, ultimaLinhaCompetencias - 1, cabecalhos.length)
        .getValues();
      const indiceStatus = cabecalhos.indexOf('status_competencia');
      const indiceAtualizacao = cabecalhos.indexOf('ultima_atualizacao');

      alteracoesPlanilha.forEach(function (alteracao) {
        const indiceLinha = alteracao.linha - 2;
        if (indiceLinha >= 0 && indiceLinha < matriz.length) {
          matriz[indiceLinha][indiceStatus] = alteracao.status;
          matriz[indiceLinha][indiceAtualizacao] = alteracao.data;
        }
      });

      abaCompetencias
        .getRange(2, 1, matriz.length, cabecalhos.length)
        .setValues(matriz);
    }

    if (historicos.length) {
      abaHistorico
        .getRange(
          abaHistorico.getLastRow() + 1,
          1,
          historicos.length,
          MC_CABECALHOS.HISTORICO.length
        )
        .setValues(historicos);
    }

    mcSincronizarCursosFuncionario(envio.funcionario, envio.area_ids);
    SpreadsheetApp.flush();

    const areasPorId = {};
    listarAreasCompetencia().forEach(function (area) { areasPorId[area.id] = area.area; });
    const nomesCursos = envio.area_ids.map(function (id) { return areasPorId[id] || id; });
    const aptos = envio.competencias.filter(function (item) { return item.status_competencia === MC_CONFIG.STATUS_APTO; }).length;
    const parciais = envio.competencias.filter(function (item) { return item.status_competencia === MC_CONFIG.STATUS_PARCIAL; }).length;
    const inaptos = envio.competencias.filter(function (item) { return item.status_competencia === MC_CONFIG.STATUS_INAPTO; }).length;
    const textoEmail = [
      'Olá, ' + envio.funcionario.nome + '.',
      '',
      'Seu Mapa de Competências foi registrado/atualizado com sucesso.',
      'Cursos selecionados: ' + nomesCursos.join(', '),
      'Unidades curriculares avaliadas: ' + envio.competencias.length,
      'Apto: ' + aptos,
      'Parcialmente apto: ' + parciais,
      'Não apto: ' + inaptos
    ].join('\n');
    const emailResultado = enviarEmailSgd(
      envio.funcionario.email,
      'Confirmação do Mapa de Competências',
      textoEmail,
      '<p>Olá, <strong>' + escaparHtml(envio.funcionario.nome) + '</strong>.</p>' +
      '<p>Seu Mapa de Competências foi registrado/atualizado com sucesso.</p>' +
      '<p><strong>Cursos:</strong> ' + escaparHtml(nomesCursos.join(', ')) + '</p>' +
      '<ul><li>Unidades curriculares avaliadas: ' + envio.competencias.length + '</li>' +
      '<li>Apto: ' + aptos + '</li><li>Parcialmente apto: ' + parciais + '</li><li>Não apto: ' + inaptos + '</li></ul>'
    );

    return {
      sucesso: true,
      mensagem:
        alteradas > 0
          ? 'Mapa de Competências atualizado com sucesso.'
          : criadas > 0
            ? 'Mapa de Competências registrado com sucesso.'
            : 'Nenhuma alteração foi necessária.',
      email_enviado: emailResultado.enviado,
      resumo: {
        criadas: criadas,
        alteradas: alteradas,
        mantidas: mantidas,
        total: envio.competencias.length
      }
    };
  } finally {
    if (lockObtido) {
      lock.releaseLock();
    }
  }
}

/* ============================================================
 * RELATÓRIO DO GESTOR
 * ============================================================ */

function mcExigirMaster(token) {
  if (typeof validarTokenMaster !== 'function') {
    throw new Error(
      'A função validarTokenMaster() não foi encontrada no projeto.'
    );
  }

  if (!validarTokenMaster(token)) {
    throw new Error('Sessão Master inválida ou expirada.');
  }
}

function consultarRelatorioCompetencias(token, filtros) {
  mcExigirMaster(token);

  const criterios = filtros && typeof filtros === 'object'
    ? filtros
    : {};

  const matricula = mcNormalizarTexto(criterios.matricula);
  const nomeBusca = mcRemoverAcentos(criterios.funcionario || criterios.nome)
    .toLowerCase();
  const areaId = mcNormalizarTexto(criterios.area_id || criterios.areaId);
  const ucId = mcNormalizarTexto(criterios.uc_id || criterios.ucId);

  const statusFiltro = mcNormalizarLista(
    criterios.status || criterios.status_competencia || criterios.statuses
  ).map(function (item) {
    return mcNormalizarStatusCompetencia(item);
  });

  const statusPermitidos = new Set(statusFiltro);

  const areas = listarAreasCompetencia();
  const areasPorId = {};
  areas.forEach(function (area) { areasPorId[area.id] = area.area; });

  const vinculos = listarVinculosAreasUcsCompetencia();
  const areasPermitidasPorUc = {};
  vinculos.forEach(function (vinculo) {
    if (!areasPermitidasPorUc[vinculo.uc_id]) areasPermitidasPorUc[vinculo.uc_id] = new Set();
    areasPermitidasPorUc[vinculo.uc_id].add(vinculo.area_id);
  });

  const cursosPorMatricula = {};
  mcListarCursosFuncionarios().forEach(function (curso) {
    if (!cursosPorMatricula[curso.matricula]) cursosPorMatricula[curso.matricula] = [];
    cursosPorMatricula[curso.matricula].push(curso.area_id);
  });

  let resultados = mcListarCompetenciasAtuais().map(function (item) {
    const permitidas = areasPermitidasPorUc[item.uc_id] || new Set();
    const areasUc = (cursosPorMatricula[item.matricula] || [])
      .filter(function (id) { return permitidas.has(id); })
      .map(function (id) { return { id: id, area: areasPorId[id] || id }; });

    return {
      competencia_id: item.id,
      matricula: item.matricula,
      funcionario: item.funcionario,
      uc_id: item.uc_id,
      unidade_curricular: item.unidade_curricular,
      status_competencia: item.status_competencia,
      primeiro_preenchimento: item.primeiro_preenchimento,
      ultima_atualizacao: item.ultima_atualizacao,
      areas: areasUc
    };
  });

  if (matricula) {
    resultados = resultados.filter(function (item) {
      return item.matricula === matricula;
    });
  }

  if (nomeBusca) {
    resultados = resultados.filter(function (item) {
      return mcRemoverAcentos(item.funcionario)
        .toLowerCase()
        .includes(nomeBusca);
    });
  }

  if (areaId) {
    resultados = resultados.filter(function (item) {
      return item.areas.some(function (area) {
        return area.id === areaId;
      });
    });
  }

  if (ucId) {
    resultados = resultados.filter(function (item) {
      return item.uc_id === ucId;
    });
  }

  if (statusPermitidos.size) {
    resultados = resultados.filter(function (item) {
      return statusPermitidos.has(
        mcNormalizarStatusCompetencia(item.status_competencia)
      );
    });
  }

  resultados.sort(function (a, b) {
    const porNome = mcCompararTexto(a.funcionario, b.funcionario);
    if (porNome !== 0) {
      return porNome;
    }

    return mcCompararTexto(a.unidade_curricular, b.unidade_curricular);
  });

  const indicadores = {
    total_registros: resultados.length,
    funcionarios: new Set(
      resultados.map(function (item) {
        return item.matricula;
      })
    ).size,
    aptos: resultados.filter(function (item) {
      return item.status_competencia === MC_CONFIG.STATUS_APTO;
    }).length,
    parcialmente_aptos: resultados.filter(function (item) {
      return item.status_competencia === MC_CONFIG.STATUS_PARCIAL;
    }).length,
    inaptos: resultados.filter(function (item) {
      return item.status_competencia === MC_CONFIG.STATUS_INAPTO;
    }).length
  };

  return {
    sucesso: true,
    dados: resultados,
    indicadores: indicadores
  };
}

function obterFiltrosRelatorioCompetencias(token) {
  mcExigirMaster(token);

  return {
    sucesso: true,
    funcionarios: listarFuncionariosCompletos().map(function (item) { return { matricula: item.matricula, nome: item.nome }; }),
    areas: listarAreasCompetencia(),
    unidades_curriculares: listarUnidadesCurricularesCompetencia(),
    status: [
      {
        id: MC_CONFIG.STATUS_APTO,
        rotulo: 'Apto'
      },
      {
        id: MC_CONFIG.STATUS_PARCIAL,
        rotulo: 'Parcialmente apto'
      },
      {
        id: MC_CONFIG.STATUS_INAPTO,
        rotulo: 'Não apto'
      }
    ]
  };
}

/* ============================================================
 * HISTÓRICO DO GESTOR
 * ============================================================ */

function consultarHistoricoCompetencias(token, filtros) {
  mcExigirMaster(token);

  const criterios = filtros && typeof filtros === 'object'
    ? filtros
    : {};

  const matricula = mcNormalizarTexto(criterios.matricula);
  const ucId = mcNormalizarTexto(criterios.uc_id || criterios.ucId);
  const competenciaId = mcNormalizarTexto(
    criterios.competencia_id || criterios.competenciaId
  );

  let dados = mcLerObjetos(
    MC_CONFIG.ABA_HISTORICO,
    MC_CABECALHOS.HISTORICO
  )
    .filter(function (item) {
      return mcNormalizarTexto(item.id) !== '';
    })
    .map(function (item) {
      return {
        id: mcNormalizarTexto(item.id),
        competencia_id: mcNormalizarTexto(item.competencia_id),
        matricula: mcNormalizarTexto(item.matricula),
        funcionario: mcNormalizarTexto(item.funcionario),
        uc_id: mcNormalizarTexto(item.uc_id),
        unidade_curricular: mcNormalizarTexto(item.unidade_curricular),
        status_anterior: mcNormalizarTexto(item.status_anterior),
        status_novo: mcNormalizarTexto(item.status_novo),
        motivo: mcNormalizarTexto(item.motivo),
        justificativa: mcNormalizarTexto(item.justificativa),
        data_hora: mcNormalizarTexto(item.data_hora)
      };
    });

  if (matricula) {
    dados = dados.filter(function (item) {
      return item.matricula === matricula;
    });
  }

  if (ucId) {
    dados = dados.filter(function (item) {
      return item.uc_id === ucId;
    });
  }

  if (competenciaId) {
    dados = dados.filter(function (item) {
      return item.competencia_id === competenciaId;
    });
  }

  dados.sort(function (a, b) {
    return b.data_hora.localeCompare(a.data_hora);
  });

  return {
    sucesso: true,
    dados: dados,
    total: dados.length
  };
}



/* ============================================================
 * DIAGNÓSTICO DE INTEGRIDADE - NÃO ALTERA DADOS
 * ============================================================ */

function diagnosticarIntegridadeMapaCompetencias() {
  const areas = mcLerObjetos(
    MC_CONFIG.ABA_AREAS,
    MC_CABECALHOS.AREAS
  );

  const ucs = mcLerObjetos(
    MC_CONFIG.ABA_UNIDADES_CURRICULARES,
    MC_CABECALHOS.UNIDADES_CURRICULARES
  );

  const vinculos = mcLerObjetos(
    MC_CONFIG.ABA_AREAS_UCS,
    MC_CABECALHOS.AREAS_UCS
  );

  const competencias = mcListarCompetenciasAtuais();

  function chaveNome(valor) {
    return mcRemoverAcentos(valor)
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function encontrarDuplicados(lista, campoNome, campoId) {
    const mapa = {};

    lista.forEach(function (item) {
      const chave = chaveNome(item[campoNome]);
      if (!chave) return;

      if (!mapa[chave]) {
        mapa[chave] = [];
      }

      mapa[chave].push({
        id: mcNormalizarTexto(item[campoId]),
        nome: mcNormalizarTexto(item[campoNome]),
        linha: item._linha
      });
    });

    return Object.keys(mapa)
      .filter(function (chave) {
        return mapa[chave].length > 1;
      })
      .map(function (chave) {
        return {
          chave: chave,
          registros: mapa[chave]
        };
      });
  }

  const idsAreas = new Set(
    areas
      .map(function (item) {
        return mcNormalizarTexto(item.id);
      })
      .filter(Boolean)
  );

  const idsUcs = new Set(
    ucs
      .map(function (item) {
        return mcNormalizarTexto(item.id);
      })
      .filter(Boolean)
  );

  const vinculosOrfaos = vinculos
    .filter(function (item) {
      const areaId = mcNormalizarTexto(item.area_id);
      const ucId = mcNormalizarTexto(item.uc_id);

      return (
        !areaId ||
        !ucId ||
        !idsAreas.has(areaId) ||
        !idsUcs.has(ucId)
      );
    })
    .map(function (item) {
      return {
        linha: item._linha,
        id: mcNormalizarTexto(item.id),
        area_id: mcNormalizarTexto(item.area_id),
        uc_id: mcNormalizarTexto(item.uc_id)
      };
    });

  const competenciasPorChave = {};

  competencias.forEach(function (item) {
    const chave = item.matricula + '|' + item.uc_id;

    if (!competenciasPorChave[chave]) {
      competenciasPorChave[chave] = [];
    }

    competenciasPorChave[chave].push({
      id: item.id,
      linha: item._linha,
      funcionario: item.funcionario,
      unidade_curricular: item.unidade_curricular
    });
  });

  const competenciasDuplicadas = Object.keys(competenciasPorChave)
    .filter(function (chave) {
      return competenciasPorChave[chave].length > 1;
    })
    .map(function (chave) {
      return {
        chave: chave,
        registros: competenciasPorChave[chave]
      };
    });

  const resultado = {
    sucesso:
      vinculosOrfaos.length === 0 &&
      competenciasDuplicadas.length === 0,
    areasDuplicadasPorNome: encontrarDuplicados(
      areas,
      'area',
      'id'
    ),
    ucsDuplicadasPorNome: encontrarDuplicados(
      ucs,
      'unidade_curricular',
      'id'
    ),
    vinculosOrfaos: vinculosOrfaos,
    competenciasDuplicadas: competenciasDuplicadas
  };

  console.log(JSON.stringify(resultado, null, 2));
  return resultado;
}

/* ============================================================
 * TESTES - NÃO ALTERAM DADOS
 * ============================================================ */

function testarEstruturaMapaCompetencias() {
  const planilha = mcObterPlanilha();

  const abasEsperadas = [
    MC_CONFIG.ABA_FUNCIONARIOS,
    MC_CONFIG.ABA_AREAS,
    MC_CONFIG.ABA_UNIDADES_CURRICULARES,
    MC_CONFIG.ABA_AREAS_UCS,
    MC_CONFIG.ABA_COMPETENCIAS,
    MC_CONFIG.ABA_HISTORICO,
    MC_CONFIG.ABA_MOTIVOS,
    MC_CONFIG.ABA_FUNCIONARIOS_CURSOS
  ];

  const resultado = abasEsperadas.map(function (nome) {
    return {
      aba: nome,
      existe: Boolean(planilha.getSheetByName(nome))
    };
  });

  console.log(JSON.stringify(resultado, null, 2));
  return resultado;
}

function testarDadosIniciaisMapaCompetencias() {
  const dados = obterDadosIniciaisMapaCompetencias();
  console.log(JSON.stringify(dados, null, 2));
  return dados;
}

function testarCatalogosMapaCompetencias() {
  const dados = {
    funcionarios: listarFuncionariosCompletos().map(function (item) { return { matricula: item.matricula, nome: item.nome }; }),
    areas: listarAreasCompetencia(),
    ucs: listarUnidadesCurricularesCompetencia(),
    vinculos: listarVinculosAreasUcsCompetencia(),
    motivos: listarMotivosAlteracaoCompetencia()
  };

  console.log(JSON.stringify(dados, null, 2));
  return dados;
}
