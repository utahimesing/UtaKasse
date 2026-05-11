export default function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div>
        <div style={{ fontWeight: 900, fontSize: 16, color: '#3D3060', borderLeft: '3px solid #80A1D4', paddingLeft: 10 }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ color: '#8B85A0', fontWeight: 700, fontSize: 12, marginTop: 4, paddingLeft: 10 }}>
            {subtitle}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}
