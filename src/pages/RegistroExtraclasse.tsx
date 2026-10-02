import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  listarCategoriasExtraclasse,
  registrarAtividadeExtraclasse,
} from '../services/extraclasseService';
import type { CategoriaExtraclasse } from '../services/extraclasseService';
import {
  listarFuncionariosPublicos,
  validarFuncionario,
} from '../services/funcionarioService';
import type { FuncionarioPublico } from '../services/funcionarioService';
import './RegistroExtraclasse.css';

const DIAS_SEMANA = [
  { codigo: 'SEG', nome: 'Segunda' },
  { codigo: 'TER', nome: 'Terça' },
  { codigo: 'QUA', nome: 'Quarta' },
  { codigo: 'QUI', nome: 'Quinta' },
  { codigo: 'SEX', nome: 'Sexta' },
  { codigo: 'SAB', nome: 'Sábado' },
  { codigo: 'DOM', nome: 'Domingo' },
];

const CODIGO_POR_DIA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

function hojeIso(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
}

function calcularDatas(inicio: string, fim: string, dias: string[]): string[] {
  if (!inicio || !fim || inicio > fim || !dias.length) return [];
  const resultado: string[] = [];
  const atual = new Date(`${inicio}T12:00:00Z`);
  const final = new Date(`${fim}T12:00:00Z`);
  const permitidos = new Set(dias);

  while (atual <= final) {
    if (permitidos.has(CODIGO_POR_DIA[atual.getUTCDay()])) {
      resultado.push(atual.toISOString().slice(0, 10));
    }
    atual.setUTCDate(atual.getUTCDate() + 1);
  }
  return resultado;
}

function formatarDataBrasil(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default function RegistroExtraclasse() {
  const [funcionarios, setFuncionarios] = useState<FuncionarioPublico[]>([]);
  const [categorias, setCategorias] = useState<CategoriaExtraclasse[]>([]);
  const [funcionarioId, setFuncionarioId] = useState('');
  const [matricula, setMatricula] = useState('');
  const [email, setEmail] = useState('');
  const [identidadeValidada, setIdentidadeValidada] = useState(false);
  const [validandoIdentidade, setValidandoIdentidade] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [diasSelecionados, setDiasSelecionados] = useState<string[]>([]);
  const [categoria, setCategoria] = useState('');
  const [cargaDiaria, setCargaDiaria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const hoje = hojeIso();

  useEffect(() => {
    Promise.all([listarFuncionariosPublicos(), listarCategoriasExtraclasse()])
      .then(([listaFuncionarios, listaCategorias]) => {
        setFuncionarios(listaFuncionarios);
        setCategorias(listaCategorias);
      })
      .catch((error) => setErro(error instanceof Error ? error.message : 'Erro ao carregar dados.'))
      .finally(() => setCarregando(false));
  }, []);

  const datasRealizadas = useMemo(
    () => calcularDatas(dataInicio, dataFim, diasSelecionados),
    [dataInicio, dataFim, diasSelecionados]
  );

  const cargaTotal = useMemo(() => {
    const carga = Number(cargaDiaria);
    return Number.isFinite(carga) && carga > 0 ? Number((datasRealizadas.length * carga).toFixed(2)) : 0;
  }, [datasRealizadas, cargaDiaria]);

  async function validarIdentidade(): Promise<boolean> {
    if (!funcionarioId || !matricula.trim()) return false;
    try {
      setValidandoIdentidade(true);
      const funcionario = await validarFuncionario(funcionarioId, matricula);
      setEmail(funcionario.email);
      setIdentidadeValidada(true);
      setErro('');
      return true;
    } catch (error) {
      setEmail('');
      setIdentidadeValidada(false);
      setErro(error instanceof Error ? error.message : 'Não foi possível validar a matrícula.');
      return false;
    } finally {
      setValidandoIdentidade(false);
    }
  }

  function alterarDia(codigo: string) {
    setDiasSelecionados((atuais) =>
      atuais.includes(codigo) ? atuais.filter((item) => item !== codigo) : [...atuais, codigo]
    );
  }

  function limpar() {
    setFuncionarioId('');
    setMatricula('');
    setEmail('');
    setIdentidadeValidada(false);
    setDataInicio('');
    setDataFim('');
    setDiasSelecionados([]);
    setCategoria('');
    setCargaDiaria('');
    setDescricao('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro('');
    setSucesso('');

    if (!funcionarioId) return setErro('Selecione o funcionário.');
    if (!matricula.trim()) return setErro('Digite sua matrícula.');
    const identidadeOk = identidadeValidada || (await validarIdentidade());
    if (!identidadeOk) return;
    if (!dataInicio || !dataFim) return setErro('Informe o período da atividade.');
    if (dataInicio > dataFim) return setErro('A data inicial não pode ser posterior à data final.');
    if (dataInicio > hoje || dataFim > hoje) return setErro('Não é permitido registrar atividade em data futura.');
    if (!diasSelecionados.length) return setErro('Selecione pelo menos um dia da semana.');
    if (!datasRealizadas.length) return setErro('Nenhum dia selecionado ocorre no período informado.');
    if (!categoria) return setErro('Selecione a categoria da atividade.');
    const carga = Number(cargaDiaria);
    if (!Number.isFinite(carga) || carga <= 0 || carga > 24) return setErro('Informe uma carga horária diária válida.');
    if (!descricao.trim()) return setErro('Informe a descrição da atividade.');

    try {
      setEnviando(true);
      const resultado = await registrarAtividadeExtraclasse({
        funcionario_id: funcionarioId,
        matricula: matricula.trim(),
        data_inicio: dataInicio,
        data_fim: dataFim,
        dias_semana: diasSelecionados,
        categoria,
        carga_horaria_diaria: carga,
        descricao: descricao.trim(),
      });

      if (!resultado.sucesso) throw new Error(resultado.mensagem);
      setSucesso(`${resultado.mensagem} Carga horária: ${resultado.calculo?.cargaHorariaTotal ?? cargaTotal}h.${resultado.email_enviado === false ? ' O registro foi salvo, mas não foi possível enviar o e-mail.' : ' Um e-mail de confirmação foi enviado.'}`);
      limpar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível registrar a atividade.');
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) return <div className="carregando">Carregando informações...</div>;

  return (
    <main className="extraclasse-page">
      <div className="extraclasse-container">
        <header className="extraclasse-header">
          <div>
            <h1>Registro de Atividade Extraclasse</h1>
            <p>Selecione seu nome, confirme sua matrícula e registre a atividade realizada.</p>
          </div>
        </header>

        {erro && <div className="alerta alerta-erro">{erro}</div>}
        {sucesso && <div className="alerta alerta-sucesso">{sucesso}</div>}

        <form className="extraclasse-form" onSubmit={handleSubmit}>
          <section className="form-card">
            <h2>Identificação</h2>
            <div className="form-grid">
              <div className="campo">
                <label htmlFor="funcionario">Funcionário *</label>
                <select
                  id="funcionario"
                  value={funcionarioId}
                  onChange={(event) => {
                    setFuncionarioId(event.target.value);
                    setMatricula('');
                    setEmail('');
                    setIdentidadeValidada(false);
                    setErro('');
                  }}
                  required
                >
                  <option value="">Selecione...</option>
                  {funcionarios.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
              </div>

              <div className="campo">
                <label htmlFor="matricula">Matrícula *</label>
                <input
                  id="matricula"
                  value={matricula}
                  onChange={(event) => {
                    setMatricula(event.target.value);
                    setEmail('');
                    setIdentidadeValidada(false);
                  }}
                  onBlur={() => { if (funcionarioId && matricula.trim()) void validarIdentidade(); }}
                  placeholder="Digite sua matrícula"
                  autoComplete="off"
                  disabled={!funcionarioId}
                  required
                />
                <small>Em caso de erro, o sistema apenas solicitará nova digitação.</small>
              </div>

              <div className="campo">
                <label>E-mail</label>
                <input value={email} readOnly placeholder={validandoIdentidade ? 'Validando...' : 'Preenchido após validar a matrícula'} />
              </div>
            </div>
          </section>

          <section className="form-card">
            <h2>Período da atividade</h2>
            <div className="form-grid">
              <div className="campo"><label>Data de início *</label><input type="date" max={hoje} value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required /></div>
              <div className="campo"><label>Data final *</label><input type="date" min={dataInicio || undefined} max={hoje} value={dataFim} onChange={(e) => setDataFim(e.target.value)} required /></div>
            </div>
            <div className="campo">
              <label>Dias de realização *</label>
              <div className="dias-semana">
                {DIAS_SEMANA.map((dia) => (
                  <label key={dia.codigo} className={`dia-opcao ${diasSelecionados.includes(dia.codigo) ? 'selecionado' : ''}`}>
                    <input type="checkbox" checked={diasSelecionados.includes(dia.codigo)} onChange={() => alterarDia(dia.codigo)} />
                    <span>{dia.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="form-card">
            <h2>Informações da atividade</h2>
            <div className="form-grid">
              <div className="campo"><label>Categoria *</label><select value={categoria} onChange={(e) => setCategoria(e.target.value)} required><option value="">Selecione...</option>{categorias.map((item) => <option key={item.id} value={item.categoria}>{item.categoria}</option>)}</select></div>
              <div className="campo"><label>Carga horária diária *</label><input type="number" min="0.5" max="24" step="0.5" value={cargaDiaria} onChange={(e) => setCargaDiaria(e.target.value)} required /></div>
            </div>
            <div className="campo"><label>Descrição da atividade *</label><textarea rows={5} value={descricao} onChange={(e) => setDescricao(e.target.value)} required /></div>
          </section>

          <section className="resumo-extraclasse">
            <div><span>Dias realizados</span><strong>{datasRealizadas.length}</strong></div>
            <div><span>Carga diária</span><strong>{Number(cargaDiaria) || 0}h</strong></div>
            <div className="total"><span>Carga horária total</span><strong>{cargaTotal}h</strong></div>
          </section>

          {datasRealizadas.length > 0 && <section className="datas-calculadas"><strong>Datas consideradas:</strong><div className="datas-lista">{datasRealizadas.map((data) => <span key={data}>{formatarDataBrasil(data)}</span>)}</div></section>}

          <div className="acoes-form">
            <button type="button" className="botao-secundario" onClick={limpar} disabled={enviando}>Limpar</button>
            <button type="submit" className="botao-principal" disabled={enviando || cargaTotal <= 0}>{enviando ? 'Registrando...' : 'Confirmar atividade'}</button>
          </div>
        </form>
      </div>
    </main>
  );
}
