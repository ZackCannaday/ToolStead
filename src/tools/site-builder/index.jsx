import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Browser,
  CheckCircle,
  DownloadSimple,
  FilePlus,
  Files,
  GlobeHemisphereWest,
  Layout,
  Monitor,
  NotePencil,
  Plus,
  SlidersHorizontal,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  addPage,
  addSection,
  createSiteProject,
  exportPageHtml,
  exportSiteProject,
  moveSection,
  removePage,
  removeSection,
  updatePage,
  updateProject,
  updateSection,
  validateSiteProject,
} from "./engine.js";
import "./styles.css";

const SECTION_OPTIONS = [
  ["hero", "Hero"],
  ["content", "Content"],
  ["features", "Features"],
  ["call-to-action", "Call to action"],
  ["form", "Lead form"],
  ["faq", "FAQ"],
];

const SECTION_TEMPLATES = {
  hero: {
    type: "hero",
    content: {
      eyebrow: "Local expertise",
      heading: "A clear promise for your customer",
      body: "Explain the result you provide and why it matters.",
      primaryAction: { label: "Get started", url: "#contact" },
    },
  },
  content: {
    type: "content",
    content: {
      heading: "Tell your story",
      body: "Add focused, useful content that helps visitors make a decision.",
      action: { label: "", url: "" },
    },
  },
  features: {
    type: "features",
    content: {
      heading: "Why customers choose you",
      body: "Three reasons to trust your team.",
      items: [
        { title: "Fast response", body: "Make the first benefit concrete." },
        { title: "Clear pricing", body: "Explain what customers can expect." },
        { title: "Reliable service", body: "Support the promise with evidence." },
      ],
    },
  },
  "call-to-action": {
    type: "call-to-action",
    content: {
      heading: "Ready to get started?",
      body: "Give visitors one clear next step.",
      action: { label: "Contact us", url: "#contact" },
    },
  },
  form: {
    type: "form",
    content: {
      heading: "Request more information",
      body: "Share a few details and we will follow up.",
      actionUrl: "",
      submitLabel: "Send request",
      successMessage: "Thanks. We will be in touch.",
      fields: [
        { type: "text", name: "name", label: "Name", required: true },
        { type: "email", name: "email", label: "Email", required: true },
        { type: "textarea", name: "message", label: "Message", required: false },
      ],
    },
  },
  faq: {
    type: "faq",
    content: {
      heading: "Frequently asked questions",
      body: "Answer the questions customers ask before they buy.",
      items: [
        { title: "What should I expect?", body: "Replace this with a concise answer." },
      ],
    },
  },
};

function slugFileName(value, extension) {
  const safe = String(value || "toolstead-site")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "toolstead-site";
  return `${safe}.${extension}`;
}

function downloadFile(file) {
  const mimeType = String(file.mimeType || "text/html").split(";")[0];
  const blob = new Blob([file.content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name || "toolstead-site.html";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function Setup({ onCreate }) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState("website");
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter a project name to continue.");
      return;
    }
    onCreate(createSiteProject({
      name,
      siteName: name,
      mode,
      sections: [SECTION_TEMPLATES.hero],
    }));
  }

  return (
    <section className="sb-setup" aria-labelledby="site-builder-title">
      <div className="sb-setup-card">
        <GlobeHemisphereWest className="sb-setup-icon" aria-hidden="true" />
        <span className="sb-eyebrow">Marketing workspace</span>
        <h1 id="site-builder-title">Sites, Funnels &amp; Forms</h1>
        <p>Build a responsive page from safe reusable sections, preview it, and download portable HTML.</p>
        {error && <p className="sb-alert sb-alert-error" role="alert"><WarningCircle /> {error}</p>}
        <form onSubmit={submit} className="sb-setup-form">
          <label>
            <span>Project name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength="100" placeholder="Acme service website" />
          </label>
          <fieldset>
            <legend>Project type</legend>
            <div className="sb-mode-grid">
              {[
                ["website", "Website"],
                ["landing-page", "Landing page"],
                ["funnel", "Funnel"],
              ].map(([value, label]) => (
                <label className={mode === value ? "is-selected" : ""} key={value}>
                  <input type="radio" name="site-mode" value={value} checked={mode === value} onChange={() => setMode(value)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button className="sb-primary" type="submit"><Layout /> Create project</button>
        </form>
      </div>
    </section>
  );
}

function PagesPanel({ project, page, onSelect, onChange }) {
  const [newPageName, setNewPageName] = useState("");

  function add(event) {
    event.preventDefault();
    if (!newPageName.trim()) return;
    const next = addPage(project, { name: newPageName });
    onChange(next, next.pages.at(-1).id);
    setNewPageName("");
  }

  return (
    <aside className="sb-panel sb-pages" aria-label="Project pages">
      <div className="sb-panel-heading"><span><Files /> Pages</span><small>{project.pages.length}</small></div>
      <div className="sb-page-list">
        {project.pages.map((candidate) => (
          <div className={candidate.id === page.id ? "sb-page-row is-active" : "sb-page-row"} key={candidate.id}>
            <button type="button" onClick={() => onSelect(candidate.id)} aria-current={candidate.id === page.id ? "page" : undefined}>
              <Browser /><span><strong>{candidate.name}</strong><small>{candidate.slug}</small></span>
            </button>
            <button type="button" className="sb-icon" disabled={project.pages.length === 1} onClick={() => onChange(removePage(project, candidate.id))} aria-label={`Remove ${candidate.name} page`}><Trash /></button>
          </div>
        ))}
      </div>
      <form className="sb-add-page" onSubmit={add}>
        <label><span>New page</span><input value={newPageName} onChange={(event) => setNewPageName(event.target.value)} maxLength="100" placeholder="Services" /></label>
        <button type="submit" disabled={!newPageName.trim()}><FilePlus /> Add page</button>
      </form>
    </aside>
  );
}

function Canvas({ page, selectedSectionId, onSelect, onAdd, onMove, onRemove }) {
  return (
    <section className="sb-canvas" aria-label="Page structure">
      <div className="sb-browser-bar"><i /><i /><i /><span>preview.local{page.slug}</span></div>
      <div className="sb-canvas-body">
        {page.sections.length === 0 ? (
          <div className="sb-empty"><Layout /><h2>No sections yet</h2><p>Add a section below to begin.</p></div>
        ) : page.sections.map((section, index) => (
          <article className={selectedSectionId === section.id ? "sb-section is-selected" : "sb-section"} key={section.id}>
            <div className="sb-section-bar">
              <button type="button" onClick={() => onSelect(section.id)} aria-pressed={selectedSectionId === section.id}><NotePencil /> Edit {section.type}</button>
              <span>
                <button type="button" disabled={index === 0} onClick={() => onMove(section.id, index - 1)} aria-label={`Move ${section.type} section up`}><ArrowUp /></button>
                <button type="button" disabled={index === page.sections.length - 1} onClick={() => onMove(section.id, index + 1)} aria-label={`Move ${section.type} section down`}><ArrowDown /></button>
                <button type="button" onClick={() => onRemove(section.id)} aria-label={`Remove ${section.type} section`}><Trash /></button>
              </span>
            </div>
            <div className={`sb-section-preview sb-section-${section.type}`}>
              {section.content.eyebrow && <small>{section.content.eyebrow}</small>}
              <h2>{section.content.heading || "Untitled section"}</h2>
              {section.content.body && <p>{section.content.body}</p>}
              {Array.isArray(section.content.items) && (
                <div className="sb-item-preview">{section.content.items.map((item) => <span key={item.id || item.title}><CheckCircle /> {item.title}</span>)}</div>
              )}
            </div>
          </article>
        ))}
      </div>
      <div className="sb-section-picker">
        <strong>Add section</strong>
        <div>{SECTION_OPTIONS.map(([type, label]) => <button type="button" key={type} onClick={() => onAdd(type)}><Plus /> {label}</button>)}</div>
      </div>
    </section>
  );
}

function Settings({ project, page, section, onProject, onPage, onSection }) {
  const content = section?.content;

  function changeContent(patch) {
    onSection({ content: { ...content, ...patch } });
  }

  function changeItems(value) {
    changeContent({
      items: value.split("\n").map((title, index) => ({ id: `item-${index + 1}`, title: title.trim(), body: "" })).filter((item) => item.title),
    });
  }

  return (
    <aside className="sb-panel sb-settings" aria-label="Page and section settings">
      <div className="sb-panel-heading"><span><SlidersHorizontal /> Settings</span></div>
      <section>
        <h3>Site</h3>
        <label><span>Public site name</span><input value={project.siteName} onChange={(event) => onProject({ siteName: event.target.value })} maxLength="100" /></label>
        <label><span>Primary color</span><input type="color" value={project.theme.primaryColor} onChange={(event) => onProject({ theme: { primaryColor: event.target.value } })} /></label>
      </section>
      <section>
        <h3>Page</h3>
        <label><span>Page name</span><input value={page.name} onChange={(event) => onPage({ name: event.target.value })} maxLength="100" /></label>
        <label><span>Page path</span><input value={page.slug} onChange={(event) => onPage({ slug: event.target.value })} maxLength="120" /></label>
        <label className="sb-check"><input type="checkbox" checked={page.showInNavigation} onChange={(event) => onPage({ showInNavigation: event.target.checked })} /> <span>Show in navigation</span></label>
      </section>
      {section ? (
        <section>
          <h3>{SECTION_OPTIONS.find(([type]) => type === section.type)?.[1] || "Section"}</h3>
          {Object.hasOwn(content, "eyebrow") && <label><span>Eyebrow</span><input value={content.eyebrow} onChange={(event) => changeContent({ eyebrow: event.target.value })} /></label>}
          <label><span>Heading</span><input value={content.heading} onChange={(event) => changeContent({ heading: event.target.value })} maxLength="160" /></label>
          <label><span>Body copy</span><textarea value={content.body} onChange={(event) => changeContent({ body: event.target.value })} rows="5" maxLength="5000" /></label>
          {Array.isArray(content.items) && <label><span>{section.type === "faq" ? "Questions" : "Items"}, one per line</span><textarea value={content.items.map((item) => item.title).join("\n")} onChange={(event) => changeItems(event.target.value)} rows="5" /></label>}
          {content.primaryAction && <><label><span>Button label</span><input value={content.primaryAction.label} onChange={(event) => changeContent({ primaryAction: { ...content.primaryAction, label: event.target.value } })} /></label><label><span>Button link</span><input value={content.primaryAction.url} onChange={(event) => changeContent({ primaryAction: { ...content.primaryAction, url: event.target.value } })} placeholder="#contact" /></label></>}
          {content.action && <><label><span>Button label</span><input value={content.action.label} onChange={(event) => changeContent({ action: { ...content.action, label: event.target.value } })} /></label><label><span>Button link</span><input value={content.action.url} onChange={(event) => changeContent({ action: { ...content.action, url: event.target.value } })} placeholder="#contact" /></label></>}
          {section.type === "form" && <><label><span>Secure form endpoint</span><input value={content.actionUrl} onChange={(event) => changeContent({ actionUrl: event.target.value })} placeholder="https://forms.example.com/submit" /></label><label><span>Submit button</span><input value={content.submitLabel} onChange={(event) => changeContent({ submitLabel: event.target.value })} /></label></>}
        </section>
      ) : <p className="sb-muted">Select a section to edit its content.</p>}
    </aside>
  );
}

export default function SiteBuilder() {
  const [project, setProject] = useState(null);
  const [pageId, setPageId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [mode, setMode] = useState("edit");
  const [mobilePanel, setMobilePanel] = useState("canvas");
  const [status, setStatus] = useState("");

  const page = project?.pages.find((candidate) => candidate.id === pageId) || project?.pages[0];
  const section = page?.sections.find((candidate) => candidate.id === sectionId) || null;
  const exportValidation = useMemo(
    () => project ? validateSiteProject(project, { forExport: true }) : { valid: false, issues: [] },
    [project],
  );
  const previewHtml = useMemo(() => {
    if (!project || !page || !exportValidation.valid) return "";
    try { return exportPageHtml(project, page.id); } catch { return ""; }
  }, [exportValidation.valid, page, project]);

  if (!project) {
    return <Setup onCreate={(next) => { setProject(next); setPageId(next.pages[0].id); }} />;
  }

  function apply(operation, success = "") {
    try {
      const next = operation(project);
      setProject(next);
      setStatus(success);
    } catch (error) {
      setStatus(error.message || "The change could not be applied.");
    }
  }

  function addNewSection(type) {
    apply((current) => {
      const next = addSection(current, page.id, SECTION_TEMPLATES[type]);
      setSectionId(next.pages.find((candidate) => candidate.id === page.id).sections.at(-1).id);
      setMobilePanel("settings");
      return next;
    }, `${SECTION_OPTIONS.find(([key]) => key === type)?.[1]} added.`);
  }

  function downloadPage() {
    try {
      const content = exportPageHtml(project, page.id);
      downloadFile({ content, mimeType: "text/html", name: slugFileName(`${project.name}-${page.name}`, "html") });
      setStatus(`${page.name} HTML downloaded.`);
    } catch (error) {
      setStatus(error.issues?.[0]?.message || error.message || "Export failed.");
    }
  }

  function downloadProject() {
    try {
      const bundle = exportSiteProject(project);
      downloadFile({ content: JSON.stringify(bundle, null, 2), mimeType: "application/json", name: slugFileName(project.name, "toolstead-site.json") });
      setStatus("Portable project package downloaded.");
    } catch (error) {
      setStatus(error.issues?.[0]?.message || error.message || "Export failed.");
    }
  }

  return (
    <section className="sb-workspace" aria-label="Site Builder workspace">
      <header className="sb-toolbar">
        <div><span className="sb-eyebrow">Sites, Funnels &amp; Forms</span><h1>{project.name}</h1></div>
        <div className="sb-toolbar-actions">
          <div className="sb-segmented" aria-label="Builder view"><button type="button" aria-pressed={mode === "edit"} onClick={() => setMode("edit")}><NotePencil /> Edit</button><button type="button" aria-pressed={mode === "preview"} onClick={() => setMode("preview")}><Monitor /> Preview</button></div>
          <button type="button" onClick={downloadPage} disabled={!exportValidation.valid}><DownloadSimple /> Download page</button>
          <button className="sb-primary" type="button" onClick={downloadProject} disabled={!exportValidation.valid}><DownloadSimple /> Project package</button>
        </div>
      </header>

      <div className="sb-status" aria-live="polite" aria-atomic="true">
        {status && <p className="sb-alert"><CheckCircle /> {status}</p>}
        {!exportValidation.valid && <p className="sb-alert sb-alert-warning" role="alert"><WarningCircle /> {exportValidation.issues[0]?.message} {exportValidation.issues.length > 1 && `(${exportValidation.issues.length} issues)`}</p>}
      </div>

      {mode === "preview" ? (
        <section className="sb-preview" aria-label="Isolated page preview">
          {previewHtml ? <iframe title={`${page.name} preview`} sandbox="" referrerPolicy="no-referrer" srcDoc={previewHtml} /> : <div className="sb-empty"><Monitor /><h2>Preview is not ready</h2><p>Resolve the validation message above, then preview again.</p></div>}
        </section>
      ) : (
        <>
          <nav className="sb-mobile-tabs" aria-label="Builder panels">
            {[["pages", Files], ["canvas", Layout], ["settings", SlidersHorizontal]].map(([key, Icon]) => <button type="button" key={key} aria-current={mobilePanel === key ? "page" : undefined} onClick={() => setMobilePanel(key)}><Icon /> {key[0].toUpperCase() + key.slice(1)}</button>)}
          </nav>
          <div className="sb-editor">
            <div className={mobilePanel === "pages" ? "sb-mobile-pane is-active" : "sb-mobile-pane"}><PagesPanel project={project} page={page} onSelect={(id) => { setPageId(id); setSectionId(""); setMobilePanel("canvas"); }} onChange={(next, selectedId) => { setProject(next); setPageId(selectedId || next.pages[0].id); setSectionId(""); }} /></div>
            <div className={mobilePanel === "canvas" ? "sb-mobile-pane is-active" : "sb-mobile-pane"}><Canvas page={page} selectedSectionId={sectionId} onSelect={(id) => { setSectionId(id); setMobilePanel("settings"); }} onAdd={addNewSection} onMove={(id, index) => apply((current) => moveSection(current, page.id, id, index), "Section moved.")} onRemove={(id) => { apply((current) => removeSection(current, page.id, id), "Section removed."); if (sectionId === id) setSectionId(""); }} /></div>
            <div className={mobilePanel === "settings" ? "sb-mobile-pane is-active" : "sb-mobile-pane"}><Settings project={project} page={page} section={section} onProject={(patch) => apply((current) => updateProject(current, patch))} onPage={(patch) => apply((current) => updatePage(current, page.id, patch))} onSection={(patch) => apply((current) => updateSection(current, page.id, section.id, patch))} /></div>
          </div>
        </>
      )}
    </section>
  );
}

export { SiteBuilder };
