const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('app envia a altura ao site acima do frame intermediário do Apps Script', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const trecho = html.slice(html.indexOf('function avisarPaginaHospedeira('), html.indexOf('function tela('));
  const mensagens = [];
  const pai = {postMessage: dados => mensagens.push({destino:'pai',dados})};
  const topo = {postMessage: dados => mensagens.push({destino:'site',dados})};
  const contexto = {window:{parent:pai,top:topo}};
  vm.createContext(contexto);
  vm.runInContext(trecho, contexto);
  contexto.avisarPaginaHospedeira({type:'resize',height:698});
  assert.equal(mensagens[0].destino,'site');
  assert.equal(mensagens[0].dados.portal,'espaco-monitor');
  assert.equal(mensagens[0].dados.height,698);
});

test('página de turismo aceita altura do frame interno confiável e rejeita outra origem', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'IFRAME_PAGINA_TURISMO_ATUALIZADO.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const eventos = {};
  const iframe = {style:{height:'950px'},contentWindow:{},addEventListener:(tipo,fn)=>{eventos['iframe:'+tipo]=fn;}};
  const contexto = {
    document:{getElementById:id=>id==='agendamento-iframe'?iframe:null},
    window:{addEventListener:(tipo,fn)=>{eventos[tipo]=fn;}},
    URL,Number,Math
  };
  vm.createContext(contexto);
  vm.runInContext(script, contexto);
  const dados = {portal:'espaco-monitor',type:'resize',height:698};
  eventos.message({source:{},origin:'https://n-teste-script.googleusercontent.com',data:dados});
  assert.equal(iframe.style.height,'698px');
  eventos.message({source:{},origin:'https://exemplo.invalid',data:{...dados,height:2000}});
  assert.equal(iframe.style.height,'698px');
});
