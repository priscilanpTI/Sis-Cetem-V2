import { apiGet, apiPost, clearSessionCache } from './apiClient';
import type {
  Booking,
  BookingConflict,
  CreateBookingInput,
  Room,
  Software,
  WeekdayCode,
} from '../types';

const ALL_WEEKDAYS: WeekdayCode[] = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

type ApiBase = { sucesso: boolean; mensagem?: string };
type ApiActionResponse = ApiBase & { email_enviado?: boolean };
type ApiListResponse<T> = ApiBase & { dados?: T[] };
type ApiCreateResponse = ApiBase & {
  id?: string;
  email_enviado?: boolean;
  conflitos?: Array<{
    data?: string;
    agendamento_id?: string;
    hora_inicio?: string;
    hora_fim?: string;
  }>;
};

type ApiRoom = {
  id: string;
  nome: string;
  capacidade: number | string;
  localizacao: string;
  status: string;
};

type ApiSoftware = { id: string; nome: string; status: string };

type ApiBooking = {
  id: string;
  sala_id: string;
  data_inicio: string;
  data_fim: string;
  dias_semana?: string | string[];
  hora_inicio: string;
  hora_fim: string;
  responsavel?: string;
  email_responsavel?: string;
  softwares?: string | string[];
  observacao?: string;
  status: string;
  criado_em?: string;
  atualizado_em?: string;
};

function mapRoom(room: ApiRoom): Room {
  return {
    id: String(room.id),
    name: String(room.nome),
    capacity: Number(room.capacidade) || 0,
    location: String(room.localizacao || ''),
    status: String(room.status).toUpperCase() === 'ATIVA' ? 'Ativa' : 'Inativa',
  };
}

function mapSoftware(item: ApiSoftware): Software {
  return {
    id: String(item.id),
    name: String(item.nome),
    status: String(item.status).toUpperCase() === 'ATIVO' ? 'Ativo' : 'Inativo',
  };
}

function parseCsv(value?: string | string[]): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function parseWeekdays(value?: string | string[]): WeekdayCode[] {
  const values = parseCsv(value).map((item) => item.toUpperCase());
  const valid = values.filter((item): item is WeekdayCode =>
    ALL_WEEKDAYS.includes(item as WeekdayCode)
  );
  return valid.length ? valid : ALL_WEEKDAYS;
}

function mapBooking(item: ApiBooking): Booking {
  return {
    id: String(item.id),
    roomId: String(item.sala_id),
    startDate: String(item.data_inicio).slice(0, 10),
    endDate: String(item.data_fim).slice(0, 10),
    weekdays: parseWeekdays(item.dias_semana),
    startTime: String(item.hora_inicio).slice(0, 5),
    endTime: String(item.hora_fim).slice(0, 5),
    responsible: item.responsavel ? String(item.responsavel) : undefined,
    emailResponsible: item.email_responsavel ? String(item.email_responsavel) : undefined,
    softwareIds: parseCsv(item.softwares),
    notes: item.observacao ? String(item.observacao) : undefined,
    status: String(item.status).toUpperCase() === 'CANCELADO' ? 'Cancelado' : 'Confirmado',
    createdAt: item.criado_em ? String(item.criado_em) : undefined,
    updatedAt: item.atualizado_em ? String(item.atualizado_em) : undefined,
  };
}

function sortBookings(items: Booking[]): Booking[] {
  return [...items].sort((a, b) =>
    `${a.startDate} ${a.startTime}`.localeCompare(`${b.startDate} ${b.startTime}`)
  );
}

export const roomService = {
  async list(): Promise<Room[]> {
    const response = await apiGet<ApiListResponse<ApiRoom>>('salas', {}, {
      key: 'salas',
      ttlMs: 10 * 60 * 1000,
    });
    if (!response.sucesso) throw new Error(response.mensagem || 'Não foi possível carregar as salas.');
    return (response.dados || []).map(mapRoom).filter((item) => item.status === 'Ativa');
  },
};

export const softwareService = {
  async listAll(): Promise<Software[]> {
    const response = await apiGet<ApiListResponse<ApiSoftware>>('softwares', {}, {
      key: 'softwares',
      ttlMs: 10 * 60 * 1000,
    });
    if (!response.sucesso) throw new Error(response.mensagem || 'Não foi possível carregar os softwares.');
    return (response.dados || []).map(mapSoftware).filter((item) => item.status === 'Ativo');
  },

  async listByRoom(roomId: string): Promise<Software[]> {
    if (!roomId) return [];
    const response = await apiGet<ApiListResponse<ApiSoftware>>('softwaresPorSala', { sala_id: roomId }, {
      key: `softwares-sala:${roomId}`,
      ttlMs: 10 * 60 * 1000,
    });
    if (!response.sucesso) throw new Error(response.mensagem || 'Não foi possível carregar os softwares do laboratório.');
    return (response.dados || []).map(mapSoftware).filter((item) => item.status === 'Ativo');
  },
};

export const bookingService = {
  async list(): Promise<Booking[]> {
    const response = await apiGet<ApiListResponse<ApiBooking>>('agendamentos', {}, {
      key: 'agendamentos',
      ttlMs: 5 * 60 * 1000,
    });
    if (!response.sucesso) throw new Error(response.mensagem || 'Não foi possível carregar os agendamentos.');
    return sortBookings((response.dados || []).map(mapBooking));
  },

  async listMaster(token: string): Promise<Booking[]> {
    if (!token) throw new Error('Sessão Master não encontrada.');
    const response = await apiPost<ApiListResponse<ApiBooking>>({
      acao: 'listarAgendamentosMaster',
      token,
    });
    if (!response.sucesso) throw new Error(response.mensagem || 'Não foi possível carregar os dados do Master.');
    return sortBookings((response.dados || []).map(mapBooking));
  },

  async create(input: CreateBookingInput): Promise<Booking> {
    const response = await apiPost<ApiCreateResponse>({
      acao: 'criarAgendamento',
      funcionario_id: input.employeeId,
      matricula: input.matricula,
      sala_id: input.roomId,
      data_inicio: input.startDate,
      data_fim: input.endDate,
      dias_semana: input.weekdays,
      hora_inicio: input.startTime,
      hora_fim: input.endTime,
      softwares: input.softwareIds,
      observacao: input.notes || '',
    });

    if (!response.sucesso || !response.id) {
      const error = new Error(response.mensagem || 'Não foi possível criar o agendamento.') as Error & {
        conflicts?: BookingConflict[];
      };
      error.conflicts = (response.conflitos || []).map((item) => ({
        date: String(item.data || ''),
        bookingId: item.agendamento_id ? String(item.agendamento_id) : undefined,
        startTime: item.hora_inicio ? String(item.hora_inicio) : undefined,
        endTime: item.hora_fim ? String(item.hora_fim) : undefined,
      }));
      throw error;
    }

    clearSessionCache('agendamentos');

    return {
      id: response.id,
      roomId: input.roomId,
      startDate: input.startDate,
      endDate: input.endDate,
      weekdays: input.weekdays,
      startTime: input.startTime,
      endTime: input.endTime,
      responsible: input.responsible,
      emailResponsible: input.emailResponsible,
      softwareIds: input.softwareIds,
      notes: input.notes || '',
      status: 'Confirmado',
      createdAt: new Date().toISOString(),
      notificationEmailSent: response.email_enviado !== false,
    };
  },

  async cancel(id: string, token: string): Promise<boolean> {
    if (!token) throw new Error('Apenas o usuário Master pode cancelar agendamentos.');
    const response = await apiPost<ApiActionResponse>({ acao: 'cancelarAgendamento', id, token });
    if (!response.sucesso) throw new Error(response.mensagem || 'Não foi possível cancelar o agendamento.');
    clearSessionCache('agendamentos');
    return response.email_enviado !== false;
  },
};
