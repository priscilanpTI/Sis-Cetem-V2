const API_URL =
  import.meta.env.VITE_APPS_SCRIPT_URL ||
  import.meta.env.VITE_API_URL;

const MASTER_TOKEN_KEY =
  'sgd_master_token';

if (!API_URL) {
  console.warn(
    'URL do Apps Script não configurada. ' +
      'Verifique VITE_APPS_SCRIPT_URL ou VITE_API_URL.'
  );
}

/* ============================================================
 * TIPOS — CADASTRO EXTRACLASSE
 * ============================================================ */

export interface FuncionarioExtraclasse {
  nome: string;
  matricula: string;
}

export interface CategoriaExtraclasse {
  id: string;
  categoria: string;
}

export interface RegistroExtraclasse {
  nome: string;
  matricula: string;
  data_inicio: string;
  data_fim: string;
  dias_semana: string[];
  categoria: string;
  carga_horaria_diaria: number;
  descricao: string;
}

export interface CalculoExtraclasse {
  quantidadeDias: number;
  cargaHorariaDiaria: number;
  cargaHorariaTotal: number;
  datasRealizadas: string[];
}

export interface ResultadoRegistroExtraclasse {
  sucesso: boolean;
  mensagem: string;
  id?: string;
  calculo?: CalculoExtraclasse;
}

/* ============================================================
 * TIPOS — MASTER
 * ============================================================ */

export interface ResultadoLoginMaster {
  sucesso: boolean;
  mensagem: string;
  token?: string;
  usuario?: string;
  validadeSegundos?: number;
}

export interface ResultadoSessaoMaster {
  sucesso: boolean;
  autenticado: boolean;
}

export interface ResultadoLogoutMaster {
  sucesso: boolean;
  mensagem: string;
}

/* ============================================================
 * TIPOS — RELATÓRIO
 * ============================================================ */

export interface FiltrosRelatorioExtraclasse {
  nome?: string;
  categoria?: string;
  data_inicio?: string;
  data_fim?: string;
}

export interface AtividadeRelatorioExtraclasse {
  id: string;
  nome: string;
  matricula: string;
  data_inicio: string;
  data_fim: string;
  dias_semana: string;
  datas_realizadas: string;
  categoria: string;
  carga_horaria_diaria: number;
  qtd_dias: number;
  carga_horaria_total: number;
  descricao: string;
  criado_em: string;

  datas_periodo: string[];
  qtd_dias_periodo: number;
  carga_horaria_periodo: number;
}

export interface ResumoRelatorioExtraclasse {
  quantidadeAtividades: number;
  quantidadeDias: number;
  cargaHorariaTotal: number;
}

export interface ResultadoRelatorioExtraclasse {
  sucesso: boolean;
  mensagem?: string;
  dados: AtividadeRelatorioExtraclasse[];
  resumo: ResumoRelatorioExtraclasse;
}

interface RespostaApi<T> {
  sucesso: boolean;
  mensagem?: string;
  dados?: T;
}

/* ============================================================
 * TOKEN MASTER
 * ============================================================ */

export function obterTokenMaster():
  string {
  return (
    sessionStorage.getItem(
      MASTER_TOKEN_KEY
    ) ?? ''
  );
}

export function salvarTokenMaster(
  token: string
): void {
  sessionStorage.setItem(
    MASTER_TOKEN_KEY,
    token
  );
}

export function removerTokenMaster():
  void {
  sessionStorage.removeItem(
    MASTER_TOKEN_KEY
  );
}

/* ============================================================
 * URL DA API
 * ============================================================ */

function obterApiUrl(): string {
  if (!API_URL) {
    throw new Error(
      'URL da API não configurada. Verifique o arquivo .env.'
    );
  }

  return String(API_URL).trim();
}

/* ============================================================
 * PROCESSAMENTO DA RESPOSTA
 * ============================================================ */

async function processarResposta<T>(
  resposta: Response
): Promise<T> {
  if (!resposta.ok) {
    throw new Error(
      `Erro ao acessar o servidor. HTTP ${resposta.status}.`
    );
  }

  const texto =
    await resposta.text();

  if (!texto.trim()) {
    throw new Error(
      'O servidor retornou uma resposta vazia.'
    );
  }

  try {
    return JSON.parse(texto) as T;
  } catch {
    console.error(
      'Resposta recebida do servidor:',
      texto
    );

    throw new Error(
      'O servidor retornou uma resposta inválida.'
    );
  }
}

/* ============================================================
 * GET
 * ============================================================ */

async function get<T>(
  acao: string
): Promise<T> {
  const urlBase =
    obterApiUrl();

  const separador =
    urlBase.includes('?')
      ? '&'
      : '?';

  const url =
    `${urlBase}${separador}` +
    `acao=${encodeURIComponent(acao)}` +
    `&_=${Date.now()}`;

  let resposta: Response;

  try {
    resposta =
      await fetch(
        url,
        {
          method: 'GET',
          cache: 'no-store',
        }
      );
  } catch {
    throw new Error(
      'Não foi possível conectar ao servidor.'
    );
  }

  return processarResposta<T>(
    resposta
  );
}

/* ============================================================
 * POST
 * ============================================================ */

async function post<T>(
  dados: unknown
): Promise<T> {
  const url =
    obterApiUrl();

  let resposta: Response;

  try {
    resposta =
      await fetch(
        url,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'text/plain;charset=utf-8',
          },

          body:
            JSON.stringify(
              dados
            ),
        }
      );
  } catch {
    throw new Error(
      'Não foi possível conectar ao servidor.'
    );
  }

  return processarResposta<T>(
    resposta
  );
}

/* ============================================================
 * FUNCIONÁRIOS
 * ============================================================ */

export async function listarFuncionariosExtraclasse():
  Promise<FuncionarioExtraclasse[]> {

  const resposta =
    await get<
      RespostaApi<
        FuncionarioExtraclasse[]
      >
    >(
      'funcionarios-extraclasse'
    );

  if (!resposta.sucesso) {
    throw new Error(
      resposta.mensagem ||
        'Não foi possível carregar os funcionários.'
    );
  }

  return (
    resposta.dados ?? []
  )
    .map(
      (funcionario) => ({
        nome:
          String(
            funcionario.nome ??
              ''
          ).trim(),

        matricula:
          String(
            funcionario.matricula ??
              ''
          ).trim(),
      })
    )
    .filter(
      (funcionario) =>
        funcionario.nome !== '' &&
        funcionario.matricula !== ''
    )
    .sort(
      (a, b) =>
        a.nome.localeCompare(
          b.nome,
          'pt-BR'
        )
    );
}

/* ============================================================
 * CATEGORIAS
 * ============================================================ */

export async function listarCategoriasExtraclasse():
  Promise<CategoriaExtraclasse[]> {

  const resposta =
    await get<
      RespostaApi<
        CategoriaExtraclasse[]
      >
    >(
      'categorias-extraclasse'
    );

  if (!resposta.sucesso) {
    throw new Error(
      resposta.mensagem ||
        'Não foi possível carregar as categorias.'
    );
  }

  return (
    resposta.dados ?? []
  )
    .map(
      (item) => ({
        id:
          String(
            item.id ??
              ''
          ).trim(),

        categoria:
          String(
            item.categoria ??
              ''
          ).trim(),
      })
    )
    .filter(
      (item) =>
        item.id !== '' &&
        item.categoria !== ''
    );
}

/* ============================================================
 * REGISTRO DA ATIVIDADE
 * ============================================================ */

export async function registrarAtividadeExtraclasse(
  dados: RegistroExtraclasse
): Promise<ResultadoRegistroExtraclasse> {

  const payload = {
    acao:
      'registrarAtividadeExtraclasse',

    nome:
      String(
        dados.nome
      ).trim(),

    matricula:
      String(
        dados.matricula
      ).trim(),

    data_inicio:
      dados.data_inicio,

    data_fim:
      dados.data_fim,

    dias_semana:
      dados.dias_semana,

    categoria:
      String(
        dados.categoria
      ).trim(),

    carga_horaria_diaria:
      Number(
        dados.carga_horaria_diaria
      ),

    descricao:
      String(
        dados.descricao
      ).trim(),
  };

  const resposta =
    await post<
      ResultadoRegistroExtraclasse
    >(
      payload
    );

  if (!resposta.sucesso) {
    return {
      sucesso: false,

      mensagem:
        resposta.mensagem ||
        'Não foi possível registrar a atividade.',
    };
  }

  return resposta;
}

/* ============================================================
 * LOGIN MASTER
 * ============================================================ */

export async function loginMaster(
  usuario: string,
  senha: string
): Promise<ResultadoLoginMaster> {

  return post<
    ResultadoLoginMaster
  >({
    acao:
      'loginMaster',

    usuario:
      usuario.trim(),

    senha,
  });
}

/* ============================================================
 * VALIDAR SESSÃO MASTER
 * ============================================================ */

export async function validarSessaoMaster(
  token: string
): Promise<ResultadoSessaoMaster> {

  return post<
    ResultadoSessaoMaster
  >({
    acao:
      'validarSessaoMaster',

    token,
  });
}

/* ============================================================
 * LOGOUT MASTER
 * ============================================================ */

export async function logoutMaster(
  token: string
): Promise<ResultadoLogoutMaster> {

  return post<
    ResultadoLogoutMaster
  >({
    acao:
      'logoutMaster',

    token,
  });
}

/* ============================================================
 * RELATÓRIO EXTRACLASSE
 * ============================================================ */

export async function listarRelatorioExtraclasse(
  filtros: FiltrosRelatorioExtraclasse,
  token: string
): Promise<ResultadoRelatorioExtraclasse> {

  const resposta =
    await post<
      ResultadoRelatorioExtraclasse
    >({
      acao:
        'relatorioExtraclasse',

      token,

      filtros: {
        nome:
          String(
            filtros.nome ??
              ''
          ).trim(),

        categoria:
          String(
            filtros.categoria ??
              ''
          ).trim(),

        data_inicio:
          filtros.data_inicio ??
          '',

        data_fim:
          filtros.data_fim ??
          '',
      },
    });

  if (!resposta.sucesso) {
    return {
      sucesso: false,

      mensagem:
        resposta.mensagem ||
        'Não foi possível carregar o relatório.',

      dados: [],

      resumo: {
        quantidadeAtividades:
          0,

        quantidadeDias:
          0,

        cargaHorariaTotal:
          0,
      },
    };
  }

  const dados =
    (
      resposta.dados ?? []
    ).map(
      (item) => ({
        id:
          String(
            item.id ??
              ''
          ),

        nome:
          String(
            item.nome ??
              ''
          ),

        matricula:
          String(
            item.matricula ??
              ''
          ),

        data_inicio:
          String(
            item.data_inicio ??
              ''
          ),

        data_fim:
          String(
            item.data_fim ??
              ''
          ),

        dias_semana:
          String(
            item.dias_semana ??
              ''
          ),

        datas_realizadas:
          String(
            item.datas_realizadas ??
              ''
          ),

        categoria:
          String(
            item.categoria ??
              ''
          ),

        carga_horaria_diaria:
          Number(
            item.carga_horaria_diaria
          ) || 0,

        qtd_dias:
          Number(
            item.qtd_dias
          ) || 0,

        carga_horaria_total:
          Number(
            item.carga_horaria_total
          ) || 0,

        descricao:
          String(
            item.descricao ??
              ''
          ),

        criado_em:
          String(
            item.criado_em ??
              ''
          ),

        datas_periodo:
          Array.isArray(
            item.datas_periodo
          )
            ? item.datas_periodo.map(
                (data) =>
                  String(data)
              )
            : [],

        qtd_dias_periodo:
          Number(
            item.qtd_dias_periodo
          ) || 0,

        carga_horaria_periodo:
          Number(
            item.carga_horaria_periodo
          ) || 0,
      })
    );

  return {
    sucesso: true,

    dados,

    resumo: {
      quantidadeAtividades:
        Number(
          resposta.resumo
            ?.quantidadeAtividades
        ) || 0,

      quantidadeDias:
        Number(
          resposta.resumo
            ?.quantidadeDias
        ) || 0,

      cargaHorariaTotal:
        Number(
          resposta.resumo
            ?.cargaHorariaTotal
        ) || 0,
    },
  };
}
