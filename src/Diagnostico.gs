/**
 * Dash TSS — Diagnóstico: por que uma issue não aparece no painel?
 * Consulta cada issue no Jira e confere uma a uma as condições da JQL do Dash.
 * O resultado volta para o painel e é gravado na aba "Diagnóstico".
 */

function diagnosticarIssues(texto) {
  var chaves = [];
  String(texto || '').toUpperCase().replace(/[A-Z][A-Z0-9]+-\d+/g, function (k) { if (chaves.indexOf(k) < 0) chaves.push(k); return k; });
  if (!chaves.length) throw new Error('Informe ao menos uma issue (ex.: DSERTSS1-42090).');
  if (chaves.length > 50) chaves = chaves.slice(0, 50);

  var cfg = getConfig();
  var mapa = getMapaCampos_();
  var idDev = resolverCampo_(cfg.campoDev, mapa);
  var idSP = resolverCampo_(cfg.campoPontos, mapa);
  var extras = cfg.camposExtra.map(function (n) { return { nome: n, id: resolverCampo_(n, mapa) }; }).filter(function (e) { return e.id; });
  cfg.camposExtraValidos = extras.map(function (e) { return e.nome; });
  cfg.camposExtraJql = extras.map(nomeJqlCampo_);
  var idAcordo = resolverPrimeiro_([cfg.campoAcordo, 'customfield_11039', 'Data Acordo Entrega'], mapa) || 'duedate';
  var nomesCampos = {};
  Object.keys(mapa).forEach(function (k) { if (k.indexOf('__nome__') === 0) nomesCampos[k.substring(8)] = mapa[k]; });

  var timeAtivo = {};
  cfg.time.forEach(function (t) { timeAtivo[t.usuario.toLowerCase()] = t.nome; });
  var naBase = {};
  lerTabela_(ABA.BASE).forEach(function (r) { naBase[chaveIssue_(r['Issue'])] = String(r['Usuário Jira'] || ''); });

  var corte = hoje_(); corte = new Date(corte.getFullYear(), corte.getMonth() - (cfg.mesesHistorico - 1), 1);
  var projetosLower = cfg.projetos.map(function (p) { return p.toLowerCase(); });
  var jqlBase = montarJql_(cfg).replace(/\s+ORDER BY.*$/i, '');

  var resultados = chaves.map(function (k) {
    var r = { issue: k, entra: false, motivos: [], detalhes: {} };
    var it;
    try {
      it = jiraGet_('/rest/api/2/issue/' + encodeURIComponent(k), { fields: ['summary', 'project', 'issuetype', 'status', 'resolutiondate', 'assignee', 'parent', idDev, idSP, idAcordo].concat(extras.map(function (e) { return e.id; })).filter(Boolean).join(',') });
    } catch (e) {
      r.motivos.push('❌ Não foi possível ler a issue no Jira (' + String(e.message).substring(0, 120) + ')');
      return r;
    }
    var f = it.fields || {};
    var d = r.detalhes;
    d.resumo = f.summary || '';
    d.projeto = (f.project && (f.project.name + ' (' + f.project.key + ')')) || '';
    d.tipo = (f.issuetype && f.issuetype.name) || '';
    d.status = (f.status && f.status.name) || '';
    d.resolvido = f.resolutiondate ? fmtBR_(parseJiraDate_(f.resolutiondate)) : '(aberta)';
    d.responsavel = f.assignee ? (f.assignee.name + ' — ' + (f.assignee.displayName || '')) : '(vazio)';
    var dev = idDev ? f[idDev] : null;
    var devs = (Array.isArray(dev) ? dev : (dev ? [dev] : [])).map(function (u) { return u.name || u.key || u.value || String(u); });
    d.desenvolvedor = devs.length ? devs.join(', ') : '(vazio)';
    var outros = [];
    extras.forEach(function (e) {
      var v = f[e.id];
      (Array.isArray(v) ? v : (v ? [v] : [])).forEach(function (u) { outros.push({ u: u.name || u.key || u.value || String(u), papel: e.nome }); });
    });
    d.outrosPapeis = outros.map(function (o) { return o.papel + ': ' + o.u; }).join(', ');
    if (f.parent) d.pai = f.parent.key;
    var sp = idSP ? f[idSP] : null;
    d.storyPoints = (sp === null || sp === undefined || sp === '') ? '(vazio)' : sp;
    d.dataAcordo = f[idAcordo] ? fmtBR_(parseJiraDate_(valorCampo_(f[idAcordo]))) : '(vazio)';

    // 1) projeto
    var proj = f.project || {};
    if (projetosLower.indexOf(String(proj.name || '').toLowerCase()) < 0 && projetosLower.indexOf(String(proj.key || '').toLowerCase()) < 0)
      r.motivos.push('❌ Projeto "' + (proj.name || '?') + '" não está na lista de projetos da configuração');
    // 2) tipo
    if (f.issuetype && f.issuetype.subtask)
      r.motivos.push((f.issuetype.name === TIPO_ASSOCIADA ? 'ℹ️ É associada da ' + (d.pai || '?') + ' — aparece como informação extra (🔗), não nos indicadores' : '❌ É subtarefa ("' + f.issuetype.name + '") — subtarefas não entram no Dash'));
    // 3) story points
    if (d.storyPoints === '(vazio)') r.motivos.push('❌ Story Points vazio (a JQL exige "Story Points" >= 0)');
    else if (Number(sp) < 0) r.motivos.push('❌ Story Points negativo');
    // 4) período
    if (f.resolutiondate && soData_(parseJiraDate_(f.resolutiondate)) < corte)
      r.motivos.push('❌ Resolvida em ' + d.resolvido + ', antes do período buscado (desde ' + fmtBR_(corte) + ', "Meses de histórico" = ' + cfg.mesesHistorico + ')');
    // 5) desenvolvedor
    var pessoas = devs.concat(outros.map(function (o) { return o.u; }));
    if (!pessoas.length) r.motivos.push('❌ "' + [cfg.campoDev].concat(cfg.camposExtraValidos).join('" e "') + '" vazios no Jira' + (f.assignee ? ' (responsável é ' + f.assignee.name + ')' : ''));
    else if (cfg.filtrarTime && !pessoas.some(function (u) { return timeAtivo[String(u).toLowerCase()]; }))
      r.motivos.push('❌ Ninguém do 👥 Time atua nela (' + [d.desenvolvedor !== '(vazio)' ? cfg.campoDev + ': ' + d.desenvolvedor : '', d.outrosPapeis].filter(String).join(' · ') + ')');

    // confirmação pela própria JQL
    try {
      var tot = jiraGet_('/rest/api/2/search', { jql: '(' + jqlBase + ') AND key = ' + k, maxResults: 0 }).total;
      r.entra = tot > 0;
    } catch (e) { r.entra = r.motivos.length === 0; }

    if (r.entra) {
      if (naBase[k] !== undefined) r.motivos.push('✅ Entra na busca e já está na Base Jira (dev: ' + naBase[k] + ')');
      else r.motivos.push('✅ Entra na busca — ainda não estava na Base. Clique em ⚡ Atualizar agora.');
    } else if (!r.motivos.length) {
      r.motivos.push('❌ A JQL não retorna esta issue (verifique o "JQL adicional" da configuração)');
    }
    return r;
  });

  // grava na aba Diagnóstico
  var linhas = resultados.map(function (r) {
    var d = r.detalhes;
    return [new Date(), r.issue, r.entra ? 'SIM' : 'NÃO', r.motivos.join(' | '), (d.desenvolvedor || '') + (d.outrosPapeis ? ' · ' + d.outrosPapeis : ''), d.responsavel || '',
      d.storyPoints === undefined ? '' : String(d.storyPoints), d.tipo || '', d.status || '', d.resolvido || '', d.projeto || '', d.resumo || ''];
  });
  var sh = ss_().getSheetByName('Diagnóstico');
  if (!sh) {
    sh = ss_().insertSheet('Diagnóstico');
    sh.getRange(1, 1, 1, 12).setValues([['Quando', 'Issue', 'Entra no Dash?', 'Motivo', 'Desenvolvedor (Jira)', 'Responsável', 'Story Points', 'Tipo', 'Status', 'Resolvida', 'Projeto', 'Resumo']])
      .setFontWeight('bold').setBackground('#111827').setFontColor('#fff');
    sh.setFrozenRows(1);
  }
  if (linhas.length) sh.getRange(sh.getLastRow() + 1, 1, linhas.length, 12).setValues(linhas);
  log_('Diagnóstico', chaves.length + ' issue(s): ' + resultados.map(function (r) { return r.issue + (r.entra ? ' ✅' : ' ❌'); }).join(', '));
  return resultados;
}

function menuDiagnostico_() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('🔍 Diagnosticar issues', 'Cole as issues (uma por linha ou separadas por vírgula):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  try {
    var res = diagnosticarIssues(r.getResponseText());
    ui.alert('🔍 Diagnóstico', res.map(function (x) { return x.issue + ':\n  ' + x.motivos.join('\n  '); }).join('\n\n') + '\n\n(Detalhes na aba "Diagnóstico")', ui.ButtonSet.OK);
  } catch (e) { ui.alert('🔍 Diagnóstico', '❌ ' + e.message, ui.ButtonSet.OK); }
}
