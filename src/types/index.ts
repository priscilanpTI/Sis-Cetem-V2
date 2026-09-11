export type RoomStatus = 'Ativa' | 'Inativa';
export type BookingStatus = 'Confirmado' | 'Cancelado';
export type WeekdayCode = 'DOM' | 'SEG' | 'TER' | 'QUA' | 'QUI' | 'SEX' | 'SAB';

export interface Room {
  id: string;
  name: string;
  capacity: number;
  location: string;
  status: RoomStatus;
}

export interface Software {
  id: string;
  name: string;
  status: 'Ativo' | 'Inativo';
}

export interface Booking {
  id: string;
  roomId: string;
  startDate: string;
  endDate: string;
  weekdays: WeekdayCode[];
  startTime: string;
  endTime: string;
  responsible?: string;
  emailResponsible?: string;
  softwareIds: string[];
  notes?: string;
  status: BookingStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBookingInput {
  roomId: string;
  startDate: string;
  endDate: string;
  weekdays: WeekdayCode[];
  startTime: string;
  endTime: string;
  responsible: string;
  emailResponsible?: string;
  softwareIds: string[];
  notes?: string;
}

export interface BookingConflict {
  date: string;
  bookingId?: string;
  startTime?: string;
  endTime?: string;
}

export interface MasterSession {
  token: string;
  user: string;
}
