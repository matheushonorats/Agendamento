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
    getLastRow: () => sheets[name].length,
    getRange: (row, col) => ({ setValue: value => { sheets[name][row - 1][col - 1] = value; writes.push({name, row, col, value}); }, setValues: values => { values.forEach((v,j) => { sheets[name][row-1+j]=v.slice(); }); } }),
    appendRow: row => { sheets[name].push(row.slice()); writes.push({name, append: true}); },
    deleteRow: row => { sheets[name].splice(row-1,1); writes.push({name, delete: row}); }
  });
  const ctx = {
    console,
    Logger: {log() {}},
    Session: {getScriptTimeZone: () => 'America/Sao_Paulo'},
    SpreadsheetApp: {getActiveSpreadsheet: () => ({getSheetByName: name => sheets[name] ? sheet(name) : null, insertSheet: name => {sheets[name]=[[]]; return sheet(name);}})},
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

function incluirAdmin(a, permissoes=['verSolicitacoes','decidir','bloquearDatas','verMonitores','resetarSenha','agendarEmNome','verRelatorios','gerirAdmins']) {
  a.sheets.Administradores=[['CPF','E-mail','Nome','Senha Hash','Ativo','Permissões'],
    ['52998224725','admin@example.test','Gestor',a.ctx._hashSenha('52998224725','SenhaAdmin123'),'Sim',JSON.stringify(permissoes)]];
  return a.ctx._login({cpf:'admin@example.test',senha:'SenhaAdmin123'});
}

test('login administrativo usa aba separada e exige permissão no servidor', () => {
  const a=ambiente();const acesso=incluirAdmin(a,['verSolicitacoes']);
  assert.equal(acesso.papel,'admin');
  assert.equal(a.ctx._adminSolicitacoes({token:acesso.token}).ok,true);
  assert.equal(a.ctx._adminDecidir({token:acesso.token,protocolo:'X',decisao:'Confirmado'}).code,'FORBIDDEN');
  assert.equal(a.ctx._adminSolicitacoes({token:a.token}).code,'FORBIDDEN');
});

test('administrador agenda em nome do monitor sem decidir pelo auxiliar', () => {
  const a=ambiente();const admin=incluirAdmin(a);
  const delegado=a.ctx._adminAcessarMonitor({token:admin.token,cpf:'12345678909'});
  assert.equal(delegado.papel,'delegado');
  const data=new Date(Date.now()+5*86400000).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
  const v=visita(data);v.tamanhoGrupo=16;v.monitoresAux='98765432100';
  const envio=a.ctx.dispatch('salvar',{token:delegado.token,visita:v});
  assert.equal(envio.ok,true);
  const row=a.sheets['Respostas ao formulário 1'][1];
  assert.equal(row[6],'12345678909');
  assert.equal(row[18],'Aguardando Auxiliares');
  assert.equal(a.ctx._atualizarPerfil({token:delegado.token}).code,'FORBIDDEN');
  assert.equal(a.ctx._responderConvite({token:delegado.token,protocolo:envio.protocolo,resposta:'Aceito'}).code,'FORBIDDEN');
  const log=a.sheets.Log_Auditoria.at(-1);
  assert.equal(log[2],'administrador em nome de monitor');
  assert.equal(log[3],'salvar');
});

test('redefinir acesso limpa hash e registra operação sem senha no log', () => {
  const a=ambiente();const admin=incluirAdmin(a);
  a.sheets['Monitores Credenciados'][1][8]=a.ctx._hashSenha('12345678909','Antiga1234');
  const r=a.ctx.dispatch('adminResetarSenha',{token:admin.token,cpf:'12345678909'});
  assert.equal(r.ok,true);
  assert.equal(a.sheets['Monitores Credenciados'][1][8],'');
  assert.equal(a.ctx._verificarCPF({cpf:'12345678909'}).ok,true);
  assert.equal(a.sheets.Log_Auditoria.at(-1).join(' ').includes('Antiga1234'),false);
});

test('somente gestor cria administradores e não concede gestão de acessos', () => {
  const a=ambiente();const gestor=incluirAdmin(a);
  const criado=a.ctx._adminCriarAdmin({token:gestor.token,cpf:'16899535009',email:'outro@example.test',nome:'Outro',permissoes:['verSolicitacoes','gerirAdmins']});
  assert.equal(criado.ok,true);
  assert.equal(a.sheets.Administradores[2][3],'');
  assert.equal(JSON.parse(a.sheets.Administradores[2][5]).includes('gerirAdmins'),false);
  assert.equal(a.ctx._adminAtualizarAdmin({token:gestor.token,cpf:'52998224725',permissoes:[]}).code,'FORBIDDEN');
});

test('troca de senha no perfil exige código do e-mail cadastrado', () => {
  const a=ambiente();
  const p={token:a.token,nome:'Ana Monitor',cpf:'12345678909',rg:'RG',telefone:'11999999999',email:'ana@example.test',cidade:'Cidade/SP',bairro:'Centro',senha:'NovaSenha123'};
  assert.equal(a.ctx._atualizarPerfil(p).code,'UNAUTHORIZED');
  assert.equal(a.ctx._solicitarCodigoPerfil({token:a.token}).ok,true);
  const codigo=a.emails[0][2].match(/\b\d{6}\b/)[0];
  assert.equal(a.ctx._confirmarCodigo({cpf:p.cpf,finalidade:'perfil',codigo}).code,'UNAUTHORIZED');
  const confirmado=a.ctx._confirmarCodigo({token:a.token,cpf:p.cpf,finalidade:'perfil',codigo});
  assert.equal(confirmado.ok,true);
  p.ticketSenha=confirmado.ticket;
  assert.equal(a.ctx._atualizarPerfil(p).ok,true);
  assert.ok(a.sheets['Monitores Credenciados'][1][8]);
  assert.equal(a.ctx._atualizarPerfil(p).code,'UNAUTHORIZED');
});

test('relatório separa solicitações de visitas confirmadas e respeita permissão', () => {
  const a=ambiente();const admin=incluirAdmin(a);
  const data=new Date(Date.now()+5*86400000).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
  const confirmada=linha({status:'Confirmado',data,grupo:12});confirmada[11]='Cidade/SP';confirmada[12]='Escola';confirmada[13]='Mista';confirmada[14]='Hotel/Pousada';confirmada[15]=5;confirmada[16]=2;
  a.sheets['Respostas ao formulário 1'].push(confirmada,linha({status:'Negado',data,grupo:20,protocolo:'SS-2026-100002'}));
  const r=a.ctx._adminRelatorio({token:admin.token,inicio:data,fim:data});
  assert.equal(r.ok,true);assert.equal(r.resumo.agendamentos,2);assert.equal(r.resumo.confirmados,1);
  assert.equal(r.resumo.pessoas,12);assert.equal(r.grupos.tipo.Escola,12);
  assert.equal(a.ctx._adminRelatorio({token:a.token,inicio:data,fim:data}).code,'FORBIDDEN');
});

test('painel administrativo formata horas da planilha e rejeita datas impossíveis', () => {
  const a=ambiente();const admin=incluirAdmin(a);
  const data=new Date(Date.now()+5*86400000).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
  const pedido=linha({status:'Pendente',data});pedido[10]=new Date(1899,11,30,9,30);
  a.sheets['Respostas ao formulário 1'].push(pedido);
  assert.equal(a.ctx._adminSolicitacoes({token:admin.token}).lista[0].horario,'09:30');
  assert.equal(a.ctx._adminRelatorio({token:admin.token,inicio:data,fim:data}).agendamentos[0].horario,'09:30');
  assert.equal(a.ctx._adminBloquearData({token:admin.token,data:'2026-02-30',motivo:'Teste'}).code,'FIELDS_INVALID');
  assert.equal(a.ctx._adminRelatorio({token:admin.token,inicio:'2026-02-30',fim:'2026-03-01'}).code,'DATE_INVALID');
});

test('auditoria trata campos recebidos como texto e não grava segredos', () => {
  const a=ambiente();
  a.ctx.dispatch('acaoInexistente',{cpf:'=2+2',protocolo:'=HYPERLINK("x")',senha:'segredo',codigo:'123456',token:'nao-e-token'});
  const log=a.sheets.Log_Auditoria.at(-1);
  assert.equal(log[4].startsWith("'="),true);
  assert.equal(log.join(' ').includes('segredo'),false);
  assert.equal(log.join(' ').includes('123456'),false);
});
