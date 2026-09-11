import type {
  Booking,
  BookingConflict,
  CreateBookingInput,
  MasterSession,
  Room,
  Software,
  WeekdayCode
} from '../types';

const API_URL = import.meta.env.VITE_APPS_SCRIPT_URL?.trim();

const MASTER_TOKEN_KEY = 'agenda-salas-master-token';
const MASTER_USER_KEY = 'agenda-salas-master-user';

const ALL_WEEKDAYS: WeekdayCode[] = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

type ApiBase = {
  sucesso: boolean;
  mensagem?: string;
};

type ApiListResponse<T> = ApiBase & {
  dados?: T[];
};

type ApiCreateResponse = ApiBase & {
  id?: string;
  conflitos?: Array<{
    data?: string;
    agendamento_id?: string;
    hora_inicio?: string;
    hora_fim?: string;
  }>;
};

type ApiLoginResponse = ApiBase & {
  token?: string;
  usuario?: string;
  validadeSegundos?: number;
};

type ApiSessionResponse = ApiBase & {
  autenticado?: boolean;
};

type ApiRoom = {
  id: string;
  nome: string;
  capacidade: number | string;
  localizacao: string;
  status: string;
};

type ApiSoftware = {
  id: string;
  nome: string;
  status: string;
};

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

function getApiUrl(): string {
  if (!API_URL) {
    throw new Error(
      'A URL da API não foi configurada. Defina VITE_APPS_SCRIPT_URL no arquivo .env.'
    );
  }

  return API_URL;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Falha de comunicação com a API (${response.status}).`);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error('A API retornou uma resposta inválida.');
  }
}

async function get<T>(
  acao: string,
  params: Record<string, string> = {}
): Promise<ApiListResponse<T>> {
  const url = new URL(getApiUrl());
  url.searchParams.set('acao', acao);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set('_', String(Date.now()));

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    redirect: 'follow'
  });

  return parseResponse<ApiListResponse<T>>(response);
}

async function post<T extends ApiBase>(payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(getApiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload),
    redirect: 'follow'
  });

  return parseResponse<T>(response);
}

function mapRoom(room: ApiRoom): Room {
  return {
    id: String(room.id),
    name: String(room.nome),
    capacity: Number(room.capacidade) || 0,
    location: String(room.localizacao || ''),
    status: String(room.status).toUpperCase() === 'ATIVA' ? 'Ativa' : 'Inativa'
  };
}

function mapSoftware(software: ApiSoftware): Software {
  return {
    id: String(software.id),
    name: String(software.nome),
    status: String(software.status).toUpperCase() === 'ATIVO' ? 'Ativo' : 'Inativo'
  };
}

function parseCsv(value?: string | string[]): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseWeekdays(value?: string | string[]): WeekdayCode[] {
  const values = parseCsv(value).map((item) => item.toUpperCase());
  const valid = values.filter((item): item is WeekdayCode =>
    ALL_WEEKDAYS.includes(item as WeekdayCode)
  );

  return valid.length > 0 ? valid : ALL_WEEKDAYS;
}

function mapBooking(booking: ApiBooking): Booking {
  return {
    id: String(booking.id),
    roomId: String(booking.sala_id),
    startDate: String(booking.data_inicio).slice(0, 10),
    endDate: String(booking.data_fim).slice(0, 10),
    weekdays: parseWeekdays(booking.dias_semana),
    startTime: String(booking.hora_inicio).slice(0, 5),
    endTime: String(booking.hora_fim).slice(0, 5),
    responsible: booking.responsavel ? String(booking.responsavel) : undefined,
    emailResponsible: booking.email_responsavel
      ? String(booking.email_responsavel)
      : undefined,
    softwareIds: parseCsv(booking.softwares),
    notes: booking.observacao ? String(booking.observacao) : undefined,
    status:
      String(booking.status).toUpperCase() === 'CANCELADO'
        ? 'Cancelado'
        : 'Confirmado',
    createdAt: booking.criado_em ? String(booking.criado_em) : undefined,
    updatedAt: booking.atualizado_em ? String(booking.atualizado_em) : undefined
  };
}

function sortBookings(bookings: Booking[]): Booking[] {
  return [...bookings].sort((a, b) =>
    `${a.startDate} ${a.startTime}`.localeCompare(`${b.startDate} ${b.startTime}`)
  );
}

function getStoredToken(): string {
  return sessionStorage.getItem(MASTER_TOKEN_KEY) || '';
}

function getStoredUser(): string {
  return sessionStorage.getItem(MASTER_USER_KEY) || '';
}

function saveSession(session: MasterSession): void {
  sessionStorage.setItem(MASTER_TOKEN_KEY, session.token);
  sessionStorage.setItem(MASTER_USER_KEY, session.user);
}

function clearSession(): void {
  sessionStorage.removeItem(MASTER_TOKEN_KEY);
  sessionStorage.removeItem(MASTER_USER_KEY);
}

export const roomService = {
  async list(): Promise<Room[]> {
    const result = await get<ApiRoom>('salas');

    if (!result.sucesso) {
      throw new Error(result.mensagem || 'Não foi possível carregar as salas.');
    }

    return (result.dados || []).map(mapRoom).filter((room) => room.status === 'Ativa');
  }
};

export const softwareService = {
  async listAll(): Promise<Software[]> {
    const result = await get<ApiSoftware>('softwares');

    if (!result.sucesso) {
      throw new Error(result.mensagem || 'Não foi possível carregar os softwares.');
    }

    return (result.dados || []).map(mapSoftware).filter((item) => item.status === 'Ativo');
  },

  async listByRoom(roomId: string): Promise<Software[]> {
    if (!roomId) return [];

    const result = await get<ApiSoftware>('softwaresPorSala', { sala_id: roomId });

    if (!result.sucesso) {
      throw new Error(result.mensagem || 'Não foi possível carregar os softwares do laboratório.');
    }

    return (result.dados || []).map(mapSoftware).filter((item) => item.status === 'Ativo');
  }
};

export const bookingService = {
  async list(): Promise<Booking[]> {
    const result = await get<ApiBooking>('agendamentos');

    if (!result.sucesso) {
      throw new Error(result.mensagem || 'Não foi possível carregar os agendamentos.');
    }

    return sortBookings((result.dados || []).map(mapBooking));
  },

  async listMaster(): Promise<Booking[]> {
    const token = getStoredToken();

    if (!token) {
      throw new Error('Sessão Master não encontrada. Faça login novamente.');
    }

    const result = await post<ApiListResponse<ApiBooking>>({
      acao: 'listarAgendamentosMaster',
      token
    });

    if (!result.sucesso) {
      if ((result.mensagem || '').toLowerCase().includes('sessão')) {
        clearSession();
      }

      throw new Error(result.mensagem || 'Não foi possível carregar os dados do Master.');
    }

    return sortBookings((result.dados || []).map(mapBooking));
  },

  async create(input: CreateBookingInput): Promise<Booking> {
    const result = await post<ApiCreateResponse>({
      acao: 'criarAgendamento',
      sala_id: input.roomId,
      data_inicio: input.startDate,
      data_fim: input.endDate,
      dias_semana: input.weekdays,
      hora_inicio: input.startTime,
      hora_fim: input.endTime,
      responsavel: input.responsible,
      email_responsavel: input.emailResponsible || '',
      softwares: input.softwareIds,
      observacao: input.notes || ''
    });

    if (!result.sucesso || !result.id) {
      const error = new Error(result.mensagem || 'Não foi possível criar o agendamento.') as Error & {
        conflicts?: BookingConflict[];
      };

      error.conflicts = (result.conflitos || []).map((item) => ({
        date: String(item.data || ''),
        bookingId: item.agendamento_id ? String(item.agendamento_id) : undefined,
        startTime: item.hora_inicio ? String(item.hora_inicio) : undefined,
        endTime: item.hora_fim ? String(item.hora_fim) : undefined
      }));

      throw error;
    }

    return {
      id: result.id,
      roomId: input.roomId,
      startDate: input.startDate,
      endDate: input.endDate,
      weekdays: input.weekdays,
      startTime: input.startTime,
      endTime: input.endTime,
      responsible: input.responsible,
      emailResponsible: input.emailResponsible || '',
      softwareIds: input.softwareIds,
      notes: input.notes || '',
      status: 'Confirmado',
      createdAt: new Date().toISOString()
    };
  },

  async cancel(id: string): Promise<void> {
    const token = getStoredToken();

    if (!token) {
      throw new Error('Apenas o usuário Master pode cancelar agendamentos.');
    }

    const result = await post<ApiBase>({
      acao: 'cancelarAgendamento',
      id,
      token
    });

    if (!result.sucesso) {
      if (
        (result.mensagem || '').toLowerCase().includes('master') ||
        (result.mensagem || '').toLowerCase().includes('sessão')
      ) {
        clearSession();
      }

      throw new Error(result.mensagem || 'Não foi possível cancelar o agendamento.');
    }
  }
};

export const masterService = {
  getToken(): string {
    return getStoredToken();
  },

  getUser(): string {
    return getStoredUser();
  },

  hasStoredSession(): boolean {
    return Boolean(getStoredToken());
  },

  async login(usuario: string, senha: string): Promise<MasterSession> {
    const result = await post<ApiLoginResponse>({
      acao: 'loginMaster',
      usuario,
      senha
    });

    if (!result.sucesso || !result.token || !result.usuario) {
      throw new Error(result.mensagem || 'Não foi possível realizar o login Master.');
    }

    const session: MasterSession = {
      token: result.token,
      user: result.usuario
    };

    saveSession(session);
    return session;
  },

  async validate(): Promise<boolean> {
    const token = getStoredToken();

    if (!token) return false;

    try {
      const result = await post<ApiSessionResponse>({
        acao: 'validarSessaoMaster',
        token
      });

      const valid = Boolean(result.sucesso && result.autenticado);
      if (!valid) clearSession();
      return valid;
    } catch {
      return false;
    }
  },

  async logout(): Promise<void> {
    const token = getStoredToken();

    try {
      if (token) {
        await post<ApiBase>({
          acao: 'logoutMaster',
          token
        });
      }
    } finally {
      clearSession();
    }
  }
};
