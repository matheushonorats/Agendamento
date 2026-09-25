// ╔══════════════════════════════════════════════════════════════════╗
// ║  CÓDIGO.GS — Portal do Monitor | Versão 4.0                      ║
// ║  SETUR — Prefeitura de São Sebastião / SP                        ║
// ╚══════════════════════════════════════════════════════════════════╝

var CFG = {
  PEPPER: 'Setur_SaoFra#2026!',
  MAX_TENTATIVAS: 5,
  LOCKOUT_MIN:    15,
  TOKEN_HORAS:    6,
  ANTECEDENCIA_MIN_DIAS: 1,
  ANTECEDENCIA_MAX_DIAS: 120,
  CODIGO_MINUTOS: 10,
  MAX_HISTORICO:   100,
  MAX_GRUPO:       50,
  PESSOAS_POR_MONITOR: 15,     // Regra: 1 monitor a cada 15 pessoas
  CAPACIDADE_PERIODO:  50,     // Máximo de pessoas por período (manhã / tarde)
  ABA_MONITORES:  'Monitores Credenciados',
  ABA_ADMIN:      'Administradores',
  ABA_AUDITORIA:  'Log_Auditoria',
  ABA_CAIXA:      'Caixa_Postal',
  ABA_RESPOSTAS:  'Respostas ao formulário 1',
  ABA_BLOQUEADAS: 'Datas_Bloqueadas'
};

var MC = { RG: 2, CPF: 3, NOME: 4, TELEFONE: 5, EMAIL: 6, CIDADE: 7, BAIRRO: 8, SENHA_HASH: 9, ULTIMO_LOGIN: 10 };
var RF = { CPF: 7, PROTOCOLO: 21, TOTAL_COLUNAS: 23 };
var PERMISSOES_ADMIN = ['verSolicitacoes','decidir','bloquearDatas','verMonitores','resetarSenha','agendarEmNome','verRelatorios','verAuditoria','caixaPostal','gerirAdmins'];
var UFS_VALIDAS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
var CIDADES_PADRAO = ['São Sebastião/SP','Caraguatatuba/SP','Ubatuba/SP','Ilhabela/SP','São Paulo/SP','Santos/SP','São José dos Campos/SP','Barretos/SP','Rio de Janeiro/RJ','Belo Horizonte/MG','Curitiba/PR','Florianópolis/SC','Porto Alegre/RS','Salvador/BA','Brasília/DF'];
var PAISES_PADRAO = ['Argentina','Bolívia','Chile','Colômbia','Equador','Guiana','Guiana Francesa','Paraguai','Peru','Suriname','Uruguai','Venezuela','Estados Unidos','Canadá','México','Cuba','Costa Rica','Panamá','Jamaica','República Dominicana','Guatemala','Haiti','Trinidad e Tobago','Portugal','Espanha','França','Itália','Alemanha','Reino Unido','Holanda','Bélgica','Suíça','Áustria','Suécia','Noruega','Dinamarca','Finlândia','Polônia','República Tcheca','Hungria','Grécia','Turquia','Rússia','Ucrânia','Irlanda','Croácia','Sérvia','Luxemburgo','Japão','China','Coreia do Sul','Índia','Tailândia','Singapura','Vietnam','Indonésia','Filipinas','Malásia','Taiwan','Israel','Emirados Árabes Unidos','Arábia Saudita','Austrália','Nova Zelândia','África do Sul','Marrocos','Egito','Angola','Moçambique','Cabo Verde'];

function doGet(e) {
  return HtmlService
    .createHtmlOutputFromFile('index')
    .setTitle('Espaço do Monitor')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function dispatch(acao, carga) {
  var contexto=null;
  try{
    var adminAntes=_validaTokenAdmin(carga&&carga.token);
    if(adminAntes)contexto={papel:'administrador',ator:_maskCPF(adminAntes.cpf)};
    else{var monitorAntes=_validaToken(carga&&carga.token);if(monitorAntes)contexto={papel:monitorAntes.adminCpf?'administrador em nome de monitor':'monitor',
      ator:_maskCPF(monitorAntes.adminCpf||monitorAntes.cpf),monitorAlvo:monitorAntes.adminCpf?_maskCPF(monitorAntes.cpf):''};}
  }catch(e){}
  var resultado = _dispatchInterno(acao, carga);
  try { _registrarAuditoria(acao, carga || {}, resultado, contexto); }
  catch(e) { Logger.log('Falha ao gravar auditoria da ação ' + acao + ': ' + e); }
  return resultado;
}
function _dispatchInterno(acao, carga) {
  try {
    if (typeof acao !== 'string' || !acao) return _err('Ação inválida.');
    carga = carga || {};
    switch (acao) {
      case 'login':               return _login(carga);
      case 'verificarCPF':        return _verificarCPF(carga);
      case 'confirmarCodigo':     return _confirmarCodigo(carga);
      case 'criarSenha':          return _criarSenha(carga);
      case 'datas':               return _getDatas(carga);
      case 'salvar':              return _salvar(carga);
      case 'historico':           return _getHistorico(carga);
      case 'buscarHistorico':     return _buscarHistorico(carga);
      case 'detalharSolicitacao': return _detalharSolicitacao(carga);
      case 'logout':              return _logout(carga);
      case 'listarMonitores':     return _listarMonitores(carga);
      case 'cancelar':            return _cancelar(carga);
      case 'responderConvite':    return _responderConvite(carga);
      case 'validarToken':        return _validarTokenRota(carga);
      case 'verificarIdentidade': return _verificarIdentidade(carga);
      case 'redefinirSenha':      return _redefinirSenha(carga);
      case 'solicitarCodigoPerfil': return _solicitarCodigoPerfil(carga);
      case 'notificacoes':        return _getNotificacoes(carga);
      case 'atualizarPerfil':     return _atualizarPerfil(carga);
      case 'adminSolicitacoes':   return _adminSolicitacoes(carga);
      case 'adminDecidir':        return _adminDecidir(carga);
      case 'adminDatas':         return _adminDatas(carga);
      case 'adminBloquearData':  return _adminBloquearData(carga);
      case 'adminDesbloquearData':return _adminDesbloquearData(carga);
      case 'adminMonitores':      return _adminMonitores(carga);
      case 'adminAcessarMonitor':return _adminAcessarMonitor(carga);
      case 'adminResetarSenha':  return _adminResetarSenha(carga);
      case 'adminPerfil':        return _adminPerfil(carga);
      case 'adminListarAdmins':  return _adminListarAdmins(carga);
      case 'adminCriarAdmin':    return _adminCriarAdmin(carga);
      case 'adminAtualizarAdmin':return _adminAtualizarAdmin(carga);
      case 'adminDesativarAdmin':return _adminDesativarAdmin(carga);
      case 'adminReativarAdmin':return _adminReativarAdmin(carga);
      case 'adminRelatorio':     return _adminRelatorio(carga);
      case 'adminLogs':          return _adminLogs(carga);
      case 'caixaListar':        return _caixaListar(carga);
      case 'caixaAbrir':         return _caixaAbrir(carga);
      case 'caixaEnviar':        return _caixaEnviar(carga);
      case 'caixaMonitores':     return _caixaMonitores(carga);
      default:                    return _err('Ação desconhecida.');
    }
  } catch (e) {
    Logger.log('dispatch ERRO acao=' + acao + ': ' + e + '\n' + e.stack);
    return _err('Erro interno inesperado. Tente novamente.');
  }
}

// ─────────────────────────────────────────────────────────────
// LOGIN / AUTENTICAÇÃO
// ─────────────────────────────────────────────────────────────
function _login(p) {
  var loginInput = String(p.cpf || '').trim();
  var senha = p.senha;
  if (!loginInput)          return _err('Informe o CPF ou E-mail.');
  if (!senha)               return _err('Informe a senha.');

  var acessoAdmin = _tentarLoginAdmin(loginInput, senha);
  if (acessoAdmin) return acessoAdmin;

  var isEmail = loginInput.indexOf('@') !== -1;
  var cpf = '';
  var email = '';
  
  var sheet = _aba(CFG.ABA_MONITORES);
  if (!sheet) return _err('Base de monitores não encontrada.');
  var rows = sheet.getDataRange().getValues();
  var foundRowIndex = -1;

  if (isEmail) {
    email = loginInput.toLowerCase();
    for (var i = 1; i < rows.length; i++) {
      var rowEmail = _san(String(rows[i][MC.EMAIL - 1] || '')).toLowerCase();
      if (rowEmail === email) {
        foundRowIndex = i;
        cpf = _normCPF(String(rows[i][MC.CPF - 1]));
        break;
      }
    }
    if (foundRowIndex === -1) return _err('E-mail não cadastrado.', 'INVALID_CREDENTIALS');
  } else {
    cpf = _normCPF(loginInput);
    if (cpf.length !== 11)   return _err('CPF deve ter 11 dígitos.');
    if (!_validaCPFAlg(cpf)) return _err('CPF inválido (dígitos verificadores incorretos).');
    for (var i = 1; i < rows.length; i++) {
      if (_normCPF(String(rows[i][MC.CPF - 1])) === cpf) {
        foundRowIndex = i;
        break;
      }
    }
    if (foundRowIndex === -1) return _err('CPF não credenciado.', 'INVALID_CREDENTIALS');
  }

  var rl = _checkRateLimit(cpf);
  if (rl.bloqueado) return _err(rl.msg, 'LOCKED');

  var hashSalvo = String(rows[foundRowIndex][MC.SENHA_HASH - 1] || '').trim();
  if (!hashSalvo) return _err('Senha não cadastrada. Use "Meu Primeiro Acesso".', 'NO_PASSWORD');
  if (_hashSenha(cpf, senha) !== hashSalvo) {
    _incrementaRL(cpf);
    return _err('Credenciais incorretas. Tentativas restantes: ' + _tentativasRestantes(cpf), 'INVALID_CREDENTIALS');
  }

  _resetRL(cpf);
  var token = _novoToken();
  CacheService.getScriptCache().put('TK_' + token, JSON.stringify({ cpf: cpf, emitido: Date.now() }), CFG.TOKEN_HORAS * 3600);
  try {
    var tsStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
    sheet.getRange(foundRowIndex + 1, MC.ULTIMO_LOGIN).setValue(tsStr);
  } catch(e2){}
  return {
    ok: true, token: token,
    monitor: {
      nome: _san(rows[foundRowIndex][MC.NOME - 1]),
      cpf: _maskCPF(cpf),
      telefone: _san(rows[foundRowIndex][MC.TELEFONE - 1]),
      email: _san(rows[foundRowIndex][MC.EMAIL - 1]),
      rg: _san(rows[foundRowIndex][MC.RG - 1] || ''),
      cidade: _san(rows[foundRowIndex][MC.CIDADE - 1] || ''),
      bairro: _san(rows[foundRowIndex][MC.BAIRRO - 1] || '')
    }
  };
}

function _verificarCPF(p) {
  var cpf = _normCPF(p.cpf);
  if (cpf.length !== 11)   return _err('CPF deve ter 11 dígitos.');
  if (!_validaCPFAlg(cpf)) return _err('CPF inválido.');
  var adminSheet=_aba(CFG.ABA_ADMIN);
  if(adminSheet){var admins=adminSheet.getDataRange().getValues();for(var a=1;a<admins.length;a++){
    if(_normCPF(String(admins[a][0]||''))!==cpf)continue;
    if(String(admins[a][4]||'').trim().toLowerCase()!=='sim')return _err('Conta inativa.','INACTIVE');
    if(admins[a][3])return _err('Este CPF já possui senha cadastrada.','HAS_PASSWORD');
    return _enviarCodigo(cpf,String(admins[a][1]||'').trim(),'primeiro');
  }}
  var rows = _aba(CFG.ABA_MONITORES).getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (_normCPF(String(rows[i][MC.CPF - 1])) !== cpf) continue;
    if (rows[i][MC.SENHA_HASH - 1]) return _err('Este CPF já possui senha cadastrada.', 'HAS_PASSWORD');
    return _enviarCodigo(cpf, String(rows[i][MC.EMAIL - 1] || '').trim(), 'primeiro');
  }
  return _err('CPF não credenciado na base da SETUR.', 'NOT_FOUND');
}

function _enviarCodigo(cpf, email, finalidade) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return _err('Não há e-mail válido no cadastro. Solicite a atualização à SETUR.', 'EMAIL_REQUIRED');
  }
  var cache = CacheService.getScriptCache();
  var chave = 'COD_' + finalidade + '_' + cpf;
  if (cache.get('COD_ENV_' + finalidade + '_' + cpf)) {
    return _err('Aguarde um minuto antes de solicitar outro código.', 'RATE_LIMIT');
  }
  var codigo = String(100000 + Math.floor(Math.random() * 900000));
  cache.put(chave, JSON.stringify({ hash: _hashSenha(cpf, finalidade + '|' + codigo), tentativas: 0 }), CFG.CODIGO_MINUTOS * 60);
  try {
    MailApp.sendEmail(email, 'Código de acesso — Portal do Monitor',
      'Seu código de confirmação é ' + codigo + '. Ele vale por ' + CFG.CODIGO_MINUTOS +
      ' minutos. Se você não solicitou este código, ignore esta mensagem.');
  } catch (e) {
    cache.remove(chave);
    Logger.log('Falha ao enviar código: ' + e);
    return _err('Não foi possível enviar o código. Tente novamente mais tarde.', 'EMAIL_ERROR');
  }
  cache.put('COD_ENV_' + finalidade + '_' + cpf, '1', 60);
  return { ok: true, emailMascarado: _mascararEmail(email) };
}

function _confirmarCodigo(p) {
  var cpf = _normCPF(p.cpf);
  var finalidade = p.finalidade;
  var codigo = String(p.codigo || '').trim();
  if (cpf.length !== 11 || ['primeiro','recuperar','perfil'].indexOf(finalidade) === -1 || !/^\d{6}$/.test(codigo)) {
    return _err('Código inválido.', 'CODE_INVALID');
  }
  if (finalidade === 'perfil') {
    var sessaoPerfil = _validaToken(p.token);
    if (!sessaoPerfil || sessaoPerfil.cpf !== cpf) return _err('Sessão expirada.', 'UNAUTHORIZED');
  }
  var cache = CacheService.getScriptCache();
  var chave = 'COD_' + finalidade + '_' + cpf;
  var raw = cache.get(chave);
  if (!raw) return _err('Código expirado. Solicite um novo.', 'CODE_EXPIRED');
  var desafio = JSON.parse(raw);
  if (desafio.tentativas >= 5) return _err('Limite de tentativas atingido. Solicite outro código.', 'CODE_LOCKED');
  if (desafio.hash !== _hashSenha(cpf, finalidade + '|' + codigo)) {
    desafio.tentativas++;
    if (desafio.tentativas >= 5) cache.remove(chave);
    else cache.put(chave, JSON.stringify(desafio), CFG.CODIGO_MINUTOS * 60);
    return _err('Código incorreto.', 'CODE_INVALID');
  }
  cache.remove(chave);
  var resposta = { ok: true };
  if (finalidade === 'primeiro') {
    var adminSheet=_aba(CFG.ABA_ADMIN);
    if(adminSheet){var admins=adminSheet.getDataRange().getValues();for(var a=1;a<admins.length;a++){
      if(_normCPF(String(admins[a][0]||''))!==cpf)continue;
      if(String(admins[a][4]||'').trim().toLowerCase()!=='sim'||admins[a][3])return _err('Acesso indisponível.','HAS_PASSWORD');
      resposta.papel='admin';resposta.admin={nome:String(admins[a][2]||'Administrador')};break;
    }}
    if(resposta.papel==='admin'){
      var adminTicket=_novoToken();cache.put('PASS_'+adminTicket,JSON.stringify({cpf:cpf,finalidade:finalidade}),CFG.CODIGO_MINUTOS*60);
      resposta.ticket=adminTicket;return resposta;
    }
    var rows = _aba(CFG.ABA_MONITORES).getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (_normCPF(String(rows[i][MC.CPF - 1])) !== cpf) continue;
      if (rows[i][MC.SENHA_HASH - 1]) return _err('Senha já cadastrada.', 'HAS_PASSWORD');
      resposta.monitor = {
        nome: String(rows[i][MC.NOME - 1] || ''), cpf: _maskCPF(cpf),
        rg: String(rows[i][MC.RG - 1] || ''), telefone: String(rows[i][MC.TELEFONE - 1] || ''),
        email: String(rows[i][MC.EMAIL - 1] || ''), cidade: String(rows[i][MC.CIDADE - 1] || ''),
        bairro: String(rows[i][MC.BAIRRO - 1] || '')
      };
      break;
    }
    if (!resposta.monitor) return _err('Monitor não encontrado.', 'NOT_FOUND');
  }
  var ticket = _novoToken();
  cache.put('PASS_' + ticket, JSON.stringify({ cpf: cpf, finalidade: finalidade }), CFG.CODIGO_MINUTOS * 60);
  resposta.ticket = ticket;
  return resposta;
}

function _criarSenha(p) {
  var cpf = _normCPF(p.cpf), senha = p.senha;
  if (cpf.length !== 11 || !_validaCPFAlg(cpf)) return _err('CPF inválido.');
  if (!senha || senha.length < 8) return _err('A senha deve ter no mínimo 8 caracteres.');
  if (!_ticketValido(p.ticket, cpf, 'primeiro')) return _err('Confirmação expirada. Solicite outro código.', 'UNAUTHORIZED');
  var adminSheet=_aba(CFG.ABA_ADMIN);
  if(adminSheet){var admins=adminSheet.getDataRange().getValues();for(var a=1;a<admins.length;a++){
    if(_normCPF(String(admins[a][0]||''))!==cpf)continue;
    if(String(admins[a][4]||'').trim().toLowerCase()!=='sim'||admins[a][3])return _err('Acesso indisponível.','HAS_PASSWORD');
    if(!_consumirTicket(p.ticket,cpf,'primeiro'))return _err('Confirmação expirada.','UNAUTHORIZED');
    adminSheet.getRange(a+1,4).setValue(_hashSenha(cpf,senha));
    return {ok:true,msg:'Senha administrativa criada. Faça login.'};
  }}
  
  var nome = _san(p.nome || '');
  var rg = _san(p.rg || '');
  var telefone = _san(p.telefone || '');
  var email = _san(p.email || '');
  var cidade = _localidadePadronizada(p.cidade, false);
  var bairro = _san(p.bairro || '');
  
  if (!nome) return _err('Nome é obrigatório.');
  if (!rg) return _err('RG é obrigatório.');
  if (!telefone) return _err('Telefone é obrigatório.');
  if (!email) return _err('E-mail é obrigatório.');
  if (!cidade) return _err('Informe a cidade no formato Cidade/UF (ex.: São Sebastião/SP).', 'CITY_INVALID');
  if (!bairro) return _err('Bairro é obrigatório.');

  var sheet = _aba(CFG.ABA_MONITORES);
  var rows  = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (_normCPF(String(rows[i][MC.CPF - 1])) !== cpf) continue;
    if (rows[i][MC.SENHA_HASH - 1]) return _err('Senha já cadastrada.', 'HAS_PASSWORD');
    
    var rgExistente = String(rows[i][MC.RG - 1] || '').trim();
    if (rgExistente && rg !== rgExistente) {
      return _err('O RG não pode ser editado pois já está preenchido.');
    }
    
    var rowNum = i + 1;
    if (!_consumirTicket(p.ticket, cpf, 'primeiro')) return _err('Confirmação expirada.', 'UNAUTHORIZED');
    sheet.getRange(rowNum, MC.RG).setValue(rg);
    sheet.getRange(rowNum, MC.NOME).setValue(nome);
    sheet.getRange(rowNum, MC.TELEFONE).setValue(telefone);
    sheet.getRange(rowNum, MC.EMAIL).setValue(email);
    sheet.getRange(rowNum, MC.CIDADE).setValue(cidade);
    sheet.getRange(rowNum, MC.BAIRRO).setValue(bairro);
    sheet.getRange(rowNum, MC.SENHA_HASH).setValue(_hashSenha(cpf, senha));
    
    return { ok: true, msg: 'Senha criada e dados atualizados com sucesso!' };
  }
  return _err('CPF não encontrado.', 'NOT_FOUND');
}

// ─────────────────────────────────────────────────────────────
// REGRA DE PERÍODOS E DURAÇÃO DE VISITA (4 HORAS MÁXIMO)
// ─────────────────────────────────────────────────────────────
function _parseHoraMinuto(val) {
  if (!val) return { hora: 0, minuto: 0 };
  if (val instanceof Date) return { hora: val.getHours(), minuto: val.getMinutes() };
  var s = String(val).trim();
  
  // Se for uma string de data longa que inclui hora, ex: "Sat Dec 30 1899 08:00:00 GMT-0300"
  var mDate = s.match(/\b(\d{2}):(\d{2}):(\d{2})\b/);
  if (mDate) return { hora: parseInt(mDate[1], 10), minuto: parseInt(mDate[2], 10) };
  
  // Se for formato simples "HH:mm" ou "H:mm"
  var m = s.match(/\b(\d{1,2}):(\d{2})\b/);
  if (m) return { hora: parseInt(m[1], 10), minuto: parseInt(m[2], 10) };
  
  return { hora: 0, minuto: 0 };
}

function _getPeriodosDeVisita(horario) {
  var t = _parseHoraMinuto(horario);
  var start = t.hora + t.minuto / 60;
  var end = start + 4;
  var p = [];
  if (start < 13) p.push('manha');
  if (end > 13) p.push('tarde');
  return p;
}

// ─────────────────────────────────────────────────────────────
// DATAS BLOQUEADAS
// ─────────────────────────────────────────────────────────────
function _getDatas(p) {
  if (!_validaToken(p.token)) return _err('Sessão inválida.', 'UNAUTHORIZED');
  var tz = Session.getScriptTimeZone();

  // ── 1. Datas bloqueadas manualmente ──────────────────────────────────
  var datasBlq = [];
  var blqSheet = _aba(CFG.ABA_BLOQUEADAS);
  if (blqSheet) {
    var blqRows = blqSheet.getDataRange().getValues();
    for (var i = 1; i < blqRows.length; i++) {
      var raw = blqRows[i][0], motivo = _san(blqRows[i][1] || '');
      if (!raw) continue;
      var iso = '';
      if (raw instanceof Date) { iso = Utilities.formatDate(raw, tz, 'yyyy-MM-dd'); }
      else { var s = String(raw).trim(); if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { var p2=s.split('/'); iso=p2[2]+'-'+p2[1]+'-'+p2[0]; } else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) iso=s; }
      if (iso) datasBlq.push({ data: iso, motivo: motivo });
    }
  }

  // ── 2. Capacidade por data+período (pendentes e confirmados) ──────────
  var resSheet = _aba(CFG.ABA_RESPOSTAS);
  var resRows  = resSheet.getDataRange().getValues();
  var capMap   = {}; // { 'yyyy-MM-dd': { manha: N, tarde: N } }

  for (var r = 1; r < resRows.length; r++) {
    var st = _san(String(resRows[r][18] || '')).toLowerCase();
    if (st === 'cancelado' || st === 'negado') continue;
    var dRaw = resRows[r][9], dStr = '';
    if (dRaw instanceof Date) dStr = Utilities.formatDate(dRaw, tz, 'yyyy-MM-dd');
    else dStr = String(dRaw || '').trim();
    if (!dStr) continue;
    
    var periodos = _getPeriodosDeVisita(resRows[r][10]);
    if (!capMap[dStr]) capMap[dStr] = { manha: 0, tarde: 0 };
    for (var iPeriodo = 0; iPeriodo < periodos.length; iPeriodo++) {
      capMap[dStr][periodos[iPeriodo]] += Number(resRows[r][4]) || 0;
    }
  }

  // ── 3. Datas/períodos com capacidade atingida ──────────────────────────
  var blqSet = {};
  datasBlq.forEach(function(b) { blqSet[b.data] = true; });
  var datasLotadas = [];

  for (var data in capMap) {
    if (blqSet[data]) continue; // já bloqueada manualmente
    var cap = capMap[data];
    var manhaLot = cap.manha >= CFG.CAPACIDADE_PERIODO;
    var tardeLot = cap.tarde >= CFG.CAPACIDADE_PERIODO;
    if (manhaLot || tardeLot) {
      datasLotadas.push({
        data:       data,
        manha:      { ocupado: cap.manha, lotado: manhaLot },
        tarde:      { ocupado: cap.tarde, lotado: tardeLot },
        todoLotado: manhaLot && tardeLot
      });
    }
  }

  return { ok: true, datas: datasBlq, lotadas: datasLotadas };
}

// ─────────────────────────────────────────────────────────────
// SALVAR SOLICITAÇÃO
// ─────────────────────────────────────────────────────────────
function _salvar(p) {
  var sessao = _validaToken(p.token);
  if (!sessao) return _err('Sessão expirada.', 'UNAUTHORIZED');
  var v = p.visita;
  if (!v) return _err('Dados ausentes.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v.dataVisita || ''))) return _err('Data inválida.', 'DATE_INVALID');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v.horario || ''))) return _err('Horário inválido.', 'TIME_INVALID');
  var inicio = _parseHoraMinuto(v.horario);
  if (inicio.hora * 60 + inicio.minuto > 14 * 60) return _err('A visita deve começar até 14h para terminar antes das 18h.', 'TIME_INVALID');
  if (!String(v.tipoGrupo || '').trim() || !String(v.faixaEtaria || '').trim() || !String(v.origem || '').trim()) {
    return _err('Preencha tipo, faixa etária e origem do grupo.', 'FIELDS_REQUIRED');
  }
  var origemPadronizada=_localidadePadronizada(v.origem,true);
  if(!origemPadronizada)return _err('Informe uma cidade/UF válida ou selecione um país. Para outro país, use País: Nome.', 'ORIGIN_INVALID');
  if (!Number.isInteger(Number(v.antecedencia)) || Number(v.antecedencia) < 1 ||
      !Number.isInteger(Number(v.diasSS)) || Number(v.diasSS) < 1) {
    return _err('Informe números válidos para antecedência e dias de permanência.', 'FIELDS_INVALID');
  }

  // ── Antecedência mínima (servidor) ──────────────────────────
  var hoje = new Date(); hoje.setHours(0,0,0,0);
  var dataVisitaDt = new Date(v.dataVisita + 'T00:00:00');
  if (isNaN(dataVisitaDt.getTime()) || Utilities.formatDate(dataVisitaDt, Session.getScriptTimeZone(), 'yyyy-MM-dd') !== v.dataVisita) {
    return _err('Data inválida.', 'DATE_INVALID');
  }
  var diffDias = Math.round((Date.UTC(dataVisitaDt.getFullYear(), dataVisitaDt.getMonth(), dataVisitaDt.getDate()) -
    Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) / 86400000);
  if (isNaN(diffDias) || diffDias < CFG.ANTECEDENCIA_MIN_DIAS) return _err('A visita deve ser solicitada com pelo menos ' + CFG.ANTECEDENCIA_MIN_DIAS + ' dias de antecedência.', 'DATE_INVALID');
  if (diffDias > CFG.ANTECEDENCIA_MAX_DIAS) return _err('A data não pode ser superior a ' + CFG.ANTECEDENCIA_MAX_DIAS + ' dias.', 'DATE_INVALID');

  // ── Tamanho do grupo e monitores auxiliares necessários ─────
  var tamGrupo = Number(v.tamanhoGrupo);
  if (!Number.isInteger(tamGrupo) || tamGrupo < 1 || tamGrupo > CFG.MAX_GRUPO) return _err('O grupo deve ter de 1 a 50 pessoas.', 'GROUP_INVALID');

  var minAux = Math.max(0, Math.ceil(tamGrupo / CFG.PESSOAS_POR_MONITOR) - 1);

  // ── Data bloqueada (servidor) ────────────────────────────────
  var blqSheet = _aba(CFG.ABA_BLOQUEADAS);
  if (blqSheet) {
    var blqRows = blqSheet.getDataRange().getValues();
    var tz0 = Session.getScriptTimeZone();
    for (var b = 1; b < blqRows.length; b++) {
      var blqRaw = blqRows[b][0], blqIso = '';
      if (blqRaw instanceof Date) { blqIso = Utilities.formatDate(blqRaw, tz0, 'yyyy-MM-dd'); }
      else { var blqStr=String(blqRaw).trim(); if (/^\d{2}\/\d{2}\/\d{4}$/.test(blqStr)){var bp=blqStr.split('/');blqIso=bp[2]+'-'+bp[1]+'-'+bp[0];}else if(/^\d{4}-\d{2}-\d{2}$/.test(blqStr))blqIso=blqStr; }
      if (blqIso === v.dataVisita) return _err('Esta data está bloqueada: ' + _san(blqRows[b][1] || 'Data indisponível') + '.', 'DATE_BLOCKED');
    }
  }

  // ── Localizar monitor ────────────────────────────────────────
  var monSheet = _aba(CFG.ABA_MONITORES);
  var monRows  = monSheet.getDataRange().getValues();
  var monRow   = null;
  for (var m = 1; m < monRows.length; m++) {
    if (_normCPF(String(monRows[m][MC.CPF - 1])) === sessao.cpf) { monRow = monRows[m]; break; }
  }
  if (!monRow) return _err('Monitor não localizado.');
  var auxiliares = _resolverAuxiliares(v.monitoresAux, monRows, sessao.cpf);
  if (!auxiliares.ok) return auxiliares;
  if (auxiliares.cpfs.length < minAux) return _err('Selecione pelo menos ' + minAux + ' monitor(es) auxiliar(es) credenciado(s).', 'INSUFFICIENT_MONITORS');

  // ── Capacidade do período (50 pessoas) ───────────────────────
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return _err('O sistema está ocupado. Tente novamente em instantes.', 'BUSY');
  try {
  var resSheet = _aba(CFG.ABA_RESPOSTAS);
  var periodosNovos = _getPeriodosDeVisita(v.horario);
  var ocupacao = { manha: 0, tarde: 0 };
  var tz1 = Session.getScriptTimeZone();
  var resRowsAll = resSheet.getDataRange().getValues();
  for (var r = 1; r < resRowsAll.length; r++) {
    var resStatus = _san(String(resRowsAll[r][18] || '')).toLowerCase();
    if (resStatus === 'cancelado' || resStatus === 'negado') continue;
    var resDataRaw = resRowsAll[r][9], resDataStr = '';
    if (resDataRaw instanceof Date) resDataStr = Utilities.formatDate(resDataRaw, tz1, 'yyyy-MM-dd');
    else resDataStr = String(resDataRaw || '').trim();
    if (resDataStr !== v.dataVisita) continue;
    if (_normCPF(String(resRowsAll[r][RF.CPF - 1])) === sessao.cpf &&
        resStatus !== 'cancelado' && resStatus !== 'negado') {
      return _err('Você já tem uma solicitação ativa nesta data.', 'DUPLICATE');
    }
    
    var pVisita = _getPeriodosDeVisita(resRowsAll[r][10]);
    for (var iPV = 0; iPV < pVisita.length; iPV++) {
      ocupacao[pVisita[iPV]] += Number(resRowsAll[r][4]) || 0;
    }
  }
  for (var iP = 0; iP < periodosNovos.length; iP++) {
    var per = periodosNovos[iP];
    if (ocupacao[per] + tamGrupo > CFG.CAPACIDADE_PERIODO) {
      var vagasR = Math.max(0, CFG.CAPACIDADE_PERIODO - ocupacao[per]);
      var perNome = per === 'manha' ? 'da manhã' : 'da tarde';
      return _err('Capacidade máxima de ' + CFG.CAPACIDADE_PERIODO + ' pessoas para o período ' + perNome + ' atingida.' + (vagasR > 0 ? ' Restam ' + vagasR + ' vaga(s).' : ' Tente outro período ou data.'), 'CAPACITY_EXCEEDED');
    }
  }

  // ── Salvar linha ─────────────────────────────────────────────
  var statusInicial = 'Pendente';
  var aceitesJson = '';
  var aguardandoAux = false;
  
  if (auxiliares.cpfs.length) {
    var aceites = {};
    for (var n = 0; n < auxiliares.nomes.length; n++) aceites[auxiliares.nomes[n]] = 'Pendente';
    statusInicial = 'Aguardando Auxiliares';
    aceitesJson = JSON.stringify(aceites);
    aguardandoAux = true;
  }

  // Assegurar cabeçalho na coluna 22 se ainda não existir
  if (resSheet.getLastColumn() < 22) {
    resSheet.getRange(1, 22).setValue('Aceites Auxiliares');
  }
  if (resSheet.getLastColumn() < 23) {
    resSheet.getRange(1, 23).setValue('CPFs Auxiliares');
  }

  var protocolosEmUso = {};
  for (var pr = 1; pr < resRowsAll.length; pr++) protocolosEmUso[String(resRowsAll[pr][RF.PROTOCOLO - 1] || '').trim()] = true;
  var protocolo = _gerarProtocoloUnico(new Date(), protocolosEmUso);
  var linha = new Array(RF.TOTAL_COLUNAS);
  for (var k = 0; k < linha.length; k++) linha[k] = '';
  linha[0]  = new Date();
  linha[1]  = _san(monRow[MC.EMAIL - 1]);
  linha[2]  = _san(monRow[MC.NOME - 1]);
  linha[3]  = _san(monRow[MC.TELEFONE - 1]);
  linha[4]  = tamGrupo;
  linha[5]  = 'Sou Monitor Ambiental Credenciado pelo PESM';
  linha[6]  = sessao.cpf;
  linha[7]  = _san(v.nomeAgencia || '');
  linha[8]  = _san(v.cnpjAgencia || '');
  linha[9]  = new Date(v.dataVisita + 'T00:00:00');
  linha[10] = v.horario ? (_san(v.horario) + ':00') : '';      // HH:mm:ss
  linha[11] = _san(origemPadronizada);
  linha[12] = _san(v.tipoGrupo);
  linha[13] = _san(v.faixaEtaria);
  linha[14] = _san(v.hospedagem || '');
  linha[15] = Number(v.antecedencia) >= 31 ? 30 : Number(v.antecedencia);  // número puro
  linha[16] = Number(v.diasSS) >= 16 ? 15 : Number(v.diasSS);              // número puro
  linha[17] = auxiliares.nomes.join(', ');
  linha[18] = statusInicial;
  linha[20] = protocolo;
  linha[21] = aceitesJson; // Coluna 22
  linha[22] = auxiliares.cpfs.join(', '); // Coluna 23 (opcional para registros legados)
  resSheet.appendRow(linha);

  // ── Notificar auxiliares ─────────────────────────────────────
  if (auxiliares.cpfs.length) {
    var monInfo = { quem: _san(monRow[MC.NOME - 1]), email: _san(monRow[MC.EMAIL - 1]), telefone: _san(monRow[MC.TELEFONE - 1]), data: _san(v.dataVisita), horario: v.horario ? (_san(v.horario)+':00') : '—', tamanho: tamGrupo, origem: _san(origemPadronizada), tipoGrupo: _san(v.tipoGrupo), protocolo: protocolo };
    for (var n = 0; n < auxiliares.cpfs.length; n++) {
      var chave = 'NOTIF_' + auxiliares.cpfs[n];
      var existentes = [];
      try { existentes = JSON.parse(CacheService.getScriptCache().get(chave) || '[]'); } catch(e2){}
      existentes.push(monInfo);
      CacheService.getScriptCache().put(chave, JSON.stringify(existentes.slice(-10)), 21600);
    }
  }
  return { ok: true, protocolo: protocolo, aguardandoAux: aguardandoAux };
  } finally {
    lock.releaseLock();
  }
}

// ─────────────────────────────────────────────────────────────
// HISTÓRICO (últimas 15 — painel principal)
// ─────────────────────────────────────────────────────────────
function _getHistorico(p) {
  var sessao = _validaToken(p.token);
  if (!sessao) return _err('Sessão expirada.', 'UNAUTHORIZED');

  // Buscar nome do monitor logado (para identificar onde é auxiliar)
  var monRows = _aba(CFG.ABA_MONITORES).getDataRange().getValues();
  var nomeMonitor = '';
  for (var m = 1; m < monRows.length; m++) {
    if (_normCPF(String(monRows[m][MC.CPF - 1])) === sessao.cpf) { nomeMonitor = _san(monRows[m][MC.NOME - 1]); break; }
  }

  var rows = _aba(CFG.ABA_RESPOSTAS).getDataRange().getValues();
  var lista = [];
  var tz = Session.getScriptTimeZone();
  for (var i = 1; i < rows.length; i++) {
    var cpfRow = _normCPF(String(rows[i][RF.CPF - 1]));
    var auxiliares = _san(rows[i][17] || '');
    var isPrincipal = cpfRow === sessao.cpf;
    var isAuxiliar = _ehAuxiliar(rows[i], sessao.cpf, nomeMonitor);
    if (!isPrincipal && !isAuxiliar) continue;

    var dataRaw = rows[i][9], dataStr = '';
    if (dataRaw instanceof Date) dataStr = Utilities.formatDate(dataRaw, tz, 'dd/MM/yyyy');
    else if (dataRaw) dataStr = String(dataRaw);

    var horRaw = rows[i][10], horStr = '';
    if (horRaw) {
      var s = String(horRaw).trim();
      var m = s.match(/(\d{2}):(\d{2})/);
      if (m) horStr = m[1] + ':' + m[2];
      else horStr = s;
    } else {
      horStr = '—';
    }

    var aceitesStr = _san(rows[i][21] || '');
    var aceites = {};
    try { if (aceitesStr) aceites = JSON.parse(aceitesStr); } catch(e){}

    var meuStatusAceite = _meuAceite(aceites, sessao.cpf, nomeMonitor, rows[i]);
    var status = _san(rows[i][18] || 'Pendente');
    var convitePendente = isAuxiliar && status.toLowerCase() === 'aguardando auxiliares' && meuStatusAceite === 'Pendente';

    var protocolo = _referenciaSolicitacao(rows[i], i);

    lista.push({
      protocolo:     protocolo,
      data:          dataStr || '—',
      horario:       horStr || '—',
      tamanho:       rows[i][4] || '?',
      origem:        _san(rows[i][11] || '—'),
      nomeAgencia:   _san(rows[i][7] || ''),
      tipo:          _san(rows[i][12] || '—'),
      status:        status,
      motivo:        _san(rows[i][19] || ''),
      isPrincipal:   isPrincipal,
      isAuxiliar:    isAuxiliar,
      nomePrincipal: isPrincipal ? '' : _san(rows[i][2] || '—'),
      convitePendente: convitePendente,
      meuStatusAceite: meuStatusAceite,
      aceites:       _aceitesParaExibicao(aceites, monRows)
    });
  }
  return { ok: true, lista: lista.reverse().slice(0, CFG.MAX_HISTORICO) }; // retorna até 100 registros por monitor
}

// ─────────────────────────────────────────────────────────────
// BUSCA NO HISTÓRICO COMPLETO (sem limite de 15, com filtros)
// ─────────────────────────────────────────────────────────────
function _buscarHistorico(p) {
  var sessao = _validaToken(p.token);
  if (!sessao) return _err('Sessão expirada.', 'UNAUTHORIZED');

  // Buscar nome do monitor para identificar onde aparece como auxiliar
  var monRows = _aba(CFG.ABA_MONITORES).getDataRange().getValues();
  var nomeMonitor = '';
  for (var m = 1; m < monRows.length; m++) {
    if (_normCPF(String(monRows[m][MC.CPF - 1])) === sessao.cpf) { nomeMonitor = _san(monRows[m][MC.NOME - 1]); break; }
  }

  var rows  = _aba(CFG.ABA_RESPOSTAS).getDataRange().getValues();
  var lista = [];
  var tz    = Session.getScriptTimeZone();
  var query  = _san(p.query  || '').toLowerCase().trim();
  var filtro = _san(p.filtro || 'ambas'); // 'ambas' | 'minhas' | 'auxiliar'

  for (var i = 1; i < rows.length; i++) {
    var cpfRow    = _normCPF(String(rows[i][RF.CPF - 1]));
    var auxiliares = _san(rows[i][17] || '');
    var isPrincipal = cpfRow === sessao.cpf;
    var isAuxiliar = _ehAuxiliar(rows[i], sessao.cpf, nomeMonitor);

    // Aplicar filtro de papel
    if (filtro === 'minhas'   && !isPrincipal)             continue;
    if (filtro === 'auxiliar' && !isAuxiliar)              continue;
    if (filtro === 'ambas'    && !isPrincipal && !isAuxiliar) continue;

    var dataRaw = rows[i][9], dataStr = '';
    if (dataRaw instanceof Date) dataStr = Utilities.formatDate(dataRaw, tz, 'dd/MM/yyyy');
    else if (dataRaw) dataStr = String(dataRaw);

    var horRaw = rows[i][10], horStr = '';
    if (horRaw) {
      var s = String(horRaw).trim();
      var m = s.match(/(\d{2}):(\d{2})/);
      if (m) horStr = m[1] + ':' + m[2];
      else horStr = s;
    } else {
      horStr = '—';
    }

    var protocolo = _referenciaSolicitacao(rows[i], i);
    var status       = _san(rows[i][18] || 'Pendente');
    var motivo       = _san(rows[i][19] || '');
    var tipo         = _san(rows[i][12] || '—');
    var origem       = _san(rows[i][11] || '—');
    var nomePrincipal= _san(rows[i][2]  || '—');

    // Filtrar por texto livre
    if (query) {
      var hay = (protocolo+' '+dataStr+' '+status+' '+tipo+' '+origem+' '+motivo+' '+nomePrincipal).toLowerCase();
      if (hay.indexOf(query) === -1) continue;
    }

    var aceitesStr = _san(rows[i][21] || '');
    var aceites = {};
    try { if (aceitesStr) aceites = JSON.parse(aceitesStr); } catch(e){}

    var meuStatusAceite = _meuAceite(aceites, sessao.cpf, nomeMonitor, rows[i]);
    var convitePendente = isAuxiliar && status.toLowerCase() === 'aguardando auxiliares' && meuStatusAceite === 'Pendente';

    lista.push({
      protocolo:     protocolo,
      data:          dataStr || '—',
      horario:       horStr || '—',
      tamanho:       rows[i][4] || '?',
      origem:        origem,
      nomeAgencia:   _san(rows[i][7] || ''),
      tipo:          tipo,
      status:        status,
      motivo:        motivo,
      isPrincipal:   isPrincipal,
      isAuxiliar:    isAuxiliar,
      nomePrincipal: isPrincipal ? '' : nomePrincipal,
      convitePendente: convitePendente,
      meuStatusAceite: meuStatusAceite,
      aceites:       _aceitesParaExibicao(aceites, monRows)
    });
  }
  return { ok: true, lista: lista.reverse(), total: lista.length };
}

// ─────────────────────────────────────────────────────────────
// DETALHAR SOLICITAÇÃO (principal e auxiliar podem ver)
// ─────────────────────────────────────────────────────────────
function _detalharSolicitacao(p) {
  var admin = _adminTem(p.token, 'verSolicitacoes') || _adminTem(p.token, 'decidir');
  var sessao = admin ? null : _validaToken(p.token);
  if (!admin && !sessao) return _err('Sessão expirada.', 'UNAUTHORIZED');
  if (!p.protocolo) return _err('Protocolo não informado.');

  // Buscar nome do monitor logado (para verificar se é auxiliar)
  var monRows = _aba(CFG.ABA_MONITORES).getDataRange().getValues();
  var nomeMonitor = '';
  if (sessao) for (var m = 1; m < monRows.length; m++) {
    if (_normCPF(String(monRows[m][MC.CPF - 1])) === sessao.cpf) { nomeMonitor = _san(monRows[m][MC.NOME - 1]); break; }
  }

  var sheet = _aba(CFG.ABA_RESPOSTAS);
  var rows  = sheet.getDataRange().getValues();
  var tz    = Session.getScriptTimeZone();

  for (var i = 1; i < rows.length; i++) {
    var proto = _referenciaSolicitacao(rows[i], i);
    if (proto !== _san(p.protocolo)) continue;

    var cpfPrincipal = _normCPF(String(rows[i][RF.CPF - 1]));
    var auxiliares   = _san(rows[i][17] || '');
    var isPrincipal  = !!sessao && cpfPrincipal === sessao.cpf;
    var isAuxiliar = !!sessao && _ehAuxiliar(rows[i], sessao.cpf, nomeMonitor);

    if (!admin && !isPrincipal && !isAuxiliar) return _err('Sem permissão para ver esta solicitação.', 'FORBIDDEN');

    var dataRaw = rows[i][9], dataStr = '';
    if (dataRaw instanceof Date) dataStr = Utilities.formatDate(dataRaw, tz, 'dd/MM/yyyy');
    else if (dataRaw) dataStr = String(dataRaw);

    var horStr = rows[i][10] ? _horaAdmin(rows[i][10]) : '—';

    var aceitesStr = _san(rows[i][21] || '');
    var aceites = {};
    try { if (aceitesStr) aceites = JSON.parse(aceitesStr); } catch(e){}

    return {
      ok: true,
      solicitacao: {
        protocolo:    proto,
        data:         dataStr || '—',
        horario:      horStr,
        tamanho:      String(rows[i][4] || '?'),
        nomeMonitor:  _san(rows[i][2]  || '—'),   // nome do principal
        email:        _san(rows[i][1]  || '—'),   // e-mail do principal
        telefone:     _san(rows[i][3]  || '—'),   // telefone do principal
        nomeAgencia:  _san(rows[i][7]  || ''),
        cnpjAgencia:  _san(rows[i][8]  || ''),
        origem:       _san(rows[i][11] || '—'),
        tipoGrupo:    _san(rows[i][12] || '—'),
        faixaEtaria:  _san(rows[i][13] || '—'),
        hospedagem:   _san(rows[i][14] || '—'),
        antecedencia: String(rows[i][15] || '—'),
        diasSS:       String(rows[i][16] || '—'),
        auxiliares:   auxiliares || 'Nenhum',
        status:       _san(rows[i][18] || 'Pendente'),
        motivo:       _san(rows[i][19] || ''),
        isPrincipal:  isPrincipal,
        isAuxiliar:   isAuxiliar,
        isAdmin:      !!admin,
        aceites:      _aceitesParaExibicao(aceites, monRows)
      }
    };
  }
  return _err('Solicitação não encontrada.', 'NOT_FOUND');
}

// ─────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────
function _logout(p) {
  if (p.token) CacheService.getScriptCache().remove('TK_' + p.token);
  if (p.token) CacheService.getScriptCache().remove('ATK_' + p.token);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// LISTAR MONITORES CREDENCIADOS
// ─────────────────────────────────────────────────────────────
function _listarMonitores(p) {
  if (!_validaToken(p.token)) return _err('Sessão inválida.', 'UNAUTHORIZED');
  var sheet = _aba(CFG.ABA_MONITORES);
  var rows = sheet.getDataRange().getValues();
  var lista = [];
  for (var i = 1; i < rows.length; i++) {
    var nome = _san(rows[i][MC.NOME - 1]);
    var cpf  = _normCPF(String(rows[i][MC.CPF - 1]));
    if (nome) lista.push({ nome: nome, cpf: cpf });
  }
  return { ok: true, monitores: lista };
}

// ─────────────────────────────────────────────────────────────
// NOTIFICAÇÕES
// ─────────────────────────────────────────────────────────────
function _getNotificacoes(p) {
  var sessao = _validaToken(p.token);
  if (!sessao) return _err('Sessão inválida.', 'UNAUTHORIZED');
  var chave = 'NOTIF_' + sessao.cpf;
  var lista = [];
  try { lista = JSON.parse(CacheService.getScriptCache().get(chave) || '[]'); } catch(e){}
  CacheService.getScriptCache().remove(chave);
  return { ok: true, notificacoes: lista };
}

// ─────────────────────────────────────────────────────────────
// CANCELAR SOLICITAÇÃO
// ─────────────────────────────────────────────────────────────
function _cancelar(p) {
  var sessao = _validaToken(p.token);
  if (!sessao) return _err('Sessão expirada.', 'UNAUTHORIZED');
  if (sessao.adminToken) return _err('Acesso em nome de monitor permite apenas criar solicitações.', 'FORBIDDEN');
  if (!p.protocolo) return _err('Protocolo não informado.');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return _err('O sistema está ocupado. Tente novamente.', 'BUSY');
  try {
  var sheet = _aba(CFG.ABA_RESPOSTAS);
  var rows  = sheet.getDataRange().getValues();
  var tz    = Session.getScriptTimeZone();
  for (var i = 1; i < rows.length; i++) {
    if (_referenciaSolicitacao(rows[i], i) !== String(p.protocolo).trim()) continue;
    if (_normCPF(String(rows[i][RF.CPF - 1])) !== sessao.cpf) return _err('Sem permissão para cancelar esta solicitação.');
    var status = _san(String(rows[i][18] || '')).toLowerCase();
    if (['pendente', 'confirmado', 'aguardando auxiliares'].indexOf(status) === -1) {
      return _err('Esta solicitação não pode ser cancelada no estado atual.', 'INVALID_STATUS');
    }

    // Validar antecedência mínima de 2 horas para cancelamento
    var dataRaw = rows[i][9];
    var horaRaw = rows[i][10];
    var dataStr = '';
    if (dataRaw instanceof Date) {
      dataStr = Utilities.formatDate(dataRaw, tz, 'yyyy-MM-dd');
    } else if (dataRaw) {
      var s = String(dataRaw).trim();
      var p2 = s.split('/');
      if (p2.length === 3) dataStr = p2[2] + '-' + p2[1] + '-' + p2[0];
      else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) dataStr = s;
    }
    var horaStr = '00:00';
    if (horaRaw) {
      var s = String(horaRaw).trim();
      var m = s.match(/(\d{2}):(\d{2})/);
      if (m) horaStr = m[1] + ':' + m[2];
    }
    if (dataStr) {
      var visitDate = new Date(dataStr + 'T' + horaStr + ':00');
      var agora = new Date();
      var diffMs = visitDate.getTime() - agora.getTime();
      var diffHoras = diffMs / (1000 * 60 * 60);
      if (diffHoras < 2) {
        return _err('O cancelamento não é permitido quando faltam menos de 2 horas para o início da visita.');
      }
    } else return _err('Data da visita inválida. Procure a SETUR.', 'DATE_INVALID');

    sheet.getRange(i + 1, 19).setValue('Cancelado');
    sheet.getRange(i + 1, 20).setValue('Cancelado pelo Monitor');
    return { ok: true, msg: 'Solicitação cancelada com sucesso.' };
  }
  return _err('Solicitação não encontrada.');
  } finally {
    lock.releaseLock();
  }
}

// ─────────────────────────────────────────────────────────────
// RESPONDER AO CONVITE DE MONITOR AUXILIAR
// ─────────────────────────────────────────────────────────────
function _responderConvite(p) {
  var sessao = _validaToken(p.token);
  if (!sessao) return _err('Sessão expirada.', 'UNAUTHORIZED');
  if (sessao.adminToken) return _err('O próprio auxiliar deve responder ao convite.', 'FORBIDDEN');
  if (!p.protocolo) return _err('Protocolo não informado.');
  if (p.resposta !== 'Aceito' && p.resposta !== 'Recusado') return _err('Resposta inválida.');
  var monRows = _aba(CFG.ABA_MONITORES).getDataRange().getValues();
  var nomeMonitor = '';
  for (var m = 1; m < monRows.length; m++) {
    if (_normCPF(String(monRows[m][MC.CPF - 1])) === sessao.cpf) {
      nomeMonitor = String(monRows[m][MC.NOME - 1] || '').trim();
      break;
    }
  }
  if (!nomeMonitor) return _err('Monitor não cadastrado na base.');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return _err('O sistema está ocupado. Tente novamente.', 'BUSY');
  try {
  var sheet = _aba(CFG.ABA_RESPOSTAS);
  var rows = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < rows.length; i++) {
    if (_referenciaSolicitacao(rows[i], i) === String(p.protocolo).trim()) {
      rowIndex = i;
      break;
    }
  }
  if (rowIndex === -1) return _err('Solicitação não encontrada.');
  if (String(rows[rowIndex][18] || '').trim().toLowerCase() !== 'aguardando auxiliares') {
    return _err('Este convite não está mais aguardando resposta.', 'INVALID_STATUS');
  }
  if (!_ehAuxiliar(rows[rowIndex], sessao.cpf, nomeMonitor)) return _err('Você não foi indicado como auxiliar.', 'FORBIDDEN');
  var aceites = _lerAceites(rows[rowIndex]);
  var matchedKey = _chaveAceite(aceites, sessao.cpf, nomeMonitor, rows[rowIndex]);
  if (!matchedKey) return _err('Convite sem registro de aceite. Procure a SETUR.', 'INVITE_MISSING');
  if (aceites[matchedKey] !== 'Pendente') return _err('Você já respondeu a este convite.', 'ALREADY_ANSWERED');
  aceites[matchedKey] = p.resposta;
  var rowNum = rowIndex + 1;
  sheet.getRange(rowNum, 22).setValue(JSON.stringify(aceites));
  var novoStatus = 'aguardando auxiliares';
  if (p.resposta === 'Recusado') {
    sheet.getRange(rowNum, 19).setValue('Cancelado');
    sheet.getRange(rowNum, 20).setValue('Recusado pelo monitor auxiliar ' + nomeMonitor);
    novoStatus = 'cancelado';
  } else {
    var todosAceitos = true;
    for (var key in aceites) {
      if (aceites[key] !== 'Aceito') {
        todosAceitos = false;
        break;
      }
    }
    if (todosAceitos) {
      sheet.getRange(rowNum, 19).setValue('Pendente');
      novoStatus = 'pendente';
    }
  }
  return { ok: true, status: novoStatus };
  } finally {
    lock.releaseLock();
  }
}

// ─────────────────────────────────────────────────────────────
// VALIDAR TOKEN (reidratação)
// ─────────────────────────────────────────────────────────────
function _validarTokenRota(p) {
  if (_validaTokenAdmin(p.token)) return {ok:true,papel:'admin'};
  var sessao=_validaToken(p.token);
  return { ok: !!sessao, papel:sessao&&sessao.adminToken?'delegado':'monitor' };
}

// ─────────────────────────────────────────────────────────────
// VERIFICAR IDENTIDADE (Recuperação de Senha)
// ─────────────────────────────────────────────────────────────
function _verificarIdentidade(p) {
  var cpf = _normCPF(p.cpf), email = String(p.email || '').trim().toLowerCase();
  if (cpf.length !== 11 || !_validaCPFAlg(cpf)) return _err('CPF inválido.');
  if (!email)             return _err('E-mail não informado.');
  var adminSheet=_aba(CFG.ABA_ADMIN);
  if(adminSheet){var admins=adminSheet.getDataRange().getValues();for(var a=1;a<admins.length;a++){
    if(_normCPF(String(admins[a][0]||''))!==cpf)continue;
    if(String(admins[a][4]||'').trim().toLowerCase()!=='sim'||String(admins[a][1]||'').trim().toLowerCase()!==email)return _err('Dados não conferem com o cadastro.');
    return _enviarCodigo(cpf,String(admins[a][1]||'').trim(),'recuperar');
  }}
  var rows = _aba(CFG.ABA_MONITORES).getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (_normCPF(String(rows[i][MC.CPF - 1])) !== cpf) continue;
    var cadastrado = String(rows[i][MC.EMAIL - 1] || '').trim();
    if (cadastrado.toLowerCase() !== email) return _err('Dados não conferem com o cadastro.');
    return _enviarCodigo(cpf, cadastrado, 'recuperar');
  }
  return _err('Dados não conferem com o cadastro.');
}

// ─────────────────────────────────────────────────────────────
// REDEFINIR SENHA
// ─────────────────────────────────────────────────────────────
function _redefinirSenha(p) {
  var cpf = _normCPF(p.cpf), senha = p.senha;
  if (cpf.length !== 11 || !_validaCPFAlg(cpf)) return _err('CPF inválido.');
  if (!senha || senha.length < 8) return _err('Senha deve ter no mínimo 8 caracteres.');
  if (!_ticketValido(p.ticket, cpf, 'recuperar')) return _err('Confirmação expirada. Solicite outro código.', 'UNAUTHORIZED');
  var adminSheet=_aba(CFG.ABA_ADMIN);
  if(adminSheet){var admins=adminSheet.getDataRange().getValues();for(var a=1;a<admins.length;a++){
    if(_normCPF(String(admins[a][0]||''))!==cpf)continue;
    if(String(admins[a][4]||'').trim().toLowerCase()!=='sim')return _err('Conta inativa.','INACTIVE');
    if(!_consumirTicket(p.ticket,cpf,'recuperar'))return _err('Confirmação expirada.','UNAUTHORIZED');
    adminSheet.getRange(a+1,4).setValue(_hashSenha(cpf,senha));
    return {ok:true,msg:'Senha redefinida com sucesso!'};
  }}
  var sheet = _aba(CFG.ABA_MONITORES);
  var rows  = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (_normCPF(String(rows[i][MC.CPF - 1])) !== cpf) continue;
    if (!_consumirTicket(p.ticket, cpf, 'recuperar')) return _err('Confirmação expirada.', 'UNAUTHORIZED');
    sheet.getRange(i + 1, MC.SENHA_HASH).setValue(_hashSenha(cpf, senha));
    return { ok: true, msg: 'Senha redefinida com sucesso!' };
  }
  return _err('CPF não encontrado.', 'NOT_FOUND');
}

function _solicitarCodigoPerfil(p) {
  var sessao = _validaToken(p.token);
  if (!sessao) return _err('Sessão expirada.', 'UNAUTHORIZED');
  var rows = _aba(CFG.ABA_MONITORES).getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (_normCPF(String(rows[i][MC.CPF - 1])) === sessao.cpf) {
      return _enviarCodigo(sessao.cpf, String(rows[i][MC.EMAIL - 1] || '').trim(), 'perfil');
    }
  }
  return _err('Monitor não encontrado.', 'NOT_FOUND');
}

// ─────────────────────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────────────────────
function _aba(nome) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome); }
function _normCPF(s) { var d = String(s==null?'':s).trim().replace(/[.\-\s]/g,'').replace(/\..*$/,'').replace(/\D/g,''); if(d.length>11)d=d.slice(-11); return d.padStart(11,'0'); }
function _maskCPF(cpf) { return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4'); }
function _validaCPFAlg(cpf) {
  if (['00000000000','11111111111','22222222222','33333333333','44444444444','55555555555','66666666666','77777777777','88888888888','99999999999'].indexOf(cpf)!==-1) return false;
  var soma=0,r; for(var i=0;i<9;i++)soma+=parseInt(cpf[i])*(10-i); r=soma%11<2?0:11-(soma%11); if(parseInt(cpf[9])!==r){return _cpfExisteNaBase(cpf);}
  soma=0; for(var j=0;j<10;j++)soma+=parseInt(cpf[j])*(11-j); r=soma%11<2?0:11-(soma%11); return parseInt(cpf[10])===r||_cpfExisteNaBase(cpf);
}
function _cpfExisteNaBase(cpf) { var rows=_aba(CFG.ABA_MONITORES).getDataRange().getValues(); for(var i=1;i<rows.length;i++){if(_normCPF(String(rows[i][MC.CPF-1]))===cpf)return true;} return false; }
function _hashSenha(cpf,senha){var input=CFG.PEPPER+'|'+cpf+'|'+senha;var bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,input,Utilities.Charset.UTF_8);return bytes.map(function(b){return('0'+(b&0xFF).toString(16)).slice(-2);}).join('');}
function _chaveLocalidade(valor){return String(valor||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}
function _tituloLocalidade(valor){return String(valor||'').toLocaleLowerCase('pt-BR').split(/\s+/).map(function(p,i){return i&&['de','da','do','dos','das','e'].indexOf(p)!==-1?p:p.charAt(0).toLocaleUpperCase('pt-BR')+p.slice(1);}).join(' ');}
function _localidadePadronizada(valor,aceitarPais){
  var texto=String(valor||'').trim().replace(/\s+/g,' ');
  if(!texto||texto.length>100)return '';
  var chave=_chaveLocalidade(texto);
  if(aceitarPais){
    for(var p=0;p<PAISES_PADRAO.length;p++)if(_chaveLocalidade(PAISES_PADRAO[p])===chave)return PAISES_PADRAO[p];
    var outro=texto.match(/^pa[ií]s\s*:\s*(.+)$/i);
    if(outro&&/^[\p{L}\p{M} .'-]{2,80}$/u.test(outro[1]))return 'País: '+_tituloLocalidade(outro[1].trim());
  }
  var partes=texto.match(/^(.+?)\s*\/\s*([A-Za-z]{2})$/);
  var nome=partes?partes[1].trim():texto,uf=partes?partes[2].toUpperCase():'';
  if(partes&&UFS_VALIDAS.indexOf(uf)===-1)return '';
  var candidatos=CIDADES_PADRAO.filter(function(c){var cPartes=c.split('/');return _chaveLocalidade(cPartes[0])===_chaveLocalidade(nome)&&(!uf||cPartes[1]===uf);});
  if(candidatos.length===1)return candidatos[0];
  if(!partes)return '';
  if(!/^[\p{L}\p{M} .'-]{2,80}$/u.test(nome))return '';
  return _tituloLocalidade(nome)+'/'+uf;
}
function _referenciaSolicitacao(row, indice) {
  var protocolo=String(row[RF.PROTOCOLO-1]||'').trim();
  if(protocolo)return protocolo;
  var cpf=_normCPF(String(row[RF.CPF-1]||''));
  var assinatura=_hashSenha(cpf,JSON.stringify(row.slice(0,18))+'|'+indice).slice(0,12);
  return 'LEGADO-LINHA-'+(indice+1)+'-'+assinatura;
}
function _novoToken(){return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');}
function _validaToken(token){
  if(!token||token.length!==64)return null;
  var raw=CacheService.getScriptCache().get('TK_'+token);if(!raw)return null;
  try{
    var sessao=JSON.parse(raw);
    if(sessao.adminToken&&!_adminTem(sessao.adminToken,'agendarEmNome'))return null;
    var revogado=Number(CacheService.getScriptCache().get('REVOGADO_CPF_'+sessao.cpf)||0);
    if(revogado&&(!sessao.emitido||sessao.emitido<=revogado))return null;
    return sessao;
  }catch(e){return null;}
}
function _geraProtocolo(dataSub){
  var ano = new Date().getFullYear();
  if (dataSub instanceof Date) {
    ano = dataSub.getFullYear();
  } else if (dataSub) {
    var d = new Date(dataSub);
    if (!isNaN(d.getTime())) {
      ano = d.getFullYear();
    }
  }
  return 'SS-'+ano+'-'+(100000+Math.floor(Math.random()*900000));
}
function _gerarProtocoloUnico(dataSub, usados){
  for (var i=0;i<100;i++) {
    var protocolo=_geraProtocolo(dataSub);
    if (!usados[protocolo]) return protocolo;
  }
  throw new Error('Não foi possível gerar protocolo único.');
}
// Execute manualmente no editor do Apps Script. Sem argumento, retorna apenas a prévia.
// Execute com true somente após fazer uma cópia da planilha e conferir a prévia.
function migrarProtocolosEmBranco(executar){
  var lock=LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Não foi possível obter bloqueio da planilha.');
  try {
    var sheet=_aba(CFG.ABA_RESPOSTAS);
    var rows=sheet.getDataRange().getValues();
    var usados={}, pendentes=[];
    for (var i=1;i<rows.length;i++) {
      var atual=String(rows[i][RF.PROTOCOLO-1] || '').trim();
      if (atual) {
        if (usados[atual]) throw new Error('Protocolo repetido nas linhas '+usados[atual]+' e '+(i+1)+': '+atual);
        usados[atual]=i+1;
      } else pendentes.push(i);
    }
    var previa={total:pendentes.length,linhas:pendentes.map(function(i){return i+1;})};
    if (executar !== true) return previa;
    for (var p=0;p<pendentes.length;p++) {
      var indice=pendentes[p];
      var protocolo=_gerarProtocoloUnico(rows[indice][0], usados);
      sheet.getRange(indice+1,RF.PROTOCOLO).setValue(protocolo);
      usados[protocolo]=indice+1;
    }
    return {ok:true,atualizados:pendentes.length};
  } finally {
    lock.releaseLock();
  }
}
function executarMigracaoProtocolosEmBranco(){
  if (PropertiesService.getScriptProperties().getProperty('MIGRACAO_PROTOCOLOS_AUTORIZADA') !== 'SIM') {
    throw new Error('Defina MIGRACAO_PROTOCOLOS_AUTORIZADA=SIM nas propriedades do script somente após fazer o backup e conferir a prévia.');
  }
  return migrarProtocolosEmBranco(true);
}
function _planejarPadronizacaoOrigens(rows){
  var porNome={},alteracoes=[],pendentes=[];
  for(var i=1;i<rows.length;i++){
    var canonica=_localidadePadronizada(rows[i][11],true);
    var partes=canonica.match(/^(.+)\/([A-Z]{2})$/);
    if(partes){var chave=_chaveLocalidade(partes[1]);if(!porNome[chave])porNome[chave]={};porNome[chave][canonica]=true;}
  }
  for(var j=1;j<rows.length;j++){
    var atual=String(rows[j][11]||'').trim();if(!atual)continue;
    var novo=_localidadePadronizada(atual,true);
    if(!novo&&atual.indexOf('/')===-1){var candidatos=Object.keys(porNome[_chaveLocalidade(atual)]||{});if(candidatos.length===1)novo=candidatos[0];}
    if(novo&&novo!==atual)alteracoes.push({linha:j+1,atual:atual,novo:novo});
    else if(!novo)pendentes.push({linha:j+1,valor:atual});
  }
  return {total:alteracoes.length,alteracoes:alteracoes,pendentes:pendentes};
}
function preverPadronizacaoOrigensHistoricas(){
  return _planejarPadronizacaoOrigens(_aba(CFG.ABA_RESPOSTAS).getDataRange().getValues());
}
function executarPadronizacaoOrigensHistoricas(){
  if(PropertiesService.getScriptProperties().getProperty('PADRONIZACAO_ORIGENS_AUTORIZADA')!=='SIM')throw new Error('Faça backup, confira a prévia e defina PADRONIZACAO_ORIGENS_AUTORIZADA=SIM antes de executar.');
  var lock=LockService.getScriptLock();if(!lock.tryLock(30000))throw new Error('Sistema ocupado. Tente novamente.');
  try{
    var sheet=_aba(CFG.ABA_RESPOSTAS),plano=_planejarPadronizacaoOrigens(sheet.getDataRange().getValues()),atualizadas=0;
    plano.alteracoes.forEach(function(item){if(String(sheet.getRange(item.linha,12).getValue()||'').trim()===item.atual){sheet.getRange(item.linha,12).setValue(item.novo);atualizadas++;}});
    return {ok:true,atualizadas:atualizadas,ignoradas:plano.total-atualizadas,pendentes:plano.pendentes};
  }finally{lock.releaseLock();}
}
function _resolverAuxiliares(valor, monRows, cpfPrincipal){
  var partes=String(valor || '').split(',').map(function(x){return x.trim();}).filter(Boolean);
  var cpfs=[], nomes=[], vistos={}, nomesVistos={};
  for (var i=0;i<partes.length;i++) {
    var encontrado=null, cpf='';
    for (var m=1;m<monRows.length;m++) {
      var monCpf=_normCPF(String(monRows[m][MC.CPF-1]));
      var monNome=String(monRows[m][MC.NOME-1] || '').trim();
      if (partes[i] === monCpf || partes[i].toLowerCase() === monNome.toLowerCase()) {
        if (encontrado) return _err('Há monitores com nomes iguais. Atualize a página e selecione novamente.', 'AUX_AMBIGUOUS');
        encontrado=monNome; cpf=monCpf;
      }
    }
    if (!encontrado || cpf === cpfPrincipal || vistos[cpf]) return _err('Seleção de monitores auxiliares inválida.', 'AUX_INVALID');
    if(nomesVistos[encontrado.toLowerCase()])return _err('Há monitores selecionados com o mesmo nome. Solicite correção do cadastro à SETUR.', 'AUX_AMBIGUOUS');
    vistos[cpf]=true;nomesVistos[encontrado.toLowerCase()]=true;cpfs.push(cpf);nomes.push(encontrado);
  }
  return {ok:true,cpfs:cpfs,nomes:nomes};
}
function _lerAceites(row){
  try { return JSON.parse(String(row[21] || '') || '{}'); } catch(e){ return {}; }
}
function _ehAuxiliar(row, cpf, nome){
  var aceites=_lerAceites(row);
  if (Object.prototype.hasOwnProperty.call(aceites,cpf)) return true;
  var cpfs=String(row[22] || '').split(',').map(function(x){return x.trim();});
  if (cpfs.indexOf(cpf)!==-1) return true;
  if (!nome) return false;
  var partes=String(row[17] || '').split(',');
  for (var i=0;i<partes.length;i++) if (partes[i].trim().toLowerCase()===nome.toLowerCase()) return true;
  return false;
}
function _chaveAceite(aceites,cpf,nome,row){
  if (Object.prototype.hasOwnProperty.call(aceites,cpf)) return cpf;
  var cpfs=String(row[22] || '').split(',').map(function(x){return x.trim();});
  var nomes=String(row[17] || '').split(',').map(function(x){return x.trim();});
  var indice=cpfs.indexOf(cpf);
  var nomeOriginal=indice>=0 ? nomes[indice] : nome;
  for (var key in aceites) if (nomeOriginal && key.toLowerCase()===nomeOriginal.toLowerCase()) return key;
  return '';
}
function _meuAceite(aceites, cpf, nome, row){
  var chave=_chaveAceite(aceites,cpf,nome,row);
  if (chave) return aceites[chave];
  return 'Pendente';
}
function _aceitesParaExibicao(aceites, monRows){
  var exibicao={};
  for (var key in aceites) {
    var nome=key;
    if (/^\d{11}$/.test(key)) {
      for (var i=1;i<monRows.length;i++) {
        if (_normCPF(String(monRows[i][MC.CPF-1]))===key) { nome=String(monRows[i][MC.NOME-1] || key); break; }
      }
    }
    exibicao[nome]=aceites[key];
  }
  return exibicao;
}
function _san(v){return String(v==null?'':v).trim().replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function _err(msg,code){return{ok:false,erro:msg,code:code||'ERROR'};}
function _mascararEmail(email){var partes=email.split('@');return partes[0].charAt(0)+'***@'+partes[1];}

// A aba Administradores é separada da base de monitores.
// Colunas: CPF, E-mail, Nome, Senha Hash, Ativo.
function _tentarLoginAdmin(loginInput, senha) {
  var sheet = _aba(CFG.ABA_ADMIN);
  if (!sheet) return null;
  var rows = sheet.getDataRange().getValues();
  var email = loginInput.toLowerCase();
  var cpfInput = loginInput.indexOf('@') === -1 ? _normCPF(loginInput) : '';
  for (var i = 1; i < rows.length; i++) {
    var cpf = _normCPF(String(rows[i][0] || ''));
    if (cpfInput !== cpf && email !== String(rows[i][1] || '').trim().toLowerCase()) continue;
    if (String(rows[i][4] || '').trim().toLowerCase() !== 'sim') return _err('Conta administrativa inativa.', 'INACTIVE');
    var rl = _checkRateLimit(cpf);
    if (rl.bloqueado) return _err(rl.msg, 'LOCKED');
    if (_hashSenha(cpf, senha) !== String(rows[i][3] || '').trim()) {
      _incrementaRL(cpf);
      return _err('Credenciais incorretas. Tentativas restantes: ' + _tentativasRestantes(cpf), 'INVALID_CREDENTIALS');
    }
    _resetRL(cpf);
    var token = _novoToken();
    CacheService.getScriptCache().put('ATK_' + token, JSON.stringify({cpf:cpf}), CFG.TOKEN_HORAS * 3600);
    return {ok:true,papel:'admin',token:token,admin:{nome:_san(rows[i][2] || 'Administrador'),email:_san(rows[i][1]),permissoes:_permissoesAdmin(rows[i][5])}};
  }
  return null;
}
function _validaTokenAdmin(token) {
  if (!token || token.length !== 64) return null;
  var raw = CacheService.getScriptCache().get('ATK_' + token);
  if (!raw) return null;
  var sessao;
  try { sessao = JSON.parse(raw); } catch(e) { return null; }
  var sheet = _aba(CFG.ABA_ADMIN);
  if (!sheet) return null;
  var rows = sheet.getDataRange().getValues();
  for (var i=1;i<rows.length;i++) {
    if (_normCPF(String(rows[i][0] || '')) === sessao.cpf && String(rows[i][4] || '').trim().toLowerCase() === 'sim') {
      sessao.permissoes=_permissoesAdmin(rows[i][5]);return sessao;
    }
  }
  return null;
}
function _permissoesAdmin(valor) {
  try {var p=JSON.parse(String(valor||'[]'));if(!Array.isArray(p))return [];var validas=p.filter(function(x){return PERMISSOES_ADMIN.indexOf(x)!==-1;});if(validas.indexOf('gerirAdmins')!==-1&&validas.indexOf('caixaPostal')===-1)validas.push('caixaPostal');return validas;} catch(e){return [];}
}
function _adminTem(token, permissao) {
  var admin=_validaTokenAdmin(token);
  return admin && admin.permissoes.indexOf(permissao)!==-1 ? admin : null;
}
function _adminPerfil(p) {
  var admin=_validaTokenAdmin(p.token);
  if(!admin)return _err('Acesso administrativo necessário.', 'UNAUTHORIZED');
  return {ok:true,permissoes:admin.permissoes};
}
function configurarAdministradorInicial() {
  var props = PropertiesService.getScriptProperties();
  var cpf = _normCPF(props.getProperty('ADMIN_INICIAL_CPF') || '');
  var email = String(props.getProperty('ADMIN_INICIAL_EMAIL') || '').trim();
  var nome = String(props.getProperty('ADMIN_INICIAL_NOME') || '').trim();
  var senha = String(props.getProperty('ADMIN_INICIAL_SENHA') || '');
  if (!_validaCPFAlg(cpf) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !nome || senha.length < 12 || !/[A-Za-z]/.test(senha) || !/[0-9]/.test(senha)) {
    throw new Error('Configure CPF, e-mail, nome e senha inicial de pelo menos 12 caracteres com letras e números nas propriedades do script.');
  }
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = planilha.getSheetByName(CFG.ABA_ADMIN);
  if (sheet && sheet.getLastRow() > 1) throw new Error('A aba Administradores já contém contas. A criação inicial foi bloqueada.');
  if (!sheet) sheet = planilha.insertSheet(CFG.ABA_ADMIN);
  sheet.getRange(1,1,1,6).setValues([['CPF','E-mail','Nome','Senha Hash','Ativo','Permissões']]);
  sheet.appendRow([cpf,email,nome,_hashSenha(cpf,senha),'Sim',JSON.stringify(PERMISSOES_ADMIN)]);
  ['ADMIN_INICIAL_CPF','ADMIN_INICIAL_EMAIL','ADMIN_INICIAL_NOME','ADMIN_INICIAL_SENHA'].forEach(function(chave){props.deleteProperty(chave);});
  return {ok:true,msg:'Administrador inicial criado. As propriedades temporárias foram removidas.'};
}
function _dataIsoAdmin(valor) {
  if (valor instanceof Date) return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var s=String(valor || '').trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {var p=s.split('/');return p[2]+'-'+p[1]+'-'+p[0];}
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}
function _horaAdmin(valor) {
  var h=_parseHoraMinuto(valor);
  return ('0'+h.hora).slice(-2)+':'+('0'+h.minuto).slice(-2);
}
function _dataValidaAdmin(valor) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(valor))return false;
  var d=new Date(valor+'T00:00:00');
  return !isNaN(d.getTime()) && d.getFullYear()===Number(valor.slice(0,4)) && d.getMonth()+1===Number(valor.slice(5,7)) && d.getDate()===Number(valor.slice(8,10));
}
function _adminSolicitacoes(p) {
  if (!_adminTem(p.token,'verSolicitacoes') && !_adminTem(p.token,'decidir')) return _err('Sem permissão para consultar solicitações.', 'FORBIDDEN');
  var rows=_aba(CFG.ABA_RESPOSTAS).getDataRange().getValues();
  var lista=[];
  for (var i=rows.length-1;i>=1;i--) {
    var r=rows[i];
    if (!r[0] && !r[2] && !r[20]) continue;
    lista.push({protocolo:_referenciaSolicitacao(r,i),data:_dataIsoAdmin(r[9]),horario:_horaAdmin(r[10]),
      monitor:_san(r[2]||''),cpf:_maskCPF(_normCPF(String(r[6]||''))),email:_san(r[1]||''),telefone:_san(r[3]||''),
      grupo:Number(r[4])||0,tipo:_san(r[12]||''),origem:_san(r[11]||''),auxiliares:_san(r[17]||''),
      status:_san(r[18]||''),motivo:_san(r[19]||'')});
  }
  return {ok:true,lista:lista};
}
function _adminDecidir(p) {
  if (!_adminTem(p.token,'decidir')) return _err('Sem permissão para decidir solicitações.', 'FORBIDDEN');
  if (['Confirmado','Negado','Cancelado'].indexOf(p.decisao)===-1) return _err('Decisão inválida.', 'INVALID_DECISION');
  var motivo=String(p.motivo||'').trim();
  if (p.decisao!=='Confirmado' && !motivo) return _err('Informe o motivo da negativa ou do cancelamento.', 'REASON_REQUIRED');
  var lock=LockService.getScriptLock();
  if (!lock.tryLock(30000)) return _err('Sistema ocupado. Tente novamente.', 'BUSY');
  try {
    var sheet=_aba(CFG.ABA_RESPOSTAS), rows=sheet.getDataRange().getValues();
    for (var i=1;i<rows.length;i++) {
      if (_referenciaSolicitacao(rows[i],i)!==String(p.protocolo||'').trim() || !p.protocolo) continue;
      var status=String(rows[i][18]||'').trim().toLowerCase();
      if (p.decisao==='Cancelado') {
        if (['pendente','confirmado','aguardando auxiliares'].indexOf(status)===-1) return _err('Esta solicitação já foi encerrada e não pode ser cancelada.', 'INVALID_STATUS');
      } else if (status!=='pendente') return _err('Somente solicitações pendentes podem receber esta decisão.', 'INVALID_STATUS');
      sheet.getRange(i+1,19).setValue(p.decisao);
      sheet.getRange(i+1,20).setValue(p.decisao==='Confirmado'?'':_textoSeguroPlanilha(_san(motivo)));
      return {ok:true,status:p.decisao};
    }
    return _err('Protocolo não encontrado. Verifique a migração dos protocolos antigos.', 'NOT_FOUND');
  } finally {lock.releaseLock();}
}
function _adminDatas(p) {
  if (!_adminTem(p.token,'bloquearDatas')) return _err('Sem permissão para datas.', 'FORBIDDEN');
  var rows=_aba(CFG.ABA_BLOQUEADAS).getDataRange().getValues(),lista=[];
  for (var i=1;i<rows.length;i++) {var data=_dataIsoAdmin(rows[i][0]);if(data)lista.push({data:data,motivo:_san(rows[i][1]||'')});}
  return {ok:true,lista:lista};
}
function _adminBloquearData(p) {
  if (!_adminTem(p.token,'bloquearDatas')) return _err('Sem permissão para bloquear datas.', 'FORBIDDEN');
  var data=String(p.data||''), motivo=String(p.motivo||'').trim();
  if (!_dataValidaAdmin(data) || !motivo) return _err('Informe data e motivo válidos.', 'FIELDS_INVALID');
  var lock=LockService.getScriptLock();if(!lock.tryLock(30000))return _err('Sistema ocupado.', 'BUSY');
  try {
    var sheet=_aba(CFG.ABA_BLOQUEADAS),rows=sheet.getDataRange().getValues();
    for(var i=1;i<rows.length;i++)if(_dataIsoAdmin(rows[i][0])===data)return _err('Esta data já está bloqueada.', 'DUPLICATE');
    sheet.appendRow([new Date(data+'T00:00:00'),_san(motivo)]);
    return {ok:true};
  } finally {lock.releaseLock();}
}
function _adminDesbloquearData(p) {
  if (!_adminTem(p.token,'bloquearDatas')) return _err('Sem permissão para desbloquear datas.', 'FORBIDDEN');
  var data=String(p.data||'');
  var lock=LockService.getScriptLock();if(!lock.tryLock(30000))return _err('Sistema ocupado.', 'BUSY');
  try {
    var sheet=_aba(CFG.ABA_BLOQUEADAS),rows=sheet.getDataRange().getValues();
    for(var i=1;i<rows.length;i++)if(_dataIsoAdmin(rows[i][0])===data){sheet.deleteRow(i+1);return {ok:true};}
    return _err('Data não encontrada.', 'NOT_FOUND');
  } finally {lock.releaseLock();}
}
function _adminMonitores(p) {
  if (!_adminTem(p.token,'verMonitores') && !_adminTem(p.token,'agendarEmNome') && !_adminTem(p.token,'resetarSenha')) return _err('Sem permissão para consultar monitores.', 'FORBIDDEN');
  var rows=_aba(CFG.ABA_MONITORES).getDataRange().getValues(),lista=[];
  for(var i=1;i<rows.length;i++)if(rows[i][MC.NOME-1])lista.push({nome:_san(rows[i][MC.NOME-1]),cpf:_maskCPF(_normCPF(String(rows[i][MC.CPF-1]))),email:_san(rows[i][MC.EMAIL-1]||''),telefone:_san(rows[i][MC.TELEFONE-1]||''),cidade:_san(rows[i][MC.CIDADE-1]||'')});
  return {ok:true,lista:lista};
}

function _adminAcessarMonitor(p) {
  var admin=_adminTem(p.token,'agendarEmNome');
  if (!admin) return _err('Acesso administrativo necessário.', 'UNAUTHORIZED');
  var cpf=_normCPF(p.cpf||'');
  var rows=_aba(CFG.ABA_MONITORES).getDataRange().getValues();
  for(var i=1;i<rows.length;i++) {
    if(_normCPF(String(rows[i][MC.CPF-1]))!==cpf)continue;
    var token=_novoToken();
    CacheService.getScriptCache().put('TK_'+token,JSON.stringify({cpf:cpf,adminToken:p.token,adminCpf:admin.cpf,emitido:Date.now()}),CFG.TOKEN_HORAS*3600);
    return {ok:true,papel:'delegado',token:token,monitor:{nome:_san(rows[i][MC.NOME-1]),cpf:_maskCPF(cpf),
      telefone:_san(rows[i][MC.TELEFONE-1]||''),email:_san(rows[i][MC.EMAIL-1]||''),rg:_san(rows[i][MC.RG-1]||''),
      cidade:_san(rows[i][MC.CIDADE-1]||''),bairro:_san(rows[i][MC.BAIRRO-1]||'')}};
  }
  return _err('Monitor não encontrado.', 'NOT_FOUND');
}
function _adminResetarSenha(p) {
  if (!_adminTem(p.token,'resetarSenha')) return _err('Sem permissão para redefinir acesso.', 'FORBIDDEN');
  var cpf=_normCPF(p.cpf||'');
  var sheet=_aba(CFG.ABA_MONITORES),rows=sheet.getDataRange().getValues();
  for(var i=1;i<rows.length;i++) {
    if(_normCPF(String(rows[i][MC.CPF-1]))!==cpf)continue;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(rows[i][MC.EMAIL-1]||'')))return _err('Atualize o e-mail cadastrado antes de redefinir o acesso.', 'EMAIL_REQUIRED');
    sheet.getRange(i+1,MC.SENHA_HASH).setValue('');
    CacheService.getScriptCache().put('REVOGADO_CPF_'+cpf,String(Date.now()),CFG.TOKEN_HORAS*3600);
    return {ok:true,msg:'A senha foi removida. O monitor deve usar Meu Primeiro Acesso e confirmar o código recebido por e-mail.'};
  }
  return _err('Monitor não encontrado.', 'NOT_FOUND');
}
function _adminListarAdmins(p) {
  if(!_adminTem(p.token,'gerirAdmins'))return _err('Sem permissão para gerir administradores.','FORBIDDEN');
  var rows=_aba(CFG.ABA_ADMIN).getDataRange().getValues(),lista=[];
  for(var i=1;i<rows.length;i++)if(rows[i][0])lista.push({cpf:_maskCPF(_normCPF(String(rows[i][0]))),nome:_san(rows[i][2]||''),email:_san(rows[i][1]||''),
    ativo:String(rows[i][4]||'').trim().toLowerCase()==='sim',permissoes:_permissoesAdmin(rows[i][5])});
  return {ok:true,lista:lista};
}
function _adminCriarAdmin(p) {
  if(!_adminTem(p.token,'gerirAdmins'))return _err('Sem permissão para gerir administradores.','FORBIDDEN');
  var cpf=_normCPF(p.cpf||''),email=String(p.email||'').trim(),nome=String(p.nome||'').trim();
  if(!_validaCPFAlg(cpf)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!nome)return _err('Informe CPF, e-mail e nome válidos.','FIELDS_INVALID');
  var perms=Array.isArray(p.permissoes)?p.permissoes.filter(function(x){return PERMISSOES_ADMIN.indexOf(x)!==-1&&x!=='gerirAdmins';}):[];
  var lock=LockService.getScriptLock();if(!lock.tryLock(30000))return _err('Sistema ocupado.','BUSY');
  try{
    var sheet=_aba(CFG.ABA_ADMIN),rows=sheet.getDataRange().getValues();
    for(var i=1;i<rows.length;i++)if(_normCPF(String(rows[i][0]||''))===cpf||String(rows[i][1]||'').trim().toLowerCase()===email.toLowerCase())return _err('CPF ou e-mail já cadastrado.','DUPLICATE');
    sheet.appendRow([cpf,email,_textoSeguroPlanilha(_san(nome)),'','Sim',JSON.stringify(perms)]);
    return {ok:true,msg:'Conta criada. O novo administrador deve usar Meu Primeiro Acesso.'};
  }finally{lock.releaseLock();}
}
function _adminAtualizarAdmin(p) {
  var gestor=_adminTem(p.token,'gerirAdmins');if(!gestor)return _err('Sem permissão para gerir administradores.','FORBIDDEN');
  var cpf=_normCPF(p.cpf||'');
  if(cpf===gestor.cpf)return _err('Não é possível alterar as próprias permissões por este painel.','FORBIDDEN');
  var perms=Array.isArray(p.permissoes)?p.permissoes.filter(function(x){return PERMISSOES_ADMIN.indexOf(x)!==-1&&x!=='gerirAdmins';}):[];
  var lock=LockService.getScriptLock();if(!lock.tryLock(30000))return _err('Sistema ocupado.','BUSY');
  try {
    var sheet=_aba(CFG.ABA_ADMIN),rows=sheet.getDataRange().getValues();
    for(var i=1;i<rows.length;i++)if(_normCPF(String(rows[i][0]||''))===cpf){
      if(_permissoesAdmin(rows[i][5]).indexOf('gerirAdmins')!==-1)return _err('A conta gestora não pode ser alterada por este painel.','FORBIDDEN');
      var nome=p.nome===undefined?String(rows[i][2]||'').trim():String(p.nome||'').trim();
      var email=p.email===undefined?String(rows[i][1]||'').trim():String(p.email||'').trim();
      if(!nome||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return _err('Informe nome e e-mail válidos.','FIELDS_INVALID');
      for(var j=1;j<rows.length;j++)if(j!==i&&String(rows[j][1]||'').trim().toLowerCase()===email.toLowerCase())return _err('E-mail já usado por outra conta.','DUPLICATE');
      sheet.getRange(i+1,2).setValue(_textoSeguroPlanilha(email));
      sheet.getRange(i+1,3).setValue(_textoSeguroPlanilha(_san(nome)));
      sheet.getRange(i+1,6).setValue(JSON.stringify(perms));
      return {ok:true};
    }
    return _err('Administrador não encontrado.','NOT_FOUND');
  } finally {lock.releaseLock();}
}
function _adminDesativarAdmin(p) {
  return _adminDefinirAtivo(p,false);
}
function _adminReativarAdmin(p) {
  return _adminDefinirAtivo(p,true);
}
function _adminDefinirAtivo(p,ativo) {
  var gestor=_adminTem(p.token,'gerirAdmins');if(!gestor)return _err('Sem permissão para gerir administradores.','FORBIDDEN');
  var cpf=_normCPF(p.cpf||'');if(cpf===gestor.cpf)return _err('Não é possível desativar a própria conta gestora.','FORBIDDEN');
  var sheet=_aba(CFG.ABA_ADMIN),rows=sheet.getDataRange().getValues();
  for(var i=1;i<rows.length;i++)if(_normCPF(String(rows[i][0]||''))===cpf){
    if(_permissoesAdmin(rows[i][5]).indexOf('gerirAdmins')!==-1)return _err('A conta gestora não pode ser alterada por este painel.','FORBIDDEN');
    sheet.getRange(i+1,5).setValue(ativo?'Sim':'Não');return {ok:true};
  }
  return _err('Administrador não encontrado.','NOT_FOUND');
}
function _adminRelatorio(p) {
  if(!_adminTem(p.token,'verRelatorios'))return _err('Sem permissão para relatórios.','FORBIDDEN');
  var inicio=String(p.inicio||''),fim=String(p.fim||'');
  if(!_dataValidaAdmin(inicio)||!_dataValidaAdmin(fim)||inicio>fim)return _err('Período inválido.','DATE_INVALID');
  var registros=_aba(CFG.ABA_RESPOSTAS).getDataRange().getValues(),monRows=_aba(CFG.ABA_MONITORES).getDataRange().getValues();
  var grupos={origem:{},tipo:{},faixa:{},hospedagem:{}},agendamentos=[],totalPessoas=0,confirmados=0,somaAntecedencia=0,contAntecedencia=0,somaEstadia=0,contEstadia=0;
  var porMonitor={};
  for(var i=1;i<registros.length;i++){
    var r=registros[i],data=_dataIsoAdmin(r[9]);if(!data||data<inicio||data>fim)continue;
    var tam=Number(r[4])||0,status=String(r[18]||'').trim();
    agendamentos.push({data:data,horario:_horaAdmin(r[10]),monitor:_san(r[2]||''),telefone:_san(r[3]||''),grupo:tam,status:_san(status),protocolo:String(r[20]||'').trim()});
    if(status.toLowerCase()!=='confirmado')continue;
    confirmados++;totalPessoas+=tam;
    [['origem',r[11]],['tipo',r[12]],['faixa',r[13]],['hospedagem',r[14]]].forEach(function(par){var chave=String(par[1]||'Não informado').trim()||'Não informado';if(par[0]==='origem')chave=_localidadePadronizada(chave,true)||chave;grupos[par[0]][chave]=(grupos[par[0]][chave]||0)+tam;});
    var ant=Number(r[15]);if(isFinite(ant)&&ant>0){somaAntecedencia+=ant;contAntecedencia++;}
    var dias=Number(r[16]);if(isFinite(dias)&&dias>0){somaEstadia+=dias;contEstadia++;}
    var cpf=_normCPF(String(r[6]||''));if(!porMonitor[cpf])porMonitor[cpf]={visitas:0,pessoas:0};porMonitor[cpf].visitas++;porMonitor[cpf].pessoas+=tam;
  }
  agendamentos.sort(function(a,b){return a.data===b.data?a.horario.localeCompare(b.horario):a.data.localeCompare(b.data);});
  var monitores=[];
  for(var m=1;m<monRows.length;m++)if(monRows[m][MC.NOME-1]){
    var monCpf=_normCPF(String(monRows[m][MC.CPF-1]||'')),cont=porMonitor[monCpf]||{visitas:0,pessoas:0};
    monitores.push({nome:_san(monRows[m][MC.NOME-1]),telefone:_san(monRows[m][MC.TELEFONE-1]||''),email:_san(monRows[m][MC.EMAIL-1]||''),
      cidade:_san(monRows[m][MC.CIDADE-1]||''),bairro:_san(monRows[m][MC.BAIRRO-1]||''),visitas:cont.visitas,pessoas:cont.pessoas});
  }
  monitores.sort(function(a,b){return a.nome.localeCompare(b.nome);});
  return {ok:true,inicio:inicio,fim:fim,agendamentos:agendamentos,grupos:grupos,monitores:monitores,
    resumo:{agendamentos:agendamentos.length,confirmados:confirmados,pessoas:totalPessoas,
      mediaGrupo:confirmados?totalPessoas/confirmados:0,mediaAntecedencia:contAntecedencia?somaAntecedencia/contAntecedencia:0,
      mediaEstadia:contEstadia?somaEstadia/contEstadia:0}};
}
function _adminLogs(p) {
  if(!_adminTem(p.token,'verAuditoria'))return _err('Sem permissão para consultar a auditoria.','FORBIDDEN');
  var sheet=_aba(CFG.ABA_AUDITORIA);
  if(!sheet)return {ok:true,lista:[]};
  var rows=sheet.getDataRange().getValues(),lista=[];
  for(var i=rows.length-1;i>=1&&lista.length<500;i--){var r=rows[i];lista.push({data:r[0] instanceof Date?Utilities.formatDate(r[0],Session.getScriptTimeZone(),'dd/MM/yyyy HH:mm:ss'):String(r[0]||''),
    ator:_san(r[1]||''),papel:_san(r[2]||''),acao:_san(r[3]||''),alvo:_san(r[4]||''),resultado:_san(r[5]||''),detalhes:_san(r[6]||'')});}
  return {ok:true,lista:lista};
}
function _caixaAcesso(token){
  var admin=_adminTem(token,'caixaPostal');if(admin)return {papel:'admin',cpf:admin.cpf};
  var monitor=_validaToken(token);if(monitor&&!monitor.adminToken)return {papel:'monitor',cpf:monitor.cpf};
  return null;
}
function _caixaAba(criar){
  var planilha=SpreadsheetApp.getActiveSpreadsheet(),sheet=planilha.getSheetByName(CFG.ABA_CAIXA);
  if(!sheet&&criar){sheet=planilha.insertSheet(CFG.ABA_CAIXA);sheet.appendRow(['Data e hora','Conversa','CPF Monitor','Nome Monitor','Assunto','Autor','CPF Autor','Nome Autor','Mensagem','Lida pelo Monitor']);}
  return sheet;
}
function _caixaNome(cpf,papel){
  var sheet=_aba(papel==='admin'?CFG.ABA_ADMIN:CFG.ABA_MONITORES);
  if(!sheet)return '';
  var rows=sheet.getDataRange().getValues(),colCpf=papel==='admin'?0:MC.CPF-1,colNome=papel==='admin'?2:MC.NOME-1;
  for(var i=1;i<rows.length;i++)if(_normCPF(String(rows[i][colCpf]||''))===cpf)return String(rows[i][colNome]||'').trim();
  return '';
}
function _caixaData(valor){return valor instanceof Date?Utilities.formatDate(valor,Session.getScriptTimeZone(),'dd/MM/yyyy HH:mm'):String(valor||'');}
function _caixaListar(p){
  var acesso=_caixaAcesso(p.token);if(!acesso)return _err('Sem acesso à caixa postal.','FORBIDDEN');
  var sheet=_caixaAba(false);if(!sheet)return {ok:true,lista:[],pendentes:0};
  var rows=sheet.getDataRange().getValues(),conversas={};
  for(var i=1;i<rows.length;i++){
    var r=rows[i],id=String(r[1]||'').trim(),cpf=_normCPF(String(r[2]||''));
    if(!id||acesso.papel==='monitor'&&cpf!==acesso.cpf)continue;
    if(!conversas[id])conversas[id]={id:id,cpfMonitor:_maskCPF(cpf),nomeMonitor:String(r[3]||''),assunto:String(r[4]||''),naoLidas:0};
    var c=conversas[id];c.data=_caixaData(r[0]);c.ultimaMensagem=String(r[8]||'').slice(0,100);c.ultimoAutor=String(r[5]||'');c.ordem=i;
    if(acesso.papel==='monitor'&&c.ultimoAutor==='Administrador'&&String(r[9]||'')!=='Sim')c.naoLidas++;
  }
  var lista=Object.keys(conversas).map(function(id){return conversas[id];}).sort(function(a,b){return b.ordem-a.ordem;}).slice(0,100);
  return {ok:true,lista:lista,pendentes:lista.filter(function(c){return c.ultimoAutor==='Monitor';}).length};
}
function _caixaAbrir(p){
  var acesso=_caixaAcesso(p.token);if(!acesso)return _err('Sem acesso à caixa postal.','FORBIDDEN');
  var id=String(p.conversa||'').trim(),sheet=_caixaAba(false);if(!id||!sheet)return _err('Conversa não encontrada.','NOT_FOUND');
  var rows=sheet.getDataRange().getValues(),mensagens=[],assunto='',nomeMonitor='',cpfMonitor='';
  for(var i=1;i<rows.length;i++){
    var r=rows[i];if(String(r[1]||'').trim()!==id)continue;
    var cpf=_normCPF(String(r[2]||''));
    if(acesso.papel==='monitor'&&cpf!==acesso.cpf)return _err('Sem acesso a esta conversa.','FORBIDDEN');
    cpfMonitor=cpf;assunto=String(r[4]||'');nomeMonitor=String(r[3]||'');
    mensagens.push({data:_caixaData(r[0]),autor:String(r[5]||''),nome:String(r[7]||''),texto:String(r[8]||'')});
    if(acesso.papel==='monitor'&&String(r[5]||'')==='Administrador'&&String(r[9]||'')!=='Sim')sheet.getRange(i+1,10).setValue('Sim');
  }
  if(!mensagens.length)return _err('Conversa não encontrada.','NOT_FOUND');
  return {ok:true,id:id,assunto:assunto,nomeMonitor:nomeMonitor,cpfMonitor:_maskCPF(cpfMonitor),mensagens:mensagens};
}
function _caixaMonitores(p){
  if(!_adminTem(p.token,'caixaPostal'))return _err('Sem permissão para enviar mensagens.','FORBIDDEN');
  var rows=_aba(CFG.ABA_MONITORES).getDataRange().getValues(),lista=[];
  for(var i=1;i<rows.length;i++)if(rows[i][MC.NOME-1])lista.push({nome:String(rows[i][MC.NOME-1]),cpf:_maskCPF(_normCPF(String(rows[i][MC.CPF-1])))});
  return {ok:true,lista:lista};
}
function _caixaEnviar(p){
  var acesso=_caixaAcesso(p.token);if(!acesso)return _err('Sem acesso à caixa postal.','FORBIDDEN');
  var texto=String(p.mensagem||'').trim();
  if(texto.length<3||texto.length>2000)return _err('Escreva uma mensagem de 3 a 2000 caracteres.','MESSAGE_INVALID');
  var lock=LockService.getScriptLock();if(!lock.tryLock(30000))return _err('Sistema ocupado. Tente novamente.','BUSY');
  try{
    var sheet=_caixaAba(true),rows=sheet.getDataRange().getValues(),id=String(p.conversa||'').trim(),cpfMonitor='',nomeMonitor='',assunto='';
    if(id){
      for(var i=1;i<rows.length;i++)if(String(rows[i][1]||'').trim()===id){cpfMonitor=_normCPF(String(rows[i][2]||''));nomeMonitor=String(rows[i][3]||'');assunto=String(rows[i][4]||'');break;}
      if(!cpfMonitor)return _err('Conversa não encontrada.','NOT_FOUND');
      if(acesso.papel==='monitor'&&cpfMonitor!==acesso.cpf)return _err('Sem acesso a esta conversa.','FORBIDDEN');
    }else{
      cpfMonitor=acesso.papel==='monitor'?acesso.cpf:_normCPF(p.cpfMonitor||'');
      nomeMonitor=_caixaNome(cpfMonitor,'monitor');
      if(!nomeMonitor)return _err('Monitor não encontrado.','NOT_FOUND');
      assunto=String(p.assunto||'').trim();
      if(assunto.length<3||assunto.length>120)return _err('Informe um assunto de 3 a 120 caracteres.','SUBJECT_INVALID');
      id='CX-'+new Date().getFullYear()+'-'+Utilities.getUuid().replace(/-/g,'').slice(0,16);
    }
    var nomeAutor=_caixaNome(acesso.cpf,acesso.papel)||'Administrador';
    sheet.appendRow([new Date(),id,cpfMonitor,_textoSeguroPlanilha(nomeMonitor),_textoSeguroPlanilha(assunto),acesso.papel==='admin'?'Administrador':'Monitor',acesso.cpf,_textoSeguroPlanilha(nomeAutor),_textoSeguroPlanilha(texto),acesso.papel==='monitor'?'Sim':'Não']);
    return {ok:true,conversa:id};
  }finally{lock.releaseLock();}
}
function _registrarAuditoria(acao,p,resultado,contexto) {
  var planilha=SpreadsheetApp.getActiveSpreadsheet();
  var sheet=planilha.getSheetByName(CFG.ABA_AUDITORIA);
  if(!sheet){sheet=planilha.insertSheet(CFG.ABA_AUDITORIA);sheet.appendRow(['Data e hora','Ator','Perfil','Ação','Alvo','Resultado','Detalhes']);}
  var papel=contexto?contexto.papel:'visitante',ator=contexto?contexto.ator:'';
  var alvo='';
  if(!ator&&p.cpf)ator=String(p.cpf).indexOf('@')!==-1?String(p.cpf).slice(0,100):_maskCPF(_normCPF(p.cpf));
  if(p.protocolo)alvo=String(p.protocolo).slice(0,80);
  else if(p.data)alvo=String(p.data).slice(0,20);
  else if(p.cpf && papel==='administrador')alvo=_maskCPF(_normCPF(p.cpf));
  else if(resultado && resultado.protocolo)alvo=String(resultado.protocolo);
  else if(p.conversa||resultado&&resultado.conversa)alvo=String(p.conversa||resultado.conversa).slice(0,80);
  var detalhes='';
  if(contexto&&contexto.monitorAlvo)detalhes='Monitor: '+contexto.monitorAlvo+'; ';
  if(p.decisao){detalhes+='Decisão: '+String(p.decisao).slice(0,30);if(p.motivo)detalhes+='; Motivo: '+String(p.motivo).slice(0,160);}
  else if(p.resposta)detalhes+='Resposta: '+String(p.resposta).slice(0,30);
  else if(p.visita && p.visita.dataVisita)detalhes+='Visita: '+String(p.visita.dataVisita).slice(0,20);
  if(['adminCriarAdmin','adminAtualizarAdmin'].indexOf(acao)!==-1){
    if(p.nome)detalhes+='; Nome: '+String(p.nome).slice(0,80);
    if(p.email)detalhes+='; E-mail: '+String(p.email).slice(0,100);
    if(Array.isArray(p.permissoes))detalhes+='; Permissões: '+p.permissoes.filter(function(x){return PERMISSOES_ADMIN.indexOf(x)!==-1;}).join(',').slice(0,180);
  }
  sheet.appendRow([new Date(),_textoSeguroPlanilha(ator),_textoSeguroPlanilha(papel),_textoSeguroPlanilha(String(acao||'').slice(0,80)),
    _textoSeguroPlanilha(alvo),_textoSeguroPlanilha(resultado&&resultado.ok?'OK':String(resultado&&resultado.code||'ERRO')),_textoSeguroPlanilha(detalhes)]);
}
function _textoSeguroPlanilha(valor) {
  var s=String(valor==null?'':valor);
  return /^[\s]*[=+\-@]/.test(s) ? "'"+s : s;
}
function _ticketValido(ticket, cpf, finalidade){
  if (!ticket || !/^[a-f0-9]{64}$/i.test(String(ticket))) return false;
  var raw=CacheService.getScriptCache().get('PASS_'+ticket);
  if (!raw) return false;
  try { var dados=JSON.parse(raw); return dados.cpf===cpf && dados.finalidade===finalidade; } catch(e){ return false; }
}
function _consumirTicket(ticket, cpf, finalidade){
  if (!_ticketValido(ticket,cpf,finalidade)) return false;
  CacheService.getScriptCache().remove('PASS_'+ticket);
  return true;
}
function _checkRateLimit(cpf){var cache=CacheService.getScriptCache();if(cache.get('LOCK_'+cpf)){return{bloqueado:true,msg:'Conta bloqueada temporariamente por excesso de tentativas.'};} return{bloqueado:false};}
function _incrementaRL(cpf){var cache=CacheService.getScriptCache();var key='RL_'+cpf;var cnt=parseInt(cache.get(key)||'0',10)+1;var exp=CFG.LOCKOUT_MIN*60;if(cnt>=CFG.MAX_TENTATIVAS){cache.put('LOCK_'+cpf,'1',exp);cache.remove(key);}else{cache.put(key,String(cnt),exp);}}
function _tentativasRestantes(cpf){return Math.max(0,CFG.MAX_TENTATIVAS-parseInt(CacheService.getScriptCache().get('RL_'+cpf)||'0',10));}
function _resetRL(cpf){var cache=CacheService.getScriptCache();cache.remove('RL_'+cpf);cache.remove('LOCK_'+cpf);}

// ─────────────────────────────────────────────────────────────
// ATUALIZAR PERFIL DO MONITOR
// ─────────────────────────────────────────────────────────────
function _atualizarPerfil(p) {
  var sessao = _validaToken(p.token);
  if (!sessao) return _err('Sessão expirada.', 'UNAUTHORIZED');
  if (sessao.adminToken) return _err('O perfil só pode ser alterado pelo próprio monitor.', 'FORBIDDEN');

  var nome = _san(p.nome || '');
  var cpf = _normCPF(p.cpf || '');
  var rg = _san(p.rg || '');
  var telefone = _san(p.telefone || '');
  var email = _san(p.email || '');
  var cidade = _localidadePadronizada(p.cidade, false);
  var bairro = _san(p.bairro || '');
  var senha = p.senha; // Opcional
  if (senha) {
    if (senha.length < 8 || !/[A-Za-z]/.test(senha) || !/[0-9]/.test(senha)) {
      return _err('A nova senha deve ter ao menos 8 caracteres, com letras e números.', 'PASSWORD_INVALID');
    }
    if (!_ticketValido(p.ticketSenha, sessao.cpf, 'perfil')) {
      return _err('Confirme a troca de senha com o código enviado ao e-mail cadastrado.', 'UNAUTHORIZED');
    }
  }

  if (!nome) return _err('Nome é obrigatório.');
  if (cpf.length !== 11) return _err('CPF deve ter 11 dígitos.');
  if (!_validaCPFAlg(cpf)) return _err('CPF inválido.');
  if (!rg) return _err('RG é obrigatório.');
  if (!telefone) return _err('Telefone é obrigatório.');
  if (!email) return _err('E-mail é obrigatório.');
  if (!cidade) return _err('Informe a cidade no formato Cidade/UF (ex.: São Sebastião/SP).', 'CITY_INVALID');
  if (!bairro) return _err('Bairro é obrigatório.');

  var sheet = _aba(CFG.ABA_MONITORES);
  var rows = sheet.getDataRange().getValues();
  var monitorIndex = -1;

  for (var i = 1; i < rows.length; i++) {
    if (_normCPF(String(rows[i][MC.CPF - 1])) === sessao.cpf) {
      monitorIndex = i;
      break;
    }
  }

  if (monitorIndex === -1) return _err('Monitor não localizado cadastrado na base.');

  // Impedir alteração de CPF/RG se já estiverem preenchidos na base
  var rgExistente = String(rows[monitorIndex][MC.RG - 1] || '').trim();
  var cpfExistente = _normCPF(String(rows[monitorIndex][MC.CPF - 1] || ''));

  if (cpfExistente && cpfExistente !== '00000000000' && cpf !== cpfExistente) {
    return _err('O CPF não pode ser editado pois já está preenchido.');
  }
  if (rgExistente && rg !== rgExistente) {
    return _err('O RG não pode ser editado pois já está preenchido.');
  }

  // Se o CPF mudou, certificar que o novo CPF não está em uso por OUTRO monitor
  if (cpf !== sessao.cpf) {
    for (var j = 1; j < rows.length; j++) {
      if (j !== monitorIndex && _normCPF(String(rows[j][MC.CPF - 1])) === cpf) {
        return _err('Este novo CPF já está cadastrado por outro monitor.');
      }
    }
  }

  var rowNum = monitorIndex + 1;
  if (senha && !_consumirTicket(p.ticketSenha, sessao.cpf, 'perfil')) {
    return _err('Confirmação expirada. Solicite outro código.', 'UNAUTHORIZED');
  }
  sheet.getRange(rowNum, MC.RG).setValue(rg);
  sheet.getRange(rowNum, MC.CPF).setValue(_maskCPF(cpf)); // Salvar com máscara
  sheet.getRange(rowNum, MC.NOME).setValue(nome);
  sheet.getRange(rowNum, MC.TELEFONE).setValue(telefone);
  sheet.getRange(rowNum, MC.EMAIL).setValue(email);
  sheet.getRange(rowNum, MC.CIDADE).setValue(cidade);
  sheet.getRange(rowNum, MC.BAIRRO).setValue(bairro);

  if (senha && senha.trim().length >= 8) {
    var novoHash = _hashSenha(cpf, senha);
    sheet.getRange(rowNum, MC.SENHA_HASH).setValue(novoHash);
  }

  // Atualizar a sessão no cache caso o CPF tenha mudado, para evitar deslogar o monitor
  if (cpf !== sessao.cpf) {
    CacheService.getScriptCache().put('TK_' + p.token, JSON.stringify({ cpf: cpf }), CFG.TOKEN_HORAS * 3600);
  }

  return {
    ok: true,
    monitor: {
      nome: nome,
      cpf: _maskCPF(cpf),
      telefone: telefone,
      email: email,
      rg: rg,
      cidade: cidade,
      bairro: bairro
    }
  };
}
