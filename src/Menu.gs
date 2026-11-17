/** Dash TSS — menu da planilha */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('📊 Dash TSS')
    .addItem('📊 Abrir painel', 'abrirPainelNaPlanilha')
    .addItem('🔄 Sincronizar Jira agora', 'menuSincronizar_')
    .addItem('📅 Gerar extração D-1 agora', 'menuD1_')
    .addSeparator()
    .addItem('⚙️ Criar/atualizar configuração', 'menuConfig_')
    .addItem('🔑 Definir token do Jira', 'definirTokenJira')
    .addItem('👥 Buscar time e e-mails no Tempo', 'menuTempo_')
    .addItem('🧾 Listar campos do Jira', 'listarCamposJira')
    .addItem('📥 Importar aba "Entrega por dev"', 'menuImportar_')
    .addSeparator()
    .addItem('⏰ Enviar lembretes de data acordo agora', 'menuLembretes_')
    .addItem('📬 Enviar resumo de segunda agora', 'menuResumo_')
    .addItem('⏱️ Instalar gatilhos automáticos', 'menuGatilhos_')
    .addToUi();
}

function executarComAviso_(fn, titulo) {
  var ui = SpreadsheetApp.getUi();
  try {
    var r = fn();
    ui.alert(titulo, typeof r === 'string' ? r : (r && r.mensagem) || 'Concluído ✅', ui.ButtonSet.OK);
  } catch (e) {
    log_('Erro', titulo + ': ' + e.message);
    ui.alert(titulo, '❌ ' + e.message, ui.ButtonSet.OK);
  }
}

function menuTempo_() { executarComAviso_(sincronizarTimeTempo, '👥 Time do Tempo'); }
function menuD1_() { executarComAviso_(extracaoD1, '📅 Extração D-1'); }
function menuSincronizar_() { executarComAviso_(sincronizarJira, '🔄 Sincronizar Jira'); }
function menuConfig_() { executarComAviso_(function () { criarConfiguracao(); garantirBaseManual_(); return 'Configuração pronta. Revise os blocos e defina o token do Jira.'; }, '⚙️ Configuração'); }
function menuImportar_() { executarComAviso_(importarEntregaPorDev, '📥 Importar histórico'); }
function menuLembretes_() { executarComAviso_(enviarLembretesDataAcordo, '⏰ Lembretes'); }
function menuResumo_() { executarComAviso_(enviarResumoSegunda, '📬 Resumo de segunda'); }
function menuGatilhos_() { executarComAviso_(instalarGatilhos, '⏱️ Gatilhos'); }
