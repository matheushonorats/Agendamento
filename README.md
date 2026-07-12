# Portal do Monitor — Sítio Arqueológico São Francisco

Este repositório contém o código-fonte do **Portal do Monitor**, um sistema de agendamento de visitas guiadas para o Sítio Arqueológico São Francisco, desenvolvido para a **SETUR — Prefeitura de São Sebastião / SP**.

O projeto é construído em uma arquitetura leve integrada ao ecossistema do Google Workspace, utilizando **Google Apps Script** no backend (`Código.gs`), integrado a uma planilha de dados, e um frontend moderno responsivo baseado em **HTML5/Vanilla CSS/JavaScript** (`index.html`) que é incorporado como um iframe no site estático principal.

---

## 🚀 Funcionalidades e Especificações Técnicas

### 1. Camada de Segurança e Confirmação de Auxiliares
Implementa uma regra de validação e segurança em duas etapas para visitas guiadas que necessitam de monitores adicionais:
* **Banco de Dados (Coluna 22):** A planilha de respostas possui 22 colunas, sendo a última destinada a `Aceites Auxiliares`, que armazena um mapa em JSON (ex: `{"Nome do Monitor": "Pendente", "Outro Monitor": "Aceito"}`).
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
* **Comunicação Ativa:** O portal monitora as mudanças de altura do documento em tempo real utilizando um `ResizeObserver` e envia as dimensões via `postMessage({ type: 'resize', height: h }, '*')` para o site estático externo.
* **Scroll Inteligente:** Quando ocorrem transições de tela ou modais são abertos, o portal envia um sinal `scrollToTop` para o site principal realizar a rolagem automática e suave do usuário para o início do iframe.
* **Barra de Rolagem Fallback Premium:** Habilitamos barras de rolagem finas e elegantes de contingência (`6px` de largura em tons de cinza suave) para casos em que o site externo restrinja a altura do iframe ou não execute o script de auto-resize, garantindo que o formulário nunca fique cortado.

### 4. Grade de Seleção de Auxiliares e Pergunta Opcional
* **Remoção de Scroll Local:** A lista de seleção de monitores foi transformada em um layout responsivo de grade CSS (`display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`), eliminando a janela pequena rolável que prejudicava a experiência mobile.
* **Interruptor Tátil ("Sim" / "Não"):** Para grupos de até 15 pessoas (onde a indicação de auxiliar é opcional), uma pergunta é exibida: *"Algum monitor auxiliar irá acompanhar?"*. 
  * Por padrão, a opção é **"Não"** e a grade de seleção fica oculta para evitar cliques indesejados ao rolar a página em smartphones.
  * Para grupos maiores (mínimo obrigatório), a pergunta é omitida e a lista de seleção é exibida obrigatoriamente.

### 5. Padronização e Validação do Formato de Cidade (`Cidade/UF`)
* **IBGE Auto-Complete:** Integração automática com a API de Localidades do IBGE com cache em `sessionStorage` para sugerir e autocompletar nomes de municípios no formato correto `Cidade/UF` (ex: `São Sebastião/SP`) nos campos de Origem do Grupo, Cidade no Cadastro e Cidade no Perfil.
* **Fuzzy Auto-Correction:** Caso o usuário digite o nome de uma cidade brasileira sem o estado (ex: apenas `São Sebastião`), o portal busca na lista de cidades e formata o input automaticamente antes de enviar. Países internacionais são reconhecidos e aceitos sem o estado.

### 6. Padronização de Protocolos e Auto-Healing
* **Formato Único:** O padrão de protocolos do sistema é `SS-ANO-NÚMERO` (ex: `SS-2026-900080`).
* **Auto-Healing de Histórico:** O sistema regenera em tempo real no banco de dados qualquer protocolo de registro legado que esteja em branco, inválido ou no formato hexadecimal antigo de 8 caracteres (como `0880c035`), gerando um novo protocolo alinhado ao ano de submissão daquela linha da planilha (ex: `SS-2025-XXXXXX` para registros de 2025).

---

## 🛠️ Instruções de Incorporação do Iframe

Cole o seguinte snippet limpo de tags estruturais dentro de uma caixa de "Código Fonte" ou bloco HTML no seu CMS (WordPress, Wix, Elementor, etc.) para habilitar o auto-resize e rolagem suave:

```html
<!-- Container do Iframe (Estilo Premium e Centralizado) -->
<div style="width: 100%; display: flex; justify-content: center; background-color: #f0faf3; padding: 10px 0;">
  <iframe 
    id="agendamento-iframe" 
    width="100%" 
    height="950px" 
    style="border: none; max-width: 750px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); transition: height 0.15s ease-out;" 
    src="https://script.google.com/macros/s/AKfycbx64cFvzE9As-gxIVnxNqiY7uhLLGhL7xH1g5EsB7Mw-Yljv5RbXeGmEn76mRbwaLZDKA/exec" 
    title="Portal do Monitor - Agendamento Sítio Arqueológico">
  </iframe>
</div>

<!-- Script Inteligente de Redimensionamento e Scroll Automático -->
<script>
(function() {
  var iframe = document.getElementById('agendamento-iframe');
  if (iframe) {
    window.addEventListener('message', function(event) {
      if (event.data && typeof event.data === 'object') {
        // 1. Redimensionamento Dinâmico (Resize)
        if (event.data.type === 'resize' && event.data.height) {
          iframe.style.height = event.data.height + 'px';
        }
        // 2. Rolagem Automática ao Topo ao Mudar de Tela (Scroll to Top)
        if (event.data.type === 'scrollToTop') {
          iframe.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  }
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
