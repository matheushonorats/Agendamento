# Espaço do Monitor — Sítio Arqueológico São Francisco

Este repositório contém o código-fonte do **Portal do Monitor**, um sistema de agendamento de visitas guiadas para o Sítio Arqueológico São Francisco, desenvolvido para a **SETUR — Prefeitura de São Sebastião / SP**.

O projeto usa **Google Apps Script** no servidor (`Código.gs`), uma planilha de dados e HTML/CSS/JavaScript (`index.html`) incorporado à página de turismo.

Para um guia operacional direto voltado aos monitores, consulte o [Manual do Monitor](MANUAL_DO_MONITOR.md).

## Painel administrativo

O mesmo formulário de login encaminha cada pessoa ao painel de monitor ou de administração conforme sua conta. Os administradores ficam na aba separada `Administradores`; o gestor inicial é criado por `configurarAdministradorInicial`, conforme o [roteiro de teste e implantação](PROCEDIMENTO_DE_TESTE.md). As contas administrativas são isentas de bloqueio por limite de tentativas (*rate limit/lockout* desativado para administradores), permitindo login imediato sem bloqueio de cache e com suporte à validação de senha por e-mail ou CPF. Apenas o gestor pode criar, desativar e definir as permissões das outras contas. Uma opção sem permissão fica oculta no painel e a operação também é bloqueada no servidor.

O painel permite consultar detalhes e decidir solicitações pendentes, cancelar pedidos ativos com motivo, bloquear datas, consultar monitores, redefinir o acesso de um monitor e agendar em nome dele. Pendências aparecem primeiro, com contagem e destaque. Registros antigos sem protocolo recebem uma referência de leitura para abrir detalhes sem alterar a planilha. Esse agendamento pertence à conta do monitor, que o vê em seu histórico; monitores auxiliares ainda precisam aceitar o convite. Redefinir o acesso apaga o hash da senha e exige novo primeiro acesso com código enviado ao e-mail cadastrado. A senha em texto não é guardada na planilha.

O gestor pode editar nome, e-mail e permissões de outros administradores, remover o acesso e reativá-lo. A remoção desativa a conta imediatamente e preserva seus registros para auditoria.

A aba `Agenda` mostra as solicitações por data, com ocupação da manhã e da tarde e acesso aos detalhes de cada reserva. Pedidos pendentes e aguardando auxiliares também entram na ocupação; negados e cancelados continuam visíveis no histórico do dia, mas não ocupam vagas.

O monitor tem uma discreta área **Mensagens e sugestões** para enviar feedback e responder à equipe. O gestor de acessos pode ler e responder todas as conversas, além de conceder a permissão `Mensagens dos monitores` a outros administradores. O administrador também pode iniciar uma conversa com um monitor. Cada monitor vê apenas suas conversas; o acesso administrativo em nome de monitor não abre essa caixa. As mensagens ficam na aba `Caixa_Postal`, criada no primeiro envio. O log registra ações e identificadores da conversa, sem copiar o texto das mensagens.

A aba `Relatórios` reúne agendamentos do período, indicadores, gráficos de perfil dos grupos confirmados e a relação de monitores. O botão de PDF/impressão abre o diálogo do navegador com um documento próprio em formato A4, incluindo tabelas, gráficos e quebras de página; no destino da impressão, escolha **Salvar como PDF**. A aba `Log_Auditoria` registra as ações do servidor, inclusive erros, com ator, alvo e resultado, sem senha, código ou token. Se a gravação do log falhar, a operação principal continua e a falha aparece nos registros de execução do Apps Script.

---

## 🚀 Funcionalidades e Especificações Técnicas

### 1. Camada de Segurança e Confirmação de Auxiliares
Implementa uma regra de validação e segurança em duas etapas para visitas guiadas que necessitam de monitores adicionais:
* **Banco de Dados (Colunas 22 e 23):** A coluna V mantém `Aceites Auxiliares` no formato por nome que a versão anterior entende (ex: `{"Nome do Monitor": "Pendente"}`). A nova coluna W guarda os CPFs dos auxiliares na mesma ordem dos nomes da coluna R. Registros antigos podem continuar sem a coluna W preenchida.
* **Status `Aguardando Auxiliares`:** Sempre que um agendamento é feito com monitores auxiliares, seu status inicial é gravado como `Aguardando Auxiliares` e a solicitação fica temporariamente oculta para a liberação do administrador.
* **Transição de Estados:**
  * **Aceite:** Quando um monitor auxiliar aceita o convite em seu próprio painel, o JSON de aceites é atualizado. Se todos os monitores auxiliares confirmarem, o status do agendamento passa automaticamente para `Pendente`, tornando-o elegível para aprovação ou recusa do administrador.
  * **Recusa:** Se qualquer monitor auxiliar rejeitar o convite, a solicitação é imediatamente cancelada com a observação *"Recusado pelo monitor auxiliar [Nome]"*.
* **Banners de Convite (Invite Banners):** Monitores convidados visualizam o banner com estilo de destaque `.has-invite` e botões rápidos de ação (`✓ Aceitar` e `✕ Recusar`) fixados no topo absoluto do dashboard e da busca.

### 2. Controle de Capacidade por Período
Controla rigidamente o fluxo de visitantes com base na duração média estimada de cada visita:
* **Períodos Manhã / Tarde:** Cada visita tem duração máxima estimada de 4 horas. Um agendamento é alocado no período da **manhã** se iniciar antes das 13h, e no período da **tarde** se terminar após as 13h (ou ambos, caso a faixa de horário intercepte o limite).
* **Capacidade Máxima:** Limite de 50 pessoas por período. Se a lotação for atingida, a data é marcada como lotada no calendário e novas solicitações são bloqueadas no servidor.

### 3. Autodimensionamento do Iframe (ResizeObserver)
* **Comunicação Ativa:** O portal mede a altura real do conteúdo com `ResizeObserver` e envia a medida por `postMessage` até a página que o incorpora. O Apps Script coloca o HTML dentro de um frame intermediário; por isso o portal precisa comunicar-se com `window.top`, e a página externa precisa aceitar a mensagem vinda do domínio `script.googleusercontent.com`.
* **Scroll Inteligente:** Quando ocorrem transições de tela ou modais são abertos, o portal envia um sinal `scrollToTop` para o site principal realizar a rolagem automática e suave do usuário para o início do iframe.
* **Rolagem no celular:** A incorporação recomendada usa `scrolling="no"` e deixa a página externa rolar. Sem o trecho de incorporação abaixo, o navegador ainda poderá criar uma barra dentro do iframe.

### 4. Busca de auxiliares e pergunta opcional
* **Seleção por nome:** Ao digitar pelo menos duas letras, aparecem os monitores correspondentes. Os já selecionados permanecem visíveis ao limpar ou alterar a busca.
* **Interruptor Tátil ("Sim" / "Não"):** Para grupos de até 15 pessoas (onde a indicação de auxiliar é opcional), uma pergunta é exibida: *"Algum monitor auxiliar irá acompanhar?"*. 
  * Por padrão, a opção é **"Não"** e a grade de seleção fica oculta para evitar cliques indesejados ao rolar a página em smartphones.
  * Para grupos maiores, a indicação de auxiliares é obrigatória e a seleção usa a mesma busca por nome.

### 5. Padronização e Validação do Formato de Cidade (`Cidade/UF`)
* **IBGE Auto-Complete:** Integração com a API de Localidades do IBGE com cache em `sessionStorage` para sugerir nomes de municípios no formato `Cidade/UF` (ex: `São Sebastião/SP`). A origem do grupo usa uma lista visual consistente com os demais campos.
* **Padronização:** Novos pedidos e perfis passam pela validação do servidor. Cidades brasileiras são gravadas como `Cidade/UF`; países da lista ficam com o nome padronizado. Para um país fora da lista, digite `País: Nome`. Cidades locais conhecidas sem UF ou sem acento são completadas; nomes ambíguos exigem a UF.
* **Histórico:** Relatórios agrupam variações reconhecidas sem alterar registros antigos. A rotina manual `preverPadronizacaoOrigensHistoricas` mostra quais linhas da coluna L podem ser corrigidas com segurança; a execução exige backup e propriedade de autorização, conforme o roteiro.

### 6. Protocolos e compatibilidade com o histórico
* **Formato dos novos protocolos:** `SS-ANO-NÚMERO`, com verificação de unicidade antes de gravar.
* **Registros antigos:** consultas não modificam mais a planilha. Protocolos existentes, inclusive os antigos em formato hexadecimal, permanecem válidos. Células vazias são preenchidas somente pela rotina manual `migrarProtocolosEmBranco`, após backup e conferência da prévia.

### 7. Acesso, Autenticação e Resiliência de E-mail
* **Foco em E-mail e Flexibilização de CPF/RG:** A identificação principal dos monitores é realizada pelo e-mail previamente cadastrado junto à Fundação Florestal. CPF e RG tornaram-se opcionais para comportar cadastros sem esses dados. Contas legadas com senhas hash vinculadas ao CPF continuam sendo autenticadas com total retrocompatibilidade via verificação dual.
* **Isenção de Bloqueio para Administradores:** Contas administrativas (`Administradores`) não sofrem bloqueio por tentativas (*rate limit / lockout* desativado para adm). Qualquer bloqueio residual em cache é limpo automaticamente e a validação de senha aceita indistintamente hashes criados por CPF ou por e-mail (resolvendo alterações de senha administrativa via Primeiro Acesso ou Recuperação).
* **Resiliência no Primeiro Acesso:** Se o envio do código de confirmação por e-mail falhar no servidor do Google (por restrições de permissão do Apps Script ou esgotamento de quota), o sistema não bloqueia o usuário; um ticket direto é emitido para permitir a definição de senha e validação do cadastro com segurança.
* **Visibilidade de Senha:** Todos os campos de senha (login, criação de senha, recuperação e perfil) contam com botão de alternância de visibilidade (ícone de olho).
* O aceite de auxiliares só pode alterar solicitações no estado `Aguardando Auxiliares`.
* Novas solicitações verificam capacidade, duplicidade e protocolo dentro de um bloqueio do Apps Script.
* O roteiro de testes, migração e retorno à versão anterior está em [PROCEDIMENTO_DE_TESTE.md](PROCEDIMENTO_DE_TESTE.md). A cópia de produção e a publicação não ocorrem automaticamente por mudanças neste repositório.

### 8. Identidade Visual e Cabeçalho Unificado
* **Tipografia Clássica:** O título "Espaço do Monitor" na barra superior (`.appbar`) utiliza tipografia serifada elegante (`Georgia, 'Times New Roman', serif`), mantida de forma consistente antes e após a autenticação em todas as telas.
* **Cabeçalho Limpo:** O banner intermediário de imagem e os ícones redundantes foram removidos da barra superior, proporcionando maior foco no formulário e no conteúdo útil do portal.

---

## 🛠️ Instruções de Incorporação do Iframe

Na página de turismo, substitua o trecho que incorpora o portal pelo bloco abaixo **somente após testar em uma página de homologação**. O arquivo [IFRAME_PAGINA_TURISMO_ATUALIZADO.html](IFRAME_PAGINA_TURISMO_ATUALIZADO.html) contém o documento completo para colar no editor de código-fonte da página; [BACKUP_IFRAME_PAGINA_TURISMO_2026-09-25.html](BACKUP_IFRAME_PAGINA_TURISMO_2026-09-25.html) conserva o código publicado em 25/09/2026. Mantenha o endereço da implantação de teste durante os testes e o endereço atual de produção na publicação. O script valida a origem e a janela antes de aceitar mensagens do aplicativo. Configure também a seção ou coluna do editor da página para ocupar a largura disponível; um limite imposto pelo editor continua restringindo o iframe mesmo com este código.

```html
<div style="width: 100%; max-width: 1360px; margin: 0 auto;">
  <iframe 
    id="agendamento-iframe" 
    style="width: 100%; height: 950px; border: 0; display: block;"
    src="https://script.google.com/macros/s/AKfycbx64cFvzE9As-gxIVnxNqiY7uhLLGhL7xH1g5EsB7Mw-Yljv5RbXeGmEn76mRbwaLZDKA/exec" 
    title="Portal do Monitor - Agendamento Sítio Arqueológico"
    scrolling="no">
  </iframe>
</div>

<script>
(function() {
  var iframe = document.getElementById('agendamento-iframe');
  if (!iframe) return;
  function solicitarAltura() {
    if (iframe.contentWindow) iframe.contentWindow.postMessage({type:'requestResize'}, '*');
  }
  iframe.addEventListener('load', solicitarAltura);
  window.addEventListener('resize', solicitarAltura);
  window.addEventListener('message', function(event) {
    var host;
    try { host = new URL(event.origin).hostname; } catch (e) { return; }
    if (new URL(event.origin).protocol !== 'https:' ||
        !(/(^|\.)script\.google\.com$/.test(host) ||
          host === 'script.googleusercontent.com' ||
          host.endsWith('-script.googleusercontent.com'))) return;
    if (!event.data || typeof event.data !== 'object' || event.data.portal !== 'espaco-monitor') return;
    if (event.source !== iframe.contentWindow &&
        host !== 'script.googleusercontent.com' &&
        !host.endsWith('-script.googleusercontent.com')) return;
    if (event.data.type === 'resize') {
      var altura = Number(event.data.height);
      if (Number.isFinite(altura) && altura >= 300 && altura <= 30000)
        iframe.style.height = Math.ceil(altura) + 'px';
    } else if (event.data.type === 'scrollToTop') {
      iframe.scrollIntoView({behavior:'smooth',block:'start'});
    }
  });
})();
</script>
```

---

## 📱 Configuração como Aplicativo Celular (PWA)

Para oferecer a instalação direta do portal como um WebApp em smartphones Android e iOS, adicione os arquivos abaixo no diretório raiz do seu site externo (onde o iframe acima está incorporado):

### 1. `manifest.json`
```json
{
  "short_name": "Portal Monitor",
  "name": "Portal do Monitor — Sítio Arqueológico",
  "description": "Portal de agendamentos para monitores credenciados.",
  "icons": [
    {
      "src": "icon-192.png",
      "type": "image/png",
      "sizes": "192x192"
    },
    {
      "src": "icon-512.png",
      "type": "image/png",
      "sizes": "512x512"
    }
  ],
  "start_url": "index.html",
  "background_color": "#f0faf3",
  "theme_color": "#1B4332",
  "display": "standalone",
  "orientation": "portrait"
}
```

### 2. Service Worker `sw.js`
```javascript
const CACHE_NAME = 'portal-monitor-v1';
const ASSETS = [];

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
```

### 3. Registro no `<head>` do site externo
```html
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#1B4332">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Portal Monitor">
<link rel="apple-touch-icon" href="icon-192.png">

<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('Service Worker registrado!'))
      .catch(err => console.error(err));
  });
}
</script>
```
