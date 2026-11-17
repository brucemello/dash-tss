/**
 * Dash TSS — Lembretes de data acordo (diário) e resumo de itens parados (toda segunda)
 */

function instalarGatilhos() {
  var cfg = getConfig();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['rotinaDiaria', 'sincronizarAgendado'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('rotinaDiaria').timeBased().everyDays(1).atHour(cfg.horaAlertas).inTimezone(TZ).create();
  ScriptApp.newTrigger('sincronizarAgendado').timeBased().everyHours(2).create();
  log_('Gatilhos', 'Instalados: rotina diária às ' + cfg.horaAlertas + 'h e sincronização a cada 2h');
  return 'Gatilhos instalados: alertas diários às ' + cfg.horaAlertas + 'h (resumo às segundas) e sincronização a cada 2h.';
}

function sincronizarAgendado() {
  var h = Number(Utilities.formatDate(new Date(), TZ, 'H'));
  var dow = Number(Utilities.formatDate(new Date(), TZ, 'u')); // 1=seg ... 7=dom
  if (dow > 5 || h < 7 || h > 20) return;
  try { sincronizarJira(); } catch (e) { log_('Erro', 'Sync agendado: ' + e.message); }
}

/** Executada todo dia: sincroniza, envia lembretes (dias úteis) e o resumo às segundas. */
function rotinaDiaria() {
  var cfg = getConfig();
  var dow = Number(Utilities.formatDate(new Date(), TZ, 'u'));
  if (dow > 5) return;
  try { sincronizarJira(); } catch (e) { log_('Erro', 'Sync na rotina diária: ' + e.message); }
  if (cfg.lembreteAtivo) { try { enviarLembretesDataAcordo(); } catch (e) { log_('Erro', 'Lembretes: ' + e.message); } }
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
    var opt = { htmlBody: html, name: 'Dash TSS' };
    if (cfg.copiarTL && cfg.emailTL) opt.cc = cfg.emailTL;
    MailApp.sendEmail(email, assunto, '', opt);
    enviados++;
  });

  if (semEmail.length && cfg.emailTL) {
    MailApp.sendEmail(cfg.emailTL, '⏰ Data acordo — ' + semEmail.length + ' issue(s) de devs sem e-mail cadastrado', '', {
      name: 'Dash TSS',
      htmlBody: emailBase_('⏰ Data acordo — devs sem e-mail',
        'Cadastre o e-mail desses devs no bloco 👥 Time da configuração para eles receberem direto.',
        tabelaIssuesHtml_(semEmail, cfg, 'acordo'), cfg)
    });
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
function enviarResumoSegunda() {
  var d = montarDados_();
  var cfg = d.cfg;
  if (!cfg.emailTL) throw new Error('Informe o "E-mail da TL" na aba ⚙️ Configuração.');
  var hoje = hoje_();
  var abertas = d.issues.filter(function (x) { return x.aberta; });
  var parados = abertas.filter(function (x) { return x.diasParado >= cfg.diasParado; })
    .sort(function (a, b) { return b.diasParado - a.diasParado; }).slice(0, 20);
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

  MailApp.sendEmail(cfg.emailTL, '📊 Resumo de segunda — Time TSS (' + fmtBR_(hoje) + ')', '', {
    name: 'Dash TSS', htmlBody: emailBase_('📊 Resumo de segunda — Time TSS', 'Visão rápida do que precisa de atenção nesta semana.', corpo, cfg)
  });
  enviarChat_(cfg, '*📊 Resumo de segunda — Time TSS*\n🧊 Parados: ' + parados.length + ' | 🔴 Vencidas: ' + vencidas.length +
    ' | 📅 Vencem em 7d: ' + proximas.length + ' | ✅ Entregues semana: ' + entregues.length + '\n' +
    parados.slice(0, 8).map(function (x) { return '• ' + x.k + ' — ' + x.dev + ' — parado há ' + x.diasParado + 'd (' + x.status + ')'; }).join('\n'));
  log_('Resumo', 'Resumo de segunda enviado para ' + cfg.emailTL);
  return 'Resumo enviado para ' + cfg.emailTL;
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
      '<td style="padding:8px">' + esc_(x.resumo).substring(0, 90) + '</td>' +
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
