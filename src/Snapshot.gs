/**
 * Dash TSS — Snapshots em JSON (leitura rápida do painel)
 *
 *  Agora → dash-tss-atual.json      regravado a cada sincronização (manual, a cada 2h e às 8h)
 *  D-1   → dash-tss-d1.json         foto do fechamento do dia anterior, gerada de madrugada
 *          dash-tss-d1-AAAA-MM-DD.json  histórico diário (mantém os últimos DIAS_HISTORICO_D1)
 *
 * Os arquivos ficam na pasta "Dash TSS - JSON" ao lado da planilha no Drive.
 * O painel lê primeiro do cache do script (em pedaços) e, se não houver, do arquivo.
 */

var PASTA_JSON = 'Dash TSS - JSON';
var ARQ_ATUAL = 'dash-tss-atual.json';
var ARQ_D1 = 'dash-tss-d1.json';
var DIAS_HISTORICO_D1 = 35;
var CACHE_TTL = 21600; // 6h (máximo do CacheService)
var CACHE_PEDACO = 90000;

/** Monta o pacote completo que o painel consome. */
function montarPayload_(modo, dataRef) {
  var d = montarDados_(null, dataRef);
  var cfg = d.cfg;
  var agora = new Date();
  var ordemFases = Object.keys(cfg.ordemFase)
    .sort(function (a, b) { return cfg.ordemFase[a] - cfg.ordemFase[b]; });
  return {
    versao: 2,
    modo: modo,
    referencia: fmtISOHora_(agora),
    dataReferencia: dataRef ? fmtISO_(dataRef) : fmtISO_(agora),
    geradoEm: fmtISOHora_(agora),
    ultimaSync: PropertiesService.getScriptProperties().getProperty('ULTIMA_SYNC') || '',
    planilhaUrl: ss_().getUrl(),
    params: {
      diasLembrete: cfg.diasLembrete, diasParado: cfg.diasParado, jiraUrl: cfg.jiraUrl,
      emailTL: cfg.emailTL, faseInicio: cfg.faseInicio, ordemCompromisso: 3
    },
    kpis: cfg.kpis.map(function (k) { return { id: k.id, nome: k.nome, labels: k.labels.join(', '), cor: k.cor }; }),
    projetos: cfg.projetos,
    time: cfg.time.map(function (t) { return { usuario: t.usuario, nome: t.nome }; }),
    ordemFases: ordemFases,
    issues: d.issues.map(function (x) {
      var o = serializarIssue_(x);
      delete o.email; // o JSON não precisa carregar e-mails
      return o;
    }),
    fases: lerFases_(cfg),
    associadas: lerAssociadas_(cfg),
    subtarefas: lerSubtarefas_(cfg)
  };
}

// ---------- Drive ----------
function pastaJson_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('PASTA_JSON_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var pais = DriveApp.getFileById(ss_().getId()).getParents();
  var pai = pais.hasNext() ? pais.next() : DriveApp.getRootFolder();
  var it = pai.getFoldersByName(PASTA_JSON);
  var pasta = it.hasNext() ? it.next() : pai.createFolder(PASTA_JSON);
  props.setProperty('PASTA_JSON_ID', pasta.getId());
  return pasta;
}

function salvarArquivoJson_(nome, txt) {
  var pasta = pastaJson_();
  var it = pasta.getFilesByName(nome);
  if (it.hasNext()) { it.next().setContent(txt); return; }
  pasta.createFile(nome, txt, 'application/json');
}

function lerArquivoJson_(nome) {
  var it = pastaJson_().getFilesByName(nome);
  return it.hasNext() ? it.next().getBlob().getDataAsString('UTF-8') : null;
}

// ---------- Cache em pedaços ----------
function cachePut_(chave, txt) {
  var c = CacheService.getScriptCache();
  var n = Math.ceil(txt.length / CACHE_PEDACO);
  var mapa = {};
  for (var i = 0; i < n; i++) mapa[chave + '_' + i] = txt.substr(i * CACHE_PEDACO, CACHE_PEDACO);
  mapa[chave + '_n'] = String(n);
  try { c.putAll(mapa, CACHE_TTL); } catch (e) { log_('Aviso', 'Cache não gravado (' + e.message + ')'); }
}

function cacheGet_(chave) {
  var c = CacheService.getScriptCache();
  var n = Number(c.get(chave + '_n'));
  if (!n) return null;
  var chaves = [];
  for (var i = 0; i < n; i++) chaves.push(chave + '_' + i);
  var partes = c.getAll(chaves);
  var txt = '';
  for (var j = 0; j < n; j++) { if (partes[chave + '_' + j] === undefined) return null; txt += partes[chave + '_' + j]; }
  return txt;
}

// ---------- Geração ----------
/** Regrava o JSON "Agora". Chamado ao fim de toda sincronização. */
function gerarSnapshotAtual() {
  var txt = JSON.stringify(montarPayload_('agora'));
  cachePut_('snap_agora', txt);
  salvarArquivoJson_(ARQ_ATUAL, txt);
  return txt;
}

/**
 * Extração D-1: roda de madrugada, sincroniza com o Jira e grava a foto
 * do fechamento do dia anterior (mais uma cópia datada para histórico).
 */
function extracaoD1() {
  if (typeof euSouDono_ === 'function' && !euSouDono_('Extração D-1')) return 'Extração D-1 ignorada (gatilhos de outra conta).';
  var ontem = hoje_(); ontem.setDate(ontem.getDate() - 1);
  try { sincronizarJira(); } catch (e) { log_('Erro', 'D-1: falha ao sincronizar, usando a última base (' + e.message + ')'); }
  var txt = JSON.stringify(montarPayload_('d1', ontem));
  var nomeDia = 'dash-tss-d1-' + fmtISO_(ontem) + '.json';
  salvarArquivoJson_(ARQ_D1, txt);
  salvarArquivoJson_(nomeDia, txt);
  cachePut_('snap_d1', txt);
  limparHistoricoD1_();
  var msg = 'Extração D-1 de ' + fmtBR_(ontem) + ' gravada (' + Math.round(txt.length / 1024) + ' KB)';
  log_('D-1', msg);
  return msg;
}

function limparHistoricoD1_() {
  var limite = hoje_(); limite.setDate(limite.getDate() - DIAS_HISTORICO_D1);
  var it = pastaJson_().getFiles();
  while (it.hasNext()) {
    var f = it.next();
    var m = f.getName().match(/^dash-tss-d1-(\d{4})-(\d{2})-(\d{2})\.json$/);
    if (m && new Date(+m[1], +m[2] - 1, +m[3]) < limite) f.setTrashed(true);
  }
}

/** Datas de D-1 disponíveis (mais recentes primeiro). */
function listarDatasD1() {
  var datas = [];
  var it = pastaJson_().getFiles();
  while (it.hasNext()) {
    var m = it.next().getName().match(/^dash-tss-d1-(\d{4}-\d{2}-\d{2})\.json$/);
    if (m) datas.push(m[1]);
  }
  return datas.sort().reverse();
}

/**
 * Lê o JSON pronto. modo: "agora" | "d1" | "d1:AAAA-MM-DD".
 * Devolve o texto JSON (o navegador faz o parse — mais rápido que trafegar objeto).
 */
function lerSnapshot(modo) {
  modo = modo || 'agora';
  if (modo === 'agora') {
    return cacheGet_('snap_agora') || lerArquivoJson_(ARQ_ATUAL) || gerarSnapshotAtual();
  }
  if (modo === 'd1') {
    var t = cacheGet_('snap_d1') || lerArquivoJson_(ARQ_D1);
    if (t) return t;
    // ainda não houve extração de madrugada: gera uma agora para não deixar a tela vazia
    return extracaoD1Texto_();
  }
  var data = String(modo).split(':')[1];
  var txt = lerArquivoJson_('dash-tss-d1-' + data + '.json');
  if (!txt) throw new Error('Não há extração D-1 para ' + data);
  return txt;
}

function extracaoD1Texto_() {
  extracaoD1();
  return cacheGet_('snap_d1') || lerArquivoJson_(ARQ_D1);
}
