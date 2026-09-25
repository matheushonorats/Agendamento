# Teste e publicação segura do Portal do Monitor

## O que já foi preservado

- A versão local anterior às correções está no Git, na referência `backup/antes-correcoes-2026-09-25` (commit `80f5663`).
- Foi criada uma cópia da planilha de produção, com o Apps Script anexado, chamada **BACKUP - Agendamento Sítio Arqueológico - antes das correções - 2026-09-25**. Mantenha essa cópia sem testes nem alterações.
- Alterar arquivos neste repositório não publica o portal. A implantação usada pelos monitores permanece separada.

## Preparar um ambiente de teste

1. Faça **outra cópia** da planilha de backup e dê o nome `TESTE - Portal do Monitor - não usar para agendamentos reais`. Não use a cópia de backup como área de testes.
2. Na cópia de teste, abra **Extensões → Apps Script**. Substitua o conteúdo de `Código.gs` e `index.html` pelos arquivos deste repositório. Confira se o fuso horário do projeto é `America/Sao_Paulo` e se as abas `Monitores Credenciados`, `Respostas ao formulário 1` e `Datas_Bloqueadas` continuam presentes. A coluna W (`CPFs Auxiliares`) será criada no primeiro novo agendamento; confira se ela não interfere em fórmulas ou relatórios da cópia.
3. Crie uma **implantação de teste** do aplicativo da Web e use apenas o endereço dessa implantação. Não altere ainda o endereço usado na página de turismo. Ao autorizar o script, confira especialmente a nova permissão de envio de e-mail usada pelo código de confirmação.
4. Na aba de monitores da cópia de teste, use pelo menos dois cadastros de teste com CPFs válidos e e-mails sob seu controle. Não use o e-mail de um monitor real para os testes de código e recuperação. Deixe um cadastro sem senha e outro com senha para exercitar os dois caminhos.

## Conferências funcionais

Marque cada item somente depois de observar o resultado no portal de teste e na **planilha de teste**.

| Teste | Resultado esperado |
| --- | --- |
| Login com senha já existente | Abre o painel e mostra o histórico, sem exigir novo cadastro. |
| Primeiro acesso com CPF do cadastro de teste | Exibe apenas o e-mail mascarado; envia código ao e-mail cadastrado. Código incorreto não abre os dados pessoais. Código correto permite criar senha e entrar. |
| Recuperação de senha | CPF e e-mail cadastrado enviam código; sem código válido a senha não muda. Após confirmar e salvar, a nova senha funciona. |
| Data no calendário | Hoje e amanhã não são selecionáveis; uma data a partir de dois dias fica disponível se não houver bloqueio. |
| Horário | Horário após 14h é rejeitado com explicação sobre o fechamento às 18h. |
| Grupo de até 15 pessoas | Pode ser enviado sem auxiliar; aparece como `Pendente`. |
| Grupo de 16 pessoas | Exige ao menos um auxiliar. O pedido aparece como `Aguardando Auxiliares` para o principal e como convite para o auxiliar. |
| Aceite do auxiliar | O convite passa para `Aceito`; após todos aceitarem, o pedido passa a `Pendente`. Na coluna R ficam os nomes, na V os aceites por nome e na nova W os CPFs na mesma ordem. |
| Recusa do auxiliar | Somente um pedido `Aguardando Auxiliares` é cancelado, com motivo registrado. |
| Solicitação confirmada antiga com auxiliar | Tentar responder novamente ao convite retorna erro e **não modifica** o status nem o motivo. Faça esse teste apenas na cópia. |
| Agendamento duplicado do mesmo monitor na mesma data | O segundo envio é rejeitado, inclusive se a página tiver sido recarregada. |
| Capacidade simultânea | Com dois monitores de teste, tente enviar grupos de 30 e 25 pessoas no mesmo período. Apenas um pedido deve ser aceito quando a soma ultrapassaria 50. |
| Cancelamento | O principal consegue cancelar dentro do prazo; auxiliar não consegue. Pedido confirmado ou pendente cancelado libera vagas na consulta seguinte. |
| Busca e detalhes | Histórico, filtros, detalhes e nomes de auxiliares permanecem legíveis. |

## Conferência visual

Abra a implantação de teste no computador e em um celular, ou use janelas estreita e larga. Examine login, primeiro acesso, recuperação, painel, formulário, calendário e detalhes. Confirme que não há texto cortado, cartões apertados, botões sobrepostos ou rolagem interna desnecessária. Teste também zoom de 200% e navegação por teclado nos campos e nas orientações.

Para reproduzir a página de turismo, crie uma **página de teste** com o bloco de incorporação do [README](README.md#️-instruções-de-incorporação-do-iframe), usando o endereço da implantação de teste. No celular, deslize pelo meio do formulário, da lista de solicitações e dos resultados de busca: a página inteira deve descer com um único gesto, sem exigir tocar na borda direita do iframe. Passe de uma tela alta para uma curta e confira que não sobra uma grande área vazia. Abra um modal de detalhes e verifique sua rolagem própria. Teste também abrir a implantação diretamente, fora do iframe.

## Protocolos antigos: teste antes de executar na produção

1. Na **cópia de teste**, execute `migrarProtocolosEmBranco` pelo editor do Apps Script **sem argumento**. Ela retorna apenas a quantidade e os números das linhas vazias; não grava nada.
2. Compare essa prévia com a coluna U. Verifique que protocolos já existentes, inclusive os antigos de oito caracteres, não estão na lista.
3. Nas **propriedades do script de teste**, defina `MIGRACAO_PROTOCOLOS_AUTORIZADA` como `SIM`. Execute `executarMigracaoProtocolosEmBranco`. Remova a propriedade logo após a execução.
4. Execute novamente `migrarProtocolosEmBranco`: o total deve ser zero. Verifique que não há protocolos duplicados e que os pedidos antigos abrem nos detalhes.

## Publicação, somente após os testes

1. Compare o código da implantação atual com o backup. Se houve mudança de produção depois da cópia, incorpore-a antes de publicar.
2. Faça **nova cópia da planilha de produção imediatamente antes da publicação**, pois a primeira cópia é uma fotografia de 25/09/2026 e novos pedidos podem ter chegado desde então. Preserve também o identificador da versão atual da implantação do Apps Script.
3. Em horário de baixo uso, atualize o projeto de Apps Script de produção com os dois arquivos testados. Confira a prévia da migração de protocolos, execute a migração com a propriedade de autorização e remova a propriedade. Confirme que o total pendente voltou a zero.
4. Crie uma nova versão da implantação usada pela página de turismo, preservando o mesmo endereço do aplicativo da Web. Atualize o trecho de incorporação da página de turismo com o bloco testado do README e preserve a versão anterior desse trecho para reversão. Verifique imediatamente login, histórico, nova solicitação, aceite e rolagem no celular em contas controladas pela SETUR. Observe os registros de execução do Apps Script e os novos registros da planilha.
5. Se login, histórico ou envio falharem, volte a implantação à versão anterior. Não restaure a planilha inteira por cima de pedidos recebidos após o backup. Corrija apenas os dados afetados, comparando com a cópia e com o histórico de versões.

## Verificação automática local

Execute `node --test tests/regras.test.cjs`. Esses testes exercitam regras do servidor com uma planilha simulada. Eles não substituem os testes na cópia real do Google Sheets, especialmente envio de e-mail, permissões, fuso horário e implantação.
