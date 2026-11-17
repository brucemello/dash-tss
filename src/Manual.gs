/**
 * Dash TSS — Base Manual
 * Ajustes que a TL marca à mão (IA, Code Review, Automação, Resultado CR...) e
 * histórico importado da aba antiga "Entrega por dev". No painel, os dados manuais
 * complementam o Jira: um KPI fica SIM se a label existir no Jira OU estiver SIM aqui.
 */

var CAB_MANUAL = ['Issue', 'Resumo', 'Usuário Jira', 'Início', 'Conclusão', 'Pontos', 'Dias atuação',
  'Data acordo', 'Reprogramada?', 'Atrasou?', 'Resultado CR', 'Observação'];

function garantirBaseManual_(cfg) {
  cfg = cfg || getConfig();
  var sh = ss_().getSheetByName(ABA.MANUAL);
  var kpiCab = cfg.kpis.map(function (k) { return 'KPI • ' + k.nome; });
  if (!sh) {
    sh = ss_().insertSheet(ABA.MANUAL);
    var cab = CAB_MANUAL.concat(kpiCab);
    sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#059669').setFontColor('#fff');
    sh.setFrozenRows(1);
    sh.getRange('A1').setNote('Preencha só o que quiser complementar. Basta a coluna Issue + as colunas KPI com SIM/NÃO.');
  } else {
    var atual = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
    var faltam = kpiCab.filter(function (c) { return atual.indexOf(c) < 0; });
    if (faltam.length) {
      sh.getRange(1, atual.length + 1, 1, faltam.length).setValues([faltam])
        .setFontWeight('bold').setBackground('#059669').setFontColor('#fff');
    }
  }
  var ncol = sh.getLastColumn();
  var regra = SpreadsheetApp.newDataValidation().requireValueInList(['SIM', 'NÃO'], true).setAllowInvalid(true).build();
  var cabAtual = sh.getRange(1, 1, 1, ncol).getValues()[0];
  cabAtual.forEach(function (c, i) {
    if (/^KPI •|Reprogramada\?|Atrasou\?/.test(String(c))) sh.getRange(2, i + 1, 999, 1).setDataValidation(regra);
  });
  return sh;
}

/** Importa a aba no formato antigo "Entrega por dev" para a Base Manual. */
function importarEntregaPorDev() {
  var cfg = getConfig();
  var src = ss_().getSheetByName(ABA.LEGADO);
  if (!src) throw new Error('Aba "' + ABA.LEGADO + '" não encontrada.');
  var vals = src.getDataRange().getValues();

  var kpiIA = acharKpi_(cfg, /(\bia\b|intelig)/i);
  var kpiCR = acharKpi_(cfg, /(review|\bcr\b)/i);
  var kpiAuto = acharKpi_(cfg, /automa/i);

  var dev = '', novas = [];
  vals.forEach(function (r) {
    var a = String(r[0]).trim();
    if (/^desenvolvedor/i.test(a)) { dev = String(r[1]).trim(); return; }
    var chave = chaveIssue_(r[1]);
    if (!chave || !dev) return;
    var conclusao = parseDataBR_(r[0]);
    var dias = Number(r[4]) || '';
    var acordo = parseDataBR_(r[5], conclusao ? conclusao.getFullYear() : null);
    var o = {
      'Issue': chave, 'Resumo': r[2], 'Usuário Jira': dev,
      'Início': conclusao && dias ? subtrairDiasUteis_(conclusao, dias) : '',
      'Conclusão': conclusao || '', 'Pontos': Number(r[3]) || '', 'Dias atuação': dias,
      'Data acordo': acordo || '', 'Reprogramada?': normSN_(r[6]), 'Atrasou?': normSN_(r[7]),
      'Resultado CR': r[8] || '', 'Observação': 'Importado de "' + ABA.LEGADO + '"'
    };
    if (kpiIA) o['KPI • ' + kpiIA.nome] = normSN_(r[10]);
    if (kpiCR) o['KPI • ' + kpiCR.nome] = String(r[8]).trim() && normSN_(r[8]) !== 'NÃO' ? 'SIM' : '';
    if (kpiAuto) o['KPI • ' + kpiAuto.nome] = String(r[9]).trim() ? (normSN_(r[9]) === 'NÃO' ? 'NÃO' : 'SIM') : '';
    novas.push(o);
  });

  var sh = garantirBaseManual_(cfg);
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var existentes = {};
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (x, i) { existentes[chaveIssue_(x[0])] = i + 2; });
  }
  var add = 0, upd = 0;
  novas.forEach(function (o) {
    var linha = cab.map(function (c) { return o[c] !== undefined ? o[c] : ''; });
    if (existentes[o.Issue]) {
      // Atualiza só células vazias para não sobrescrever ajustes da TL
      var rg = sh.getRange(existentes[o.Issue], 1, 1, cab.length);
      var atual = rg.getValues()[0];
      rg.setValues([atual.map(function (v, i) { return String(v).trim() === '' ? linha[i] : v; })]);
      upd++;
    } else {
      sh.appendRow(linha);
      existentes[o.Issue] = sh.getLastRow();
      add++;
    }
  });
  if (sh.getLastRow() > 1) {
    [4, 5, 8].forEach(function (c) { sh.getRange(2, c, sh.getLastRow() - 1, 1).setNumberFormat('dd/MM/yyyy'); });
  }
  var msg = add + ' issues importadas, ' + upd + ' complementadas';
  log_('Importação', msg);
  return msg;
}

function acharKpi_(cfg, re) {
  for (var i = 0; i < cfg.kpis.length; i++) {
    var k = cfg.kpis[i];
    if (re.test(k.nome) || k.labels.some(function (l) { return re.test(l); })) return k;
  }
  return null;
}

function normSN_(v) {
  var s = String(v || '').trim().toUpperCase();
  if (!s) return '';
  if (s === 'SIM' || s === 'S' || s === 'X' || s === 'OK' || s === 'APROVADO') return 'SIM';
  if (s === 'NÃO' || s === 'NAO' || s === 'N') return 'NÃO';
  return s;
}
