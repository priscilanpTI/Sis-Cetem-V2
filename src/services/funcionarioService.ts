import { apiGet, apiPost } from './apiClient';

export type FuncionarioPublico = {
  id: string;
  nome: string;
};

export type FuncionarioValidado = {
  id: string;
  nome: string;
  email: string;
};

type ListaResponse = {
  sucesso: boolean;
  mensagem?: string;
  dados?: FuncionarioPublico[];
};

type ValidacaoResponse = {
  sucesso: boolean;
  mensagem?: string;
  funcionario?: FuncionarioValidado;
};

export async function listarFuncionariosPublicos(): Promise<FuncionarioPublico[]> {
  const response = await apiGet<ListaResponse>('funcionarios-publicos', {}, {
    key: 'funcionarios-publicos',
    ttlMs: 10 * 60 * 1000,
  });

  if (!response.sucesso) {
    throw new Error(response.mensagem || 'Não foi possível carregar os funcionários.');
  }

  return (response.dados || [])
    .map((item) => ({ id: String(item.id || '').trim(), nome: String(item.nome || '').trim() }))
    .filter((item) => item.id && item.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function validarFuncionario(
  funcionarioId: string,
  matricula: string
): Promise<FuncionarioValidado> {
  const response = await apiPost<ValidacaoResponse>({
    acao: 'validarFuncionario',
    funcionario_id: funcionarioId,
    matricula: matricula.trim(),
  });

  if (!response.sucesso || !response.funcionario) {
    throw new Error(
      response.mensagem ||
        'A matrícula informada não corresponde ao funcionário selecionado. Verifique e tente novamente.'
    );
  }

  return response.funcionario;
}
