const variants = {
  primary: 'button-primary',
  secondary: 'button-secondary',
  ghost: 'button-ghost',
}

export default function Button({ variant = 'primary', className = '', ...props }) {
  const variantClass = variants[variant] || variants.primary
  return <button className={`ui-button ${variantClass} ${className}`.trim()} {...props} />
}
