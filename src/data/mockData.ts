import type { Booking, Room } from '../types';

export const initialRooms: Room[] = [
  { id: 'sala-01', name: 'Laboratório 01', capacity: 20, location: 'Bloco A', status: 'Ativa' },
  { id: 'sala-02', name: 'Laboratório 02', capacity: 25, location: 'Bloco A', status: 'Ativa' },
  { id: 'sala-03', name: 'Sala 105', capacity: 30, location: 'Bloco B', status: 'Ativa' },
  { id: 'sala-04', name: 'Sala Multimídia', capacity: 40, location: 'Bloco B', status: 'Ativa' }
];

export const initialBookings: Booking[] = [];
