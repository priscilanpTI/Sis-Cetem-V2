import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Search, ShieldCheck, X } from 'lucide-react';
import {
  obterDadosFuncionarioMapa,
  obterDadosIniciaisMapa,
  salvarMapaCompetenciasApi,
} from '../services/mapaCompetenciasService';
import type {
  CompetenciaAtual,
  DadosIniciaisMapa,
  MotivoAlteracao,
  StatusCompetencia,
} from '../services/mapaCompetenciasService';
import './MapaCompetencias.css';

type CompetenciaTela = {
  uc_id: string;
  codigo: string;
  unidade_curricular: string;
  status_competencia: StatusCompetencia;
  status_original: StatusCompetencia;
  respondida: boolean;
  primeira_resposta: string;
  ultima_atualizacao: string;
  motivo_id: string;
  justificativa: string;
};

function formatarData(data: string): string {
  if (!data) return '';
  const iso = data.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : data;
}

export default function MapaCompetencias() {
  const [dados, setDados] = useState<DadosIniciaisMapa | null>(null);
  const [funcionarioId, setFuncionarioId] = useState('');
  const [matricula, setMatricula] = useState('');
  const [email, setEmail] = useState('');
  const [identidadeValidada, setIdentidadeValidada] = useState(false);
  const [validandoIdentidade, setValidandoIdentidade] = useState(false);
  const [areasSelecionadas, setAreasSelecionadas] = useState<string[]>([]);
  const [atuaisServidor, setAtuaisServidor] = useState<CompetenciaAtual[]>([]);
  const [competencias, setCompetencias] = useState<CompetenciaTela[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const funcionarios = dados?.funcionarios ?? [];
  const areas = dados?.areas ?? [];
  const ucs = dados?.unidades_curriculares ?? [];
  const vinculos = dados?.vinculos ?? [];
  const motivos = dados?.motivos ?? [];
  const statusOpcoes = dados?.status ?? [];

  useEffect(() => {
    obterDadosIniciaisMapa()
      .then(setDados)
      .catch((error) => setErro(error instanceof Error ? error.message : 'Erro ao carregar o mapa.'))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    if (!identidadeValidada || !areasSelecionadas.length) {
      setCompetencias([]);
      return;
    }

    const idsUcs = new Set(
      vinculos
        .filter((vinculo) => areasSelecionadas.includes(vinculo.area_id))
        .map((vinculo) => vinculo.uc_id)
    );

    const atuaisPorUc = new Map(atuaisServidor.map((item) => [item.uc_id, item]));
    const telaPorUc = new Map(competencias.map((item) => [item.uc_id, item]));

    const novas = ucs
      .filter((uc) => idsUcs.has(uc.id))
      .map((uc) => {
        const telaExistente = telaPorUc.get(uc.id);
        if (telaExistente) return telaExistente;
        const atual = atuaisPorUc.get(uc.id);
        return {
          uc_id: uc.id,
          codigo: uc.codigo,
          unidade_curricular: uc.unidade_curricular,
          status_competencia: atual?.status_competencia || '',
          status_original: atual?.status_competencia || '',
          respondida: Boolean(atual),
          primeira_resposta: atual?.primeiro_preenchimento || '',
          ultima_atualizacao: atual?.ultima_atualizacao || '',
          motivo_id: '',
          justificativa: '',
        } as CompetenciaTela;
      })
      .sort((a, b) => a.unidade_curricular.localeCompare(b.unidade_curricular, 'pt-BR'));

    setCompetencias(novas);
    // competencias não entra na dependência para evitar recomposição a cada radio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identidadeValidada, areasSelecionadas, atuaisServidor, ucs, vinculos]);

  async function validarIdentidade(): Promise<boolean> {
    if (!funcionarioId) {
      setErro('Selecione o funcionário.');
      return false;
    }
    if (!matricula.trim()) {
      setErro('Digite sua matrícula.');
      return false;
    }

    try {
      setValidandoIdentidade(true);
      setErro('');
      setSucesso('');
      const resposta = await obterDadosFuncionarioMapa(funcionarioId, matricula);
      setEmail(resposta.funcionario.email);
      setAtuaisServidor(resposta.competencias_atuais || []);
      setAreasSelecionadas(resposta.areas_selecionadas || []);
      setIdentidadeValidada(true);
      return true;
    } catch (error) {
      setEmail('');
      setAtuaisServidor([]);
      setAreasSelecionadas([]);
      setCompetencias([]);
      setIdentidadeValidada(false);
      setErro(error instanceof Error ? error.message : 'Não foi possível validar a matrícula.');
      return false;
    } finally {
      setValidandoIdentidade(false);
    }
  }

  function toggleArea(id: string) {
    setAreasSelecionadas((atuais) =>
      atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id]
    );
    setSucesso('');
  }

  function alterarStatus(ucId: string, status: StatusCompetencia) {
    setCompetencias((atuais) => atuais.map((item) => item.uc_id === ucId ? {
      ...item,
      status_competencia: status,
      motivo_id: status === item.status_original ? '' : item.motivo_id,
      justificativa: status === item.status_original ? '' : item.justificativa,
    } : item));
  }

  function alterarMotivo(ucId: string, motivoId: string) {
    setCompetencias((atuais) => atuais.map((item) => item.uc_id === ucId ? { ...item, motivo_id: motivoId, justificativa: '' } : item));
  }

  function alterarJustificativa(ucId: string, justificativa: string) {
    setCompetencias((atuais) => atuais.map((item) => item.uc_id === ucId ? { ...item, justificativa } : item));
  }

  function motivoSelecionado(item: CompetenciaTela): MotivoAlteracao | undefined {
    return motivos.find((motivo) => motivo.id === item.motivo_id);
  }

  function itemFoiAlterado(item: CompetenciaTela): boolean {
    return Boolean(item.respondida && item.status_original && item.status_original !== item.status_competencia);
  }

  const respondidas = competencias.filter((item) => Boolean(item.status_competencia)).length;
  const aptas = competencias.filter((item) => item.status_competencia === 'APTO').length;
  const parciais = competencias.filter((item) => item.status_competencia === 'PARCIALMENTE_APTO').length;
  const inaptas = competencias.filter((item) => item.status_competencia === 'INAPTO').length;
  const progresso = competencias.length > 0 ? (respondidas * 100) / competencias.length : 0;

  const competenciasFiltradas = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return competencias;
    return competencias.filter((item) =>
      item.unidade_curricular.toLowerCase().includes(q) ||
      item.codigo.toLowerCase().includes(q)
    );
  }, [competencias, searchTerm]);

  const cursosSelecionados = useMemo(
    () => areas.filter((area) => areasSelecionadas.includes(area.id)),
    [areas, areasSelecionadas]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro('');
    setSucesso('');

    const identidadeOk = identidadeValidada || (await validarIdentidade());
    if (!identidadeOk) return;
    if (!areasSelecionadas.length) return setErro('Selecione pelo menos um curso.');
    if (!competencias.length) return setErro('Nenhuma unidade curricular foi encontrada para os cursos selecionados.');
    const pendentes = competencias.filter((item) => !item.status_competencia);
    if (pendentes.length) return setErro(`Classifique todas as unidades curriculares. Restam ${pendentes.length} pendente(s).`);

    for (const item of competencias) {
      if (!itemFoiAlterado(item)) continue;
      if (!item.motivo_id) return setErro(`Informe o motivo da alteração em “${item.unidade_curricular}”.`);
      const motivo = motivoSelecionado(item);
      if (motivo?.exige_justificativa && !item.justificativa.trim()) {
        return setErro(`Informe a justificativa da alteração em “${item.unidade_curricular}”.`);
      }
    }

    try {
      setSalvando(true);
      const resposta = await salvarMapaCompetenciasApi({
        funcionario_id: funcionarioId,
        matricula: matricula.trim(),
        area_ids: areasSelecionadas,
        competencias: competencias.map((item) => ({
          uc_id: item.uc_id,
          unidade_curricular: item.unidade_curricular,
          status_competencia: item.status_competencia as 'APTO' | 'PARCIALMENTE_APTO' | 'INAPTO',
          ...(itemFoiAlterado(item) ? { motivo_id: item.motivo_id, justificativa: item.justificativa.trim() } : {}),
        })),
      });

      setSucesso(`${resposta.mensagem}${resposta.email_enviado === false ? ' O mapa foi salvo, mas o e-mail de confirmação não pôde ser enviado.' : ' Um e-mail de confirmação foi enviado.'}`);
      await validarIdentidade();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível salvar o mapa.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <div className="mc-page"><div className="mc-container"><div className="mc-loading">Carregando Mapa de Competências...</div></div></div>;

  return (
    <div className="mc-page">
      <div className="mc-container">
        <header className="mc-header"><div><span className="mc-eyebrow">DESENVOLVIMENTO DOCENTE</span><h1>Mapa de Competências</h1><p>Selecione seu nome, confirme sua matrícula, marque os cursos e classifique as unidades curriculares.</p></div></header>
        {erro && <div className="mc-alert mc-alert-error">{erro}</div>}
        {sucesso && <div className="mc-alert mc-alert-success">{sucesso}</div>}

        <form onSubmit={handleSubmit}>
          <section className="mc-card">
            <div className="mc-card-title"><div><span>01</span><h2>Identificação</h2></div><p>A matrícula é digitada pelo usuário e validada no servidor.</p></div>
            <div className="mc-grid mc-grid-3">
              <label className="mc-field"><span>Funcionário *</span><select value={funcionarioId} onChange={(e) => { setFuncionarioId(e.target.value); setMatricula(''); setEmail(''); setIdentidadeValidada(false); setAreasSelecionadas([]); setCompetencias([]); setAtuaisServidor([]); }}><option value="">Selecione...</option>{funcionarios.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
              <label className="mc-field"><span>Matrícula *</span><input value={matricula} onChange={(e) => { setMatricula(e.target.value); setEmail(''); setIdentidadeValidada(false); setAreasSelecionadas([]); setCompetencias([]); }} onBlur={() => { if (funcionarioId && matricula.trim()) void validarIdentidade(); }} placeholder="Digite sua matrícula" disabled={!funcionarioId} autoComplete="off" /></label>
              <label className="mc-field"><span>E-mail</span><input value={email} readOnly placeholder={validandoIdentidade ? 'Validando...' : 'Preenchido após validar a matrícula'} /></label>
            </div>
          </section>

          {identidadeValidada && (
            <>
              <section className="mc-card">
                <div className="mc-card-title"><div><span>02</span><h2>Cursos de atuação</h2></div><p>Marque todos os cursos nos quais você possui competências para lecionar.</p></div>
                <div className="mc-course-grid">
                  {areas.map((area) => {
                    const checked = areasSelecionadas.includes(area.id);
                    return <label key={area.id} className={`mc-course-option ${checked ? 'selected' : ''}`}><input type="checkbox" checked={checked} onChange={() => toggleArea(area.id)} /><span>{area.area}</span></label>;
                  })}
                </div>
              </section>

              {areasSelecionadas.length > 0 && (
                <>
                  <section className="mc-summary">
                    <div><span>Cursos selecionados</span><strong>{cursosSelecionados.length}</strong></div>
                    <div className="mc-summary-progress">
                      <span>Progresso</span>
                      <div className="mc-progress-wrap">
                        <div className="mc-progress-bar" style={{ width: `${progresso}%` }} />
                      </div>
                      <strong>{respondidas}/{competencias.length} ({progresso.toFixed(0)}%)</strong>
                    </div>
                    <div className="mc-summary-apto"><span>Apto</span><strong>{aptas}</strong></div>
                    <div className="mc-summary-parcial"><span>Parcialmente apto</span><strong>{parciais}</strong></div>
                    <div className="mc-summary-inapto"><span>Não apto</span><strong>{inaptas}</strong></div>
                  </section>

                  <section className="mc-card">
                    <div className="mc-card-title"><div><span>03</span><h2>Unidades curriculares</h2></div><p>UCs repetidas entre cursos aparecem uma única vez. Use a busca para filtrar rapidamente.</p></div>
                    <div className="mc-list-header">
                      <div className="mc-legend"><span><i className="mc-dot mc-dot-apto" /> Apto</span><span><i className="mc-dot mc-dot-parcial" /> Parcialmente apto</span><span><i className="mc-dot mc-dot-inapto" /> Não apto</span></div>
                      <label className="mc-search">
                        <Search size={16} />
                        <input
                          type="search"
                          placeholder="Buscar por nome ou código da UC..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          aria-label="Buscar unidade curricular"
                        />
                      </label>
                    </div>
                    <div className="mc-list">
                      {competenciasFiltradas.length === 0 ? (
                        <div className="mc-empty">Nenhuma unidade curricular encontrada para a busca.</div>
                      ) : (
                        competenciasFiltradas.map((item, index) => {
                        const alterado = itemFoiAlterado(item);
                        const motivo = motivoSelecionado(item);
                        return (
                          <article className={`mc-uc ${alterado ? 'mc-uc-changed' : ''}`} key={item.uc_id}>
                            <div className="mc-uc-main">
                              <div className="mc-uc-number">{String(index + 1).padStart(2, '0')}</div>
                              <div className="mc-uc-info"><strong>{item.unidade_curricular}</strong><div className="mc-uc-meta">{item.codigo && <span>{item.codigo}</span>}{item.respondida && <span>Resposta já registrada</span>}{item.ultima_atualizacao && <span>Atualização: {formatarData(item.ultima_atualizacao)}</span>}</div></div>
                              <div className="mc-status-group">{statusOpcoes.map((status) => <label className={`mc-status mc-status-${status.id.toLowerCase().replace('_', '-')}`} key={status.id}><input type="radio" name={`status-${item.uc_id}`} checked={item.status_competencia === status.id} onChange={() => alterarStatus(item.uc_id, status.id)} /><span>{status.rotulo}</span></label>)}</div>
                            </div>
                            {alterado && <div className="mc-change-box"><div className="mc-change-heading"><strong>Alteração de competência</strong><span>Status anterior: {statusOpcoes.find((s) => s.id === item.status_original)?.rotulo || item.status_original}</span></div><div className="mc-grid mc-grid-2"><label className="mc-field"><span>Motivo da alteração *</span><select value={item.motivo_id} onChange={(e) => alterarMotivo(item.uc_id, e.target.value)}><option value="">Selecione...</option>{motivos.map((opcao) => <option key={opcao.id} value={opcao.id}>{opcao.motivo}</option>)}</select></label><label className="mc-field"><span>Justificativa {motivo?.exige_justificativa ? '*' : '(opcional)'}</span><textarea rows={3} value={item.justificativa} onChange={(e) => alterarJustificativa(item.uc_id, e.target.value)} /></label></div></div>}
                          </article>
                        );
                      }))}
                    </div>
                  </section>

                  <div className="mc-actions"><div><strong>{respondidas} de {competencias.length}</strong><span>unidades curriculares classificadas</span></div><button type="submit" disabled={salvando || !competencias.length}>{salvando ? 'Salvando...' : 'Salvar Mapa de Competências'}</button></div>
                </>
              )}
            </>
          )}
        </form>
      </div>
    </div>
  );
}
