/**
 * Dash TSS — Painel web (Implantar → App da Web)
 */

function doGet(e) {
  var t = HtmlService.createTemplateFromFile('Dashboard');
  return t.evaluate()
    .setTitle('Dash TSS — Entregas do Time')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Abre o painel como diálogo grande dentro da planilha. */
function abrirPainelNaPlanilha() {
  var html = HtmlService.createTemplateFromFile('Dashboard').evaluate().setWidth(1400).setHeight(900);
  SpreadsheetApp.getUi().showModalDialog(html, '📊 Dash TSS');
}

/** Dados completos para o painel. */
function getDashboardData() {
  var d = montarDados_();
  var cfg = d.cfg;
  var ordemFases = Object.keys(cfg.ordemFase)
    .sort(function (a, b) { return cfg.ordemFase[a] - cfg.ordemFase[b]; });
  return {
    geradoEm: fmtISOHora_(new Date()),
    ultimaSync: PropertiesService.getScriptProperties().getProperty('ULTIMA_SYNC') || '',
    planilhaUrl: ss_().getUrl(),
    params: {
      diasLembrete: cfg.diasLembrete, diasParado: cfg.diasParado, jiraUrl: cfg.jiraUrl,
      emailTL: cfg.emailTL, faseInicio: cfg.faseInicio
    },
    kpis: cfg.kpis.map(function (k) { return { id: k.id, nome: k.nome, labels: k.labels.join(', '), cor: k.cor }; }),
    projetos: cfg.projetos,
    time: cfg.time.map(function (t) { return { usuario: t.usuario, nome: t.nome }; }),
    ordemFases: ordemFases,
    issues: d.issues.map(serializarIssue_),
    fases: lerFases_()
  };
}

function sincronizarDoPainel() {
  return sincronizarJira();
}

/** Configuração editável pelo painel (projetos + labels/KPIs). */
function getConfigPainel() {
  var sh = ss_().getSheetByName(ABA.CONFIG) || criarConfiguracao();
  return {
    projetos: lerBloco_(sh, BLOCOS.PROJETOS).map(function (r) { return { nome: String(r[0]), ativo: sim_(r[1]) || String(r[1]).trim() === '' }; }),
    kpis: lerBloco_(sh, BLOCOS.LABELS).map(function (r) {
      return { labels: String(r[0]), nome: String(r[1]), cor: String(r[2]), ativo: sim_(r[3]) || String(r[3]).trim() === '' };
    })
  };
}

function include(nome) {
  return HtmlService.createHtmlOutputFromFile(nome).getContent();
}
