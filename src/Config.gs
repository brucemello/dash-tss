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
  LOG: 'Log',
  LEGADO: 'Entrega por dev'
};

var HEADER_ROW = 3;

var BLOCOS = {
  PARAMS:   { col: 1,  ncol: 2, titulo: '🔧 Parâmetros',          cab: ['Parâmetro', 'Valor'] },
  PROJETOS: { col: 4,  ncol: 2, titulo: '📁 Projetos Jira',        cab: ['Projeto (nome ou chave)', 'Ativo'] },
  LABELS:   { col: 7,  ncol: 4, titulo: '🏷️ Labels → KPIs',        cab: ['Label(s) Jira (separe por vírgula)', 'Nome do KPI', 'Cor', 'Ativo'] },
  TIME:     { col: 12, ncol: 4, titulo: '👥 Time',                 cab: ['Usuário Jira', 'Nome', 'E-mail', 'Ativo'] },
  FASES:    { col: 17, ncol: 3, titulo: '🔀 Status → Fases',       cab: ['Status Jira', 'Fase', 'Ordem'] }
};

var PARAMS_PADRAO = [
  ['URL do Jira', 'https://jiraproducao.totvs.com.br'],
  ['JQL adicional', '(issuetype not in subTaskIssueTypes() OR issuetype = "Associado (Sub-tarefa)") AND "Story Points" >= 0'],
  ['Meses de histórico', 3],
  ['Campo Desenvolvedor', 'Desenvolvedor'],
  ['Campo Story Points', 'Story Points'],
  ['Campo Data acordo', 'Data acordo'],
  ['Filtrar só devs do Time', 'SIM'],
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
  ['Backlog', 'Backlog', 1],
  ['Aberto', 'A fazer', 2],
  ['To Do', 'A fazer', 2],
  ['Pendente', 'A fazer', 2],
  ['Em Análise', 'Análise', 3],
  ['Em Desenvolvimento', 'Desenvolvimento', 4],
  ['In Progress', 'Desenvolvimento', 4],
  ['Em Andamento', 'Desenvolvimento', 4],
  ['Code Review', 'Code Review', 5],
  ['Em Revisão', 'Code Review', 5],
  ['Em Teste', 'Teste', 6],
  ['Testing', 'Teste', 6],
  ['Aguardando Teste', 'Teste', 6],
  ['Homologação', 'Homologação', 7],
  ['Concluído', 'Concluído', 9],
  ['Done', 'Concluído', 9],
  ['Fechado', 'Concluído', 9],
  ['Resolvido', 'Concluído', 9]
];

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
    TIME: TIME_PADRAO, FASES: FASES_PADRAO
  };
  var cores = { PARAMS: '#7C3AED', PROJETOS: '#2563EB', LABELS: '#DB2777', TIME: '#059669', FASES: '#EA580C' };

  Object.keys(BLOCOS).forEach(function (k) {
    var b = BLOCOS[k];
    sh.getRange(HEADER_ROW - 1, b.col).setValue(b.titulo).setFontWeight('bold').setFontColor(cores[k]).setFontSize(12);
    sh.getRange(HEADER_ROW, b.col, 1, b.ncol).setValues([b.cab])
      .setBackground(cores[k]).setFontColor('#FFFFFF').setFontWeight('bold');
    var atual = sh.getRange(HEADER_ROW + 1, b.col, 1, 1).getValue();
    if (nova || atual === '') {
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

  // Validações SIM/NÃO
  var regraSN = SpreadsheetApp.newDataValidation().requireValueInList(['SIM', 'NÃO'], true).build();
  sh.getRange(HEADER_ROW + 1, BLOCOS.PROJETOS.col + 1, 100, 1).setDataValidation(regraSN);
  sh.getRange(HEADER_ROW + 1, BLOCOS.LABELS.col + 3, 100, 1).setDataValidation(regraSN);
  sh.getRange(HEADER_ROW + 1, BLOCOS.TIME.col + 3, 100, 1).setDataValidation(regraSN);

  [[1, 230], [2, 380], [4, 340], [5, 60], [7, 260], [8, 150], [9, 90], [10, 60],
   [12, 160], [13, 130], [14, 230], [15, 60], [17, 170], [18, 140], [19, 60]]
    .forEach(function (c) { sh.setColumnWidth(c[0], c[1]); });
  [3, 6, 11, 16].forEach(function (c) { sh.setColumnWidth(c, 18); });
  sh.setFrozenRows(HEADER_ROW);
  pintarCoresLabels_(sh);
  return sh;
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
    fases[String(r[0]).trim().toLowerCase()] = fase;
    var ord = Number(r[2]) || 50;
    if (ordemFase[fase] === undefined || ord < ordemFase[fase]) ordemFase[fase] = ord;
  });

  return {
    jiraUrl: String(p['URL do Jira'] || '').replace(/\/+$/, ''),
    jqlAdicional: String(p['JQL adicional'] || '').trim(),
    mesesHistorico: Math.max(1, Number(p['Meses de histórico']) || 3),
    campoDev: String(p['Campo Desenvolvedor'] || 'Desenvolvedor').trim(),
    campoPontos: String(p['Campo Story Points'] || 'Story Points').trim(),
    campoAcordo: String(p['Campo Data acordo'] || '').trim(),
    filtrarTime: sim_(p['Filtrar só devs do Time']),
    faseInicio: String(p['Fase que marca início'] || 'Desenvolvimento').trim(),
    emailTL: String(p['E-mail da TL'] || '').trim(),
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
