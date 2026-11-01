from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class AgentHealth:
    health: int = 100
    energy: int = 100
    repair_cycles: int = 0
    safety_margin: int = 100
    sustain_score: int = 100
    care_score: int = 100


class EcoAgent:
    def __init__(self, name: str, role: str, focus: str):
        self.name = name
        self.role = role
        self.focus = focus
        self.health = AgentHealth()
        self.care_mode = "inactive"
        self.sustain_mode = "inactive"
        self.status = "online"
        self.tasks_processed = 0
        self.last_task: str | None = None

    def repair_self(self) -> Dict[str, str | int]:
        self.health.repair_cycles += 1
        self.health.health = min(100, self.health.health + 18)
        self.health.safety_margin = min(100, self.health.safety_margin + 10)
        self.status = "repaired" if self.health.health >= 85 else "stabilizing"
        return {
            "name": self.name,
            "status": self.status,
            "health": self.health.health,
            "repair_cycles": self.health.repair_cycles,
        }

    def sustain(self) -> Dict[str, str | int]:
        self.sustain_mode = "active"
        self.health.energy = min(100, self.health.energy + 12)
        self.health.sustain_score = min(100, self.health.sustain_score + 8)
        self.status = "sustained"
        return {
            "name": self.name,
            "sustain_mode": self.sustain_mode,
            "status": self.status,
            "energy": self.health.energy,
        }

    def care(self) -> Dict[str, str | int]:
        self.care_mode = "active"
        self.health.care_score = min(100, self.health.care_score + 10)
        self.health.energy = min(100, self.health.energy + 6)
        self.status = "cared"
        return {
            "name": self.name,
            "care_mode": self.care_mode,
            "status": self.status,
            "care_score": self.health.care_score,
        }

    def execute_task(self, job_id: str, task: str, source: str) -> Dict[str, object]:
        self.tasks_processed += 1
        self.last_task = task
        self.health.energy = max(0, self.health.energy - 8)
        self.health.health = max(0, self.health.health - 3)
        maintenance: List[Dict[str, str | int]] = []

        if self.health.health < 85:
            maintenance.append(self.repair_self())
        if self.health.energy < 40:
            maintenance.append(self.care())
            maintenance.append(self.sustain())

        return {
            "job_id": job_id,
            "agent": self.name,
            "source": source,
            "status": "processed",
            "task": task,
            "role": self.role,
            "focus": self.focus,
            "maintenance": maintenance,
            "agent_state": self.snapshot(),
        }

    def snapshot(self) -> Dict[str, object]:
        return {
            "name": self.name,
            "role": self.role,
            "focus": self.focus,
            "status": self.status,
            "health": self.health.health,
            "energy": self.health.energy,
            "care_mode": self.care_mode,
            "sustain_mode": self.sustain_mode,
            "repair_cycles": self.health.repair_cycles,
            "tasks_processed": self.tasks_processed,
            "last_task": self.last_task,
        }


class ExplorerAgent(EcoAgent):
    def __init__(self):
        super().__init__("EXPLORADOR", "market intelligence", "signals and anomalies")


class StrategistAgent(EcoAgent):
    def __init__(self):
        super().__init__("ESTRATEGA", "planning and prioritization", "roadmaps and decisions")


class GuardianAgent(EcoAgent):
    def __init__(self):
        super().__init__("GUARDIÁN", "risk and resilience", "guardrails and recovery")


class OptimizerAgent(EcoAgent):
    def __init__(self):
        super().__init__("OPTIMIZADOR", "performance tuning", "ROAS and efficiency")


class CoreOrchestratorAgent(EcoAgent):
    def __init__(self):
        super().__init__("ECO-IA", "private orchestration", "workflow coordination")


class CreatorAgent(EcoAgent):
    def __init__(self):
        super().__init__("CREADOR", "content creation", "variants and messages")


class DistributorAgent(EcoAgent):
    def __init__(self):
        super().__init__("DISTRIBUIDOR", "campaign distribution", "channels and timing")


def build_agent_registry() -> List[EcoAgent]:
    return [
        CoreOrchestratorAgent(),
        ExplorerAgent(),
        StrategistAgent(),
        CreatorAgent(),
        DistributorAgent(),
        OptimizerAgent(),
        GuardianAgent(),
    ]
