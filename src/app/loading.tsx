export default function Loading() {
  return <main id="main" className="workspace-loading" role="status" aria-live="polite">
    <span className="loading-water" aria-hidden="true"><i /><i /><i /></span>
    <p>Opening your workspace…</p>
    <span className="loading-line" aria-hidden="true" />
  </main>;
}
