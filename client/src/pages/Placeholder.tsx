export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="page">
      <h1 className="page-title">{title}</h1>
      <p className="page-subtitle">{note}</p>
    </div>
  );
}
