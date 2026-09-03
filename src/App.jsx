import { useEffect, useMemo, useRef, useState } from "react";
import {
  AddressBook,
  ArrowRight,
  Bell,
  CalendarBlank,
  CaretDown,
  ChartLineUp,
  ChatCircleDots,
  Check,
  CheckCircle,
  ClipboardText,
  CurrencyDollar,
  EnvelopeSimple,
  Funnel,
  GlobeHemisphereWest,
  GridFour,
  ImageSquare,
  MagnifyingGlass,
  NotePencil,
  Package,
  PaperPlaneTilt,
  PhoneCall,
  Plus,
  ShieldCheck,
  Sparkle,
  SpinnerGap,
  Storefront,
  Tray,
  Users,
  Wrench,
  X,
} from "@phosphor-icons/react";
import {
  addContactNote,
  archiveContact,
  createContact,
  establishConnection,
  getContacts,
  getModules,
  isPersistentProvider,
  requiresRemoteConnection,
  signIn,
  signOut,
  signUp,
  supportsSelfRegistration,
  updateContact,
} from "./data-client.js";
import {
  MATURITY_PRESENTATION,
  TOOL_MATURITY,
  auditTool,
  mergeToolEntitlements,
} from "./tool-registry.js";

// # Preview records
const PREVIEW_CONTACTS = [];

// # Tool registry
const TOOL_ICONS = {
  "crm-core": AddressBook,
  "site-builder": GlobeHemisphereWest,
  booking: CalendarBlank,
  messaging: ChatCircleDots,
  "smart-intake": ClipboardText,
  payments: CurrencyDollar,
  "media-kit": ImageSquare,
  analytics: ChartLineUp,
};
const TOOL_ACCENTS = {
  "crm-core": "blue",
  "site-builder": "violet",
  booking: "teal",
  messaging: "orange",
  "smart-intake": "indigo",
  payments: "green",
  "media-kit": "pink",
  analytics: "slate",
};
const NAV_ITEMS = [
  { id: "my-tools", label: "My Tools", icon: GridFour },
  { id: "crm", label: "Leads & CRM", icon: AddressBook, toolKey: "crm-core" },
  { id: "library", label: "Tool Library", icon: Package },
];
const EMPTY_LEAD = {
  displayName: "",
  companyName: "",
  email: "",
  phone: "",
  source: "Manual entry",
  stage: "New lead",
  summary: "",
};

function initials(name = "") {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}
function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "Just now";
}

// # Connection screens
function ConnectionScreen({ title, message, children }) {
  return (
    <main className="connection-screen">
      <section className="connection-card">
        <img src="/assets/toolstead-logo.png" alt="Toolstead" />
        <span className="eyebrow">Toolstead workspace</span>
        <h1>{title}</h1>
        <p>{message}</p>
        {children}
      </section>
    </main>
  );
}

function LoginScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("signin");
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
    displayName: "",
    workspaceName: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const canRegister = supportsSelfRegistration();
  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (mode === "register") {
        const result = await signUp(credentials);
        if (result.verificationRequired) {
          setVerificationEmail(result.email);
          return;
        }
        await onAuthenticated(result.account);
      } else {
        await onAuthenticated(await signIn(credentials));
      }
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSubmitting(false);
    }
  };
  if (verificationEmail) {
    return (
      <ConnectionScreen
        title="Check your email"
        message={`Confirm the link sent to ${verificationEmail}, then return here to sign in.`}
      >
        <button
          className="primary-button"
          onClick={() => {
            setVerificationEmail("");
            setMode("signin");
          }}
        >
          Return to sign in
        </button>
      </ConnectionScreen>
    );
  }
  return (
    <ConnectionScreen
      title={
        mode === "register"
          ? "Create your owner workspace"
          : "Sign in to your workspace"
      }
      message={
        mode === "register"
          ? "Create the first secure owner account for this Toolstead environment."
          : "Use your Toolstead owner account."
      }
    >
      <form className="stack-form" onSubmit={submit}>
        {mode === "register" && (
          <>
            <label>
              <span>Your name</span>
              <input
                value={credentials.displayName}
                onChange={(e) =>
                  setCredentials({
                    ...credentials,
                    displayName: e.target.value,
                  })
                }
                minLength="2"
                maxLength="120"
                autoComplete="name"
                required
              />
            </label>
            <label>
              <span>Business or workspace name</span>
              <input
                value={credentials.workspaceName}
                onChange={(e) =>
                  setCredentials({
                    ...credentials,
                    workspaceName: e.target.value,
                  })
                }
                minLength="2"
                maxLength="120"
                autoComplete="organization"
                required
              />
            </label>
          </>
        )}
        <label>
          <span>Email address</span>
          <input
            type="email"
            value={credentials.email}
            onChange={(e) =>
              setCredentials({ ...credentials, email: e.target.value })
            }
            autoComplete="email"
            required
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            minLength="12"
            value={credentials.password}
            onChange={(e) =>
              setCredentials({ ...credentials, password: e.target.value })
            }
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            required
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button" disabled={submitting}>
          {submitting ? <SpinnerGap className="spin" /> : <ShieldCheck />}
          {submitting
            ? mode === "register"
              ? "Creating account…"
              : "Signing in…"
            : mode === "register"
              ? "Create owner account"
              : "Sign in"}
        </button>
        {canRegister && (
          <button
            type="button"
            className="text-button auth-mode-button"
            onClick={() => {
              setMode(mode === "register" ? "signin" : "register");
              setError("");
            }}
          >
            {mode === "register"
              ? "Already have an account? Sign in"
              : "Need an owner account? Create one"}
          </button>
        )}
      </form>
    </ConnectionScreen>
  );
}

// # Accessible dialog
function Modal({ title, eyebrow, children, onClose, wide = false }) {
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const escape = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2 id="modal-title">{title}</h2>
          </div>
          <button
            ref={closeRef}
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            <X weight="bold" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

// # Tool dashboard
function MyTools({ contacts, tools, onNavigate, onCreateLead }) {
  const newLeads = contacts.filter(
    (contact) => contact.stage === "New lead",
  ).length;
  const activeCount = tools.filter(
    (tool) => tool.enabled && tool.maturity === TOOL_MATURITY.implemented,
  ).length;
  return (
    <main className="page-content">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Command center</span>
          <h1>My Tools</h1>
          <p>Everything enabled for this workspace, without the clutter.</p>
        </div>
        <button className="primary-button" onClick={onCreateLead}>
          <Plus weight="bold" /> Add lead
        </button>
      </header>
      <section className="metric-grid" aria-label="Workspace snapshot">
        <article>
          <span className="metric-icon blue">
            <Users />
          </span>
          <div>
            <small>Active contacts</small>
            <strong>{contacts.length}</strong>
            <span>Unified CRM records</span>
          </div>
        </article>
        <article>
          <span className="metric-icon orange">
            <Sparkle />
          </span>
          <div>
            <small>New leads</small>
            <strong>{newLeads}</strong>
            <span>Waiting for first response</span>
          </div>
        </article>
        <article>
          <span className="metric-icon teal">
            <CheckCircle />
          </span>
          <div>
            <small>Working tools</small>
            <strong>{activeCount}</strong>
            <span>{tools.length - activeCount} in foundation or planning</span>
          </div>
        </article>
      </section>
      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Active tools</h2>
            <p>
              Only implemented and enabled tools appear in workspace navigation.
            </p>
          </div>
          <button className="text-button" onClick={() => onNavigate("library")}>
            Audit Tool Library <ArrowRight />
          </button>
        </div>
        <article className="active-tool-card">
          <div className="tool-mark blue">
            <AddressBook weight="duotone" />
          </div>
          <div className="tool-copy">
            <span className="status-pill active">
              <Check /> Working
            </span>
            <h3>Lead Intake & CRM</h3>
            <p>
              Capture leads, organize contact details, update lifecycle stages,
              add notes, and see customer activity in one timeline.
            </p>
            <div className="feature-row">
              <span>
                <CheckCircle /> Lead capture
              </span>
              <span>
                <CheckCircle /> Contact directory
              </span>
              <span>
                <CheckCircle /> Unified timeline
              </span>
            </div>
          </div>
          <button
            className="secondary-button"
            onClick={() => onNavigate("crm")}
          >
            Open CRM <ArrowRight />
          </button>
        </article>
      </section>
      <section className="section-block next-up">
        <div>
          <span className="eyebrow">
            Next build candidate · foundation only
          </span>
          <h2>Booking & Calendar</h2>
          <p>
            The database and protected appointment endpoint exist. Calendar UI,
            availability rules, conflict prevention, and reminders are not built
            yet.
          </p>
        </div>
        <span className="tool-mark teal">
          <CalendarBlank weight="duotone" />
        </span>
      </section>
    </main>
  );
}

// # Tool library
function ToolLibrary({ tools, onOpenTool }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedTool, setSelectedTool] = useState(null);
  const [auditMessage, setAuditMessage] = useState("");
  const categories = ["All", ...new Set(tools.map((tool) => tool.category))];
  const visible = tools.filter(
    (tool) =>
      (category === "All" || tool.category === category) &&
      (!query ||
        `${tool.name} ${tool.description}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const runAudit = (tool) => {
    const result = auditTool(tool);
    setAuditMessage(
      result.activatable
        ? `Passed ${result.implemented} implementation checks. This tool is enabled for testing.`
        : `Verified ${result.implemented} foundations; ${result.missing} required capabilities remain. Activation stays blocked.`,
    );
  };
  return (
    <main className="page-content">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Verified module inventory</span>
          <h1>Tool Library</h1>
          <p>
            Every status reflects audited code—not subscription marketing or
            assumed functionality.
          </p>
        </div>
        <span className="catalog-count">{tools.length} audited tools</span>
      </header>
      <section className="library-toolbar">
        <label className="search-field">
          <MagnifyingGlass />
          <span className="sr-only">Search tools</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools and outcomes…"
          />
        </label>
        <div className="category-tabs" aria-label="Tool categories">
          {categories.map((item) => (
            <button
              key={item}
              className={category === item ? "active" : ""}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </section>
      <section className="tool-grid">
        {visible.map((tool) => {
          const Icon = tool.icon;
          const presentation = MATURITY_PRESENTATION[tool.maturity];
          const working =
            tool.maturity === TOOL_MATURITY.implemented && tool.enabled;
          return (
            <article className="tool-card" key={tool.key}>
              <div className="tool-card-top">
                <span className={`tool-mark ${tool.accent}`}>
                  <Icon weight="duotone" />
                </span>
                <span
                  className={`status-pill ${working ? "active" : presentation.tone}`}
                >
                  {working ? <Check /> : <Wrench />}
                  {working ? "Working" : presentation.label}
                </span>
              </div>
              <span className="tool-category">{tool.category}</span>
              <h2>{tool.name}</h2>
              <p>{tool.description}</p>
              <footer>
                <small>{tool.included}</small>
                <button
                  className="secondary-button"
                  onClick={() =>
                    working
                      ? onOpenTool(tool.key)
                      : (setAuditMessage(""), setSelectedTool(tool))
                  }
                >
                  {working ? "Open tool" : presentation.action}
                  {working && <ArrowRight />}
                </button>
              </footer>
            </article>
          );
        })}
      </section>
      {!visible.length && (
        <section className="empty-state">
          <MagnifyingGlass />
          <h2>No tools match</h2>
          <p>Try another name or category.</p>
          <button
            className="text-button"
            onClick={() => {
              setQuery("");
              setCategory("All");
            }}
          >
            Clear filters
          </button>
        </section>
      )}
      {selectedTool && (
        <Modal
          title={selectedTool.name}
          eyebrow="Implementation audit"
          onClose={() => setSelectedTool(null)}
          wide
        >
          <div className="tool-audit-panel">
            <div className="audit-summary">
              <span className={`tool-mark ${selectedTool.accent}`}>
                {(() => {
                  const Icon = selectedTool.icon;
                  return <Icon weight="duotone" />;
                })()}
              </span>
              <div>
                <span
                  className={`status-pill ${MATURITY_PRESENTATION[selectedTool.maturity].tone}`}
                >
                  <Wrench />
                  {MATURITY_PRESENTATION[selectedTool.maturity].label}
                </span>
                <p>{selectedTool.description}</p>
              </div>
            </div>
            <div className="audit-columns">
              <section>
                <h3>Verified foundations</h3>
                <ul>
                  {selectedTool.implemented.map((item) => (
                    <li key={item}>
                      <CheckCircle weight="fill" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3>Required before activation</h3>
                <ul>
                  {selectedTool.missing.map((item) => (
                    <li key={item}>
                      <Wrench />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
            {auditMessage && (
              <p className="audit-result" role="status">
                {auditMessage}
              </p>
            )}
            <p className="info-note">
              Billing cannot activate an unfinished module. This audit checks
              the implementation inventory; it does not simulate missing
              providers or fabricate results.
            </p>
            <footer className="modal-actions">
              <button
                className="text-button"
                onClick={() => setSelectedTool(null)}
              >
                Close
              </button>
              <button
                className="primary-button"
                onClick={() => runAudit(selectedTool)}
              >
                <ShieldCheck /> Run readiness check
              </button>
            </footer>
          </div>
        </Modal>
      )}
    </main>
  );
}

// # CRM workspace
function CrmWorkspace({
  contacts,
  selectedId,
  setSelectedId,
  query,
  setQuery,
  onCreate,
  onEdit,
  onArchive,
  onAddNote,
}) {
  const [stage, setStage] = useState("All");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const stages = ["All", "New lead", "Contacted", "Qualified", "Won", "Lost"];
  const visible = contacts.filter(
    (contact) =>
      (stage === "All" || contact.stage === stage) &&
      (!query ||
        `${contact.displayName} ${contact.companyName} ${contact.email} ${contact.phone}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const selected =
    contacts.find((contact) => contact.id === selectedId) ||
    visible[0] ||
    contacts[0];
  const submitNote = async (event) => {
    event.preventDefault();
    if (!note.trim() || !selected) return;
    setNoteError("");
    try {
      await onAddNote(selected.id, note.trim());
      setNote("");
    } catch (error) {
      setNoteError(error.message || "The note could not be added.");
    }
  };
  return (
    <main className="crm-page">
      <section className="crm-list-pane">
        <header className="crm-heading">
          <div>
            <span className="eyebrow">Lead Intake & CRM</span>
            <h1>Contacts</h1>
            <p>{contacts.length} active records</p>
          </div>
          <button className="primary-button compact" onClick={onCreate}>
            <Plus weight="bold" /> Add lead
          </button>
        </header>
        <label className="search-field contact-search">
          <MagnifyingGlass />
          <span className="sr-only">Search contacts</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, or phone…"
          />
        </label>
        <div className="stage-filter">
          <Funnel />
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            aria-label="Filter by stage"
          >
            {stages.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="contact-list">
          {visible.map((contact) => (
            <button
              key={contact.id}
              className={`contact-row ${selected?.id === contact.id ? "active" : ""}`}
              onClick={() => setSelectedId(contact.id)}
            >
              <span className="avatar">{initials(contact.displayName)}</span>
              <span className="contact-row-copy">
                <strong>{contact.displayName}</strong>
                <small>{contact.companyName || contact.source}</small>
                <span>
                  {contact.email || contact.phone || "No contact channel"}
                </span>
              </span>
              <span
                className={`lead-stage ${contact.stage?.toLowerCase().replaceAll(" ", "-") || "new-lead"}`}
              >
                {contact.stage || "New lead"}
              </span>
            </button>
          ))}
          {!visible.length && (
            <div className="empty-state compact">
              <Users />
              <strong>No contacts found</strong>
              <span>Clear the search or add a new lead.</span>
            </div>
          )}
        </div>
      </section>
      <aside className="crm-detail-pane">
        {selected ? (
          <>
            <header className="contact-profile">
              <span className="avatar large">
                {initials(selected.displayName)}
              </span>
              <div>
                <span
                  className={`lead-stage ${selected.stage?.toLowerCase().replaceAll(" ", "-") || "new-lead"}`}
                >
                  {selected.stage || "New lead"}
                </span>
                <h2>{selected.displayName}</h2>
                <p>{selected.companyName || "Individual contact"}</p>
              </div>
              <button
                className="icon-button"
                onClick={() => onEdit(selected)}
                aria-label="Edit contact"
              >
                <NotePencil />
              </button>
            </header>
            <section className="contact-methods">
              <a
                href={selected.email ? `mailto:${selected.email}` : undefined}
                className={!selected.email ? "disabled" : ""}
              >
                <EnvelopeSimple />
                <span>
                  <small>Email</small>
                  <strong>{selected.email || "Not recorded"}</strong>
                </span>
              </a>
              <a
                href={selected.phone ? `tel:${selected.phone}` : undefined}
                className={!selected.phone ? "disabled" : ""}
              >
                <PhoneCall />
                <span>
                  <small>Phone</small>
                  <strong>{selected.phone || "Not recorded"}</strong>
                </span>
              </a>
            </section>
            <section className="timeline-section">
              <div className="section-heading">
                <div>
                  <h3>Activity timeline</h3>
                  <p>Every lead touchpoint in one place.</p>
                </div>
              </div>
              <form className="note-composer" onSubmit={submitNote}>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add an internal note…"
                  aria-label="Internal note"
                />
                <button
                  className="primary-button compact"
                  disabled={!note.trim()}
                >
                  <PaperPlaneTilt /> Add note
                </button>
              </form>
              {noteError && (
                <p className="form-error" role="alert">
                  {noteError}
                </p>
              )}
              <div className="timeline">
                {(selected.timeline || []).map((event) => (
                  <article key={event.id}>
                    <span className="timeline-icon">
                      <NotePencil />
                    </span>
                    <div>
                      <time>{formatDate(event.occurredAt)}</time>
                      <h4>{event.title}</h4>
                      <p>{event.text}</p>
                    </div>
                  </article>
                ))}
                {!selected.timeline?.length && (
                  <div className="empty-state compact">
                    <Tray />
                    <strong>No activity yet</strong>
                    <span>Add a note to start the timeline.</span>
                  </div>
                )}
              </div>
            </section>
            <footer className="contact-footer">
              <button
                className="danger-text"
                onClick={() => onArchive(selected)}
              >
                Archive contact
              </button>
              <span>Added from {selected.source}</span>
            </footer>
          </>
        ) : (
          <div className="empty-state">
            <AddressBook />
            <h2>No contacts yet</h2>
            <p>Add your first test lead to verify the complete CRM workflow.</p>
            <button className="primary-button" onClick={onCreate}>
              <Plus /> Add first lead
            </button>
          </div>
        )}
      </aside>
    </main>
  );
}

// # Main application
export function App() {
  const [connectionState, setConnectionState] = useState("checking");
  const [connectionError, setConnectionError] = useState("");
  const [workspaceName, setWorkspaceName] = useState(
    "Toolstead Test Workspace",
  );
  const [activePage, setActivePage] = useState("my-tools");
  const [contacts, setContacts] = useState(PREVIEW_CONTACTS);
  const [modules, setModules] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [modal, setModal] = useState(null);
  const [editingContact, setEditingContact] = useState(null);
  const [leadDraft, setLeadDraft] = useState(EMPTY_LEAD);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const tools = useMemo(() => {
    const registry = mergeToolEntitlements(modules);
    return registry.map((tool) => ({
      ...tool,
      icon: TOOL_ICONS[tool.key],
      accent: TOOL_ACCENTS[tool.key],
    }));
  }, [modules]);
  const enabledKeys = tools
    .filter(
      (tool) => tool.enabled && tool.maturity === TOOL_MATURITY.implemented,
    )
    .map((tool) => tool.key);
  const announce = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };
  const loadLiveData = async () => {
    const [modulePayload, contactPayload] = await Promise.all([
      getModules(),
      getContacts(),
    ]);
    setModules(modulePayload.modules || []);
    setContacts(
      contactPayload.contacts.map((contact) => ({
        ...contact,
        stage: contact.stage || "New lead",
      })),
    );
    setSelectedId(contactPayload.contacts[0]?.id || "");
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const connection = await establishConnection();
        if (cancelled) return;
        if (connection.account?.workspace?.name) {
          setWorkspaceName(connection.account.workspace.name);
        }
        if (connection.state === "api" || connection.state === "supabase") {
          await loadLiveData();
        }
        if (!cancelled) setConnectionState(connection.state);
      } catch (error) {
        if (cancelled) return;
        if (requiresRemoteConnection()) {
          setConnectionError(
            error.message || "The Supabase workspace could not be reached.",
          );
          setConnectionState("error");
        } else {
          setConnectionState("local");
          setToast(
            error.message ||
              "Live data is unavailable. Local test mode is active.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const navigate = (page) => {
    setActivePage(page);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openCreate = () => {
    setEditingContact(null);
    setLeadDraft(EMPTY_LEAD);
    setFormError("");
    setModal("lead");
  };
  const openEdit = (contact) => {
    setEditingContact(contact);
    setLeadDraft({
      displayName: contact.displayName,
      companyName: contact.companyName || "",
      email: contact.email || "",
      phone: contact.phone || "",
      source: contact.source || "Manual entry",
      stage: contact.stage || "New lead",
      summary: "",
    });
    setFormError("");
    setModal("lead");
  };
  const saveLead = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      if (isPersistentProvider()) {
        const payload = editingContact
          ? await updateContact(editingContact.id, leadDraft)
          : await createContact(leadDraft);
        await loadLiveData();
        setSelectedId(payload.contact.id);
      } else if (editingContact) {
        setContacts((items) =>
          items.map((item) =>
            item.id === editingContact.id
              ? { ...item, ...leadDraft, updatedAt: new Date().toISOString() }
              : item,
          ),
        );
      } else {
        const created = {
          ...leadDraft,
          id: `session-${Date.now()}`,
          stage: leadDraft.stage,
          updatedAt: new Date().toISOString(),
          timeline: [
            {
              id: `event-${Date.now()}`,
              eventType: "lead_created",
              title: "Lead created",
              text: leadDraft.summary || `Added from ${leadDraft.source}.`,
              occurredAt: new Date().toISOString(),
            },
          ],
        };
        setContacts((items) => [created, ...items]);
        setSelectedId(created.id);
      }
      setModal(null);
      setActivePage("crm");
      announce(editingContact ? "Contact updated." : "Lead added.");
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  };
  const addNote = async (contactId, body) => {
    if (isPersistentProvider()) {
      await addContactNote(contactId, body);
      await loadLiveData();
    } else
      setContacts((items) =>
        items.map((item) =>
          item.id === contactId
            ? {
                ...item,
                updatedAt: new Date().toISOString(),
                timeline: [
                  {
                    id: `session-note-${Date.now()}`,
                    eventType: "note_added",
                    title: "Note added",
                    text: body,
                    occurredAt: new Date().toISOString(),
                  },
                  ...(item.timeline || []),
                ],
              }
            : item,
        ),
      );
    announce("Note added to the timeline.");
  };
  const requestArchive = (contact) => {
    setEditingContact(contact);
    setModal("archive");
  };
  const confirmArchive = async () => {
    setFormError("");
    try {
      if (isPersistentProvider()) await archiveContact(editingContact.id);
      setContacts((items) =>
        items.filter((item) => item.id !== editingContact.id),
      );
      setSelectedId(
        contacts.find((item) => item.id !== editingContact.id)?.id || "",
      );
      setModal(null);
      announce("Contact archived.");
    } catch (error) {
      setFormError(error.message || "The contact could not be archived.");
    }
  };
  const handleSignOut = async () => {
    setAccountOpen(false);
    await signOut();
    setContacts([]);
    setModules([]);
    setConnectionState("auth");
  };

  if (connectionState === "checking")
    return (
      <ConnectionScreen
        title="Opening your workspace"
        message="Loading tools, entitlements, and customer records."
      >
        <SpinnerGap className="spin connection-spinner" />
      </ConnectionScreen>
    );
  if (connectionState === "auth")
    return (
      <LoginScreen
        onAuthenticated={async (account) => {
          setWorkspaceName(account.workspace.name);
          await loadLiveData();
          const connection = await establishConnection();
          setConnectionState(connection.state);
        }}
      />
    );
  if (connectionState === "error")
    return (
      <ConnectionScreen
        title="Workspace connection failed"
        message={connectionError}
      >
        <button
          className="primary-button"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </ConnectionScreen>
    );

  return (
    <div className="platform-shell">
      <header className="topbar">
        <button
          className="mobile-menu-button"
          onClick={() => setMobileNavOpen((open) => !open)}
          aria-label="Open navigation"
        >
          <GridFour />
        </button>
        <a
          className="brand"
          href="#my-tools"
          onClick={() => navigate("my-tools")}
        >
          <img src="/assets/toolstead-logo.png" alt="Toolstead" />
        </a>
        <button
          className="workspace-button"
          disabled
          title="Workspace switching is planned for agency accounts."
        >
          <span className="workspace-icon">
            <Storefront weight="fill" />
          </span>
          <span>
            <small>Workspace</small>
            <strong>{workspaceName}</strong>
          </span>
          <CaretDown />
        </button>
        <label className="global-search">
          <MagnifyingGlass />
          <span className="sr-only">Search workspace</span>
          <input
            placeholder="Search workspace…"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => activePage !== "crm" && navigate("crm")}
          />
        </label>
        <div className="topbar-actions">
          <button
            className="icon-button dark"
            aria-label="Notifications are not implemented"
            title="Notifications are not implemented yet."
            disabled
          >
            <Bell />
          </button>
          <div className="account-wrap">
            <button
              className="profile-button"
              onClick={() => setAccountOpen((open) => !open)}
              aria-expanded={accountOpen}
            >
              <img src="/assets/user-avatar.png" alt="Owner profile" />
              <CaretDown />
            </button>
            {accountOpen && (
              <div className="popover account-menu">
                <strong>Owner account</strong>
                <small>{workspaceName}</small>
                {isPersistentProvider() ? (
                  <button onClick={handleSignOut}>Sign out</button>
                ) : (
                  <span className="account-mode">
                    Local test mode · no account
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      <aside className={`sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="sidebar-heading">
          <span>Workspace</span>
          <button
            className="icon-button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </button>
        </div>
        <nav aria-label="Primary navigation">
          {NAV_ITEMS.filter(
            (item) => !item.toolKey || enabledKeys.includes(item.toolKey),
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={activePage === id ? "active" : ""}
              onClick={() => navigate(id)}
              aria-current={activePage === id ? "page" : undefined}
            >
              <Icon weight={activePage === id ? "fill" : "regular"} />
              <span>{label}</span>
              {id === "crm" && (
                <span className="nav-count">{contacts.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-tools">
          <span className="sidebar-label">Active tools</span>
          <button
            className={activePage === "crm" ? "active" : ""}
            onClick={() => navigate("crm")}
          >
            <AddressBook />
            <span>Lead Intake & CRM</span>
            <CheckCircle weight="fill" />
          </button>
        </div>
        <button
          className="library-shortcut"
          onClick={() => navigate("library")}
        >
          <Plus />
          <span>
            <strong>Audit every tool</strong>
            <small>See what is actually built</small>
          </span>
        </button>
        <div className="plan-card">
          <span>Foundation plan</span>
          <strong>
            {enabledKeys.length} of {tools.length} tools working
          </strong>
          <div>
            <i />
          </div>
          <button onClick={() => navigate("library")}>Review readiness</button>
        </div>
      </aside>
      <section className="content-shell">
        {connectionState === "local" && (
          <div className="preview-banner">
            <span>
              <Sparkle weight="fill" />
            </span>
            <p>
              <strong>Local test mode</strong> — No fabricated customer records
              are loaded. Add your own test lead; changes last only for this
              browser session.
            </p>
          </div>
        )}
        {activePage === "my-tools" && (
          <MyTools
            contacts={contacts}
            tools={tools}
            onNavigate={navigate}
            onCreateLead={openCreate}
          />
        )}
        {activePage === "library" && (
          <ToolLibrary
            tools={tools}
            onOpenTool={(key) => key === "crm-core" && navigate("crm")}
          />
        )}
        {activePage === "crm" && (
          <CrmWorkspace
            contacts={contacts}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            query={searchQuery}
            setQuery={setSearchQuery}
            onCreate={openCreate}
            onEdit={openEdit}
            onArchive={requestArchive}
            onAddNote={addNote}
          />
        )}
      </section>
      {mobileNavOpen && (
        <button
          className="mobile-scrim"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
        />
      )}
      {modal === "lead" && (
        <Modal
          title={editingContact ? "Edit contact" : "Add a new lead"}
          eyebrow="Lead Intake & CRM"
          onClose={() => setModal(null)}
          wide
        >
          <form className="lead-form" onSubmit={saveLead}>
            <div className="form-grid">
              <label>
                <span>Full name *</span>
                <input
                  value={leadDraft.displayName}
                  onChange={(e) =>
                    setLeadDraft({ ...leadDraft, displayName: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                <span>Company</span>
                <input
                  value={leadDraft.companyName}
                  onChange={(e) =>
                    setLeadDraft({ ...leadDraft, companyName: e.target.value })
                  }
                />
              </label>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={leadDraft.email}
                  onChange={(e) =>
                    setLeadDraft({ ...leadDraft, email: e.target.value })
                  }
                />
              </label>
              <label>
                <span>Phone</span>
                <input
                  type="tel"
                  value={leadDraft.phone}
                  onChange={(e) =>
                    setLeadDraft({ ...leadDraft, phone: e.target.value })
                  }
                />
              </label>
              <label>
                <span>Lead source</span>
                <select
                  value={leadDraft.source}
                  onChange={(e) =>
                    setLeadDraft({ ...leadDraft, source: e.target.value })
                  }
                >
                  <option>Manual entry</option>
                  <option>Website form</option>
                  <option>Missed call</option>
                  <option>Referral</option>
                  <option>Booking page</option>
                </select>
              </label>
              <label>
                <span>Lifecycle stage</span>
                <select
                  value={leadDraft.stage}
                  onChange={(e) =>
                    setLeadDraft({ ...leadDraft, stage: e.target.value })
                  }
                >
                  <option>New lead</option>
                  <option>Contacted</option>
                  <option>Qualified</option>
                  <option>Won</option>
                  <option>Lost</option>
                </select>
              </label>
              {!editingContact && (
                <label className="full">
                  <span>Request summary</span>
                  <textarea
                    rows="3"
                    value={leadDraft.summary}
                    onChange={(e) =>
                      setLeadDraft({ ...leadDraft, summary: e.target.value })
                    }
                    placeholder="What does this lead need?"
                  />
                </label>
              )}
            </div>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <footer className="modal-actions">
              <button
                type="button"
                className="text-button"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button className="primary-button" disabled={saving}>
                <Check />
                {saving
                  ? "Saving…"
                  : editingContact
                    ? "Save changes"
                    : "Add lead"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
      {modal === "archive" && (
        <Modal
          title="Archive this contact?"
          eyebrow="Contact management"
          onClose={() => setModal(null)}
        >
          <div className="confirm-panel">
            <p>
              <strong>{editingContact?.displayName}</strong> will be removed
              from active CRM lists. Production-connected records remain
              recoverable in the database.
            </p>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="modal-actions">
              <button className="text-button" onClick={() => setModal(null)}>
                Keep contact
              </button>
              <button className="danger-button" onClick={confirmArchive}>
                Archive contact
              </button>
            </div>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle weight="fill" /> {toast}
        </div>
      )}
    </div>
  );
}
