# 📊 Dash TSS — Entregas do Time

Apps Script (planilha Google + app da web) para a TL do time **TSS** acompanhar as entregas dos analistas a partir do Jira de produção, com deploy automático pelo GitHub Actions.

## O que faz

| Recurso | Como funciona |
|---|---|
| **Painel colorido** | App da web com KPIs clicáveis (entregas, story points, % no prazo, atrasadas, reprogramadas, tempo médio, em andamento, parados, vencendo, vencidas). Todo card abre a lista de issues para auditoria, com busca e exportação em CSV. |
| **Fases** | Lê o histórico de status do Jira e calcula início/fim de cada fase por issue (linha do tempo), tempo médio por fase e onde estão as abertas. |
| **Data acordo** | Marca reprogramação (data alterada no Jira), atraso e mostra a agenda dos próximos 14 dias. |
| **Lembrete automático** | Todo dia útil, e-mail para cada dev com issues vencendo em até N dias ou já vencidas (TL em cópia). |
| **Resumo de segunda** | Toda segunda: principais itens parados, vencidos, que vencem na semana e entregas da semana anterior, para a TL (e Google Chat, opcional). |
| **IA / Code Review / Automação** | Viram KPI pelas **labels** do Jira (configurável) e/ou marcação manual na aba *Base Manual*. Mostra o % de uso no time e por dev. |
| **Label nova = KPI novo** | Ao adicionar uma label na configuração (planilha ou painel), aparece um card novo com % de uso e auditoria. |

## Manual interativo

O botão **❓ Manual** no topo do painel abre um tour guiado de 24 passos em 7 capítulos (Começo, Visão geral, Datas & Issues, Fases, Por desenvolvedor, Configuração, Rotinas). O tour troca de aba sozinho, destaca cada área e explica como usar na decisão. Abre automaticamente na primeira visita; navegue com ← → ou pelo índice.

## Visões: Agora × D-1 (JSON)

O painel não recalcula nada ao abrir: ele lê um **JSON pronto** (primeiro do cache do script, depois do arquivo no Drive).

| Visão | Arquivo | Quando é gerado |
|---|---|---|
| ⚡ **Agora** | `dash-tss-atual.json` | A cada sincronização: botão *Atualizar agora*, a cada 2h em dias úteis e na rotina das 8h |
| 📅 **D-1** | `dash-tss-d1.json` + `dash-tss-d1-AAAA-MM-DD.json` | Todo dia à 1h: sincroniza com o Jira e grava a foto do fechamento do dia anterior (histórico de 35 dias) |

Os arquivos ficam na pasta **Dash TSS - JSON**, ao lado da planilha no Drive. Na visão D-1, prazos e "dias parado" são calculados como no fim daquele dia, e dá para escolher datas anteriores.

## Time pelo Tempo

Informe o **Team ID do Tempo** (ou procure o time pelo nome na aba Configuração do painel) e clique em **Buscar time e e-mails**. O Dash lê os membros ativos no Tempo Teams, busca usuário, nome e e-mail no Jira e atualiza o bloco 👥 Time. Roda sozinho todo dia útil antes dos alertas. Usuários que não existem no Jira são desativados e também ignorados na JQL, para não quebrar a busca.

## Destinatários (TL, gestores, PO)

Bloco **📬 Destinatários** na aba ⚙️ Configuração (ou na aba Configuração do painel): nome, e-mail, papel e o que cada um recebe:

- **Resumo de segunda**: itens parados, vencidos e que vencem na semana.
- **Cópia nos lembretes**: cópia dos lembretes de data acordo enviados aos devs.
- **Resumo diário (D-1)**: todo dia útil, o que foi entregue ontem e o que pede atenção hoje.

O painel tem botões para enviar um e-mail de teste e um checklist **Pronto para a TL usar?**.

## Abas da planilha

- **⚙️ Configuração** — parâmetros, projetos, labels → KPIs, time (usuário Jira, nome, e-mail) e mapeamento status → fase.
- **Base Jira** — gerada pela sincronização (não editar).
- **Fases** — segmentos de cada fase por issue (gerada).
- **Base Manual** — complementos da TL (IA, CR, Automação, Resultado CR) e o histórico importado da aba antiga *Entrega por dev*.
- **Log** — registro das execuções.

## Busca no Jira

A JQL é montada a partir da configuração, no mesmo formato usado pelo time:

```
project in ("Jornada Transmissão de Dctos Eletrônicos - TSS - OPEX")
AND (issuetype not in subTaskIssueTypes() AND "Story Points" >= 0)
AND (resolved >= startOfMonth(-2) OR resolution = EMPTY)
AND "Desenvolvedor" in (<usuários do bloco Time>)
```

Os campos *Desenvolvedor*, *Story Points* e *Data acordo* são localizados pelo nome. Se o nome for diferente no Jira, use **📊 Dash TSS → 🧾 Listar campos do Jira** e ajuste na configuração. Sem campo de data acordo, usa a *Data limite* (duedate).

## Instalação (uma vez)

1. Na planilha: **Extensões → Apps Script**, copie o **ID do script** (Configurações do projeto).
2. No GitHub (repositório deste código), em *Settings → Secrets and variables → Actions*, crie:
   - `SCRIPT_ID` — ID do script.
   - `CLASPRC_JSON` — conteúdo do `~/.clasprc.json` (o mesmo dos outros projetos).
   - `DEPLOYMENT_ID` *(opcional)* — ID da implantação do app da web, para manter a mesma URL a cada deploy.
3. Faça push na `main` → o Actions publica o código.
4. Recarregue a planilha → menu **📊 Dash TSS**:
   1. ⚙️ Criar/atualizar configuração (preencha e-mail da TL e e-mails do time)
   2. 🔑 Definir token do Jira (Personal Access Token)
   3. 📥 Importar aba "Entrega por dev" (opcional, traz o histórico manual)
   4. 🔄 Sincronizar Jira agora
   5. ⏱️ Instalar gatilhos automáticos
5. **Implantar → Nova implantação → App da web** (executar como você, acesso ao domínio) e compartilhe a URL com a TL.

## De qual conta saem os e-mails

No Apps Script, os gatilhos rodam como **quem os instalou**, e os e-mails saem dessa conta. Para os e-mails saírem da TL:

1. A TL abre a planilha com a conta dela → menu **📊 Dash TSS → ⏱️ Instalar gatilhos automáticos** (e autoriza).
2. Pronto: o Dash registra a TL como dona dos gatilhos, e os gatilhos de quem instalou antes param de agir sozinhos (sem e-mail duplicado). Para limpar de vez, quem instalou antes usa **🧹 Remover meus gatilhos**.

Enquanto isso, os e-mails já vão com o **nome da TL** como remetente e com as **respostas indo para ela**.

## Rotinas automáticas

- `extracaoD1` (todo dia à 1h): grava a extração D-1 em JSON.
- `rotinaDiaria` (dias úteis, na hora configurada): sincroniza, envia lembretes de data acordo e, às segundas, o resumo dos parados.
- `sincronizarAgendado` (a cada 2h, dias úteis 7h–20h): regrava o JSON da visão Agora.
