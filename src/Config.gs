/**
 * Dash TSS — Configuração
 * Aba única "⚙️ Configuração" com blocos lado a lado:
 *   A:B  Parâmetros        | D:E  Projetos Jira
 *   G:J  Labels → KPIs     | L:O  Time (desenvolvedores)
 *   Q:S  Status → Fases
 */

var ABA = {
  CONFIG: '⚙️ Configuração',
  BASE: 'Base Jira',
  MANUAL: 'Base Manual',
  FASES: 'Fases',
  ASSOC: 'Associadas',
  LOG: 'Log',
  LEGADO: 'Entrega por dev'
};

var HEADER_ROW = 3;

var BLOCOS = {
  PARAMS:   { col: 1,  ncol: 2, titulo: '🔧 Parâmetros',          cab: ['Parâmetro', 'Valor'] },
  PROJETOS: { col: 4,  ncol: 2, titulo: '📁 Projetos Jira',        cab: ['Projeto (nome ou chave)', 'Ativo'] },
  LABELS:   { col: 7,  ncol: 4, titulo: '🏷️ Labels → KPIs',        cab: ['Label(s) Jira (separe por vírgula)', 'Nome do KPI', 'Cor', 'Ativo'] },
  TIME:     { col: 12, ncol: 4, titulo: '👥 Time',                 cab: ['Usuário Jira', 'Nome', 'E-mail', 'Ativo'] },
  FASES:    { col: 17, ncol: 4, titulo: '🔀 Status → Etapas',      cab: ['Status Jira', 'Etapa', 'Ordem', 'Tipo (Trabalho/Espera/Fim)'] },
  DEST:     { col: 22, ncol: 7, titulo: '📬 Destinatários (TL, gestores, PO)', cab: ['Nome', 'E-mail', 'Papel', 'Resumo de segunda', 'Cópia nos lembretes', 'Resumo diário (D-1)', 'Ativo'] }
};

var PARAMS_PADRAO = [
  ['URL do Jira', 'https://jiraproducao.totvs.com.br'],
  ['JQL adicional', 'issuetype not in subTaskIssueTypes() AND "Story Points" >= 0'],
  ['Meses de histórico', 3],
  ['Campo Desenvolvedor', 'Desenvolvedor'],
  ['Campo Story Points', 'Story Points'],
  ['Campo Data acordo', 'customfield_11039'],
  ['Campo Primeira Data acordo', 'Primeira Data Acordo'],
  ['Filtrar só devs do Time', 'SIM'],
  ['Team ID do Tempo', ''],
  ['Atualizar time pelo Tempo todo dia', 'SIM'],
  ['Fase que marca início', 'Desenvolvimento'],
  ['E-mail da TL', ''],
  ['Dias antes p/ lembrete', 2],
  ['Dias p/ considerar parado', 3],
  ['Hora dos alertas (0-23)', 8],
  ['Lembrete diário ativo', 'SIM'],
  ['Resumo de segunda ativo', 'SIM'],
  ['Copiar TL nos lembretes', 'SIM'],
  ['Webhook Google Chat (opcional)', '']
];

var PROJETOS_PADRAO = [
  ['Jornada Transmissão de Dctos Eletrônicos - TSS - OPEX', 'SIM']
];

var LABELS_PADRAO = [
  ['IA, uso-ia, ia', 'Uso de IA', '#8B5CF6', 'SIM'],
  ['CodeReview, code-review, CR', 'Code Review', '#06B6D4', 'SIM'],
  ['Automacao, automação, automatizado', 'Automação', '#F59E0B', 'SIM']
];

var TIME_PADRAO = [
  ['Antonio.calmeida', 'Antonio', '', 'SIM'],
  ['fabio.morales', 'Fábio', '', 'SIM'],
  ['LUNA', 'Luna', '', 'SIM'],
  ['gabriel.jsilva', 'Gabriel', '', 'SIM'],
  ['Gabriela', 'Gabriela', '', 'SIM'],
  ['gustavo.demate', 'Gustavo', '', 'SIM'],
  ['kaique.samorim', 'Kaique', '', 'SIM'],
  ['LEONARDO', 'Leonardo', '', 'SIM'],
  ['lucas.rossi', 'Lucas', '', 'SIM'],
  ['Luis', 'Luis', '', 'SIM'],
  ['maed.gaudencio', 'Maed', '', 'SIM'],
  ['Mariangela', 'Mariangela', '', 'SIM'],
  ['rafael.inacio', 'Rafael', '', 'SIM'],
  ['renan.botelho', 'Renan', '', 'SIM'],
  ['rodrigo.pirolo', 'Rodrigo', '', 'SIM'],
  ['VALTER', 'Valter', '', 'SIM'],
  ['vitor.rsantos', 'Vitor', '', 'SIM']
];

var FASES_PADRAO = [
  ['Backlog', 'Backlog', 1, 'Espera'],
  ['Em Refinamento', 'Refinamento', 2, 'Trabalho'],
  ['Refinamento Concluído', 'Refinamento', 2, 'Espera'],
  ['Comprometido', 'Comprometido', 3, 'Espera'],
  ['Em Desenvolvimento', 'Desenvolvimento', 4, 'Trabalho'],
  ['Desenvolvimento Concluído', 'Desenvolvimento', 4, 'Espera'],
  ['Em Code Review', 'Code Review', 5, 'Trabalho'],
  ['Code Review Concluído', 'Code Review', 5, 'Espera'],
  ['Em Teste de Aceitação', 'Teste de Aceitação', 6, 'Trabalho'],
  ['Teste de Aceitação Concluído', 'Teste de Aceitação', 6, 'Espera'],
  ['Concluído', 'Concluído', 9, 'Fim'],
  ['Cancelado', 'Concluído', 9, 'Fim']
];

/**
 * Classifica um status do Jira em etapa / tipo / ordem.
 * Usa a tabela da configuração; se o status não estiver lá, deduz pelo nome:
 *   "Em X" → etapa X (Trabalho) · "X Concluído" → etapa X (Espera, fila para a próxima)
 */
var ORDEM_PALAVRAS_ = [[/backlog|aberto|to do|pendente|novo/i, 1], [/refin|an[aá]lise/i, 2], [/compromet/i, 3],
  [/desenv|progress|andamento/i, 4], [/review|revis/i, 5], [/teste|test|aceita/i, 6], [/homolog/i, 7]];

function classificarStatus_(status, cfg) {
  var st = String(status || '').trim();
  var m = cfg && cfg.fases[st.toLowerCase()];
  if (m) return m;
  if (/^(conclu[ií]do|done|fechado|resolvido|cancelado|closed)$/i.test(st)) return { fase: 'Concluído', ordem: 9, tipo: 'Fim' };
  var fase = st.replace(/^em\s+/i, '').replace(/\s+conclu[ií]d[oa]$/i, '').trim() || st || '—';
  var tipo = /conclu[ií]d[oa]$|aguardando|comprometido|backlog|pendente/i.test(st) ? 'Espera' : 'Trabalho';
  var ordem = 50;
  for (var i = 0; i < ORDEM_PALAVRAS_.length; i++) { if (ORDEM_PALAVRAS_[i][0].test(st)) { ordem = ORDEM_PALAVRAS_[i][1]; break; } }
  if (cfg && cfg.ordemFase[fase] !== undefined) ordem = cfg.ordemFase[fase];
  return { fase: fase, ordem: ordem, tipo: tipo };
}


function ss_() { return SpreadsheetApp.getActive(); }

function sim_(v) {
  var s = String(v === undefined || v === null ? '' : v).trim().toUpperCase();
  return s === 'SIM' || s === 'S' || s === 'TRUE' || s === 'X' || s === 'YES' || s === '1';
}

/** Cria (ou completa) a aba de configuração com os valores padrão. */
function criarConfiguracao() {
  var ss = ss_();
  var sh = ss.getSheetByName(ABA.CONFIG);
  var nova = !sh;
  if (nova) sh = ss.insertSheet(ABA.CONFIG, 0);

  sh.getRange(1, 1).setValue('⚙️ Configuração — Dash TSS')
    .setFontSize(16).setFontWeight('bold').setFontColor('#4C1D95');
  sh.getRange(1, 5).setValue('Edite os blocos abaixo. Linha em branco encerra cada bloco. Depois use o menu 📊 Dash TSS → Sincronizar Jira.')
    .setFontColor('#6B7280').setFontStyle('italic');

  var dados = {
    PARAMS: PARAMS_PADRAO, PROJETOS: PROJETOS_PADRAO, LABELS: LABELS_PADRAO,
    TIME: TIME_PADRAO, FASES: FASES_PADRAO, DEST: []
  };
  var cores = { PARAMS: '#7C3AED', PROJETOS: '#2563EB', LABELS: '#DB2777', TIME: '#059669', FASES: '#EA580C', DEST: '#0EA5E9' };

  Object.keys(BLOCOS).forEach(function (k) {
    var b = BLOCOS[k];
    sh.getRange(HEADER_ROW - 1, b.col).setValue(b.titulo).setFontWeight('bold').setFontColor(cores[k]).setFontSize(12);
    sh.getRange(HEADER_ROW, b.col, 1, b.ncol).setValues([b.cab])
      .setBackground(cores[k]).setFontColor('#FFFFFF').setFontWeight('bold');
    var atual = sh.getRange(HEADER_ROW + 1, b.col, 1, 1).getValue();
    if ((nova || atual === '') && dados[k].length) {
      var linhas = dados[k];
      sh.getRange(HEADER_ROW + 1, b.col, linhas.length, b.ncol).setValues(linhas);
    }
  });

  // Parâmetros faltantes (quando a planilha já existia e ganhamos parâmetros novos)
  var cfg = lerBloco_(sh, BLOCOS.PARAMS);
  var existentes = cfg.map(function (r) { return String(r[0]).trim(); });
  var faltam = PARAMS_PADRAO.filter(function (p) { return existentes.indexOf(p[0]) < 0; });
  if (faltam.length) {
    sh.getRange(HEADER_ROW + 1 + cfg.length, 1, faltam.length, 2).setValues(faltam);
  }
  migrarParametros_(sh);

  // Validações SIM/NÃO
  var regraSN = SpreadsheetApp.newDataValidation().requireValueInList(['SIM', 'NÃO'], true).build();
  sh.getRange(HEADER_ROW + 1, BLOCOS.PROJETOS.col + 1, 100, 1).setDataValidation(regraSN);
  sh.getRange(HEADER_ROW + 1, BLOCOS.LABELS.col + 3, 100, 1).setDataValidation(regraSN);
  sh.getRange(HEADER_ROW + 1, BLOCOS.TIME.col + 3, 100, 1).setDataValidation(regraSN);
  sh.getRange(HEADER_ROW + 1, BLOCOS.DEST.col + 3, 100, 4).setDataValidation(regraSN);
  sh.getRange(HEADER_ROW + 1, BLOCOS.DEST.col + 2, 100, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['TL', 'Gestor', 'PO', 'Agile Master', 'Outro'], true).setAllowInvalid(true).build());

  [[1, 230], [2, 380], [4, 340], [5, 60], [7, 260], [8, 150], [9, 90], [10, 60],
   [12, 160], [13, 130], [14, 230], [15, 60], [17, 170], [18, 140], [19, 60], [20, 170],
   [22, 160], [23, 240], [24, 100], [25, 120], [26, 130], [27, 130], [28, 60]]
    .forEach(function (c) { sh.setColumnWidth(c[0], c[1]); });
  [3, 6, 11, 16, 21].forEach(function (c) { sh.setColumnWidth(c, 18); });
  sh.setFrozenRows(HEADER_ROW);
  pintarCoresLabels_(sh);
  return sh;
}

/** Corrige valores padrão antigos que não batem com o Jira. */
function migrarParametros_(sh) {
  // todos os tipos de issue, sem nenhuma subtarefa (antes aceitava "Associado (Sub-tarefa)")
  lerBloco_(sh, BLOCOS.PARAMS).forEach(function (r, i) {
    if (String(r[0]).trim() === 'JQL adicional') {
      var v = String(r[1] || '');
      var novo = v.replace(/\(\s*issuetype\s+not\s+in\s+subTaskIssueTypes\(\)\s+OR\s+issuetype\s*=\s*"Associado \(Sub-tarefa\)"\s*\)/i, 'issuetype not in subTaskIssueTypes()');
      if (novo !== v) sh.getRange(HEADER_ROW + 1 + i, 2).setValue(novo);
    }
  });
  var bd = BLOCOS.DEST;
  if (String(sh.getRange(HEADER_ROW, bd.col).getValue()).trim() !== bd.cab[0]) {
    sh.getRange(HEADER_ROW - 1, bd.col).setValue(bd.titulo).setFontWeight('bold').setFontColor('#0EA5E9').setFontSize(12);
    sh.getRange(HEADER_ROW, bd.col, 1, bd.ncol).setValues([bd.cab]).setBackground('#0EA5E9').setFontColor('#FFFFFF').setFontWeight('bold');
    var regraSN = SpreadsheetApp.newDataValidation().requireValueInList(['SIM', 'NÃO'], true).build();
    sh.getRange(HEADER_ROW + 1, bd.col + 3, 100, 4).setDataValidation(regraSN);
    [[22, 160], [23, 240], [24, 100], [25, 120], [26, 130], [27, 130], [28, 60]].forEach(function (c) { sh.setColumnWidth(c[0], c[1]); });
    sh.setColumnWidth(21, 18);
    var emailTL = '';
    lerBloco_(sh, BLOCOS.PARAMS).forEach(function (r) { if (String(r[0]).trim() === 'E-mail da TL') emailTL = String(r[1]).trim(); });
    if (emailTL && lerBloco_(sh, bd).length === 0) {
      sh.getRange(HEADER_ROW + 1, bd.col, 1, bd.ncol).setValues([['TL', emailTL, 'TL', 'SIM', 'SIM', 'SIM', 'SIM']]);
    }
  }
  var bf = BLOCOS.FASES;
  sh.getRange(HEADER_ROW, bf.col, 1, bf.ncol).setValues([bf.cab]).setBackground('#EA580C').setFontColor('#FFFFFF').setFontWeight('bold');
  var atuais = lerBloco_(sh, bf);
  var conhecidos = atuais.map(function (r) { return String(r[0]).trim().toLowerCase(); });
  // completa a coluna Tipo das linhas antigas
  atuais.forEach(function (r, i) {
    if (String(r[3] || '').trim() === '') {
      var tp = Number(r[2]) >= 9 ? 'Fim' : classificarStatus_(r[0], null).tipo;
      sh.getRange(HEADER_ROW + 1 + i, bf.col + 3).setValue(tp);
    }
  });
  var novos = FASES_PADRAO.filter(function (r) { return conhecidos.indexOf(r[0].toLowerCase()) < 0; });
  if (novos.length) sh.getRange(HEADER_ROW + 1 + atuais.length, bf.col, novos.length, bf.ncol).setValues(novos);
  sh.setColumnWidth(bf.col + 3, 170);

  var linhas = lerBloco_(sh, BLOCOS.PARAMS);
  linhas.forEach(function (r, i) {
    if (String(r[0]).trim() === 'Campo Data acordo' && String(r[1]).trim().toLowerCase() === 'data acordo') {
      sh.getRange(HEADER_ROW + 1 + i, 2).setValue('customfield_11039');
    }
  });
}

function pintarCoresLabels_(sh) {
  var b = BLOCOS.LABELS;
  var linhas = lerBloco_(sh, b);
  linhas.forEach(function (r, i) {
    var cor = String(r[2] || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(cor)) {
      sh.getRange(HEADER_ROW + 1 + i, b.col + 2).setBackground(cor).setFontColor('#FFFFFF');
    }
  });
}

function lerBloco_(sh, b) {
  var ult = Math.max(sh.getLastRow(), HEADER_ROW + 1);
  var vals = sh.getRange(HEADER_ROW + 1, b.col, ult - HEADER_ROW, b.ncol).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === '') break;
    out.push(vals[i]);
  }
  return out;
}

function escreverBloco_(sh, b, linhas) {
  var ult = Math.max(sh.getLastRow(), HEADER_ROW + 1);
  sh.getRange(HEADER_ROW + 1, b.col, ult - HEADER_ROW, b.ncol).clearContent().setBackground(null).setFontColor(null);
  if (linhas.length) sh.getRange(HEADER_ROW + 1, b.col, linhas.length, b.ncol).setValues(linhas);
}

var PALETA_ = ['#8B5CF6', '#06B6D4', '#F59E0B', '#10B981', '#EF4444', '#EC4899', '#3B82F6', '#84CC16', '#F97316', '#14B8A6'];

/** Lê toda a configuração em um objeto. */
function getConfig() {
  var sh = ss_().getSheetByName(ABA.CONFIG) || criarConfiguracao();
  var p = {};
  lerBloco_(sh, BLOCOS.PARAMS).forEach(function (r) { p[String(r[0]).trim()] = r[1]; });

  var projetos = lerBloco_(sh, BLOCOS.PROJETOS)
    .filter(function (r) { return sim_(r[1]) || String(r[1]).trim() === ''; })
    .map(function (r) { return String(r[0]).trim(); });

  var kpis = lerBloco_(sh, BLOCOS.LABELS)
    .filter(function (r) { return sim_(r[3]) || String(r[3]).trim() === ''; })
    .map(function (r, i) {
      var labels = String(r[0]).split(/[,;]/).map(function (s) { return s.trim(); }).filter(String);
      return {
        id: 'kpi' + i,
        nome: String(r[1] || labels[0]).trim(),
        labels: labels,
        labelsLower: labels.map(function (s) { return s.toLowerCase(); }),
        cor: /^#[0-9a-f]{6}$/i.test(String(r[2]).trim()) ? String(r[2]).trim() : PALETA_[i % PALETA_.length]
      };
    });

  var time = lerBloco_(sh, BLOCOS.TIME)
    .filter(function (r) { return sim_(r[3]) || String(r[3]).trim() === ''; })
    .map(function (r) {
      return { usuario: String(r[0]).trim(), nome: String(r[1] || r[0]).trim(), email: String(r[2] || '').trim() };
    });

  var fases = {}, ordemFase = {};
  lerBloco_(sh, BLOCOS.FASES).forEach(function (r) {
    var fase = String(r[1] || r[0]).trim();
    var ord = Number(r[2]) || 50;
    var t = String(r[3] || '').trim().toLowerCase();
    var tipo = t.indexOf('esp') === 0 || t.indexOf('fila') === 0 ? 'Espera' : (t.indexOf('fim') === 0 ? 'Fim' : (t ? 'Trabalho' : ''));
    if (!tipo) tipo = ord >= 9 ? 'Fim' : classificarStatus_(r[0], null).tipo;
    fases[String(r[0]).trim().toLowerCase()] = { fase: fase, ordem: ord, tipo: tipo };
    if (ordemFase[fase] === undefined || ord < ordemFase[fase]) ordemFase[fase] = ord;
  });

  var destinatarios = lerBloco_(sh, BLOCOS.DEST).map(function (r) {
    return { nome: String(r[0]).trim(), email: String(r[1]).trim(), papel: String(r[2] || '').trim(),
      resumo: sim_(r[3]), copia: sim_(r[4]), d1: sim_(r[5]), ativo: sim_(r[6]) || String(r[6]).trim() === '' };
  }).filter(function (x) { return x.email; });
  var ativos = destinatarios.filter(function (x) { return x.ativo; });
  var emailTLparam = String(p['E-mail da TL'] || '').trim();
  var lista = function (campo) {
    var l = ativos.filter(function (x) { return x[campo]; }).map(function (x) { return x.email; });
    if (!l.length && emailTLparam) l = [emailTLparam];
    return l;
  };

  return {
    destinatarios: destinatarios,
    destResumo: lista('resumo'),
    destCopia: lista('copia'),
    destD1: lista('d1'),
    jiraUrl: String(p['URL do Jira'] || '').replace(/\/+$/, ''),
    jqlAdicional: String(p['JQL adicional'] || '').trim(),
    mesesHistorico: Math.max(1, Number(p['Meses de histórico']) || 3),
    campoDev: String(p['Campo Desenvolvedor'] || 'Desenvolvedor').trim(),
    campoPontos: String(p['Campo Story Points'] || 'Story Points').trim(),
    campoAcordo: String(p['Campo Data acordo'] || '').trim(),
    campoPrimeiraAcordo: String(p['Campo Primeira Data acordo'] || '').trim(),
    filtrarTime: sim_(p['Filtrar só devs do Time']),
    teamIdsTempo: String(p['Team ID do Tempo'] || '').trim(),
    timeTempoDiario: String(p['Atualizar time pelo Tempo todo dia'] || 'SIM').trim() === '' || sim_(p['Atualizar time pelo Tempo todo dia']),
    faseInicio: String(p['Fase que marca início'] || 'Desenvolvimento').trim(),
    emailTL: (ativos.filter(function (x) { return /^tl$/i.test(x.papel); })[0] || ativos[0] || { email: emailTLparam }).email || '',
    diasLembrete: Number(p['Dias antes p/ lembrete']) || 2,
    diasParado: Number(p['Dias p/ considerar parado']) || 3,
    horaAlertas: Math.min(23, Math.max(0, Number(p['Hora dos alertas (0-23)']) || 8)),
    lembreteAtivo: sim_(p['Lembrete diário ativo']),
    resumoSegundaAtivo: sim_(p['Resumo de segunda ativo']),
    copiarTL: sim_(p['Copiar TL nos lembretes']),
    webhookChat: String(p['Webhook Google Chat (opcional)'] || '').trim(),
    projetos: projetos,
    kpis: kpis,
    time: time,
    fases: fases,
    ordemFase: ordemFase
  };
}

/** Salva projetos e labels/KPIs vindos do painel web. */
function salvarConfigPainel(payload) {
  var sh = ss_().getSheetByName(ABA.CONFIG) || criarConfiguracao();
  if (payload && payload.projetos) {
    escreverBloco_(sh, BLOCOS.PROJETOS, payload.projetos
      .filter(function (p) { return String(p.nome || '').trim(); })
      .map(function (p) { return [String(p.nome).trim(), p.ativo === false ? 'NÃO' : 'SIM']; }));
  }
  if (payload && payload.kpis) {
    escreverBloco_(sh, BLOCOS.LABELS, payload.kpis
      .filter(function (k) { return String(k.labels || '').trim(); })
      .map(function (k, i) {
        return [String(k.labels).trim(), String(k.nome || k.labels).trim(),
                k.cor || PALETA_[i % PALETA_.length], k.ativo === false ? 'NÃO' : 'SIM'];
      }));
    pintarCoresLabels_(sh);
    garantirBaseManual_();
  }
  if (payload && payload.destinatarios) {
    escreverBloco_(sh, BLOCOS.DEST, payload.destinatarios
      .filter(function (d) { return String(d.email || '').trim(); })
      .map(function (d) {
        var sn = function (v) { return v ? 'SIM' : 'NÃO'; };
        return [String(d.nome || '').trim(), String(d.email).trim(), String(d.papel || 'TL').trim(),
                sn(d.resumo), sn(d.copia), sn(d.d1), sn(d.ativo !== false)];
      }));
  }
  try { gerarSnapshotAtual(); } catch (e) { log_('Erro', 'JSON não regenerado: ' + e.message); }
  log_('Config', 'Configuração atualizada pelo painel por ' + (Session.getActiveUser().getEmail() || 'usuário'));
  return { ok: true };
}

function log_(tipo, msg) {
  try {
    var sh = ss_().getSheetByName(ABA.LOG);
    if (!sh) {
      sh = ss_().insertSheet(ABA.LOG);
      sh.appendRow(['Data/hora', 'Tipo', 'Mensagem']);
      sh.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#111827').setFontColor('#fff');
    }
    sh.appendRow([new Date(), tipo, msg]);
    if (sh.getLastRow() > 2000) sh.deleteRows(2, 500);
  } catch (e) { console.log(tipo + ': ' + msg); }
}
