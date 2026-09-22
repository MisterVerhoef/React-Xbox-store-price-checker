export default function PageLayout({ children, footer }) {
  return (
    <div className="page-layout">
      <main className="page-content">{children}</main>
      {footer && <footer className="page-footer">{footer}</footer>}
    </div>
  )
}
