import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingService, roomService } from '../services/bookingService';
import type { Room } from '../types';

const MAX_PERIOD_DAYS = 30;

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

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

function countPeriodDays(startDate: string, endDate: string): number {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

  const start = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);

  return Math.floor((end - start) / 86400000) + 1;
}

export function NewBooking() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const navigate = useNavigate();
  const today = getTodayLocal();

  const maxEndDate = useMemo(
    () => (startDate ? addDays(startDate, MAX_PERIOD_DAYS - 1) : ''),
    [startDate]
  );

  useEffect(() => {
    roomService
      .list()
      .then(setRooms)
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Não foi possível carregar as salas.')
      )
      .finally(() => setLoadingRooms(false));
  }, []);

  function handleStartDateChange(value: string) {
    setStartDate(value);

    if (!value) {
      setEndDate('');
      return;
    }

    const maximum = addDays(value, MAX_PERIOD_DAYS - 1);

    if (endDate && (endDate < value || endDate > maximum)) {
      setEndDate('');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const formData = new FormData(event.currentTarget);

    const roomId = String(formData.get('roomId') || '');
    const selectedStartDate = String(formData.get('startDate') || '');
    const selectedEndDate = String(formData.get('endDate') || '');
    const startTime = String(formData.get('startTime') || '');
    const endTime = String(formData.get('endTime') || '');
    const responsible = String(formData.get('responsible') || '');
    const emailResponsible = String(formData.get('emailResponsible') || '');
    const purpose = String(formData.get('purpose') || '');
    const notes = String(formData.get('notes') || '');

    if (selectedStartDate < today) {
      setError('Não é permitido iniciar um agendamento em uma data anterior à data atual.');
      return;
    }

    if (selectedEndDate < selectedStartDate) {
      setError('A data final deve ser igual ou posterior à data inicial.');
      return;
    }

    const periodDays = countPeriodDays(selectedStartDate, selectedEndDate);

    if (periodDays > MAX_PERIOD_DAYS) {
      setError(`O período máximo permitido é de ${MAX_PERIOD_DAYS} dias corridos.`);
      return;
    }

    if (startTime >= endTime) {
      setError('O horário final deve ser posterior ao horário inicial.');
      return;
    }

    if (selectedStartDate === today) {
      const currentTime = getCurrentTime();

      if (startTime <= currentTime) {
        setError(
          'Para períodos que começam hoje, o horário inicial deve ser posterior ao horário atual.'
        );
        return;
      }
    }

    setSaving(true);

    try {
      await bookingService.create({
        roomId,
        startDate: selectedStartDate,
        endDate: selectedEndDate,
        startTime,
        endTime,
        responsible,
        emailResponsible,
        purpose,
        notes
      });

      navigate('/agendamentos');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível criar o agendamento.');
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
          <p>Reserve uma sala por um período contínuo de até 30 dias.</p>
        </div>
      </div>

      <form className="panel form-grid" onSubmit={submit}>
        <label>
          Sala
          <select name="roomId" required defaultValue="" disabled={loadingRooms || saving}>
            <option value="" disabled>
              {loadingRooms ? 'Carregando salas...' : 'Selecione uma sala'}
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
          <span>
            As datas inicial e final contam no limite. Ex.: 01/09 a 30/09 = 30 dias.
          </span>
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
            onChange={(event) => setEndDate(event.target.value)}
            required
            disabled={saving || !startDate}
          />
          {startDate && maxEndDate && (
            <span className="field-hint">Data final máxima: {maxEndDate.split('-').reverse().join('/')}</span>
          )}
        </label>

        <label>
          Horário inicial
          <input type="time" name="startTime" required disabled={saving} />
        </label>

        <label>
          Horário final
          <input type="time" name="endTime" required disabled={saving} />
        </label>

        <label>
          Responsável
          <input name="responsible" placeholder="Nome do responsável" required disabled={saving} />
        </label>

        <label>
          E-mail do responsável
          <input
            type="email"
            name="emailResponsible"
            placeholder="nome@empresa.com.br"
            disabled={saving}
          />
        </label>

        <label className="full">
          Finalidade
          <input name="purpose" placeholder="Ex.: Aula de Redes" required disabled={saving} />
        </label>

        <label className="full">
          Observações
          <textarea
            name="notes"
            rows={4}
            placeholder="Informações adicionais (opcional)"
            disabled={saving}
          />
        </label>

        {error && <div className="error full">{error}</div>}

        <div className="actions full">
          <button type="button" className="secondary" onClick={() => navigate(-1)} disabled={saving}>
            Voltar
          </button>
          <button className="primary" type="submit" disabled={saving || loadingRooms}>
            {saving ? 'Salvando...' : 'Confirmar agendamento'}
          </button>
        </div>
      </form>
    </section>
  );
}
