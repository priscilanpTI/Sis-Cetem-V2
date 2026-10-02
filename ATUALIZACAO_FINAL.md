# Atualização final — instruções

## 1. Faça uma cópia de segurança

Antes de substituir os códigos, faça uma cópia da planilha Google Sheets e, se desejar, uma cópia do projeto Apps Script atual.

## 2. Apps Script

No mesmo projeto Apps Script que já está funcionando:

1. Substitua integralmente `Code.gs` pelo arquivo `google-apps-script/Code.gs`.
2. Substitua integralmente `MapaCompetencias.gs` pelo arquivo `google-apps-script/MapaCompetencias.gs`.
3. Substitua integralmente `CargaInicialMapaCompetencias.gs` pelo arquivo correspondente deste pacote.
4. Crie um novo arquivo chamado `Funcionarios.gs` e cole integralmente `google-apps-script/Funcionarios.gs`.
5. Exclua `RotasMapaCompetencias.gs` caso ainda exista. O roteamento já está centralizado em `Code.gs`.
6. Salve o projeto.

## 3. Execute a migração sem apagar dados existentes

Execute no editor do Apps Script:

```text
migrarCadastroFuncionarios
```

A função preserva os registros existentes e garante que a aba `FUNCIONARIOS` tenha os campos necessários:

```text
id | matricula | nome | email | status
```

> A posição física das colunas não precisa ser alterada manualmente. O código localiza as colunas pelo cabeçalho.

Depois da migração, abra a aba `FUNCIONARIOS` e **preencha o e-mail oficial de todos os funcionários ativos**.

Para conferir quem ainda está sem e-mail, execute:

```text
diagnosticarEmailsFuncionarios
```

## 4. Atualize a estrutura dos módulos

Execute:

```text
configurarModuloExtraclasse
configurarModuloMapaCompetencias
```

O Mapa criará, se ainda não existir, a nova aba:

```text
FUNCIONARIOS_CURSOS
```

Ela é necessária para registrar quais cursos cada instrutor selecionou.

O catálogo de cursos/UCs existente é preservado. Só execute `carregarCatalogoMapaCompetencias` novamente se você realmente precisar recarregar o catálogo.

## 5. Autorize o envio de e-mails

Execute uma vez:

```text
testarPermissaoEmailSgd
```

O Google poderá solicitar uma nova autorização por causa do uso do `MailApp`. A função não envia e-mail; apenas confirma a permissão e mostra a cota disponível.

Os e-mails automáticos estão sujeitos às cotas da conta Google que executa o Web App.

## 6. Publique nova versão do Web App

No Apps Script:

**Implantar → Gerenciar implantações → Editar → Nova versão → Implantar**

Mantenha a mesma URL `/exec` configurada no `.env` do React quando a implantação permitir isso.

## 7. Front-end

Substitua o projeto atual pelos arquivos deste pacote ou copie os arquivos completos correspondentes.

Depois:

```bash
npm install
npm run dev
```

Teste as rotas:

```text
/agendamentos
/novo
/extraclasse
/mapa-competencias
/relatorio-extraclasse
/relatorio-competencias
```

## 8. Como ficou a privacidade da matrícula

As telas públicas recebem apenas:

```text
id interno + nome
```

A matrícula digitada é enviada ao Apps Script para validação. Se estiver errada, a resposta é genérica:

> A matrícula informada não corresponde ao funcionário selecionado. Verifique e tente novamente.

O sistema não devolve a matrícula correta ao navegador.

O e-mail também não é enviado na lista pública. Ele só é retornado depois que **nome/ID + matrícula** são validados.

## 9. Login Master único

O menu lateral possui uma única opção **Acesso Master**.

Após o login, a mesma sessão libera:

- visualização completa e cancelamento em Agendamentos;
- Relatório Extraclasse;
- Relatório de Competências.

Não existem mais três formulários de login separados.

A sessão é guardada apenas no `sessionStorage`, portanto encerra quando a sessão da aba/navegador termina. O backend continua validando o token.

## 10. Mapa de Competências com múltiplos cursos

Após validar a identidade, o instrutor pode selecionar vários cursos por checkbox.

O sistema:

1. reúne as UCs de todos os cursos selecionados;
2. remove UCs repetidas;
3. mantém uma única competência por `funcionário + UC`;
4. grava os cursos selecionados em `FUNCIONARIOS_CURSOS`;
5. utiliza esses cursos reais no relatório Master.

### Registros antigos do mapa

Competências antigas são preservadas. Porém, versões anteriores não gravavam explicitamente os cursos escolhidos. Por isso, um instrutor que já havia preenchido o mapa antes desta atualização deve abrir o formulário, selecionar seus cursos e salvar novamente para preencher `FUNCIONARIOS_CURSOS` com precisão.

## 11. E-mails automáticos

### Novo agendamento
Envia resumo da sala, período, dias, horário, softwares e código da reserva.

### Cancelamento Master
Envia aviso ao e-mail armazenado no agendamento.

### Extraclasse
Envia categoria, período, dias realizados, carga diária, carga total e código.

### Mapa de Competências
Envia os cursos selecionados e um resumo das classificações Apto / Parcialmente apto / Não apto.

Se o registro for salvo mas a cota/e-mail falhar, o sistema preserva o registro e informa a falha de notificação.

## 12. Otimizações aplicadas

- Catálogos estáticos ficam em cache por alguns minutos no Apps Script.
- Catálogos estáticos ficam em cache no `sessionStorage` do navegador.
- Matrículas não são baixadas para o navegador.
- Alterações múltiplas no Mapa são escritas em lote, reduzindo chamadas ao Google Sheets.
- A seleção de cursos de um funcionário é sincronizada em lote.
- O login Master é validado uma única vez pelo contexto global.

> O Google Apps Script ainda pode apresentar alguns segundos de demora na **primeira chamada após um período sem uso** por causa do cold start da própria plataforma. As chamadas seguintes tendem a aproveitar os caches implementados.

## 13. Teste funcional recomendado

Faça o teste com um funcionário de teste ou registro controlado:

1. selecione o nome e digite matrícula errada → deve rejeitar sem revelar a matrícula;
2. digite matrícula correta → e-mail aparece;
3. faça um agendamento → verifique planilha e e-mail;
4. entre como Master uma única vez;
5. confirme que Agendamentos habilita cancelamento e os dois relatórios abrem sem novo login;
6. cancele a reserva → confirme e-mail de cancelamento;
7. registre Extraclasse → confirme e-mail;
8. no Mapa, marque dois cursos e valide se UCs repetidas aparecem uma única vez;
9. salve o Mapa → verifique `COMPETENCIAS`, `FUNCIONARIOS_CURSOS`, histórico e e-mail;
10. abra Relatório de Competências e filtre pelos cursos efetivamente selecionados.
