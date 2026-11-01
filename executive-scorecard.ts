export type ExecutiveCard = {
  label: string;
  value: string;
  delta: string;
  tone: "success" | "info" | "warning";
};

export function buildExecutiveScorecard(state: {
  missions: Array<{ status?: string; progress?: number }>;
  agents: Array<{ enabled?: boolean }>;
  settings: { dailyBudget?: number; approvalLimit?: number };
  tick?: number;
}) {
  const totalMissions = state.missions.length || 1;
  const active = state.missions.filter((mission) => mission.status === "active").length;
  const done = state.missions.filter((mission) => mission.status === "done").length;
  const pending = state.missions.filter((mission) => mission.status === "approval").length;
  const enabledAgents = state.agents.filter((agent) => agent.enabled).length;

  const executionScore = Math.min(100, Math.round((done / totalMissions) * 100 + (active / totalMissions) * 25));
  const controlScore = Math.max(0, 100 - pending * 18 - (6 - enabledAgents) * 12);
  const growthScore = Math.min(100, 42 + (state.tick ?? 0) * 3 + active * 7);
  const roiScore = Math.min(100, Math.round(((state.settings.dailyBudget ?? 0) / Math.max(1, state.settings.approvalLimit ?? 1)) * 10));

  const scorecards: ExecutiveCard[] = [
    {
      label: "Efectividad operativa",
      value: `${executionScore}%`,
      delta: `${done} ciclos cerrados`,
      tone: executionScore >= 70 ? "success" : "info",
    },
    {
      label: "Control del riesgo",
      value: `${controlScore}%`,
      delta: `${pending} decisiones por aprobar`,
      tone: pending > 0 ? "warning" : "success",
    },
    {
      label: "Crecimiento del pipeline",
      value: `${growthScore}%`,
      delta: `Ciclo #${(state.tick ?? 0).toString().padStart(4, "0")}`,
      tone: "info",
    },
    {
      label: "Rentabilidad del plan",
      value: `${roiScore}%`,
      delta: `${state.settings.dailyBudget ?? 0} USD/día`,
      tone: roiScore >= 70 ? "success" : "warning",
    },
  ];

  const priorities = [
    pending > 0 ? `Aprobación: ${pending} decisiones pendientes de CEO` : "Aprobación: sin bloqueos actuales",
    enabledAgents < 6 ? `Operación: ${6 - enabledAgents} agentes en pausa` : "Operación: todos los agentes activos",
    active > 0 ? `Pipeline: ${active} misiones trabajando en paralelo` : "Pipeline: sin misiones activas",
    `Ejecución: ${Math.max(1, Math.round((done / totalMissions) * 100))}% del portafolio en cerrados`,
  ];

  return { scorecards, priorities };
}
