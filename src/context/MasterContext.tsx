import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  getMasterToken,
  getMasterUser,
  loginMaster,
  logoutMaster,
  validateMasterSession,
} from '../services/masterService';

type MasterContextValue = {
  loading: boolean;
  isMaster: boolean;
  token: string;
  user: string;
  login: (usuario: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
};

const MasterContext = createContext<MasterContextValue | null>(null);

export function MasterProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isMaster, setIsMaster] = useState(false);
  const [token, setToken] = useState('');
  const [user, setUser] = useState('');

  useEffect(() => {
    async function initialize() {
      const valid = await validateMasterSession();
      if (valid) {
        setIsMaster(true);
        setToken(getMasterToken());
        setUser(getMasterUser() || 'Master');
      }
      setLoading(false);
    }
    initialize();
  }, []);

  async function login(usuario: string, senha: string) {
    const session = await loginMaster(usuario, senha);
    setToken(session.token);
    setUser(session.user);
    setIsMaster(true);
  }

  async function logout() {
    await logoutMaster();
    setToken('');
    setUser('');
    setIsMaster(false);
  }

  const value = useMemo(
    () => ({ loading, isMaster, token, user, login, logout }),
    [loading, isMaster, token, user]
  );

  return <MasterContext.Provider value={value}>{children}</MasterContext.Provider>;
}

export function useMaster() {
  const context = useContext(MasterContext);
  if (!context) throw new Error('useMaster deve ser utilizado dentro de MasterProvider.');
  return context;
}
