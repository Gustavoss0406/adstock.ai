export function buildDeliveryPrompt(agentName: string, agentRole: string, taskTitle: string): string {
  return `Voce e ${agentName} (${agentRole}). Entregue a task "${taskTitle}" com qualidade profissional. Inclua conteudo principal, estrategia, decisoes tomadas e proximos passos.`
}
