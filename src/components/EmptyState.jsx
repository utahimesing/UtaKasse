export default function EmptyState({ icon = '📭', title, subtitle }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: 8 }}>
      <div style={{ fontSize: 36, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontWeight: 900, fontSize: 15, color: '#3D3060' }}>{title}</div>
      {subtitle && <div style={{ fontWeight: 700, fontSize: 12, color: '#8B85A0', textAlign: 'center' }}>{subtitle}</div>}
    </div>
  );
}
