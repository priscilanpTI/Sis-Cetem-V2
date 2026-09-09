export type RoomStatus = 'Ativa' | 'Inativa';
export type BookingStatus = 'Confirmado' | 'Cancelado';

export interface Room {
  id: string;
  name: string;
  capacity: number;
  location: string;
  status: RoomStatus;
}

export interface Booking {
  id: string;
  roomId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  responsible?: string;
  emailResponsible?: string;
  purpose: string;
  notes?: string;
  status: BookingStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBookingInput {
  roomId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  responsible: string;
  emailResponsible?: string;
  purpose: string;
  notes?: string;
}

export interface MasterSession {
  token: string;
  user: string;
}
