const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

function ambiente() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'Código.gs'), 'utf8');
  const cache = new Map();
  const emails = [];
  const writes = [];
  const sheets = {
    'Monitores Credenciados': [Array(10).fill(''), ['', 'RG', '12345678909', 'Ana Monitor', '11999999999', 'ana@example.test', 'Cidade/SP', 'Centro', '', ''], ['', 'RG2', '98765432100', 'Bia Monitor', '11888888888', 'bia@example.test', 'Cidade/SP', 'Centro', '', '']],
    'Respostas ao formulário 1': [Array(22).fill('')],
    Datas_Bloqueadas: [['Data', 'Motivo']]
  };
  const sheet = name => ({
    getDataRange: () => ({ getValues: () => sheets[name].map(row => row.slice()) }),
    getLastColumn: () => sheets[name][0].length,
    getRange: (row, col) => ({ setValue: value => { sheets[name][row - 1][col - 1] = value; writes.push({name, row, col, value}); } }),
    appendRow: row => { sheets[name].push(row.slice()); writes.push({name, append: true}); }
  });
  const ctx = {
    console,
    Logger: {log() {}},
    Session: {getScriptTimeZone: () => 'America/Sao_Paulo'},
    SpreadsheetApp: {getActiveSpreadsheet: () => ({getSheetByName: sheet})},
    CacheService: {getScriptCache: () => ({get: key => cache.get(key) || null, put: (key, val) => cache.set(key, val), remove: key => cache.delete(key)})},
    LockService: {getScriptLock: () => ({tryLock: () => true, releaseLock() {}})},
    MailApp: {sendEmail: (...args) => emails.push(args)},
    PropertiesService: {getScriptProperties: () => ({getProperty: () => 'SIM'})},
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: {SHA_256: 'sha256'}, Charset: {UTF_8: 'utf8'},
      computeDigest: (_, text) => [...crypto.createHash('sha256').update(text).digest()],
      formatDate: (date, _tz, pattern) => {
        if (pattern !== 'yyyy-MM-dd') throw Error('Formato não usado neste teste');
        return new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
      }
    }
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  const token = ctx._novoToken();
  cache.set('TK_' + token, JSON.stringify({cpf:'12345678909'}));
  const auxToken = ctx._novoToken();
  cache.set('TK_' + auxToken, JSON.stringify({cpf:'98765432100'}));
  return {ctx, sheets, writes, emails, token, auxToken};
}

function linha({status='Aguardando Auxiliares', grupo=10, cpf='12345678909', aux='Bia Monitor', aceites='{"Bia Monitor":"Pendente"}', auxCpfs='', protocolo='SS-2026-100001', data}={}) {
  const row=Array(23).fill('');
  row[4]=grupo;row[6]=cpf;row[9]=data || new Date(Date.now()+5*86400000);row[10]='09:00:00';
  row[17]=aux;row[18]=status;row[20]=protocolo;row[21]=aceites;row[22]=auxCpfs;
  return row;
}

function visita(data) {
  return {dataVisita:data,horario:'09:00',tamanhoGrupo:12,tipoGrupo:'Escola',faixaEtaria:'Mista',origem:'Cidade/SP',antecedencia:5,diasSS:2,monitoresAux:''};
}

test('convite de visita confirmada não altera a planilha', () => {
  const a=ambiente();a.sheets['Respostas ao formulário 1'].push(linha({status:'Confirmado'}));
  const r=a.ctx._responderConvite({token:a.auxToken,protocolo:'SS-2026-100001',resposta:'Recusado'});
  assert.equal(r.code,'INVALID_STATUS');
  assert.equal(a.sheets['Respostas ao formulário 1'][1][18],'Confirmado');
  assert.equal(a.writes.length,0);
});

test('convite novo usa CPF e passa a pendente após aceite', () => {
  const a=ambiente();a.sheets['Respostas ao formulário 1'].push(linha({aceites:'{"98765432100":"Pendente"}'}));
  const r=a.ctx._responderConvite({token:a.auxToken,protocolo:'SS-2026-100001',resposta:'Aceito'});
  assert.equal(r.ok,true);
  assert.equal(a.sheets['Respostas ao formulário 1'][1][18],'Pendente');
  assert.equal(JSON.parse(a.sheets['Respostas ao formulário 1'][1][21])['98765432100'],'Aceito');
});

test('convite legado pendente por nome continua funcionando uma única vez', () => {
  const a=ambiente();a.sheets['Respostas ao formulário 1'].push(linha());
  assert.equal(a.ctx._responderConvite({token:a.auxToken,protocolo:'SS-2026-100001',resposta:'Aceito'}).ok,true);
  assert.equal(a.ctx._responderConvite({token:a.auxToken,protocolo:'SS-2026-100001',resposta:'Recusado'}).code,'INVALID_STATUS');
  assert.equal(a.sheets['Respostas ao formulário 1'][1][18],'Pendente');
});

test('primeiro acesso requer código entregue ao e-mail cadastrado', () => {
  const a=ambiente();
  const envio=a.ctx._verificarCPF({cpf:'12345678909'});
  assert.equal(envio.ok,true);
  assert.equal(envio.monitor,undefined);
  assert.equal(a.emails.length,1);
  assert.equal(a.ctx._criarSenha({cpf:'12345678909',senha:'Senha1234'}).code,'UNAUTHORIZED');
  const codigo=a.emails[0][2].match(/\b\d{6}\b/)[0];
  assert.equal(a.ctx._confirmarCodigo({cpf:'12345678909',finalidade:'primeiro',codigo:'000000'}).code,'CODE_INVALID');
  const confirmado=a.ctx._confirmarCodigo({cpf:'12345678909',finalidade:'primeiro',codigo});
  assert.equal(confirmado.ok,true);
  assert.equal(confirmado.monitor.nome,'Ana Monitor');
  const criado=a.ctx._criarSenha({cpf:'12345678909',ticket:confirmado.ticket,senha:'Senha1234',nome:'Ana Monitor',rg:'RG',telefone:'11999999999',email:'ana@example.test',cidade:'Cidade/SP',bairro:'Centro'});
  assert.equal(criado.ok,true);
  assert.ok(a.sheets['Monitores Credenciados'][1][8]);
  assert.equal(a.ctx._criarSenha({cpf:'12345678909',ticket:confirmado.ticket,senha:'Outra1234'}).code,'UNAUTHORIZED');
});

test('recuperação de senha requer confirmação por e-mail', () => {
  const a=ambiente();
  a.sheets['Monitores Credenciados'][1][8]=a.ctx._hashSenha('12345678909','Antiga1234');
  const antiga=a.sheets['Monitores Credenciados'][1][8];
  assert.equal(a.ctx._verificarIdentidade({cpf:'12345678909',email:'ana@example.test'}).ok,true);
  assert.equal(a.ctx._redefinirSenha({cpf:'12345678909',senha:'Nova12345'}).code,'UNAUTHORIZED');
  assert.equal(a.sheets['Monitores Credenciados'][1][8],antiga);
  const codigo=a.emails[0][2].match(/\b\d{6}\b/)[0];
  const verificado=a.ctx._confirmarCodigo({cpf:'12345678909',finalidade:'recuperar',codigo});
  assert.equal(a.ctx._redefinirSenha({cpf:'12345678909',ticket:verificado.ticket,senha:'Nova12345'}).ok,true);
  assert.notEqual(a.sheets['Monitores Credenciados'][1][8],antiga);
});

test('limite de grupo e duplicidade são verificados no servidor', () => {
  const a=ambiente();const data=new Date(Date.now()+5*86400000).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
  const grande=visita(data);grande.tamanhoGrupo=51;
  assert.equal(a.ctx._salvar({token:a.token,visita:grande}).code,'GROUP_INVALID');
  a.sheets['Respostas ao formulário 1'].push(linha({status:'Pendente',aux:'',aceites:'',data:data}));
  assert.equal(a.ctx._salvar({token:a.token,visita:visita(data)}).code,'DUPLICATE');
});

test('capacidade disponível é conferida antes de gravar', () => {
  const a=ambiente();const data=new Date(Date.now()+5*86400000).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
  a.sheets['Respostas ao formulário 1'].push(linha({status:'Pendente',grupo:40,cpf:'98765432100',aux:'',aceites:'',data:data}));
  assert.equal(a.ctx._salvar({token:a.token,visita:visita(data)}).code,'CAPACITY_EXCEEDED');
  assert.equal(a.sheets['Respostas ao formulário 1'].length,2);
});

test('novo agendamento preserva formato antigo dos aceites e registra CPF separado', () => {
  const a=ambiente();const data=new Date(Date.now()+5*86400000).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
  const v=visita(data);v.tamanhoGrupo=16;v.monitoresAux='98765432100';
  const r=a.ctx._salvar({token:a.token,visita:v});
  assert.equal(r.ok,true);
  const gravada=a.sheets['Respostas ao formulário 1'][1];
  assert.equal(gravada[17],'Bia Monitor');
  assert.equal(JSON.parse(gravada[21])['Bia Monitor'],'Pendente');
  assert.equal(gravada[22],'98765432100');
  assert.equal(a.sheets['Respostas ao formulário 1'][0][22],'CPFs Auxiliares');
});

test('CPF do auxiliar permite aceite após mudança do nome cadastrado', () => {
  const a=ambiente();
  a.sheets['Respostas ao formulário 1'].push(linha({auxCpfs:'98765432100'}));
  a.sheets['Monitores Credenciados'][2][3]='Bia Nome Atualizado';
  const r=a.ctx._responderConvite({token:a.auxToken,protocolo:'SS-2026-100001',resposta:'Aceito'});
  assert.equal(r.ok,true);
  assert.equal(JSON.parse(a.sheets['Respostas ao formulário 1'][1][21])['Bia Monitor'],'Aceito');
});

test('migração mostra prévia e preserva protocolos antigos', () => {
  const a=ambiente();
  a.sheets['Respostas ao formulário 1'].push(linha({protocolo:''}));
  a.sheets['Respostas ao formulário 1'].push(linha({protocolo:'0880c035'}));
  const previa=a.ctx.migrarProtocolosEmBranco();
  assert.equal(previa.total,1);
  assert.equal(a.sheets['Respostas ao formulário 1'][1][20],'');
  assert.equal(a.ctx.executarMigracaoProtocolosEmBranco().atualizados,1);
  assert.match(a.sheets['Respostas ao formulário 1'][1][20],/^SS-\d{4}-\d{6}$/);
  assert.equal(a.sheets['Respostas ao formulário 1'][2][20],'0880c035');
  assert.equal(a.ctx.migrarProtocolosEmBranco().total,0);
});
