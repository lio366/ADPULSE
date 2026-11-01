import { useEffect, useReducer, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity, ArrowRight, BarChart3, Bot, Check, CheckCircle2, ChevronRight,
  CircleDollarSign, Command, Cpu, Download, Gauge, Globe2,
  Layers3, LineChart, ListChecks, LockKeyhole, Megaphone, Network, Pause,
  Play, Plus, Radar, RefreshCw, Rocket, Search, Send, Settings2, ShieldCheck,
  Sparkles, Target, TriangleAlert, Workflow, X, Zap,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link, Route, Routes } from 'react-router'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import CommercialView from '@/pages/CommercialView'
import BusinessOS from '@/pages/BusinessOS'
import CustomerPortal from '@/pages/CustomerPortal'
import Login from '@/pages/Login'
import NotFound from '@/pages/NotFound'
import SalesPage from '@/pages/SalesPage'
import { LocaleSwitcher, useI18n } from '@/i18n/LocaleProvider'
import '@/i18n/locale-switcher.css'

type View = 'command' | 'agents' | 'missions' | 'policies' | 'business' | 'commercial' | 'architecture'
type AgentId = 'scout' | 'strategist' | 'creator' | 'distributor' | 'optimizer' | 'guardian'
type MissionStatus = 'active' | 'approval' | 'paused' | 'done'
type Tone = 'info' | 'success' | 'warning' | 'approval'

interface AgentDef {
  id: AgentId
  name: string
  role: string
  description: string
  input: string
  output: string
  color: string
  icon: LucideIcon
}
interface AgentState { id: AgentId; enabled: boolean; load: number }
interface Mission {
  id: string
  title: string
  objective: string
  channel: string
  budget: number
  progress: number
  stage: string
  status: MissionStatus
  agentId: AgentId
  automatic: boolean
}
interface AuditEntry {
  id: string
  time: string
  agent: string
  action: string
  tone: Tone
  prevHash: string
  hash: string
}
interface Settings {
  dailyBudget: number
  approvalLimit: number
  minRoas: number
  maxActions: number
  autoPublish: boolean
  allowBudgetShift: boolean
  selfHealing: boolean
}
interface SimState {
  running: boolean
  missions: Mission[]
  agents: AgentState[]
  audit: AuditEntry[]
  settings: Settings
  tick: number
}
type Action =
  | { type: 'TICK' }
  | { type: 'TOGGLE_RUNNING' }
  | { type: 'ADD_MISSION'; mission: Mission }
  | { type: 'APPROVE_MISSION'; id: string }
  | { type: 'TOGGLE_MISSION'; id: string }
  | { type: 'TOGGLE_AGENT'; id: AgentId }
  | { type: 'SAVE_SETTINGS'; settings: Settings }
  | { type: 'RESET' }

const AGENTS: AgentDef[] = [
  { id: 'scout', name: 'EXPLORADOR', role: 'Investigación', description: 'Detecta oportunidades, audiencias y movimientos de competidores.', input: 'Mercado, señales y competencia', output: 'Oportunidades priorizadas', color: '#22d3ee', icon: Search },
  { id: 'strategist', name: 'ESTRATEGA', role: 'Planificación', description: 'Convierte cada objetivo en una campaña con hipótesis y presupuesto.', input: 'Objetivo, margen y audiencia', output: 'Plan de campaña medible', color: '#7dd3fc', icon: Target },
  { id: 'creator', name: 'CREADOR', role: 'Contenido', description: 'Produce copys y variantes creativas listas para revisión.', input: 'Oferta, tono y canal', output: 'Copys y variantes A/B', color: '#c4b5fd', icon: Sparkles },
  { id: 'distributor', name: 'DISTRIBUIDOR', role: 'Ejecución', description: 'Programa entregas y prepara publicaciones en cada canal.', input: 'Campaña aprobada y calendario', output: 'Entregas programadas', color: '#34d399', icon: Send },
  { id: 'optimizer', name: 'OPTIMIZADOR', role: 'Rendimiento', description: 'Mide resultados y mueve recursos hacia lo que sí convierte.', input: 'Costo, conversión y ROAS', output: 'Ajustes y aprendizajes', color: '#fbbf24', icon: LineChart },
  { id: 'guardian', name: 'GUARDIÁN', role: 'Control y recuperación', description: 'Vigila límites, detiene riesgos y recupera tareas fallidas.', input: 'Reglas, salud y auditoría', output: 'Protección y auto-recuperación', color: '#f87171', icon: ShieldCheck },
]

const NAV: { id: View; label: string; short: string; icon: LucideIcon }[] = [
  { id: 'command', label: 'Centro de mando', short: 'Mando', icon: Command },
  { id: 'agents', label: 'Los 6 agentes', short: 'Agentes', icon: Bot },
  { id: 'missions', label: 'Misiones', short: 'Misiones', icon: ListChecks },
  { id: 'policies', label: 'Reglas de autonomía', short: 'Reglas', icon: Settings2 },
  { id: 'business', label: 'Modelo de negocio', short: 'Negocio', icon: BarChart3 },
  { id: 'commercial', label: 'Comercialización', short: 'Ventas', icon: CircleDollarSign },
  { id: 'architecture', label: 'Arquitectura real', short: 'Arquitectura', icon: Network },
]

const DEFAULT_SETTINGS: Settings = {
  dailyBudget: 1500,
  approvalLimit: 500,
  minRoas: 2.5,
  maxActions: 40,
  autoPublish: true,
  allowBudgetShift: true,
  selfHealing: true,
}

const MISSION_TEMPLATES = [
  { title: 'Captar leads de servicio premium', objective: 'Generar 40 solicitudes calificadas', channel: 'Meta Ads', budget: 320 },
  { title: 'Reactivar contactos sin respuesta', objective: 'Recuperar oportunidades dormidas', channel: 'Email', budget: 180 },
  { title: 'Probar una nueva oferta local', objective: 'Validar mensaje y conversión', channel: 'Google Ads', budget: 450 },
]

function stageFor(progress: number) {
  if (progress >= 100) return 'Completada'
  if (progress >= 82) return 'Midiendo resultados'
  if (progress >= 65) return 'Preparando distribución'
  if (progress >= 42) return 'Creando variantes'
  if (progress >= 20) return 'Diseñando estrategia'
  return 'Investigando oportunidad'
}
function agentFor(progress: number): AgentId {
  if (progress >= 82) return 'optimizer'
  if (progress >= 65) return 'distributor'
  if (progress >= 42) return 'creator'
  if (progress >= 20) return 'strategist'
  return 'scout'
}
function now() {
  return new Date().toLocaleTimeString('es-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function hashText(value: string) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase()
}
function appendEvents(current: AuditEntry[], events: { agent: string; action: string; tone?: Tone }[]) {
  const result = [...current]
  events.forEach((event, index) => {
    const prevHash = result.at(-1)?.hash ?? 'GENESIS'
    const time = now()
    const hash = hashText(`${prevHash}|${time}|${event.agent}|${event.action}`)
    result.push({
      id: `log-${Date.now()}-${index}-${result.length}`,
      time,
      agent: event.agent,
      action: event.action,
      tone: event.tone ?? 'info',
      prevHash,
      hash,
    })
  })
  return result
}
function initialMissions(): Mission[] {
  return [
    { id: 'm-101', title: 'Apertura de campaña local', objective: 'Conseguir solicitudes de presupuesto', channel: 'Meta Ads', budget: 650, progress: 68, stage: stageFor(68), status: 'active', agentId: agentFor(68), automatic: false },
    { id: 'm-102', title: 'Reactivación de clientes', objective: 'Recuperar contactos de los últimos 90 días', channel: 'Email', budget: 220, progress: 43, stage: stageFor(43), status: 'active', agentId: agentFor(43), automatic: false },
    { id: 'm-103', title: 'Test A/B de nueva oferta', objective: 'Comparar dos ángulos de venta', channel: 'Google Ads', budget: 800, progress: 84, stage: stageFor(84), status: 'approval', agentId: 'optimizer', automatic: false },
  ]
}
function initialState(): SimState {
  return {
    running: true,
    missions: initialMissions(),
    agents: AGENTS.map((agent, index) => ({ id: agent.id, enabled: true, load: [34, 48, 62, 38, 55, 24][index] })),
    audit: appendEvents([], [
      { agent: 'ECO-IA', action: 'Núcleo privado iniciado; seis agentes disponibles.', tone: 'success' },
      { agent: 'GUARDIÁN', action: 'Límites de gasto y aprobaciones cargados.', tone: 'info' },
      { agent: 'ESTRATEGA', action: 'Tres misiones iniciales priorizadas por impacto.', tone: 'info' },
      { agent: 'OPTIMIZADOR', action: 'Test A/B requiere aprobación por superar el límite automático.', tone: 'approval' },
    ]),
    settings: DEFAULT_SETTINGS,
    tick: 0,
  }
}
function reducer(state: SimState, action: Action): SimState {
  switch (action.type) {
    case 'TOGGLE_RUNNING':
      return { ...state, running: !state.running, audit: appendEvents(state.audit, [{ agent: 'ECO-IA', action: state.running ? 'Piloto automático pausado por el administrador.' : 'Piloto automático reanudado; ciclo de trabajo activo.', tone: state.running ? 'warning' : 'success' }]) }
    case 'ADD_MISSION':
      return { ...state, missions: [action.mission, ...state.missions], audit: appendEvents(state.audit, [{ agent: 'ECO-IA', action: `Nueva misión recibida: ${action.mission.title}.`, tone: 'success' }, { agent: 'EXPLORADOR', action: 'Investigación iniciada sin intervención manual.', tone: 'info' }]) }
    case 'APPROVE_MISSION':
      return {
        ...state,
        missions: state.missions.map(m => m.id === action.id ? { ...m, status: 'active', progress: Math.max(86, m.progress), stage: 'Optimización autorizada' } : m),
        audit: appendEvents(state.audit, [{ agent: 'ADMIN', action: 'Ejecución y presupuesto aprobados.', tone: 'success' }, { agent: 'OPTIMIZADOR', action: 'Misión reincorporada al ciclo autónomo.', tone: 'info' }]),
      }
    case 'TOGGLE_MISSION': {
      const mission = state.missions.find(m => m.id === action.id)
      if (!mission) return state
      const pausing = mission.status !== 'paused'
      return {
        ...state,
        missions: state.missions.map(m => m.id === action.id ? { ...m, status: pausing ? 'paused' : 'active' } : m),
        audit: appendEvents(state.audit, [{ agent: 'ADMIN', action: `${mission.title}: ${pausing ? 'pausada' : 'reanudada'} manualmente.`, tone: pausing ? 'warning' : 'success' }]),
      }
    }
    case 'TOGGLE_AGENT': {
      const agent = AGENTS.find(a => a.id === action.id)
      const current = state.agents.find(a => a.id === action.id)
      if (!agent || !current) return state
      return {
        ...state,
        agents: state.agents.map(a => a.id === action.id ? { ...a, enabled: !a.enabled } : a),
        audit: appendEvents(state.audit, [{ agent: 'GUARDIÁN', action: `${agent.name} ${current.enabled ? 'pausado; sus tareas quedan retenidas' : 'reactivado; tareas liberadas'}.`, tone: current.enabled ? 'warning' : 'success' }]),
      }
    }
    case 'SAVE_SETTINGS':
      return { ...state, settings: action.settings, audit: appendEvents(state.audit, [{ agent: 'GUARDIÁN', action: 'Nuevas reglas aplicadas a todos los ciclos futuros.', tone: 'success' }]) }
    case 'RESET':
      return initialState()
    case 'TICK': {
      if (!state.running) return state
      const tick = state.tick + 1
      const events: { agent: string; action: string; tone?: Tone }[] = []
      let missions = state.missions.map((mission, index) => {
        if (mission.status !== 'active') return mission
        const assigned = state.agents.find(a => a.id === mission.agentId)
        if (assigned && !assigned.enabled) return mission
        const progress = Math.min(100, mission.progress + 3 + ((tick + index) % 3))
        if (progress >= 100) {
          events.push({ agent: 'OPTIMIZADOR', action: `${mission.title}: ciclo completado y aprendizaje guardado.`, tone: 'success' })
          return { ...mission, progress: 100, status: 'done' as MissionStatus, stage: 'Completada', agentId: 'optimizer' as AgentId }
        }
        if (progress >= 65 && mission.progress < 65 && !state.settings.autoPublish) {
          events.push({ agent: 'GUARDIÁN', action: `${mission.title}: publicación externa retenida para tu aprobación.`, tone: 'approval' })
          return { ...mission, progress, status: 'approval' as MissionStatus, stage: 'Autoriza la publicación externa', agentId: 'guardian' as AgentId }
        }
        if (progress >= 82 && mission.budget > state.settings.approvalLimit) {
          events.push({ agent: 'GUARDIÁN', action: `${mission.title}: ejecución detenida para aprobación humana.`, tone: 'approval' })
          return { ...mission, progress, status: 'approval' as MissionStatus, stage: 'Esperando tu aprobación', agentId: 'guardian' as AgentId }
        }
        if (Math.floor(progress / 20) !== Math.floor(mission.progress / 20)) {
          const nextAgent = AGENTS.find(a => a.id === agentFor(progress))
          events.push({ agent: nextAgent?.name ?? 'ECO-IA', action: `${mission.title}: ${stageFor(progress).toLowerCase()}.`, tone: 'info' })
        }
        return { ...mission, progress, stage: stageFor(progress), agentId: agentFor(progress) }
      })
      if (state.settings.selfHealing && tick % 7 === 0) {
        events.push({ agent: 'GUARDIÁN', action: 'Chequeo completo: cola sana; reintento preventivo verificado.', tone: 'success' })
      }
      const activeCount = missions.filter(m => m.status === 'active').length
      if (tick % 6 === 0 && activeCount < 2 && missions.length < 9) {
        const template = MISSION_TEMPLATES[Math.floor(tick / 6) % MISSION_TEMPLATES.length]
        const mission: Mission = {
          ...template,
          id: `auto-${tick}`,
          progress: 4,
          stage: stageFor(4),
          status: 'active',
          agentId: 'scout',
          automatic: true,
        }
        missions = [...missions, mission]
        events.push({ agent: 'ECO-IA', action: `Nueva misión creada automáticamente: ${mission.title}.`, tone: 'success' })
      }
      return {
        ...state,
        tick,
        missions,
        agents: state.agents.map((agent, index) => ({ ...agent, load: agent.enabled ? 24 + ((tick * 7 + index * 13) % 61) : 0 })),
        audit: events.length ? appendEvents(state.audit, events) : state.audit,
      }
    }
    default:
      return state
  }
}
function loadState(storageKey: string): SimState {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const value = parsed as Partial<SimState>
        // Reject malformed or cross-version state instead of trusting persisted browser data.
        if (Array.isArray(value.missions) && Array.isArray(value.agents) && Array.isArray(value.audit) && value.settings && typeof value.settings === 'object') {
          return { ...initialState(), ...value } as SimState
        }
      }
    }
  } catch { /* Start clean if storage is unavailable or corrupted. */ }
  return initialState()
}
function verifyAudit(entries: AuditEntry[]) {
  if (!entries.length) return true
  let previous = entries[0].prevHash
  return entries.every(entry => {
    const valid = entry.prevHash === previous && entry.hash === hashText(`${entry.prevHash}|${entry.time}|${entry.agent}|${entry.action}`)
    previous = entry.hash
    return valid
  })
}
function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function Modal({ title, eyebrow, onClose, children }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-head">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2 id="modal-title">{title}</h2>
          </div>
          <button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Cerrar ventana"><X size={20} /></button>
        </div>
        {children}
      </section>
    </div>
  )
}
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? 'is-on' : ''}`} onClick={onChange}><span /></button>
}
function SectionTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="section-title">
      <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      {action && <div className="section-action">{action}</div>}
    </div>
  )
}
function StatusBadge({ status }: { status: MissionStatus }) {
  const labels = { active: 'Trabajando', approval: 'Tu aprobación', paused: 'Pausada', done: 'Completada' }
  return <span className={`status-badge status-${status}`}><span className="status-dot" />{labels[status]}</span>
}
function MissionCard({ mission, onOpen, onApprove, onToggle }: { mission: Mission; onOpen: () => void; onApprove: () => void; onToggle: () => void }) {
  const agent = AGENTS.find(a => a.id === mission.agentId) ?? AGENTS[0]
  const AgentIcon = agent.icon
  return (
    <article className="mission-card">
      <div className="mission-top">
        <button className="mission-name" onClick={onOpen}>{mission.title}<ChevronRight size={16} /></button>
        <StatusBadge status={mission.status} />
      </div>
      <p className="mission-objective">{mission.objective}</p>
      <div className="mission-meta">
        <span><AgentIcon size={14} style={{ color: agent.color }} />{agent.name}</span>
        <span><Globe2 size={14} />{mission.channel}</span>
        <span><CircleDollarSign size={14} />{money(mission.budget)}</span>
        {mission.automatic && <span className="auto-label"><Zap size={13} />Creada por ECO-IA</span>}
      </div>
      <div className="progress-label"><span>{mission.stage}</span><strong>{mission.progress}%</strong></div>
      <div className="progress-track"><div style={{ width: `${mission.progress}%` }} /></div>
      <div className="mission-actions">
        {mission.status === 'approval' && <button className="button button-primary button-small" onClick={onApprove}><Check size={16} />Aprobar y continuar</button>}
        {mission.status !== 'done' && <button className="button button-ghost button-small" onClick={onToggle}>{mission.status === 'paused' ? <Play size={15} /> : <Pause size={15} />}{mission.status === 'paused' ? 'Reanudar' : 'Pausar'}</button>}
        {mission.status === 'done' && <span className="completed-note"><CheckCircle2 size={16} />Aprendizaje incorporado al sistema</span>}
      </div>
    </article>
  )
}
function AgentMap({ agentStates, onSelect }: { agentStates: AgentState[]; onSelect: (id: AgentId) => void }) {
  const positions = [
    { x: 15, y: 22 }, { x: 50, y: 12 }, { x: 84, y: 25 },
    { x: 83, y: 73 }, { x: 50, y: 88 }, { x: 15, y: 74 },
  ]
  return (
    <div className="agent-map" aria-label="Mapa de coordinación de los seis agentes">
      <svg className="agent-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {positions.map((position, index) => <line key={index} x1="50" y1="50" x2={position.x} y2={position.y} />)}
      </svg>
      <button className="core-node" onClick={() => onSelect('guardian')} aria-label="Abrir núcleo ECO-IA">
        <span className="core-radar"><Radar size={30} /></span>
        <strong>ECO-IA</strong><small>NÚCLEO PRIVADO</small>
      </button>
      {AGENTS.map((agent, index) => {
        const state = agentStates.find(item => item.id === agent.id)
        const Icon = agent.icon
        return (
          <button
            key={agent.id}
            className={`agent-node ${state?.enabled ? '' : 'is-disabled'}`}
            style={{ left: `${positions[index].x}%`, top: `${positions[index].y}%`, '--agent-color': agent.color } as CSSProperties}
            onClick={() => onSelect(agent.id)}
          >
            <span className="agent-node-icon"><Icon size={18} /></span>
            <span><strong>{agent.name}</strong><small>{state?.enabled ? `${state.load}% CARGA` : 'PAUSADO'}</small></span>
          </button>
        )
      })}
    </div>
  )
}
function RightRail({ state, onApprove, onVerify, onOpenMissions }: { state: SimState; onApprove: (id: string) => void; onVerify: () => void; onOpenMissions: () => void }) {
  const approvals = state.missions.filter(m => m.status === 'approval')
  const recent = [...state.audit].reverse().slice(0, 7)
  return (
    <aside className="right-rail">
      <section className="rail-section approval-section">
        <div className="rail-heading"><span>DECISIONES TUYAS</span><strong>{approvals.length}</strong></div>
        {approvals.length === 0 ? (
          <div className="empty-state"><CheckCircle2 size={22} /><p>Nada te detiene.<br />El sistema sigue trabajando.</p></div>
        ) : approvals.map(mission => (
          <div className="approval-item" key={mission.id}>
            <div><TriangleAlert size={17} /><strong>Autorizar ejecución</strong></div>
            <p>{mission.title}</p>
            <span>{money(mission.budget)} · supera tu límite automático</span>
            <button className="button button-primary button-small" onClick={() => onApprove(mission.id)}>Revisar y aprobar<ArrowRight size={15} /></button>
          </div>
        ))}
        <button className="text-link" onClick={onOpenMissions}>Ver todas las misiones<ArrowRight size={14} /></button>
      </section>
      <section className="rail-section activity-section">
        <div className="rail-heading"><span>ACTIVIDAD EN VIVO</span><Activity size={16} /></div>
        <div className="activity-list">
          {recent.map(entry => (
            <div className={`activity-entry tone-${entry.tone}`} key={entry.id}>
              <div className="activity-time"><span>{entry.time}</span><span>{entry.agent}</span></div>
              <p>{entry.action}</p>
              <code>#{entry.hash}</code>
            </div>
          ))}
        </div>
        <button className="audit-verify" onClick={onVerify}><LockKeyhole size={15} />Verificar cadena de auditoría<ChevronRight size={14} /></button>
      </section>
    </aside>
  )
}
function CommandView({ state, dispatch, onNew, onOpenMission, onOpenAgent, notify }: {
  state: SimState
  dispatch: (action: Action) => void
  onNew: () => void
  onOpenMission: (mission: Mission) => void
  onOpenAgent: (id: AgentId) => void
  notify: (message: string) => void
}) {
  const active = state.missions.filter(m => m.status === 'active').length
  const completed = state.missions.filter(m => m.status === 'done').length
  const pending = state.missions.filter(m => m.status === 'approval').length
  const enabled = state.agents.filter(a => a.enabled).length
  return (
    <>
      <SectionTitle
        eyebrow="ADPULSE / OPERACIÓN AUTÓNOMA"
        title="Tu marketing avanza. Tú mantienes el control."
        description="ECO-IA reparte el trabajo entre seis agentes, ejecuta ciclos completos y solo te llama cuando una decisión supera tus reglas."
        action={<button className="button button-primary" onClick={onNew}><Plus size={18} />Nueva misión</button>}
      />
      <div className="metric-grid">
        <div className="metric"><span>MISIONES ACTIVAS</span><strong>{active.toString().padStart(2, '0')}</strong><small><Activity size={14} />Ciclo {state.tick} en curso</small></div>
        <div className="metric"><span>AGENTES DISPONIBLES</span><strong>{enabled}<em>/6</em></strong><small><Cpu size={14} />Coordinados por ECO-IA</small></div>
        <div className="metric"><span>CICLOS COMPLETADOS</span><strong>{completed.toString().padStart(2, '0')}</strong><small><CheckCircle2 size={14} />Con aprendizaje acumulado</small></div>
        <div className="metric"><span>LÍMITE DIARIO</span><strong>{money(state.settings.dailyBudget)}</strong><small><ShieldCheck size={14} />{pending} decisiones pendientes</small></div>
      </div>
      <section className="panel network-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">RED DE TRABAJO</span><h2>Un objetivo entra. Seis especialistas lo hacen avanzar.</h2></div>
          <span className={`live-indicator ${state.running ? '' : 'is-paused'}`}><span />{state.running ? 'CICLO ACTIVO' : 'EN PAUSA'}</span>
        </div>
        <AgentMap agentStates={state.agents} onSelect={onOpenAgent} />
        <div className="network-legend"><span><span className="legend-line" />Transferencia de trabajo</span><span><Zap size={14} />Cada agente entrega un resultado al siguiente</span></div>
      </section>
      <section className="panel missions-panel">
        <div className="panel-heading compact">
          <div><span className="eyebrow">COLA PRIORITARIA</span><h2>Misiones en movimiento</h2></div>
          <button className="text-link" onClick={() => dispatch({ type: 'TOGGLE_RUNNING' })}>{state.running ? <Pause size={15} /> : <Play size={15} />}{state.running ? 'Pausar todo' : 'Reanudar todo'}</button>
        </div>
        <div className="mission-list">
          {[...state.missions].sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0)).slice(0, 4).map(mission => (
            <MissionCard
              key={mission.id}
              mission={mission}
              onOpen={() => onOpenMission(mission)}
              onApprove={() => { dispatch({ type: 'APPROVE_MISSION', id: mission.id }); notify('Misión aprobada. Los agentes continúan.') }}
              onToggle={() => dispatch({ type: 'TOGGLE_MISSION', id: mission.id })}
            />
          ))}
        </div>
      </section>
    </>
  )
}

function AgentsView({ state, dispatch, onOpenAgent }: { state: SimState; dispatch: (action: Action) => void; onOpenAgent: (id: AgentId) => void }) {
  return (
    <>
      <SectionTitle eyebrow="EQUIPO DIGITAL / 6 ESPECIALISTAS" title="Cada agente tiene un oficio. ECO-IA los hace trabajar como uno." description="Puedes pausar a cualquier especialista. Sus tareas se retienen sin perder el avance y el resto del sistema continúa." />
      <div className="agent-grid">
        {AGENTS.map((agent, index) => {
          const agentState = state.agents.find(item => item.id === agent.id)!
          const Icon = agent.icon
          const assigned = state.missions.filter(m => m.agentId === agent.id && m.status === 'active').length
          return (
            <article className={`agent-card ${agentState.enabled ? '' : 'is-disabled'}`} key={agent.id} style={{ '--agent-color': agent.color } as CSSProperties}>
              <div className="agent-card-top">
                <span className="agent-number">0{index + 1}</span>
                <Toggle checked={agentState.enabled} onChange={() => dispatch({ type: 'TOGGLE_AGENT', id: agent.id })} label={`${agentState.enabled ? 'Pausar' : 'Activar'} ${agent.name}`} />
              </div>
              <Icon className="agent-card-icon" size={28} />
              <span className="eyebrow">{agent.role}</span>
              <h2>{agent.name}</h2>
              <p>{agent.description}</p>
              <dl className="agent-io"><div><dt>RECIBE</dt><dd>{agent.input}</dd></div><div><dt>ENTREGA</dt><dd>{agent.output}</dd></div></dl>
              <div className="load-row"><span>Carga actual</span><strong>{agentState.enabled ? `${agentState.load}%` : 'Pausado'}</strong></div>
              <div className="progress-track"><div style={{ width: `${agentState.load}%` }} /></div>
              <button className="agent-detail-link" onClick={() => onOpenAgent(agent.id)}>{assigned} misiones asignadas · Ver protocolo<ArrowRight size={15} /></button>
            </article>
          )
        })}
      </div>
      <section className="panel sop-strip">
        <div><span className="eyebrow">REGLA MAESTRA</span><h2>Toda tarea manual sigue esta ruta</h2></div>
        <div className="sop-flow"><span>Proceso escrito</span><ArrowRight size={17} /><span>Agente de IA</span><ArrowRight size={17} /><span>Ejecución 24/7</span><ArrowRight size={17} /><span>Auditoría</span></div>
      </section>
    </>
  )
}
function MissionsView({ state, dispatch, onNew, onOpenMission, notify }: { state: SimState; dispatch: (action: Action) => void; onNew: () => void; onOpenMission: (m: Mission) => void; notify: (message: string) => void }) {
  const [filter, setFilter] = useState<'all' | MissionStatus>('all')
  const filtered = filter === 'all' ? state.missions : state.missions.filter(m => m.status === filter)
  const filters: { id: 'all' | MissionStatus; label: string }[] = [
    { id: 'all', label: 'Todas' }, { id: 'active', label: 'Trabajando' }, { id: 'approval', label: 'Por aprobar' }, { id: 'paused', label: 'Pausadas' }, { id: 'done', label: 'Completadas' },
  ]
  return (
    <>
      <SectionTitle eyebrow="COLA DE EJECUCIÓN" title="Misiones, no tareas sueltas." description="Cada misión contiene objetivo, canal, presupuesto, responsable y una secuencia completa de principio a fin." action={<button className="button button-primary" onClick={onNew}><Plus size={18} />Crear misión</button>} />
      <div className="filter-bar" role="group" aria-label="Filtrar misiones">
        {filters.map(item => <button key={item.id} className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>{item.label}<span>{item.id === 'all' ? state.missions.length : state.missions.filter(m => m.status === item.id).length}</span></button>)}
      </div>
      <div className="mission-list full-list">
        {filtered.length ? filtered.map(mission => <MissionCard key={mission.id} mission={mission} onOpen={() => onOpenMission(mission)} onApprove={() => { dispatch({ type: 'APPROVE_MISSION', id: mission.id }); notify('Aprobada. El ciclo autónomo continúa.') }} onToggle={() => dispatch({ type: 'TOGGLE_MISSION', id: mission.id })} />) : <div className="empty-state large"><ListChecks size={30} /><h2>No hay misiones en este estado</h2><p>Cambia el filtro o crea una nueva misión.</p></div>}
      </div>
    </>
  )
}
function PoliciesView({ state, dispatch, notify }: { state: SimState; dispatch: (action: Action) => void; notify: (message: string) => void }) {
  const [draft, setDraft] = useState(state.settings)
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft(current => ({ ...current, [key]: value }))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    dispatch({ type: 'SAVE_SETTINGS', settings: draft })
    notify('Reglas guardadas. Ya gobiernan el piloto automático.')
  }
  return (
    <form onSubmit={submit}>
      <SectionTitle eyebrow="GOBERNANZA / TUS LÍMITES" title="Autonomía con cinturón, frenos y registro." description="El sistema decide cómo trabajar; tú decides hasta dónde puede llegar. Estas reglas se aplican a cada nuevo ciclo." action={<button className="button button-primary" type="submit"><Check size={18} />Guardar reglas</button>} />
      <div className="policy-layout">
        <section className="panel policy-panel">
          <div className="panel-heading compact"><div><span className="eyebrow">LÍMITES OPERATIVOS</span><h2>Topes que ningún agente puede cruzar</h2></div><LockKeyhole size={21} /></div>
          <label className="range-field"><span><strong>Presupuesto diario total</strong><output>{money(draft.dailyBudget)}</output></span><input type="range" min="100" max="10000" step="100" value={draft.dailyBudget} onChange={e => update('dailyBudget', Number(e.target.value))} /><small>Techo combinado para todas las misiones.</small></label>
          <label className="range-field"><span><strong>Aprobación humana desde</strong><output>{money(draft.approvalLimit)}</output></span><input type="range" min="100" max="3000" step="50" value={draft.approvalLimit} onChange={e => update('approvalLimit', Number(e.target.value))} /><small>Toda misión que supere esta cifra se detiene antes de ejecutar.</small></label>
          <label className="range-field"><span><strong>ROAS mínimo aceptado</strong><output>{draft.minRoas.toFixed(1)}×</output></span><input type="range" min="1" max="8" step="0.1" value={draft.minRoas} onChange={e => update('minRoas', Number(e.target.value))} /><small>Umbral de referencia para optimización y alertas.</small></label>
          <label className="range-field"><span><strong>Acciones automáticas por hora</strong><output>{draft.maxActions}</output></span><input type="range" min="5" max="100" step="5" value={draft.maxActions} onChange={e => update('maxActions', Number(e.target.value))} /><small>Evita ráfagas de publicaciones o cambios.</small></label>
        </section>
        <section className="panel policy-panel">
          <div className="panel-heading compact"><div><span className="eyebrow">PERMISOS</span><h2>Qué puede hacer sin llamarte</h2></div><ShieldCheck size={21} /></div>
          <div className="permission-row"><div><strong>Publicar sin aprobación</strong><p>Si está apagado, toda publicación externa exige tu autorización.</p></div><Toggle checked={draft.autoPublish} onChange={() => update('autoPublish', !draft.autoPublish)} label="Permitir publicación automática" /></div>
          <div className="permission-row"><div><strong>Redistribuir presupuesto</strong><p>Mover inversión entre variantes sin superar el total aprobado.</p></div><Toggle checked={draft.allowBudgetShift} onChange={() => update('allowBudgetShift', !draft.allowBudgetShift)} label="Permitir redistribución de presupuesto" /></div>
          <div className="permission-row"><div><strong>Auto-recuperación</strong><p>Reintentar fallos, aislar errores y devolver tareas a la cola.</p></div><Toggle checked={draft.selfHealing} onChange={() => update('selfHealing', !draft.selfHealing)} label="Permitir auto-recuperación" /></div>
          <div className="safety-note"><ShieldCheck size={20} /><p><strong>Regla no negociable:</strong> pagos, cambios de credenciales y gasto por encima del tope siempre quedan fuera de la autonomía.</p></div>
        </section>
      </div>
      <section className="panel escalation-panel">
        <div><span className="eyebrow">ESCALADO INTELIGENTE</span><h2>El sistema trabaja solo, pero no decide solo lo irreversible.</h2></div>
        <div className="escalation-grid"><div><span>01</span><strong>Ejecuta</strong><p>Investigar, redactar, medir y preparar.</p></div><div><span>02</span><strong>Se protege</strong><p>Pausa errores y respeta todos los topes.</p></div><div><span>03</span><strong>Te consulta</strong><p>Publicación sensible o presupuesto alto.</p></div><div><span>04</span><strong>Aprende</strong><p>Guarda resultados para el próximo ciclo.</p></div></div>
      </section>
      <button className="reset-button" type="button" onClick={() => { if (window.confirm('¿Restablecer toda la demostración y sus reglas?')) { setDraft(DEFAULT_SETTINGS); dispatch({ type: 'RESET' }); notify('Demostración restablecida.') } }}><RefreshCw size={16} />Restablecer demostración</button>
    </form>
  )
}
interface BusinessInput { users: number; price: number; commission: number; adSpend: number; aiCredits: number; cac: number; churn: number }
function BusinessView() {
  const [input, setInput] = useState<BusinessInput>({ users: 250, price: 49, commission: 5, adSpend: 500, aiCredits: 15, cac: 120, churn: 4 })
  const [growth, setGrowth] = useState(0.07)
  const [scenario, setScenario] = useState<'conservative' | 'base' | 'scale'>('base')
  const update = (key: keyof BusinessInput, value: number) => setInput(current => ({ ...current, [key]: value }))
  const revenuePerUser = input.price + input.aiCredits + input.adSpend * input.commission / 100
  const mrr = input.users * revenuePerUser
  const payback = input.cac / Math.max(1, revenuePerUser * 0.8)
  const ltv = revenuePerUser * 0.8 / (input.churn / 100)
  const data = Array.from({ length: 12 }, (_, index) => ({ month: `M${index + 1}`, mrr: Math.round(mrr * Math.pow(1 + growth, index)) }))
  const applyScenario = (nextScenario: 'conservative' | 'base' | 'scale') => {
    setScenario(nextScenario)
    if (nextScenario === 'conservative') { setInput({ users: 100, price: 39, commission: 3, adSpend: 400, aiCredits: 10, cac: 150, churn: 6 }); setGrowth(0.04) }
    if (nextScenario === 'base') { setInput({ users: 250, price: 49, commission: 5, adSpend: 500, aiCredits: 15, cac: 120, churn: 4 }); setGrowth(0.07) }
    if (nextScenario === 'scale') { setInput({ users: 700, price: 79, commission: 6, adSpend: 800, aiCredits: 25, cac: 100, churn: 3 }); setGrowth(0.1) }
  }
  const fields: { key: keyof BusinessInput; label: string; min: number; max: number; step: number; format: (v: number) => string }[] = [
    { key: 'users', label: 'Clientes activos', min: 10, max: 2000, step: 10, format: v => v.toLocaleString('en-US') },
    { key: 'price', label: 'Suscripción mensual', min: 19, max: 299, step: 5, format: v => money(v) },
    { key: 'adSpend', label: 'Pauta media por cliente', min: 100, max: 5000, step: 100, format: v => money(v) },
    { key: 'commission', label: 'Comisión sobre pauta', min: 0, max: 15, step: 0.5, format: v => `${v}%` },
    { key: 'aiCredits', label: 'Créditos de IA por cliente', min: 0, max: 80, step: 5, format: v => money(v) },
    { key: 'cac', label: 'Costo de adquisición (CAC)', min: 20, max: 1000, step: 10, format: v => money(v) },
    { key: 'churn', label: 'Cancelación mensual', min: 1, max: 15, step: 0.5, format: v => `${v}%` },
  ]
  return (
    <>
      <SectionTitle eyebrow="NEGOCIO / PROYECCIÓN" title="La autonomía también tiene que producir retorno." description="Ajusta las palancas del modelo. Son escenarios orientativos, no ingresos garantizados ni datos de clientes reales." />
      <div className="scenario-bar"><span>ESCENARIO</span><button className={scenario === 'conservative' ? 'active' : ''} onClick={() => applyScenario('conservative')}>Prudente</button><button className={scenario === 'base' ? 'active' : ''} onClick={() => applyScenario('base')}>Base</button><button className={scenario === 'scale' ? 'active' : ''} onClick={() => applyScenario('scale')}>Escala</button></div>
      <div className="business-grid">
        <section className="panel business-controls">
          {fields.map(field => <label className="range-field" key={field.key}><span><strong>{field.label}</strong><output>{field.format(input[field.key])}</output></span><input type="range" min={field.min} max={field.max} step={field.step} value={input[field.key]} onChange={e => update(field.key, Number(e.target.value))} /></label>)}
        </section>
        <section className="panel projection-panel">
          <div className="business-kpis"><div><span>MRR ESTIMADO</span><strong>{money(mrr)}</strong></div><div><span>ARR ESTIMADO</span><strong>{money(mrr * 12)}</strong></div><div><span>LTV / CAC</span><strong>{(ltv / input.cac).toFixed(1)}×</strong></div><div><span>RECUPERACIÓN CAC</span><strong>{payback.toFixed(1)} meses</strong></div></div>
          <div className="chart-title"><div><span className="eyebrow">12 MESES</span><h2>Proyección de ingreso recurrente</h2></div><span>Crecimiento mensual: {(growth * 100).toFixed(0)}%</span></div>
          <div className="revenue-chart" aria-label="Gráfica de proyección de ingresos a doce meses">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 12, right: 8, left: -10, bottom: 0 }}>
                <defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} /><stop offset="100%" stopColor="#22d3ee" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="#1a2540" vertical={false} />
                <XAxis dataKey="month" stroke="#9a9aab" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9a9aab" fontSize={12} tickLine={false} axisLine={false} tickFormatter={value => `$${Math.round(value / 1000)}k`} />
                <Tooltip formatter={value => [money(Number(value)), 'MRR']} contentStyle={{ background: '#111a2b', border: '1px solid #1a2540', borderRadius: 6, color: '#e0e0e0' }} />
                <Area type="monotone" dataKey="mrr" stroke="#22d3ee" strokeWidth={2} fill="url(#revenueFill)" animationDuration={250} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="formula-note">Ingreso por cliente = suscripción + créditos IA + (pauta × comisión). LTV estimado con margen bruto del 80%.</p>
        </section>
      </div>
    </>
  )
}
function ArchitectureView() {
  const layers = [
    { number: '01', title: 'AdPulse · Experiencia independiente', text: 'Panel del cliente, misiones, aprobaciones, reportes y facturación propia.', icon: Megaphone },
    { number: '02', title: 'ECO-IA · Orquestador privado', text: 'Descompone objetivos, asigna agentes, controla dependencias y reintenta fallos.', icon: Cpu },
    { number: '03', title: 'Seis agentes · Trabajo especializado', text: 'Investigación → estrategia → creación → distribución → optimización; Guardián vigila todo.', icon: Bot },
    { number: '04', title: 'Infraestructura · Datos y ejecución', text: 'Cola persistente, PostgreSQL, memoria por cliente, registro encadenado y APIs oficiales.', icon: Layers3 },
  ]
  return (
    <>
      <SectionTitle eyebrow="ARQUITECTURA / DE DEMO A PRODUCCIÓN" title="La parte visible es AdPulse. El motor privado es ECO-IA." description="La plataforma conserva su propia operación y datos; ECO-IA actúa como capa interna de coordinación, recuperación y auditoría." />
      <div className="architecture-stack">
        {layers.map(layer => { const Icon = layer.icon; return <article key={layer.number}><span>{layer.number}</span><Icon size={25} /><div><h2>{layer.title}</h2><p>{layer.text}</p></div><CheckCircle2 size={20} /></article> })}
      </div>
      <div className="reality-grid">
        <section className="panel"><div className="panel-heading compact"><div><span className="eyebrow">FUNCIONA EN ESTA DEMO</span><h2>Comprobable ahora</h2></div><Gauge size={22} /></div><ul className="check-list"><li><Check size={16} />Ciclos autónomos y creación de nuevas misiones</li><li><Check size={16} />Pausa por agente, misión o sistema completo</li><li><Check size={16} />Aprobaciones según el límite de presupuesto</li><li><Check size={16} />Reglas operativas y recuperación simulada</li><li><Check size={16} />Auditoría local con huellas encadenadas</li><li><Check size={16} />Persistencia en este navegador y exportación JSON</li></ul></section>
        <section className="panel production-panel"><div className="panel-heading compact"><div><span className="eyebrow">REQUIERE INSTALACIÓN REAL</span><h2>No se finge como conectado</h2></div><TriangleAlert size={22} /></div><ul className="production-list"><li><span>01</span><p><strong>Backend siempre activo</strong>Cola de trabajos y programador en servidor.</p></li><li><span>02</span><p><strong>Canales reales</strong>Credenciales y permisos de Meta, Google, TikTok o email.</p></li><li><span>03</span><p><strong>Modelos de IA</strong>Claves privadas, control de costos y memoria segura.</p></li><li><span>04</span><p><strong>Auditoría de producción</strong>Registro en servidor con SHA-256 y acceso restringido.</p></li></ul></section>
      </div>
      <section className="panel roadmap-panel"><div className="panel-heading compact"><div><span className="eyebrow">RUTA DE ACTIVACIÓN</span><h2>Cuatro pasos para trabajar sola de verdad</h2></div><Rocket size={22} /></div><div className="roadmap-grid"><div><span>PASO 1</span><h3>Núcleo persistente</h3><p>Base de datos, cola, agentes y reglas en servidor.</p><small>Sale cuando una misión sobrevive a reinicios.</small></div><div><span>PASO 2</span><h3>Un canal real</h3><p>Conectar primero un solo canal en modo prueba.</p><small>Sale cuando publica y lee resultados reales.</small></div><div><span>PASO 3</span><h3>Piloto controlado</h3><p>Pocos clientes, gasto limitado y aprobación humana.</p><small>Sale con errores medidos y recuperación probada.</small></div><div><span>PASO 4</span><h3>Operación 24/7</h3><p>Más canales, monitorización y respaldos automáticos.</p><small>Sale cuando opera sin intervención rutinaria.</small></div></div></section>
    </>
  )
}

function NewMissionModal({ onClose, onCreate }: { onClose: () => void; onCreate: (mission: Mission) => void }) {
  const [title, setTitle] = useState('')
  const [objective, setObjective] = useState('Generar solicitudes calificadas')
  const [channel, setChannel] = useState('Meta Ads')
  const [budget, setBudget] = useState(300)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onCreate({ id: `manual-${Date.now()}`, title: title.trim(), objective, channel, budget, progress: 4, stage: stageFor(4), status: 'active', agentId: 'scout', automatic: false })
  }
  return (
    <Modal title="Dar un objetivo al sistema" eyebrow="NUEVA MISIÓN" onClose={onClose}>
      <form className="mission-form" onSubmit={submit}>
        <label><span>Nombre de la misión</span><input autoFocus required maxLength={70} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Conseguir clientes para el nuevo servicio" /></label>
        <label><span>Resultado esperado</span><select value={objective} onChange={e => setObjective(e.target.value)}><option>Generar solicitudes calificadas</option><option>Reactivar contactos existentes</option><option>Aumentar reconocimiento de marca</option><option>Validar una nueva oferta</option></select></label>
        <div className="form-row"><label><span>Canal de trabajo</span><select value={channel} onChange={e => setChannel(e.target.value)}><option>Meta Ads</option><option>Google Ads</option><option>Email</option><option>TikTok</option><option>LinkedIn</option></select></label><label><span>Presupuesto (USD)</span><input type="number" required min="50" max="100000" step="50" value={budget} onChange={e => setBudget(Number(e.target.value))} /></label></div>
        <div className="form-explainer"><Workflow size={20} /><p>ECO-IA investigará, propondrá la estrategia y creará las variantes. El Guardián detendrá la misión si necesita tu aprobación.</p></div>
        <div className="modal-actions"><button type="button" className="button button-ghost" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary"><Rocket size={17} />Entregar a los agentes</button></div>
      </form>
    </Modal>
  )
}

function ConsoleApp({ onLogout, userId }: { onLogout: () => void; userId: number }) {
  const { t } = useI18n()
  // Demo-only browser state is namespaced per authenticated platform account.
  const storageKey = `adpulse-autonomous-v3:user:${userId}`
  const [state, dispatch] = useReducer(reducer, storageKey, loadState)
  const [view, setView] = useState<View>('command')
  const [newMissionOpen, setNewMissionOpen] = useState(false)
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId | null>(null)
  const [toast, setToast] = useState('')
  const notify = (message: string) => setToast(message)

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(state)) } catch { /* La demo continúa aunque el navegador bloquee el almacenamiento. */ }
  }, [state, storageKey])
  useEffect(() => {
    if (!state.running) return
    const interval = window.setInterval(() => dispatch({ type: 'TICK' }), 1600)
    return () => window.clearInterval(interval)
  }, [state.running])
  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const selectedMission = state.missions.find(m => m.id === selectedMissionId) ?? null
  const selectedAgent = AGENTS.find(a => a.id === selectedAgentId) ?? null
  const pendingCount = state.missions.filter(m => m.status === 'approval').length
  const navigate = (next: View) => { setView(next); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const approve = (id: string) => { dispatch({ type: 'APPROVE_MISSION', id }); notify('Aprobada. Los agentes retoman el trabajo.') }
  const exportDemo = () => {
    const payload = { producto: 'AdPulse Autonomous Marketing OS', tipo: 'demostración local', exportado: new Date().toISOString(), reglas: state.settings, misiones: state.missions, agentes: state.agents, auditoria: state.audit }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'adpulse-plan-autonomo.json'
    link.click()
    URL.revokeObjectURL(url)
    notify('Plan y actividad exportados en JSON.')
  }
  const createMission = (mission: Mission) => {
    dispatch({ type: 'ADD_MISSION', mission })
    setNewMissionOpen(false)
    navigate('missions')
    notify('Misión entregada. El Explorador ya comenzó.')
  }

  return (
    <div className={`app-shell ${view === 'commercial' ? 'is-commercial' : ''}`}>
      <header className="topbar">
        <div className="topbar-main">
          <button className="brand" onClick={() => navigate('command')} aria-label="Ir al centro de mando">
            <span className="brand-mark"><Zap size={21} /></span>
            <span><strong>ADPULSE</strong><small>AUTONOMOUS MARKETING OS</small></span>
          </button>
          <div className="header-actions">
            <span className="demo-badge"><span />{t('status.demo')}</span>
            <Link className="button button-ghost public-site-link" to="/"><Globe2 size={17} /><span>{t('nav.sales')}</span></Link>
            <button className="button button-ghost export-button" onClick={exportDemo}><Download size={17} /><span>{t('action.export')}</span></button>
            <button className={`button autopilot-button ${state.running ? 'is-running' : ''}`} onClick={() => dispatch({ type: 'TOGGLE_RUNNING' })}>
              {state.running ? <Pause size={17} /> : <Play size={17} />}<span>{state.running ? t('action.pause') : t('action.resume')}</span>
            </button>
            <button className="button button-ghost logout-button" onClick={onLogout} aria-label={t('action.logout')} title={t('action.logout')}><LogOut size={17} /></button>
          </div>
        </div>
        <div className="system-ticker">
          <span className="ticker-status"><span className={state.running ? 'pulse-dot' : 'paused-dot'} />{state.running ? t('status.working') : t('status.paused')}</span>
          <span>6 AGENTES COORDINADOS</span><span>{pendingCount} APROBACIONES</span><span>TOPE {money(state.settings.dailyBudget)}/DÍA</span><span className="ticker-right">CICLO #{state.tick.toString().padStart(4, '0')}</span>
        </div>
        <nav className="mobile-nav" aria-label="Navegación principal móvil">{NAV.map(item => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><Icon size={16} />{t(({ command: 'nav.command', agents: 'nav.agents', missions: 'nav.missions', policies: 'nav.rules', business: 'nav.business', commercial: 'nav.commercial', architecture: 'nav.architecture' } as const)[item.id])}</button> })}</nav>
      </header>

      <div className={`app-layout ${view === 'commercial' ? 'commercial-layout' : ''}`}>
        <aside className="sidebar">
          <nav aria-label="Navegación principal">
            <span className="nav-label">OPERACIÓN</span>
            {NAV.map(item => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><Icon size={18} /><span>{t(({ command: 'nav.command', agents: 'nav.agents', missions: 'nav.missions', policies: 'nav.rules', business: 'nav.business', commercial: 'nav.commercial', architecture: 'nav.architecture' } as const)[item.id])}</span>{item.id === 'missions' && pendingCount > 0 && <strong>{pendingCount}</strong>}<ChevronRight size={15} /></button> })}
          </nav>
          <div className="core-status">
            <div className="core-status-head"><Radar size={20} /><span>ECO-IA CORE</span><span className="pulse-dot" /></div>
            <p>Orquestador privado</p>
            <dl><div><dt>Salud</dt><dd>100%</dd></div><div><dt>Agentes</dt><dd>{state.agents.filter(a => a.enabled).length}/6</dd></div><div><dt>Modo</dt><dd>{state.running ? 'Autónomo' : 'Pausa'}</dd></div></dl>
          </div>
          <div className="sidebar-note"><LockKeyhole size={16} /><p>Tus cambios se guardan solamente en este navegador.</p></div>
        </aside>

        <main className="main-content">
          {view === 'command' && <CommandView state={state} dispatch={dispatch} onNew={() => setNewMissionOpen(true)} onOpenMission={mission => setSelectedMissionId(mission.id)} onOpenAgent={setSelectedAgentId} notify={notify} />}
          {view === 'agents' && <AgentsView state={state} dispatch={dispatch} onOpenAgent={setSelectedAgentId} />}
          {view === 'missions' && <MissionsView state={state} dispatch={dispatch} onNew={() => setNewMissionOpen(true)} onOpenMission={mission => setSelectedMissionId(mission.id)} notify={notify} />}
          {view === 'policies' && <PoliciesView state={state} dispatch={dispatch} notify={notify} />}
          {view === 'business' && <BusinessView />}
          {view === 'commercial' && <CommercialView />}
          {view === 'architecture' && <ArchitectureView />}
          <footer className="main-footer"><span>ADPULSE · BLUEPRINT AUTÓNOMO v3.0</span><span>Simulación funcional · Sin publicaciones externas reales</span></footer>
        </main>

        {view !== 'commercial' && <RightRail state={state} onApprove={approve} onVerify={() => notify(verifyAudit(state.audit) ? 'Cadena íntegra: todas las huellas coinciden.' : 'La cadena presenta una alteración.')} onOpenMissions={() => navigate('missions')} />}
      </div>

      {newMissionOpen && <NewMissionModal onClose={() => setNewMissionOpen(false)} onCreate={createMission} />}
      {selectedMission && (
        <Modal title={selectedMission.title} eyebrow={`MISIÓN / ${selectedMission.id.toUpperCase()}`} onClose={() => setSelectedMissionId(null)}>
          <div className="mission-detail">
            <div className="detail-status"><StatusBadge status={selectedMission.status} /><span>{selectedMission.automatic ? 'Creada autónomamente por ECO-IA' : 'Creada por el administrador'}</span></div>
            <p className="detail-objective">{selectedMission.objective}</p>
            <dl className="detail-grid"><div><dt>CANAL</dt><dd>{selectedMission.channel}</dd></div><div><dt>PRESUPUESTO</dt><dd>{money(selectedMission.budget)}</dd></div><div><dt>ETAPA ACTUAL</dt><dd>{selectedMission.stage}</dd></div><div><dt>PROGRESO</dt><dd>{selectedMission.progress}%</dd></div></dl>
            <div className="detail-timeline">
              {['Investigación', 'Estrategia', 'Creación', 'Distribución', 'Optimización'].map((step, index) => { const threshold = [4, 20, 42, 65, 82][index]; return <div key={step} className={selectedMission.progress >= threshold ? 'is-complete' : ''}><span>{selectedMission.progress >= threshold ? <Check size={14} /> : index + 1}</span><p>{step}</p></div> })}
            </div>
            <div className="modal-actions"><button className="button button-ghost" onClick={() => setSelectedMissionId(null)}>Cerrar</button>{selectedMission.status === 'approval' && <button className="button button-primary" onClick={() => { approve(selectedMission.id); setSelectedMissionId(null) }}><Check size={17} />Aprobar ejecución</button>}{selectedMission.status !== 'done' && selectedMission.status !== 'approval' && <button className="button button-ghost" onClick={() => dispatch({ type: 'TOGGLE_MISSION', id: selectedMission.id })}>{selectedMission.status === 'paused' ? <Play size={16} /> : <Pause size={16} />}{selectedMission.status === 'paused' ? 'Reanudar' : 'Pausar'} misión</button>}</div>
          </div>
        </Modal>
      )}
      {selectedAgent && (
        <Modal title={selectedAgent.name} eyebrow={`PROTOCOLO / ${selectedAgent.role}`} onClose={() => setSelectedAgentId(null)}>
          <div className="agent-detail">
            <div className="agent-detail-hero" style={{ '--agent-color': selectedAgent.color } as CSSProperties}><selectedAgent.icon size={34} /><p>{selectedAgent.description}</p></div>
            <dl className="detail-grid"><div><dt>ENTRADA</dt><dd>{selectedAgent.input}</dd></div><div><dt>SALIDA</dt><dd>{selectedAgent.output}</dd></div><div><dt>ESTADO</dt><dd>{state.agents.find(a => a.id === selectedAgent.id)?.enabled ? 'Disponible' : 'Pausado'}</dd></div><div><dt>SUPERVISOR</dt><dd>ECO-IA + Guardián</dd></div></dl>
            <div className="form-explainer"><ShieldCheck size={20} /><p>Este agente no puede elevar presupuesto, cambiar credenciales ni saltarse las reglas de autonomía. Cada entrega queda registrada.</p></div>
            <div className="modal-actions"><button className="button button-ghost" onClick={() => setSelectedAgentId(null)}>Cerrar</button><button className="button button-primary" onClick={() => dispatch({ type: 'TOGGLE_AGENT', id: selectedAgent.id })}>{state.agents.find(a => a.id === selectedAgent.id)?.enabled ? <Pause size={16} /> : <Play size={16} />}{state.agents.find(a => a.id === selectedAgent.id)?.enabled ? 'Pausar agente' : 'Reactivar agente'}</button></div>
          </div>
        </Modal>
      )}
      {toast && <div className="toast" role="status"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  )
}


function ProtectedConsole() {
  const { user, isLoading, logout } = useAuth({ redirectOnUnauthenticated: true })
  if (isLoading) {
    return <main className="auth-gate"><span className="auth-gate-mark"><Zap size={24} /></span><RefreshCw className="auth-gate-spinner" size={24} /><h1>Verificando acceso…</h1><p>Abriendo el espacio privado de AdPulse.</p></main>
  }
  if (!user) return null
  if (user.role !== 'admin') {
    return <main className="auth-gate"><LockKeyhole size={34} /><span className="eyebrow">ACCESO RESTRINGIDO</span><h1>Esta cuenta no tiene permisos de administración.</h1><p>La consola y los datos comerciales están reservados al equipo autorizado.</p><div><Link className="button button-primary" to="/">Volver a la página pública</Link><button className="button button-ghost" onClick={logout}>Cerrar sesión</button></div></main>
  }
  return <BusinessOS onLogout={logout} />
}

function ProtectedMarketingConsole() {
  const { user, isLoading, logout } = useAuth({ redirectOnUnauthenticated: true })
  if (isLoading) {
    return <main className="auth-gate"><span className="auth-gate-mark"><Zap size={24} /></span><RefreshCw className="auth-gate-spinner" size={24} /><h1>Verificando acceso…</h1><p>Abriendo la consola de marketing.</p></main>
  }
  if (!user) return null
  if (user.role !== 'admin') return <ProtectedConsole />
  return <ConsoleApp onLogout={logout} userId={user.id} />
}

export default function App() {
  return (
    <>
    <LocaleSwitcher />
    <Routes>
      <Route path="/" element={<SalesPage />} />
      <Route path="/console" element={<ProtectedConsole />} />
      <Route path="/portal" element={<CustomerPortal />} />
      <Route path="/marketing" element={<ProtectedMarketingConsole />} />
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </>
  )
}
