import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  Check,
  ChevronDown,
  Clock3,
  Filter,
  LockKeyhole,
  LogOut,
  RotateCcw,
  ShieldCheck
} from 'lucide-react';
import { bookingService, masterService, roomService } from '../services/bookingService';
import type { Booking, Room } from '../types';

function formatDateBr(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR');
}

function formatPeriod(startDate: string, endDate: string): string {
  if (startDate === endDate) {
    return formatDateBr(startDate);
  }

  return `${formatDateBr(startDate)} → ${formatDateBr(endDate)}`;
}

function overlapsDateRange(
  booking: Booking,
  filterStartDate: string,
  filterEndDate: string
): boolean {
  if (!filterStartDate) {
    return true;
  }

  const effectiveEndDate = filterEndDate || filterStartDate;
  return booking.startDate <= effectiveEndDate && booking.endDate >= filterStartDate;
}

function overlapsTimeRange(
  booking: Booking,
  filterStartTime: string,
  filterEndTime: string
): boolean {
  if (!filterStartTime) {
    return true;
  }

  // Apenas um horário informado: consulta quais reservas abrangem aquele instante.
  if (!filterEndTime) {
    return booking.startTime <= filterStartTime && booking.endTime > filterStartTime;
  }

  // Intervalo informado: verifica sobreposição de horários.
  return booking.startTime < filterEndTime && booking.endTime > filterStartTime;
}

export function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [isMaster, setIsMaster] = useState(false);
  const [masterUser, setMasterUser] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Filtros disponíveis para todos os usuários.
  const [allRooms, setAllRooms] = useState(true);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterStartTime, setFilterStartTime] = useState('');
  const [filterEndTime, setFilterEndTime] = useState('');

  async function load(masterMode: boolean) {
    setError('');
    setLoading(true);

    try {
      const [bookingList, roomList] = await Promise.all([
        masterMode ? bookingService.listMaster() : bookingService.list(),
        roomService.list()
      ]);

      setBookings(bookingList);
      setRooms(roomList);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível carregar os agendamentos.';
      setError(message);

      if (masterMode && !masterService.hasStoredSession()) {
        setIsMaster(false);
        setMasterUser('');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function initialize() {
      const valid = await masterService.validate();

      if (valid) {
        setIsMaster(true);
        setMasterUser(masterService.getUser() || 'Master');
        await load(true);
      } else {
        setIsMaster(false);
        setMasterUser('');
        await load(false);
      }
    }

    initialize();
  }, []);

  const filterError = useMemo(() => {
    if (filterStartDate && filterEndDate && filterEndDate < filterStartDate) {
      return 'A data final do filtro não pode ser anterior à data inicial.';
    }

    if (filterStartTime && filterEndTime && filterEndTime <= filterStartTime) {
      return 'O horário final do filtro deve ser posterior ao horário inicial.';
    }

    return '';
  }, [filterStartDate, filterEndDate, filterStartTime, filterEndTime]);

  const roomMatchesFilter = (roomId: string) =>
    allRooms || selectedRoomIds.includes(roomId);

  const filteredBookings = useMemo(() => {
    if (filterError) {
      return [];
    }

    return bookings.filter(
      (booking) =>
        roomMatchesFilter(booking.roomId) &&
        overlapsDateRange(booking, filterStartDate, filterEndDate) &&
        overlapsTimeRange(booking, filterStartTime, filterEndTime)
    );
  }, [
    bookings,
    allRooms,
    selectedRoomIds,
    filterStartDate,
    filterEndDate,
    filterStartTime,
    filterEndTime,
    filterError
  ]);

  const roomsForAvailability = useMemo(
    () => rooms.filter((room) => roomMatchesFilter(room.id)),
    [rooms, allRooms, selectedRoomIds]
  );

  const availability = useMemo(() => {
    if (!filterStartDate || filterError) {
      return [];
    }

    return roomsForAvailability
      .map((room) => {
        const conflicts = bookings.filter(
          (booking) =>
            booking.status === 'Confirmado' &&
            booking.roomId === room.id &&
            overlapsDateRange(booking, filterStartDate, filterEndDate) &&
            overlapsTimeRange(booking, filterStartTime, filterEndTime)
        );

        const latestConflictDate = conflicts.reduce(
          (latest, booking) => (booking.endDate > latest ? booking.endDate : latest),
          ''
        );

        return {
          room,
          occupied: conflicts.length > 0,
          conflictCount: conflicts.length,
          latestConflictDate
        };
      })
      .sort((a, b) => {
        if (a.occupied !== b.occupied) {
          return a.occupied ? -1 : 1;
        }

        return a.room.name.localeCompare(b.room.name, 'pt-BR');
      });
  }, [
    roomsForAvailability,
    bookings,
    filterStartDate,
    filterEndDate,
    filterStartTime,
    filterEndTime,
    filterError
  ]);

  const availabilitySummary = useMemo(() => {
    const occupied = availability.filter((item) => item.occupied).length;
    return {
      occupied,
      available: Math.max(availability.length - occupied, 0)
    };
  }, [availability]);

  const hasFilters =
    !allRooms ||
    Boolean(filterStartDate) ||
    Boolean(filterEndDate) ||
    Boolean(filterStartTime) ||
    Boolean(filterEndTime);

  const roomSelectionLabel = useMemo(() => {
    if (allRooms) {
      return 'Todos os laboratórios';
    }

    const selectedRooms = rooms.filter((room) =>
      selectedRoomIds.includes(room.id)
    );

    if (selectedRooms.length === 0) {
      return 'Todos os laboratórios';
    }

    if (selectedRooms.length === 1) {
      return selectedRooms[0].name;
    }

    if (selectedRooms.length === 2) {
      return `${selectedRooms[0].name} + ${selectedRooms[1].name}`;
    }

    return `${selectedRooms.length} laboratórios selecionados`;
  }, [allRooms, rooms, selectedRoomIds]);

  function toggleRoom(roomId: string) {
    if (allRooms) {
      setAllRooms(false);
      setSelectedRoomIds([roomId]);
      return;
    }

    setSelectedRoomIds((current) => {
      const next = current.includes(roomId)
        ? current.filter((id) => id !== roomId)
        : [...current, roomId];

      if (next.length === 0) {
        setAllRooms(true);
      }

      return next;
    });
  }

  function selectAllRooms() {
    setAllRooms(true);
    setSelectedRoomIds([]);
  }

  function clearFilters() {
    selectAllRooms();
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterStartTime('');
    setFilterEndTime('');
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError('');
    setLoggingIn(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const usuario = String(formData.get('usuario') || '').trim();
    const senha = String(formData.get('senha') || '');

    try {
      const session = await masterService.login(usuario, senha);
      setIsMaster(true);
      setMasterUser(session.user);
      setShowLogin(false);
      form.reset();
      await load(true);
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'Não foi possível realizar o login Master.');
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    setError('');

    try {
      await masterService.logout();
    } finally {
      setIsMaster(false);
      setMasterUser('');
      setShowLogin(false);
      setLoggingOut(false);
      await load(false);
    }
  }

  async function cancel(id: string) {
    if (!isMaster) {
      setError('Apenas o usuário Master pode cancelar agendamentos.');
      return;
    }

    if (!window.confirm('Deseja realmente cancelar todo este período de agendamento?')) {
      return;
    }

    setError('');
    setCancellingId(id);

    try {
      await bookingService.cancel(id);
      await load(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível cancelar o agendamento.';
      setError(message);

      if (!masterService.hasStoredSession()) {
        setIsMaster(false);
        setMasterUser('');
        await load(false);
      }
    } finally {
      setCancellingId(null);
    }
  }

  const effectiveFilterEndDate = filterEndDate || filterStartDate;

  return (
    <section>
      <div className="page-header">
        <div>
          <span className="eyebrow">Agenda</span>
          <h1>Agendamentos</h1>
          <p>
            {isMaster
              ? 'Modo Master ativo: dados completos e cancelamento do período habilitado.'
              : 'Consulte ocupação e disponibilidade por laboratório, dia, período ou horário.'}
          </p>
        </div>

        <div className="master-actions">
          {isMaster ? (
            <>
              <span className="master-badge">
                <ShieldCheck size={17} />
                Master: {masterUser}
              </span>

              <button
                type="button"
                className="secondary"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                <LogOut size={17} />
                {loggingOut ? 'Saindo...' : 'Sair do Master'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setLoginError('');
                setShowLogin((value) => !value);
              }}
            >
              <LockKeyhole size={17} />
              Acesso Master
            </button>
          )}
        </div>
      </div>

      {showLogin && !isMaster && (
        <form className="panel master-login" onSubmit={handleLogin}>
          <div>
            <span className="eyebrow">Área restrita</span>
            <h2>Acesso Master</h2>
            <p className="muted">
              Entre com as credenciais do administrador para visualizar os dados completos e cancelar reservas.
            </p>
          </div>

          <div className="master-login-grid">
            <label>
              Usuário
              <input
                name="usuario"
                autoComplete="username"
                required
                disabled={loggingIn}
              />
            </label>

            <label>
              Senha
              <input
                type="password"
                name="senha"
                autoComplete="current-password"
                required
                disabled={loggingIn}
              />
            </label>
          </div>

          {loginError && <div className="error">{loginError}</div>}

          <div className="actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setShowLogin(false)}
              disabled={loggingIn}
            >
              Cancelar
            </button>

            <button className="primary" type="submit" disabled={loggingIn}>
              {loggingIn ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
      )}

      {error && <div className="error page-error">{error}</div>}

      <div className="panel filters-panel">
        <div className="filters-header">
          <div>
            <span className="eyebrow">Consulta</span>
            <h2>Filtrar disponibilidade</h2>
            <p className="muted">
              Selecione um ou mais laboratórios e combine filtros por dia, período e horário.
            </p>
          </div>

          <button
            type="button"
            className="secondary"
            onClick={clearFilters}
            disabled={!hasFilters}
          >
            <RotateCcw size={16} />
            Limpar filtros
          </button>
        </div>

        <div className="filter-section">
          <div className="filter-title">
            <Filter size={17} />
            <strong>Laboratórios</strong>
          </div>

          <details className="room-select-dropdown">
            <summary className="room-select-summary">
              <span className="room-select-summary-text">
                {roomSelectionLabel}
              </span>
              <ChevronDown size={18} className="room-select-chevron" />
            </summary>

            <div className="room-select-menu">
              <label className={`room-select-option ${allRooms ? 'selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={allRooms}
                  onChange={selectAllRooms}
                />
                <span className="room-select-check">
                  {allRooms && <Check size={14} />}
                </span>
                <span>
                  <strong>Todos os laboratórios</strong>
                  <small>Consultar todas as salas cadastradas</small>
                </span>
              </label>

              <div className="room-select-divider" />

              {rooms.map((room) => {
                const active = !allRooms && selectedRoomIds.includes(room.id);

                return (
                  <label
                    className={`room-select-option ${active ? 'selected' : ''}`}
                    key={room.id}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleRoom(room.id)}
                    />
                    <span className="room-select-check">
                      {active && <Check size={14} />}
                    </span>
                    <span>
                      <strong>{room.name}</strong>
                      <small>
                        {room.location} • {room.capacity} lugares
                      </small>
                    </span>
                  </label>
                );
              })}
            </div>
          </details>

          <span className="field-hint">
            Abra a lista e marque um ou mais laboratórios. Se nenhum estiver selecionado,
            o sistema considera todos.
          </span>
        </div>

        <div className="filters-grid">
          <label>
            <span className="filter-label">
              <CalendarRange size={16} />
              Dia / início do período
            </span>
            <input
              type="date"
              value={filterStartDate}
              onChange={(event) => {
                const value = event.target.value;
                setFilterStartDate(value);

                if (filterEndDate && value && filterEndDate < value) {
                  setFilterEndDate('');
                }
              }}
            />
            <span className="field-hint">
              Para consultar um único dia, não é necessário preencher a data final.
            </span>
          </label>

          <label>
            <span className="filter-label">
              <CalendarRange size={16} />
              Fim do período
            </span>
            <input
              type="date"
              value={filterEndDate}
              min={filterStartDate || undefined}
              disabled={!filterStartDate}
              onChange={(event) => setFilterEndDate(event.target.value)}
            />
            <span className="field-hint">Opcional. Use para consultas de vários dias.</span>
          </label>

          <label>
            <span className="filter-label">
              <Clock3 size={16} />
              Horário inicial
            </span>
            <input
              type="time"
              value={filterStartTime}
              onChange={(event) => {
                const value = event.target.value;
                setFilterStartTime(value);

                if (filterEndTime && value && filterEndTime <= value) {
                  setFilterEndTime('');
                }
              }}
            />
            <span className="field-hint">
              Sozinho, mostra reservas que estejam ocupadas exatamente nesse horário.
            </span>
          </label>

          <label>
            <span className="filter-label">
              <Clock3 size={16} />
              Horário final
            </span>
            <input
              type="time"
              value={filterEndTime}
              min={filterStartTime || undefined}
              disabled={!filterStartTime}
              onChange={(event) => setFilterEndTime(event.target.value)}
            />
            <span className="field-hint">Opcional. Preencha para consultar uma faixa de horário.</span>
          </label>
        </div>

        {filterError && <div className="error">{filterError}</div>}

        <div className="filter-result-line">
          <strong>{filteredBookings.length}</strong>
          <span>
            agendamento{filteredBookings.length === 1 ? '' : 's'} encontrado{filteredBookings.length === 1 ? '' : 's'}
          </span>
          {filterStartDate && !filterError && (
            <span className="filter-context">
              • consulta de {formatPeriod(filterStartDate, effectiveFilterEndDate)}
              {filterStartTime && ` • ${filterStartTime}${filterEndTime ? ` às ${filterEndTime}` : ''}`}
            </span>
          )}
        </div>
      </div>

      {filterStartDate && !filterError && (
        <div className="panel availability-panel">
          <div className="availability-header">
            <div>
              <span className="eyebrow">Disponibilidade</span>
              <h2>Situação dos laboratórios</h2>
              <p className="muted">
                Resultado considerando somente agendamentos confirmados que conflitam com a consulta.
              </p>
            </div>

            <div className="availability-totals">
              <span className="availability-total available">
                {availabilitySummary.available} disponíveis
              </span>
              <span className="availability-total occupied">
                {availabilitySummary.occupied} ocupados
              </span>
            </div>
          </div>

          <div className="availability-grid">
            {availability.map((item) => (
              <article
                className={`availability-card ${item.occupied ? 'occupied' : 'available'}`}
                key={item.room.id}
              >
                <div className="availability-card-heading">
                  <strong>{item.room.name}</strong>
                  <span className={`availability-status ${item.occupied ? 'occupied' : 'available'}`}>
                    {item.occupied ? 'Ocupado' : 'Disponível'}
                  </span>
                </div>

                <span className="availability-room-meta">
                  {item.room.location} • {item.room.capacity} lugares
                </span>

                {item.occupied ? (
                  <p>
                    {item.conflictCount} reserva{item.conflictCount === 1 ? '' : 's'} conflitante{item.conflictCount === 1 ? '' : 's'}.
                    {item.latestConflictDate && (
                      <> Há reserva(s) até <strong>{formatDateBr(item.latestConflictDate)}</strong>.</>
                    )}
                  </p>
                ) : (
                  <p>Sem reservas conflitantes para o dia, período e horário consultados.</p>
                )}
              </article>
            ))}
          </div>
        </div>
      )}

      {!filterStartDate && hasFilters && !filterError && (
        <div className="filter-hint panel">
          <CalendarRange size={18} />
          <span>
            Para identificar quais laboratórios estão <strong>disponíveis ou ocupados</strong>, selecione também um dia ou período.
          </span>
        </div>
      )}

      <div className="panel table-wrap">
        <div className="table-heading">
          <div>
            <h2>Agendamentos encontrados</h2>
            <p className="muted">A tabela abaixo acompanha os filtros selecionados acima.</p>
          </div>
        </div>

        {loading ? (
          <p className="muted">Carregando agendamentos...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Período</th>
                <th>Sala</th>
                <th>Horário diário</th>
                {isMaster && <th>Responsável</th>}
                <th>Finalidade</th>
                <th>Status</th>
                {isMaster && <th>Ação</th>}
              </tr>
            </thead>

            <tbody>
              {filteredBookings.length === 0 && (
                <tr>
                  <td colSpan={isMaster ? 7 : 5} className="empty">
                    {filterError
                      ? 'Corrija os filtros informados.'
                      : hasFilters
                        ? 'Nenhum agendamento corresponde aos filtros selecionados.'
                        : 'Nenhum agendamento cadastrado.'}
                  </td>
                </tr>
              )}

              {filteredBookings.map((booking) => (
                <tr key={booking.id}>
                  <td>{formatPeriod(booking.startDate, booking.endDate)}</td>

                  <td>
                    {rooms.find((room) => room.id === booking.roomId)?.name || booking.roomId}
                  </td>

                  <td>
                    {booking.startTime} – {booking.endTime}
                  </td>

                  {isMaster && (
                    <td>
                      <strong>{booking.responsible || 'Não informado'}</strong>
                      {booking.emailResponsible && (
                        <span className="cell-secondary">{booking.emailResponsible}</span>
                      )}
                    </td>
                  )}

                  <td>{booking.purpose}</td>

                  <td>
                    <span className={`badge ${booking.status === 'Cancelado' ? 'danger' : ''}`}>
                      {booking.status}
                    </span>
                  </td>

                  {isMaster && (
                    <td>
                      {booking.status === 'Confirmado' ? (
                        <button
                          type="button"
                          className="link-danger"
                          onClick={() => cancel(booking.id)}
                          disabled={cancellingId === booking.id}
                        >
                          {cancellingId === booking.id ? 'Cancelando...' : 'Cancelar período'}
                        </button>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
