const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('agenda mostra as reservas do dia e exclui canceladas da ocupação', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const trecho = html.slice(html.indexOf('function chaveDataAgenda('), html.indexOf('function renderAdminSolicitacoes('));
  const elementos = {};
  const contexto = {
    document: {getElementById: id => elementos[id] ||= {textContent: '', innerHTML: '', value: ''}},
    S: {agendaMes: new Date(2026, 9, 1), agendaDia: '2026-10-15', adminSolicitacoes: [
      {data:'2026-10-15',horario:'08:00',grupo:10,status:'Confirmado',monitor:'Ana',protocolo:'SS-1'},
      {data:'2026-10-15',horario:'12:00',grupo:5,status:'Pendente',monitor:'Bia',protocolo:'SS-2'},
      {data:'2026-10-15',horario:'09:00',grupo:4,status:'Cancelado',monitor:'Caio',protocolo:'SS-3'}
    ]},
    MESES: ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],
    esc: value => String(value), dataBr: value => value, rotuloProtocolo: value => value
  };
  vm.createContext(contexto);
  vm.runInContext(trecho, contexto);
  contexto.renderAgendaAdmin();
  assert.match(elementos['agenda-grade'].innerHTML, /3 solicitações/);
  assert.match(elementos['agenda-grade'].innerHTML, /M 15\/50<br>T 5\/50/);
  assert.match(elementos['agenda-dia-lista'].innerHTML, /SS-3/);
  assert.match(elementos['agenda-resumo'].textContent, /3 solicitações no mês · 2 confirmadas ou em andamento/);
});
