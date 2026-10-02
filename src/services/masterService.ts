import { apiPost } from './apiClient';

const TOKEN_KEY = 'sgd-master-token';
const USER_KEY = 'sgd-master-user';

export type MasterSession = {
  token: string;
  user: string;
};

type LoginResponse = {
  sucesso: boolean;
  mensagem?: string;
  token?: string;
  usuario?: string;
};

type SessionResponse = {
  sucesso: boolean;
  mensagem?: string;
  autenticado?: boolean;
};

export function getMasterToken(): string {
  return sessionStorage.getItem(TOKEN_KEY) || '';
}

export function getMasterUser(): string {
  return sessionStorage.getItem(USER_KEY) || '';
}

function saveMasterSession(session: MasterSession): void {
  sessionStorage.setItem(TOKEN_KEY, session.token);
  sessionStorage.setItem(USER_KEY, session.user);
}

export function clearMasterSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export async function loginMaster(usuario: string, senha: string): Promise<MasterSession> {
  const response = await apiPost<LoginResponse>({
    acao: 'loginMaster',
    usuario: usuario.trim(),
    senha,
  });

  if (!response.sucesso || !response.token || !response.usuario) {
    throw new Error(response.mensagem || 'Usuário ou senha inválidos.');
  }

  const session = { token: response.token, user: response.usuario };
  saveMasterSession(session);
  return session;
}

export async function validateMasterSession(): Promise<boolean> {
  const token = getMasterToken();
  if (!token) return false;

  try {
    const response = await apiPost<SessionResponse>({
      acao: 'validarSessaoMaster',
      token,
    });
    const valid = Boolean(response.sucesso && response.autenticado);
    if (!valid) clearMasterSession();
    return valid;
  } catch {
    return false;
  }
}

export async function logoutMaster(): Promise<void> {
  const token = getMasterToken();
  try {
    if (token) {
      await apiPost({ acao: 'logoutMaster', token });
    }
  } finally {
    clearMasterSession();
  }
}
