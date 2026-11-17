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

/**
 * Dados para o painel, lidos do JSON pronto (rápido).
 * modo: "agora" (padrão) | "d1" | "d1:AAAA-MM-DD". Retorna texto JSON.
 */
function getDashboardData(modo) {
  return lerSnapshot(modo || 'agora');
}

/** Datas de D-1 disponíveis para o seletor do painel. */
function getDatasD1() {
  return listarDatasD1();
}

/** Consulta o Jira agora e devolve o JSON "Agora" atualizado. */
function atualizarAgora() {
  sincronizarJira();
  return lerSnapshot('agora');
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
