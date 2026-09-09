import type { Booking, CreateBookingInput, Room } from '../types';

const API_URL = 'COLE_AQUI_A_URL_DO_SEU_APPS_SCRIPT';

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Falha de comunicação com o serviço.');
  return response.json() as Promise<T>;
}

async function postJson<T>(payload: unknown): Promise<T> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('Falha de comunicação com o serviço.');
  return response.json() as Promise<T>;
}

export const roomService = {
  list: () => getJson<Room[]>(`${API_URL}?action=rooms`)
};

export const bookingService = {
  list: () => getJson<Booking[]>(`${API_URL}?action=bookings`),
  async create(input: CreateBookingInput): Promise<Booking> {
    const result = await postJson<{ ok: boolean; booking?: Booking; error?: string }>({ action: 'createBooking', data: input });
    if (!result.ok || !result.booking) throw new Error(result.error || 'Não foi possível criar o agendamento.');
    return result.booking;
  },
  async cancel(id: string): Promise<void> {
    const result = await postJson<{ ok: boolean; error?: string }>({ action: 'cancelBooking', id });
    if (!result.ok) throw new Error(result.error || 'Não foi possível cancelar o agendamento.');
  }
};
