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
  ABA_PROTOCOLOS_ANTIGOS: 'Protocolos_Anteriores',
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
      case 'adminObterConfigEmail': return _adminObterConfigEmail(carga);
      case 'adminSalvarConfigEmail': return _adminSalvarConfigEmail(carga);
      case 'adminTestarEmail':      return _adminTestarEmail(carga);
      case 'reenviarConviteAuxiliar': return _reenviarConviteAuxiliar(carga);
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
  var loginInput = String(p.cpf || p.email || '').trim();
  var senha = p.senha;
  if (!loginInput)          return _err('Informe o E-mail ou CPF.');
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
        var rawCpf = String(rows[i][MC.CPF - 1] || '').trim();
        cpf = rawCpf ? _normCPF(rawCpf) : '';
        break;
      }
    }
    if (foundRowIndex === -1) return _err('E-mail não cadastrado.', 'INVALID_CREDENTIALS');
  } else {
    cpf = _normCPF(loginInput);
    for (var i = 1; i < rows.length; i++) {
      var rowCpf = _normCPF(String(rows[i][MC.CPF - 1] || ''));
      var rowEmail = _san(String(rows[i][MC.EMAIL - 1] || '')).toLowerCase();
      if ((cpf && rowCpf === cpf) || rowEmail === loginInput.toLowerCase()) {
        foundRowIndex = i;
        email = rowEmail;
        cpf = rowCpf;
        break;
      }
    }
    if (foundRowIndex === -1) return _err('Cadastro não credenciado na base da SETUR.', 'INVALID_CREDENTIALS');
  }

  var rlKey = email || cpf;
  var rl = _checkRateLimit(rlKey);
  if (rl.bloqueado) return _err(rl.msg, 'LOCKED');

  var hashSalvo = String(rows[foundRowIndex][MC.SENHA_HASH - 1] || '').trim();
  if (!hashSalvo) return _err('Senha não cadastrada. Use "Meu Primeiro Acesso".', 'NO_PASSWORD');
  if (!_hashSenhaValida(hashSalvo, email, cpf, senha)) {
    _incrementaRL(rlKey);
    return _err('Credenciais incorretas. Tentativas restantes: ' + _tentativasRestantes(rlKey), 'INVALID_CREDENTIALS');
  }

  _resetRL(rlKey);
  var token = _novoToken();
  CacheService.getScriptCache().put('TK_' + token, JSON.stringify({ email: email, cpf: cpf, nome: _san(rows[foundRowIndex][MC.NOME - 1]), emitido: Date.now() }), CFG.TOKEN_HORAS * 3600);
  try {
    var tsStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
    sheet.getRange(foundRowIndex + 1, MC.ULTIMO_LOGIN).setValue(tsStr);
  } catch(e2){}
  return {
    ok: true, token: token,
    monitor: {
      nome: _san(rows[foundRowIndex][MC.NOME - 1]),
      cpf: cpf && cpf !== '00000000000' ? _maskCPF(cpf) : '',
      telefone: _san(rows[foundRowIndex][MC.TELEFONE - 1]),
      email: email || _san(rows[foundRowIndex][MC.EMAIL - 1]),
      rg: _san(rows[foundRowIndex][MC.RG - 1] || ''),
      cidade: _san(rows[foundRowIndex][MC.CIDADE - 1] || ''),
      bairro: _san(rows[foundRowIndex][MC.BAIRRO - 1] || '')
    }
  };
}

function _verificarCPF(p) {
  var email = _san(String(p.email || '')).toLowerCase();
  var cpf = p.cpf ? _normCPF(p.cpf) : '';
  if (!email && !cpf) return _err('Informe seu e-mail cadastrado.');

  var adminSheet=_aba(CFG.ABA_ADMIN);
  if(adminSheet){
    var admins=adminSheet.getDataRange().getValues();
    for(var a=1;a<admins.length;a++){
      var aEmail = String(admins[a][1]||'').trim().toLowerCase();
      var aCpf = _normCPF(String(admins[a][0]||''));
      if ((email && aEmail === email) || (cpf && aCpf === cpf)) {
        if (String(admins[a][4]||'').trim().toLowerCase() !== 'sim') return _err('Conta inativa.', 'INACTIVE');
        if (admins[a][3]) return _err('Este cadastro já possui senha. Use "Esqueci minha senha" se necessário.', 'HAS_PASSWORD');
        var envioAdmin = _enviarCodigo(aCpf || aEmail, aEmail, 'primeiro');
        if (envioAdmin.ok) {
          envioAdmin.papel = 'admin';
          return envioAdmin;
        }
        var adminTicket = _novoToken();
        CacheService.getScriptCache().put('PASS_' + adminTicket, JSON.stringify({ email: aEmail, cpf: aCpf, finalidade: 'primeiro' }), CFG.CODIGO_MINUTOS * 60);
        return {
          ok: true,
          direto: true,
          papel: 'admin',
          ticket: adminTicket,
          admin: { nome: String(admins[a][2]||'Administrador') }
        };
      }
    }
  }

  var rows = _aba(CFG.ABA_MONITORES).getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var rowEmail = _san(String(rows[i][MC.EMAIL - 1] || '')).toLowerCase();
    var rowCpf = _normCPF(String(rows[i][MC.CPF - 1] || ''));
    var match = (email && rowEmail === email) || (cpf && rowCpf === cpf);
    if (!match) continue;
    if (rows[i][MC.SENHA_HASH - 1]) return _err('Este cadastro já possui senha. Faça login ou utilize "Esqueci minha senha".', 'HAS_PASSWORD');
    
    var envio = _enviarCodigo(rowCpf || rowEmail, rowEmail, 'primeiro');
    if (envio.ok) {
      return envio;
    }
    
    // Se o envio falhou (por exemplo erro de cota ou permissão do MailApp no Google Apps Script):
    // Não bloqueia o monitor! Gera ticket de liberação direta para criação de senha.
    var ticket = _novoToken();
    CacheService.getScriptCache().put('PASS_' + ticket, JSON.stringify({ email: rowEmail, cpf: rowCpf, finalidade: 'primeiro' }), CFG.CODIGO_MINUTOS * 60);
    return {
      ok: true,
      direto: true,
      ticket: ticket,
      aviso: 'O envio do código por e-mail falhou no servidor do Google. Você foi liberado para definir sua senha diretamente.',
      monitor: {
        nome: String(rows[i][MC.NOME - 1] || ''),
        cpf: rowCpf && rowCpf !== '00000000000' ? _maskCPF(rowCpf) : '',
        rg: String(rows[i][MC.RG - 1] || ''),
        telefone: String(rows[i][MC.TELEFONE - 1] || ''),
        email: rowEmail,
        cidade: String(rows[i][MC.CIDADE - 1] || ''),
        bairro: String(rows[i][MC.BAIRRO - 1] || '')
      }
    };
  }
  return _err('Cadastro não encontrado na base de monitores credenciados da SETUR. Verifique se o e-mail digitado está correto.', 'NOT_FOUND');
}

function _escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _enviarEmailPortal(opcoes) {
  var to = String(opcoes.to || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return _err('E-mail destinatário inválido.', 'EMAIL_INVALID');
  var subject = String(opcoes.subject || 'Notificação — Espaço do Monitor').trim();
  var corpoTexto = String(opcoes.corpoTexto || '');
  var corpoHtml = String(opcoes.corpoHtml || '');
  
  var props = PropertiesService.getScriptProperties();
  var rodapeArteUrl = String(opcoes.rodapeArteUrl !== undefined ? opcoes.rodapeArteUrl : (props.getProperty('EMAIL_RODAPE_ARTE_URL') || '')).trim();
  var rodapeTexto = String(opcoes.rodapeTexto !== undefined ? opcoes.rodapeTexto : (props.getProperty('EMAIL_RODAPE_TEXTO') || '')).trim();
  
  var rodapeImgHtml = '';
  if (rodapeArteUrl) {
    rodapeImgHtml = '<div style="margin:16px 0 10px;text-align:center;"><img src="' + _escHtml(rodapeArteUrl) + '" alt="Assinatura Institucional" style="max-width:100%;max-height:140px;height:auto;border:0;" /></div>';
  }
  
  var rodapeTextoHtml = '';
  if (rodapeTexto) {
    rodapeTextoHtml = '<div style="font-size:12px;color:#4b5563;line-height:1.5;margin:8px 0;">' + _escHtml(rodapeTexto).replace(/\n/g, '<br/>') + '</div>';
  } else {
    rodapeTextoHtml = '<div style="font-size:12px;color:#4b5563;margin:6px 0;font-weight:600;">Secretaria Municipal de Turismo de São Sebastião/SP</div>';
  }
  
  var htmlCompleto = '<!DOCTYPE html>' +
    '<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
    '<body style="margin:0;padding:16px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e293b;-webkit-font-smoothing:antialiased;">' +
    '<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">' +
    '<div style="background-color:#13382c;padding:20px 24px;text-align:center;">' +
    '<h1 style="color:#ffffff;font-size:18px;margin:0;font-weight:700;letter-spacing:-0.01em;">Espaço do Monitor · São Sebastião</h1>' +
    '<p style="color:rgba(255,255,255,0.85);font-size:12px;margin:5px 0 0;">Secretaria Municipal de Turismo de São Sebastião/SP</p>' +
    '</div>' +
    '<div style="padding:24px;font-size:14px;line-height:1.6;color:#334155;">' +
    corpoHtml +
    '</div>' +
    '<div style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 24px;text-align:center;font-size:11px;color:#64748b;">' +
    rodapeImgHtml +
    rodapeTextoHtml +
    '<p style="margin:10px 0 0;font-size:11px;color:#94a3b8;">Esta é uma mensagem automática institucional do sistema de agendamento de visitas.</p>' +
    '</div></div></body></html>';
    
  var textoCompleto = corpoTexto;
  if (rodapeTexto) {
    textoCompleto += '\n\n---\n' + rodapeTexto;
  } else {
    textoCompleto += '\n\n---\nSecretaria Municipal de Turismo de São Sebastião/SP';
  }
  
  var emailEnviado = false;
  try {
    MailApp.sendEmail(to, subject, textoCompleto, { htmlBody: htmlCompleto });
    emailEnviado = true;
  } catch (e1) {
    Logger.log('MailApp falhou: ' + e1 + ' - tentando GmailApp...');
    try {
      GmailApp.sendEmail(to, subject, textoCompleto, { htmlBody: htmlCompleto });
      emailEnviado = true;
    } catch (e2) {
      Logger.log('GmailApp falhou: ' + e2);
    }
  }
  
  if (!emailEnviado) {
    return _err('Não foi possível enviar o e-mail no momento. Verifique as permissões de envio do Google Apps Script.', 'EMAIL_ERROR');
  }
  return { ok: true };
}

function _notificarMonitorAuxiliarEmail(auxRow, monInfo) {
  var auxEmail = _san(String(auxRow[MC.EMAIL - 1] || '')).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(auxEmail)) return false;
  var auxNome = _san(String(auxRow[MC.NOME - 1] || 'Monitor(a)'));
  var temAcesso = Boolean(auxRow[MC.SENHA_HASH - 1] && String(auxRow[MC.SENHA_HASH - 1]).trim());
  
  var props = PropertiesService.getScriptProperties();
  var portalUrl = String(props.getProperty('PORTAL_URL') || '').trim();
  
  var assunto = '[Espaço do Monitor] Indicação como Monitor Auxiliar — Solicitação ' + monInfo.protocolo;
  
  var secaoOrientacoesHtml = '';
  var secaoOrientacoesTexto = '';
  
  if (temAcesso) {
    secaoOrientacoesHtml = '<div style="background-color:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:16px 18px;margin:18px 0;">' +
      '<p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1e293b;">Como confirmar ou recusar sua participação:</p>' +
      '<ol style="margin:0;padding-left:20px;font-size:13px;color:#334155;line-height:1.7;">' +
      (portalUrl ? '<li style="margin-bottom:6px;">Acesse o <strong>Espaço do Monitor</strong> pelo link: <a href="' + _escHtml(portalUrl) + '" style="color:#2d6a4f;font-weight:600;">' + _escHtml(portalUrl) + '</a></li>' : '<li style="margin-bottom:6px;">Acesse o <strong>Espaço do Monitor</strong>.</li>') +
      '<li style="margin-bottom:6px;">Faça login com seu <strong>e-mail</strong> e sua <strong>senha cadastrada</strong>.</li>' +
      '<li style="margin-bottom:6px;">Na tela inicial (Minhas Solicitações), localize a solicitação <strong>' + _escHtml(monInfo.protocolo) + '</strong> identificada com <strong>"🤝 Indicação de Auxiliar"</strong>.</li>' +
      '<li>Clique em <strong>Aceitar</strong> para confirmar sua presença ou <strong>Recusar</strong> caso não possa participar.</li>' +
      '</ol>' +
      '<p style="font-size:12px;color:#64748b;margin:10px 0 0;"><em>A solicitação fica aguardando o seu aceite para ser avaliada pela Secretaria Municipal de Turismo.</em></p>' +
      '</div>';
      
    secaoOrientacoesTexto = 'Como confirmar ou recusar sua participação:\n' +
      (portalUrl ? '1. Acesse o portal: ' + portalUrl + '\n' : '1. Acesse o Espaço do Monitor.\n') +
      '2. Faça login com seu e-mail e senha.\n' +
      '3. Em "Minhas Solicitações", localize o protocolo ' + monInfo.protocolo + '.\n' +
      '4. Clique em Aceitar ou Recusar.';
  } else {
    secaoOrientacoesHtml = '<div style="background-color:#fefce8;border:1px solid #fef08a;border-radius:8px;padding:16px 18px;margin:18px 0;">' +
      '<p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#854d0e;">💡 Este será o seu primeiro acesso ao sistema:</p>' +
      '<p style="margin:0 0 10px;font-size:13px;color:#713f12;">Como você já é credenciado(a) junto à Secretaria Municipal de Turismo de São Sebastião/SP, siga o passo a passo abaixo para criar sua senha de acesso e responder à solicitação:</p>' +
      '<ol style="margin:0;padding-left:20px;font-size:13px;color:#713f12;line-height:1.7;">' +
      (portalUrl ? '<li style="margin-bottom:6px;">Acesse o portal: <a href="' + _escHtml(portalUrl) + '" style="color:#2d6a4f;font-weight:700;">' + _escHtml(portalUrl) + '</a></li>' : '<li style="margin-bottom:6px;">Acesse o portal do Espaço do Monitor.</li>') +
      '<li style="margin-bottom:6px;">Na tela inicial de login, clique na opção <strong>"Primeiro Acesso"</strong>.</li>' +
      '<li style="margin-bottom:6px;">Digite o seu e-mail cadastrado (o mesmo onde recebeu esta mensagem: <code>' + _escHtml(auxEmail) + '</code>).</li>' +
      '<li style="margin-bottom:6px;">Você receberá um código de 6 dígitos no seu e-mail para validar sua identidade.</li>' +
      '<li style="margin-bottom:6px;">Crie uma senha pessoal segura e confirme.</li>' +
      '<li>Pronto! Ao entrar, você verá a solicitação com o botão para <strong>Aceitar</strong> ou <strong>Recusar</strong>.</li>' +
      '</ol>' +
      '</div>';
      
    secaoOrientacoesTexto = 'Como realizar seu Primeiro Acesso e confirmar a visita:\n' +
      (portalUrl ? '1. Acesse o portal: ' + portalUrl + '\n' : '1. Acesse o Espaço do Monitor.\n') +
      '2. Clique em "Primeiro Acesso".\n' +
      '3. Digite seu e-mail cadastrado: ' + auxEmail + '\n' +
      '4. Digite o código de 6 dígitos que chegará no seu e-mail.\n' +
      '5. Crie sua senha de acesso.\n' +
      '6. Na tela inicial, clique em Aceitar ou Recusar a indicação como auxiliar.';
  }
  
  var corpoHtml = '<p style="margin-top:0;">Olá, <strong>' + _escHtml(auxNome) + '</strong>,</p>' +
    '<p>Você foi indicado(a) pelo monitor <strong>' + _escHtml(monInfo.quem) + '</strong> para atuar como <strong>Monitor(a) Auxiliar</strong> na solicitação de visita agendada abaixo:</p>' +
    '<div style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px 18px;margin:18px 0;box-shadow:0 1px 3px rgba(0,0,0,0.04);">' +
    '<div style="font-size:12px;font-weight:700;color:#13382c;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:12px;border-bottom:1px solid #f1f5f9;padding-bottom:6px;">📋 Ficha Completa da Visita</div>' +
    '<table style="width:100%;font-size:13px;border-collapse:collapse;line-height:1.9;">' +
    '<tr><td style="color:#64748b;width:38%;">Protocolo:</td><td style="font-weight:700;color:#1e293b;">' + _escHtml(monInfo.protocolo) + '</td></tr>' +
    '<tr><td style="color:#64748b;">Data da Visita:</td><td style="font-weight:700;color:#1e293b;">' + _escHtml(monInfo.data) + '</td></tr>' +
    '<tr><td style="color:#64748b;">Horário / Período:</td><td>' + _escHtml(monInfo.horario) + '</td></tr>' +
    '<tr><td style="color:#64748b;">Monitor Responsável:</td><td><strong>' + _escHtml(monInfo.quem) + '</strong></td></tr>' +
    '<tr><td style="color:#64748b;">Contatos do Responsável:</td><td>' + _escHtml(monInfo.telefone || '—') + (monInfo.email ? (' · ' + _escHtml(monInfo.email)) : '') + '</td></tr>' +
    '<tr><td style="color:#64748b;">Tamanho do Grupo:</td><td><strong>' + _escHtml(String(monInfo.tamanho)) + ' pessoa(s)</strong></td></tr>' +
    '<tr><td style="color:#64748b;">Perfil do Grupo:</td><td>' + _escHtml(monInfo.tipoGrupo) + (monInfo.faixaEtaria ? (' · Faixa: ' + _escHtml(monInfo.faixaEtaria)) : '') + '</td></tr>' +
    '<tr><td style="color:#64748b;">Origem dos Visitantes:</td><td>' + _escHtml(monInfo.origem) + '</td></tr>' +
    (monInfo.agencia ? ('<tr><td style="color:#64748b;">Agência / Operadora:</td><td>' + _escHtml(monInfo.agencia) + '</td></tr>') : '') +
    (monInfo.hospedagem ? ('<tr><td style="color:#64748b;">Hospedagem:</td><td>' + _escHtml(monInfo.hospedagem) + '</td></tr>') : '') +
    (monInfo.diasSS ? ('<tr><td style="color:#64748b;">Permanência em São Sebastião:</td><td>' + _escHtml(monInfo.diasSS) + '</td></tr>') : '') +
    (monInfo.outrosAuxiliares ? ('<tr><td style="color:#64748b;">Monitores Auxiliares:</td><td>' + _escHtml(monInfo.outrosAuxiliares) + '</td></tr>') : '') +
    '</table></div>' +
    secaoOrientacoesHtml +
    '<div style="margin-top:18px;padding:12px 14px;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:12px;color:#166534;line-height:1.5;">' +
    '<strong>Secretaria Municipal de Turismo de São Sebastião/SP (SETUR)</strong><br>' +
    'Em caso de dúvidas ou dificuldades com o sistema, entre em contato com nossa equipe de atendimento.' +
    '</div>';
    
  var corpoTexto = 'Olá, ' + auxNome + ',\n\n' +
    'Você foi indicado(a) pelo monitor ' + monInfo.quem + ' para atuar como Monitor(a) Auxiliar na solicitação de agendamento ' + monInfo.protocolo + '.\n\n' +
    'FICHA COMPLETA DA VISITA:\n' +
    '- Protocolo: ' + monInfo.protocolo + '\n' +
    '- Data da Visita: ' + monInfo.data + '\n' +
    '- Horário / Período: ' + monInfo.horario + '\n' +
    '- Monitor Responsável: ' + monInfo.quem + ' (Tel: ' + (monInfo.telefone || '—') + ' | E-mail: ' + (monInfo.email || '—') + ')\n' +
    '- Tamanho do Grupo: ' + monInfo.tamanho + ' pessoa(s)\n' +
    '- Perfil do Grupo: ' + monInfo.tipoGrupo + (monInfo.faixaEtaria ? (' · ' + monInfo.faixaEtaria) : '') + '\n' +
    '- Origem: ' + monInfo.origem + '\n' +
    (monInfo.agencia ? ('- Agência: ' + monInfo.agencia + '\n') : '') +
    (monInfo.hospedagem ? ('- Hospedagem: ' + monInfo.hospedagem + '\n') : '') +
    (monInfo.diasSS ? ('- Permanência em São Sebastião: ' + monInfo.diasSS + '\n') : '') +
    (monInfo.outrosAuxiliares ? ('- Monitores Auxiliares: ' + monInfo.outrosAuxiliares + '\n') : '') + '\n' +
    secaoOrientacoesTexto + '\n\n' +
    'Secretaria Municipal de Turismo de São Sebastião/SP (SETUR)';
    
  return _enviarEmailPortal({
    to: auxEmail,
    subject: assunto,
    corpoTexto: corpoTexto,
    corpoHtml: corpoHtml
  });
}

function _enviarCodigo(cpfOuEmail, email, finalidade) {
  var emailDestino = String(email || cpfOuEmail || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDestino)) {
    return _err('Não há e-mail válido no cadastro. Solicite a atualização à SETUR.', 'EMAIL_REQUIRED');
  }
  var cache = CacheService.getScriptCache();
  var idChave = String(cpfOuEmail || emailDestino).replace(/[^a-zA-Z0-9_@.-]/g, '');
  var chave = 'COD_' + finalidade + '_' + idChave;
  if (cache.get('COD_ENV_' + finalidade + '_' + idChave)) {
    return _err('Aguarde um minuto antes de solicitar outro código.', 'RATE_LIMIT');
  }
  var codigo = String(100000 + Math.floor(Math.random() * 900000));
  cache.put(chave, JSON.stringify({ hash: _hashSenha(idChave, finalidade + '|' + codigo), tentativas: 0 }), CFG.CODIGO_MINUTOS * 60);
  
  var finalidadeTexto = finalidade === 'primeiro' ? 'para o seu primeiro acesso' : finalidade === 'recuperar' ? 'para redefinição da sua senha' : 'para confirmação do seu perfil';
  
  var corpoTexto = 'Seu código de confirmação é ' + codigo + '. Ele vale por ' + CFG.CODIGO_MINUTOS + ' minutos. Se você não solicitou este código, ignore esta mensagem.';
  var corpoHtml = '<p style="margin-top:0;">Olá,</p>' +
    '<p>Seu código de confirmação ' + finalidadeTexto + ' no <strong>Espaço do Monitor</strong> é:</p>' +
    '<div style="text-align:center;margin:22px 0;">' +
    '<span style="font-size:32px;font-weight:800;letter-spacing:6px;color:#13382c;background:#eef5f0;padding:10px 24px;border-radius:8px;border:1px solid #c2dec9;display:inline-block;">' + codigo + '</span>' +
    '</div>' +
    '<p style="font-size:13px;color:#64748b;">Este código de verificação é válido por <strong>' + CFG.CODIGO_MINUTOS + ' minutos</strong>. Se você não solicitou este código, por favor desconsidere este e-mail com segurança.</p>' +
    '<div style="margin-top:16px;padding:10px 12px;background:#f0fdf4;border:1px solid #dcfce7;border-radius:6px;font-size:12px;color:#166534;">' +
    'Em caso de dúvidas ou problemas, contate a Secretaria de Turismo de São Sebastião (SETUR).' +
    '</div>';
    
  var envio = _enviarEmailPortal({
    to: emailDestino,
    subject: 'Código de acesso — Portal do Monitor',
    corpoTexto: corpoTexto,
    corpoHtml: corpoHtml
  });

  if (!envio.ok) {
    cache.remove(chave);
    return _err('Não foi possível enviar o código por e-mail no momento. Verifique as permissões de envio do Google Apps Script ou contate o administrador.', 'EMAIL_ERROR');
  }
  cache.put('COD_ENV_' + finalidade + '_' + idChave, '1', 60);
  return { ok: true, emailMascarado: _mascararEmail(emailDestino) };
}

function _confirmarCodigo(p) {
  var cpf = p.cpf ? _normCPF(p.cpf) : '';
  var email = _san(p.email || '').toLowerCase();
  var finalidade = p.finalidade;
  var codigo = String(p.codigo || '').trim();
  if (['primeiro','recuperar','perfil'].indexOf(finalidade) === -1 || !/^\d{6}$/.test(codigo)) {
    return _err('Código inválido.', 'CODE_INVALID');
  }
  if (finalidade === 'perfil') {
    var sessaoPerfil = _validaToken(p.token);
    if (!sessaoPerfil) return _err('Sessão expirada.', 'UNAUTHORIZED');
    if (cpf && sessaoPerfil.cpf && sessaoPerfil.cpf !== cpf) return _err('Sessão expirada.', 'UNAUTHORIZED');
    if (email && sessaoPerfil.email && sessaoPerfil.email.toLowerCase() !== email) return _err('Sessão expirada.', 'UNAUTHORIZED');
  }

  // Preencher dados cruzados (cpf <-> email) a partir da base
  if (!email && cpf) {
    var adminSheetTmp = _aba(CFG.ABA_ADMIN);
    if (adminSheetTmp) {
      var admR = adminSheetTmp.getDataRange().getValues();
      for (var a = 1; a < admR.length; a++) {
        if (_normCPF(String(admR[a][0] || '')) === cpf) {
          email = String(admR[a][1] || '').trim().toLowerCase();
          break;
        }
      }
    }
    if (!email) {
      var monR = _aba(CFG.ABA_MONITORES).getDataRange().getValues();
      for (var m = 1; m < monR.length; m++) {
        if (_normCPF(String(monR[m][MC.CPF - 1] || '')) === cpf) {
          email = _san(String(monR[m][MC.EMAIL - 1] || '')).toLowerCase();
          break;
        }
      }
    }
  }
  if (!cpf && email) {
    var adminSheetTmp2 = _aba(CFG.ABA_ADMIN);
    if (adminSheetTmp2) {
      var admR2 = adminSheetTmp2.getDataRange().getValues();
      for (var a2 = 1; a2 < admR2.length; a2++) {
        if (String(admR2[a2][1] || '').trim().toLowerCase() === email) {
          cpf = _normCPF(String(admR2[a2][0] || ''));
          break;
        }
      }
    }
    if (!cpf) {
      var monR2 = _aba(CFG.ABA_MONITORES).getDataRange().getValues();
      for (var m2 = 1; m2 < monR2.length; m2++) {
        if (_san(String(monR2[m2][MC.EMAIL - 1] || '')).toLowerCase() === email) {
          cpf = _normCPF(String(monR2[m2][MC.CPF - 1] || ''));
          break;
        }
      }
    }
  }

  var cache = CacheService.getScriptCache();
  var raw = null;
  var chaveEncontrada = '';
  var idUsado = '';
  var chavesPossiveis = [];
  if (cpf) chavesPossiveis.push({ chave: 'COD_' + finalidade + '_' + cpf, id: cpf });
  if (email) chavesPossiveis.push({ chave: 'COD_' + finalidade + '_' + email, id: email });
  if (p.token) {
    var sess = _validaToken(p.token);
    if (sess) {
      if (sess.cpf) chavesPossiveis.push({ chave: 'COD_' + finalidade + '_' + sess.cpf, id: sess.cpf });
      if (sess.email) chavesPossiveis.push({ chave: 'COD_' + finalidade + '_' + sess.email.toLowerCase(), id: sess.email.toLowerCase() });
    }
  }
  for (var k = 0; k < chavesPossiveis.length; k++) {
    raw = cache.get(chavesPossiveis[k].chave);
    if (raw) {
      chaveEncontrada = chavesPossiveis[k].chave;
      idUsado = chavesPossiveis[k].id;
      break;
    }
  }

  if (!raw) return _err('Código expirado. Solicite um novo.', 'CODE_EXPIRED');
  var desafio = JSON.parse(raw);
  if (desafio.tentativas >= 5) return _err('Limite de tentativas atingido. Solicite outro código.', 'CODE_LOCKED');
  if (desafio.hash !== _hashSenha(idUsado, finalidade + '|' + codigo)) {
    desafio.tentativas++;
    if (desafio.tentativas >= 5) cache.remove(chaveEncontrada);
    else cache.put(chaveEncontrada, JSON.stringify(desafio), CFG.CODIGO_MINUTOS * 60);
    return _err('Código incorreto.', 'CODE_INVALID');
  }
  cache.remove(chaveEncontrada);
  var resposta = { ok: true };
  var ticket = _novoToken();
  cache.put('PASS_' + ticket, JSON.stringify({ cpf: cpf, email: email, identificador: idUsado, finalidade: finalidade }), CFG.CODIGO_MINUTOS * 60);
  resposta.ticket = ticket;

  if (finalidade === 'primeiro') {
    var adminSheet = _aba(CFG.ABA_ADMIN);
    if (adminSheet) {
      var admins = adminSheet.getDataRange().getValues();
      for (var a = 1; a < admins.length; a++) {
        var aEmail = String(admins[a][1]||'').trim().toLowerCase();
        var aCpf = _normCPF(String(admins[a][0]||''));
        if ((cpf && aCpf === cpf) || (email && aEmail === email) || (idUsado && (idUsado === aCpf || idUsado === aEmail))) {
          if (String(admins[a][4]||'').trim().toLowerCase() !== 'sim' || admins[a][3]) return _err('Acesso indisponível.', 'HAS_PASSWORD');
          resposta.papel = 'admin';
          resposta.admin = { nome: String(admins[a][2]||'Administrador') };
          break;
        }
      }
    }
    if (resposta.papel === 'admin') {
      return resposta;
    }
    var rows = _aba(CFG.ABA_MONITORES).getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var rowCpf = _normCPF(String(rows[i][MC.CPF - 1] || ''));
      var rowEmail = _san(String(rows[i][MC.EMAIL - 1] || '')).toLowerCase();
      if ((cpf && rowCpf === cpf) || (email && rowEmail === email) || (idUsado && (idUsado === rowCpf || idUsado === rowEmail))) {
        if (rows[i][MC.SENHA_HASH - 1]) return _err('Senha já cadastrada.', 'HAS_PASSWORD');
        resposta.monitor = {
          nome: String(rows[i][MC.NOME - 1] || ''),
          cpf: rowCpf && rowCpf !== '00000000000' ? _maskCPF(rowCpf) : '',
          rg: String(rows[i][MC.RG - 1] || ''),
          telefone: String(rows[i][MC.TELEFONE - 1] || ''),
          email: rowEmail,
          cidade: String(rows[i][MC.CIDADE - 1] || ''),
          bairro: String(rows[i][MC.BAIRRO - 1] || '')
        };
        break;
      }
    }
    if (!resposta.monitor) return _err('Monitor não encontrado.', 'NOT_FOUND');
  }
  return resposta;
}

function _criarSenha(p) {
  var email = _san(p.email || '').toLowerCase();
  var cpf = p.cpf ? _normCPF(p.cpf) : '';
  var senha = p.senha;
  if (!senha || senha.length < 8) return _err('A senha deve ter no mínimo 8 caracteres.');
  if (!_ticketValido(p.ticket, email || cpf, 'primeiro')) return _err('Confirmação expirada. Inicie o processo novamente.', 'UNAUTHORIZED');
  
  var adminSheet=_aba(CFG.ABA_ADMIN);
  if(adminSheet){
    var admins=adminSheet.getDataRange().getValues();
    for(var a=1;a<admins.length;a++){
      var aEmail = String(admins[a][1]||'').trim().toLowerCase();
      var aCpf = _normCPF(String(admins[a][0]||''));
      if((email && aEmail === email) || (cpf && aCpf === cpf)){
        if(String(admins[a][4]||'').trim().toLowerCase()!=='sim'||admins[a][3])return _err('Acesso indisponível.','HAS_PASSWORD');
        if(!_consumirTicket(p.ticket,email || cpf,'primeiro'))return _err('Confirmação expirada.','UNAUTHORIZED');
        adminSheet.getRange(a+1,4).setValue(_hashSenha(aEmail,senha));
        _resetRL(aCpf);
        if(aEmail) _resetRL(aEmail);
        return {ok:true,msg:'Senha administrativa criada. Faça login.'};
      }
    }
  }
  
  var nome = _san(p.nome || '');
  var rg = _san(p.rg || '');
  var telefone = _san(p.telefone || '');
  var cidade = _localidadePadronizada(p.cidade, false);
  var bairro = _san(p.bairro || '');
  
  if (!email) return _err('E-mail é obrigatório.');
  if (!nome) return _err('Nome é obrigatório.');
  if (!telefone) return _err('Telefone é obrigatório.');
  if (!cidade) return _err('Informe a cidade no formato Cidade/UF (ex.: São Sebastião/SP).', 'CITY_INVALID');
  if (!bairro) return _err('Bairro é obrigatório.');
  // RG e CPF não são obrigatórios

  var sheet = _aba(CFG.ABA_MONITORES);
  var rows  = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var rowEmail = _san(String(rows[i][MC.EMAIL - 1] || '')).toLowerCase();
    var rowCpf = _normCPF(String(rows[i][MC.CPF - 1] || ''));
    var match = (email && rowEmail === email) || (cpf && rowCpf === cpf);
    if (!match) continue;
    if (rows[i][MC.SENHA_HASH - 1]) return _err('Senha já cadastrada. Faça login.', 'HAS_PASSWORD');
    
    var rowNum = i + 1;
    if (!_consumirTicket(p.ticket, email || cpf, 'primeiro')) return _err('Confirmação expirada.', 'UNAUTHORIZED');
    if (rg) sheet.getRange(rowNum, MC.RG).setValue(rg);
    if (cpf && cpf !== '00000000000') sheet.getRange(rowNum, MC.CPF).setValue(_maskCPF(cpf));
    sheet.getRange(rowNum, MC.NOME).setValue(nome);
    sheet.getRange(rowNum, MC.TELEFONE).setValue(telefone);
    sheet.getRange(rowNum, MC.EMAIL).setValue(email);
    sheet.getRange(rowNum, MC.CIDADE).setValue(cidade);
    sheet.getRange(rowNum, MC.BAIRRO).setValue(bairro);
    sheet.getRange(rowNum, MC.SENHA_HASH).setValue(_hashSenha(email, senha));
    
    return { ok: true, msg: 'Senha criada e dados atualizados com sucesso!' };
  }
  return _err('Cadastro não localizado.', 'NOT_FOUND');
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
    var rEmail = _san(String(monRows[m][MC.EMAIL - 1] || '')).toLowerCase();
    var rCpf = _normCPF(String(monRows[m][MC.CPF - 1] || ''));
    if ((sessao.email && rEmail === sessao.email.toLowerCase()) || (sessao.cpf && rCpf === sessao.cpf)) {
      monRow = monRows[m];
      break;
    }
  }
  if (!monRow) return _err('Monitor não localizado.');
  var auxiliares = _resolverAuxiliares(v.monitoresAux, monRows, sessao.cpf || sessao.email);
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
    var rowEmailReq = _san(String(resRowsAll[r][1] || '')).toLowerCase();
    var rowCpfReq = _normCPF(String(resRowsAll[r][RF.CPF - 1]));
    var souEu = (sessao.email && rowEmailReq === sessao.email.toLowerCase()) || (sessao.cpf && rowCpfReq === sessao.cpf);
    if (souEu && resStatus !== 'cancelado' && resStatus !== 'negado') {
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

  var protocolo = _proximoProtocoloSequencial(new Date(), resRowsAll);
  var linha = new Array(RF.TOTAL_COLUNAS);
  for (var k = 0; k < linha.length; k++) linha[k] = '';
  linha[0]  = new Date();
  linha[1]  = _san(monRow[MC.EMAIL - 1]);
  linha[2]  = _san(monRow[MC.NOME - 1]);
  linha[3]  = _san(monRow[MC.TELEFONE - 1]);
  linha[4]  = tamGrupo;
  linha[5]  = 'Sou Monitor Ambiental Credenciado pelo PESM';
  linha[6]  = sessao.cpf || (monRow[MC.CPF - 1] ? _normCPF(String(monRow[MC.CPF - 1])) : '');
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
    var monInfo = {
      quem: _san(monRow[MC.NOME - 1]),
      email: _san(monRow[MC.EMAIL - 1]),
      telefone: _san(monRow[MC.TELEFONE - 1]),
      data: _dataBr(v.dataVisita),
      horario: v.horario ? (_san(v.horario)+':00') : '—',
      tamanho: tamGrupo,
      origem: _san(origemPadronizada),
      tipoGrupo: _san(v.tipoGrupo),
      faixaEtaria: _san(v.faixaEtaria || '—'),
      agencia: _san(v.nomeAgencia ? (v.nomeAgencia + (v.cnpjAgencia ? (' · CNPJ ' + v.cnpjAgencia) : '')) : ''),
      hospedagem: _san(v.hospedagem || ''),
      diasSS: v.diasSS ? (v.diasSS + ' dia(s)') : '',
      outrosAuxiliares: auxiliares.nomes.length > 1 ? auxiliares.nomes.join(', ') : '',
      protocolo: protocolo
    };
    for (var n = 0; n < auxiliares.cpfs.length; n++) {
      var auxCpf = auxiliares.cpfs[n];
      var chave = 'NOTIF_' + auxCpf;
      var existentes = [];
      try { existentes = JSON.parse(CacheService.getScriptCache().get(chave) || '[]'); } catch(e2){}
      existentes.push(monInfo);
      CacheService.getScriptCache().put(chave, JSON.stringify(existentes.slice(-10)), 21600);
      for (var mm = 1; mm < monRows.length; mm++) {
        if (_normCPF(String(monRows[mm][MC.CPF - 1])) === auxCpf) {
          try { _notificarMonitorAuxiliarEmail(monRows[mm], monInfo); } catch(eMail) { Logger.log('Falha ao enviar e-mail auxiliar: ' + eMail); }
          break;
        }
      }
    }
  }
  return { ok: true, protocolo: protocolo, aguardandoAux: aguardandoAux };
  } finally {
    lock.releaseLock();
  }
}

function _obterNomeMonitorSessao(monRows, sessao) {
  if (!sessao) return '';
  for (var m = 1; m < monRows.length; m++) {
    var rEmail = _san(String(monRows[m][MC.EMAIL - 1] || '')).toLowerCase();
    var rCpf = _normCPF(String(monRows[m][MC.CPF - 1] || ''));
    if ((sessao.email && rEmail === sessao.email.toLowerCase()) || (sessao.cpf && rCpf === sessao.cpf)) {
      return _san(monRows[m][MC.NOME - 1]);
    }
  }
  return sessao.nome || '';
}

// ─────────────────────────────────────────────────────────────
// HISTÓRICO (últimas 15 — painel principal)
// ─────────────────────────────────────────────────────────────
function _getHistorico(p) {
  var sessao = _validaToken(p.token);
  if (!sessao) return _err('Sessão expirada.', 'UNAUTHORIZED');

  // Buscar nome do monitor logado (para identificar onde é auxiliar)
  var monRows = _aba(CFG.ABA_MONITORES).getDataRange().getValues();
  var nomeMonitor = _obterNomeMonitorSessao(monRows, sessao);

  var rows = _aba(CFG.ABA_RESPOSTAS).getDataRange().getValues();
  var lista = [];
  var tz = Session.getScriptTimeZone();
  for (var i = 1; i < rows.length; i++) {
    var cpfRow = _normCPF(String(rows[i][RF.CPF - 1]));
    var emailRow = _san(String(rows[i][1] || '')).toLowerCase();
    var auxiliares = _san(rows[i][17] || '');
    var isPrincipal = (sessao.cpf && cpfRow === sessao.cpf) || (sessao.email && emailRow === sessao.email.toLowerCase());
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
  var nomeMonitor = _obterNomeMonitorSessao(monRows, sessao);

  var rows  = _aba(CFG.ABA_RESPOSTAS).getDataRange().getValues();
  var lista = [];
  var tz    = Session.getScriptTimeZone();
  var query  = _san(p.query  || '').toLowerCase().trim();
  var filtro = _san(p.filtro || 'ambas'); // 'ambas' | 'minhas' | 'auxiliar'

  for (var i = 1; i < rows.length; i++) {
    var cpfRow    = _normCPF(String(rows[i][RF.CPF - 1]));
    var emailRow  = _san(String(rows[i][1] || '')).toLowerCase();
    var auxiliares = _san(rows[i][17] || '');
    var isPrincipal = (sessao.cpf && cpfRow === sessao.cpf) || (sessao.email && emailRow === sessao.email.toLowerCase());
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
  var protocoloConsulta=_resolverProtocoloConsulta(p.protocolo);

  // Buscar nome do monitor logado (para verificar se é auxiliar)
  var monRows = _aba(CFG.ABA_MONITORES).getDataRange().getValues();
  var nomeMonitor = _obterNomeMonitorSessao(monRows, sessao);

  var sheet = _aba(CFG.ABA_RESPOSTAS);
  var rows  = sheet.getDataRange().getValues();
  var tz    = Session.getScriptTimeZone();

  for (var i = 1; i < rows.length; i++) {
    var proto = _referenciaSolicitacao(rows[i], i);
    if (proto !== protocoloConsulta) continue;

    var cpfPrincipal = _normCPF(String(rows[i][RF.CPF - 1]));
    var emailPrincipal = _san(String(rows[i][1] || '')).toLowerCase();
    var auxiliares   = _san(rows[i][17] || '');
    var isPrincipal  = !!sessao && ((sessao.cpf && cpfPrincipal === sessao.cpf) || (sessao.email && emailPrincipal === sessao.email.toLowerCase()));
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
    var rawCpf = String(rows[i][MC.CPF - 1] || '').trim();
    var email = _san(String(rows[i][MC.EMAIL - 1] || '')).toLowerCase();
    if (nome) lista.push({ nome: nome, cpf: rawCpf ? _normCPF(rawCpf) : '', email: email });
  }
  return { ok: true, monitores: lista };
}

// ─────────────────────────────────────────────────────────────
// NOTIFICAÇÕES
// ─────────────────────────────────────────────────────────────
function _getNotificacoes(p) {
  var sessao = _validaToken(p.token);
  if (!sessao) return _err('Sessão inválida.', 'UNAUTHORIZED');
  var chave = 'NOTIF_' + (sessao.email || sessao.cpf);
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
  var protocoloConsulta=_resolverProtocoloConsulta(p.protocolo);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return _err('O sistema está ocupado. Tente novamente.', 'BUSY');
  try {
  var sheet = _aba(CFG.ABA_RESPOSTAS);
  var rows  = sheet.getDataRange().getValues();
  var tz    = Session.getScriptTimeZone();
  for (var i = 1; i < rows.length; i++) {
    if (_referenciaSolicitacao(rows[i], i) !== protocoloConsulta) continue;
    var cpfRow = _normCPF(String(rows[i][RF.CPF - 1]));
    var emailRow = _san(String(rows[i][1] || '')).toLowerCase();
    var souEu = (sessao.cpf && cpfRow === sessao.cpf) || (sessao.email && emailRow === sessao.email.toLowerCase());
    if (!souEu) return _err('Sem permissão para cancelar esta solicitação.');
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
  var protocoloConsulta=_resolverProtocoloConsulta(p.protocolo);
  if (p.resposta !== 'Aceito' && p.resposta !== 'Recusado') return _err('Resposta inválida.');
  var monRows = _aba(CFG.ABA_MONITORES).getDataRange().getValues();
  var nomeMonitor = _obterNomeMonitorSessao(monRows, sessao);
  if (!nomeMonitor) return _err('Monitor não cadastrado na base.');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return _err('O sistema está ocupado. Tente novamente.', 'BUSY');
  try {
  var sheet = _aba(CFG.ABA_RESPOSTAS);
  var rows = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < rows.length; i++) {
    if (_referenciaSolicitacao(rows[i], i) === protocoloConsulta) {
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
  var email = String(p.email || '').trim().toLowerCase();
  var cpf = p.cpf ? _normCPF(p.cpf) : '';
  if (!email) return _err('Informe o e-mail cadastrado.');
  var adminSheet=_aba(CFG.ABA_ADMIN);
  if(adminSheet){var admins=adminSheet.getDataRange().getValues();for(var a=1;a<admins.length;a++){
    var aEmail = String(admins[a][1]||'').trim().toLowerCase();
    var aCpf = _normCPF(String(admins[a][0]||''));
    if (aEmail !== email) continue;
    if (cpf && aCpf && aCpf !== cpf) continue;
    if(String(admins[a][4]||'').trim().toLowerCase()!=='sim')return _err('Conta inativa.');
    return _enviarCodigo(aCpf || aEmail, aEmail,'recuperar');
  }}
  var rows = _aba(CFG.ABA_MONITORES).getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var mEmail = String(rows[i][MC.EMAIL - 1] || '').trim().toLowerCase();
    var mCpf = _normCPF(String(rows[i][MC.CPF - 1] || ''));
    if (mEmail !== email) continue;
    if (cpf && mCpf && mCpf !== cpf) continue;
    return _enviarCodigo(mCpf || mEmail, mEmail, 'recuperar');
  }
  return _err('E-mail não confere com o cadastro da SETUR.');
}

// ─────────────────────────────────────────────────────────────
// REDEFINIR SENHA
// ─────────────────────────────────────────────────────────────
function _redefinirSenha(p) {
  var email = _san(p.email || '').toLowerCase();
  var cpf = p.cpf ? _normCPF(p.cpf) : '';
  var senha = p.senha;
  if (!senha || senha.length < 8) return _err('Senha deve ter no mínimo 8 caracteres.');
  if (!_ticketValido(p.ticket, email || cpf, 'recuperar')) return _err('Confirmação expirada. Solicite outro código.', 'UNAUTHORIZED');
  var adminSheet=_aba(CFG.ABA_ADMIN);
  if(adminSheet){var admins=adminSheet.getDataRange().getValues();for(var a=1;a<admins.length;a++){
    var aEmail = String(admins[a][1]||'').trim().toLowerCase();
    var aCpf = _normCPF(String(admins[a][0]||''));
    if((email && aEmail===email) || (cpf && aCpf===cpf)){
      if(String(admins[a][4]||'').trim().toLowerCase()!=='sim')return _err('Conta inativa.','INACTIVE');
      if(!_consumirTicket(p.ticket,email || cpf,'recuperar'))return _err('Confirmação expirada.','UNAUTHORIZED');
      adminSheet.getRange(a+1,4).setValue(_hashSenha(aEmail,senha));
      _resetRL(aCpf);
      if(aEmail) _resetRL(aEmail);
      return {ok:true,msg:'Senha redefinida com sucesso!'};
    }
  }}
  var sheet = _aba(CFG.ABA_MONITORES);
  var rows  = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var mEmail = String(rows[i][MC.EMAIL - 1] || '').trim().toLowerCase();
    var mCpf = _normCPF(String(rows[i][MC.CPF - 1] || ''));
    if((email && mEmail===email) || (cpf && mCpf===cpf)){
      if (!_consumirTicket(p.ticket, email || cpf, 'recuperar')) return _err('Confirmação expirada.', 'UNAUTHORIZED');
      sheet.getRange(i + 1, MC.SENHA_HASH).setValue(_hashSenha(mEmail, senha));
      return { ok: true, msg: 'Senha redefinida com sucesso!' };
    }
  }
  return _err('Cadastro não encontrado.', 'NOT_FOUND');
}

function _solicitarCodigoPerfil(p) {
  var sessao = _validaToken(p.token);
  if (!sessao) return _err('Sessão expirada.', 'UNAUTHORIZED');
  var rows = _aba(CFG.ABA_MONITORES).getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var rEmail = _san(String(rows[i][MC.EMAIL - 1] || '')).toLowerCase();
    var rCpf = _normCPF(String(rows[i][MC.CPF - 1] || ''));
    if ((sessao.email && rEmail === sessao.email.toLowerCase()) || (sessao.cpf && rCpf === sessao.cpf)) {
      return _enviarCodigo(sessao.email || sessao.cpf, rEmail, 'perfil');
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
function _hashSenha(identificador,senha){
  var idLimpo = String(identificador||'').trim().toLowerCase();
  var input=CFG.PEPPER+'|'+idLimpo+'|'+senha;
  var bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,input,Utilities.Charset.UTF_8);
  return bytes.map(function(b){return('0'+(b&0xFF).toString(16)).slice(-2);}).join('');
}
function _hashSenhaValida(hashSalvo, email, cpf, senha) {
  if (!hashSalvo) return false;
  if (email && _hashSenha(email, senha) === hashSalvo) return true;
  if (cpf) {
    var cNorm = _normCPF(cpf);
    if (cNorm && _hashSenha(cNorm, senha) === hashSalvo) return true;
    if (_hashSenha(cpf, senha) === hashSalvo) return true;
  }
  return false;
}
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
function _resolverProtocoloConsulta(protocolo) {
  var referencia=String(protocolo||'').trim();
  if(!referencia)return referencia;
  var sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.ABA_PROTOCOLOS_ANTIGOS);
  if(!sheet)return referencia;
  var rows=sheet.getDataRange().getValues();
  for(var i=1;i<rows.length;i++)if(String(rows[i][0]||'').trim()===referencia)return String(rows[i][1]||'').trim();
  return referencia;
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
function _anoProtocolo(dataSub){
  if(dataSub instanceof Date&&!isNaN(dataSub.getTime()))return dataSub.getFullYear();
  var texto=String(dataSub||'').trim();
  var iso=texto.match(/^(\d{4})[-/]/),br=texto.match(/^\d{2}\/\d{2}\/(\d{4})/);
  if(iso)return Number(iso[1]);
  if(br)return Number(br[1]);
  throw new Error('Data de criação inválida para gerar protocolo.');
}
function _instanteProtocolo(dataSub){
  if(dataSub instanceof Date)return dataSub.getTime();
  var texto=String(dataSub||'').trim();
  var br=texto.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if(br)return new Date(Number(br[3]),Number(br[2])-1,Number(br[1]),Number(br[4]||0),Number(br[5]||0),Number(br[6]||0)).getTime();
  return new Date(texto).getTime();
}
function _proximoProtocoloSequencial(dataSub,rows){
  var ano=_anoProtocolo(dataSub),maior=0,quantidade=0,usados={};
  for(var i=1;i<rows.length;i++){
    if(!rows[i][0])continue;
    var protocolo=String(rows[i][RF.PROTOCOLO-1]||'').trim();
    if(protocolo)usados[protocolo]=true;
    if(_anoProtocolo(rows[i][0])!==ano)continue;
    quantidade++;
    var partes=protocolo.match(/^SS-(\d{4})-(\d{6})$/);
    if(partes&&Number(partes[1])===ano)maior=Math.max(maior,Number(partes[2]));
  }
  var numero=Math.max(maior,quantidade)+1;
  while(usados['SS-'+ano+'-'+('000000'+numero).slice(-6)])numero++;
  if(numero>999999)throw new Error('Limite de protocolos do ano atingido.');
  return 'SS-'+ano+'-'+('000000'+numero).slice(-6);
}
function _planoProtocolosSequenciais(rows){
  var registros=[],vistos={},contador={},alteracoes=[];
  for(var i=1;i<rows.length;i++){
    var row=rows[i];
    if(!row[0])continue;
    var antigo=String(row[RF.PROTOCOLO-1]||'').trim();
    if(antigo){if(vistos[antigo])throw new Error('Protocolo repetido nas linhas '+vistos[antigo]+' e '+(i+1)+': '+antigo);vistos[antigo]=i+1;}
    var instante=_instanteProtocolo(row[0]);
    if(isNaN(instante))throw new Error('Data de criação inválida na linha '+(i+1));
    registros.push({indice:i,ano:_anoProtocolo(row[0]),instante:instante,antigo:antigo});
  }
  registros.sort(function(a,b){return a.instante-b.instante||a.indice-b.indice;});
  for(var j=0;j<registros.length;j++){
    var r=registros[j],numero=(contador[r.ano]||0)+1;
    if(numero>999999)throw new Error('Limite de protocolos do ano '+r.ano+' atingido.');
    contador[r.ano]=numero;
    var novo='SS-'+r.ano+'-'+('000000'+numero).slice(-6);
    if(r.antigo!==novo)alteracoes.push({indice:r.indice,linha:r.indice+1,antigo:r.antigo||_referenciaSolicitacao(rows[r.indice],r.indice),novo:novo,valorOriginal:r.antigo});
  }
  return {total:registros.length,porAno:contador,alteracoes:alteracoes};
}
// Prévia sem argumento; executar com true somente com a cópia da planilha conferida.
function padronizarProtocolosSequenciais(executar){
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(30000))throw new Error('Não foi possível obter bloqueio da planilha.');
  try{
    var planilha=SpreadsheetApp.getActiveSpreadsheet(),sheet=_aba(CFG.ABA_RESPOSTAS),rows=sheet.getDataRange().getValues();
    var plano=_planoProtocolosSequenciais(rows);
    if(executar!==true){
      var previa={total:plano.total,porAno:plano.porAno,atualizar:plano.alteracoes.length,linhas:plano.alteracoes.map(function(a){return a.linha;})};
      Logger.log(JSON.stringify({total:previa.total,porAno:previa.porAno,atualizar:previa.atualizar}));
      return previa;
    }
    var aliases=planilha.getSheetByName(CFG.ABA_PROTOCOLOS_ANTIGOS);
    var existentes={};
    if(aliases){var anteriores=aliases.getDataRange().getValues();for(var a=1;a<anteriores.length;a++){
      var chave=String(anteriores[a][0]||'').trim();if(!chave)continue;
      if(existentes[chave]&&existentes[chave]!==String(anteriores[a][1]||'').trim())throw new Error('Referência anterior ambígua: '+chave);
      existentes[chave]=String(anteriores[a][1]||'').trim();
    }}
    for(var v=0;v<plano.alteracoes.length;v++){
      var item=plano.alteracoes[v];
      if(existentes[item.antigo]&&existentes[item.antigo]!==item.novo)throw new Error('Referência anterior já associada a outra solicitação: '+item.antigo);
    }
    if(!aliases&&plano.alteracoes.length){aliases=planilha.insertSheet(CFG.ABA_PROTOCOLOS_ANTIGOS);aliases.appendRow(['Protocolo anterior','Protocolo atual','Linha original','Data da migração']);}
    var atualizados=0;
    for(var k=0;k<plano.alteracoes.length;k++){
      var mudanca=plano.alteracoes[k];
      if(String(sheet.getRange(mudanca.linha,RF.PROTOCOLO).getValue()||'').trim()!==mudanca.valorOriginal)throw new Error('A linha '+mudanca.linha+' mudou durante a migração. Execute nova prévia.');
      if(!existentes[mudanca.antigo]){
        aliases.appendRow([mudanca.antigo,mudanca.novo,mudanca.linha,new Date()]);
        existentes[mudanca.antigo]=mudanca.novo;
      }
      sheet.getRange(mudanca.linha,RF.PROTOCOLO).setValue(mudanca.novo);
      atualizados++;
    }
    if(atualizados)_registrarAuditoria('padronizarProtocolosSequenciais',{protocolo:String(atualizados)+' registros'}, {ok:true},{papel:'sistema',ator:'migração autorizada'});
    var resumo={ok:true,total:plano.total,porAno:plano.porAno,atualizados:atualizados};
    Logger.log(JSON.stringify(resumo));
    return resumo;
  }finally{lock.releaseLock();}
}
// Mantido para não deixar o comando antigo atribuir números fora da sequência.
function migrarProtocolosEmBranco(executar){return padronizarProtocolosSequenciais(executar);}
function executarMigracaoProtocolosEmBranco(){
  if (PropertiesService.getScriptProperties().getProperty('MIGRACAO_PROTOCOLOS_AUTORIZADA') !== 'SIM') {
    throw new Error('Defina MIGRACAO_PROTOCOLOS_AUTORIZADA=SIM nas propriedades do script somente após fazer o backup e conferir a prévia.');
  }
  return padronizarProtocolosSequenciais(true);
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
    var aEmail = String(rows[i][1] || '').trim().toLowerCase();
    if ((cpfInput && cpfInput === cpf) || (email && email === aEmail)) {
      if (String(rows[i][4] || '').trim().toLowerCase() !== 'sim') return _err('Conta administrativa inativa.', 'INACTIVE');
      // Administradores não sofrem bloqueio por tentativas (rate limit / lockout desativado para adm)
      _resetRL(cpf);
      if (aEmail) _resetRL(aEmail);

      var hashSalvo = String(rows[i][3] || '').trim();
      if (!hashSalvo) return _err('Senha não cadastrada. Use "Meu Primeiro Acesso".', 'NO_PASSWORD');
      if (!_hashSenhaValida(hashSalvo, aEmail, cpf, senha)) {
        return _err('Credenciais incorretas.', 'INVALID_CREDENTIALS');
      }

      _resetRL(cpf);
      if (aEmail) _resetRL(aEmail);
      var token = _novoToken();
      CacheService.getScriptCache().put('ATK_' + token, JSON.stringify({cpf:cpf, email:aEmail}), CFG.TOKEN_HORAS * 3600);
      return {ok:true,papel:'admin',token:token,admin:{nome:_san(rows[i][2] || 'Administrador'),email:_san(rows[i][1]),permissoes:_permissoesAdmin(rows[i][5])}};
    }
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
    var rowCpf = _normCPF(String(rows[i][0] || ''));
    var rowEmail = String(rows[i][1] || '').trim().toLowerCase();
    var matchCpf = sessao.cpf && rowCpf && rowCpf === sessao.cpf;
    var matchEmail = sessao.email && rowEmail && rowEmail === sessao.email.toLowerCase();
    if ((matchCpf || matchEmail || (!sessao.email && !sessao.cpf && rowCpf === sessao.cpf)) && String(rows[i][4] || '').trim().toLowerCase() === 'sim') {
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
function _dataBr(valor) {
  var iso = _dataIsoAdmin(valor);
  if (!iso) return String(valor || '');
  var p = iso.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
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
  var protocoloConsulta=_resolverProtocoloConsulta(p.protocolo);
  var lock=LockService.getScriptLock();
  if (!lock.tryLock(30000)) return _err('Sistema ocupado. Tente novamente.', 'BUSY');
  try {
    var sheet=_aba(CFG.ABA_RESPOSTAS), rows=sheet.getDataRange().getValues();
    for (var i=1;i<rows.length;i++) {
      if (_referenciaSolicitacao(rows[i],i)!==protocoloConsulta || !p.protocolo) continue;
      var status=String(rows[i][18]||'').trim().toLowerCase();
      if (p.decisao==='Cancelado') {
        if (['pendente','confirmado','aguardando auxiliares'].indexOf(status)===-1) return _err('Esta solicitação já foi encerrada e não pode ser cancelada.', 'INVALID_STATUS');
      } else if (['pendente','aguardando auxiliares'].indexOf(status)===-1) {
        return _err('Somente solicitações pendentes ou aguardando auxiliares podem receber esta decisão.', 'INVALID_STATUS');
      }
      var pendenciaAux = (status === 'aguardando auxiliares');
      sheet.getRange(i+1,19).setValue(p.decisao);
      var textoMotivo = _san(motivo);
      if (p.decisao === 'Confirmado' && pendenciaAux && !textoMotivo) {
        textoMotivo = 'Autorizado pelo administrador com auxiliares pendentes';
      }
      sheet.getRange(i+1,20).setValue(p.decisao==='Confirmado'&&!pendenciaAux?'':_textoSeguroPlanilha(textoMotivo));
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
function _ticketValido(ticket, identificador, finalidade){
  if (!ticket || !/^[a-f0-9]{64}$/i.test(String(ticket))) return false;
  var raw=CacheService.getScriptCache().get('PASS_'+ticket);
  if (!raw) return false;
  try {
    var dados=JSON.parse(raw);
    var idOk = true;
    if (identificador) {
      var idLimpo = String(identificador).toLowerCase().replace(/[.\-\s]/g,'');
      var idEmail = String(dados.email || '').toLowerCase().replace(/[.\-\s]/g,'');
      var idCpf = String(dados.cpf || '').toLowerCase().replace(/[.\-\s]/g,'');
      idOk = (idLimpo === idEmail || idLimpo === idCpf || idLimpo === String(dados.identificador || '').toLowerCase());
    }
    return idOk && dados.finalidade===finalidade;
  } catch(e){ return false; }
}
function _consumirTicket(ticket, identificador, finalidade){
  if (!_ticketValido(ticket,identificador,finalidade)) return false;
  CacheService.getScriptCache().remove('PASS_'+ticket);
  return true;
}
function _checkRateLimit(chave){
  var c = String(chave || '').replace(/[^a-zA-Z0-9_@.-]/g, '');
  var cache=CacheService.getScriptCache();
  if(cache.get('LOCK_'+c)){return{bloqueado:true,msg:'Conta bloqueada temporariamente por excesso de tentativas.'};}
  return{bloqueado:false};
}
function _incrementaRL(chave){
  var c = String(chave || '').replace(/[^a-zA-Z0-9_@.-]/g, '');
  var cache=CacheService.getScriptCache();var key='RL_'+c;var cnt=parseInt(cache.get(key)||'0',10)+1;var exp=CFG.LOCKOUT_MIN*60;if(cnt>=CFG.MAX_TENTATIVAS){cache.put('LOCK_'+c,'1',exp);cache.remove(key);}else{cache.put(key,String(cnt),exp);}
}
function _tentativasRestantes(chave){
  var c = String(chave || '').replace(/[^a-zA-Z0-9_@.-]/g, '');
  return Math.max(0,CFG.MAX_TENTATIVAS-parseInt(CacheService.getScriptCache().get('RL_'+c)||'0',10));
}
function _resetRL(chave){
  var c = String(chave || '').replace(/[^a-zA-Z0-9_@.-]/g, '');
  var cache=CacheService.getScriptCache();cache.remove('RL_'+c);cache.remove('LOCK_'+c);
}

// ─────────────────────────────────────────────────────────────
// ATUALIZAR PERFIL DO MONITOR
// ─────────────────────────────────────────────────────────────
function _atualizarPerfil(p) {
  var sessao = _validaToken(p.token);
  if (!sessao) return _err('Sessão expirada.', 'UNAUTHORIZED');
  if (sessao.adminToken) return _err('O perfil só pode ser alterado pelo próprio monitor.', 'FORBIDDEN');

  var nome = _san(p.nome || '');
  var cpf = p.cpf ? _normCPF(p.cpf) : '';
  var rg = _san(p.rg || '');
  var telefone = _san(p.telefone || '');
  var email = _san(p.email || '').toLowerCase();
  var cidade = _localidadePadronizada(p.cidade, false);
  var bairro = _san(p.bairro || '');
  var senha = p.senha; // Opcional
  if (senha) {
    if (senha.length < 8 || !/[A-Za-z]/.test(senha) || !/[0-9]/.test(senha)) {
      return _err('A nova senha deve ter ao menos 8 caracteres, com letras e números.', 'PASSWORD_INVALID');
    }
    if (!_ticketValido(p.ticketSenha, sessao.email || sessao.cpf, 'perfil')) {
      return _err('Confirme a troca de senha com o código enviado ao e-mail cadastrado.', 'UNAUTHORIZED');
    }
  }

  if (!nome) return _err('Nome é obrigatório.');
  if (cpf && (cpf.length !== 11 || !_validaCPFAlg(cpf))) return _err('CPF informado é inválido.');
  if (!telefone) return _err('Telefone é obrigatório.');
  if (!email) return _err('E-mail é obrigatório.');
  if (!cidade) return _err('Informe a cidade no formato Cidade/UF (ex.: São Sebastião/SP).', 'CITY_INVALID');
  if (!bairro) return _err('Bairro é obrigatório.');

  var sheet = _aba(CFG.ABA_MONITORES);
  var rows = sheet.getDataRange().getValues();
  var monitorIndex = -1;

  for (var i = 1; i < rows.length; i++) {
    var rEmail = _san(String(rows[i][MC.EMAIL - 1] || '')).toLowerCase();
    var rCpf = _normCPF(String(rows[i][MC.CPF - 1] || ''));
    if ((sessao.email && rEmail === sessao.email.toLowerCase()) || (sessao.cpf && rCpf === sessao.cpf)) {
      monitorIndex = i;
      break;
    }
  }

  if (monitorIndex === -1) return _err('Monitor não localizado na base.');

  var rowNum = monitorIndex + 1;
  if (senha && !_consumirTicket(p.ticketSenha, sessao.email || sessao.cpf, 'perfil')) {
    return _err('Confirmação expirada. Solicite outro código.', 'UNAUTHORIZED');
  }
  if (rg) sheet.getRange(rowNum, MC.RG).setValue(rg);
  if (cpf && cpf !== '00000000000') sheet.getRange(rowNum, MC.CPF).setValue(_maskCPF(cpf));
  sheet.getRange(rowNum, MC.NOME).setValue(nome);
  sheet.getRange(rowNum, MC.TELEFONE).setValue(telefone);
  sheet.getRange(rowNum, MC.EMAIL).setValue(email);
  sheet.getRange(rowNum, MC.CIDADE).setValue(cidade);
  sheet.getRange(rowNum, MC.BAIRRO).setValue(bairro);

  if (senha && senha.trim().length >= 8) {
    var novoHash = _hashSenha(email, senha);
    sheet.getRange(rowNum, MC.SENHA_HASH).setValue(novoHash);
  }

  return {
    ok: true,
    msg: 'Dados atualizados com sucesso!',
    monitor: {
      nome: nome,
      cpf: cpf && cpf !== '00000000000' ? _maskCPF(cpf) : '',
      telefone: telefone,
      email: email,
      rg: rg,
      cidade: cidade,
      bairro: bairro
    }
  };
}

function _reenviarConviteAuxiliar(p) {
  var monitor = _validaToken(p.token);
  var admin = _adminTem(p.token, 'verSolicitacoes') || _adminTem(p.token, 'decidir');
  if (!monitor && !admin) return _err('Não autorizado.', 'UNAUTHORIZED');
  var protocolo = String(p.protocolo || '').trim();
  if (!protocolo) return _err('Protocolo não informado.', 'PROTOCOL_REQUIRED');
  
  var protocoloConsulta = _resolverProtocoloConsulta(protocolo);
  var sheet = _aba(CFG.ABA_RESPOSTAS);
  var rows = sheet.getDataRange().getValues();
  var monSheet = _aba(CFG.ABA_MONITORES);
  var monRows = monSheet.getDataRange().getValues();
  
  for (var i = 1; i < rows.length; i++) {
    if (_referenciaSolicitacao(rows[i], i) !== protocoloConsulta) continue;
    var row = rows[i];
    var cpfPrincipal = _normCPF(String(row[RF.CPF - 1] || ''));
    var emailPrincipal = String(row[1] || '').trim().toLowerCase();
    
    if (!admin) {
      var isPrincipal = (monitor.cpf && monitor.cpf === cpfPrincipal) || (monitor.email && monitor.email.toLowerCase() === emailPrincipal);
      if (!isPrincipal) return _err('Apenas o monitor responsável ou a administração podem reenviar convites.', 'FORBIDDEN');
    }
    
    var status = String(row[18] || '').trim();
    if (status !== 'Aguardando Auxiliares') {
      return _err('Esta solicitação não está mais aguardando auxiliares (status: ' + status + ').', 'INVALID_STATUS');
    }
    
    var aceites = {};
    try { aceites = JSON.parse(String(row[21] || '{}')); } catch(e) {}
    var auxCpfs = String(row[22] || '').split(',').map(function(c){ return _normCPF(c); }).filter(Boolean);
    
    var agNome = _san(row[7] || '');
    var agCnpj = _san(row[8] || '');
    var monInfo = {
      quem: _san(row[2] || ''),
      email: _san(row[1] || ''),
      telefone: _san(row[3] || ''),
      data: _dataBr(row[9]),
      horario: _horaAdmin(row[10]),
      tamanho: Number(row[4]) || 0,
      origem: _san(row[11] || ''),
      tipoGrupo: _san(row[12] || ''),
      faixaEtaria: _san(row[13] || '—'),
      hospedagem: _san(row[14] || ''),
      diasSS: row[16] ? (row[16] + ' dia(s)') : '',
      agencia: agNome ? (agNome + (agCnpj ? (' · CNPJ ' + agCnpj) : '')) : '',
      outrosAuxiliares: _san(row[17] || ''),
      protocolo: protocolo
    };
    
    var enviados = 0;
    for (var m = 1; m < monRows.length; m++) {
      var mCpf = _normCPF(String(monRows[m][MC.CPF - 1] || ''));
      var mNome = String(monRows[m][MC.NOME - 1] || '').trim();
      var estaNoAgendamento = (auxCpfs.indexOf(mCpf) !== -1) || (aceites[mNome] !== undefined);
      if (!estaNoAgendamento) continue;
      
      if (p.cpfAuxiliar && _normCPF(p.cpfAuxiliar) !== mCpf) continue;
      
      var statusAceite = aceites[mNome] || 'Pendente';
      if (statusAceite === 'Pendente') {
        _notificarMonitorAuxiliarEmail(monRows[m], monInfo);
        enviados++;
      }
    }
    
    if (enviados === 0) {
      return _err('Nenhum monitor auxiliar pendente para receber o convite.', 'NO_PENDING_AUX');
    }
    
    _registrarAuditoria('reenviarConviteAuxiliar', { protocolo: protocolo, enviados: enviados }, { ok: true }, { papel: admin ? 'admin' : 'monitor' });
    return { ok: true, enviados: enviados, msg: 'Convite reenviado com sucesso por e-mail para ' + enviados + ' monitor(es) auxiliar(es).' };
  }
  return _err('Solicitação não encontrada.', 'NOT_FOUND');
}

function _adminObterConfigEmail(p) {
  if (!_adminTem(p.token, 'verSolicitacoes') && !_adminTem(p.token, 'decidir') && !_adminTem(p.token, 'gerirAdmins')) {
    return _err('Sem permissão para consultar configurações de e-mail.', 'FORBIDDEN');
  }
  var props = PropertiesService.getScriptProperties();
  return {
    ok: true,
    rodapeArteUrl: String(props.getProperty('EMAIL_RODAPE_ARTE_URL') || ''),
    rodapeTexto: String(props.getProperty('EMAIL_RODAPE_TEXTO') || ''),
    portalUrl: String(props.getProperty('PORTAL_URL') || '')
  };
}

function _adminSalvarConfigEmail(p) {
  if (!_adminTem(p.token, 'decidir') && !_adminTem(p.token, 'gerirAdmins')) {
    return _err('Sem permissão para alterar configurações de e-mail.', 'FORBIDDEN');
  }
  var props = PropertiesService.getScriptProperties();
  var arteUrl = String(p.rodapeArteUrl || '').trim();
  var texto = String(p.rodapeTexto || '').trim();
  var portal = String(p.portalUrl || '').trim();
  
  if (arteUrl && !/^https?:\/\//i.test(arteUrl)) {
    return _err('A URL da arte deve começar com http:// ou https://', 'INVALID_URL');
  }
  if (portal && !/^https?:\/\//i.test(portal)) {
    return _err('A URL do portal deve começar com http:// ou https://', 'INVALID_URL');
  }
  
  if (arteUrl) props.setProperty('EMAIL_RODAPE_ARTE_URL', arteUrl);
  else props.deleteProperty('EMAIL_RODAPE_ARTE_URL');
  
  if (texto) props.setProperty('EMAIL_RODAPE_TEXTO', texto);
  else props.deleteProperty('EMAIL_RODAPE_TEXTO');
  
  if (portal) props.setProperty('PORTAL_URL', portal);
  else props.deleteProperty('PORTAL_URL');
  
  _registrarAuditoria('adminSalvarConfigEmail', { arteUrl: arteUrl ? 'Sim' : 'Não', texto: texto ? 'Sim' : 'Não' }, { ok: true }, { papel: 'admin' });
  return { ok: true, msg: 'Configurações de e-mail e assinatura salvas com sucesso!' };
}

function _adminTestarEmail(p) {
  var admin = _adminTem(p.token, 'decidir') || _adminTem(p.token, 'gerirAdmins') || _adminTem(p.token, 'verSolicitacoes');
  if (!admin) return _err('Sem permissão para testar e-mail.', 'FORBIDDEN');
  var destino = String(p.emailDestino || admin.email || '').trim().toLowerCase();
  if (!destino) return _err('Informe o e-mail de destino para teste ou cadastre um e-mail no seu usuário administrador.', 'EMAIL_REQUIRED');
  
  var props = PropertiesService.getScriptProperties();
  var rodapeArteUrl = String(p.rodapeArteUrl !== undefined ? p.rodapeArteUrl : (props.getProperty('EMAIL_RODAPE_ARTE_URL') || '')).trim();
  var rodapeTexto = String(p.rodapeTexto !== undefined ? p.rodapeTexto : (props.getProperty('EMAIL_RODAPE_TEXTO') || '')).trim();
  
  var resultado = _enviarEmailPortal({
    to: destino,
    subject: '[Teste] Assinatura e Notificação do Portal de Agendamento',
    corpoTexto: 'Olá ' + (admin.nome || 'Administrador') + ',\n\nEste é um e-mail de teste para verificar a visualização da arte de assinatura do rodapé e a formatação anti-spam do sistema.\n\nSecretaria Municipal de Turismo de São Sebastião/SP',
    corpoHtml: '<p>Olá <strong>' + _escHtml(admin.nome || 'Administrador') + '</strong>,</p>' +
      '<p>Este é um <strong>e-mail de teste</strong> enviado pelo painel administrativo para verificar a visualização da assinatura de rodapé, o layout institucional e a pontuação anti-spam na sua caixa de entrada.</p>' +
      '<p style="color:#2d6a4f;font-weight:600;">Se você está vendo esta mensagem com o rodapé e formatação corretos, a configuração está pronta e funcionando perfeitamente!</p>',
    rodapeArteUrl: rodapeArteUrl,
    rodapeTexto: rodapeTexto
  });
  
  if (!resultado.ok) return resultado;
  return { ok: true, msg: 'E-mail de teste enviado com sucesso para ' + destino + '!' };
}
