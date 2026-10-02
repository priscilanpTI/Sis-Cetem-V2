import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Home,
  LockKeyhole,
  LogOut,
  Menu,
  PlusCircle,
  ScrollText,
  ShieldCheck,
  X,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useMaster } from '../context/MasterContext';

const MOBILE_BREAKPOINT = 900;

function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

export function Layout() {
  const { loading, isMaster, user, login, logout } = useMaster();
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobileViewport());

  useEffect(() => {
    function handleResize() {
      const mobile = isMobileViewport();
      if (!mobile) setSidebarOpen(true);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function toggleSidebar() {
    setSidebarOpen((prev) => !prev);
  }

  function closeSidebarIfMobile() {
    if (isMobileViewport()) setSidebarOpen(false);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const usuario = String(data.get('usuario') || '').trim();
    const senha = String(data.get('senha') || '');

    try {
      setLoggingIn(true);
      await login(usuario, senha);
      form.reset();
      setLoginOpen(false);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Não foi possível realizar o login Master.');
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    try {
      setLoggingOut(true);
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="app-shell">
      <button
        type="button"
        className="sidebar-toggle"
        onClick={toggleSidebar}
        aria-label="Alternar menu"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {sidebarOpen && isMobileViewport() && (
        <div className="sidebar-backdrop" onClick={closeSidebarIfMobile} role="presentation" />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="brand">SGD</div>

        <nav>
          <NavLink to="/" end onClick={closeSidebarIfMobile}><Home size={18} /> Dashboard</NavLink>
          <NavLink to="/agendamentos" onClick={closeSidebarIfMobile}><CalendarDays size={18} /> Agendamentos</NavLink>
          <NavLink to="/novo" onClick={closeSidebarIfMobile}><PlusCircle size={18} /> Novo agendamento</NavLink>
          <NavLink to="/extraclasse" onClick={closeSidebarIfMobile}><ClipboardList size={18} /> Atividades Extraclasse</NavLink>
          <NavLink to="/mapa-competencias" onClick={closeSidebarIfMobile}><ScrollText size={18} /> Mapa de Competências</NavLink>

          <div className="nav-section-label">GESTÃO</div>
          <NavLink to="/relatorio-extraclasse" onClick={closeSidebarIfMobile}><BarChart3 size={18} /> Relatório Extraclasse</NavLink>
          <NavLink to="/relatorio-competencias" onClick={closeSidebarIfMobile}><BarChart3 size={18} /> Relatório de Competências</NavLink>
        </nav>

        <div className="sidebar-master">
          {loading ? (
            <span className="sidebar-master-loading">Validando acesso...</span>
          ) : isMaster ? (
            <>
              <div className="sidebar-master-badge">
                <ShieldCheck size={17} />
                <span><small>Master ativo</small><strong>{user || 'Master'}</strong></span>
              </div>
              <button type="button" onClick={handleLogout} disabled={loggingOut}>
                <LogOut size={16} /> {loggingOut ? 'Saindo...' : 'Sair'}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => { setLoginError(''); setLoginOpen(true); }}>
              <LockKeyhole size={17} /> Acesso Master
            </button>
          )}
        </div>
      </aside>

      <main className="content"><Outlet /></main>

      {loginOpen && !isMaster && (
        <div className="master-modal-backdrop" role="presentation" onClick={() => setLoginOpen(false)}>
          <form className="master-modal" onSubmit={handleLogin} onClick={(e) => e.stopPropagation()}>
            <div className="master-modal-header">
              <div>
                <span className="eyebrow">Área restrita</span>
                <h2>Acesso Master</h2>
                <p>Uma única sessão libera cancelamentos e os dois relatórios de gestão.</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setLoginOpen(false)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <label>Usuário<input name="usuario" autoComplete="username" required disabled={loggingIn} /></label>
            <label>Senha<input type="password" name="senha" autoComplete="current-password" required disabled={loggingIn} /></label>

            {loginError && <div className="error">{loginError}</div>}

            <div className="actions">
              <button type="button" className="secondary" onClick={() => setLoginOpen(false)} disabled={loggingIn}>Cancelar</button>
              <button type="submit" className="primary" disabled={loggingIn}>{loggingIn ? 'Entrando...' : 'Entrar'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
