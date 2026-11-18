/**
 * Dash TSS — Lembretes de data acordo (diário) e resumo de itens parados (toda segunda)
 */

/**
 * Os gatilhos rodam como quem os instalou — e os e-mails saem dessa conta.
 * Por isso a TL deve instalar os gatilhos com a conta dela. O dono fica registrado;
 * gatilhos de outra pessoa param de agir sozinhos (evita e-mail duplicado).
 */
function donoGatilhos_() { return PropertiesService.getScriptProperties().getProperty('GATILHOS_DONO') || ''; }
function euSouDono_(rotina) {
  var dono = donoGatilhos_().toLowerCase();
  var eu = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (dono && eu && dono !== eu) {
    log_('Aviso', rotina + ' ignorada: gatilho de ' + eu + ', mas os gatilhos agora são de ' + dono + '. Use "🧹 Remover meus gatilhos" na conta ' + eu + '.');
    return false;
  }
  return true;
}

function removerMeusGatilhos() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['rotinaDiaria', 'sincronizarAgendado', 'extracaoD1'].indexOf(t.getHandlerFunction()) >= 0) { ScriptApp.deleteTrigger(t); n++; }
  });
  var eu = Session.getEffectiveUser().getEmail();
  if (donoGatilhos_().toLowerCase() === String(eu).toLowerCase()) PropertiesService.getScriptProperties().deleteProperty('GATILHOS_DONO');
  log_('Gatilhos', n + ' gatilho(s) removido(s) da conta ' + eu);
  return n + ' gatilho(s) removido(s) da sua conta (' + eu + ').';
}

function instalarGatilhos() {
  var cfg = getConfig();
  var eu = Session.getEffectiveUser().getEmail();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['rotinaDiaria', 'sincronizarAgendado', 'extracaoD1'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('extracaoD1').timeBased().everyDays(1).atHour(1).inTimezone(TZ).create();
  ScriptApp.newTrigger('rotinaDiaria').timeBased().everyDays(1).atHour(cfg.horaAlertas).inTimezone(TZ).create();
  ScriptApp.newTrigger('sincronizarAgendado').timeBased().everyHours(2).create();
  var anterior = donoGatilhos_();
  PropertiesService.getScriptProperties().setProperty('GATILHOS_DONO', eu);
  log_('Gatilhos', 'Instalados por ' + eu + ' (e-mails sairão desta conta): extração D-1 à 1h, rotina diária às ' + cfg.horaAlertas + 'h e sincronização a cada 2h' +
    (anterior && anterior.toLowerCase() !== String(eu).toLowerCase() ? '. Os gatilhos de ' + anterior + ' ficam inativos.' : ''));
  var aviso = cfg.emailTL && String(eu).toLowerCase() !== cfg.emailTL.toLowerCase()
    ? '\n\n⚠️ Os e-mails vão sair de ' + eu + '. Para saírem da TL (' + cfg.emailTL + '), ela precisa instalar os gatilhos com a conta dela.' : '\n\n✉️ Os e-mails vão sair de ' + eu + '.';
  return 'Gatilhos instalados: extração D-1 todo dia à 1h, alertas às ' + cfg.horaAlertas + 'h (resumo às segundas) e atualização do "Agora" a cada 2h.' + aviso;
}

function sincronizarAgendado() {
  if (!euSouDono_('Sincronização agendada')) return;
  var h = Number(Utilities.formatDate(new Date(), TZ, 'H'));
  var dow = Number(Utilities.formatDate(new Date(), TZ, 'u')); // 1=seg ... 7=dom
  if (dow > 5 || h < 7 || h > 20) return;
  try { sincronizarJira(); } catch (e) { log_('Erro', 'Sync agendado: ' + e.message); }
}

/** Executada todo dia: sincroniza, envia lembretes (dias úteis) e o resumo às segundas. */
function rotinaDiaria() {
  if (!euSouDono_('Rotina diária')) return;
  var cfg = getConfig();
  var dow = Number(Utilities.formatDate(new Date(), TZ, 'u'));
  if (dow > 5) return;
  if (cfg.teamIdsTempo && cfg.timeTempoDiario) { try { sincronizarTimeTempo(); } catch (e) { log_('Erro', 'Time do Tempo: ' + e.message); } }
  try { sincronizarJira(); } catch (e) { log_('Erro', 'Sync na rotina diária: ' + e.message); }
  if (cfg.lembreteAtivo) { try { enviarLembretesDataAcordo(); } catch (e) { log_('Erro', 'Lembretes: ' + e.message); } }
  if (cfg.destD1.length) { try { enviarResumoDiarioD1(); } catch (e) { log_('Erro', 'Resumo diário D-1: ' + e.message); } }
  if (dow === 1 && cfg.resumoSegundaAtivo) { try { enviarResumoSegunda(); } catch (e) { log_('Erro', 'Resumo segunda: ' + e.message); } }
}

/** Lembrete para cada dev com issues vencendo em até N dias ou já vencidas. */
function enviarLembretesDataAcordo() {
  var d = montarDados_();
  var cfg = d.cfg;
  var alvo = d.issues.filter(function (x) {
    return x.aberta && x.acordo && x.diasParaAcordo !== null && x.diasParaAcordo <= cfg.diasLembrete;
  }).sort(function (a, b) { return a.diasParaAcordo - b.diasParaAcordo; });
  if (!alvo.length) { log_('Lembrete', 'Nenhuma issue perto da data acordo'); return 'Nenhuma issue perto da data acordo.'; }

  var porDev = {}, semEmail = [];
  alvo.forEach(function (x) {
    if (x.email) (porDev[x.email] = porDev[x.email] || []).push(x);
    else semEmail.push(x);
  });

  var enviados = 0;
  Object.keys(porDev).forEach(function (email) {
    var itens = porDev[email];
    var vencidas = itens.filter(function (x) { return x.diasParaAcordo < 0; }).length;
    var assunto = (vencidas ? '🔴 ' : '⏰ ') + 'Data acordo: ' + itens.length + ' issue(s) precisam de atenção';
    var html = emailBase_('⏰ Lembrete de data acordo',
      'Olá, ' + itens[0].dev + '! Estas issues estão chegando (ou já passaram) da data acordo:',
      tabelaIssuesHtml_(itens, cfg, 'acordo'), cfg);
    var opt = remetente_(cfg, { htmlBody: html });
    if (cfg.copiarTL && cfg.destCopia.length) opt.cc = cfg.destCopia.join(',');
    MailApp.sendEmail(email, assunto, '', opt);
    enviados++;
  });

  var avisar = cfg.destCopia.length ? cfg.destCopia : cfg.destResumo;
  if (semEmail.length && avisar.length) {
    MailApp.sendEmail(avisar.join(','), '⏰ Data acordo — ' + semEmail.length + ' issue(s) de devs sem e-mail cadastrado', '', remetente_(cfg, {
      htmlBody: emailBase_('⏰ Data acordo — devs sem e-mail',
        'Cadastre o e-mail desses devs no bloco 👥 Time da configuração para eles receberem direto.',
        tabelaIssuesHtml_(semEmail, cfg, 'acordo'), cfg)
    }));
  }
  enviarChat_(cfg, '*⏰ Data acordo*: ' + alvo.length + ' issue(s) vencendo em até ' + cfg.diasLembrete +
    ' dia(s) ou vencidas.\n' + alvo.slice(0, 10).map(function (x) {
      return '• ' + x.k + ' — ' + x.dev + ' — ' + textoPrazo_(x.diasParaAcordo);
    }).join('\n'));
  var msg = 'Lembretes enviados para ' + enviados + ' dev(s); ' + alvo.length + ' issue(s).';
  log_('Lembrete', msg);
  return msg;
}

/** Resumo de segunda-feira para a TL: parados, vencidos, próximos 7 dias e entregas da semana anterior. */
function enviarResumoSegunda(paraTeste) {
  var d = montarDados_();
  var cfg = d.cfg;
  var para = paraTeste ? [paraTeste] : cfg.destResumo;
  if (!para.length) throw new Error('Cadastre ao menos um destinatário com "Resumo de segunda = SIM" (bloco 📬 Destinatários).');
  var hoje = hoje_();
  var abertas = d.issues.filter(function (x) { return x.aberta; });
  var parados = abertas.filter(function (x) { return x.diasParado >= cfg.diasParado || x.impedido; })
    .sort(function (a, b) { return (b.impedido ? 1 : 0) - (a.impedido ? 1 : 0) || b.diasParado - a.diasParado; }).slice(0, 20);
  var vencidas = abertas.filter(function (x) { return x.diasParaAcordo !== null && x.diasParaAcordo < 0; })
    .sort(function (a, b) { return a.diasParaAcordo - b.diasParaAcordo; });
  var proximas = abertas.filter(function (x) { return x.diasParaAcordo !== null && x.diasParaAcordo >= 0 && x.diasParaAcordo <= 7; })
    .sort(function (a, b) { return a.diasParaAcordo - b.diasParaAcordo; });
  var iniSemana = new Date(hoje); iniSemana.setDate(iniSemana.getDate() - 7);
  var entregues = d.issues.filter(function (x) { return x.conclusao && x.conclusao >= iniSemana && x.conclusao < hoje; });
  var noPrazo = entregues.filter(function (x) { return !x.atrasou; }).length;

  var cards = '<table role="presentation" width="100%" cellspacing="8"><tr>' +
    cardEmail_('Parados ≥ ' + cfg.diasParado + 'd', parados.length, '#EF4444') +
    cardEmail_('Vencidas', vencidas.length, '#F97316') +
    cardEmail_('Vencem em 7 dias', proximas.length, '#F59E0B') +
    cardEmail_('Entregues na semana', entregues.length, '#10B981') +
    cardEmail_('% no prazo', entregues.length ? Math.round(noPrazo / entregues.length * 100) + '%' : '—', '#8B5CF6') +
    '</tr></table>';

  var corpo = cards +
    secaoEmail_('🧊 Principais itens parados', parados, cfg, 'parado') +
    secaoEmail_('🔴 Data acordo vencida', vencidas, cfg, 'acordo') +
    secaoEmail_('📅 Vencem nos próximos 7 dias', proximas, cfg, 'acordo');

  MailApp.sendEmail(para.join(','), (paraTeste ? '[TESTE] ' : '') + '📊 Resumo de segunda — Time TSS (' + fmtBR_(hoje) + ')', '', remetente_(cfg, {
    htmlBody: emailBase_('📊 Resumo de segunda — Time TSS', 'Visão rápida do que precisa de atenção nesta semana.', corpo, cfg)
  }));
  if (paraTeste) return 'Resumo de teste enviado para ' + paraTeste;
  enviarChat_(cfg, '*📊 Resumo de segunda — Time TSS*\n🧊 Parados: ' + parados.length + ' | 🔴 Vencidas: ' + vencidas.length +
    ' | 📅 Vencem em 7d: ' + proximas.length + ' | ✅ Entregues semana: ' + entregues.length + '\n' +
    parados.slice(0, 8).map(function (x) { return '• ' + x.k + ' — ' + x.dev + ' — parado há ' + x.diasParado + 'd (' + x.status + ')'; }).join('\n'));
  log_('Resumo', 'Resumo de segunda enviado para ' + para.join(', '));
  return 'Resumo enviado para ' + para.join(', ');
}

/** Resumo diário do fechamento de ontem (D-1) para quem marcou "Resumo diário (D-1)". */
function enviarResumoDiarioD1(paraTeste) {
  var ontem = hoje_(); ontem.setDate(ontem.getDate() - 1);
  if (ontem.getDay() === 0) ontem.setDate(ontem.getDate() - 2); // segunda olha a sexta
  if (ontem.getDay() === 6) ontem.setDate(ontem.getDate() - 1);
  var d = montarDados_();
  var cfg = d.cfg;
  var para = paraTeste ? [paraTeste] : cfg.destD1;
  if (!para.length) throw new Error('Cadastre ao menos um destinatário com "Resumo diário (D-1) = SIM".');
  var abertas = d.issues.filter(function (x) { return x.aberta; });
  var entregues = d.issues.filter(function (x) { return x.conclusao && fmtISO_(x.conclusao) === fmtISO_(ontem); });
  var vencemHoje = abertas.filter(function (x) { return x.diasParaAcordo !== null && x.diasParaAcordo >= 0 && x.diasParaAcordo <= cfg.diasLembrete; })
    .sort(function (a, b) { return a.diasParaAcordo - b.diasParaAcordo; });
  var vencidas = abertas.filter(function (x) { return x.diasParaAcordo !== null && x.diasParaAcordo < 0; });
  var parados = abertas.filter(function (x) { return x.diasParado >= cfg.diasParado; }).sort(function (a, b) { return b.diasParado - a.diasParado; }).slice(0, 10);
  var noPrazo = entregues.filter(function (x) { return !x.atrasou; }).length;
  var cards = '<table role="presentation" width="100%" cellspacing="8"><tr>' +
    cardEmail_('Entregues em ' + fmtBR_(ontem).substring(0, 5), entregues.length, '#10B981') +
    cardEmail_('No prazo', entregues.length ? Math.round(noPrazo / entregues.length * 100) + '%' : '—', '#8B5CF6') +
    cardEmail_('Vencem em até ' + cfg.diasLembrete + 'd', vencemHoje.length, '#F59E0B') +
    cardEmail_('Vencidas', vencidas.length, '#EF4444') +
    cardEmail_('Em andamento', abertas.length, '#3B82F6') + '</tr></table>';
  var corpo = cards +
    secaoEmail_('✅ Entregues no dia', entregues, cfg, 'acordo') +
    secaoEmail_('⏰ Vencendo', vencemHoje, cfg, 'acordo') +
    secaoEmail_('🔴 Vencidas', vencidas, cfg, 'acordo') +
    secaoEmail_('🧊 Mais tempo parados', parados, cfg, 'parado');
  MailApp.sendEmail(para.join(','), (paraTeste ? '[TESTE] ' : '') + '📅 Fechamento D-1 — Time TSS (' + fmtBR_(ontem) + ')', '', remetente_(cfg, {
    htmlBody: emailBase_('📅 Fechamento D-1 — ' + fmtBR_(ontem), 'O que foi entregue ontem e o que pede atenção hoje.', corpo, cfg)
  }));
  log_('Resumo D-1', 'Enviado para ' + para.join(', '));
  return 'Resumo D-1 enviado para ' + para.join(', ');
}

/** Nome da TL como remetente e respostas indo para ela. */
function remetente_(cfg, opt) {
  var tl = (cfg.destinatarios || []).filter(function (d) { return d.ativo && /^tl$/i.test(d.papel); })[0];
  opt.name = (tl && tl.nome ? tl.nome + ' · ' : '') + 'Dash TSS';
  var resp = (tl && tl.email) || cfg.emailTL;
  if (resp) opt.replyTo = resp;
  return opt;
}

function textoPrazo_(n) {
  if (n === null) return 'sem data acordo';
  if (n < 0) return 'vencida há ' + (-n) + ' dia(s)';
  if (n === 0) return 'vence HOJE';
  return 'vence em ' + n + ' dia(s)';
}

function emailBase_(titulo, sub, corpo, cfg) {
  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  return '<div style="font-family:Segoe UI,Roboto,Arial,sans-serif;background:#F5F3FF;padding:24px">' +
    '<div style="max-width:860px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 18px rgba(76,29,149,.12)">' +
    '<div style="background:linear-gradient(135deg,#7C3AED,#DB2777,#F59E0B);padding:22px 26px;color:#fff">' +
    '<div style="font-size:22px;font-weight:700">' + titulo + '</div>' +
    '<div style="opacity:.92;margin-top:4px">' + sub + '</div></div>' +
    '<div style="padding:18px 22px">' + corpo + '</div>' +
    (url ? '<div style="padding:0 22px 22px"><a href="' + url + '" style="background:#7C3AED;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:600">Abrir o Dash TSS</a></div>' : '') +
    '<div style="padding:12px 22px;background:#FAFAFA;color:#9CA3AF;font-size:12px">Enviado automaticamente pelo Dash TSS</div></div></div>';
}

function cardEmail_(rotulo, valor, cor) {
  return '<td style="background:' + cor + ';color:#fff;border-radius:12px;padding:12px;text-align:center">' +
    '<div style="font-size:24px;font-weight:800">' + valor + '</div><div style="font-size:12px;opacity:.95">' + rotulo + '</div></td>';
}

function secaoEmail_(titulo, itens, cfg, modo) {
  if (!itens.length) return '<h3 style="color:#4C1D95;margin:18px 0 6px">' + titulo + '</h3><div style="color:#10B981">Nada aqui 🎉</div>';
  return '<h3 style="color:#4C1D95;margin:18px 0 6px">' + titulo + ' (' + itens.length + ')</h3>' + tabelaIssuesHtml_(itens, cfg, modo);
}

function esc_(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function tabelaIssuesHtml_(itens, cfg, modo) {
  var linhas = itens.map(function (x, i) {
    var badge, cor;
    if (modo === 'parado') { badge = x.diasParado + 'd parado'; cor = x.diasParado >= cfg.diasParado * 2 ? '#EF4444' : '#F59E0B'; }
    else { badge = textoPrazo_(x.diasParaAcordo); cor = x.diasParaAcordo < 0 ? '#EF4444' : (x.diasParaAcordo === 0 ? '#F97316' : '#F59E0B'); }
    return '<tr style="background:' + (i % 2 ? '#FAF5FF' : '#fff') + '">' +
      '<td style="padding:8px"><a href="' + x.link + '" style="color:#7C3AED;font-weight:700;text-decoration:none">' + x.k + '</a></td>' +
      '<td style="padding:8px">' + esc_(x.resumo).substring(0, 90) +
        (x.aberta && x.impedido ? '<div style="margin-top:4px;font-size:12px;color:#7F1D1D;background:#FEF2F2;border-left:3px solid #DC2626;padding:4px 6px">🚩 Impedida' + (x.comentarioImpedimento ? ': ' + esc_(x.comentarioImpedimento).substring(0, 200) : '') + '</div>' : '') + '</td>' +
      '<td style="padding:8px">' + esc_(x.dev) + '</td>' +
      '<td style="padding:8px">' + esc_(x.status) + '</td>' +
      '<td style="padding:8px">' + (x.acordo ? fmtBR_(x.acordo) : '—') + '</td>' +
      '<td style="padding:8px"><span style="background:' + cor + ';color:#fff;border-radius:999px;padding:3px 10px;font-size:12px;white-space:nowrap">' + badge + '</span></td></tr>';
  }).join('');
  return '<table width="100%" cellspacing="0" style="border-collapse:collapse;font-size:13px">' +
    '<tr style="background:#4C1D95;color:#fff;text-align:left"><th style="padding:8px">Issue</th><th style="padding:8px">Resumo</th><th style="padding:8px">Dev</th><th style="padding:8px">Status</th><th style="padding:8px">Data acordo</th><th style="padding:8px">Situação</th></tr>' +
    linhas + '</table>';
}

function enviarChat_(cfg, texto) {
  if (!cfg.webhookChat) return;
  try {
    UrlFetchApp.fetch(cfg.webhookChat, {
      method: 'post', contentType: 'application/json; charset=UTF-8',
      payload: JSON.stringify({ text: texto }), muteHttpExceptions: true
    });
  } catch (e) { log_('Erro', 'Google Chat: ' + e.message); }
}
