import { apiGet, apiPost } from './apiClient';

export type StatusCompetencia = 'APTO' | 'PARCIALMENTE_APTO' | 'INAPTO' | '';

export type FuncionarioMapa = { id: string; nome: string };
export type FuncionarioMapaValidado = { id: string; nome: string; email: string };
export type AreaCompetencia = { id: string; area: string };
export type UnidadeCurricular = { id: string; codigo: string; unidade_curricular: string };
export type VinculoAreaUc = { area_id: string; uc_id: string };
export type MotivoAlteracao = { id: string; motivo: string; exige_justificativa: boolean };
export type StatusOpcao = { id: Exclude<StatusCompetencia, ''>; rotulo: string };

export type CompetenciaAtual = {
  uc_id: string;
  unidade_curricular: string;
  status_competencia: Exclude<StatusCompetencia, ''>;
  primeiro_preenchimento: string;
  ultima_atualizacao: string;
};

export type DadosIniciaisMapa = {
  sucesso: boolean;
  mensagem?: string;
  funcionarios: FuncionarioMapa[];
  areas: AreaCompetencia[];
  unidades_curriculares: UnidadeCurricular[];
  vinculos: VinculoAreaUc[];
  motivos: MotivoAlteracao[];
  status: StatusOpcao[];
};

export type DadosFuncionarioMapa = {
  sucesso: boolean;
  mensagem?: string;
  funcionario: FuncionarioMapaValidado;
  areas_selecionadas: string[];
  competencias_atuais: CompetenciaAtual[];
};

export type CompetenciaEnvio = {
  uc_id: string;
  unidade_curricular: string;
  status_competencia: Exclude<StatusCompetencia, ''>;
  motivo_id?: string;
  justificativa?: string;
};

export type SalvarMapaResposta = {
  sucesso: boolean;
  mensagem: string;
  email_enviado?: boolean;
  resumo?: { criadas: number; alteradas: number; mantidas: number; total: number };
};

function validarSucesso<T extends { sucesso: boolean; mensagem?: string }>(resposta: T, padrao: string): T {
  if (!resposta.sucesso) throw new Error(resposta.mensagem || padrao);
  return resposta;
}

export async function obterDadosIniciaisMapa(): Promise<DadosIniciaisMapa> {
  const resposta = await apiGet<DadosIniciaisMapa>('mapa-dados-iniciais', {}, {
    key: 'mapa-catalogo',
    ttlMs: 10 * 60 * 1000,
  });
  validarSucesso(resposta, 'Não foi possível carregar o Mapa de Competências.');
  if (!Array.isArray(resposta.funcionarios) || !Array.isArray(resposta.areas) || !Array.isArray(resposta.unidades_curriculares) || !Array.isArray(resposta.vinculos)) {
    throw new Error('A API do Mapa de Competências está desatualizada. Publique a versão final do Apps Script.');
  }
  return resposta;
}

export async function obterDadosFuncionarioMapa(
  funcionarioId: string,
  matricula: string
): Promise<DadosFuncionarioMapa> {
  const resposta = await apiPost<DadosFuncionarioMapa>({
    acao: 'mapa-validar-funcionario',
    funcionario_id: funcionarioId,
    matricula: matricula.trim(),
  });
  return validarSucesso(resposta, 'Não foi possível validar o funcionário.');
}

export async function salvarMapaCompetenciasApi(dados: {
  funcionario_id: string;
  matricula: string;
  area_ids: string[];
  competencias: CompetenciaEnvio[];
}): Promise<SalvarMapaResposta> {
  const resposta = await apiPost<SalvarMapaResposta>({
    acao: 'salvarMapaCompetencias',
    ...dados,
  });
  return validarSucesso(resposta, 'Não foi possível salvar o Mapa de Competências.');
}
