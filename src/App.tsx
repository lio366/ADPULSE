import { useEffect, useState } from "react";

type ModuleItem = {
  name: string;
  status: string;
  detail: string;
  metric: string;
  tone: string;
};

type SummaryCard = {
  label: string;
  value: string;
};

type Snapshot = {
  summary: {
    leadsQualified: number;
    activeOpportunities: number;
    automatedTasks: number;
    roiEstimated: string;
  };
  modules: ModuleItem[];
  pipeline: Array<{ name: string; stage: string; score: string; owner: string }>;
  actionQueue: string[];
  governance: Array<{ label: string; value: string }>;
  customers: Array<{ name: string; plan: string; revenue: string; health: string }>;
  automations: Array<{ label: string; value: string }>;
  tenants: Array<{ name: string; plan: string; region: string; seats: number; status: string }>;
  roles: Array<{ name: string; description: string }>;
};

const fallbackSnapshot: Snapshot = {
  summary: {
    leadsQualified: 1240,
    activeOpportunities: 184,
    automatedTasks: 96,
    roiEstimated: "3.8x",
  },
  modules: [
    {
      name: "Captación",
      status: "Autónoma",
      detail: "Campañas, anuncios y leads en curso",
      metric: "+38% demanda",
      tone: "cyan",
    },
    {
      name: "Comercial",
      status: "Sincronizada",
      detail: "CRM, seguimiento y cierre automatizado",
      metric: "42 oportunidades",
      tone: "blue",
    },
    {
      name: "Operación",
      status: "Ejecutando",
      detail: "Servicios, inventario y logística coordinados",
      metric: "96% SLA",
      tone: "green",
    },
    {
      name: "Gobernanza",
      status: "Protegida",
      detail: "Auditoría, seguridad y reglas de control",
      metric: "0 incidentes",
      tone: "amber",
    },
  ],
  pipeline: [
    { name: "AutoService Premium", stage: "Calificación", score: "92%", owner: "IA scout" },
    { name: "Mantenimiento flota", stage: "Negociación", score: "81%", owner: "CRM IA" },
    { name: "Campaña local", stage: "Ejecución", score: "74%", owner: "Operación" },
  ],
  actionQueue: [
    "Reactivar 18 leads con baja respuesta",
    "Ajustar presupuesto de Meta Ads por ROAS",
    "Reprogramar cita de cliente premium",
    "Validar inventario crítico antes del cierre",
  ],
  governance: [
    { label: "Revisión automática", value: "Cumplida" },
    { label: "Riesgos detectados", value: "2" },
    { label: "Aprobaciones", value: "5 pendientes" },
  ],
  customers: [
    { name: "Autofix Center", plan: "Pro", revenue: "$12.4k", health: "Muy buena" },
    { name: "Ruta 24", plan: "Scale", revenue: "$8.7k", health: "Buena" },
    { name: "Moto Verde", plan: "Starter", revenue: "$4.3k", health: "Atención" },
  ],
  automations: [
    { label: "Lead scoring", value: "Activa" },
    { label: "CRM follow-up", value: "Activa" },
    { label: "Asignación de tareas", value: "Activa" },
    { label: "Aprobaciones automáticas", value: "Supervisada" },
  ],
  tenants: [
    { name: "Autofix Center", plan: "Pro", region: "Florida", seats: 24, status: "Activa" },
    { name: "Ruta 24", plan: "Scale", region: "Texas", seats: 18, status: "Activa" },
    { name: "Moto Verde", plan: "Starter", region: "Georgia", seats: 8, status: "Pendiente" },
  ],
  roles: [
    { name: "Admin", description: "Control total del tenant" },
    { name: "Operador", description: "Gestión de flujo" },
    { name: "Ventas", description: "CRM y oportunidades" },
    { name: "Cliente", description: "Portal y seguimiento" },
  ],
};

export default function App({ initialTenant = "Autofix Center" }: { initialTenant?: string } = {}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selectedTenant, setSelectedTenant] = useState(initialTenant);
  const [tenantProfile, setTenantProfile] = useState<{
    name: string;
    plan: string;
    region: string;
    seats: number;
    status: string;
    owner: string;
    spend: string;
    security: string;
    retention: string;
    risk: string;
    permissions: string[];
  } | null>(null);
  const [billingProfile, setBillingProfile] = useState<{
    tenantName: string;
    plan: string;
    status: string;
    nextInvoice: string;
    amount: string;
    seatsInUse: number;
    seatsIncluded: number;
    renewal: string;
    paymentMethod: string;
    arr: string;
    health: string;
  } | null>(null);
  const [rbacProfile, setRbacProfile] = useState<{
    tenantName: string;
    policy: string;
    roles: Array<{ name: string; permissions: string[] }>;
    members: Array<{ name: string; role: string; status: string }>;
    scope: string[];
  } | null>(null);
  const [onboardingProfile, setOnboardingProfile] = useState<{
    tenantName: string;
    status: string;
    owner: string;
    nextMilestone: string;
    checklist: Array<{ task: string; done: boolean }>;
    owners: Array<{ name: string; role: string }>;
    eta: string;
  } | null>(null);
  const [agentNetwork, setAgentNetwork] = useState<{
    core: string;
    health: string;
    uptime: string;
    agentRuntime?: { service: string; status: string; agents: number; source: string; lastUpdated: string };
    agents: Array<{ name: string; role: string; status: string; load: string; focus: string }>;
    flows: Array<{ from: string; to: string; message: string }>;
  } | null>(null);
  const [agentQueue, setAgentQueue] = useState<{
    core: string;
    queueName: string;
    jobs: Array<{ id: string; from: string; to: string; task: string; status: string; lastMessage: string }>;
    handoffs: Array<{ step: number; from: string; to: string; summary: string }>;
  } | null>(null);
  const [governanceState, setGovernanceState] = useState<{
    tenantName: string;
    status: string;
    mode: string;
    risk: string;
    nextAction: string;
    controls: Array<{ name: string; status: string; detail: string }>;
    connectors: Array<{ name: string; status: string; configured: boolean; ready: boolean; detail: string }>;
  } | null>(null);
  const [activationMessage, setActivationMessage] = useState("");
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    let isMounted = true;

    fetch("/api/saas/summary")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Summary unavailable");
        }
        return response.json() as Promise<Snapshot>;
      })
      .then((payload) => {
        if (isMounted) {
          setSnapshot(payload);
          if (payload.tenants.length > 0) {
            setSelectedTenant(payload.tenants[0].name);
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          setSnapshot(fallbackSnapshot);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetch(`/api/saas/tenant/${encodeURIComponent(selectedTenant)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Tenant profile unavailable");
        }
        return response.json() as Promise<{ tenant: typeof tenantProfile }>;
      })
      .then((payload) => {
        if (isMounted) {
          setTenantProfile(payload.tenant);
        }
      })
      .catch(() => {
        if (isMounted) {
          const tenant = (snapshot ?? fallbackSnapshot).tenants.find((item) => item.name === selectedTenant);
          setTenantProfile(
            tenant
              ? {
                  name: tenant.name,
                  plan: tenant.plan,
                  region: tenant.region,
                  seats: tenant.seats,
                  status: tenant.status,
                  owner: "Administrador",
                  spend: "$0/mes",
                  security: "Alta",
                  retention: "94%",
                  risk: "Bajo",
                  permissions: ["Admin", "Operador", "Ventas", "Cliente"],
                }
              : {
                  name: selectedTenant,
                  plan: "Pro",
                  region: "N/A",
                  seats: 0,
                  status: "Activa",
                  owner: "Administrador",
                  spend: "$0/mes",
                  security: "Alta",
                  retention: "94%",
                  risk: "Bajo",
                  permissions: ["Admin", "Operador"],
                },
          );
        }
      });

    fetch(`/api/saas/billing/${encodeURIComponent(selectedTenant)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Billing unavailable");
        }
        return response.json() as Promise<{ billing: typeof billingProfile }>;
      })
      .then((payload) => {
        if (isMounted) {
          setBillingProfile(payload.billing);
        }
      })
      .catch(() => {
        if (isMounted) {
          setBillingProfile({
            tenantName: selectedTenant,
            plan: "Pro",
            status: "Pagado",
            nextInvoice: "2026-11-28",
            amount: "$0",
            seatsInUse: 0,
            seatsIncluded: 1,
            renewal: "Automática",
            paymentMethod: "Tarjeta",
            arr: "$0",
            health: "Muy buena",
          });
        }
      });

    fetch(`/api/saas/rbac/${encodeURIComponent(selectedTenant)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("RBAC unavailable");
        }
        return response.json() as Promise<{ rbac: typeof rbacProfile }>;
      })
      .then((payload) => {
        if (isMounted) {
          setRbacProfile(payload.rbac);
        }
      })
      .catch(() => {
        if (isMounted) {
          setRbacProfile({
            tenantName: selectedTenant,
            policy: "RBAC_CORE_V3",
            roles: [
              { name: "Owner", permissions: ["tenant.manage", "billing.write"] },
              { name: "Admin", permissions: ["dashboard.read", "automation.execute"] },
            ],
            members: [
              { name: "Administrador", role: "Owner", status: "Activo" },
            ],
            scope: ["dashboard", "billing"],
          });
        }
      });

    fetch(`/api/saas/onboarding/${encodeURIComponent(selectedTenant)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Onboarding unavailable");
        }
        return response.json() as Promise<{ onboarding: typeof onboardingProfile }>;
      })
      .then((payload) => {
        if (isMounted) {
          setOnboardingProfile(payload.onboarding);
        }
      })
      .catch(() => {
        if (isMounted) {
          setOnboardingProfile({
            tenantName: selectedTenant,
            status: "Activación 50%",
            owner: "Administrador",
            nextMilestone: "Completar primer setup",
            checklist: [
              { task: "Conectar CRM", done: true },
              { task: "Invitar usuarios", done: false },
            ],
            owners: [{ name: "Administrador", role: "Owner" }],
            eta: "2 días",
          });
        }
      });

    fetch(`/api/saas/governance/${encodeURIComponent(selectedTenant)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Governance unavailable");
        }
        return response.json() as Promise<{ governance: typeof governanceState }>;
      })
      .then((payload) => {
        if (isMounted) {
          setGovernanceState(payload.governance ?? null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setGovernanceState({
            tenantName: selectedTenant,
            status: "protected",
            mode: "safe-mode",
            risk: "controlled",
            nextAction: "Debe haberse configurado al menos un conector antes de activar autonomía.",
            controls: [{ name: "RBAC", status: "enforced", detail: "Acceso por tenant y roles" }],
            connectors: [{ name: "CRM", status: "pending", configured: false, ready: false, detail: "Sin credenciales" }],
          });
        }
      });

    fetch("/api/saas/agents/network")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Agent network unavailable");
        }
        return response.json() as Promise<{ network: typeof agentNetwork }>;
      })
      .then((payload) => {
        if (isMounted) {
          setAgentNetwork(payload.network);
        }
      })
      .catch(() => {
        if (isMounted) {
          setAgentNetwork({
            core: "ECO-IA",
            health: "Operativo 24/7",
            uptime: "99.98%",
            agents: [
              { name: "ECO-IA", role: "Núcleo privado", status: "online", load: "100%", focus: "orquestación" },
              { name: "EXPLORADOR", role: "Investigación", status: "online", load: "82%", focus: "signal tracking" },
            ],
            flows: [
              { from: "ECO-IA", to: "EXPLORADOR", message: "Sincronización continua" },
            ],
          });
        }
      });

    fetch("/api/saas/agents/queue")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Agent queue unavailable");
        }
        return response.json() as Promise<{ queue: typeof agentQueue }>;
      })
      .then((payload) => {
        if (isMounted) {
          setAgentQueue(payload.queue);
        }
      })
      .catch(() => {
        if (isMounted) {
          setAgentQueue({
            core: "ECO-IA",
            queueName: "eco-ia-live-queue",
            jobs: [
              { id: "job-1001", from: "ECO-IA", to: "EXPLORADOR", task: "Sincronización inicial", status: "running", lastMessage: "Queue ready" },
            ],
            handoffs: [{ step: 1, from: "ECO-IA", to: "EXPLORADOR", summary: "Bienvenida y escaneo" }],
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedTenant, snapshot]);

  const data = snapshot ?? fallbackSnapshot;
  const selected = data.tenants.find((tenant) => tenant.name === selectedTenant) ?? data.tenants[0];

  const handleActivationToggle = async () => {
    if (!governanceState) return;

    const targetMode = governanceState.mode === "safe-mode" ? "autonomous" : "safe-mode";
    setIsActivating(true);
    setActivationMessage("");

    try {
      const response = await fetch(`/api/saas/governance/${encodeURIComponent(selectedTenant)}/activate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tenant-id": selectedTenant,
          "x-user-role": "admin",
        },
        body: JSON.stringify({ mode: targetMode }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo cambiar el modo del tenant.");
      }

      setGovernanceState(payload.governance ?? null);
      setActivationMessage(
        payload.mode === "autonomous"
          ? "Modo autónomo activado con guardrails activos."
          : "Modo seguro restaurado para el tenant.",
      );
    } catch (error) {
      setActivationMessage(
        error instanceof Error ? error.message : "No se pudo activar la operación autónoma.",
      );
    } finally {
      setIsActivating(false);
    }
  };

  const summaryCards: SummaryCard[] = [
    { label: "Leads calificados", value: data.summary.leadsQualified.toLocaleString("es-ES") },
    { label: "Ventanas abiertas", value: String(data.summary.activeOpportunities) },
    { label: "Tareas automatizadas", value: `${data.summary.automatedTasks}%` },
    { label: "ROI estimado", value: data.summary.roiEstimated },
  ];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AdPulse</p>
          <h1>Plataforma SaaS automatizada por IA</h1>
        </div>
        <div className="topbar-actions">
          {governanceState && (
            <span className={`mode-pill ${governanceState.mode === "safe-mode" ? "safe" : "auto"}`}>
              {governanceState.mode === "safe-mode" ? "Modo seguro" : "Autónomo"}
            </span>
          )}
          <button
            type="button"
            className="primary-button"
            onClick={handleActivationToggle}
            disabled={isActivating}
          >
            {isActivating
              ? "Actualizando..."
              : governanceState?.mode === "safe-mode"
                ? "Activar modo autónomo"
                : "Poner en modo seguro"}
          </button>
        </div>
      </header>

      {activationMessage && <div className="activation-message">{activationMessage}</div>}

      {governanceState && (
        <section className="governance-live-panel panel">
          <div className="panel-header">
            <h2>Control operativo</h2>
            <span>{governanceState.mode === "safe-mode" ? "SAFE MODE" : "AUTÓNOMO"}</span>
          </div>
          <div className="control-grid">
            <div className="network-box">
              <h3>Controles</h3>
              <div className="control-list">
                {governanceState.controls.map((control) => (
                  <div key={control.name} className="control-item">
                    <div>
                      <strong>{control.name}</strong>
                      <small>{control.detail}</small>
                    </div>
                    <span className={`queue-status ${control.status === "enforced" || control.status === "active" ? "running" : "queued"}`}>
                      {control.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="network-box">
              <h3>Conectores</h3>
              <div className="control-list">
                {governanceState.connectors.map((connector) => (
                  <div key={connector.name} className="control-item">
                    <div>
                      <strong>{connector.name}</strong>
                      <small>{connector.detail}</small>
                    </div>
                    <span className={`queue-status ${connector.ready ? "running" : "queued"}`}>
                      {connector.status}
                    </span>
                  </div>
                ))}
              </div>
              <div className="milestone-box">
                <span>Próximo paso</span>
                <strong>{governanceState.nextAction}</strong>
              </div>
            </div>
          </div>
        </section>
      )}

      <nav className="main-nav" aria-label="Navegación principal">
        <span>Dashboard</span>
        <span>Clientes</span>
        <span>Automatización</span>
        <span>Finanzas</span>
        <span>Configuración</span>
      </nav>

      <section className="hero-panel">
        <div className="hero-copy">
          <span className="badge">Sistema coordinado</span>
          <p>
            La plataforma SaaS reúne adquisición, ventas, operación y control bajo una
            capa de IA que ejecuta decisiones, prioriza tareas y protege el negocio.
          </p>
        </div>
        <div className="hero-kpis">
          {summaryCards.map((stat) => (
            <div key={stat.label} className="kpi-box">
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="tenant-selector-panel">
        <div className="panel-header">
          <h2>Tenants activos</h2>
          <span>{selected ? selected.plan : "Tenant"}</span>
        </div>
        <div className="tenant-chip-row">
          {data.tenants.map((tenant) => (
            <button
              key={tenant.name}
              type="button"
              className={`tenant-chip ${selectedTenant === tenant.name ? "active" : ""}`}
              onClick={() => setSelectedTenant(tenant.name)}
            >
              {tenant.name}
            </button>
          ))}
        </div>
      </section>

      {tenantProfile && (
        <section className="tenant-profile-panel panel">
          <div className="panel-header">
            <h2>{tenantProfile.name}</h2>
            <span>{tenantProfile.plan}</span>
          </div>
          <div className="tenant-profile-grid">
            <div className="profile-stat"><span>Propietario</span><strong>{tenantProfile.owner}</strong></div>
            <div className="profile-stat"><span>Región</span><strong>{tenantProfile.region}</strong></div>
            <div className="profile-stat"><span>Seats</span><strong>{tenantProfile.seats}</strong></div>
            <div className="profile-stat"><span>Gasto</span><strong>{tenantProfile.spend}</strong></div>
            <div className="profile-stat"><span>Seguridad</span><strong>{tenantProfile.security}</strong></div>
            <div className="profile-stat"><span>Retención</span><strong>{tenantProfile.retention}</strong></div>
            <div className="profile-stat"><span>Riesgo</span><strong>{tenantProfile.risk}</strong></div>
            <div className="profile-stat"><span>Estado</span><strong>{tenantProfile.status}</strong></div>
          </div>
          <div className="tenant-permissions">
            {tenantProfile.permissions.map((permission) => (
              <span key={permission} className="permission-pill">{permission}</span>
            ))}
          </div>
        </section>
      )}

      {billingProfile && (
        <section className="billing-panel panel">
          <div className="panel-header">
            <h2>Facturación y plan</h2>
            <span>{billingProfile.status}</span>
          </div>
          <div className="billing-grid">
            <div className="billing-stat"><span>Plan</span><strong>{billingProfile.plan}</strong></div>
            <div className="billing-stat"><span>ARR</span><strong>{billingProfile.arr}</strong></div>
            <div className="billing-stat"><span>Próxima factura</span><strong>{billingProfile.nextInvoice}</strong></div>
            <div className="billing-stat"><span>Importe</span><strong>{billingProfile.amount}</strong></div>
            <div className="billing-stat"><span>Seats usados</span><strong>{billingProfile.seatsInUse}/{billingProfile.seatsIncluded}</strong></div>
            <div className="billing-stat"><span>Renovación</span><strong>{billingProfile.renewal}</strong></div>
            <div className="billing-stat"><span>Método</span><strong>{billingProfile.paymentMethod}</strong></div>
            <div className="billing-stat"><span>Salud</span><strong>{billingProfile.health}</strong></div>
          </div>
        </section>
      )}

      {rbacProfile && (
        <section className="rbac-panel panel">
          <div className="panel-header">
            <h2>RBAC y acceso</h2>
            <span>{rbacProfile.policy}</span>
          </div>
          <div className="rbac-layout">
            <div className="rbac-box">
              <h3>Roles</h3>
              <div className="role-grid">
                {rbacProfile.roles.map((role) => (
                  <div key={role.name} className="role-item">
                    <strong>{role.name}</strong>
                    <span>{role.permissions.join(" • ")}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rbac-box">
              <h3>Miembros</h3>
              <div className="member-list">
                {rbacProfile.members.map((member) => (
                  <div key={member.name} className="member-item">
                    <strong>{member.name}</strong>
                    <span>{member.role}</span>
                    <small>{member.status}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="scope-row">
            {rbacProfile.scope.map((item) => (
              <span key={item} className="scope-pill">{item}</span>
            ))}
          </div>
        </section>
      )}

      {onboardingProfile && (
        <section className="onboarding-panel panel">
          <div className="panel-header">
            <h2>Onboarding del tenant</h2>
            <span>{onboardingProfile.status}</span>
          </div>
          <div className="onboarding-layout">
            <div className="onboarding-box">
              <h3>Checklist de activación</h3>
              <ul className="checklist">
                {onboardingProfile.checklist.map((item) => (
                  <li key={item.task} className={item.done ? "done" : ""}>
                    <span>{item.task}</span>
                    <strong>{item.done ? "OK" : "Pendiente"}</strong>
                  </li>
                ))}
              </ul>
            </div>
            <div className="onboarding-box">
              <h3>Responsables</h3>
              <div className="owner-list">
                {onboardingProfile.owners.map((owner) => (
                  <div key={owner.name} className="owner-item">
                    <strong>{owner.name}</strong>
                    <span>{owner.role}</span>
                  </div>
                ))}
              </div>
              <div className="milestone-box">
                <span>Próximo hito</span>
                <strong>{onboardingProfile.nextMilestone}</strong>
              </div>
              <div className="eta-box">
                <span>ETA</span>
                <strong>{onboardingProfile.eta}</strong>
              </div>
            </div>
          </div>
        </section>
      )}

      {agentNetwork && (
        <section className="agent-network-panel panel">
          <div className="panel-header">
            <h2>Red de agentes 24/7</h2>
            <span>{agentNetwork.health}</span>
          </div>
          <div className="network-summary">
            <div className="network-core"><span>Núcleo</span><strong>{agentNetwork.core}</strong></div>
            <div className="network-core"><span>Uptime</span><strong>{agentNetwork.uptime}</strong></div>
            <div className="network-core"><span>Runtime</span><strong>{agentNetwork.agentRuntime?.status ?? "offline"}</strong></div>
            <div className="network-core"><span>Agentes</span><strong>{agentNetwork.agentRuntime?.agents ?? 0}</strong></div>
          </div>
          <div className="agent-network-layout">
            <div className="network-box">
              <h3>Especialistas</h3>
              <div className="network-list">
                {agentNetwork.agents.map((agent) => (
                  <div key={agent.name} className="network-agent-item">
                    <div>
                      <strong>{agent.name}</strong>
                      <span>{agent.role}</span>
                    </div>
                    <div className="network-agent-meta">
                      <small>{agent.status}</small>
                      <small>{agent.load}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="network-box">
              <h3>Flujos de comunicación</h3>
              <div className="flow-list">
                {agentNetwork.flows.map((flow) => (
                  <div key={`${flow.from}-${flow.to}`} className="flow-item">
                    <strong>{flow.from}</strong>
                    <span>→</span>
                    <strong>{flow.to}</strong>
                    <small>{flow.message}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {agentQueue && (
        <section className="queue-panel panel">
          <div className="panel-header">
            <h2>Cola de trabajo ECO-IA</h2>
            <span>{agentQueue.queueName}</span>
          </div>
          <div className="queue-layout">
            <div className="network-box">
              <h3>Trabajos activos</h3>
              <div className="queue-list">
                {agentQueue.jobs.map((job) => (
                  <div key={job.id} className="queue-item">
                    <div className="queue-item-head">
                      <strong>{job.task}</strong>
                      <span className={`queue-status ${job.status}`}>{job.status}</span>
                    </div>
                    <div className="queue-item-body">
                      <small>{job.from}</small>
                      <span>→</span>
                      <small>{job.to}</small>
                    </div>
                    <p>{job.lastMessage}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="network-box">
              <h3>Handoffs</h3>
              <div className="handoff-list">
                {agentQueue.handoffs.map((handoff) => (
                  <div key={handoff.step} className="handoff-item">
                    <strong>{handoff.step}</strong>
                    <span>{handoff.from}</span>
                    <small>→</small>
                    <span>{handoff.to}</span>
                    <p>{handoff.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="modules-grid">
        {data.modules.map((module) => (
          <article key={module.name} className={`module-card ${module.tone}`}>
            <div className="module-head">
              <span className="module-title">{module.name}</span>
              <span className="module-status">{module.status}</span>
            </div>
            <p className="module-detail">{module.detail}</p>
            <div className="module-foot">
              <strong>{module.metric}</strong>
              <button type="button">Ver flujo</button>
            </div>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Pipeline inteligente</h2>
            <span>Live</span>
          </div>
          <div className="pipeline-list">
            {data.pipeline.map((item) => (
              <div key={item.name} className="pipeline-item">
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.owner}</small>
                </div>
                <div className="pipeline-meta">
                  <span>{item.stage}</span>
                  <strong>{item.score}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Cola de acciones</h2>
            <span>IA</span>
          </div>
          <ul className="action-list">
            {data.actionQueue.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="panel governance-panel">
          <div className="panel-header">
            <h2>Gobernanza</h2>
            <span>Segura</span>
          </div>
          <div className="governance-grid">
            {data.governance.map((item) => (
              <div key={item.label} className="gov-box">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bottom-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Clientes activos</h2>
            <span>Negocio</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Plan</th>
                <th>Ingreso</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.customers.map((customer) => (
                <tr key={customer.name}>
                  <td>{customer.name}</td>
                  <td>{customer.plan}</td>
                  <td>{customer.revenue}</td>
                  <td>{customer.health}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Automatizaciones</h2>
            <span>Core</span>
          </div>
          <div className="automation-grid">
            {data.automations.map((item) => (
              <div key={item.label} className="automation-item">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="tenant-grid">
        <div className="panel full-width">
          <div className="panel-header">
            <h2>Multi-tenant model</h2>
            <span>Tenants</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Plan</th>
                <th>Región</th>
                <th>Seats</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.tenants.map((tenant) => (
                <tr key={tenant.name}>
                  <td>{tenant.name}</td>
                  <td>{tenant.plan}</td>
                  <td>{tenant.region}</td>
                  <td>{tenant.seats}</td>
                  <td>{tenant.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel full-width">
          <div className="panel-header">
            <h2>Roles y permisos</h2>
            <span>RBAC</span>
          </div>
          <div className="role-grid">
            {data.roles.map((role) => (
              <div key={role.name} className="role-item">
                <strong>{role.name}</strong>
                <span>{role.description}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
