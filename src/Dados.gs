/**
 * Dash TSS — junta Base Jira + Base Manual num único conjunto de issues
 * (usado pelo painel e pelos alertas).
 */

function montarDados_(cfg) {
  cfg = cfg || getConfig();
  var hoje = hoje_();
  var nomes = {}, emails = {};
  cfg.time.forEach(function (t) { nomes[t.usuario.toLowerCase()] = t.nome; emails[t.usuario.toLowerCase()] = t.email; });

  var mapa = {};
  var ordem = [];

  var dt = function (v) { return v instanceof Date ? v : (v ? parseDataBR_(v) : null); };
  var kpiDe = function (row) {
    var o = {};
    cfg.kpis.forEach(function (k) { o[k.id] = sim_(row['KPI • ' + k.nome]); });
    return o;
  };

  lerTabela_(ABA.BASE).forEach(function (r) {
    var k = chaveIssue_(r['Issue']);
    if (!k) return;
    mapa[k] = {
      k: k, resumo: String(r['Resumo'] || ''), usuario: String(r['Usuário Jira'] || ''),
      dev: String(r['Desenvolvedor'] || r['Usuário Jira'] || ''), projeto: String(r['Projeto'] || ''),
      tipo: String(r['Tipo'] || ''), status: String(r['Status'] || ''), fase: String(r['Fase'] || ''),
      pontos: Number(r['Pontos']) || 0, criado: dt(r['Criado']), inicio: dt(r['Início']),
      conclusao: dt(r['Conclusão']), acordo: dt(r['Data acordo']), acordoOrig: dt(r['Data acordo original']),
      reprog: Number(r['Qtd reprogramações']) || 0, ultimaMov: dt(r['Última movimentação']),
      labels: String(r['Labels'] || ''), link: String(r['Link'] || ''), kpis: kpiPorLabels_(r['Labels'], cfg),
      resultadoCR: '', obs: '', origem: 'Jira'
    };
    ordem.push(k);
  });

  lerTabela_(ABA.MANUAL).forEach(function (r) {
    var k = chaveIssue_(r['Issue']);
    if (!k) return;
    var man = kpiDe(r);
    var x = mapa[k];
    if (x) {
      cfg.kpis.forEach(function (kp) {
        var v = String(r['KPI • ' + kp.nome] || '').trim();
        if (v) x.kpis[kp.id] = x.kpis[kp.id] || sim_(v);
      });
      x.resultadoCR = String(r['Resultado CR'] || '');
      x.obs = String(r['Observação'] || '');
      if (!x.acordo && r['Data acordo']) x.acordo = dt(r['Data acordo']);
      if (sim_(r['Reprogramada?']) && !x.reprog) x.reprog = 1;
      x.origem = 'Jira + Manual';
    } else {
      var usuario = String(r['Usuário Jira'] || '');
      mapa[k] = {
        k: k, resumo: String(r['Resumo'] || ''), usuario: usuario,
        dev: nomes[usuario.toLowerCase()] || usuario, projeto: '', tipo: '',
        status: r['Conclusão'] ? 'Concluído' : 'Em andamento', fase: r['Conclusão'] ? 'Concluído' : 'Desenvolvimento',
        pontos: Number(r['Pontos']) || 0, criado: dt(r['Início']), inicio: dt(r['Início']),
        conclusao: dt(r['Conclusão']), acordo: dt(r['Data acordo']), acordoOrig: null,
        reprog: sim_(r['Reprogramada?']) ? 1 : 0, ultimaMov: dt(r['Conclusão']) || dt(r['Início']),
        labels: '', link: cfg.jiraUrl + '/browse/' + k, kpis: man,
        resultadoCR: String(r['Resultado CR'] || ''), obs: String(r['Observação'] || ''),
        origem: 'Manual', atrasouManual: sim_(r['Atrasou?']), diasManual: Number(r['Dias atuação']) || ''
      };
      ordem.push(k);
    }
  });

  var issues = ordem.map(function (k) {
    var x = mapa[k];
    x.email = emails[String(x.usuario).toLowerCase()] || '';
    if (nomes[String(x.usuario).toLowerCase()]) x.dev = nomes[String(x.usuario).toLowerCase()];
    x.aberta = !x.conclusao;
    x.atrasou = x.origem === 'Manual' && x.atrasouManual ? true :
      !!x.acordo && (x.conclusao ? soData_(x.conclusao) > soData_(x.acordo) : hoje > soData_(x.acordo));
    x.diasParado = x.aberta ? diasEntre_(x.ultimaMov || x.criado || hoje, hoje) : 0;
    x.diasAtuacao = x.diasManual || diasUteis_(x.inicio || x.criado, x.conclusao || hoje) || 0;
    x.diasParaAcordo = x.acordo ? diasEntre_(hoje, x.acordo) : null;
    return x;
  });

  return { cfg: cfg, issues: issues };
}

/** KPI calculado na leitura a partir das labels — label nova vale na hora, sem esperar sincronizar. */
function kpiPorLabels_(labelsTxt, cfg) {
  var labs = String(labelsTxt || '').split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(String);
  var o = {};
  cfg.kpis.forEach(function (k) { o[k.id] = k.labelsLower.some(function (l) { return labs.indexOf(l) >= 0; }); });
  return o;
}

/** Serializa datas para o painel web. */
function serializarIssue_(x) {
  var o = {};
  Object.keys(x).forEach(function (k) {
    var v = x[k];
    o[k] = v instanceof Date ? fmtISO_(v) : v;
  });
  return o;
}

function lerFases_() {
  return lerTabela_(ABA.FASES).map(function (r) {
    return {
      k: chaveIssue_(r['Issue']), fase: String(r['Fase'] || ''), status: String(r['Status'] || ''),
      ordem: Number(r['Ordem']) || 50,
      ini: r['Início'] instanceof Date ? fmtISOHora_(r['Início']) : '',
      fim: r['Fim'] instanceof Date ? fmtISOHora_(r['Fim']) : '',
      dias: Number(r['Dias']) || 0, aberto: sim_(r['Em aberto?'])
    };
  });
}
