# Portal do Monitor — Sítio Arqueológico São Francisco

Este repositório contém o código-fonte do **Portal do Monitor**, um sistema de agendamento de visitas guiadas para o Sítio Arqueológico São Francisco, desenvolvido para a **SETUR — Prefeitura de São Sebastião / SP**.

O projeto é construído em uma arquitetura leve integrada ao ecossistema do Google Workspace, utilizando **Google Apps Script** no backend (`Código.gs`), integrado a uma planilha de dados, e um frontend moderno responsivo baseado em **HTML5/Vanilla CSS/JavaScript** (`index.html`) que é incorporado como um iframe no site estático principal.

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
* **Comunicação Ativa:** O portal mede a altura real do conteúdo com `ResizeObserver` e envia `postMessage({ type: 'resize', height: h }, '*')` para a página que o incorpora. A página externa precisa aplicar essa altura ao iframe.
* **Scroll Inteligente:** Quando ocorrem transições de tela ou modais são abertos, o portal envia um sinal `scrollToTop` para o site principal realizar a rolagem automática e suave do usuário para o início do iframe.
* **Rolagem no celular:** A incorporação recomendada usa `scrolling="no"` e deixa a página externa rolar. Sem o trecho de incorporação abaixo, o navegador ainda poderá criar uma barra dentro do iframe.

### 4. Grade de Seleção de Auxiliares e Pergunta Opcional
* **Remoção de Scroll Local:** A lista de seleção de monitores foi transformada em um layout responsivo de grade CSS (`display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`), eliminando a janela pequena rolável que prejudicava a experiência mobile.
* **Interruptor Tátil ("Sim" / "Não"):** Para grupos de até 15 pessoas (onde a indicação de auxiliar é opcional), uma pergunta é exibida: *"Algum monitor auxiliar irá acompanhar?"*. 
  * Por padrão, a opção é **"Não"** e a grade de seleção fica oculta para evitar cliques indesejados ao rolar a página em smartphones.
  * Para grupos maiores (mínimo obrigatório), a pergunta é omitida e a lista de seleção é exibida obrigatoriamente.

### 5. Padronização e Validação do Formato de Cidade (`Cidade/UF`)
* **IBGE Auto-Complete:** Integração automática com a API de Localidades do IBGE com cache em `sessionStorage` para sugerir e autocompletar nomes de municípios no formato correto `Cidade/UF` (ex: `São Sebastião/SP`) nos campos de Origem do Grupo, Cidade no Cadastro e Cidade no Perfil.
* **Fuzzy Auto-Correction:** Caso o usuário digite o nome de uma cidade brasileira sem o estado (ex: apenas `São Sebastião`), o portal busca na lista de cidades e formata o input automaticamente antes de enviar. Países internacionais são reconhecidos e aceitos sem o estado.

### 6. Protocolos e compatibilidade com o histórico
* **Formato dos novos protocolos:** `SS-ANO-NÚMERO`, com verificação de unicidade antes de gravar.
* **Registros antigos:** consultas não modificam mais a planilha. Protocolos existentes, inclusive os antigos em formato hexadecimal, permanecem válidos. Células vazias são preenchidas somente pela rotina manual `migrarProtocolosEmBranco`, após backup e conferência da prévia.

### 7. Acesso e publicação segura
* Primeiro acesso e recuperação de senha exigem código enviado ao e-mail já cadastrado. O projeto de Apps Script precisa de autorização para envio por `MailApp`.
* O aceite de auxiliares só pode alterar solicitações no estado `Aguardando Auxiliares`.
* Novas solicitações verificam capacidade, duplicidade e protocolo dentro de um bloqueio do Apps Script.
* O roteiro de testes, migração e retorno à versão anterior está em [PROCEDIMENTO_DE_TESTE.md](PROCEDIMENTO_DE_TESTE.md). A cópia de produção e a publicação não ocorrem automaticamente por mudanças neste repositório.

---

## 🛠️ Instruções de Incorporação do Iframe

Na página de turismo, substitua o trecho que incorpora o portal pelo bloco abaixo **somente após testar em uma página de homologação**. Mantenha o endereço da implantação de teste durante os testes e o endereço atual de produção na publicação. O script valida a origem e a janela antes de aceitar mensagens do aplicativo.

```html
<div style="width: 100%; max-width: 750px; margin: 0 auto;">
  <iframe 
    id="agendamento-iframe" 
    style="width: 100%; height: 950px; border: 0; display: block; border-radius: 16px;"
    src="https://script.google.com/macros/s/AKfycbx64cFvzE9As-gxIVnxNqiY7uhLLGhL7xH1g5EsB7Mw-Yljv5RbXeGmEn76mRbwaLZDKA/exec" 
    title="Portal do Monitor - Agendamento Sítio Arqueológico"
    scrolling="no">
  </iframe>
</div>

<script>
(function() {
  var iframe = document.getElementById('agendamento-iframe');
  if (!iframe) return;
  window.addEventListener('message', function(event) {
    if (event.source !== iframe.contentWindow) return;
    var host;
    try { host = new URL(event.origin).hostname; } catch (e) { return; }
    if (new URL(event.origin).protocol !== 'https:' ||
        !(/(^|\.)script\.google\.com$/.test(host) ||
          host === 'script.googleusercontent.com' ||
          host.endsWith('-script.googleusercontent.com'))) return;
    if (!event.data || typeof event.data !== 'object') return;
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
