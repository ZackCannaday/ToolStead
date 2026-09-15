# Wave 1 Browser QA

Date: 2026-09-05  
Scope: rendered desktop/mobile workflows for the six Wave 1 session-only beta tools  
Decision: **PASS — desktop session-only beta; mobile visual pass remains required**

## Evidence collected

- The production dashboard shell opened at `http://terminal.local:4173/` through the supported Sites preview.
- An explicit `?toolstead-preview=1` route opened a production-safe, session-only tool sandbox before authentication discovery.
- The preview catalog exposed exactly six approved tools and excluded CRM, account, sign-out, tenant, API, network, and persistence surfaces.
- The default route still resolved to the protected owner sign-in screen and presented a visible **Preview beta tools** link.
- All six Wave 1 workspaces opened from protected dashboard navigation.
- Accessibility Auditor produced two deterministic findings from invalid markup, then cleared the report after source mutation.
- Search Visibility Studio produced its five-pillar result and enabled Markdown export, then invalidated the result/export after title mutation.
- Test Case Generator produced six traceable cases from two requirements, enabled CSV export, then cleared both after requirement mutation.
- Quote Builder rendered required-field errors, accepted native date entry, prepared a $125.50 quote, and enabled local print/PDF.
- Diagnostic Flow Builder rendered blank-state validation, accepted a one-test/two-branch authored workflow, preserved the test action/point/tool/criterion in run mode, reached the outcome, and rendered both verification checklist items.
- Project Planner rendered blank-state validation, accepted a defined non-structural project scope, returned a valid plan with four readiness notes, and enabled JSON export.
- No ToolStead-originated console error was observed during these workflows.
- Vite now uses the preview service's expected fixed port (`4173`) with strict port selection.

## Remaining browser coverage

Version 10 exposed a deployed-host-only failure on iPhone: the quote, diagnostic,
and planner workspaces requested separate lazy JavaScript chunks that the host
reported as requiring authorization. The preview workspaces now ship in the entry
bundle, removing click-time module requests. Version 11 requires a fresh anonymous
deployed-host six-tool smoke test before this regression is considered closed.

The supported browser surface does not expose viewport resizing, so tablet/mobile visual checks were not executed in this pass. The responsive CSS and production build remain covered by static and build verification, but that is not a substitute for a rendered mobile pass.

## Release gate still required

Before removing the beta label, exercise each workspace at mobile and tablet widths:

1. Confirm there is no horizontal page overflow or clipped control text.
2. Confirm the sidebar/mobile navigation, tool header, editors, previews, and action rows remain usable.
3. Repeat keyboard focus, label, error-relationship, and recovery-navigation checks.

The isolated, session-only beta may be deployed for owner review without an account. Mobile visual QA remains required before a general customer release.
