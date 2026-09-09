import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { bookingService, roomService } from '../services/bookingService';
import type { Booking, Room } from '../types';

export function Dashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([bookingService.list(), roomService.list()])
      .then(([bookingList, roomList]) => {
        setBookings(bookingList);
        setRooms(roomList);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Não foi possível carregar o dashboard.')
      )
      .finally(() => setLoading(false));
  }, []);

  const today = format(new Date(), 'yyyy-MM-dd');

  const todayBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          booking.status === 'Confirmado' &&
          booking.startDate <= today &&
          booking.endDate >= today
      ),
    [bookings, today]
  );

  const occupied = new Set(todayBookings.map((booking) => booking.roomId)).size;

  if (loading) {
    return (
      <section>
        <div className="panel">
          <p className="muted">Carregando dashboard...</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <span className="eyebrow">Visão geral</span>
          <h1>Dashboard</h1>
          <p>Acompanhe rapidamente a utilização das salas.</p>
        </div>
      </div>

      {error && <div className="error page-error">{error}</div>}

      <div className="cards">
        <article className="card"><span>Salas cadastradas</span><strong>{rooms.length}</strong></article>
        <article className="card"><span>Reservas ativas hoje</span><strong>{todayBookings.length}</strong></article>
        <article className="card"><span>Salas ocupadas hoje</span><strong>{occupied}</strong></article>
        <article className="card"><span>Salas livres hoje</span><strong>{Math.max(rooms.length - occupied, 0)}</strong></article>
      </div>

      <div className="panel">
        <h2>Reservas vigentes hoje</h2>
        {todayBookings.length === 0 ? (
          <p className="muted">Nenhum agendamento confirmado abrange a data de hoje.</p>
        ) : (
          <div className="booking-list">
            {todayBookings.map((booking) => {
              const room = rooms.find((item) => item.id === booking.roomId);
              return (
                <div className="booking-row" key={booking.id}>
                  <div>
                    <strong>{room?.name || booking.roomId}</strong>
                    <span>{booking.purpose}</span>
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
