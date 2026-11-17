/**
 * Dash TSS — Sincronização Jira → abas "Base Jira" e "Fases"
 */

var CAB_BASE = ['Issue', 'Resumo', 'Usuário Jira', 'Desenvolvedor', 'Projeto', 'Tipo', 'Status', 'Fase',
  'Pontos', 'Criado', 'Início', 'Conclusão', 'Data acordo', 'Data acordo original', 'Qtd reprogramações',
  'Reprogramada?', 'Atrasou?', 'Dias atuação', 'Dias parado', 'Última movimentação', 'Labels', 'Link'];

var CAB_FASES = ['Issue', 'Usuário Jira', 'Status', 'Fase', 'Ordem', 'Início', 'Fim', 'Dias', 'Em aberto?'];

function sincronizarJira() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Já existe uma sincronização em andamento.');
  try {
    var t0 = Date.now();
    var shCfg = ss_().getSheetByName(ABA.CONFIG);
    if (shCfg) migrarParametros_(shCfg);
    var cfg = getConfig();
    var mapa = getMapaCampos_();
    var ids = {
      dev: resolverCampo_(cfg.campoDev, mapa),
      pontos: resolverCampo_(cfg.campoPontos, mapa),
      acordo: resolverPrimeiro_([cfg.campoAcordo, 'customfield_11039', 'Data Acordo Entrega', 'Data acordo'], mapa),
      primeiraAcordo: resolverPrimeiro_([cfg.campoPrimeiraAcordo, 'Primeira Data Acordo'], mapa)
    };
    if (!ids.acordo) { ids.acordo = 'duedate'; log_('Aviso', 'Campo "' + cfg.campoAcordo + '" não encontrado; usando Data limite (duedate).'); }
    if (!ids.dev) log_('Aviso', 'Campo "' + cfg.campoDev + '" não encontrado; usando Responsável (assignee).');

    var res = buscarIssues_(cfg, ids);
    var nomeAcordo = String(mapa['__nome__' + ids.acordo] || ids.acordo).toLowerCase();
    log_('Sync', 'Data acordo = ' + ids.acordo + ' (' + nomeAcordo + '); Primeira data acordo = ' + (ids.primeiraAcordo || 'não encontrado'));
    var nomes = {};
    cfg.time.forEach(function (t) { nomes[t.usuario.toLowerCase()] = t.nome; });

    var linhasBase = [], linhasFases = [];
    var kpiCab = cfg.kpis.map(function (k) { return 'KPI • ' + k.nome; });

    res.issues.forEach(function (it) {
      var r = processarIssue_(it, cfg, ids, nomeAcordo);
      var nomeDev = nomes[String(r.usuario).toLowerCase()] || r.devDisplay || r.usuario;
      var labelsLower = r.labels.map(function (l) { return String(l).toLowerCase(); });
      var kpiVals = cfg.kpis.map(function (k) {
        return k.labelsLower.some(function (l) { return labelsLower.indexOf(l) >= 0; }) ? 'SIM' : 'NÃO';
      });
      linhasBase.push([r.chave, r.resumo, r.usuario, nomeDev, r.projeto, r.tipo, r.status, r.fase,
        r.pontos, r.criado, r.inicio || '', r.conclusao || '', r.acordo || '', r.acordoOriginal || '',
        r.qtdReprog, r.qtdReprog > 0 ? 'SIM' : 'NÃO', r.atrasou ? 'SIM' : 'NÃO',
        r.diasAtuacao, r.diasParado, r.ultimaMov || '', r.labels.join(', '),
        cfg.jiraUrl + '/browse/' + r.chave].concat(kpiVals));
      r.segmentos.forEach(function (s) {
        linhasFases.push([r.chave, r.usuario, s.status, s.fase, classificarStatus_(s.status, cfg).ordem,
          s.inicio, s.fim || '', Math.round(((s.fim || new Date()) - s.inicio) / 864000) / 100,
          s.fim ? 'NÃO' : 'SIM']);
      });
    });

    var shB = escreverTabela_(ABA.BASE, CAB_BASE.concat(kpiCab), linhasBase, '#4C1D95');
    if (linhasBase.length) {
      [10, 11, 12, 13, 14, 20].forEach(function (c) { shB.getRange(2, c, linhasBase.length, 1).setNumberFormat('dd/MM/yyyy'); });
    }
    var shF = escreverTabela_(ABA.FASES, CAB_FASES, linhasFases, '#EA580C');
    if (linhasFases.length) shF.getRange(2, 6, linhasFases.length, 2).setNumberFormat('dd/MM/yyyy HH:mm');

    garantirBaseManual_(cfg);
    PropertiesService.getScriptProperties().setProperty('ULTIMA_SYNC', new Date().toISOString());
    var msg = linhasBase.length + ' issues sincronizadas em ' + Math.round((Date.now() - t0) / 1000) + 's';
    log_('Sync', msg + ' | JQL: ' + res.jql);
    return { ok: true, total: linhasBase.length, mensagem: msg };
  } finally {
    lock.releaseLock();
  }
}

function valorCampo_(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(valorCampo_).join(', ');
  if (typeof v === 'object') return v.name || v.key || v.value || v.displayName || '';
  return v;
}

function processarIssue_(it, cfg, ids, nomeAcordo) {
  var f = it.fields || {};
  var devObj = ids.dev ? f[ids.dev] : null;
  if (Array.isArray(devObj)) devObj = devObj[0];
  if (!devObj) devObj = f.assignee;
  var usuario = devObj ? (devObj.name || devObj.key || devObj.value || String(devObj)) : '(sem dev)';
  var devDisplay = devObj ? (devObj.displayName || devObj.value || usuario) : '';

  var criado = parseJiraDate_(f.created);
  var conclusao = parseJiraDate_(f.resolutiondate);
  var acordo = soData_(parseJiraDate_(valorCampo_(f[ids.acordo])));
  var status = (f.status && f.status.name) || '';

  var hist = ((it.changelog && it.changelog.histories) || []).slice()
    .sort(function (a, b) { return parseJiraDate_(a.created) - parseJiraDate_(b.created); });

  // Segmentos de status (fases) e reprogramações de data acordo
  var segmentos = [], qtdReprog = 0, acordoOriginal = null, statusInicial = null, ultimaMov = criado;
  var transicoes = [];
  hist.forEach(function (h) {
    var quando = parseJiraDate_(h.created);
    (h.items || []).forEach(function (i) {
      var campo = String(i.field || '').toLowerCase();
      var fid = String(i.fieldId || '').toLowerCase();
      if (campo === 'status') {
        if (statusInicial === null) statusInicial = i.fromString;
        transicoes.push({ quando: quando, de: i.fromString, para: i.toString });
        ultimaMov = quando;
      } else if (campo === nomeAcordo || fid === String(ids.acordo).toLowerCase() ||
                 (ids.acordo === 'duedate' && campo === 'duedate')) {
        if (i.from || i.fromString) {
          qtdReprog++;
          if (!acordoOriginal) acordoOriginal = soData_(parseJiraDate_(i.from || i.fromString) || parseDataBR_(i.fromString));
        }
      }
    });
  });

  var faseDe = function (st) { return classificarStatus_(st, cfg).fase; };
  var atual = { status: statusInicial || status, inicio: criado };
  transicoes.forEach(function (t) {
    segmentos.push({ status: atual.status, fase: faseDe(atual.status), inicio: atual.inicio, fim: t.quando });
    atual = { status: t.para, inicio: t.quando };
  });
  segmentos.push({ status: atual.status, fase: faseDe(atual.status), inicio: atual.inicio, fim: null });
  // Último segmento fica aberto enquanto a issue não terminar; se concluída, fecha na resolução
  var ult = segmentos[segmentos.length - 1];
  if (conclusao) ult.fim = conclusao > ult.inicio ? conclusao : ult.inicio;

  // Início = primeira entrada numa fase com ordem >= fase de início configurada
  var ordemIni = cfg.ordemFase[cfg.faseInicio] || 4;
  var inicio = null;
  for (var s = 0; s < segmentos.length; s++) {
    var o = classificarStatus_(segmentos[s].status, cfg).ordem;
    if (o >= ordemIni && o < 9) { inicio = segmentos[s].inicio; break; }
  }
  if (!inicio && segmentos.length > 1) inicio = segmentos[1].inicio;
  if (!inicio) inicio = criado;

  // "Primeira Data Acordo" do Jira tem prioridade como data original
  var primeira = ids.primeiraAcordo ? soData_(parseJiraDate_(valorCampo_(f[ids.primeiraAcordo]))) : null;
  if (primeira) acordoOriginal = primeira;
  if (acordo && acordoOriginal && acordo.getTime() !== acordoOriginal.getTime() && qtdReprog === 0) qtdReprog = 1;

  var hoje = hoje_();
  var atrasou = !!acordo && (conclusao ? soData_(conclusao) > acordo : hoje > acordo);
  var diasParado = conclusao ? 0 : diasEntre_(ultimaMov || criado, hoje);

  return {
    chave: it.key,
    resumo: f.summary || '',
    usuario: usuario,
    devDisplay: devDisplay,
    projeto: (f.project && f.project.name) || '',
    tipo: (f.issuetype && f.issuetype.name) || '',
    status: status,
    fase: faseDe(status),
    pontos: ids.pontos ? (Number(valorCampo_(f[ids.pontos])) || 0) : 0,
    criado: criado,
    inicio: inicio,
    conclusao: conclusao,
    acordo: acordo,
    acordoOriginal: acordoOriginal,
    qtdReprog: qtdReprog,
    atrasou: atrasou,
    diasAtuacao: diasUteis_(inicio, conclusao || hoje),
    diasParado: diasParado,
    ultimaMov: ultimaMov,
    labels: f.labels || [],
    segmentos: segmentos
  };
}
