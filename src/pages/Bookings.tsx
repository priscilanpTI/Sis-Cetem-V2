import { memo, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  ShieldCheck
} from 'lucide-react';
import { bookingService, roomService, softwareService } from '../services/bookingService';
import { useMaster } from '../context/MasterContext';
import type { Booking, Room, Software } from '../types';
import {
  WEEKDAYS,
  addDays,
  bookingMatchesDateRange,
  formatDateBr,
  formatLocalDate,
  generateOccurrences,
  startOfWeekMonday,
  timesOverlap
} from '../utils/bookingDates';

function matchesTimeRange(booking: Booking, startTime: string, endTime: string): boolean {
  if (!startTime && !endTime) return true;
  if (startTime && !endTime) return booking.startTime <= startTime && booking.endTime > startTime;
  if (!startTime && endTime) return booking.startTime < endTime;
  return timesOverlap(booking.startTime, booking.endTime, startTime, endTime);
}

function hourToMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function dayLabel(date: string): string {
  const jsDay = new Date(`${date}T12:00:00`).getDay();
  const codes = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
  return WEEKDAYS.find((item) => item.code === codes[jsDay])?.short || '';
}

type PlannerEventProps = {
  booking: Booking;
  date: string;
  style: CSSProperties;
  softwareText: string;
  isMaster: boolean;
  cancelling: boolean;
  onCancel: (id: string) => void;
};

const PlannerEvent = memo(function PlannerEvent({
  booking,
  date,
  style,
  softwareText,
  isMaster,
  cancelling,
  onCancel,
}: PlannerEventProps) {
  return (
    <article
      key={`${booking.id}-${date}`}
      className={`master-planner-event ${booking.status === 'Cancelado' ? 'cancelled' : 'confirmed'}`}
      style={style}
      title={`${booking.startTime}–${booking.endTime} • ${booking.responsible || 'Sem responsável'}`}
    >
      <strong>{booking.startTime} – {booking.endTime}</strong>
      <span>{softwareText || 'Nenhum software informado'}</span>
      {isMaster && <span>{booking.responsible || '—'}</span>}
      <b>{booking.status}</b>
      {isMaster && booking.status === 'Confirmado' && (
        <button type="button" onClick={() => onCancel(booking.id)} disabled={cancelling}>
          {cancelling ? 'Cancelando...' : 'Cancelar'}
        </button>
      )}
    </article>
  );
});

export function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { isMaster, token, user: masterUser } = useMaster();

  const [allRooms, setAllRooms] = useState(true);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterStartTime, setFilterStartTime] = useState('');
  const [filterEndTime, setFilterEndTime] = useState('');
  const [plannerWeekStart, setPlannerWeekStart] = useState(() => startOfWeekMonday(formatLocalDate(new Date())));

  async function load(masterMode: boolean) {
    setError('');
    setLoading(true);

    try {
      const [bookingList, roomList, softwareList] = await Promise.all([
        masterMode ? bookingService.listMaster(token) : bookingService.list(),
        roomService.list(),
        softwareService.listAll()
      ]);

      setBookings(bookingList);
      setRooms(roomList);
      setSoftwares(softwareList);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar os agendamentos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(isMaster);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMaster, token]);

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
      return { room, occupied: conflicts.length > 0, conflictCount: conflicts.length, latestConflictDate };
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

  const plannerDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(plannerWeekStart, index)),
    [plannerWeekStart]
  );

  const plannerRooms = useMemo(
    () => rooms.filter((room) => roomMatchesFilter(room.id)),
    [rooms, allRooms, selectedRoomIds]
  );

  const plannerBookings = useMemo(() => {
    const weekEnd = plannerDays[6];
    return filteredBookings.filter((booking) => booking.startDate <= weekEnd && booking.endDate >= plannerWeekStart);
  }, [filteredBookings, plannerDays, plannerWeekStart]);

  const plannerRange = useMemo(() => {
    const relevant = plannerBookings.length ? plannerBookings : filteredBookings;
    const starts = relevant.map((item) => hourToMinutes(item.startTime));
    const ends = relevant.map((item) => hourToMinutes(item.endTime));
    const minHour = starts.length ? Math.min(8, Math.floor(Math.min(...starts) / 60)) : 8;
    const maxHour = ends.length ? Math.max(17, Math.ceil(Math.max(...ends) / 60)) : 17;
    return { start: Math.max(0, minHour), end: Math.min(24, maxHour) };
  }, [plannerBookings, filteredBookings]);

  const plannerHours = useMemo(
    () => Array.from({ length: plannerRange.end - plannerRange.start }, (_, index) => plannerRange.start + index),
    [plannerRange]
  );

  const bookingsByRoomId = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const booking of plannerBookings) {
      const list = map.get(booking.roomId);
      if (list) list.push(booking);
      else map.set(booking.roomId, [booking]);
    }
    return map;
  }, [plannerBookings]);

  const roomOccurrences = useMemo(() => {
    const result = new Map<string, Array<{ booking: Booking; date: string }>>();
    for (const room of plannerRooms) {
      const roomBookings = bookingsByRoomId.get(room.id) || [];
      const list: Array<{ booking: Booking; date: string }> = [];
      for (const booking of roomBookings) {
        const occs = generateOccurrences(
          booking.startDate > plannerWeekStart ? booking.startDate : plannerWeekStart,
          booking.endDate < plannerDays[6] ? booking.endDate : plannerDays[6],
          booking.weekdays
        );
        for (const date of occs) list.push({ booking, date });
      }
      result.set(room.id, list);
    }
    return result;
  }, [plannerRooms, bookingsByRoomId, plannerWeekStart, plannerDays]);

  const today = formatLocalDate(new Date());

  function toggleRoom(roomId: string) {
    if (allRooms) {
      setAllRooms(false);
      setSelectedRoomIds([roomId]);
      return;
    }
    setSelectedRoomIds((current) => {
      const next = current.includes(roomId) ? current.filter((id) => id !== roomId) : [...current, roomId];
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

  function goToToday() {
    setPlannerWeekStart(startOfWeekMonday(today));
  }

  function handleFilterStartDate(value: string) {
    setFilterStartDate(value);
    if (value) setPlannerWeekStart(startOfWeekMonday(value));
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
      const emailEnviado = await bookingService.cancel(id, token);
      if (!emailEnviado) window.alert('O agendamento foi cancelado, mas o e-mail de cancelamento não pôde ser enviado.');
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível cancelar o agendamento.');
    } finally {
      setCancellingId(null);
    }
  }

  function eventStyle(booking: Booking, date: string): React.CSSProperties {
    const start = Math.max(hourToMinutes(booking.startTime), plannerRange.start * 60);
    const end = Math.min(hourToMinutes(booking.endTime), plannerRange.end * 60);
    const top = ((start - plannerRange.start * 60) / 60) * 58;
    const height = Math.max(((end - start) / 60) * 58, 28);
    const dayIndex = plannerDays.indexOf(date);
    return {
      gridColumn: dayIndex + 1,
      top: `${top}px`,
      height: `${height}px`
    };
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <span className="eyebrow">Agenda</span>
          <h1>Agendamentos</h1>
          <p>{isMaster ? 'Modo Master ativo: visão em planner e cancelamento habilitado.' : 'Consulte ocupação e disponibilidade por laboratório, período e horário.'}</p>
        </div>
        {isMaster && (
          <div className="master-actions">
            <span className="master-badge"><ShieldCheck size={17} /> Master: {masterUser || 'Master'}</span>
          </div>
        )}
      </div>

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
          <label><span className="filter-label"><CalendarRange size={16} /> Dia / início do período</span><input type="date" value={filterStartDate} onChange={(e) => handleFilterStartDate(e.target.value)} /></label>
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
                  <span className={`availability-status ${item.occupied ? 'occupied' : 'available'}`}>{item.occupied ? 'Ocupado' : 'Disponível'}</span>
                </div>
                <span className="availability-room-meta">{item.room.location} • {item.room.capacity} lugares</span>
                <p>{item.occupied ? `${item.conflictCount} reserva(s) compatível(is) com a consulta${item.latestConflictDate ? ` • registros até ${formatDateBr(item.latestConflictDate)}` : ''}` : 'Sem reservas conflitantes para a consulta realizada.'}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {error && <div className="error page-error">{error}</div>}

      <section className="panel master-planner-panel">
        <div className="master-planner-toolbar">
          <div>
            <span className="eyebrow">Reservas</span>
            <h2>{filteredBookings.length} agendamento(s) encontrado(s)</h2>
            <p className="muted">Visualização semanal em formato de planner.</p>
          </div>
          <div className="master-planner-navigation">
            <button type="button" className="secondary icon-button" aria-label="Semana anterior" onClick={() => setPlannerWeekStart(addDays(plannerWeekStart, -7))}><ChevronLeft size={18} /></button>
            <strong>{formatDateBr(plannerDays[0])} → {formatDateBr(plannerDays[6])}</strong>
            <button type="button" className="secondary icon-button" aria-label="Próxima semana" onClick={() => setPlannerWeekStart(addDays(plannerWeekStart, 7))}><ChevronRight size={18} /></button>
            <button type="button" className="secondary" onClick={goToToday}>Hoje</button>
          </div>
        </div>

        <div className="master-planner-legend">
          <span><i className="legend-dot booking-confirmed" /> Confirmado</span>
          {isMaster && <span><i className="legend-dot booking-cancelled" /> Cancelado</span>}
        </div>

        {loading ? (
          <div className="skeleton-grid" style={{ padding: '24px', margin: 0 }}>
            <div className="skeleton-card"><div className="skeleton-line short" /><div className="skeleton-line long" /></div>
            <div className="skeleton-card"><div className="skeleton-line short" /><div className="skeleton-line long" /></div>
            <div className="skeleton-big" style={{ gridColumn: '1 / -1' }} />
          </div>
        ) : plannerRooms.length === 0 ? (
          <div className="planner-empty">Nenhum laboratório selecionado.</div>
        ) : (
          <div className="master-planner-scroll">
            <div className="master-planner-header" style={{ gridTemplateColumns: '220px 92px repeat(7, minmax(150px, 1fr))' }}>
              <div className="master-planner-room-title">Laboratório</div>
              <div className="master-planner-time-title">Horário</div>
              {plannerDays.map((date) => (
                <div className={`master-planner-day ${date === today ? 'today' : ''} ${['Sáb', 'Dom'].includes(dayLabel(date)) ? 'weekend' : ''}`} key={date}>
                  <strong>{dayLabel(date)}</strong><span>{formatDateBr(date).slice(0, 5)}</span>
                </div>
              ))}
            </div>

            {plannerRooms.map((room) => {
              const occurrences = roomOccurrences.get(room.id) || [];

              return (
                <div className="master-planner-room" key={room.id} style={{ gridTemplateColumns: '220px 92px repeat(7, minmax(150px, 1fr))', minHeight: `${plannerHours.length * 58}px` }}>
                  <div className="master-planner-room-info">
                    <strong>{room.name}</strong>
                    <span>{room.location}</span>
                  </div>
                  <div className="master-planner-times">
                    {plannerHours.map((hour) => <span key={hour}>{String(hour).padStart(2, '0')}:00 – {String(hour + 1).padStart(2, '0')}:00</span>)}
                  </div>
                  {plannerDays.map((date) => (
                    <div className={`master-planner-day-column ${['Sáb', 'Dom'].includes(dayLabel(date)) ? 'weekend' : ''}`} key={`${room.id}-${date}`}>
                      {plannerHours.map((hour) => <i className="master-planner-hour-line" key={hour} />)}
                    </div>
                  ))}
                  <div className="master-planner-events">
                    {occurrences.map(({ booking, date }) => {
                      const softwareList = booking.softwareIds.map((id) => softwareNames.get(id) || id).join(', ');
                      return (
                        <PlannerEvent
                          key={`${booking.id}-${date}`}
                          booking={booking}
                          date={date}
                          style={eventStyle(booking, date)}
                          softwareText={softwareList}
                          isMaster={isMaster}
                          cancelling={cancellingId === booking.id}
                          onCancel={cancel}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="master-planner-footer">
          {plannerBookings.length} agendamento(s) com ocorrência na semana de {formatDateBr(plannerDays[0])} a {formatDateBr(plannerDays[6])}.
        </div>
      </section>
    </section>
  );
}
