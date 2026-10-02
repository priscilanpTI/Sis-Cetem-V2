import { apiGet, apiPost } from './apiClient';

export interface CategoriaExtraclasse {
  id: string;
  categoria: string;
}

export interface RegistroExtraclasse {
  funcionario_id: string;
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
  email_enviado?: boolean;
  calculo?: CalculoExtraclasse;
}

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

type ListaCategoriasResponse = {
  sucesso: boolean;
  mensagem?: string;
  dados?: CategoriaExtraclasse[];
};

export async function listarCategoriasExtraclasse(): Promise<CategoriaExtraclasse[]> {
  const resposta = await apiGet<ListaCategoriasResponse>('categorias-extraclasse', {}, {
    key: 'categorias-extraclasse',
    ttlMs: 10 * 60 * 1000,
  });

  if (!resposta.sucesso) {
    throw new Error(resposta.mensagem || 'Não foi possível carregar as categorias.');
  }

  return (resposta.dados || [])
    .map((item) => ({ id: String(item.id || '').trim(), categoria: String(item.categoria || '').trim() }))
    .filter((item) => item.id && item.categoria);
}

export async function registrarAtividadeExtraclasse(
  dados: RegistroExtraclasse
): Promise<ResultadoRegistroExtraclasse> {
  return apiPost<ResultadoRegistroExtraclasse>({
    acao: 'registrarAtividadeExtraclasse',
    ...dados,
  });
}

export async function listarRelatorioExtraclasse(
  filtros: FiltrosRelatorioExtraclasse,
  token: string
): Promise<ResultadoRelatorioExtraclasse> {
  const resposta = await apiPost<ResultadoRelatorioExtraclasse>({
    acao: 'listarRelatorioExtraclasse',
    token,
    filtros,
  });

  if (!resposta.sucesso) {
    throw new Error(resposta.mensagem || 'Não foi possível carregar o relatório.');
  }

  return resposta;
}
