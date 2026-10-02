import { apiPost } from './apiClient';

export type StatusCompetenciaRelatorio = 'APTO' | 'PARCIALMENTE_APTO' | 'INAPTO';
export type FuncionarioFiltro = { matricula: string; nome: string };
export type AreaFiltro = { id: string; area: string };
export type UnidadeCurricularFiltro = { id: string; codigo: string; unidade_curricular: string };
export type StatusFiltro = { id: StatusCompetenciaRelatorio; rotulo: string };

export type FiltrosDisponiveis = {
  sucesso: boolean;
  mensagem?: string;
  funcionarios: FuncionarioFiltro[];
  areas: AreaFiltro[];
  unidades_curriculares: UnidadeCurricularFiltro[];
  status: StatusFiltro[];
};

export type AreaCompetenciaRelatorio = { id: string; area: string };
export type CompetenciaRelatorio = {
  competencia_id: string;
  matricula: string;
  funcionario: string;
  uc_id: string;
  unidade_curricular: string;
  status_competencia: StatusCompetenciaRelatorio;
  primeiro_preenchimento: string;
  ultima_atualizacao: string;
  areas: AreaCompetenciaRelatorio[];
};
export type IndicadoresRelatorio = { total_registros: number; funcionarios: number; aptos: number; parcialmente_aptos: number; inaptos: number };
export type RespostaRelatorio = { sucesso: boolean; mensagem?: string; dados: CompetenciaRelatorio[]; indicadores: IndicadoresRelatorio };
export type HistoricoCompetencia = { id: string; competencia_id: string; matricula: string; funcionario: string; uc_id: string; unidade_curricular: string; status_anterior: string; status_novo: string; motivo: string; justificativa: string; data_hora: string };
export type RespostaHistorico = { sucesso: boolean; mensagem?: string; dados: HistoricoCompetencia[]; total: number };
export type FiltrosRelatorio = { matricula?: string; funcionario?: string; area_id?: string; uc_id?: string; status?: StatusCompetenciaRelatorio[] };

export async function obterFiltrosRelatorioCompetenciasApi(token: string): Promise<FiltrosDisponiveis> {
  const resposta = await apiPost<FiltrosDisponiveis>({ acao: 'obterFiltrosRelatorioCompetencias', token });
  if (!resposta.sucesso) throw new Error(resposta.mensagem || 'Não foi possível carregar os filtros.');
  return resposta;
}

export async function consultarRelatorioCompetenciasApi(token: string, filtros: FiltrosRelatorio): Promise<RespostaRelatorio> {
  const resposta = await apiPost<RespostaRelatorio>({ acao: 'consultarRelatorioCompetencias', token, filtros });
  if (!resposta.sucesso) throw new Error(resposta.mensagem || 'Não foi possível consultar o relatório.');
  return resposta;
}

export async function consultarHistoricoCompetenciaApi(token: string, competenciaId: string): Promise<RespostaHistorico> {
  const resposta = await apiPost<RespostaHistorico>({ acao: 'consultarHistoricoCompetencias', token, filtros: { competencia_id: competenciaId } });
  if (!resposta.sucesso) throw new Error(resposta.mensagem || 'Não foi possível consultar o histórico.');
  return resposta;
}
