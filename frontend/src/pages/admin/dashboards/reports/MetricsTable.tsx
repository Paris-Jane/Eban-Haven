import type { ReactNode } from 'react'
import { tableBody, tableHead, tableWrap } from '../../shared/adminStyles'

export type MetricsColumn<T> = {
  key: keyof T | string
  header: string
  className?: string
  render: (row: T) => ReactNode
}

type Props<T> = {
  rows: T[]
  columns: MetricsColumn<T>[]
  caption?: string
  emptyMessage?: string
  getRowKey: (row: T) => string
}

export function MetricsTable<T>({ rows, columns, caption, emptyMessage = 'No rows', getRowKey }: Props<T>) {
  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div className={tableWrap}>
      <table className="w-full min-w-[28rem] text-left text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className={tableHead}>
          <tr>
            {columns.map((c) => (
              <th key={String(c.key)} className={`px-3 py-2.5 font-medium ${c.className ?? ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={tableBody}>
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="align-top">
              {columns.map((c) => (
                <td key={String(c.key)} className={`px-3 py-2.5 ${c.className ?? ''}`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
