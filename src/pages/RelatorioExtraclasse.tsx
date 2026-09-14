import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AtividadeRelatorioExtraclasse,
  CategoriaExtraclasse,
  FuncionarioExtraclasse,
  listarCategoriasExtraclasse,
  listarFuncionariosExtraclasse,
  listarRelatorioExtraclasse,
  loginMaster,
  logoutMaster,
  obterTokenMaster,
  removerTokenMaster,
  salvarTokenMaster,
  validarSessaoMaster,
} from '../services/extraclasseService';

import './RelatorioExtraclasse.css';

function formatarData(
  data: string
): string {
  if (!data) {
    return '-';
  }

  const trecho =
    data.slice(0, 10);

  const partes =
    trecho.split('-');

  if (
    partes.length !== 3
  ) {
    return data;
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatarHoras(
  valor: number
): string {
  return new Intl.NumberFormat(
    'pt-BR',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(valor);
}

export default function RelatorioExtraclasse() {
  const [
    autenticado,
    setAutenticado,
  ] =
    useState(false);

  const [
    verificandoSessao,
    setVerificandoSessao,
  ] =
    useState(true);

  const [
    usuario,
    setUsuario,
  ] =
    useState('master');

  const [
    senha,
    setSenha,
  ] =
    useState('');

  const [
    processandoLogin,
    setProcessandoLogin,
  ] =
    useState(false);

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

  const [
    nomeFiltro,
    setNomeFiltro,
  ] =
    useState('');

  const [
    categoriaFiltro,
    setCategoriaFiltro,
  ] =
    useState('');

  const [
    dataInicio,
    setDataInicio,
  ] =
    useState('');

  const [
    dataFim,
    setDataFim,
  ] =
    useState('');

  const [
    atividades,
    setAtividades,
  ] =
    useState<
      AtividadeRelatorioExtraclasse[]
    >([]);

  const [
    quantidadeAtividades,
    setQuantidadeAtividades,
  ] =
    useState(0);

  const [
    quantidadeDias,
    setQuantidadeDias,
  ] =
    useState(0);

  const [
    cargaHorariaTotal,
    setCargaHorariaTotal,
  ] =
    useState(0);

  const [
    carregandoRelatorio,
    setCarregandoRelatorio,
  ] =
    useState(false);

  const [
    erro,
    setErro,
  ] =
    useState('');

  const [
    atividadeSelecionada,
    setAtividadeSelecionada,
  ] =
    useState<
      AtividadeRelatorioExtraclasse |
      null
    >(null);

  const carregarOpcoes =
    useCallback(
      async () => {
        const [
          listaFuncionarios,
          listaCategorias,
        ] =
          await Promise.all([
            listarFuncionariosExtraclasse(),
            listarCategoriasExtraclasse(),
          ]);

        setFuncionarios(
          listaFuncionarios
        );

        setCategorias(
          listaCategorias
        );
      },
      []
    );

  const consultarRelatorio =
    useCallback(
      async (
        sobrescreverFiltros?: {
          nome?: string;
          categoria?: string;
          data_inicio?: string;
          data_fim?: string;
        }
      ) => {
        const token =
          obterTokenMaster();

        if (!token) {
          setAutenticado(false);
          return;
        }

        setCarregandoRelatorio(true);
        setErro('');

        try {
          const resultado =
            await listarRelatorioExtraclasse(
              {
                nome:
                  sobrescreverFiltros
                    ?.nome ??
                  nomeFiltro,

                categoria:
                  sobrescreverFiltros
                    ?.categoria ??
                  categoriaFiltro,

                data_inicio:
                  sobrescreverFiltros
                    ?.data_inicio ??
                  dataInicio,

                data_fim:
                  sobrescreverFiltros
                    ?.data_fim ??
                  dataFim,
              },
              token
            );

          if (!resultado.sucesso) {
            const mensagem =
              resultado.mensagem ||
              'Não foi possível carregar o relatório.';

            if (
              mensagem
                .toLowerCase()
                .includes('master') ||
              mensagem
                .toLowerCase()
                .includes('sessão')
            ) {
              removerTokenMaster();
              setAutenticado(false);
            }

            setErro(mensagem);
            return;
          }

          setAtividades(
            resultado.dados
          );

          setQuantidadeAtividades(
            resultado.resumo
              .quantidadeAtividades
          );

          setQuantidadeDias(
            resultado.resumo
              .quantidadeDias
          );

          setCargaHorariaTotal(
            resultado.resumo
              .cargaHorariaTotal
          );

          setAtividadeSelecionada(
            null
          );
        } catch (error) {
          setErro(
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar o relatório.'
          );
        } finally {
          setCarregandoRelatorio(false);
        }
      },
      [
        nomeFiltro,
        categoriaFiltro,
        dataInicio,
        dataFim,
      ]
    );

  useEffect(() => {
    async function iniciar() {
      const token =
        obterTokenMaster();

      if (!token) {
        setVerificandoSessao(false);
        return;
      }

      try {
        const sessao =
          await validarSessaoMaster(
            token
          );

        if (
          !sessao.sucesso ||
          !sessao.autenticado
        ) {
          removerTokenMaster();
          setAutenticado(false);
          return;
        }

        setAutenticado(true);

        await carregarOpcoes();

        await listarRelatorioExtraclasse(
          {},
          token
        ).then((resultado) => {
          if (!resultado.sucesso) {
            throw new Error(
              resultado.mensagem ||
              'Não foi possível carregar o relatório.'
            );
          }

          setAtividades(
            resultado.dados
          );

          setQuantidadeAtividades(
            resultado.resumo
              .quantidadeAtividades
          );

          setQuantidadeDias(
            resultado.resumo
              .quantidadeDias
          );

          setCargaHorariaTotal(
            resultado.resumo
              .cargaHorariaTotal
          );
        });
      } catch (error) {
        removerTokenMaster();
        setAutenticado(false);

        setErro(
          error instanceof Error
            ? error.message
            : 'Não foi possível validar a sessão Master.'
        );
      } finally {
        setVerificandoSessao(false);
      }
    }

    iniciar();
  }, [
    carregarOpcoes,
  ]);

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErro('');

    if (
      !usuario.trim() ||
      !senha
    ) {
      setErro(
        'Informe usuário e senha.'
      );
      return;
    }

    setProcessandoLogin(true);

    try {
      const resultado =
        await loginMaster(
          usuario,
          senha
        );

      if (
        !resultado.sucesso ||
        !resultado.token
      ) {
        setErro(
          resultado.mensagem ||
          'Usuário ou senha inválidos.'
        );
        return;
      }

      salvarTokenMaster(
        resultado.token
      );

      setAutenticado(true);
      setSenha('');

      await carregarOpcoes();

      const relatorio =
        await listarRelatorioExtraclasse(
          {},
          resultado.token
        );

      if (!relatorio.sucesso) {
        setErro(
          relatorio.mensagem ||
          'Não foi possível carregar o relatório.'
        );
        return;
      }

      setAtividades(
        relatorio.dados
      );

      setQuantidadeAtividades(
        relatorio.resumo
          .quantidadeAtividades
      );

      setQuantidadeDias(
        relatorio.resumo
          .quantidadeDias
      );

      setCargaHorariaTotal(
        relatorio.resumo
          .cargaHorariaTotal
      );
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível realizar o login.'
      );
    } finally {
      setProcessandoLogin(false);
    }
  }

  async function handleLogout() {
    const token =
      obterTokenMaster();

    try {
      if (token) {
        await logoutMaster(
          token
        );
      }
    } catch {
      // Mesmo que a chamada falhe,
      // a sessão local será encerrada.
    }

    removerTokenMaster();

    setAutenticado(false);
    setAtividades([]);
    setQuantidadeAtividades(0);
    setQuantidadeDias(0);
    setCargaHorariaTotal(0);
    setAtividadeSelecionada(null);
    setErro('');
  }

  async function handleFiltrar(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      dataInicio &&
      dataFim &&
      dataInicio > dataFim
    ) {
      setErro(
        'A data inicial não pode ser posterior à data final.'
      );
      return;
    }

    await consultarRelatorio();
  }

  async function limparFiltros() {
    setNomeFiltro('');
    setCategoriaFiltro('');
    setDataInicio('');
    setDataFim('');
    setErro('');

    await consultarRelatorio({
      nome: '',
      categoria: '',
      data_inicio: '',
      data_fim: '',
    });
  }

  const nomeResumo =
    useMemo(() => {
      if (!nomeFiltro) {
        return 'Todos os funcionários';
      }

      return nomeFiltro;
    }, [
      nomeFiltro,
    ]);

  if (
    verificandoSessao
  ) {
    return (
      <main className="relatorio-page">
        <div className="relatorio-loading">
          Validando sessão Master...
        </div>
      </main>
    );
  }

  if (
    !autenticado
  ) {
    return (
      <main className="relatorio-page">
        <div className="master-login-wrapper">
          <form
            className="master-login-card"
            onSubmit={
              handleLogin
            }
          >
            <div className="master-lock">
              🔒
            </div>

            <h1>
              Relatório Extraclasse
            </h1>

            <p>
              Esta área é restrita ao
              usuário Master.
            </p>

            {erro && (
              <div className="relatorio-alerta relatorio-alerta-erro">
                {erro}
              </div>
            )}

            <div className="relatorio-campo">
              <label
                htmlFor="usuarioMaster"
              >
                Usuário
              </label>

              <input
                id="usuarioMaster"
                type="text"
                value={
                  usuario
                }
                onChange={
                  (
                    event
                  ) =>
                    setUsuario(
                      event
                        .target
                        .value
                    )
                }
                autoComplete="username"
                required
              />
            </div>

            <div className="relatorio-campo">
              <label
                htmlFor="senhaMaster"
              >
                Senha
              </label>

              <input
                id="senhaMaster"
                type="password"
                value={
                  senha
                }
                onChange={
                  (
                    event
                  ) =>
                    setSenha(
                      event
                        .target
                        .value
                    )
                }
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              className="relatorio-botao-principal"
              disabled={
                processandoLogin
              }
            >
              {
                processandoLogin
                  ? 'Entrando...'
                  : 'Entrar como Master'
              }
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="relatorio-page">
      <div className="relatorio-container">
        <header className="relatorio-header">
          <div>
            <h1>
              Relatório Extraclasse
            </h1>

            <p>
              Consulte as atividades
              registradas pelos
              funcionários.
            </p>
          </div>

          <button
            type="button"
            className="relatorio-botao-secundario"
            onClick={
              handleLogout
            }
          >
            Sair do Master
          </button>
        </header>

        {erro && (
          <div className="relatorio-alerta relatorio-alerta-erro">
            {erro}
          </div>
        )}

        <form
          className="relatorio-filtros"
          onSubmit={
            handleFiltrar
          }
        >
          <div className="relatorio-campo">
            <label
              htmlFor="filtroFuncionario"
            >
              Funcionário
            </label>

            <select
              id="filtroFuncionario"
              value={
                nomeFiltro
              }
              onChange={
                (
                  event
                ) =>
                  setNomeFiltro(
                    event
                      .target
                      .value
                  )
              }
            >
              <option value="">
                Todos
              </option>

              {funcionarios.map(
                (
                  funcionario
                ) => (
                  <option
                    key={
                      funcionario.matricula
                    }
                    value={
                      funcionario.nome
                    }
                  >
                    {
                      funcionario.nome
                    }
                  </option>
                )
              )}
            </select>
          </div>

          <div className="relatorio-campo">
            <label
              htmlFor="filtroCategoria"
            >
              Categoria
            </label>

            <select
              id="filtroCategoria"
              value={
                categoriaFiltro
              }
              onChange={
                (
                  event
                ) =>
                  setCategoriaFiltro(
                    event
                      .target
                      .value
                  )
              }
            >
              <option value="">
                Todas
              </option>

              {categorias.map(
                (
                  item
                ) => (
                  <option
                    key={
                      item.id
                    }
                    value={
                      item.categoria
                    }
                  >
                    {
                      item.categoria
                    }
                  </option>
                )
              )}
            </select>
          </div>

          <div className="relatorio-campo">
            <label
              htmlFor="filtroDataInicio"
            >
              Data inicial
            </label>

            <input
              id="filtroDataInicio"
              type="date"
              value={
                dataInicio
              }
              onChange={
                (
                  event
                ) =>
                  setDataInicio(
                    event
                      .target
                      .value
                  )
              }
            />
          </div>

          <div className="relatorio-campo">
            <label
              htmlFor="filtroDataFim"
            >
              Data final
            </label>

            <input
              id="filtroDataFim"
              type="date"
              min={
                dataInicio ||
                undefined
              }
              value={
                dataFim
              }
              onChange={
                (
                  event
                ) =>
                  setDataFim(
                    event
                      .target
                      .value
                  )
              }
            />
          </div>

          <div className="relatorio-acoes-filtro">
            <button
              type="button"
              className="relatorio-botao-secundario"
              onClick={
                limparFiltros
              }
              disabled={
                carregandoRelatorio
              }
            >
              Limpar
            </button>

            <button
              type="submit"
              className="relatorio-botao-principal"
              disabled={
                carregandoRelatorio
              }
            >
              {
                carregandoRelatorio
                  ? 'Consultando...'
                  : 'Buscar'
              }
            </button>
          </div>
        </form>

        <section className="relatorio-resumo">
          <div className="relatorio-card">
            <span>
              Funcionário
            </span>

            <strong className="relatorio-card-texto">
              {
                nomeResumo
              }
            </strong>
          </div>

          <div className="relatorio-card">
            <span>
              Atividades
            </span>

            <strong>
              {
                quantidadeAtividades
              }
            </strong>
          </div>

          <div className="relatorio-card">
            <span>
              Dias realizados
            </span>

            <strong>
              {
                quantidadeDias
              }
            </strong>
          </div>

          <div className="relatorio-card relatorio-card-destaque">
            <span>
              Carga horária
            </span>

            <strong>
              {
                formatarHoras(
                  cargaHorariaTotal
                )
              }
              h
            </strong>
          </div>
        </section>

        <section className="relatorio-tabela-card">
          <div className="relatorio-tabela-header">
            <div>
              <h2>
                Atividades encontradas
              </h2>

              <p>
                {
                  atividades.length
                } registro(s)
              </p>
            </div>
          </div>

          {carregandoRelatorio ? (
            <div className="relatorio-vazio">
              Carregando relatório...
            </div>
          ) : atividades.length === 0 ? (
            <div className="relatorio-vazio">
              Nenhuma atividade encontrada
              para os filtros informados.
            </div>
          ) : (
            <div className="relatorio-table-wrapper">
              <table className="relatorio-table">
                <thead>
                  <tr>
                    <th>
                      Funcionário
                    </th>

                    <th>
                      Matrícula
                    </th>

                    <th>
                      Categoria
                    </th>

                    <th>
                      Período
                    </th>

                    <th>
                      Dias
                    </th>

                    <th>
                      CH/dia
                    </th>

                    <th>
                      CH no filtro
                    </th>

                    <th>
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {atividades.map(
                    (
                      atividade
                    ) => (
                      <tr
                        key={
                          atividade.id
                        }
                      >
                        <td>
                          {
                            atividade.nome
                          }
                        </td>

                        <td>
                          {
                            atividade.matricula
                          }
                        </td>

                        <td>
                          {
                            atividade.categoria
                          }
                        </td>

                        <td>
                          {
                            formatarData(
                              atividade.data_inicio
                            )
                          }
                          {' até '}
                          {
                            formatarData(
                              atividade.data_fim
                            )
                          }
                        </td>

                        <td>
                          {
                            atividade.qtd_dias_periodo
                          }
                        </td>

                        <td>
                          {
                            formatarHoras(
                              atividade.carga_horaria_diaria
                            )
                          }
                          h
                        </td>

                        <td>
                          <strong>
                            {
                              formatarHoras(
                                atividade.carga_horaria_periodo
                              )
                            }
                            h
                          </strong>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="relatorio-botao-link"
                            onClick={
                              () =>
                                setAtividadeSelecionada(
                                  atividade
                                )
                            }
                          >
                            Detalhes
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {atividadeSelecionada && (
          <section className="relatorio-detalhes">
            <div className="relatorio-detalhes-header">
              <div>
                <h2>
                  Detalhes da atividade
                </h2>

                <p>
                  {
                    atividadeSelecionada.nome
                  }
                  {' — '}
                  {
                    atividadeSelecionada.matricula
                  }
                </p>
              </div>

              <button
                type="button"
                className="relatorio-botao-secundario"
                onClick={
                  () =>
                    setAtividadeSelecionada(
                      null
                    )
                }
              >
                Fechar
              </button>
            </div>

            <div className="relatorio-detalhes-grid">
              <div>
                <span>
                  Categoria
                </span>

                <strong>
                  {
                    atividadeSelecionada.categoria
                  }
                </strong>
              </div>

              <div>
                <span>
                  Período cadastrado
                </span>

                <strong>
                  {
                    formatarData(
                      atividadeSelecionada.data_inicio
                    )
                  }
                  {' até '}
                  {
                    formatarData(
                      atividadeSelecionada.data_fim
                    )
                  }
                </strong>
              </div>

              <div>
                <span>
                  Carga diária
                </span>

                <strong>
                  {
                    formatarHoras(
                      atividadeSelecionada.carga_horaria_diaria
                    )
                  }
                  h
                </strong>
              </div>

              <div>
                <span>
                  Carga considerada
                </span>

                <strong>
                  {
                    formatarHoras(
                      atividadeSelecionada.carga_horaria_periodo
                    )
                  }
                  h
                </strong>
              </div>
            </div>

            <div className="relatorio-descricao">
              <span>
                Descrição
              </span>

              <p>
                {
                  atividadeSelecionada.descricao
                }
              </p>
            </div>

            <div className="relatorio-datas">
              <span>
                Datas consideradas no relatório
              </span>

              <div className="relatorio-datas-lista">
                {
                  atividadeSelecionada
                    .datas_periodo
                    .length === 0
                    ? (
                      <em>
                        Nenhuma data.
                      </em>
                    )
                    : atividadeSelecionada
                        .datas_periodo
                        .map(
                          (
                            data
                          ) => (
                            <span
                              key={
                                data
                              }
                            >
                              {
                                formatarData(
                                  data
                                )
                              }
                            </span>
                          )
                        )
                }
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
