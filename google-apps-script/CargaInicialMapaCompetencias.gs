/**
 * ============================================================
 * CARGA INICIAL - MAPA DE COMPETÊNCIAS
 * Versão 1.1 - carga idempotente com validações de integridade
 * SGD - Google Apps Script
 * ============================================================
 *
 * Origem: relação de CURSOS x UNIDADES CURRICULARES fornecida
 * para configuração do Mapa de Competências.
 *
 * Regras desta carga:
 * - Cada CURSO é tratado como uma área de atuação do formulário.
 * - Cada UC é cadastrada apenas uma vez, quando o nome for idêntico.
 * - A mesma UC pode ser vinculada a vários cursos.
 * - Espaços duplicados são normalizados.
 * - Relações curso + UC repetidas são ignoradas.
 * - Registros existentes NÃO são apagados.
 * - Registros existentes NÃO são sobrescritos.
 * - A carga pode ser executada novamente sem criar duplicidades.
 *
 * Execute: carregarCatalogoMapaCompetencias()
 * ============================================================
 */

const MCCARGA_CONFIG = Object.freeze({
  ABA_AREAS: 'AREAS_COMPETENCIA',
  ABA_UCS: 'UNIDADES_CURRICULARES',
  ABA_VINCULOS: 'AREAS_UCS',
  STATUS_ATIVO: 'ATIVO'
});

const MCCARGA_DADOS = [
  [
    "Técnico em Eletrotécnica",
    "Informática Básica"
  ],
  [
    "Técnico em Eletrotécnica",
    "Saúde, Segurança e Meio Ambiente"
  ],
  [
    "Técnico em Eletrotécnica",
    "Gestão da Manutenção"
  ],
  [
    "Técnico em Eletrotécnica",
    "Gestão da Produção"
  ],
  [
    "Técnico em Eletrotécnica",
    "Projeto de Inovação"
  ],
  [
    "Técnico em Eletrotécnica",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Eletrotécnica",
    "Circuitos Elétricos I"
  ],
  [
    "Técnico em Eletrotécnica",
    "Circuitos Elétricos II"
  ],
  [
    "Técnico em Eletrotécnica",
    "Desenho Técnico Aplicado a Projetos Elétricos"
  ],
  [
    "Técnico em Eletrotécnica",
    "Instalação e Manutenção Elétrica Predial"
  ],
  [
    "Técnico em Eletrotécnica",
    "Projetos Elétricos Prediais"
  ],
  [
    "Técnico em Eletrotécnica",
    "Integração de Sistemas Elétricos Automatizados"
  ],
  [
    "Técnico em Eletrotécnica",
    "Instalações Elétricas Industriais"
  ],
  [
    "Técnico em Eletrotécnica",
    "Projetos Elétricos Industriais"
  ],
  [
    "Técnico em Eletrotécnica",
    "Manutenção Elétrica Industrial"
  ],
  [
    "Técnico em Eletrotécnica",
    "Integração de Sistemas de Energias Renováveis"
  ],
  [
    "Técnico em Eletrotécnica",
    "Instalações de Sistemas Elétricos de Potência - SEP"
  ],
  [
    "Técnico em Eletrotécnica",
    "Projetos de Instalações Elétricas de Potência"
  ],
  [
    "Técnico em Eletrotécnica",
    "Manutenção de Sistemas Elétricos de Potência - SEP"
  ],
  [
    "Técnico em Eletrotécnica",
    "Eficiência Energética"
  ],
  [
    "Técnico em Manutenção Automotiva",
    "Informática Básica"
  ],
  [
    "Técnico em Manutenção Automotiva",
    "Saúde, Segurança e Meio ambientes"
  ],
  [
    "Técnico em Manutenção Automotiva",
    "Gestão da Manutenção"
  ],
  [
    "Técnico em Manutenção Automotiva",
    "Projeto de Inovação"
  ],
  [
    "Técnico em Manutenção Automotiva",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Manutenção Automotiva",
    "Fundamentos da tecnologia automotiva"
  ],
  [
    "Técnico em Manutenção Automotiva",
    "Processos básicos de manutenção automotiva"
  ],
  [
    "Técnico em Manutenção Automotiva",
    "Tapeçaria e vidraçaria automotiva"
  ],
  [
    "Técnico em Manutenção Automotiva",
    "Sistemas de funilaria automotiva"
  ],
  [
    "Técnico em Manutenção Automotiva",
    "Sistemas de pintura automotiva"
  ],
  [
    "Técnico em Manutenção Automotiva",
    "Manutenção de sistemas de freios, suspensão e direção de veículos"
  ],
  [
    "Técnico em Manutenção Automotiva",
    "Manutenção de sistemas de transmissão de veículos"
  ],
  [
    "Técnico em Manutenção Automotiva",
    "Manutenção de motores de veículos"
  ],
  [
    "Técnico em Manutenção Automotiva",
    "Manutenção de sistemas eletroeletrônicos veiculares"
  ],
  [
    "Técnico em Manutenção Automotiva",
    "Diagnósticos avançados em gerenciamento eletrônico"
  ],
  [
    "Técnico em Manutenção Automotiva",
    "Vistoria de sinistros"
  ],
  [
    "Técnico em Manutenção Automotiva",
    "Inspeção veicular"
  ],
  [
    "Técnico em Manutenção Automotiva",
    "Gestão de serviços de manutenção veicular"
  ],
  [
    "Técnico em Mecânica",
    "Informática Básica"
  ],
  [
    "Técnico em Mecânica",
    "Gestão da Manutenção"
  ],
  [
    "Técnico em Mecânica",
    "Projeto de Inovação"
  ],
  [
    "Técnico em Mecânica",
    "Gestão da Produção"
  ],
  [
    "Técnico em Mecânica",
    "Saúde, Segurança e Meio ambientes"
  ],
  [
    "Técnico em Mecânica",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Mecânica",
    "Desenho Técnico"
  ],
  [
    "Técnico em Mecânica",
    "Metrologia"
  ],
  [
    "Técnico em Mecânica",
    "Fundamentos da Tecnologia Mecânica"
  ],
  [
    "Técnico em Mecânica",
    "Física Aplicada"
  ],
  [
    "Técnico em Mecânica",
    "Produção Mecânica"
  ],
  [
    "Técnico em Mecânica",
    "Processos de Fabricação"
  ],
  [
    "Técnico em Mecânica",
    "Projetos de Máquinas"
  ],
  [
    "Técnico em Mecânica",
    "Sistemas de Automação Industrial"
  ],
  [
    "Técnico em Mecânica",
    "Desenvolvimento de Automação Mecânica"
  ],
  [
    "Técnico em Mecânica",
    "Manutenção Mecânica Aplicada"
  ],
  [
    "Técnico em Mecânica",
    "Planejamento e Controle da Manutenção"
  ],
  [
    "Técnico em Automação",
    "Informática Básica"
  ],
  [
    "Técnico em Automação",
    "Saúde, Segurança e Meio Ambiente"
  ],
  [
    "Técnico em Automação",
    "Gestão da Manutenção"
  ],
  [
    "Técnico em Automação",
    "Gestão da Produção"
  ],
  [
    "Técnico em Automação",
    "Projeto de Inovação"
  ],
  [
    "Técnico em Automação",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Automação",
    "Fundamentos da Instrumentação"
  ],
  [
    "Técnico em Automação",
    "Fundamentos da Eletrotécnica"
  ],
  [
    "Técnico em Automação",
    "Eletrônica Aplicada a Sistemas Automatizados"
  ],
  [
    "Técnico em Automação",
    "Instrumentação Industrial"
  ],
  [
    "Técnico em Automação",
    "Acionamentos Eletroeletrônicos"
  ],
  [
    "Técnico em Automação",
    "Sistemas Lógicos Programáveis"
  ],
  [
    "Técnico em Automação",
    "Diagramas Hidráulicos e Pneumáticos"
  ],
  [
    "Técnico em Automação",
    "Sistemas de Intertravamento Industrial"
  ],
  [
    "Técnico em Automação",
    "Elementos Finais de Controle"
  ],
  [
    "Técnico em Automação",
    "Técnicas de Controle"
  ],
  [
    "Técnico em Automação",
    "Circuitos Microcontrolados"
  ],
  [
    "Técnico em Automação",
    "Redes Industriais"
  ],
  [
    "Técnico em Automação",
    "Projetos de Sistemas de Controle Industrial"
  ],
  [
    "Técnico em Qualidade",
    "Informática Básica"
  ],
  [
    "Técnico em Qualidade",
    "Saúde, Segurança e Meio Ambiente"
  ],
  [
    "Técnico em Qualidade",
    "Projeto de Inovação"
  ],
  [
    "Técnico em Qualidade",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Qualidade",
    "Introdução a Processos de Melhoria e Inovação"
  ],
  [
    "Técnico em Qualidade",
    "Introdução à Gestão Organizacional"
  ],
  [
    "Técnico em Qualidade",
    "Mapeamento e Controle de Processos"
  ],
  [
    "Técnico em Qualidade",
    "Operacionalização do Sistema de Gestão da Qualidade"
  ],
  [
    "Técnico em Qualidade",
    "Auditoria do Sistema de Gestão da Qualidade"
  ],
  [
    "Técnico em Qualidade",
    "Monitoramento de Produtos e Processos"
  ],
  [
    "Técnico em Biotecnologia",
    "Informática Básica"
  ],
  [
    "Técnico em Biotecnologia",
    "Saúde, Segurança e Meio Ambiente"
  ],
  [
    "Técnico em Biotecnologia",
    "Fundamentos de Química I"
  ],
  [
    "Técnico em Biotecnologia",
    "Fundamentos de Química II"
  ],
  [
    "Técnico em Biotecnologia",
    "Fundamentos em Microbiologia"
  ],
  [
    "Técnico em Biotecnologia",
    "Bioquímica"
  ],
  [
    "Técnico em Biotecnologia",
    "Análise Físico-Química"
  ],
  [
    "Técnico em Biotecnologia",
    "Microbiologia Aplicada"
  ],
  [
    "Técnico em Biotecnologia",
    "Biologia Celular e Molecular"
  ],
  [
    "Técnico em Biotecnologia",
    "Imunologia"
  ],
  [
    "Técnico em Biotecnologia",
    "Industrialização Farmacêutica"
  ],
  [
    "Técnico em Biotecnologia",
    "Industrialização de Imunobiológicos"
  ],
  [
    "Técnico em Biotecnologia",
    "Industrialização de Alimentos e Bebidas"
  ],
  [
    "Técnico em Biotecnologia",
    "Gestão da Produção"
  ],
  [
    "Técnico em Biotecnologia",
    "Gestão da Manutenção"
  ],
  [
    "Técnico em Biotecnologia",
    "Controle Estatístico do Processo"
  ],
  [
    "Técnico em Biotecnologia",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Biotecnologia",
    "Projeto de Inovação"
  ],
  [
    "Técnico em Computação Gráfica",
    "Introdução a Industria 4.0"
  ],
  [
    "Técnico em Computação Gráfica",
    "Saúde, Segurança e Meio Ambiente"
  ],
  [
    "Técnico em Computação Gráfica",
    "Projetos de Inovação"
  ],
  [
    "Técnico em Computação Gráfica",
    "Introdução a Animação e Fundamentos do Cinema"
  ],
  [
    "Técnico em Computação Gráfica",
    "Planejamento e Gerenciamento de Arquivos"
  ],
  [
    "Técnico em Computação Gráfica",
    "Fundamentos de Desenho e Percepção Visual"
  ],
  [
    "Técnico em Computação Gráfica",
    "Desenvolvimento de Animação 2D"
  ],
  [
    "Técnico em Computação Gráfica",
    "Elementos para Animação 3D"
  ],
  [
    "Técnico em Computação Gráfica",
    "Desenvolvimento de Animação 3D"
  ],
  [
    "Técnico em Computação Gráfica",
    "Composição Digital"
  ],
  [
    "Técnico em Computação Gráfica",
    "Efeitos Visuais e Sonoros"
  ],
  [
    "Técnico em Computação Gráfica",
    "Edição de Áudio e Vídeo"
  ],
  [
    "Técnico em Computação Gráfica",
    "Correção de Cor e Mixagem de Áudio"
  ],
  [
    "Técnico em Computação Gráfica",
    "Gestão de Carreira e Negócio"
  ],
  [
    "Técnico em Desenvolvimento de Sistemas",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Desenvolvimento de Sistemas",
    "Saúde, Segurança e Meio Ambiente"
  ],
  [
    "Técnico em Desenvolvimento de Sistemas",
    "Projeto de Inovação"
  ],
  [
    "Técnico em Desenvolvimento de Sistemas",
    "Gestão Ágil e Governança de TI"
  ],
  [
    "Técnico em Desenvolvimento de Sistemas",
    "Fundamentos de Eletroeletrônica Aplicada"
  ],
  [
    "Técnico em Desenvolvimento de Sistemas",
    "Programação de Computadores"
  ],
  [
    "Técnico em Desenvolvimento de Sistemas",
    "Internet das Coisas"
  ],
  [
    "Técnico em Desenvolvimento de Sistemas",
    "Programação de Aplicativos"
  ],
  [
    "Técnico em Desenvolvimento de Sistemas",
    "Banco de Dados"
  ],
  [
    "Técnico em Desenvolvimento de Sistemas",
    "Modelagem de Sistemas"
  ],
  [
    "Técnico em Desenvolvimento de Sistemas",
    "Desenvolvimento de Sistemas"
  ],
  [
    "Técnico em Desenvolvimento de Sistemas",
    "Teste de Sistemas"
  ],
  [
    "Técnico em Desenvolvimento de Sistemas",
    "Manutenção de Sistemas"
  ],
  [
    "Técnico em Desenvolvimento de Sistemas",
    "Implantação de Sistemas"
  ],
  [
    "Técnico em Fabricação Mecânica",
    "Informática Básica"
  ],
  [
    "Técnico em Fabricação Mecânica",
    "Saúde, Segurança e Meio Ambiente"
  ],
  [
    "Técnico em Fabricação Mecânica",
    "Gestão da Manutenção"
  ],
  [
    "Técnico em Fabricação Mecânica",
    "Gestão da Produção"
  ],
  [
    "Técnico em Fabricação Mecânica",
    "Projeto de Inovação"
  ],
  [
    "Técnico em Fabricação Mecânica",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Fabricação Mecânica",
    "Desenho Técnico"
  ],
  [
    "Técnico em Fabricação Mecânica",
    "Metrologia"
  ],
  [
    "Técnico em Fabricação Mecânica",
    "Fundamentos da Mecânica"
  ],
  [
    "Técnico em Fabricação Mecânica",
    "Tecnologia dos Materiais"
  ],
  [
    "Técnico em Fabricação Mecânica",
    "Desenho Assistido por Computador - CAD"
  ],
  [
    "Técnico em Fabricação Mecânica",
    "Processos de Fabricação"
  ],
  [
    "Técnico em Fabricação Mecânica",
    "Processos de Soldagem"
  ],
  [
    "Técnico em Fabricação Mecânica",
    "Processos de Usinagem"
  ],
  [
    "Técnico em Fabricação Mecânica",
    "Manufatura de Usinagem Computadorizada"
  ],
  [
    "Técnico em Fabricação Mecânica",
    "Automação dos Processos de Fabricação"
  ],
  [
    "Técnico em Fabricação Mecânica",
    "Gestão da Qualidade"
  ],
  [
    "Técnico em Fabricação Mecânica",
    "Planejamento e Controle da Produção"
  ],
  [
    "Técnico em Mecânica de Precisão",
    "Saúde Segurança e Meio Ambiente"
  ],
  [
    "Técnico em Mecânica de Precisão",
    "Gestão da Manutenção"
  ],
  [
    "Técnico em Mecânica de Precisão",
    "Informática Básica"
  ],
  [
    "Técnico em Mecânica de Precisão",
    "Projetos de Inovação"
  ],
  [
    "Técnico em Mecânica de Precisão",
    "Gestão da Produção"
  ],
  [
    "Técnico em Mecânica de Precisão",
    "Desenho Técnico"
  ],
  [
    "Técnico em Mecânica de Precisão",
    "Metrologia"
  ],
  [
    "Técnico em Mecânica de Precisão",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Mecânica de Precisão",
    "Processos Básicos de Fabricação Mecânica"
  ],
  [
    "Técnico em Mecânica de Precisão",
    "Fundamentos da Tecnologia Mecânica"
  ],
  [
    "Técnico em Mecânica de Precisão",
    "Planejamento e Controle da Produção"
  ],
  [
    "Técnico em Mecânica de Precisão",
    "Processos de Fabricação de Sistemas Mecânicos de Precisão"
  ],
  [
    "Técnico em Mecânica de Precisão",
    "Otimização de Processos de Produção de Sistemas de Precisão"
  ],
  [
    "Técnico em Mecânica de Precisão",
    "Planejamento e Controle da Manutenção"
  ],
  [
    "Técnico em Mecânica de Precisão",
    "Manutenção Mecânica de Sistemas de Precisão"
  ],
  [
    "Técnico em Mecânica de Precisão",
    "Introdução a Controladores Lógicos Programáveis"
  ],
  [
    "Técnico em Mecânica de Precisão",
    "Desenvolvimento de Sistemas de Automação Mecânica"
  ],
  [
    "Técnico em Mecânica de Precisão",
    "Metodologia de Projetos"
  ],
  [
    "Técnico em Mecânica de Precisão",
    "Projeto de Inovação em Mecânica de Precisão"
  ],
  [
    "Técnico em Instrumentação Industrial",
    "Informática Básica"
  ],
  [
    "Técnico em Instrumentação Industrial",
    "Saúde, Segurança e Meio Ambiente"
  ],
  [
    "Técnico em Instrumentação Industrial",
    "Gestão da Manutenção"
  ],
  [
    "Técnico em Instrumentação Industrial",
    "Gestão da Produção"
  ],
  [
    "Técnico em Instrumentação Industrial",
    "Projeto de Inovação"
  ],
  [
    "Técnico em Instrumentação Industrial",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Instrumentação Industrial",
    "Fundamentos da eletroeletrônica"
  ],
  [
    "Técnico em Instrumentação Industrial",
    "Fundamentos da Instrumentação"
  ],
  [
    "Técnico em Instrumentação Industrial",
    "Desenho Técnico Aplicado à Sistemas Automatizados"
  ],
  [
    "Técnico em Instrumentação Industrial",
    "Medição e Controle de Variáveis de Processos Industriais"
  ],
  [
    "Técnico em Instrumentação Industrial",
    "Gestão dos Processos de Implementação dos Sistemas de Instrumentação e Controle"
  ],
  [
    "Técnico em Instrumentação Industrial",
    "Sistemas de Instrumentação Analítica"
  ],
  [
    "Técnico em Instrumentação Industrial",
    "Sistemas Instrumentados de Segurança (SIS)"
  ],
  [
    "Técnico em Instrumentação Industrial",
    "Comissionamento de Sistemas de Instrumentação e Controle"
  ],
  [
    "Técnico em Instrumentação Industrial",
    "Manutenção de Sistemas de Instrumentação e Controle"
  ],
  [
    "Técnico em Instrumentação Industrial",
    "Projetos de Sistemas de Medição e Controle de Variáveis"
  ],
  [
    "Técnico em Instrumentação Industrial",
    "Projetos de Sistemas Instrumentados de Segurança (SIS)"
  ],
  [
    "Técnico em Programação de Jogos Digitais",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Programação de Jogos Digitais",
    "Saúde, Segurança e Meio Ambiente"
  ],
  [
    "Técnico em Programação de Jogos Digitais",
    "Projeto de Inovação"
  ],
  [
    "Técnico em Programação de Jogos Digitais",
    "Desenvolvimento de Projetos"
  ],
  [
    "Técnico em Programação de Jogos Digitais",
    "Arquitetura de Hardware e Software"
  ],
  [
    "Técnico em Programação de Jogos Digitais",
    "Fundamentos de Jogos Digitais"
  ],
  [
    "Técnico em Programação de Jogos Digitais",
    "Fundamentos de UI / UX Design"
  ],
  [
    "Técnico em Programação de Jogos Digitais",
    "Fundamentos do Design de elementos gráficos de Jogos Digitais"
  ],
  [
    "Técnico em Programação de Jogos Digitais",
    "Fundamentos de Programação de Jogos Digitais"
  ],
  [
    "Técnico em Programação de Jogos Digitais",
    "Lógica de Programação"
  ],
  [
    "Técnico em Programação de Jogos Digitais",
    "Versionamento e Colaboração"
  ],
  [
    "Técnico em Programação de Jogos Digitais",
    "Planejamento e Produção de Elementos Multimídia de Jogos Digitais"
  ],
  [
    "Técnico em Programação de Jogos Digitais",
    "Planejamento e Publicação de Jogos Digitais"
  ],
  [
    "Técnico em Programação de Jogos Digitais",
    "Codificação de sistemas de Jogos Digitais"
  ],
  [
    "Técnico em Programação de Jogos Digitais",
    "Testes de Jogos Digitais"
  ],
  [
    "Técnico em Programação de Jogos Digitais",
    "Manutenção de Jogos Digitais"
  ],
  [
    "Técnico em Design Gráfico",
    "Informática Básica"
  ],
  [
    "Técnico em Design Gráfico",
    "Saúde, Segurança e Meio Ambiente"
  ],
  [
    "Técnico em Design Gráfico",
    "Projeto de Inovação"
  ],
  [
    "Técnico em Design Gráfico",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Design Gráfico",
    "Fundamentos de Teoria da Cor"
  ],
  [
    "Técnico em Design Gráfico",
    "História do Design Gráfico"
  ],
  [
    "Técnico em Design Gráfico",
    "Fundamentos de Desenho e Percepção Visual"
  ],
  [
    "Técnico em Design Gráfico",
    "Fundamentos da Semiótica"
  ],
  [
    "Técnico em Design Gráfico",
    "Fotografia"
  ],
  [
    "Técnico em Design Gráfico",
    "Imagem Digital"
  ],
  [
    "Técnico em Design Gráfico",
    "Tipografia"
  ],
  [
    "Técnico em Design Gráfico",
    "Produção Gráfica"
  ],
  [
    "Técnico em Design Gráfico",
    "Metodologia de Projetos de Mídias Digitais e Impressas"
  ],
  [
    "Técnico em Design Gráfico",
    "Projeto de Identidade Visual"
  ],
  [
    "Técnico em Design Gráfico",
    "Design de Embalagens"
  ],
  [
    "Técnico em Design Gráfico",
    "Design Editorial"
  ],
  [
    "Técnico em Design Gráfico",
    "Design Promocional, Institucional e Sinalização"
  ],
  [
    "Técnico em Design Gráfico",
    "Motion Design"
  ],
  [
    "Técnico em Design Gráfico",
    "Design de Interfaces"
  ],
  [
    "Técnico em Design Gráfico",
    "Projeto de Mídias Integradas"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Informática Básica"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Projeto de Inovação"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Fundamentos de Segurança e Saúde do Trabalho"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Ciências Aplicadas à Segurança e Saúde do Trabalho"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Gestão de Pessoas aplicada à Segurança e Saúde do Trabalho"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Rotinas de Segurança e Saúde do Trabalho"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Higiene Ocupacional"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Coordenação de Programas e Procedimentos de Saúde e Segurança do Trabalho"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Planejamento e Execução de Ações Educativas"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Assessoria e Consultoria em Saúde, Segurança e Meio Ambiente do Trabalho"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Gestão de Auditorias em de Segurança e Saúde do Trabalho"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Monitoramento dos Programas e Documentos de Segurança e Saúde do Trabalho"
  ],
  [
    "Técnico em Sistemas de Energia Renovável",
    "Informática Básica"
  ],
  [
    "Técnico em Sistemas de Energia Renovável",
    "Saúde, Segurança e Meio ambientes"
  ],
  [
    "Técnico em Sistemas de Energia Renovável",
    "Gestão da Manutenção"
  ],
  [
    "Técnico em Sistemas de Energia Renovável",
    "Projeto de Inovação"
  ],
  [
    "Técnico em Sistemas de Energia Renovável",
    "Gestão da Produção"
  ],
  [
    "Técnico em Sistemas de Energia Renovável",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Sistemas de Energia Renovável",
    "Fundamentos da Eletroeletrônica"
  ],
  [
    "Técnico em Sistemas de Energia Renovável",
    "Introdução a Sistemas de Energia Renovável"
  ],
  [
    "Técnico em Sistemas de Energia Renovável",
    "Sistemas Fotovoltaicos"
  ],
  [
    "Técnico em Sistemas de Energia Renovável",
    "Infraestrutura de Sistemas de Energia Renovável"
  ],
  [
    "Técnico em Sistemas de Energia Renovável",
    "Comissionamento de Sistemas de Energia Renovável"
  ],
  [
    "Técnico em Sistemas de Energia Renovável",
    "Sistemas de Aquecimento Solar"
  ],
  [
    "Técnico em Sistemas de Energia Renovável",
    "Operação de Sistemas de Energia Renovável"
  ],
  [
    "Técnico em Sistemas de Energia Renovável",
    "Pequenas Centrais Hidroelétricas"
  ],
  [
    "Técnico em Sistemas de Energia Renovável",
    "Sistemas de Energia Eólica"
  ],
  [
    "Técnico em Sistemas de Energia Renovável",
    "Gestão da Manutenção de Sistemas de Energia Renovável"
  ],
  [
    "Técnico em Sistemas de Energia Renovável",
    "Gestão de Energia e Eficiência Energética"
  ],
  [
    "Técnico em Sistemas de Energia Renovável",
    "Projetos de Sistemas de Energia Renovável"
  ],
  [
    "Técnico em Soldagem",
    "Informática Básica"
  ],
  [
    "Técnico em Soldagem",
    "Saúde, segurança e Meio Ambiente"
  ],
  [
    "Técnico em Soldagem",
    "Gestão da Manutenção"
  ],
  [
    "Técnico em Soldagem",
    "Projeto de Inovação"
  ],
  [
    "Técnico em Soldagem",
    "Gestão da Produção"
  ],
  [
    "Técnico em Soldagem",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Soldagem",
    "Metrologia"
  ],
  [
    "Técnico em Soldagem",
    "Desenho técnico"
  ],
  [
    "Técnico em Soldagem",
    "Fundamentos Físicos"
  ],
  [
    "Técnico em Soldagem",
    "Tecnologia de Materiais"
  ],
  [
    "Técnico em Soldagem",
    "Processos de Corte"
  ],
  [
    "Técnico em Soldagem",
    "Processos de Soldagem"
  ],
  [
    "Técnico em Soldagem",
    "Controle de Qualidade dos Processos de Corte e Solda"
  ],
  [
    "Técnico em Soldagem",
    "Controle de Processos e Materiais"
  ],
  [
    "Técnico em Soldagem",
    "Suporte Técnico em Elaboração e Implementação de Projetos"
  ],
  [
    "Técnico em Logística",
    "Informática Básica"
  ],
  [
    "Técnico em Logística",
    "Saúde, Segurança e Meio Ambiente"
  ],
  [
    "Técnico em Logística",
    "Gestão da Produção"
  ],
  [
    "Técnico em Logística",
    "Projeto de Inovação"
  ],
  [
    "Técnico em Logística",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Logística",
    "Introdução aos Processos Logísticos"
  ],
  [
    "Técnico em Logística",
    "Processos de Armazenagem"
  ],
  [
    "Técnico em Logística",
    "Gestão de Suprimentos"
  ],
  [
    "Técnico em Logística",
    "Projeto de Integração de Processos Logísticos"
  ],
  [
    "Técnico em Logística",
    "Gestão de Transporte e Distribuição"
  ],
  [
    "Técnico em Logística",
    "Logística Sustentável"
  ],
  [
    "Técnico em Logística",
    "Logística Integrada"
  ],
  [
    "Técnico em Informática para Internet",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Informática para Internet",
    "Saúde, Segurança e Meio Ambiente"
  ],
  [
    "Técnico em Informática para Internet",
    "Projeto de Inovação"
  ],
  [
    "Técnico em Informática para Internet",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Informática para Internet",
    "Saúde, Segurança e Meio Ambiente"
  ],
  [
    "Técnico em Informática para Internet",
    "Projeto de Inovação"
  ],
  [
    "Técnico em Informática para Internet",
    "Gestão Ágil e Governança de TI"
  ],
  [
    "Técnico em Informática para Internet",
    "Fundamentos de TI"
  ],
  [
    "Técnico em Informática para Internet",
    "Lógica de Programação"
  ],
  [
    "Técnico em Informática para Internet",
    "Fundamentos de Design"
  ],
  [
    "Técnico em Informática para Internet",
    "Desenvolvimento de Front-End"
  ],
  [
    "Técnico em Informática para Internet",
    "Banco de Dados"
  ],
  [
    "Técnico em Informática para Internet",
    "Desenvolvimento de Back-End"
  ],
  [
    "Técnico em Informática para Internet",
    "Desenvolvimento de APIs"
  ],
  [
    "Técnico em Informática para Internet",
    "Teste de Softwares"
  ],
  [
    "Técnico em Informática para Internet",
    "Implantação de Sistema Web"
  ],
  [
    "Técnico em Eletromecânica",
    "Informática Básica"
  ],
  [
    "Técnico em Eletromecânica",
    "Saúde, Segurança e Meio ambiente"
  ],
  [
    "Técnico em Eletromecânica",
    "Gestão da Manutenção"
  ],
  [
    "Técnico em Eletromecânica",
    "Projeto de Inovação"
  ],
  [
    "Técnico em Eletromecânica",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Eletromecânica",
    "Desenho Técnico"
  ],
  [
    "Técnico em Eletromecânica",
    "Metrologia"
  ],
  [
    "Técnico em Eletromecânica",
    "Fundamentos de Eletricidade Industrial"
  ],
  [
    "Técnico em Eletromecânica",
    "Fundamentos da Mecânica"
  ],
  [
    "Técnico em Eletromecânica",
    "Gestão da Qualidade"
  ],
  [
    "Técnico em Eletromecânica",
    "Tecnologia dos Materiais"
  ],
  [
    "Técnico em Eletromecânica",
    "Máquinas Elétricas e Instalações Elétricas Industriais"
  ],
  [
    "Técnico em Eletromecânica",
    "Desenho Assistido por Computador – CAD"
  ],
  [
    "Técnico em Eletromecânica",
    "Fabricação Mecânica"
  ],
  [
    "Técnico em Eletromecânica",
    "Tecnologia da Soldagem"
  ],
  [
    "Técnico em Eletromecânica",
    "CLP – Controlador lógico programável"
  ],
  [
    "Técnico em Eletromecânica",
    "Eletrohidropneumática"
  ],
  [
    "Técnico em Eletromecânica",
    "Manutenção Mecânica"
  ],
  [
    "Técnico em Manutenção de Máquinas Industriais",
    "Informática Básica"
  ],
  [
    "Técnico em Manutenção de Máquinas Industriais",
    "Saúde, Segurança e Meio Ambiente"
  ],
  [
    "Técnico em Manutenção de Máquinas Industriais",
    "Gestão da Manutenção"
  ],
  [
    "Técnico em Manutenção de Máquinas Industriais",
    "Projeto de Inovação"
  ],
  [
    "Técnico em Manutenção de Máquinas Industriais",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Manutenção de Máquinas Industriais",
    "Desenho Técnico"
  ],
  [
    "Técnico em Manutenção de Máquinas Industriais",
    "Metrologia"
  ],
  [
    "Técnico em Manutenção de Máquinas Industriais",
    "Fundamentos da Mecânica"
  ],
  [
    "Técnico em Manutenção de Máquinas Industriais",
    "Gestão da Qualidade"
  ],
  [
    "Técnico em Manutenção de Máquinas Industriais",
    "Tecnologia dos Materiais"
  ],
  [
    "Técnico em Manutenção de Máquinas Industriais",
    "Otimização de Processos Produtivos"
  ],
  [
    "Técnico em Manutenção de Máquinas Industriais",
    "Fabricação Mecânica Aplicada a Manutenção"
  ],
  [
    "Técnico em Manutenção de Máquinas Industriais",
    "Ensaios mecânicos"
  ],
  [
    "Técnico em Manutenção de Máquinas Industriais",
    "Tecnologia da Recuperação de Componentes Mecânicos"
  ],
  [
    "Técnico em Manutenção de Máquinas Industriais",
    "Planejamento e Controle da Manutenção"
  ],
  [
    "Técnico em Manutenção de Máquinas Industriais",
    "Manutenção de Máquinas e Equipamentos Industriais"
  ],
  [
    "Técnico em Manutenção de Máquinas Industriais",
    "Manutenção de Sistemas Automatizados"
  ],
  [
    "Técnico em Manutenção de Máquinas Industriais",
    "Desenho assistido por Computador"
  ],
  [
    "Técnico em Mecatrônica",
    "Informática Básica"
  ],
  [
    "Técnico em Mecatrônica",
    "Saúde, Segurança e Meio Ambiente"
  ],
  [
    "Técnico em Mecatrônica",
    "Gestão da Manutenção"
  ],
  [
    "Técnico em Mecatrônica",
    "Gestão da Produção"
  ],
  [
    "Técnico em Mecatrônica",
    "Projeto de Inovação"
  ],
  [
    "Técnico em Mecatrônica",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Mecatrônica",
    "Mecânica Aplicada a Sistemas Automatizados"
  ],
  [
    "Técnico em Mecatrônica",
    "Fundamentos da Eletrotécnica"
  ],
  [
    "Técnico em Mecatrônica",
    "Eletrônica Aplicada a Sistemas Automatizados"
  ],
  [
    "Técnico em Mecatrônica",
    "Acionamentos Eletroeletrônicos"
  ],
  [
    "Técnico em Mecatrônica",
    "Sistemas Lógicos Programáveis"
  ],
  [
    "Técnico em Mecatrônica",
    "Circuitos Eletropneumáticos e Eletrohidráulicos Aplicados à Manufatura"
  ],
  [
    "Técnico em Mecatrônica",
    "Modelagem Virtual de Elementos Mecânicos"
  ],
  [
    "Técnico em Mecatrônica",
    "Processos de Manufatura"
  ],
  [
    "Técnico em Mecatrônica",
    "Circuitos Microcontrolados"
  ],
  [
    "Técnico em Mecatrônica",
    "Redes Industriais aplicadas à Indústria 4.0"
  ],
  [
    "Técnico em Mecatrônica",
    "Robótica Industrial"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Informática Básica"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Projeto de Inovação"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Introdução à Indústria 4.0"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Fundamentos de Segurança e Saúde do Trabalho"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Ciências Aplicadas à Segurança e Saúde do Trabalho"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Gestão de Pessoas aplicada à Segurança e Saúde do Trabalho"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Rotinas de Segurança e Saúde do Trabalho"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Higiene Ocupacional"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Coordenação de Programas e Procedimentos de Saúde e Segurança do Trabalho"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Planejamento e Execução de Ações Educativas"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Assessoria e Consultoria em Saúde, Segurança e Meio Ambiente do Trabalho"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Gestão de Auditorias em de Segurança e Saúde do Trabalho"
  ],
  [
    "Técnico em Segurança do Trabalho",
    "Monitoramento dos Programas e Documentos de Segurança e Saúde do Trabalho"
  ],
  [
    "Aprendizagem em Manutenção Mecânica de Automóveis",
    "Fundamentos da Comunicação e Informação"
  ],
  [
    "Aprendizagem em Manutenção Mecânica de Automóveis",
    "Relações Socioprofissionais, Cidadania e Ética"
  ],
  [
    "Aprendizagem em Manutenção Mecânica de Automóveis",
    "Saúde e Segurança do Trabalho"
  ],
  [
    "Aprendizagem em Manutenção Mecânica de Automóveis",
    "Planejamento e Organização do Trabalho"
  ],
  [
    "Aprendizagem em Manutenção Mecânica de Automóveis",
    "Raciocínio Lógico e Análise de Dados"
  ],
  [
    "Aprendizagem em Manutenção Mecânica de Automóveis",
    "Transformação digital no setor industrial"
  ],
  [
    "Aprendizagem em Manutenção Mecânica de Automóveis",
    "Práticas Inovadoras"
  ],
  [
    "Aprendizagem em Manutenção Mecânica de Automóveis",
    "Metrologia"
  ],
  [
    "Aprendizagem em Manutenção Mecânica de Automóveis",
    "Mecânica Básica Automotiva"
  ],
  [
    "Aprendizagem em Manutenção Mecânica de Automóveis",
    "Fundamentos de Eletricidade"
  ],
  [
    "Aprendizagem em Manutenção Mecânica de Automóveis",
    "Sistemas de Freios"
  ],
  [
    "Aprendizagem em Manutenção Mecânica de Automóveis",
    "Sistemas de Suspensão e Direção"
  ],
  [
    "Aprendizagem em Manutenção Mecânica de Automóveis",
    "Sistema de Transmissão"
  ],
  [
    "Aprendizagem em Manutenção Mecânica de Automóveis",
    "Motor de Combustão Interna"
  ],
  [
    "Aprendizagem Industrial em Assistente de Planejamento e Controle da Produção",
    "Fundamentos da Comunicação e Informação"
  ],
  [
    "Aprendizagem Industrial em Assistente de Planejamento e Controle da Produção",
    "Fundamentos da Leitura de Desenhos Técnicos e Metrologia"
  ],
  [
    "Aprendizagem Industrial em Assistente de Planejamento e Controle da Produção",
    "Informática"
  ],
  [
    "Aprendizagem Industrial em Assistente de Planejamento e Controle da Produção",
    "Saúde e Segurança do Trabalho"
  ],
  [
    "Aprendizagem Industrial em Assistente de Planejamento e Controle da Produção",
    "Introdução à Gestão Organizacional e Processos Logísticos"
  ],
  [
    "Aprendizagem Industrial em Assistente de Planejamento e Controle da Produção",
    "Relações Socioprofissionais, Cidadania e Ética"
  ],
  [
    "Aprendizagem Industrial em Assistente de Planejamento e Controle da Produção",
    "Planejamento e Organização do Trabalho"
  ],
  [
    "Aprendizagem Industrial em Assistente de Planejamento e Controle da Produção",
    "Raciocínio Lógico e Análise de Dados"
  ],
  [
    "Aprendizagem Industrial em Assistente de Planejamento e Controle da Produção",
    "Transformação Digital no Setor Industrial"
  ],
  [
    "Aprendizagem Industrial em Assistente de Planejamento e Controle da Produção",
    "Práticas Inovadoras"
  ],
  [
    "Aprendizagem Industrial em Assistente de Planejamento e Controle da Produção",
    "Softwares de Análise de Dados e Business Intelligence (BI)"
  ],
  [
    "Aprendizagem Industrial em Assistente de Planejamento e Controle da Produção",
    "Rotinas de Apoio ADM às Áreas Contábil e Financeiro"
  ],
  [
    "Aprendizagem Industrial em Assistente de Planejamento e Controle da Produção",
    "Rotinas de Apoio ADM às Áreas de Vendas"
  ],
  [
    "Aprendizagem Industrial em Assistente de Planejamento e Controle da Produção",
    "Rotinas de Apoio Administrativos às Áreas de RH"
  ],
  [
    "Aprendizagem Industrial em Assistente de Planejamento e Controle da Produção",
    "Rotinas de Apoio Administrativos às Áreas de Logística, Produção e Projetos"
  ],
  [
    "Aprendizagem Industrial em Assistente de Planejamento e Controle da Produção",
    "Planejamento e Programação da Produção"
  ],
  [
    "Aprendizagem Industrial em Assistente de Planejamento e Controle da Produção",
    "Controle da Produção"
  ],
  [
    "Aprendizagem Industrial em Assistente de Planejamento e Controle da Produção",
    "Processos de Armazenagem"
  ],
  [
    "Aprendizagem Industrial em Assistente de Planejamento e Controle da Produção",
    "Elaboração de Documentos do Sistema da Qualidade"
  ],
  [
    "Aprendizagem Industrial em Assistente de Planejamento e Controle da Produção",
    "Monitoramento de Produtos e Processos"
  ],
  [
    "Aprendizagem Industrial em Controle de Qualidade",
    "Sistema de Gestão Integrado"
  ],
  [
    "Aprendizagem Industrial em Controle de Qualidade",
    "Informática"
  ],
  [
    "Aprendizagem Industrial em Controle de Qualidade",
    "Noções de Meio Ambiente e SGA"
  ],
  [
    "Aprendizagem Industrial em Controle de Qualidade",
    "Tecnologias dos Ensaios e Materiais"
  ],
  [
    "Aprendizagem Industrial em Controle de Qualidade",
    "Trabalho de Pesquisa Técnica"
  ],
  [
    "Aprendizagem em Eletricista Industrial",
    "Fundamentos da Comunicação e Informação"
  ],
  [
    "Aprendizagem em Eletricista Industrial",
    "Relações Socioprofissionais, Cidadania e Ética"
  ],
  [
    "Aprendizagem em Eletricista Industrial",
    "Saúde e Segurança do Trabalho"
  ],
  [
    "Aprendizagem em Eletricista Industrial",
    "Planejamento e Organização do Trabalho"
  ],
  [
    "Aprendizagem em Eletricista Industrial",
    "Raciocínio Lógico e Análise de Dados"
  ],
  [
    "Aprendizagem em Eletricista Industrial",
    "Transformação digital no setor industrial"
  ],
  [
    "Aprendizagem em Eletricista Industrial",
    "Práticas Inovadoras"
  ],
  [
    "Aprendizagem em Eletricista Industrial",
    "Qualidade, Saúde, Meio Ambiente e Segurança do Trabalho aplicados à Eletroeletrônica"
  ],
  [
    "Aprendizagem em Eletricista Industrial",
    "Fundamentos de Eletricidade"
  ],
  [
    "Aprendizagem em Eletricista Industrial",
    "Montagem de Infraestrutura Elétrica"
  ],
  [
    "Aprendizagem em Eletricista Industrial",
    "Instalação de Sistemas Elétricos Prediais"
  ],
  [
    "Aprendizagem em Eletricista Industrial",
    "Instalação de Sistemas Elétricos Industriais I"
  ],
  [
    "Aprendizagem em Eletricista Industrial",
    "Instalação de Sistemas Elétricos Industriais II"
  ],
  [
    "Aprendizagem em Eletricista Industrial",
    "Manutenção Eletroeletrônica Industrial"
  ],
  [
    "Aprendizagem em Eletricista Industrial",
    "Fundamentos de Automação"
  ],
  [
    "Aprendizagem em Eletricista Industrial",
    "Fundamentos da Eletrohidropneumática"
  ],
  [
    "Aprendizagem em Eletricista Industrial",
    "Novas Tecnologias Aplicadas à Eletroeletrônica"
  ],
  [
    "Aprendizagem em Gestão Industrial",
    "Fundamentos da Comunicação e Informação"
  ],
  [
    "Aprendizagem em Gestão Industrial",
    "Relações Socioprofissionais, Cidadania e Ética"
  ],
  [
    "Aprendizagem em Gestão Industrial",
    "Saúde e Segurança do Trabalho"
  ],
  [
    "Aprendizagem em Gestão Industrial",
    "Planejamento e Organização do Trabalho"
  ],
  [
    "Aprendizagem em Gestão Industrial",
    "Raciocínio Lógico e Análise de Dados"
  ],
  [
    "Aprendizagem em Gestão Industrial",
    "Transformação digital no setor industrial"
  ],
  [
    "Aprendizagem em Gestão Industrial",
    "Práticas Inovadoras"
  ],
  [
    "Aprendizagem em Gestão Industrial",
    "Fundamentos de Logística"
  ],
  [
    "Aprendizagem em Gestão Industrial",
    "Fundamentos da Leitura de Desenhos Técnicos e Metrologia"
  ],
  [
    "Aprendizagem em Gestão Industrial",
    "Fundamentos dos Processos Administrativos"
  ],
  [
    "Aprendizagem em Gestão Industrial",
    "Fundamentos da Qualidade"
  ],
  [
    "Aprendizagem em Gestão Industrial",
    "Fundamentos dos Processos Financeiros"
  ],
  [
    "Aprendizagem em Gestão Industrial",
    "Fundamentos dos Processos de Gestão de Pessoas"
  ],
  [
    "Aprendizagem em Gestão Industrial",
    "Informática"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Eletromecânica",
    "Fundamentos da Comunicação e Informação"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Eletromecânica",
    "Relações Socioprofissionais, Cidadania e Ética"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Eletromecânica",
    "Saúde e Segurança do Trabalho"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Eletromecânica",
    "Planejamento e Organização do Trabalho"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Eletromecânica",
    "Raciocínio Lógico e Análise de Dados"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Eletromecânica",
    "Transformação digital no setor industrial"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Eletromecânica",
    "Práticas Inovadoras"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Eletromecânica",
    "Fundamentos Mecânicos"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Eletromecânica",
    "Fundamentos Elétricos"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Eletromecânica",
    "Montagem e Manutenção de Sistemas Mecânicos"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Eletromecânica",
    "Montagem e Manutenção de Sistemas Elétricos"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Eletromecânica",
    "Montagem e Manutenção de Sistemas de Controle e Acionamentos Eletromecânicos"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Mecânica De Máquinas Industriais",
    "Fundamentos da Comunicação e Informação"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Mecânica De Máquinas Industriais",
    "Relações Socioprofissionais, Cidadania e Ética"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Mecânica De Máquinas Industriais",
    "Planejamento e Organização do Trabalho"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Mecânica De Máquinas Industriais",
    "Raciocínio Lógico e Análise de Dados"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Mecânica De Máquinas Industriais",
    "Transformação digital no setor industrial"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Mecânica De Máquinas Industriais",
    "Saúde e Segurança do trabalho"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Mecânica De Máquinas Industriais",
    "Cálculo Aplicado"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Mecânica De Máquinas Industriais",
    "Redação e comunicação"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Mecânica De Máquinas Industriais",
    "Fundamentos da Automação Mecânica"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Mecânica De Máquinas Industriais",
    "Fundamentos da Mecânica Aplicados à Manutenção I"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Mecânica De Máquinas Industriais",
    "Fundamentos da Mecânica Aplicados à Manutenção II"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Mecânica De Máquinas Industriais",
    "Fundamentos de Gestão Aplicados à Manutenção Mecânica"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Mecânica De Máquinas Industriais",
    "Manutenção Corretiva de Máquinas e Equipamentos"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Mecânica De Máquinas Industriais",
    "Fabricação Mecânica Aplicada à Manutenção"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Mecânica De Máquinas Industriais",
    "Manutenção Planejada de Máquinas e Equipamentos"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Mecânica De Máquinas Industriais",
    "Criatividade e Ideação em Projeto de inovação"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Mecânica De Máquinas Industriais",
    "Prototipagem de Negócios Inovadores"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Mecânica De Máquinas Industriais",
    "Modelagem de projetos de Inovação"
  ],
  [
    "Aprendizagem Industrial Em Manutenção Mecânica De Máquinas Industriais",
    "Implementação de negócios inovadores"
  ],
  [
    "Aprendizagem Industrial Em Processo De Produção Industrial",
    "Fundamentos da Comunicação e Informação"
  ],
  [
    "Aprendizagem Industrial Em Processo De Produção Industrial",
    "Relações Socioprofissionais, Cidadania e Ética"
  ],
  [
    "Aprendizagem Industrial Em Processo De Produção Industrial",
    "Planejamento e Organização do Trabalho"
  ],
  [
    "Aprendizagem Industrial Em Processo De Produção Industrial",
    "Raciocínio Lógico e Análise de Dados"
  ],
  [
    "Aprendizagem Industrial Em Processo De Produção Industrial",
    "Transformação digital no setor industrial"
  ],
  [
    "Aprendizagem Industrial Em Processo De Produção Industrial",
    "Práticas Inovadoras"
  ],
  [
    "Aprendizagem Industrial Em Processo De Produção Industrial",
    "Saúde e Segurança do Trabalho"
  ],
  [
    "Aprendizagem Industrial Em Processo De Produção Industrial",
    "Fundamentos da Mecânica aplicados à Processos Produtivos"
  ],
  [
    "Aprendizagem Industrial Em Processo De Produção Industrial",
    "Fundamentos da Eletricidade aplicados à Processos Produtivos"
  ],
  [
    "Aprendizagem Industrial Em Processo De Produção Industrial",
    "Ferramentas e Tecnologias de Processos Produtivos"
  ],
  [
    "Aprendizagem Industrial Em Processo De Produção Industrial",
    "Tecnologia de Máquinas e Equipamentos de Processos Produtivos"
  ],
  [
    "Aprendizagem Industrial Em Processo De Produção Industrial",
    "Prática Profissional na Empresa"
  ]
];

/**
 * Função principal.
 * Pode ser executada novamente com segurança.
 */
function carregarCatalogoMapaCompetencias() {
  const ss = mccargaObterPlanilha();
  const abaAreas = mccargaObterAbaObrigatoria(ss, MCCARGA_CONFIG.ABA_AREAS);
  const abaUcs = mccargaObterAbaObrigatoria(ss, MCCARGA_CONFIG.ABA_UCS);
  const abaVinculos = mccargaObterAbaObrigatoria(ss, MCCARGA_CONFIG.ABA_VINCULOS);

  mccargaValidarCabecalhos(abaAreas, ['id', 'area', 'status']);
  mccargaValidarCabecalhos(abaUcs, ['id', 'codigo', 'unidade_curricular', 'status']);
  mccargaValidarCabecalhos(abaVinculos, ['id', 'area_id', 'uc_id', 'status']);

  const dadosFonte = mccargaPrepararFonte();

  const areasExistentes = mccargaLerTabela(abaAreas);
  const ucsExistentes = mccargaLerTabela(abaUcs);
  const vinculosExistentes = mccargaLerTabela(abaVinculos);

  const areaPorNome = new Map();
  areasExistentes.forEach(linha => {
    const nome = mccargaNormalizar(linha.area);
    const id = String(linha.id || '').trim();

    if (!nome) return;

    if (!id) {
      throw new Error(
        'Existe uma área cadastrada sem ID: "' + nome + '". Corrija a aba AREAS_COMPETENCIA antes da carga.'
      );
    }

    const chave = mccargaChave(nome);

    if (areaPorNome.has(chave) && areaPorNome.get(chave) !== id) {
      throw new Error(
        'Foram encontradas áreas duplicadas com o mesmo nome e IDs diferentes: "' + nome + '".'
      );
    }

    areaPorNome.set(chave, id);
  });

  const ucPorNome = new Map();
  ucsExistentes.forEach(linha => {
    const nome = mccargaNormalizar(linha.unidade_curricular);
    const id = String(linha.id || '').trim();

    if (!nome) return;

    if (!id) {
      throw new Error(
        'Existe uma unidade curricular cadastrada sem ID: "' + nome + '". Corrija a aba UNIDADES_CURRICULARES antes da carga.'
      );
    }

    const chave = mccargaChave(nome);

    if (ucPorNome.has(chave) && ucPorNome.get(chave) !== id) {
      throw new Error(
        'Foram encontradas unidades curriculares duplicadas com o mesmo nome e IDs diferentes: "' + nome + '".'
      );
    }

    ucPorNome.set(chave, id);
  });

  const vinculos = new Set();
  vinculosExistentes.forEach(linha => {
    const areaId = String(linha.area_id || '').trim();
    const ucId = String(linha.uc_id || '').trim();
    if (areaId && ucId) vinculos.add(areaId + '|' + ucId);
  });

  let proxArea = mccargaProximoNumero(areasExistentes.map(x => x.id), 'AREA-');
  let proxUc = mccargaProximoNumero(ucsExistentes.map(x => x.id), 'UC-');
  let proxVinculo = mccargaProximoNumero(vinculosExistentes.map(x => x.id), 'AUC-');

  const novasAreas = [];
  const novasUcs = [];
  const novosVinculos = [];

  // 1) Áreas / cursos
  dadosFonte.cursos.forEach(nomeCurso => {
    const chave = mccargaChave(nomeCurso);
    if (!areaPorNome.has(chave)) {
      const id = 'AREA-' + String(proxArea++).padStart(3, '0');
      areaPorNome.set(chave, id);
      novasAreas.push([id, nomeCurso, MCCARGA_CONFIG.STATUS_ATIVO]);
    }
  });

  // 2) UCs
  dadosFonte.ucs.forEach(nomeUc => {
    const chave = mccargaChave(nomeUc);
    if (!ucPorNome.has(chave)) {
      const numero = proxUc++;
      const id = 'UC-' + String(numero).padStart(3, '0');
      const codigo = 'UC' + String(numero).padStart(3, '0');
      ucPorNome.set(chave, id);
      novasUcs.push([id, codigo, nomeUc, MCCARGA_CONFIG.STATUS_ATIVO]);
    }
  });

  // 3) Vínculos curso x UC
  dadosFonte.pares.forEach(par => {
    const curso = par[0];
    const uc = par[1];
    const areaId = areaPorNome.get(mccargaChave(curso));
    const ucId = ucPorNome.get(mccargaChave(uc));
    const chaveVinculo = areaId + '|' + ucId;

    if (!vinculos.has(chaveVinculo)) {
      const id = 'AUC-' + String(proxVinculo++).padStart(4, '0');
      vinculos.add(chaveVinculo);
      novosVinculos.push([id, areaId, ucId, MCCARGA_CONFIG.STATUS_ATIVO]);
    }
  });

  mccargaAdicionarLinhas(abaAreas, novasAreas);
  mccargaAdicionarLinhas(abaUcs, novasUcs);
  mccargaAdicionarLinhas(abaVinculos, novosVinculos);

  SpreadsheetApp.flush();
  if (typeof mcLimparCacheCatalogos === 'function') mcLimparCacheCatalogos();

  const areasInativas = mccargaLerTabela(abaAreas)
    .filter(linha => {
      const nome = mccargaNormalizar(linha.area);
      const status = mccargaNormalizar(linha.status).toUpperCase();
      return nome && status && status !== MCCARGA_CONFIG.STATUS_ATIVO;
    })
    .map(linha => ({
      id: String(linha.id || '').trim(),
      area: mccargaNormalizar(linha.area),
      status: mccargaNormalizar(linha.status)
    }));

  const ucsInativas = mccargaLerTabela(abaUcs)
    .filter(linha => {
      const nome = mccargaNormalizar(linha.unidade_curricular);
      const status = mccargaNormalizar(linha.status).toUpperCase();
      return nome && status && status !== MCCARGA_CONFIG.STATUS_ATIVO;
    })
    .map(linha => ({
      id: String(linha.id || '').trim(),
      unidadeCurricular: mccargaNormalizar(linha.unidade_curricular),
      status: mccargaNormalizar(linha.status)
    }));

  const resultado = {
    sucesso: true,
    fonte: {
      linhasRecebidas: MCCARGA_DADOS.length,
      cursosDistintos: dadosFonte.cursos.length,
      ucsDistintas: dadosFonte.ucs.length,
      vinculosDistintos: dadosFonte.pares.length,
      duplicidadesExatasIgnoradas: MCCARGA_DADOS.length - dadosFonte.pares.length
    },
    inseridosNestaExecucao: {
      areas: novasAreas.length,
      unidadesCurriculares: novasUcs.length,
      vinculos: novosVinculos.length
    },
    avisos: {
      areasInativas: areasInativas,
      unidadesCurricularesInativas: ucsInativas
    },
    mensagem:
      areasInativas.length || ucsInativas.length
        ? 'Carga concluída. Há registros inativos no catálogo; eles não aparecerão no formulário enquanto permanecerem inativos.'
        : 'Carga do catálogo do Mapa de Competências concluída com sucesso.'
  };

  console.log(JSON.stringify(resultado, null, 2));
  return resultado;
}

/**
 * Mostra o resumo dos dados antes/depois da carga sem alterar planilhas.
 */
function visualizarResumoCargaMapaCompetencias() {
  const fonte = mccargaPrepararFonte();
  const resumo = {
    linhasRecebidas: MCCARGA_DADOS.length,
    cursosDistintos: fonte.cursos.length,
    unidadesCurricularesDistintas: fonte.ucs.length,
    vinculosCursoUcDistintos: fonte.pares.length,
    duplicidadesExatas: MCCARGA_DADOS.length - fonte.pares.length
  };
  console.log(JSON.stringify(resumo, null, 2));
  return resumo;
}

/**
 * Verifica se todos os cursos, UCs e vínculos da fonte estão cadastrados.
 * Não altera nenhuma informação.
 */
function validarCargaMapaCompetencias() {
  const ss = mccargaObterPlanilha();
  const abaAreas = mccargaObterAbaObrigatoria(ss, MCCARGA_CONFIG.ABA_AREAS);
  const abaUcs = mccargaObterAbaObrigatoria(ss, MCCARGA_CONFIG.ABA_UCS);
  const abaVinculos = mccargaObterAbaObrigatoria(ss, MCCARGA_CONFIG.ABA_VINCULOS);
  const fonte = mccargaPrepararFonte();

  const areas = mccargaLerTabela(abaAreas);
  const ucs = mccargaLerTabela(abaUcs);
  const vinculos = mccargaLerTabela(abaVinculos);

  const areaPorNome = new Map();
  areas.forEach(x => {
    if (x.area && x.id) areaPorNome.set(mccargaChave(x.area), String(x.id).trim());
  });

  const ucPorNome = new Map();
  ucs.forEach(x => {
    if (x.unidade_curricular && x.id) ucPorNome.set(mccargaChave(x.unidade_curricular), String(x.id).trim());
  });

  const setVinculos = new Set(
    vinculos
      .filter(x => x.area_id && x.uc_id)
      .map(x => String(x.area_id).trim() + '|' + String(x.uc_id).trim())
  );

  const cursosAusentes = fonte.cursos.filter(c => !areaPorNome.has(mccargaChave(c)));
  const ucsAusentes = fonte.ucs.filter(u => !ucPorNome.has(mccargaChave(u)));
  const vinculosAusentes = [];

  fonte.pares.forEach(par => {
    const areaId = areaPorNome.get(mccargaChave(par[0]));
    const ucId = ucPorNome.get(mccargaChave(par[1]));
    if (!areaId || !ucId || !setVinculos.has(areaId + '|' + ucId)) {
      vinculosAusentes.push({ curso: par[0], unidadeCurricular: par[1] });
    }
  });

  const cursosFonte = new Set(
    fonte.cursos.map(c => mccargaChave(c))
  );

  const ucsFonte = new Set(
    fonte.ucs.map(u => mccargaChave(u))
  );

  const cursosInativos = areas
    .filter(x =>
      cursosFonte.has(mccargaChave(x.area)) &&
      mccargaNormalizar(x.status).toUpperCase() !== MCCARGA_CONFIG.STATUS_ATIVO
    )
    .map(x => ({
      id: String(x.id || '').trim(),
      curso: mccargaNormalizar(x.area),
      status: mccargaNormalizar(x.status)
    }));

  const ucsInativas = ucs
    .filter(x =>
      ucsFonte.has(mccargaChave(x.unidade_curricular)) &&
      mccargaNormalizar(x.status).toUpperCase() !== MCCARGA_CONFIG.STATUS_ATIVO
    )
    .map(x => ({
      id: String(x.id || '').trim(),
      unidadeCurricular: mccargaNormalizar(x.unidade_curricular),
      status: mccargaNormalizar(x.status)
    }));

  const resultado = {
    sucesso:
      cursosAusentes.length === 0 &&
      ucsAusentes.length === 0 &&
      vinculosAusentes.length === 0 &&
      cursosInativos.length === 0 &&
      ucsInativas.length === 0,
    cursosAusentes: cursosAusentes,
    unidadesCurricularesAusentes: ucsAusentes,
    quantidadeVinculosAusentes: vinculosAusentes.length,
    vinculosAusentes: vinculosAusentes,
    cursosInativos: cursosInativos,
    unidadesCurricularesInativas: ucsInativas
  };

  console.log(JSON.stringify(resultado, null, 2));
  return resultado;
}

function mccargaPrepararFonte() {
  const pares = [];
  const cursos = [];
  const ucs = [];
  const paresVistos = new Set();
  const cursosVistos = new Set();
  const ucsVistas = new Set();

  MCCARGA_DADOS.forEach(linha => {
    const curso = mccargaNormalizar(linha[0]);
    const uc = mccargaNormalizar(linha[1]);
    if (!curso || !uc) return;

    const chaveCurso = mccargaChave(curso);
    const chaveUc = mccargaChave(uc);
    const chavePar = chaveCurso + '||' + chaveUc;

    if (!cursosVistos.has(chaveCurso)) {
      cursosVistos.add(chaveCurso);
      cursos.push(curso);
    }

    if (!ucsVistas.has(chaveUc)) {
      ucsVistas.add(chaveUc);
      ucs.push(uc);
    }

    if (!paresVistos.has(chavePar)) {
      paresVistos.add(chavePar);
      pares.push([curso, uc]);
    }
  });

  return { pares: pares, cursos: cursos, ucs: ucs };
}

function mccargaObterPlanilha() {
  const id = PropertiesService.getScriptProperties().getProperty('PLANILHA_ID');
  if (id) return SpreadsheetApp.openById(id);

  const ativa = SpreadsheetApp.getActiveSpreadsheet();
  if (!ativa) throw new Error('PLANILHA_ID não configurado e nenhuma planilha ativa foi encontrada.');
  return ativa;
}

function mccargaObterAbaObrigatoria(ss, nome) {
  const aba = ss.getSheetByName(nome);
  if (!aba) {
    throw new Error('A aba "' + nome + '" não foi encontrada. Execute configurarModuloMapaCompetencias() primeiro.');
  }
  return aba;
}

function mccargaValidarCabecalhos(aba, esperados) {
  if (aba.getLastColumn() < esperados.length) {
    throw new Error('A aba "' + aba.getName() + '" não possui a estrutura esperada.');
  }

  const atuais = aba.getRange(1, 1, 1, esperados.length).getValues()[0].map(mccargaNormalizar);
  esperados.forEach((nome, i) => {
    if (mccargaChave(atuais[i]) !== mccargaChave(nome)) {
      throw new Error(
        'Cabeçalho inválido na aba "' + aba.getName() + '", coluna ' + (i + 1) +
        '. Esperado: "' + nome + '". Encontrado: "' + atuais[i] + '".'
      );
    }
  });
}

function mccargaLerTabela(aba) {
  const ultimaLinha = aba.getLastRow();
  const ultimaColuna = aba.getLastColumn();
  if (ultimaLinha < 2 || ultimaColuna < 1) return [];

  const matriz = aba.getRange(1, 1, ultimaLinha, ultimaColuna).getValues();
  const cabecalhos = matriz.shift().map(mccargaNormalizar);

  return matriz
    .filter(linha => linha.some(valor => String(valor).trim() !== ''))
    .map(linha => {
      const obj = {};
      cabecalhos.forEach((cab, i) => obj[cab] = linha[i]);
      return obj;
    });
}

function mccargaAdicionarLinhas(aba, linhas) {
  if (!linhas || linhas.length === 0) return;
  aba.getRange(aba.getLastRow() + 1, 1, linhas.length, linhas[0].length).setValues(linhas);
}

function mccargaProximoNumero(ids, prefixo) {
  let maior = 0;
  ids.forEach(id => {
    const texto = String(id || '').trim();
    const regex = new RegExp('^' + prefixo + '(\\d+)$', 'i');
    const match = texto.match(regex);
    if (match) maior = Math.max(maior, Number(match[1]) || 0);
  });
  return maior + 1;
}

function mccargaNormalizar(valor) {
  return String(valor == null ? '' : valor)
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mccargaChave(valor) {
  return mccargaNormalizar(valor).toLocaleLowerCase('pt-BR');
}
