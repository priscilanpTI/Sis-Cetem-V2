import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { bookingService, roomService, softwareService } from '../services/bookingService';
import { listarFuncionariosPublicos, validarFuncionario } from '../services/funcionarioService';
import type { FuncionarioPublico } from '../services/funcionarioService';
import type { Booking, BookingConflict, Room, Software, WeekdayCode } from '../types';
import {
  WEEKDAYS,
  addDays,
  bookingOccursOnDate,
  formatDateBr,
  generateOccurrences,
  startOfWeekMonday,
  timesOverlap
} from '../utils/bookingDates';

const MAX_PERIOD_DAYS = 30;
const PLANNER_START_HOUR = 7;
const PLANNER_END_HOUR = 22;

function getTodayLocal(): string {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function getCurrentTime(): string {
  const agora = new Date();
  const hora = String(agora.getHours()).padStart(2, '0');
  const minuto = String(agora.getMinutes()).padStart(2, '0');
  return `${hora}:${minuto}`;
}

function countPeriodDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const start = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.floor((end - start) / 86400000) + 1;
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function NewBooking() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [funcionarios, setFuncionarios] = useState<FuncionarioPublico[]>([]);
  const [funcionarioId, setFuncionarioId] = useState('');
  const [matricula, setMatricula] = useState('');
  const [emailResponsavel, setEmailResponsavel] = useState('');
  const [identidadeValidada, setIdentidadeValidada] = useState(false);
  const [validandoIdentidade, setValidandoIdentidade] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [selectedSoftwareIds, setSelectedSoftwareIds] = useState<string[]>([]);
  const [selectedWeekdays, setSelectedWeekdays] = useState<WeekdayCode[]>([]);
  const [error, setError] = useState('');
  const [conflicts, setConflicts] = useState<BookingConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSoftwares, setLoadingSoftwares] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [plannerWeekStart, setPlannerWeekStart] = useState(() =>
    startOfWeekMonday(getTodayLocal())
  );

  const navigate = useNavigate();
  const today = getTodayLocal();

  const maxEndDate = useMemo(
    () => (startDate ? addDays(startDate, MAX_PERIOD_DAYS - 1) : ''),
    [startDate]
  );

  const selectedOccurrences = useMemo(
    () => generateOccurrences(startDate, endDate, selectedWeekdays),
    [startDate, endDate, selectedWeekdays]
  );

  const selectedOccurrencesSet = useMemo(
    () => new Set(selectedOccurrences),
    [selectedOccurrences]
  );

  const roomBookings = useMemo(
    () => bookings.filter((booking) => booking.roomId === roomId && booking.status === 'Confirmado'),
    [bookings, roomId]
  );

  const plannerDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(plannerWeekStart, index)),
    [plannerWeekStart]
  );

  const plannerHours = useMemo(
    () =>
      Array.from(
        { length: PLANNER_END_HOUR - PLANNER_START_HOUR },
        (_, index) => PLANNER_START_HOUR + index
      ),
    []
  );

  const plannerSlots = useMemo(() => {
    if (!roomId) return { slots: [], index: new Map<string, (typeof emptySlot) & {}>() };
    const slots: Array<{
      hour: number;
      date: string;
      slotStart: string;
      slotEnd: string;
      existing?: Booking;
      selected: boolean;
      conflict: boolean;
    }> = [];
    const index = new Map<string, (typeof slots)[number]>();
    for (const hour of plannerHours) {
      const slotStart = hourLabel(hour);
      const slotEnd = hourLabel(hour + 1);
      for (const date of plannerDays) {
        const existing = getExistingBookingForSlot(date, slotStart, slotEnd);
        const selected =
          selectedOccurrencesSet.has(date) &&
          Boolean(startTime && endTime) &&
          timesOverlap(startTime, endTime, slotStart, slotEnd);
        const entry = {
          hour,
          date,
          slotStart,
          slotEnd,
          existing,
          selected,
          conflict: Boolean(existing && selected),
        };
        slots.push(entry);
        index.set(`${hour}|${date}`, entry);
      }
    }
    return { slots, index };
  }, [roomId, plannerHours, plannerDays, selectedOccurrencesSet, startTime, endTime, roomBookings]);

  const emptySlot = { existing: undefined, selected: false, conflict: false };

  const selectedSoftwareLabel = useMemo(() => {
    if (selectedSoftwareIds.length === 0) return 'Selecione os softwares necessários';
    const selected = softwares.filter((software) => selectedSoftwareIds.includes(software.id));
    if (selected.length === 1) return selected[0].name;
    if (selected.length === 2) return `${selected[0].name} + ${selected[1].name}`;
    return `${selected.length} softwares selecionados`;
  }, [selectedSoftwareIds, softwares]);

  useEffect(() => {
    Promise.all([roomService.list(), bookingService.list(), listarFuncionariosPublicos()])
      .then(([roomList, bookingList, employeeList]) => {
        setRooms(roomList);
        setBookings(bookingList);
        setFuncionarios(employeeList);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Não foi possível carregar a agenda.')
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setSelectedSoftwareIds([]);
    setSoftwares([]);

    if (!roomId) return;

    setLoadingSoftwares(true);
    softwareService
      .listByRoom(roomId)
      .then(setSoftwares)
      .catch((e) =>
        setError(
          e instanceof Error
            ? e.message
            : 'Não foi possível carregar os softwares do laboratório.'
        )
      )
      .finally(() => setLoadingSoftwares(false));
  }, [roomId]);

  function handleStartDateChange(value: string) {
    setStartDate(value);
    setConflicts([]);

    if (!value) {
      setEndDate('');
      return;
    }

    setPlannerWeekStart(startOfWeekMonday(value));
    const maximum = addDays(value, MAX_PERIOD_DAYS - 1);

    if (!endDate || endDate < value || endDate > maximum) {
      setEndDate(value);
    }
  }

  function toggleWeekday(code: WeekdayCode) {
    setSelectedWeekdays((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code]
    );
    setConflicts([]);
  }

  function toggleSoftware(id: string) {
    setSelectedSoftwareIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function getExistingBookingForSlot(date: string, slotStart: string, slotEnd: string) {
    return roomBookings.find(
      (booking) =>
        bookingOccursOnDate(booking, date) &&
        timesOverlap(booking.startTime, booking.endTime, slotStart, slotEnd)
    );
  }

  const funcionarioSelecionado = useMemo(
    () => funcionarios.find((item) => item.id === funcionarioId) || null,
    [funcionarios, funcionarioId]
  );

  async function validarIdentidade(): Promise<boolean> {
    if (!funcionarioId) {
      setError('Selecione o funcionário responsável.');
      return false;
    }
    if (!matricula.trim()) {
      setError('Digite sua matrícula.');
      return false;
    }

    try {
      setValidandoIdentidade(true);
      const funcionario = await validarFuncionario(funcionarioId, matricula);
      setEmailResponsavel(funcionario.email);
      setIdentidadeValidada(true);
      setError('');
      return true;
    } catch (error) {
      setEmailResponsavel('');
      setIdentidadeValidada(false);
      setError(error instanceof Error ? error.message : 'Não foi possível validar a matrícula.');
      return false;
    } finally {
      setValidandoIdentidade(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setConflicts([]);

    const formData = new FormData(event.currentTarget);
    const notes = String(formData.get('notes') || '').trim();

    const identidadeOk = identidadeValidada || (await validarIdentidade());
    if (!identidadeOk) return;

    if (!roomId) {
      setError('Selecione um laboratório.');
      return;
    }

    if (!startDate || !endDate) {
      setError('Informe a data inicial e a data final.');
      return;
    }

    if (startDate < today) {
      setError('Não é permitido iniciar um agendamento em uma data anterior à data atual.');
      return;
    }

    if (endDate < startDate) {
      setError('A data final deve ser igual ou posterior à data inicial.');
      return;
    }

    if (countPeriodDays(startDate, endDate) > MAX_PERIOD_DAYS) {
      setError(`O período máximo permitido é de ${MAX_PERIOD_DAYS} dias corridos.`);
      return;
    }

    if (selectedWeekdays.length === 0) {
      setError('Selecione pelo menos um dia da semana para a reserva.');
      return;
    }

    if (selectedOccurrences.length === 0) {
      setError('Os dias da semana selecionados não ocorrem dentro do período informado.');
      return;
    }

    if (!startTime || !endTime || startTime >= endTime) {
      setError('O horário final deve ser posterior ao horário inicial.');
      return;
    }

    if (selectedOccurrences.includes(today) && startTime <= getCurrentTime()) {
      setError('Para uma ocorrência de hoje, o horário inicial deve ser posterior ao horário atual.');
      return;
    }

    setSaving(true);

    try {
      const criado = await bookingService.create({
        roomId,
        startDate,
        endDate,
        weekdays: selectedWeekdays,
        startTime,
        endTime,
        employeeId: funcionarioId,
        matricula: matricula.trim(),
        responsible: funcionarioSelecionado?.nome || '',
        emailResponsible: emailResponsavel,
        softwareIds: selectedSoftwareIds,
        notes
      });

      if (criado.notificationEmailSent === false) {
        window.alert('O agendamento foi salvo, mas o e-mail de confirmação não pôde ser enviado. Verifique o e-mail cadastrado ou a cota do Apps Script.');
      }

      navigate('/agendamentos');
    } catch (e) {
      const typedError = e as Error & { conflicts?: BookingConflict[] };
      setError(typedError.message || 'Não foi possível criar o agendamento.');
      setConflicts(typedError.conflicts || []);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <span className="eyebrow">Reserva</span>
          <h1>Novo agendamento</h1>
          <p>Escolha o período, os dias da semana, o horário e visualize a ocupação no planner.</p>
        </div>
      </div>

      <form className="panel form-grid booking-form" onSubmit={submit}>
        <label>
          Laboratório
          <select
            name="roomId"
            required
            value={roomId}
            onChange={(event) => {
              setRoomId(event.target.value);
              setConflicts([]);
            }}
            disabled={loading || saving}
          >
            <option value="" disabled>
              {loading ? 'Carregando laboratórios...' : 'Selecione um laboratório'}
            </option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} — {room.location} — {room.capacity} lugares
              </option>
            ))}
          </select>
        </label>

        <div className="period-info">
          <strong>Período máximo: 30 dias corridos</strong>
          <span>Somente os dias da semana marcados serão efetivamente reservados.</span>
        </div>

        <label>
          Data inicial
          <input
            type="date"
            name="startDate"
            min={today}
            value={startDate}
            onChange={(event) => handleStartDateChange(event.target.value)}
            required
            disabled={saving}
          />
        </label>

        <label>
          Data final
          <input
            type="date"
            name="endDate"
            min={startDate || today}
            max={maxEndDate || undefined}
            value={endDate}
            onChange={(event) => {
              setEndDate(event.target.value);
              setConflicts([]);
            }}
            required
            disabled={saving || !startDate}
          />
          {startDate && maxEndDate && (
            <span className="field-hint">Data final máxima: {formatDateBr(maxEndDate)}</span>
          )}
        </label>

        <div className="full form-section">
          <div className="form-section-heading">
            <div>
              <strong>Dias da semana</strong>
              <span>Marque somente os dias em que o laboratório será utilizado.</span>
            </div>
          </div>

          <div className="weekday-selector">
            {WEEKDAYS.map((day) => {
              const active = selectedWeekdays.includes(day.code);
              return (
                <label className={`weekday-option ${active ? 'selected' : ''}`} key={day.code}>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleWeekday(day.code)}
                    disabled={saving}
                  />
                  <span className="weekday-check">{active && <Check size={14} />}</span>
                  <span>{day.short}</span>
                </label>
              );
            })}
          </div>
        </div>

        <label>
          Horário inicial
          <input
            type="time"
            name="startTime"
            value={startTime}
            onChange={(event) => {
              setStartTime(event.target.value);
              setConflicts([]);
            }}
            required
            disabled={saving}
          />
        </label>

        <label>
          Horário final
          <input
            type="time"
            name="endTime"
            value={endTime}
            onChange={(event) => {
              setEndTime(event.target.value);
              setConflicts([]);
            }}
            required
            disabled={saving}
          />
        </label>

        <label>
          Funcionário responsável
          <select
            value={funcionarioId}
            onChange={(event) => {
              setFuncionarioId(event.target.value);
              setMatricula('');
              setEmailResponsavel('');
              setIdentidadeValidada(false);
              setError('');
            }}
            required
            disabled={saving || loading}
          >
            <option value="">Selecione...</option>
            {funcionarios.map((funcionario) => (
              <option key={funcionario.id} value={funcionario.id}>{funcionario.nome}</option>
            ))}
          </select>
        </label>

        <label>
          Matrícula
          <input
            type="text"
            value={matricula}
            onChange={(event) => {
              setMatricula(event.target.value);
              setEmailResponsavel('');
              setIdentidadeValidada(false);
            }}
            onBlur={() => { if (funcionarioId && matricula.trim()) void validarIdentidade(); }}
            placeholder="Digite sua matrícula"
            autoComplete="off"
            required
            disabled={saving || !funcionarioId}
          />
          <span className="field-hint">A matrícula é validada sem informar o número correto em caso de erro.</span>
        </label>

        <label>
          E-mail
          <input
            type="email"
            value={emailResponsavel}
            readOnly
            placeholder={validandoIdentidade ? 'Validando...' : 'Preenchido após validar a matrícula'}
          />
        </label>

        <div className="full form-section">
          <div className="form-section-heading">
            <div>
              <strong>Softwares necessários</strong>
              <span>As opções são carregadas de acordo com o laboratório selecionado.</span>
            </div>
          </div>

          {!roomId ? (
            <div className="selection-placeholder">Selecione primeiro um laboratório.</div>
          ) : loadingSoftwares ? (
            <div className="selection-placeholder">Carregando softwares...</div>
          ) : softwares.length === 0 ? (
            <div className="selection-placeholder">
              Nenhum software foi cadastrado para este laboratório.
            </div>
          ) : (
            <details className="software-select-dropdown">
              <summary className="software-select-summary">
                <span>{selectedSoftwareLabel}</span>
                <ChevronDown size={18} className="software-select-chevron" />
              </summary>

              <div className="software-select-menu">
                {softwares.map((software) => {
                  const active = selectedSoftwareIds.includes(software.id);
                  return (
                    <label
                      className={`software-select-option ${active ? 'selected' : ''}`}
                      key={software.id}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleSoftware(software.id)}
                        disabled={saving}
                      />
                      <span className="software-select-check">{active && <Check size={14} />}</span>
                      <span>{software.name}</span>
                    </label>
                  );
                })}
              </div>
            </details>
          )}
        </div>

        <label className="full">
          Observações
          <textarea
            name="notes"
            rows={4}
            placeholder="Informações adicionais (opcional)"
            disabled={saving}
          />
        </label>

        {(startDate && endDate && selectedWeekdays.length > 0) && (
          <div className="full occurrence-summary">
            <div>
              <CalendarDays size={18} />
              <strong>{selectedOccurrences.length} encontro(s) no período</strong>
            </div>
            {selectedOccurrences.length > 0 ? (
              <div className="occurrence-chips">
                {selectedOccurrences.map((date) => (
                  <span key={date}>{formatDateBr(date)}</span>
                ))}
              </div>
            ) : (
              <p>Nenhuma ocorrência para os dias escolhidos.</p>
            )}
          </div>
        )}

        {error && <div className="error full">{error}</div>}

        {conflicts.length > 0 && (
          <div className="conflict-list full">
            <strong>Datas conflitantes:</strong>
            {conflicts.map((conflict, index) => (
              <span key={`${conflict.date}-${index}`}>
                {formatDateBr(conflict.date)}
                {conflict.startTime && conflict.endTime
                  ? ` — ocupado de ${conflict.startTime} às ${conflict.endTime}`
                  : ''}
              </span>
            ))}
          </div>
        )}

        <div className="actions full">
          <button type="button" className="secondary" onClick={() => navigate(-1)} disabled={saving}>
            Voltar
          </button>
          <button className="primary" type="submit" disabled={saving || loading}>
            {saving ? 'Salvando...' : 'Confirmar agendamento'}
          </button>
        </div>
      </form>

      <section className="panel planner-panel">
        <div className="planner-toolbar">
          <div>
            <span className="eyebrow">Planner</span>
            <h2>Disponibilidade do laboratório</h2>
            <p className="muted">
              {roomId
                ? 'Navegue pelas semanas para conferir horários ocupados e a sua seleção antes de reservar.'
                : 'Selecione um laboratório para visualizar a agenda.'}
            </p>
          </div>

          <div className="planner-navigation">
            <button
              type="button"
              className="secondary icon-button"
              onClick={() => setPlannerWeekStart(addDays(plannerWeekStart, -7))}
            >
              <ChevronLeft size={18} />
            </button>
            <strong>
              {formatDateBr(plannerDays[0])} – {formatDateBr(plannerDays[6])}
            </strong>
            <button
              type="button"
              className="secondary icon-button"
              onClick={() => setPlannerWeekStart(addDays(plannerWeekStart, 7))}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="planner-legend">
          <span><i className="legend-dot available" /> Disponível</span>
          <span><i className="legend-dot occupied" /> Ocupado</span>
          <span><i className="legend-dot selected" /> Sua seleção</span>
          <span><i className="legend-dot conflict" /> Conflito</span>
        </div>

        {!roomId ? (
          <div className="planner-empty">Selecione um laboratório acima para carregar o planner.</div>
        ) : loading ? (
          <div className="skeleton-grid" style={{ padding: '24px', margin: 0, borderTop: '1px solid #eef2f7' }}>
            <div className="skeleton-big" style={{ gridColumn: '1 / -1' }} />
          </div>
        ) : (
          <div className="planner-scroll">
            <div className="planner-grid">
              <div className="planner-corner">Horário</div>
              {plannerDays.map((date) => (
                <div className={`planner-day-header ${date === today ? 'today' : ''}`} key={date}>
                  <strong>{WEEKDAYS.find((item) => item.code === ['DOM','SEG','TER','QUA','QUI','SEX','SAB'][new Date(`${date}T12:00:00`).getDay()])?.short}</strong>
                  <span>{formatDateBr(date).slice(0, 5)}</span>
                </div>
              ))}

              {plannerHours.flatMap((hour) => {
                const slotStart = hourLabel(hour);
                return [
                  <div className="planner-time" key={`time-${hour}`}>{slotStart}</div>,
                  ...plannerDays.map((date) => {
                    const slot = plannerSlots.index.get(`${hour}|${date}`) || emptySlot;
                    const existing = slot.existing;
                    const selected = slot.selected;
                    const conflict = slot.conflict;

                    const className = conflict
                      ? 'conflict'
                      : selected
                        ? 'selected'
                        : existing
                          ? 'occupied'
                          : 'available';

                    return (
                      <div
                        className={`planner-slot ${className}`}
                        key={`${date}-${hour}`}
                        title={
                          existing
                            ? `Ocupado: ${existing.startTime}–${existing.endTime}`
                            : selected
                              ? `Sua seleção: ${startTime}–${endTime}`
                              : 'Disponível'
                        }
                      >
                        {existing && <span>{existing.startTime}–{existing.endTime}</span>}
                        {!existing && selected && <span>Sua seleção</span>}
                        {existing && selected && <span>Conflito</span>}
                      </div>
                    );
                  })
                ];
              })}
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
