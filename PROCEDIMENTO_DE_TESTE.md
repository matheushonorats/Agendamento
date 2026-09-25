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

### Criar a primeira conta administrativa na cópia de teste

1. No projeto de Apps Script da **cópia de teste**, abra **Configurações do projeto → Propriedades do script**. Crie `ADMIN_INICIAL_CPF`, `ADMIN_INICIAL_EMAIL`, `ADMIN_INICIAL_NOME` e `ADMIN_INICIAL_SENHA`. Use CPF válido, e-mail ao qual você tenha acesso e senha temporária com ao menos 12 caracteres, letras e números. Não reutilize a senha de outro serviço.
2. Execute `configurarAdministradorInicial` pelo editor e autorize o acesso. Confira a nova aba `Administradores`: a coluna `Senha Hash` deve conter apenas o resumo hexadecimal, nunca a senha digitada. Confira também que as quatro propriedades temporárias foram removidas. Não compartilhe a planilha com pessoas que não devam ver hashes, dados pessoais e logs.
3. Acesse a implantação de teste com esse CPF/e-mail e senha. O painel administrativo deve abrir. Se já existir administrador na aba, a rotina inicial bloqueia nova criação; não a execute uma segunda vez. Outras contas são criadas pelo gestor no próprio painel, sem senha inicial; cada uma usa **Meu Primeiro Acesso** e código recebido por e-mail.

## Conferências funcionais

Marque cada item somente depois de observar o resultado no portal de teste e na **planilha de teste**.

| Teste | Resultado esperado |
| --- | --- |
| Login com senha já existente | Abre o painel e mostra o histórico, sem exigir novo cadastro. |
| Primeiro acesso com CPF do cadastro de teste | Exibe apenas o e-mail mascarado; envia código ao e-mail cadastrado. Código incorreto não abre os dados pessoais. Código correto permite criar senha e entrar. |
| Recuperação de senha | CPF e e-mail cadastrado enviam código; sem código válido a senha não muda. Após confirmar e salvar, a nova senha funciona. |
| Data no calendário | Hoje não é selecionável; amanhã fica disponível se não houver bloqueio ou lotação. |
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
| Pedido antigo sem protocolo | Aparece como `Registro antigo · linha N`, com data, horário, tipo, origem e agência quando houver. Abre os detalhes sem gravar automaticamente a coluna U. Se a linha for movida na planilha, atualize a página antes de tentar abrir novamente. |
| Sair da conta | Remove a sessão e volta ao login. Atualizar a página não deve reabrir o painel. |
| Trocar senha logado | Sem código confirmado, a senha não muda. Envie e confirme o código pelo e-mail já cadastrado; depois salve a nova senha e entre novamente. |
| Busca de auxiliares | Digite duas letras, selecione um nome, apague a busca e confirme que o selecionado continua visível. |
| Origem do grupo | Digite parte de uma cidade, selecione uma sugestão e confirme o formato `Cidade/UF`. |
| Origem digitada livremente | `Sao Paulo` e `caraguatatuba/sp` são gravados como `São Paulo/SP` e `Caraguatatuba/SP`. Nome desconhecido sem UF é rejeitado; um país fora da lista pode ser informado como `País: Nome`. |

## Conferências do painel administrativo

Use somente contas e pedidos de teste. Crie um segundo administrador com permissões limitadas para verificar tanto as opções visíveis quanto o bloqueio no servidor.

| Teste | Resultado esperado |
| --- | --- |
| Login comum e administrativo | O mesmo login leva o monitor ao seu painel e o administrador ao painel administrativo. |
| Permissões | Uma conta sem determinada permissão não vê a aba/ação e recebe erro se tentar chamar a operação diretamente. Somente o gestor cria, altera permissões ou desativa administradores. |
| Primeiro acesso administrativo | A conta criada pelo gestor está sem hash; confirma código enviado ao seu e-mail, cria a senha e consegue entrar. |
| Solicitações | Busca e filtro por status mostram os pedidos corretos. Aprovar ou negar funciona apenas em `Pendente`; negar exige motivo. `Aguardando Auxiliares` não pode ser aprovado. |
| Detalhes administrativos | Clique no cartão ou em **Ver detalhes**. Confira dados do grupo, agência, contato, auxiliares e status. Datas aparecem em `dd/mm/aaaa`. |
| Pendências | Sem aplicar filtro, os pedidos `Pendente` aparecem primeiro, com contagem e destaque. Após decisão ou cancelamento, a contagem diminui ao atualizar a lista. |
| Cancelamento administrativo | Um pedido `Confirmado`, `Pendente` ou `Aguardando Auxiliares` pode ser cancelado com motivo obrigatório. Confira o novo status no painel do administrador, na conta do monitor e na planilha; uma segunda tentativa é rejeitada. |
| Bloqueio de data | Bloqueie uma data com motivo, confira no calendário do monitor e depois desbloqueie. Uma data impossível, como 30/02, é rejeitada. Pedidos já existentes precisam de tratamento manual. |
| Monitores | A busca encontra nome/CPF/cidade e mostra contato. O administrador sem permissão de agendar em nome não vê essa ação. |
| Agendar em nome | Entre no espaço de um monitor de teste, envie um pedido e volte ao painel administrativo. O pedido deve aparecer no histórico quando o próprio monitor entrar, com o CPF dele na planilha e autoria administrativa no log. |
| Auxiliares em agendamento delegado | O pedido fica `Aguardando Auxiliares`. Só passa a `Pendente` quando todos aceitarem pela própria conta. |
| Redefinir acesso | O administrador apenas remove o hash; a sessão anterior do monitor deixa de funcionar. O monitor usa **Meu Primeiro Acesso** e código no seu e-mail para criar outra senha. |
| Auditoria | Consulte o log após login, leitura, tentativa negada, agendamento, decisão, bloqueio e redefinição. Confira horário, ator, alvo e resultado. Confirme que não há senhas, códigos ou tokens. |
| Gestão de administradores | O gestor edita nome, e-mail e permissões; ao remover acesso, a conta deixa de entrar, mas continua listada para auditoria. Reative a conta e confira que apenas as permissões salvas aparecem. |
| Relatório | Escolha um período com pedidos confirmados e outros status. Compare indicadores, gráficos e tabelas com a planilha: perfil soma visitantes confirmados, monitores contam visitas como principal. |
| PDF/impressão | Clique em **Imprimir ou salvar em PDF**, escolha **Salvar como PDF** no diálogo e abra o arquivo. Confira cabeçalho, período, tabelas, gráficos, quebras de página e ausência de menus/botões; imprima uma página de teste se necessário. |

## Conferência visual

Abra a implantação de teste no computador e em um celular, ou use janelas estreita e larga. Examine login, primeiro acesso, recuperação, painel do monitor, painel administrativo, relatório, formulário, calendário e detalhes. Confirme que não há texto cortado, cartões apertados, botões sobrepostos ou rolagem interna desnecessária. Teste também zoom de 200% e navegação por teclado nos campos e nas orientações.

Para reproduzir a página de turismo, crie uma **página de teste** com o bloco de incorporação do [README](README.md#️-instruções-de-incorporação-do-iframe), usando o endereço da implantação de teste. No celular, deslize pelo meio do formulário, da lista de solicitações e dos resultados de busca: a página inteira deve descer com um único gesto, sem exigir tocar na borda direita do iframe. Passe de uma tela alta para uma curta e confira que não sobra uma grande área vazia. Abra um modal de detalhes e verifique sua rolagem própria. Teste também abrir a implantação diretamente, fora do iframe.

## Protocolos antigos: migração opcional

O portal já abre registros sem protocolo usando uma referência temporária de leitura. A migração da coluna U **não é necessária para publicar**. Se quiser atribuir protocolos permanentes depois, faça isso separadamente, com backup recente e em horário de baixo uso:

1. Na **cópia de teste**, execute `migrarProtocolosEmBranco` pelo editor do Apps Script **sem argumento**. Ela retorna apenas a quantidade e os números das linhas vazias; não grava nada.
2. Compare essa prévia com a coluna U. Verifique que protocolos já existentes, inclusive os antigos de oito caracteres, não estão na lista.
3. Nas **propriedades do script de teste**, defina `MIGRACAO_PROTOCOLOS_AUTORIZADA` como `SIM`. Execute `executarMigracaoProtocolosEmBranco`. Remova a propriedade logo após a execução.
4. Execute novamente `migrarProtocolosEmBranco`: o total deve ser zero. Verifique que não há protocolos duplicados e que os pedidos antigos abrem nos detalhes.

## Padronização das origens antigas: opcional e separada da publicação

1. Na **cópia de teste**, execute `preverPadronizacaoOrigensHistoricas` pelo editor. A resposta lista cada linha da coluna L com o valor atual e a proposta, além dos valores `pendentes` que precisam de análise humana. A prévia não grava nada.
2. Compare propostas e linhas pendentes com a planilha. A rotina só propõe conversões inequívocas, como `São Paulo` → `São Paulo/SP`. Corrija manualmente os nomes ambíguos; não há alteração automática desses valores.
3. Se aprovar a prévia, defina `PADRONIZACAO_ORIGENS_AUTORIZADA=SIM` nas propriedades **do projeto de teste** e execute `executarPadronizacaoOrigensHistoricas`. Remova a propriedade em seguida. Confira a coluna L e os gráficos do relatório.
4. Repita na produção **apenas depois da publicação e de um novo backup**, com prévia refeita na planilha atual. Esse passo não é necessário para que os novos pedidos sigam o padrão.

## Publicação, somente após os testes

1. Abra a **planilha original em produção**, não a cópia de backup nem a de teste. Confirme que o aplicativo da página de turismo usa a implantação do Apps Script vinculada a essa planilha. Se houve mudanças de código depois da cópia de teste, incorpore-as e teste novamente antes de publicar.
2. Faça **nova cópia da planilha de produção imediatamente antes da publicação**, pois a primeira cópia é uma fotografia de 25/09/2026 e novos pedidos podem ter chegado desde então. Em **Implantar → Gerenciar implantações**, anote a implantação ativa, seu URL `/exec`, número da versão e configuração de execução/acesso. Guarde também o trecho atual de incorporação da página de turismo.
3. Em horário de baixo uso, abra **Extensões → Apps Script** da planilha original. Atualize os arquivos `Código.gs` e `index.html` com os dois arquivos desta branch, salve e confira o fuso `America/Sao_Paulo`. Configure o administrador inicial no projeto de produção pelo procedimento acima, usando os dados definitivos; confirme que a aba `Administradores` foi criada e que as propriedades temporárias desapareceram. Não execute a migração de protocolos como parte desta publicação.
4. Em **Implantar → Gerenciar implantações**, selecione a **implantação ativa atual** e clique em **Editar**. Escolha **Nova versão**, registre uma descrição e clique em **Implantar**. Preserve as opções de execução e acesso já usadas pelo portal. Confira que o URL `/exec` permanece o mesmo. Não crie uma implantação separada para substituir a página de turismo, pois isso mudaria o endereço.
5. Verifique imediatamente o endereço `/exec` diretamente e depois pela página de turismo: login de monitor e administrador, histórico e detalhes de um pedido antigo, nova solicitação controlada, aceite de auxiliar, cancelamento administrativo, log e rolagem no celular. Observe **Execuções** no Apps Script e as abas `Log_Auditoria` e `Administradores`. Se a página de turismo ainda tiver rolagem dentro do iframe, aplique o bloco de incorporação do README numa cópia da página, teste no celular e então atualize essa página.
6. Se login, histórico ou envio falharem, abra **Gerenciar implantações → Editar** na mesma implantação e selecione a versão anterior anotada no passo 2. Isso restaura o código servido no mesmo URL. Não restaure a planilha inteira por cima de pedidos recebidos após o backup; compare os dados afetados com a cópia e o histórico de versões.

## Verificação automática local

Execute `node --test tests/regras.test.cjs`. Esses testes exercitam regras do servidor com uma planilha simulada. Eles não substituem os testes na cópia real do Google Sheets, especialmente envio de e-mail, permissões, fuso horário e implantação.
