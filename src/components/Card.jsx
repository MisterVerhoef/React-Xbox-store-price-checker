export default function Card({ title, children, className = '' }) {
  return (
    <div className={`ui-card ${className}`.trim()}>
      {title && <h3 className="ui-card-title">{title}</h3>}
      <div className={title ? 'ui-card-content' : ''}>{children}</div>
    </div>
  )
}
