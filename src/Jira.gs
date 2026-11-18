/**
 * Dash TSS — Cliente Jira (Server/Data Center, API v2, Bearer PAT)
 * O token fica em Propriedades do Script: JIRA_TOKEN (menu → Definir token do Jira).
 */

function getJiraToken_() {
  var t = PropertiesService.getScriptProperties().getProperty('JIRA_TOKEN');
  if (!t) throw new Error('Token do Jira não configurado. Use o menu 📊 Dash TSS → 🔑 Definir token do Jira.');
  return t;
}

function definirTokenJira() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('🔑 Token do Jira',
    'Cole seu Personal Access Token do Jira (Perfil → Personal Access Tokens).\nEle fica guardado nas propriedades do script, não na planilha.',
    ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var tok = r.getResponseText().trim();
  if (!tok) return;
  PropertiesService.getScriptProperties().setProperty('JIRA_TOKEN', tok);
  try {
    var me = jiraGet_('/rest/api/2/myself');
    ui.alert('✅ Conectado como ' + (me.displayName || me.name));
  } catch (e) {
    ui.alert('Token salvo, mas o teste falhou: ' + e.message);
  }
}

function jiraGet_(path, params) {
  var cfg = getConfig();
  var url = cfg.jiraUrl + path;
  if (params) {
    url += (url.indexOf('?') < 0 ? '?' : '&') + Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');
  }
  var tentativas = 0;
  while (true) {
    var resp = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { Authorization: 'Bearer ' + getJiraToken_(), Accept: 'application/json' },
      muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    if (code === 429 || code >= 500) {
      if (++tentativas > 3) throw new Error('Jira indisponível (' + code + ')');
      Utilities.sleep(1500 * tentativas);
      continue;
    }
    if (code >= 300) {
      var txt = resp.getContentText();
      throw new Error('Jira ' + code + ': ' + txt.substring(0, 400));
    }
    return JSON.parse(resp.getContentText());
  }
}

/** Mapa nome-do-campo(lower) → id, com cache de 6h. */
function getMapaCampos_() {
  var cache = CacheService.getScriptCache();
  var c = cache.get('jiraCampos');
  if (c) return JSON.parse(c);
  var lista = jiraGet_('/rest/api/2/field');
  var mapa = {};
  lista.forEach(function (f) {
    mapa[String(f.name).toLowerCase()] = f.id;
    mapa[String(f.id).toLowerCase()] = f.id;
    mapa['__nome__' + f.id] = f.name;
  });
  cache.put('jiraCampos', JSON.stringify(mapa), 21600);
  return mapa;
}

function resolverCampo_(nome, mapa) {
  if (!nome) return null;
  var k = String(nome).trim().toLowerCase();
  if (k === 'duedate' || k === 'data limite' || k === 'due date') return 'duedate';
  return mapa[k] || null;
}

/** Tenta vários nomes/IDs e devolve o primeiro campo que existir. */
function resolverPrimeiro_(candidatos, mapa) {
  for (var i = 0; i < candidatos.length; i++) {
    var id = resolverCampo_(candidatos[i], mapa);
    if (id) return id;
  }
  return null;
}

/** Monta a JQL a partir da configuração (mesma lógica da consulta usada pelo time). */
function montarJql_(cfg) {
  if (!cfg.projetos.length) throw new Error('Nenhum projeto ativo na aba ⚙️ Configuração.');
  var q = function (s) { return '"' + String(s).replace(/"/g, '\\"') + '"'; };
  var partes = ['project in (' + cfg.projetos.map(q).join(', ') + ')'];
  if (cfg.jqlAdicional) partes.push('(' + cfg.jqlAdicional + ')');
  partes.push('(resolved >= startOfMonth(-' + (cfg.mesesHistorico - 1) + ') OR resolution = EMPTY)');
  if (cfg.filtrarTime && cfg.time.length) {
    partes.push(q(cfg.campoDev) + ' in (' + cfg.time.map(function (t) { return q(t.usuario); }).join(', ') + ')');
  }
  return partes.join(' AND ') + ' ORDER BY updated DESC';
}

/** Busca todas as issues (paginado) com changelog. */
function buscarIssues_(cfg, ids) {
  // Usuário inexistente no Jira quebra a JQL ("O valor 'X' não existe para o campo..."):
  // testa a JQL e retira esses usuários automaticamente, registrando no Log.
  var removidos = [];
  for (var tent = 0; tent < 15; tent++) {
    try { jiraGet_('/rest/api/2/search', { jql: montarJql_(cfg), maxResults: 0 }); break; }
    catch (e) {
      var m = String(e.message).match(/(?:valor|value)\s+'([^']+)'\s+(?:não existe|does not exist)/i);
      if (!m) throw e;
      var ruim = m[1].toLowerCase();
      var antes = cfg.time.length;
      cfg.time = cfg.time.filter(function (t) { return t.usuario.toLowerCase() !== ruim; });
      if (cfg.time.length === antes) throw e;
      removidos.push(m[1]);
    }
  }
  if (removidos.length) log_('Aviso', 'Usuários que não existem no Jira foram ignorados na busca: ' + removidos.join(', ') + '. Corrija no bloco 👥 Time ou use "Buscar time do Tempo".');
  var jql = montarJql_(cfg);
  var campos = ['summary', 'status', 'issuetype', 'project', 'labels', 'created', 'updated',
                'resolutiondate', 'assignee', 'duedate', 'priority'];
  [ids.dev, ids.pontos, ids.acordo, ids.primeiraAcordo].forEach(function (f) { if (f && campos.indexOf(f) < 0) campos.push(f); });

  var todas = [], startAt = 0, total = 1, inicio = Date.now();
  while (startAt < total) {
    if (Date.now() - inicio > 300000) { log_('Jira', 'Tempo limite próximo; parando em ' + todas.length + ' issues'); break; }
    var r = jiraGet_('/rest/api/2/search', {
      jql: jql, startAt: startAt, maxResults: 100,
      fields: campos.join(','), expand: 'changelog'
    });
    total = r.total || 0;
    todas = todas.concat(r.issues || []);
    startAt += (r.issues || []).length;
    if (!(r.issues || []).length) break;
  }
  return { issues: todas, jql: jql };
}

/** Lista todos os campos do Jira numa aba para ajudar a configurar nomes. */
function listarCamposJira() {
  var lista = jiraGet_('/rest/api/2/field');
  var sh = ss_().getSheetByName('Campos Jira') || ss_().insertSheet('Campos Jira');
  sh.clear();
  var linhas = lista.map(function (f) { return [f.name, f.id, f.custom ? 'custom' : 'sistema', (f.schema && f.schema.type) || '']; });
  linhas.sort(function (a, b) { return String(a[0]).localeCompare(String(b[0])); });
  sh.getRange(1, 1, 1, 4).setValues([['Nome', 'ID', 'Tipo', 'Formato']]).setFontWeight('bold').setBackground('#111827').setFontColor('#fff');
  if (linhas.length) sh.getRange(2, 1, linhas.length, 4).setValues(linhas);
  sh.setFrozenRows(1);
  sh.activate();
}

/**
 * Subtarefas "Associado (Sub-tarefa)": informação extra, fora dos indicadores.
 * Mesmos projetos e período; sem filtro de dev (mostra quem contribuiu nas issues do time).
 */
var TIPO_ASSOCIADA = 'Associado (Sub-tarefa)';

function buscarAssociadas_(cfg, ids) {
  var q = function (s) { return '"' + String(s).replace(/"/g, '\\"') + '"'; };
  var jql = 'project in (' + cfg.projetos.map(q).join(', ') + ') AND issuetype = ' + q(TIPO_ASSOCIADA) +
    ' AND (resolved >= startOfMonth(-' + (cfg.mesesHistorico - 1) + ') OR resolution = EMPTY) ORDER BY updated DESC';
  var campos = ['summary', 'status', 'parent', 'created', 'resolutiondate', 'assignee'];
  [ids.dev, ids.pontos, ids.acordo].forEach(function (f) { if (f && campos.indexOf(f) < 0) campos.push(f); });
  var todas = [], startAt = 0, total = 1;
  while (startAt < total) {
    var r = jiraGet_('/rest/api/2/search', { jql: jql, startAt: startAt, maxResults: 100, fields: campos.join(',') });
    total = r.total || 0;
    todas = todas.concat(r.issues || []);
    startAt += (r.issues || []).length;
    if (!(r.issues || []).length) break;
  }
  return todas;
}
