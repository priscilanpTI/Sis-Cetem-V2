import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { BarChart3, BookOpen, CheckCircle2, Download, Filter, History, Search, ShieldCheck, Users, X, XCircle, AlertTriangle } from 'lucide-react';
import { useMaster } from '../context/MasterContext';
import {
  consultarHistoricoCompetenciaApi,
  consultarRelatorioCompetenciasApi,
  obterFiltrosRelatorioCompetenciasApi,
} from '../services/relatorioCompetenciasService';
import type {
  CompetenciaRelatorio,
  FiltrosDisponiveis,
  HistoricoCompetencia,
  IndicadoresRelatorio,
  StatusCompetenciaRelatorio,
} from '../services/relatorioCompetenciasService';
import './RelatorioCompetencias.css';

const VAZIO: IndicadoresRelatorio = { total_registros: 0, funcionarios: 0, aptos: 0, parcialmente_aptos: 0, inaptos: 0 };

function formatarDataHora(valor: string): string {
  if (!valor) return '—';
  const data = new Date(valor);
  if (!Number.isNaN(data.getTime())) return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
  const iso = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : valor;
}

function rotuloStatus(status: string): string {
  if (status === 'APTO') return 'Apto';
  if (status === 'PARCIALMENTE_APTO') return 'Parcialmente apto';
  if (status === 'INAPTO') return 'Não apto';
  return status || '—';
}

function classeStatus(status: string): string {
  if (status === 'APTO') return 'rc-status rc-status-apto';
  if (status === 'PARCIALMENTE_APTO') return 'rc-status rc-status-parcial';
  return 'rc-status rc-status-inapto';
}

function escaparCsv(valor: unknown): string {
  return `"${String(valor ?? '').replace(/"/g, '""')}"`;
}

export default function RelatorioCompetencias() {
  const { loading: masterLoading, isMaster, token } = useMaster();
  const [filtros, setFiltros] = useState<FiltrosDisponiveis | null>(null);
  const [matricula, setMatricula] = useState('');
  const [areaId, setAreaId] = useState('');
  const [ucId, setUcId] = useState('');
  const [status, setStatus] = useState<StatusCompetenciaRelatorio[]>(['APTO', 'PARCIALMENTE_APTO', 'INAPTO']);
  const [dados, setDados] = useState<CompetenciaRelatorio[]>([]);
  const [indicadores, setIndicadores] = useState<IndicadoresRelatorio>(VAZIO);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [historico, setHistorico] = useState<HistoricoCompetencia[]>([]);
  const [historicoTitulo, setHistoricoTitulo] = useState('');
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  async function carregar(filtrosConsulta = {}) {
    if (!token) return;
    try {
      setCarregando(true);
      setErro('');
      const resposta = await consultarRelatorioCompetenciasApi(token, filtrosConsulta);
      setDados(resposta.dados || []);
      setIndicadores(resposta.indicadores || VAZIO);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível carregar o relatório.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (!isMaster || !token) {
      setFiltros(null);
      setDados([]);
      setIndicadores(VAZIO);
      return;
    }

    Promise.all([
      obterFiltrosRelatorioCompetenciasApi(token),
      consultarRelatorioCompetenciasApi(token, {}),
    ])
      .then(([opcoes, relatorio]) => {
        setFiltros(opcoes);
        setDados(relatorio.dados || []);
        setIndicadores(relatorio.indicadores || VAZIO);
      })
      .catch((error) => setErro(error instanceof Error ? error.message : 'Não foi possível iniciar o relatório.'));
  }, [isMaster, token]);

  function alternarStatus(valor: StatusCompetenciaRelatorio) {
    setStatus((atuais) => atuais.includes(valor) ? atuais.filter((item) => item !== valor) : [...atuais, valor]);
  }

  async function consultar(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!status.length) return setErro('Selecione pelo menos uma situação de competência.');
    await carregar({
      matricula: matricula || undefined,
      area_id: areaId || undefined,
      uc_id: ucId || undefined,
      status: status.length === 3 ? undefined : status,
    });
  }

  async function limpar() {
    setMatricula('');
    setAreaId('');
    setUcId('');
    setStatus(['APTO', 'PARCIALMENTE_APTO', 'INAPTO']);
    await carregar({});
  }

  async function abrirHistorico(item: CompetenciaRelatorio) {
    try {
      setHistoricoAberto(true);
      setHistoricoTitulo(`${item.funcionario} — ${item.unidade_curricular}`);
      setCarregandoHistorico(true);
      const resposta = await consultarHistoricoCompetenciaApi(token, item.competencia_id);
      setHistorico(resposta.dados || []);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível carregar o histórico.');
      setHistoricoAberto(false);
    } finally {
      setCarregandoHistorico(false);
    }
  }

  function exportarCsv() {
    if (!dados.length) return;
    const linhas = [
      ['Funcionário', 'Matrícula', 'Curso(s)', 'Unidade Curricular', 'Situação', 'Atualização'],
      ...dados.map((item) => [item.funcionario, item.matricula, item.areas.map((area) => area.area).join(' | '), item.unidade_curricular, rotuloStatus(item.status_competencia), formatarDataHora(item.ultima_atualizacao)]),
    ];
    const csv = '\uFEFF' + linhas.map((linha) => linha.map(escaparCsv).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-competencias-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const funcionarioSelecionado = useMemo(() => filtros?.funcionarios.find((item) => item.matricula === matricula), [filtros, matricula]);

  if (masterLoading) return <div className="rc-page"><div className="rc-loading">Validando sessão Master...</div></div>;
  if (!isMaster) return <div className="rc-page"><div className="panel master-required"><ShieldCheck size={34} /><div><h2>Acesso exclusivo do usuário Master</h2><p className="muted">Faça login uma única vez pela opção “Acesso Master” no menu lateral.</p></div></div></div>;

  return (
    <div className="rc-page"><div className="rc-container">
      <header className="rc-header"><div><span className="rc-eyebrow">GESTÃO DOCENTE</span><h1>Relatório do Mapa de Competências</h1><p>Consulte instrutores por curso, unidade curricular e nível de aptidão.</p></div><div className="rc-header-actions"><button type="button" className="rc-secondary-btn" onClick={exportarCsv} disabled={!dados.length}><Download size={17} /> Exportar CSV</button><span className="master-badge"><ShieldCheck size={17} /> Master ativo</span></div></header>
      {erro && <div className="rc-alert rc-alert-error">{erro}</div>}

      <section className="rc-indicators">
        <article className="rc-indicator"><div className="rc-indicator-icon"><Users size={21} /></div><div><span>Instrutores</span><strong>{indicadores.funcionarios}</strong></div></article>
        <article className="rc-indicator"><div className="rc-indicator-icon"><BookOpen size={21} /></div><div><span>Competências</span><strong>{indicadores.total_registros}</strong></div></article>
        <article className="rc-indicator rc-indicator-apto"><div className="rc-indicator-icon"><CheckCircle2 size={21} /></div><div><span>Aptos</span><strong>{indicadores.aptos}</strong></div></article>
        <article className="rc-indicator rc-indicator-parcial"><div className="rc-indicator-icon"><AlertTriangle size={21} /></div><div><span>Parcialmente aptos</span><strong>{indicadores.parcialmente_aptos}</strong></div></article>
        <article className="rc-indicator rc-indicator-inapto"><div className="rc-indicator-icon"><XCircle size={21} /></div><div><span>Não aptos</span><strong>{indicadores.inaptos}</strong></div></article>
      </section>

      <form className="rc-filter-card" onSubmit={consultar}>
        <div className="rc-section-title"><div><Filter size={19} /><h2>Filtros</h2></div><span>Os cursos refletem os cursos efetivamente marcados pelo instrutor.</span></div>
        <div className="rc-filter-grid">
          <label className="rc-field"><span>Funcionário / Instrutor</span><select value={matricula} onChange={(e) => setMatricula(e.target.value)}><option value="">Todos</option>{filtros?.funcionarios.map((item) => <option key={item.matricula} value={item.matricula}>{item.nome}</option>)}</select>{funcionarioSelecionado && <small>Matrícula: {funcionarioSelecionado.matricula}</small>}</label>
          <label className="rc-field"><span>Curso</span><select value={areaId} onChange={(e) => setAreaId(e.target.value)}><option value="">Todos</option>{filtros?.areas.map((item) => <option key={item.id} value={item.id}>{item.area}</option>)}</select></label>
          <label className="rc-field"><span>Unidade Curricular</span><select value={ucId} onChange={(e) => setUcId(e.target.value)}><option value="">Todas</option>{filtros?.unidades_curriculares.map((item) => <option key={item.id} value={item.id}>{item.unidade_curricular}</option>)}</select></label>
        </div>
        <div className="rc-status-filter"><span>Situação da competência</span><div className="rc-checkboxes"><label><input type="checkbox" checked={status.includes('APTO')} onChange={() => alternarStatus('APTO')} /><span className="rc-dot rc-dot-apto" /> Apto</label><label><input type="checkbox" checked={status.includes('PARCIALMENTE_APTO')} onChange={() => alternarStatus('PARCIALMENTE_APTO')} /><span className="rc-dot rc-dot-parcial" /> Parcialmente apto</label><label><input type="checkbox" checked={status.includes('INAPTO')} onChange={() => alternarStatus('INAPTO')} /><span className="rc-dot rc-dot-inapto" /> Não apto</label></div></div>
        <div className="rc-filter-actions"><button type="button" className="rc-secondary-btn" onClick={limpar}>Limpar filtros</button><button type="submit" className="rc-primary-btn" disabled={carregando}><Search size={17} /> {carregando ? 'Consultando...' : 'Aplicar filtros'}</button></div>
      </form>

      <section className="rc-results-card"><div className="rc-section-title"><div><BarChart3 size={19} /><h2>Resultado</h2></div><span>{dados.length} registro(s).</span></div>{carregando ? <div className="rc-loading">Carregando relatório...</div> : !dados.length ? <div className="rc-empty">Nenhuma competência encontrada.</div> : <div className="rc-table-wrap"><table className="rc-table"><thead><tr><th>Funcionário</th><th>Matrícula</th><th>Curso(s)</th><th>Unidade Curricular</th><th>Situação</th><th>Atualização</th><th /></tr></thead><tbody>{dados.map((item) => <tr key={item.competencia_id}><td><strong>{item.funcionario}</strong></td><td>{item.matricula}</td><td><div className="rc-area-list">{item.areas.length ? item.areas.map((area) => <span key={area.id}>{area.area}</span>) : '—'}</div></td><td>{item.unidade_curricular}</td><td><span className={classeStatus(item.status_competencia)}>{rotuloStatus(item.status_competencia)}</span></td><td>{formatarDataHora(item.ultima_atualizacao)}</td><td><button type="button" className="rc-icon-btn" onClick={() => abrirHistorico(item)} title="Ver histórico"><History size={17} /></button></td></tr>)}</tbody></table></div>}</section>
    </div>

    {historicoAberto && <div className="rc-modal-backdrop"><div className="rc-modal" role="dialog" aria-modal="true"><div className="rc-modal-header"><div><span className="rc-eyebrow">HISTÓRICO</span><h2>{historicoTitulo}</h2></div><button type="button" className="rc-icon-btn" onClick={() => setHistoricoAberto(false)}><X size={19} /></button></div>{carregandoHistorico ? <div className="rc-loading">Carregando...</div> : !historico.length ? <div className="rc-empty">Nenhum histórico encontrado.</div> : <div className="rc-history-list">{historico.map((item) => <article className="rc-history-item" key={item.id}><div className="rc-history-date">{formatarDataHora(item.data_hora)}</div><div className="rc-history-change">{item.status_anterior && <><span className={classeStatus(item.status_anterior)}>{rotuloStatus(item.status_anterior)}</span><span>→</span></>}<span className={classeStatus(item.status_novo)}>{rotuloStatus(item.status_novo)}</span></div><div className="rc-history-text"><strong>Motivo:</strong> {item.motivo || '—'}</div>{item.justificativa && <div className="rc-history-text"><strong>Justificativa:</strong> {item.justificativa}</div>}</article>)}</div>}</div></div>}
    </div>
  );
}
