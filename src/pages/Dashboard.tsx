import { useEffect, useMemo, useState } from 'react';
import { bookingService, roomService, softwareService } from '../services/bookingService';
import type { Booking, Room, Software } from '../types';
import { bookingOccursOnDate, formatDateBr } from '../utils/bookingDates';

function getTodayLocal(): string {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function Dashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([bookingService.list(), roomService.list(), softwareService.listAll()])
      .then(([bookingList, roomList, softwareList]) => {
        setBookings(bookingList);
        setRooms(roomList);
        setSoftwares(softwareList);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Não foi possível carregar o dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  const today = getTodayLocal();

  const todayBookings = useMemo(
    () => bookings.filter((booking) => bookingOccursOnDate(booking, today)),
    [bookings, today]
  );

  const occupied = new Set(todayBookings.map((booking) => booking.roomId)).size;
  const softwareNames = useMemo(() => new Map(softwares.map((item) => [item.id, item.name])), [softwares]);

  if (loading) {
    return (
      <section>
        <div className="skeleton-grid">
          <div className="skeleton-card"><div className="skeleton-line short" /><div className="skeleton-line" /></div>
          <div className="skeleton-card"><div className="skeleton-line short" /><div className="skeleton-line" /></div>
          <div className="skeleton-card"><div className="skeleton-line short" /><div className="skeleton-line" /></div>
          <div className="skeleton-card"><div className="skeleton-line short" /><div className="skeleton-line" /></div>
        </div>
        <div className="skeleton-big" />
      </section>
    );
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <span className="eyebrow">Visão geral</span>
          <h1>Dashboard</h1>
          <p>Acompanhe rapidamente a utilização dos laboratórios em {formatDateBr(today)}.</p>
        </div>
      </div>

      {error && <div className="error page-error">{error}</div>}

      <div className="cards">
        <article className="card"><span>Laboratórios cadastrados</span><strong>{rooms.length}</strong></article>
        <article className="card"><span>Reservas ativas hoje</span><strong>{todayBookings.length}</strong></article>
        <article className="card"><span>Laboratórios ocupados hoje</span><strong>{occupied}</strong></article>
        <article className="card"><span>Laboratórios livres hoje</span><strong>{Math.max(rooms.length - occupied, 0)}</strong></article>
      </div>

      <div className="panel">
        <h2>Reservas efetivas de hoje</h2>
        {todayBookings.length === 0 ? (
          <p className="muted">Nenhum agendamento confirmado ocorre hoje.</p>
        ) : (
          <div className="booking-list">
            {todayBookings.map((booking) => {
              const room = rooms.find((item) => item.id === booking.roomId);
              const softwareList = booking.softwareIds.map((id) => softwareNames.get(id) || id).join(', ');
              return (
                <div className="booking-row" key={booking.id}>
                  <div>
                    <strong>{room?.name || booking.roomId}</strong>
                    <span>{softwareList ? `Softwares: ${softwareList}` : 'Nenhum software informado'}</span>
                  </div>
                  <div>{booking.startTime} – {booking.endTime}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
