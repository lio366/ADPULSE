from fastapi.testclient import TestClient

from eco_ia.app import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_agent_list_and_self_healing():
    response = client.get("/agents")
    assert response.status_code == 200
    data = response.json()
    assert len(data["agents"]) >= 3
    assert any(agent["name"] == "EXPLORADOR" for agent in data["agents"])

    repair = client.post("/agents/EXPLORADOR/repair")
    assert repair.status_code == 200
    assert repair.json()["status"] in {"repaired", "healthy"}


def test_care_and_sustain_endpoints():
    care = client.post("/agents/GUARDIÁN/care")
    assert care.status_code == 200
    assert care.json()["care_mode"] == "active"

    sustain = client.post("/agents/ESTRATEGA/sustain")
    assert sustain.status_code == 200
    assert sustain.json()["sustain_mode"] == "active"


def test_agent_task_execution_tracks_work_and_self_maintenance():
    agents = client.get("/agents").json()["agents"]
    assert {agent["name"] for agent in agents} == {
        "ECO-IA",
        "EXPLORADOR",
        "ESTRATEGA",
        "CREADOR",
        "DISTRIBUIDOR",
        "OPTIMIZADOR",
        "GUARDIÁN",
    }

    response = client.post(
        "/agents/EXPLORADOR/execute",
        json={"job_id": "job-audit-1", "task": "Review lead sources", "source": "ECO-IA"},
    )

    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "processed"
    assert result["agent"] == "EXPLORADOR"
    assert result["agent_state"]["tasks_processed"] == 1
    assert result["agent_state"]["last_task"] == "Review lead sources"


def test_agent_task_rejects_unknown_specialist():
    response = client.post(
        "/agents/UNKNOWN/execute",
        json={"job_id": "job-audit-2", "task": "Do work"},
    )
    assert response.status_code == 404
