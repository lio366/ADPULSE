from __future__ import annotations

from typing import Dict, List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from eco_ia.agents import build_agent_registry

app = FastAPI(title="ECO-IA Agent Runtime", version="1.0.0")

agent_registry = {agent.name: agent for agent in build_agent_registry()}


class AgentTaskRequest(BaseModel):
    job_id: str = Field(min_length=1, max_length=200)
    task: str = Field(min_length=1, max_length=4000)
    source: str = Field(default="ECO-IA", max_length=80)


@app.get("/health")
def health() -> Dict[str, object]:
    return {
        "status": "ok",
        "service": "eco-ia",
        "agents": len(agent_registry),
    }


@app.get("/agents")
def list_agents() -> Dict[str, List[Dict[str, object]]]:
    return {"agents": [agent.snapshot() for agent in agent_registry.values()]}


@app.post("/agents/{name}/execute")
def execute_agent_task(name: str, request: AgentTaskRequest) -> Dict[str, object]:
    agent = agent_registry.get(name.strip().upper())
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent {name} not found")

    return agent.execute_task(request.job_id, request.task, request.source)


@app.post("/agents/{name}/repair")
def repair_agent(name: str) -> Dict[str, object]:
    agent = agent_registry.get(name.upper())
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent {name} not found")

    result = agent.repair_self()
    return {
        "name": result["name"],
        "status": result["status"],
        "health": result["health"],
        "repair_cycles": result["repair_cycles"],
    }


@app.post("/agents/{name}/care")
def care_agent(name: str) -> Dict[str, object]:
    agent = agent_registry.get(name.upper())
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent {name} not found")

    result = agent.care()
    return {
        "name": result["name"],
        "care_mode": result["care_mode"],
        "status": result["status"],
        "care_score": result["care_score"],
    }


@app.post("/agents/{name}/sustain")
def sustain_agent(name: str) -> Dict[str, object]:
    agent = agent_registry.get(name.upper())
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent {name} not found")

    result = agent.sustain()
    return {
        "name": result["name"],
        "sustain_mode": result["sustain_mode"],
        "status": result["status"],
        "energy": result["energy"],
    }
