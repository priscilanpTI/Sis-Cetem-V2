import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  Check,
  ChevronDown,
  Clock3,
  Filter,
  LockKeyhole,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import { bookingService, masterService, roomService, softwareService } from '../services/bookingService';
import type { Booking, Room, Software } from '../types';
import { WEEKDAYS, bookingMatchesDateRange, formatDateBr, timesOverlap } from '../utils/bookingDates';

function matchesTimeRange(booking: Booking, startTime: string, endTime: string): boolean {
  if (!startTime && !endTime) return true;
  if (startTime && !endTime) return booking.startTime <= startTime && booking.endTime > startTime;
  if (!startTime && endTime) return booking.startTime < endTime;
  return timesOverlap(booking.startTime, booking.endTime, startTime, endTime);
}

export function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [isMaster, setIsMaster] = useState(false);
  const [masterUser, setMasterUser] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
      const [bookingList, roomList, softwareList] = await Promise.all([
        masterMode ? bookingService.listMaster() : bookingService.list(),
        roomService.list(),
        softwareService.listAll()
      ]);

      setBookings(bookingList);
      setRooms(roomList);
      setSoftwares(softwareList);
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

  const roomMatchesFilter = (roomId: string) => allRooms || selectedRoomIds.includes(roomId);

  const filteredBookings = useMemo(() => {
    if (filterError) return [];

    return bookings.filter(
      (booking) =>
        roomMatchesFilter(booking.roomId) &&
        bookingMatchesDateRange(booking, filterStartDate, filterEndDate) &&
        matchesTimeRange(booking, filterStartTime, filterEndTime)
    );
  }, [bookings, allRooms, selectedRoomIds, filterStartDate, filterEndDate, filterStartTime, filterEndTime, filterError]);

  const roomsForAvailability = useMemo(
    () => rooms.filter((room) => roomMatchesFilter(room.id)),
    [rooms, allRooms, selectedRoomIds]
  );

  const availability = useMemo(() => {
    if (!filterStartDate || filterError) return [];

    return roomsForAvailability.map((room) => {
      const conflicts = bookings.filter(
        (booking) =>
          booking.status === 'Confirmado' &&
          booking.roomId === room.id &&
          bookingMatchesDateRange(booking, filterStartDate, filterEndDate) &&
          matchesTimeRange(booking, filterStartTime, filterEndTime)
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
    });
  }, [roomsForAvailability, bookings, filterStartDate, filterEndDate, filterStartTime, filterEndTime, filterError]);

  const availabilitySummary = useMemo(() => {
    const occupied = availability.filter((item) => item.occupied).length;
    return { occupied, available: Math.max(availability.length - occupied, 0) };
  }, [availability]);

  const hasFilters =
    !allRooms || Boolean(filterStartDate) || Boolean(filterEndDate) || Boolean(filterStartTime) || Boolean(filterEndTime);

  const roomSelectionLabel = useMemo(() => {
    if (allRooms) return 'Todos os laboratórios';
    const selectedRooms = rooms.filter((room) => selectedRoomIds.includes(room.id));
    if (selectedRooms.length === 0) return 'Todos os laboratórios';
    if (selectedRooms.length === 1) return selectedRooms[0].name;
    if (selectedRooms.length === 2) return `${selectedRooms[0].name} + ${selectedRooms[1].name}`;
    return `${selectedRooms.length} laboratórios selecionados`;
  }, [allRooms, rooms, selectedRoomIds]);

  const softwareNames = useMemo(
    () => new Map(softwares.map((software) => [software.id, software.name])),
    [softwares]
  );

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
      if (next.length === 0) setAllRooms(true);
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

    if (!window.confirm('Deseja realmente cancelar todo este agendamento recorrente?')) return;

    setError('');
    setCancellingId(id);

    try {
      await bookingService.cancel(id);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível cancelar o agendamento.');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <span className="eyebrow">Agenda</span>
          <h1>Agendamentos</h1>
          <p>
            {isMaster
              ? 'Modo Master ativo: dados completos e cancelamento habilitado.'
              : 'Consulte ocupação e disponibilidade por laboratório, período e horário.'}
          </p>
        </div>

        <div className="master-actions">
          {isMaster ? (
            <>
              <span className="master-badge"><ShieldCheck size={17} /> Master: {masterUser}</span>
              <button type="button" className="secondary" onClick={handleLogout} disabled={loggingOut}>
                <LogOut size={17} /> {loggingOut ? 'Saindo...' : 'Sair do Master'}
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
              <LockKeyhole size={17} /> Acesso Master
            </button>
          )}
        </div>
      </div>

      {showLogin && !isMaster && (
        <form className="panel master-login" onSubmit={handleLogin}>
          <div>
            <span className="eyebrow">Área restrita</span>
            <h2>Acesso Master</h2>
            <p className="muted">Use as credenciais do administrador para visualizar dados completos e cancelar reservas.</p>
          </div>
          <div className="master-login-grid">
            <label>Usuário<input name="usuario" autoComplete="username" required disabled={loggingIn} /></label>
            <label>Senha<input type="password" name="senha" autoComplete="current-password" required disabled={loggingIn} /></label>
          </div>
          {loginError && <div className="error">{loginError}</div>}
          <div className="actions">
            <button type="button" className="secondary" onClick={() => setShowLogin(false)} disabled={loggingIn}>Cancelar</button>
            <button className="primary" type="submit" disabled={loggingIn}>{loggingIn ? 'Entrando...' : 'Entrar'}</button>
          </div>
        </form>
      )}

      <section className="panel filters-panel">
        <div className="filters-header">
          <div>
            <span className="eyebrow">Consulta</span>
            <h2>Filtrar disponibilidade</h2>
            <p className="muted">Selecione laboratórios, datas e horários para localizar reservas reais dos dias recorrentes.</p>
          </div>
          {hasFilters && <button type="button" className="secondary" onClick={clearFilters}>Limpar filtros</button>}
        </div>

        <div className="filter-section">
          <div className="filter-title"><Filter size={17} /><strong>Laboratórios</strong></div>
          <details className="room-select-dropdown">
            <summary className="room-select-summary">
              <span className="room-select-summary-text">{roomSelectionLabel}</span>
              <ChevronDown size={18} className="room-select-chevron" />
            </summary>
            <div className="room-select-menu">
              <label className={`room-select-option ${allRooms ? 'selected' : ''}`}>
                <input type="checkbox" checked={allRooms} onChange={selectAllRooms} />
                <span className="room-select-check">{allRooms && <Check size={14} />}</span>
                <span><strong>Todos os laboratórios</strong><small>Consultar todas as salas</small></span>
              </label>
              <div className="room-select-divider" />
              {rooms.map((room) => {
                const active = !allRooms && selectedRoomIds.includes(room.id);
                return (
                  <label className={`room-select-option ${active ? 'selected' : ''}`} key={room.id}>
                    <input type="checkbox" checked={active} onChange={() => toggleRoom(room.id)} />
                    <span className="room-select-check">{active && <Check size={14} />}</span>
                    <span><strong>{room.name}</strong><small>{room.location} • {room.capacity} lugares</small></span>
                  </label>
                );
              })}
            </div>
          </details>
        </div>

        <div className="filters-grid">
          <label><span className="filter-label"><CalendarRange size={16} /> Dia / início do período</span><input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} /></label>
          <label>Fim do período<input type="date" min={filterStartDate || undefined} value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} disabled={!filterStartDate} /></label>
          <label><span className="filter-label"><Clock3 size={16} /> Horário inicial</span><input type="time" value={filterStartTime} onChange={(e) => setFilterStartTime(e.target.value)} /></label>
          <label>Horário final<input type="time" value={filterEndTime} onChange={(e) => setFilterEndTime(e.target.value)} /></label>
        </div>

        {filterError && <div className="error">{filterError}</div>}
      </section>

      {filterStartDate && !filterError && (
        <section className="panel availability-panel">
          <div className="availability-header">
            <div>
              <span className="eyebrow">Resultado</span>
              <h2>Situação dos laboratórios</h2>
              <p className="muted">A recorrência semanal de cada reserva é considerada no cálculo.</p>
            </div>
            <div className="availability-totals">
              <span className="availability-total available">{availabilitySummary.available} disponíveis</span>
              <span className="availability-total occupied">{availabilitySummary.occupied} ocupados</span>
            </div>
          </div>
          <div className="availability-grid">
            {availability.map((item) => (
              <article className={`availability-card ${item.occupied ? 'occupied' : 'available'}`} key={item.room.id}>
                <div className="availability-card-heading">
                  <strong>{item.room.name}</strong>
                  <span className={`availability-status ${item.occupied ? 'occupied' : 'available'}`}>
                    {item.occupied ? 'Ocupado' : 'Disponível'}
                  </span>
                </div>
                <span className="availability-room-meta">{item.room.location} • {item.room.capacity} lugares</span>
                <p>
                  {item.occupied
                    ? `${item.conflictCount} reserva(s) compatível(is) com a consulta${item.latestConflictDate ? ` • registros até ${formatDateBr(item.latestConflictDate)}` : ''}`
                    : 'Sem reservas conflitantes para a consulta realizada.'}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {error && <div className="error page-error">{error}</div>}

      <section className="panel">
        <div className="table-heading">
          <div>
            <span className="eyebrow">Reservas</span>
            <h2>{filteredBookings.length} agendamento(s) encontrado(s)</h2>
          </div>
        </div>

        {loading ? (
          <p className="muted">Carregando agendamentos...</p>
        ) : filteredBookings.length === 0 ? (
          <div className="empty">Nenhum agendamento encontrado para os filtros informados.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Laboratório</th>
                  <th>Período</th>
                  <th>Dias</th>
                  <th>Horário</th>
                  <th>Softwares</th>
                  {isMaster && <th>Responsável</th>}
                  <th>Status</th>
                  {isMaster && <th>Ação</th>}
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((booking) => {
                  const room = rooms.find((item) => item.id === booking.roomId);
                  const days = WEEKDAYS.filter((day) => booking.weekdays.includes(day.code)).map((day) => day.short).join(', ');
                  const softwareList = booking.softwareIds.map((id) => softwareNames.get(id) || id).join(', ');

                  return (
                    <tr key={booking.id}>
                      <td><strong>{room?.name || booking.roomId}</strong></td>
                      <td>{formatDateBr(booking.startDate)} → {formatDateBr(booking.endDate)}</td>
                      <td>{days}</td>
                      <td>{booking.startTime} – {booking.endTime}</td>
                      <td>{softwareList || 'Nenhum informado'}</td>
                      {isMaster && (
                        <td>
                          {booking.responsible || '—'}
                          {booking.emailResponsible && <span className="cell-secondary">{booking.emailResponsible}</span>}
                        </td>
                      )}
                      <td><span className={`badge ${booking.status === 'Cancelado' ? 'danger' : ''}`}>{booking.status}</span></td>
                      {isMaster && (
                        <td>
                          {booking.status === 'Confirmado' ? (
                            <button type="button" className="link-danger" onClick={() => cancel(booking.id)} disabled={cancellingId === booking.id}>
                              {cancellingId === booking.id ? 'Cancelando...' : 'Cancelar'}
                            </button>
                          ) : '—'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
