export default function Stats({ items }) {
  return (
    <div className="stats">
      {items.map((it) => (
        <div key={it.label} className={`stat${it.accent ? ' accent' : ''}`}>
          <b className={it.money ? 'money' : undefined}>{it.value}{it.unit && <small> {it.unit}</small>}</b>
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
}
