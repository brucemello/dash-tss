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
    }),
    destinatarios: getConfig().destinatarios,
    prontidao: verificarProntidao()
  };
}

/** Envia um e-mail de teste do tipo escolhido para um destinatário. */
function enviarTeste(email, tipo) {
  if (!email) throw new Error('Informe o e-mail.');
  if (tipo === 'd1') return enviarResumoDiarioD1(email);
  return enviarResumoSegunda(email);
}

/** Checklist do que falta para a TL usar o painel. */
function verificarProntidao() {
  var props = PropertiesService.getScriptProperties();
  var cfg = getConfig();
  var itens = [];
  var add = function (ok, item, dica) { itens.push({ ok: !!ok, item: item, dica: dica }); };

  add(props.getProperty('JIRA_TOKEN'), 'Token do Jira configurado', 'Menu 📊 Dash TSS → 🔑 Definir token do Jira');
  var ult = props.getProperty('ULTIMA_SYNC');
  var horas = ult ? (Date.now() - new Date(ult).getTime()) / 3600000 : null;
  add(ult && horas < 26, 'Dados do Jira sincronizados' + (ult ? ' (há ' + (horas < 1 ? Math.round(horas * 60) + ' min' : Math.round(horas) + 'h') + ')' : ''), 'Clique em ⚡ Atualizar agora');
  add(cfg.destResumo.length, 'Destinatário do resumo de segunda (' + (cfg.destResumo.join(', ') || 'nenhum') + ')', 'Cadastre a TL abaixo em 📬 Destinatários');
  add(cfg.destD1.length, 'Destinatário do resumo diário D-1 (' + (cfg.destD1.join(', ') || 'nenhum') + ')', 'Marque “Resumo diário” para a TL');
  var comEmail = cfg.time.filter(function (t) { return t.email; }).length;
  add(comEmail === cfg.time.length && cfg.time.length, 'E-mail dos devs para os lembretes (' + comEmail + ' de ' + cfg.time.length + ')', 'Preencha a coluna E-mail no bloco 👥 Time da planilha');
  var gat = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  add(['extracaoD1', 'rotinaDiaria', 'sincronizarAgendado'].every(function (g) { return gat.indexOf(g) >= 0; }),
    'Gatilhos automáticos (D-1, lembretes, resumo, atualização)', 'Menu 📊 Dash TSS → ⏱️ Instalar gatilhos automáticos');
  var temD1 = false;
  try { temD1 = !!lerArquivoJson_(ARQ_D1); } catch (e) {}
  add(temD1, 'Primeira extração D-1 gerada', 'Menu 📊 Dash TSS → 📅 Gerar extração D-1 agora (ou aguarde a 1h)');
  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  add(url, 'App da web implantado' + (url ? '' : ''), 'Implantar → Nova implantação → App da web (acesso: domínio TOTVS)');
  return { itens: itens, url: url, pronto: itens.every(function (i) { return i.ok; }) };
}

function include(nome) {
  return HtmlService.createHtmlOutputFromFile(nome).getContent();
}
