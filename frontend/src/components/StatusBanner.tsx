export function StatusBanner({
  tone,
  children,
}: {
  tone: 'error' | 'success' | 'info';
  children: React.ReactNode;
}) {
  return (
    <div className={`banner banner-${tone}`} role="status">
      {children}
    </div>
  );
}
