import React from 'react';

export default function MetricCard({ title, value, unit, desc, source, limitation, comparison }: {
  title: string; value: string; unit?: string; desc: string; source: string; limitation: string; comparison?: string;
}) {
  return (
    <article className="card" style={{ padding: 16 }}>
      <h3>{title}</h3>
      <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: '.2em 0' }}>{value} <span className="small muted">{unit ?? ''}</span></p>
      <p className="small">{desc}</p>
      <p className="small"><strong>Source:</strong> {source}</p>
      {comparison && <p className="small"><strong>Compared with your history:</strong> {comparison}</p>}
      <p className="small muted"><strong>Limitation:</strong> {limitation}</p>
    </article>
  );
}
