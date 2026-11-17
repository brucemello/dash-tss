/** Dash TSS — utilitários de data e formatação */

var TZ = 'America/Sao_Paulo';

/** Converte data do Jira ("2026-10-21T10:00:00.000-0300" ou "2026-10-21") em Date. */
function parseJiraDate_(s) {
  if (!s) return null;
  if (s instanceof Date) return s;
  s = String(s);
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  var iso = s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  var d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** Converte "5/10/2026", "05/10" (com ano de referência) ou Date em Date (meia-noite). */
function parseDataBR_(v, anoRef) {
  if (!v && v !== 0) return null;
  if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  var m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (!m) return null;
  var ano = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : (anoRef || new Date().getFullYear());
  return new Date(ano, +m[2] - 1, +m[1]);
}

function soData_(d) { return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : null; }

function hoje_() { return soData_(new Date()); }

function diasEntre_(a, b) { return Math.round((soData_(b) - soData_(a)) / 86400000); }

/** Dias úteis entre duas datas (inclusivo no início, exclusivo no fim, mínimo 1 se houver intervalo). */
function diasUteis_(ini, fim) {
  if (!ini || !fim) return '';
  var a = soData_(ini), b = soData_(fim);
  if (b < a) return 0;
  var n = 0, d = new Date(a);
  while (d <= b) {
    var w = d.getDay();
    if (w !== 0 && w !== 6) n++;
    d.setDate(d.getDate() + 1);
  }
  return Math.max(n, 1);
}

function subtrairDiasUteis_(data, n) {
  var d = soData_(data);
  var k = Math.max(0, (Number(n) || 1) - 1);
  while (k > 0) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) k--;
  }
  return d;
}

function fmtISO_(d) { return d ? Utilities.formatDate(d, TZ, 'yyyy-MM-dd') : ''; }
function fmtISOHora_(d) { return d ? Utilities.formatDate(d, TZ, "yyyy-MM-dd'T'HH:mm:ss") : ''; }
function fmtBR_(d) { return d ? Utilities.formatDate(d, TZ, 'dd/MM/yyyy') : ''; }

/** Lê uma aba tabular em array de objetos pelo cabeçalho da linha 1. */
function lerTabela_(nomeAba) {
  var sh = ss_().getSheetByName(nomeAba);
  if (!sh || sh.getLastRow() < 2) return [];
  var vals = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var cab = vals.shift().map(function (c) { return String(c).trim(); });
  return vals.filter(function (r) { return String(r[0]).trim() !== ''; }).map(function (r) {
    var o = {};
    cab.forEach(function (c, i) { if (c) o[c] = r[i]; });
    return o;
  });
}

/** Escreve uma tabela (cabeçalho + linhas) numa aba, substituindo o conteúdo. */
function escreverTabela_(nomeAba, cab, linhas, corCab) {
  var sh = ss_().getSheetByName(nomeAba) || ss_().insertSheet(nomeAba);
  sh.clearContents();
  sh.getRange(1, 1, 1, cab.length).setValues([cab])
    .setFontWeight('bold').setBackground(corCab || '#4C1D95').setFontColor('#FFFFFF');
  if (linhas.length) sh.getRange(2, 1, linhas.length, cab.length).setValues(linhas);
  sh.setFrozenRows(1);
  return sh;
}

function chaveIssue_(v) {
  var m = String(v || '').toUpperCase().match(/[A-Z][A-Z0-9]+-\d+/);
  return m ? m[0] : '';
}
