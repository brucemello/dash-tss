/**
 * Dash TSS — Time a partir do Tempo Teams (mesmo padrão do projeto Capacidade Não Produtiva)
 *
 * Lê os membros ativos do(s) Team ID(s) do Tempo, busca no Jira o usuário, nome e e-mail
 * de cada um e atualiza o bloco 👥 Time da configuração.
 *  - quem está no time do Tempo → Ativo = SIM, nome/e-mail preenchidos
 *  - usuário que não existe ou está inativo no Jira (ex.: "LUNA") → removido da lista (quebraria a JQL)
 *  - quem está na planilha mas não no time do Tempo → mantido como está e listado no aviso
 */

function tempoTeamIds_(cfg) {
  return String(cfg.teamIdsTempo || '').split(/[^\d]+/).filter(Boolean);
}

/** Procura times do Tempo pelo nome (para a TL achar o Team ID). */
function procurarTimesTempo(filtro) {
  var lista = jiraGet_('/rest/tempo-teams/2/team');
  var arr = Array.isArray(lista) ? lista : (lista.results || []);
  var f = String(filtro || '').trim().toLowerCase();
  return arr.filter(function (t) { return !f || String(t.name || '').toLowerCase().indexOf(f) >= 0 || String(t.id) === f; })
    .slice(0, 30)
    .map(function (t) { return { id: t.id, nome: t.name, lider: (t.leadUser && (t.leadUser.displayname || t.leadUser.displayName || t.leadUser.name)) || t.lead || '' }; });
}

/** Membros ativos hoje de um time do Tempo. */
function membrosTempo_(teamId) {
  var json = jiraGet_('/rest/tempo-teams/2/team/' + teamId + '/member');
  var lista = Array.isArray(json) ? json : (json.results || []);
  var hoje = hoje_();
  return lista.map(function (item) {
    var m = item.member || item;
    var ms = item.membership || {};
    var ate = ms.dateTo ? parseJiraDate_(String(ms.dateTo).substring(0, 10)) : null;
    var de = ms.dateFrom ? parseJiraDate_(String(ms.dateFrom).substring(0, 10)) : null;
    var status = String(ms.status || 'active').toLowerCase();
    if ((m.type && m.type !== 'USER') || m.activeInJira === false || status === 'inactive') return null;
    if ((ate && ate < hoje) || (de && de > hoje)) return null;
    return {
      key: m.key || m.name || '',
      name: m.name || '',
      displayName: m.displayname || m.displayName || m.name || '',
      papel: (ms.role && ms.role.name) || ''
    };
  }).filter(function (m) { return m && (m.key || m.name); });
}

/** Busca usuário, nome e e-mail no Jira (em paralelo, por key ou username). */
function resolverUsuariosJira_(itens) {
  var cfg = getConfig();
  var tok = getJiraToken_();
  var out = {};
  for (var i = 0; i < itens.length; i += 40) {
    var lote = itens.slice(i, i + 40);
    var resp = UrlFetchApp.fetchAll(lote.map(function (it) {
      var q = it.porKey ? 'key=' + encodeURIComponent(it.id) : 'username=' + encodeURIComponent(it.id);
      return { url: cfg.jiraUrl + '/rest/api/2/user?' + q, headers: { Authorization: 'Bearer ' + tok, Accept: 'application/json' }, muteHttpExceptions: true };
    }));
    resp.forEach(function (r, j) {
      if (r.getResponseCode() !== 200) return;
      var u = JSON.parse(r.getContentText());
      out[String(lote[j].id).toLowerCase()] = {
        usuario: u.name || u.key || lote[j].id,
        nome: u.displayName || u.name || '',
        email: u.emailAddress || '',
        ativo: u.active !== false
      };
    });
  }
  return out;
}

function primeiroNome_(nomeCompleto) {
  var p = String(nomeCompleto || '').trim().split(/\s+/);
  return p.length > 1 ? p[0] + ' ' + p[p.length - 1] : (p[0] || '');
}

/** Atualiza o bloco 👥 Time com os membros do Tempo. */
function sincronizarTimeTempo() {
  var cfg = getConfig();
  var ids = tempoTeamIds_(cfg);
  if (!ids.length) throw new Error('Informe o "Team ID do Tempo" na configuração (dá para procurar pelo nome na aba Configuração do painel).');

  var membros = [];
  ids.forEach(function (id) { membros = membros.concat(membrosTempo_(id)); });
  // resolve todos (key do Tempo pode ser JIRAUSERxxxx)
  var resolvidos = resolverUsuariosJira_(membros.map(function (m) { return { id: m.key || m.name, porKey: !!m.key }; }));
  var doTime = {};
  membros.forEach(function (m) {
    var u = resolvidos[String(m.key || m.name).toLowerCase()];
    if (!u || !u.ativo) return;
    doTime[u.usuario.toLowerCase()] = { usuario: u.usuario, nome: primeiroNome_(u.nome || m.displayName), email: u.email, papel: m.papel };
  });

  var sh = ss_().getSheetByName(ABA.CONFIG) || criarConfiguracao();
  var linhas = lerBloco_(sh, BLOCOS.TIME);
  var naPlanilha = {};
  linhas.forEach(function (r) { naPlanilha[String(r[0]).trim().toLowerCase()] = true; });

  // valida no Jira quem está na planilha e não veio do Tempo
  var fora = linhas.map(function (r) { return String(r[0]).trim(); })
    .filter(function (u) { return u && !doTime[u.toLowerCase()]; });
  var existeJira = resolverUsuariosJira_(fora.map(function (u) { return { id: u, porKey: false }; }));

  var atualizados = 0, desativados = [], mantidos = [];
  var novas = linhas.map(function (r) {
    var u = String(r[0]).trim(), k = u.toLowerCase();
    var t = doTime[k];
    if (t) {
      var nome = String(r[1] || '').trim() && String(r[1]).trim().toLowerCase() !== k ? r[1] : t.nome;
      var email = String(r[2] || '').trim() || t.email;
      if (email !== r[2] || nome !== r[1] || r[3] !== 'SIM') atualizados++;
      return [t.usuario, nome, email, 'SIM'];
    }
    var j = existeJira[k];
    // não existe no Jira (nome antigo da planilha, ex.: "LUNA") ou usuário inativo → sai da lista
    if (!j || !j.ativo) { desativados.push(u); return null; }
    if (!String(r[2] || '').trim() && j.email) r[2] = j.email;
    if (sim_(r[3]) || String(r[3]).trim() === '') mantidos.push(u);
    return [r[0], r[1], r[2], r[3] || 'SIM'];
  });
  novas = novas.filter(Boolean);
  var adicionados = [];
  Object.keys(doTime).sort().forEach(function (k) {
    if (naPlanilha[k]) return;
    var t = doTime[k];
    novas.push([t.usuario, t.nome, t.email, 'SIM']);
    adicionados.push(t.usuario);
  });
  escreverBloco_(sh, BLOCOS.TIME, novas);
  var regraSN = SpreadsheetApp.newDataValidation().requireValueInList(['SIM', 'NÃO'], true).build();
  sh.getRange(HEADER_ROW + 1, BLOCOS.TIME.col + 3, 100, 1).setDataValidation(regraSN);

  var semEmail = novas.filter(function (r) { return r[3] === 'SIM' && !String(r[2] || '').trim(); }).map(function (r) { return r[0]; });
  var partes = [Object.keys(doTime).length + ' membro(s) no Tempo'];
  if (adicionados.length) partes.push('➕ adicionados: ' + adicionados.join(', '));
  if (atualizados) partes.push('✏️ atualizados: ' + atualizados);
  if (desativados.length) partes.push('🧹 removidos (não existem ou estão inativos no Jira): ' + desativados.join(', '));
  if (mantidos.length) partes.push('ℹ️ na planilha mas fora do time do Tempo (mantidos): ' + mantidos.join(', '));
  if (semEmail.length) partes.push('⚠️ sem e-mail: ' + semEmail.join(', '));
  var msg = partes.join(' | ');
  log_('Time Tempo', msg);
  return { ok: true, mensagem: msg, adicionados: adicionados, desativados: desativados, mantidos: mantidos, semEmail: semEmail };
}

/** Salva o(s) Team ID(s) vindos do painel. */
function salvarTeamIdTempo(ids) {
  var sh = ss_().getSheetByName(ABA.CONFIG) || criarConfiguracao();
  var linhas = lerBloco_(sh, BLOCOS.PARAMS);
  var limpo = String(ids || '').split(/[^\d]+/).filter(Boolean).join(', ');
  for (var i = 0; i < linhas.length; i++) {
    if (String(linhas[i][0]).trim() === 'Team ID do Tempo') {
      sh.getRange(HEADER_ROW + 1 + i, 2).setValue(limpo);
      return limpo;
    }
  }
  sh.getRange(HEADER_ROW + 1 + linhas.length, 1, 1, 2).setValues([['Team ID do Tempo', limpo]]);
  return limpo;
}
