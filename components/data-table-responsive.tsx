import { MoreHorizontal } from "lucide-react";

export function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | React.ReactNode)[][];
}) {
  return (
    <div className="card overflow-hidden">
      <div className="divide-y md:hidden">
        {rows.map((row, rowIndex) => (
          <article className="p-4" key={rowIndex}>
            {row.map((value, columnIndex) => (
              <div
                className="grid grid-cols-[minmax(6.5rem,.42fr)_1fr] gap-3 py-1.5 text-sm"
                key={columnIndex}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#77776f]">
                  {headers[columnIndex]}
                </span>
                <span className="min-w-0 break-words text-right">{value}</span>
              </div>
            ))}
          </article>
        ))}
        {!rows.length && (
          <p className="p-8 text-center text-sm text-[#77776f]">
            No records yet.
          </p>
        )}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b bg-[#f7f5ef] text-[10px] uppercase tracking-wider text-[#77776f]">
            <tr>
              {headers.map((header) => (
                <th className="px-5 py-3" key={header}>
                  {header}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr className="border-b last:border-0" key={rowIndex}>
                {row.map((value, columnIndex) => (
                  <td className="px-5 py-4" key={columnIndex}>
                    {value}
                  </td>
                ))}
                <td className="px-5 py-4">
                  <MoreHorizontal size={17} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
