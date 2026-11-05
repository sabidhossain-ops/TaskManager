/** Vertical timeline. `items` = [{ key, title, body?, meta }] */
export default function Timeline({ items, empty = 'Nothing recorded yet.' }) {
  if (!items.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ol className="relative ml-1.5 space-y-4 border-l-2 border-slate-200 pl-5">
      {items.map((it) => (
        <li key={it.key} className="relative">
          <span className="absolute top-1.5 -left-[1.66rem] h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-slate-50" aria-hidden="true" />
          <div className="text-sm text-slate-800">{it.title}</div>
          {it.body && <div className="mt-0.5 text-sm break-words whitespace-pre-wrap text-slate-600">{it.body}</div>}
          <div className="mt-0.5 text-xs text-slate-500">{it.meta}</div>
        </li>
      ))}
    </ol>
  );
}
