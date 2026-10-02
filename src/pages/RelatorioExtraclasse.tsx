import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { BarChart3, Clock3, Filter, ShieldCheck, Users } from 'lucide-react';
import { useMaster } from '../context/MasterContext';
import {
  listarCategoriasExtraclasse,
  listarRelatorioExtraclasse,
} from '../services/extraclasseService';
import type {
  AtividadeRelatorioExtraclasse,
  CategoriaExtraclasse,
  ResumoRelatorioExtraclasse,
} from '../services/extraclasseService';
import { listarFuncionariosPublicos } from '../services/funcionarioService';
import type { FuncionarioPublico } from '../services/funcionarioService';
import './RelatorioExtraclasse.css';

const RESUMO_VAZIO: ResumoRelatorioExtraclasse = {
  quantidadeAtividades: 0,
  quantidadeDias: 0,
  cargaHorariaTotal: 0,
};

function formatarData(valor: string): string {
  if (!valor) return '—';
  const iso = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : String(valor);
}

export default function RelatorioExtraclasse() {
  const { loading: masterLoading, isMaster, token } = useMaster();
  const [funcionarios, setFuncionarios] = useState<FuncionarioPublico[]>([]);
  const [categorias, setCategorias] = useState<CategoriaExtraclasse[]>([]);
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dados, setDados] = useState<AtividadeRelatorioExtraclasse[]>([]);
  const [resumo, setResumo] = useState<ResumoRelatorioExtraclasse>(RESUMO_VAZIO);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    Promise.all([listarFuncionariosPublicos(), listarCategoriasExtraclasse()])
      .then(([listaFuncionarios, listaCategorias]) => {
        setFuncionarios(listaFuncionarios);
        setCategorias(listaCategorias);
      })
      .catch((error) => setErro(error instanceof Error ? error.message : 'Não foi possível carregar os filtros.'));
  }, []);

  async function consultar(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!isMaster || !token) return;
    if (dataInicio && dataFim && dataInicio > dataFim) {
      setErro('A data inicial não pode ser posterior à data final.');
      return;
    }

    try {
      setCarregando(true);
      setErro('');
      const resposta = await listarRelatorioExtraclasse({
        nome: nome || undefined,
        categoria: categoria || undefined,
        data_inicio: dataInicio || undefined,
        data_fim: dataFim || undefined,
      }, token);
      setDados(resposta.dados || []);
      setResumo(resposta.resumo || RESUMO_VAZIO);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível carregar o relatório.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (isMaster && token) void consultar();
    else {
      setDados([]);
      setResumo(RESUMO_VAZIO);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMaster, token]);

  const funcionariosComAtividade = useMemo(
    () => new Set(dados.map((item) => item.matricula)).size,
    [dados]
  );

  if (masterLoading) return <div className="panel"><p className="muted">Validando sessão Master...</p></div>;

  if (!isMaster) {
    return (
      <section>
        <div className="page-header"><div><span className="eyebrow">Gestão</span><h1>Relatório Extraclasse</h1></div></div>
        <div className="panel master-required">
          <ShieldCheck size={34} />
          <div><h2>Acesso exclusivo do usuário Master</h2><p className="muted">Use a opção “Acesso Master” no menu lateral. A mesma sessão também libera cancelamento de agendamentos e o Relatório de Competências.</p></div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="page-header">
        <div><span className="eyebrow">Gestão</span><h1>Relatório Extraclasse</h1><p>Consulte as atividades registradas pelos funcionários.</p></div>
        <span className="master-badge"><ShieldCheck size={17} /> Master ativo</span>
      </div>

      {erro && <div className="error page-error">{erro}</div>}

      <div className="cards report-cards">
        <div className="card"><span>Atividades</span><strong>{resumo.quantidadeAtividades}</strong></div>
        <div className="card"><span>Funcionários</span><strong>{funcionariosComAtividade}</strong></div>
        <div className="card"><span>Dias registrados</span><strong>{resumo.quantidadeDias}</strong></div>
        <div className="card"><span>Carga horária</span><strong>{resumo.cargaHorariaTotal}h</strong></div>
      </div>

      <form className="panel report-filter" onSubmit={consultar}>
        <div className="filters-header"><div><span className="eyebrow">Consulta</span><h2><Filter size={17} /> Filtros</h2></div></div>
        <div className="filters-grid">
          <label>Funcionário<select value={nome} onChange={(e) => setNome(e.target.value)}><option value="">Todos</option>{funcionarios.map((item) => <option key={item.id} value={item.nome}>{item.nome}</option>)}</select></label>
          <label>Categoria<select value={categoria} onChange={(e) => setCategoria(e.target.value)}><option value="">Todas</option>{categorias.map((item) => <option key={item.id} value={item.categoria}>{item.categoria}</option>)}</select></label>
          <label>Data inicial<input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></label>
          <label>Data final<input type="date" min={dataInicio || undefined} value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></label>
        </div>
        <div className="actions report-actions"><button type="button" className="secondary" onClick={() => { setNome(''); setCategoria(''); setDataInicio(''); setDataFim(''); }}>Limpar</button><button className="primary" type="submit" disabled={carregando}>{carregando ? 'Consultando...' : 'Aplicar filtros'}</button></div>
      </form>

      <section className="panel report-table-panel">
        <div className="table-heading"><div><span className="eyebrow">Resultado</span><h2>{dados.length} atividade(s)</h2></div></div>
        {carregando ? <p className="muted">Carregando...</p> : dados.length === 0 ? <div className="empty">Nenhuma atividade encontrada.</div> : (
          <div className="table-wrap"><table><thead><tr><th>Funcionário</th><th>Matrícula</th><th>Período</th><th>Categoria</th><th>Dias</th><th>Carga</th><th>Descrição</th></tr></thead><tbody>{dados.map((item) => <tr key={item.id}><td><strong>{item.nome}</strong></td><td>{item.matricula}</td><td>{formatarData(item.data_inicio)} → {formatarData(item.data_fim)}</td><td>{item.categoria}</td><td>{item.qtd_dias_periodo}</td><td>{item.carga_horaria_periodo}h</td><td className="report-description">{item.descricao}</td></tr>)}</tbody></table></div>
        )}
      </section>
    </section>
  );
}
