import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CategoriaExtraclasse,
  FuncionarioExtraclasse,
  listarCategoriasExtraclasse,
  listarFuncionariosExtraclasse,
  registrarAtividadeExtraclasse,
} from "../services/extraclasseService";

import "./RegistroExtraclasse.css";

type DiaSemana = {
  codigo: string;
  nome: string;
  numero: number;
};

const DIAS_SEMANA: DiaSemana[] = [
  { codigo: "SEG", nome: "Segunda", numero: 1 },
  { codigo: "TER", nome: "Terça", numero: 2 },
  { codigo: "QUA", nome: "Quarta", numero: 3 },
  { codigo: "QUI", nome: "Quinta", numero: 4 },
  { codigo: "SEX", nome: "Sexta", numero: 5 },
  { codigo: "SAB", nome: "Sábado", numero: 6 },
  { codigo: "DOM", nome: "Domingo", numero: 0 },
];

function obterHojeLocal(): string {
  const agora = new Date();

  const ano = agora.getFullYear();
  const mes = String(
    agora.getMonth() + 1
  ).padStart(2, "0");
  const dia = String(
    agora.getDate()
  ).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

const hoje = obterHojeLocal();

function criarDataUTC(
  data: string
): Date {
  const [ano, mes, dia] =
    data.split("-").map(Number);

  return new Date(
    Date.UTC(
      ano,
      mes - 1,
      dia
    )
  );
}

function formatarDataISO(
  data: Date
): string {
  return [
    data.getUTCFullYear(),
    String(
      data.getUTCMonth() + 1
    ).padStart(2, "0"),
    String(
      data.getUTCDate()
    ).padStart(2, "0"),
  ].join("-");
}

function formatarDataBrasil(
  data: string
): string {
  const partes = data.split("-");

  if (partes.length !== 3) {
    return data;
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function calcularDatas(
  dataInicio: string,
  dataFim: string,
  diasSelecionados: string[]
): string[] {
  if (
    !dataInicio ||
    !dataFim ||
    diasSelecionados.length === 0
  ) {
    return [];
  }

  const inicio =
    criarDataUTC(dataInicio);

  const fim =
    criarDataUTC(dataFim);

  if (inicio > fim) {
    return [];
  }

  const numerosSelecionados =
    DIAS_SEMANA
      .filter((dia) =>
        diasSelecionados.includes(
          dia.codigo
        )
      )
      .map((dia) => dia.numero);

  const resultado: string[] = [];
  const atual =
    new Date(inicio.getTime());

  while (atual <= fim) {
    if (
      numerosSelecionados.includes(
        atual.getUTCDay()
      )
    ) {
      resultado.push(
        formatarDataISO(atual)
      );
    }

    atual.setUTCDate(
      atual.getUTCDate() + 1
    );
  }

  return resultado;
}

export default function RegistroExtraclasse() {
  const [
    funcionarios,
    setFuncionarios,
  ] =
    useState<
      FuncionarioExtraclasse[]
    >([]);

  const [
    categorias,
    setCategorias,
  ] =
    useState<
      CategoriaExtraclasse[]
    >([]);

  const [nome, setNome] =
    useState("");

  const [
    matricula,
    setMatricula,
  ] =
    useState("");

  const [
    dataInicio,
    setDataInicio,
  ] =
    useState("");

  const [
    dataFim,
    setDataFim,
  ] =
    useState("");

  const [
    diasSelecionados,
    setDiasSelecionados,
  ] =
    useState<string[]>([]);

  const [
    categoria,
    setCategoria,
  ] =
    useState("");

  const [
    cargaDiaria,
    setCargaDiaria,
  ] =
    useState("");

  const [
    descricao,
    setDescricao,
  ] =
    useState("");

  const [
    carregandoDados,
    setCarregandoDados,
  ] =
    useState(true);

  const [
    enviando,
    setEnviando,
  ] =
    useState(false);

  const [
    erro,
    setErro,
  ] =
    useState("");

  const [
    mensagemSucesso,
    setMensagemSucesso,
  ] =
    useState("");

  useEffect(() => {
    async function carregarDados() {
      try {
        setCarregandoDados(true);
        setErro("");

        const [
          funcionariosRecebidos,
          categoriasRecebidas,
        ] =
          await Promise.all([
            listarFuncionariosExtraclasse(),
            listarCategoriasExtraclasse(),
          ]);

        setFuncionarios(
          funcionariosRecebidos
        );

        setCategorias(
          categoriasRecebidas
        );
      } catch (error) {
        setErro(
          error instanceof Error
            ? error.message
            : "Erro ao carregar dados."
        );
      } finally {
        setCarregandoDados(false);
      }
    }

    carregarDados();
  }, []);

  const datasRealizadas =
    useMemo(
      () =>
        calcularDatas(
          dataInicio,
          dataFim,
          diasSelecionados
        ),
      [
        dataInicio,
        dataFim,
        diasSelecionados,
      ]
    );

  const cargaHorariaTotal =
    useMemo(() => {
      const carga =
        Number(cargaDiaria);

      if (
        !Number.isFinite(carga) ||
        carga <= 0
      ) {
        return 0;
      }

      return Number(
        (
          datasRealizadas.length *
          carga
        ).toFixed(2)
      );
    }, [
      datasRealizadas,
      cargaDiaria,
    ]);

  function alterarDia(
    codigo: string
  ) {
    setDiasSelecionados(
      (diasAtuais) => {
        if (
          diasAtuais.includes(
            codigo
          )
        ) {
          return diasAtuais.filter(
            (dia) =>
              dia !== codigo
          );
        }

        return [
          ...diasAtuais,
          codigo,
        ];
      }
    );
  }

  function selecionarFuncionario(
    matriculaSelecionada: string
  ) {
    if (!matriculaSelecionada) {
      setNome("");
      setMatricula("");
      return;
    }

    const funcionario =
      funcionarios.find(
        (item) =>
          String(
            item.matricula
          ).trim() ===
          String(
            matriculaSelecionada
          ).trim()
      );

    if (!funcionario) {
      setNome("");
      setMatricula("");

      setErro(
        "Não foi possível localizar a matrícula do funcionário selecionado."
      );

      return;
    }

    setNome(
      String(
        funcionario.nome
      ).trim()
    );

    setMatricula(
      String(
        funcionario.matricula
      ).trim()
    );

    setErro("");
  }

  function limparFormulario() {
    setNome("");
    setMatricula("");
    setDataInicio("");
    setDataFim("");
    setDiasSelecionados([]);
    setCategoria("");
    setCargaDiaria("");
    setDescricao("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErro("");
    setMensagemSucesso("");

    if (!nome) {
      setErro(
        "Selecione o funcionário."
      );
      return;
    }

    if (!matricula.trim()) {
      setErro(
        "A matrícula do funcionário não foi encontrada."
      );
      return;
    }

    if (
      !dataInicio ||
      !dataFim
    ) {
      setErro(
        "Informe o período da atividade."
      );
      return;
    }

    if (
      dataInicio > dataFim
    ) {
      setErro(
        "A data inicial não pode ser posterior à data final."
      );
      return;
    }

    if (
      dataInicio > hoje ||
      dataFim > hoje
    ) {
      setErro(
        "Não é permitido registrar uma atividade em data futura."
      );
      return;
    }

    if (
      diasSelecionados.length === 0
    ) {
      setErro(
        "Selecione pelo menos um dia da semana."
      );
      return;
    }

    if (
      datasRealizadas.length === 0
    ) {
      setErro(
        "Nenhum dos dias selecionados ocorre dentro do período informado."
      );
      return;
    }

    if (!categoria) {
      setErro(
        "Selecione a categoria da atividade."
      );
      return;
    }

    const carga =
      Number(cargaDiaria);

    if (
      !Number.isFinite(carga) ||
      carga <= 0 ||
      carga > 24
    ) {
      setErro(
        "Informe uma carga horária diária válida."
      );
      return;
    }

    if (!descricao.trim()) {
      setErro(
        "Informe a descrição da atividade."
      );
      return;
    }

    try {
      setEnviando(true);

      const resultado =
        await registrarAtividadeExtraclasse(
          {
            nome:
              nome.trim(),

            matricula:
              matricula.trim(),

            data_inicio:
              dataInicio,

            data_fim:
              dataFim,

            dias_semana:
              diasSelecionados,

            categoria,

            carga_horaria_diaria:
              carga,

            descricao:
              descricao.trim(),
          }
        );

      if (!resultado.sucesso) {
        setErro(
          resultado.mensagem ||
            "Não foi possível registrar a atividade."
        );
        return;
      }

      const cargaConfirmada =
        resultado.calculo
          ?.cargaHorariaTotal ??
        cargaHorariaTotal;

      setMensagemSucesso(
        `${resultado.mensagem} Carga horária registrada: ${cargaConfirmada}h.`
      );

      limparFormulario();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar a atividade."
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="extraclasse-page">
      <div className="extraclasse-container">
        <header className="extraclasse-header">
          <div>
            <h1>
              Registro de Atividade Extraclasse
            </h1>

            <p>
              Informe os dados da atividade realizada.
              A carga horária será calculada automaticamente.
            </p>
          </div>
        </header>

        {erro && (
          <div className="alerta alerta-erro">
            {erro}
          </div>
        )}

        {mensagemSucesso && (
          <div className="alerta alerta-sucesso">
            {mensagemSucesso}
          </div>
        )}

        {carregandoDados ? (
          <div className="carregando">
            Carregando informações...
          </div>
        ) : (
          <form
            className="extraclasse-form"
            onSubmit={handleSubmit}
          >
            <section className="form-card">
              <h2>
                Identificação
              </h2>

              <div className="form-grid">
                <div className="campo">
                  <label
                    htmlFor="funcionario"
                  >
                    Funcionário *
                  </label>

                  <select
                    id="funcionario"
                    value={matricula}
                    onChange={(event) =>
                      selecionarFuncionario(
                        event.target.value
                      )
                    }
                    required
                  >
                    <option value="">
                      Selecione...
                    </option>

                    {funcionarios.map(
                      (funcionario) => (
                        <option
                          key={
                            String(
                              funcionario.matricula
                            )
                          }
                          value={
                            String(
                              funcionario.matricula
                            )
                          }
                        >
                          {funcionario.nome}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="campo">
                  <label
                    htmlFor="matricula"
                  >
                    Matrícula *
                  </label>

                  <input
                    id="matricula"
                    type="text"
                    value={matricula}
                    readOnly
                    placeholder="Preenchida automaticamente"
                  />

                  <small>
                    Preenchida automaticamente conforme
                    o funcionário selecionado.
                  </small>
                </div>
              </div>
            </section>

            <section className="form-card">
              <h2>
                Período da atividade
              </h2>

              <div className="form-grid">
                <div className="campo">
                  <label
                    htmlFor="dataInicio"
                  >
                    Data de início *
                  </label>

                  <input
                    id="dataInicio"
                    type="date"
                    max={hoje}
                    value={dataInicio}
                    onChange={(event) =>
                      setDataInicio(
                        event.target.value
                      )
                    }
                    required
                  />
                </div>

                <div className="campo">
                  <label
                    htmlFor="dataFim"
                  >
                    Data final *
                  </label>

                  <input
                    id="dataFim"
                    type="date"
                    min={
                      dataInicio ||
                      undefined
                    }
                    max={hoje}
                    value={dataFim}
                    onChange={(event) =>
                      setDataFim(
                        event.target.value
                      )
                    }
                    required
                  />
                </div>
              </div>

              <div className="campo">
                <label>
                  Dias de realização *
                </label>

                <div className="dias-semana">
                  {DIAS_SEMANA.map(
                    (dia) => (
                      <label
                        key={
                          dia.codigo
                        }
                        className={`dia-opcao ${
                          diasSelecionados.includes(
                            dia.codigo
                          )
                            ? "selecionado"
                            : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={
                            diasSelecionados.includes(
                              dia.codigo
                            )
                          }
                          onChange={() =>
                            alterarDia(
                              dia.codigo
                            )
                          }
                        />

                        <span>
                          {dia.nome}
                        </span>
                      </label>
                    )
                  )}
                </div>
              </div>
            </section>

            <section className="form-card">
              <h2>
                Informações da atividade
              </h2>

              <div className="form-grid">
                <div className="campo">
                  <label
                    htmlFor="categoria"
                  >
                    Categoria *
                  </label>

                  <select
                    id="categoria"
                    value={categoria}
                    onChange={(event) =>
                      setCategoria(
                        event.target.value
                      )
                    }
                    required
                  >
                    <option value="">
                      Selecione...
                    </option>

                    {categorias.map(
                      (item) => (
                        <option
                          key={item.id}
                          value={
                            item.categoria
                          }
                        >
                          {item.categoria}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="campo">
                  <label
                    htmlFor="cargaDiaria"
                  >
                    Carga horária diária *
                  </label>

                  <input
                    id="cargaDiaria"
                    type="number"
                    min="0.5"
                    max="24"
                    step="0.5"
                    value={cargaDiaria}
                    onChange={(event) =>
                      setCargaDiaria(
                        event.target.value
                      )
                    }
                    placeholder="Ex.: 4"
                    required
                  />
                </div>
              </div>

              <div className="campo">
                <label
                  htmlFor="descricao"
                >
                  Descrição da atividade *
                </label>

                <textarea
                  id="descricao"
                  rows={5}
                  value={descricao}
                  onChange={(event) =>
                    setDescricao(
                      event.target.value
                    )
                  }
                  placeholder="Descreva a atividade extraclasse realizada..."
                  required
                />
              </div>
            </section>

            <section className="resumo-extraclasse">
              <div>
                <span>
                  Dias realizados
                </span>

                <strong>
                  {datasRealizadas.length}
                </strong>
              </div>

              <div>
                <span>
                  Carga diária
                </span>

                <strong>
                  {Number(
                    cargaDiaria
                  ) || 0}
                  h
                </strong>
              </div>

              <div className="total">
                <span>
                  Carga horária total
                </span>

                <strong>
                  {cargaHorariaTotal}h
                </strong>
              </div>
            </section>

            {datasRealizadas.length > 0 && (
              <section className="datas-calculadas">
                <strong>
                  Datas consideradas:
                </strong>

                <div className="datas-lista">
                  {datasRealizadas.map(
                    (data) => (
                      <span key={data}>
                        {formatarDataBrasil(
                          data
                        )}
                      </span>
                    )
                  )}
                </div>
              </section>
            )}

            <div className="acoes-form">
              <button
                type="button"
                className="botao-secundario"
                onClick={
                  limparFormulario
                }
                disabled={enviando}
              >
                Limpar
              </button>

              <button
                type="submit"
                className="botao-principal"
                disabled={
                  enviando ||
                  cargaHorariaTotal <= 0 ||
                  !matricula
                }
              >
                {enviando
                  ? "Registrando..."
                  : "Confirmar atividade"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
