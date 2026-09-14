import {
  CalendarDays,
  ClipboardList,
  FileText,
  Home,
  PlusCircle,
} from 'lucide-react';

import {
  NavLink,
  Outlet,
} from 'react-router-dom';

export function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          Agenda de Salas
        </div>

        <nav>
          <NavLink to="/" end>
            <Home size={18} />
            Dashboard
          </NavLink>

          <NavLink to="/agendamentos">
            <CalendarDays size={18} />
            Agendamentos
          </NavLink>

          <NavLink to="/novo">
            <PlusCircle size={18} />
            Novo agendamento
          </NavLink>

          <NavLink to="/extraclasse">
            <ClipboardList size={18} />
            Atividades Extraclasse
          </NavLink>

          <NavLink to="/relatorio-extraclasse">
            <FileText size={18} />
            Relatório Extraclasse
          </NavLink>
        </nav>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
