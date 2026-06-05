/**
 * ── BATERIA 1: ROTEAMENTO DE CANAL ────────────────────────
 *
 * 15 testes validando que cada tipo de mensagem vai pro canal correto.
 */

import { describe, test, expect } from "vitest"
import { selectBestChannel, getMessageTypeForAction } from "../channel-selector"
import type { ChannelName } from "../channel-map"

describe("Roteamento de Canal", () => {

  // ═══════════════════════════════════════════════════════
  // AGENTE: Maya (STRATEGIST)
  // ═══════════════════════════════════════════════════════

  describe("Maya Ferreira (Estrategista)", () => {

    test("Maya-01: Calendario → #estrategia", () => {
      const channel = selectBestChannel({
        content: "Calendario da semana criado. 5 posts planejados, prioridade: Dia do Cliente.",
        agentId: "maya-id",
        agentRole: "STRATEGIST",
        messageType: "calendar_created",
        metadata: {},
      })
      expect(channel).toBe("estrategia")
    })

    test("Maya-02: Copy pronta → #aprovacoes", () => {
      const channel = selectBestChannel({
        content: "3 variacoes de copy prontas. CEO, aprova?",
        agentId: "maya-id",
        agentRole: "STRATEGIST",
        messageType: "content_ready",
        metadata: { needsCEOApproval: true },
      })
      expect(channel).toBe("aprovações")
    })

    test("Maya-03: Decisao com dados → #geral", () => {
      const channel = selectBestChannel({
        content: "Vamos mudar para conteudo de treino baseado nos dados da Lena.",
        agentId: "maya-id",
        agentRole: "STRATEGIST",
        messageType: "strategic_decision",
        metadata: {},
      })
      // Decisão geral de estratégia vai pro geral (não tem um canal mais específico)
      expect(["geral", "estrategia"]).toContain(channel)
    })
  })

  // ═══════════════════════════════════════════════════════
  // AGENTE: Carlos (DESIGNER)
  // ═══════════════════════════════════════════════════════

  describe("Carlos Lima (Designer)", () => {

    test("Carlos-01: Arte pronta → #aprovacoes", () => {
      const channel = selectBestChannel({
        content: "Arte Dia do Cliente pronta. Carrossel 5 slides. CEO, aprova?",
        agentId: "carlos-id",
        agentRole: "DESIGNER",
        messageType: "content_ready",
        metadata: { needsCEOApproval: true },
      })
      expect(channel).toBe("aprovações")
    })

    test("Carlos-02: Bloqueio API → #alertas", () => {
      const channel = selectBestChannel({
        content: "Bloqueado: API Canva fora do ar. @Maya, preciso de ajuda.",
        agentId: "carlos-id",
        agentRole: "DESIGNER",
        messageType: "task_blocked",
        metadata: { isBlocked: true, urgency: "high" },
      })
      expect(channel).toBe("alertas")
    })

    test("Carlos-03: Arte em andamento → #criativo", () => {
      const channel = selectBestChannel({
        content: "Nova arte do Dia do Cliente criada no Figma.",
        agentId: "carlos-id",
        agentRole: "DESIGNER",
        messageType: "artwork_created",
        metadata: {},
      })
      expect(channel).toBe("criativo")
    })
  })

  // ═══════════════════════════════════════════════════════
  // AGENTE: Lena (ANALYST)
  // ═══════════════════════════════════════════════════════

  describe("Lena Souza (Analista)", () => {

    test("Lena-01: Relatorio semanal → #metricas", () => {
      const channel = selectBestChannel({
        content: "Relatorio semanal: engajamento subiu 8%, alcance caiu 3%.",
        agentId: "lena-id",
        agentRole: "ANALYST",
        messageType: "weekly_report",
        metadata: {},
      })
      expect(channel).toBe("metricas")
    })

    test("Lena-02: Alerta critico → #alertas", () => {
      const channel = selectBestChannel({
        content: "⚠️ Engajamento caiu 15% esta semana. Causa: posts institucionais.",
        agentId: "lena-id",
        agentRole: "ANALYST",
        messageType: "metric_alert",
        metadata: { isAlert: true, urgency: "critical", metricChange: -15 },
      })
      expect(channel).toBe("alertas")
    })

    test("Lena-03: Voto em conflito → #aprovacoes", () => {
      const channel = selectBestChannel({
        content: "Voto em conteudo de treino. Dados mostram 86% melhor performance vs suplementos.",
        agentId: "lena-id",
        agentRole: "ANALYST",
        messageType: "team_vote",
        metadata: {},
      })
      expect(channel).toBe("aprovações")
    })
  })

  // ═══════════════════════════════════════════════════════
  // AGENTE: Bruno (SOCIAL_MEDIA)
  // ═══════════════════════════════════════════════════════

  describe("Bruno Costa (Social Media)", () => {

    test("Bruno-01: Post agendado → #instagram", () => {
      const channel = selectBestChannel({
        content: "Post agendado para quinta 18h.",
        agentId: "bruno-id",
        agentRole: "SOCIAL_MEDIA",
        messageType: "post_scheduled",
        metadata: { platform: "instagram" },
      })
      expect(channel).toBe("instagram")
    })

    test("Bruno-02: Trend identificada → #instagram", () => {
      const channel = selectBestChannel({
        content: "Trend 'POV: voce descobriu X' bombando. Sugiro fazermos nossa versao.",
        agentId: "bruno-id",
        agentRole: "SOCIAL_MEDIA",
        messageType: "identify_trend",
        metadata: {},
      })
      expect(channel).toBe("instagram")
    })

    test("Bruno-03: Post LinkedIn → #linkedin", () => {
      const channel = selectBestChannel({
        content: "Artigo B2B sobre marketing digital pronto para revisao no LinkedIn.",
        agentId: "bruno-id",
        agentRole: "SOCIAL_MEDIA",
        messageType: "linkedin_content",
        metadata: { platform: "linkedin" },
      })
      expect(channel).toBe("linkedin")
    })
  })

  // ═══════════════════════════════════════════════════════
  // AGENTE: Diego (SEO)
  // ═══════════════════════════════════════════════════════

  describe("Diego Ramos (SEO)", () => {

    test("Diego-01: Keywords → #blog-seo", () => {
      const channel = selectBestChannel({
        content: "Pesquisa de palavras-chave concluida. 5 oportunidades identificadas.",
        agentId: "diego-id",
        agentRole: "SEO",
        messageType: "seo_research",
        metadata: { taskType: "seo" },
      })
      expect(channel).toBe("blog-seo")
    })

    test("Diego-02: Blog post otimizado → #blog-seo", () => {
      const channel = selectBestChannel({
        content: "Blog post /treino-de-perna otimizado. 7 melhorias on-page aplicadas.",
        agentId: "diego-id",
        agentRole: "SEO",
        messageType: "content_optimization",
        metadata: {},
      })
      expect(channel).toBe("blog-seo")
    })

    test("Diego-03: Oportunidade → #blog-seo", () => {
      const channel = selectBestChannel({
        content: "Oportunidade: keyword 'treino para iniciantes' com baixa concorrencia, 1300 buscas/mes.",
        agentId: "diego-id",
        agentRole: "SEO",
        messageType: "identify_opportunity",
        metadata: {},
      })
      // SEO finds → goes to blog-seo (actionable for content team)
      expect(channel).toBe("blog-seo")
    })
  })
})

describe("MessageType → Action Mapping", () => {

  test("complete_task mapeia para task_completed", () => {
    expect(getMessageTypeForAction("complete_task")).toBe("task_completed")
  })

  test("request_approval mapeia para request_approval", () => {
    expect(getMessageTypeForAction("request_approval")).toBe("request_approval")
  })

  test("speak_in_daily mapeia para daily_speech", () => {
    expect(getMessageTypeForAction("speak_in_daily")).toBe("daily_speech")
  })

  test("report_progress mapeia para task_progress", () => {
    expect(getMessageTypeForAction("report_progress")).toBe("task_progress")
  })

  test("acao desconhecida retorna o proprio nome", () => {
    expect(getMessageTypeForAction("some_unknown_action")).toBe("some_unknown_action")
  })
})

describe("Edge Cases de Canal", () => {

  test("Mensagem vazia → #geral (fallback seguro)", () => {
    const channel = selectBestChannel({
      content: "",
      agentId: "any-id",
      agentRole: "STRATEGIST",
      messageType: "unknown",
      metadata: {},
    })
    expect(channel).toBe("geral")
  })

  test("Aprovacao com 'aguardando' → #aprovacoes", () => {
    const channel = selectBestChannel({
      content: "Tarefa concluida, aguardando sua revisao.",
      agentId: "maya-id",
      agentRole: "STRATEGIST",
      messageType: "task_completed",
      metadata: { needsCEOApproval: true },
    })
    expect(channel).toBe("aprovações")
  })

  test("Conteudo com 'aprovar' no texto → #aprovacoes", () => {
    const channel = selectBestChannel({
      content: "CEO, pode aprovar a arte que o Carlos fez?",
      agentId: "bruno-id",
      agentRole: "SOCIAL_MEDIA",
      messageType: "post_message",
      metadata: {},
    })
    expect(channel).toBe("aprovações")
  })

  test("Sprint/roadmap → #estrategia", () => {
    const channel = selectBestChannel({
      content: "Roadmap da sprint atualizado com as prioridades.",
      agentId: "maya-id",
      agentRole: "STRATEGIST",
      messageType: "strategy_change",
      metadata: {},
    })
    expect(channel).toBe("estrategia")
  })

  test("Celebracao → #resultados", () => {
    const channel = selectBestChannel({
      content: "Alcancamos 5.000 seguidores! Melhor semana do mes!",
      agentId: "bruno-id",
      agentRole: "SOCIAL_MEDIA",
      messageType: "milestone_reached",
      metadata: {},
    })
    expect(channel).toBe("resultados")
  })

  test("Erro critico sempre → #alertas", () => {
    const channel = selectBestChannel({
      content: "Sistema de agendamento esta fora do ar. Posts programados nao foram publicados.",
      agentId: "bruno-id",
      agentRole: "SOCIAL_MEDIA",
      messageType: "api_error",
      metadata: { isAlert: true, urgency: "critical" },
    })
    expect(channel).toBe("alertas")
  })

  test("Daily speech → #daily-standup", () => {
    const channel = selectBestChannel({
      content: "Hoje vou focar em finalizar o calendario e revisar as copies do cliente.",
      agentId: "maya-id",
      agentRole: "STRATEGIST",
      messageType: "daily_speech",
      metadata: {},
    })
    expect(channel).toBe("daily-standup")
  })

  test("Nenhuma mensagem critica vai parar no #geral", () => {
    const criticalScenarios = [
      { content: "CEO, preciso de aprovacao", type: "approval_request", meta: { needsCEOApproval: true } },
      { content: "Tarefa bloqueada pela API", type: "task_blocked", meta: { isBlocked: true } },
      { content: "Metricas cairam 20%", type: "metric_alert", meta: { isAlert: true } },
    ]

    for (const scenario of criticalScenarios) {
      const channel = selectBestChannel({
        content: scenario.content,
        agentId: "test-id",
        agentRole: "ANALYST",
        messageType: scenario.type,
        metadata: scenario.meta,
      })
      expect(channel).not.toBe("geral")
    }
  })

  test("Pre-daily → #daily-standup", () => {
    const channel = selectBestChannel({
      content: "Preparando daily de hoje. Backlog com 12 tarefas pendentes.",
      agentId: "maya-id",
      agentRole: "STRATEGIST",
      messageType: "pre_daily",
      metadata: {},
    })
    expect(channel).toBe("daily-standup")
  })

  test("Daily checkpoint → #metricas", () => {
    const channel = selectBestChannel({
      content: "Checkpoint 17h. Progresso do dia.",
      agentId: "lena-id",
      agentRole: "ANALYST",
      messageType: "daily_checkpoint",
      metadata: {},
    })
    expect(channel).toBe("metricas")
  })
})
