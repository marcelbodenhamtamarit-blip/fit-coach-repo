// Importar CSV para Inversiones (p.ej. extractos de Revolut Invest o
// Crypto): Revolut no tiene una API para cuentas personales (ver
// conversación), así que esta es la vía manual-pero-rápida: exportas un CSV
// desde la app de Revolut y aquí se parsea.
//
// El formato exacto de columnas varía según de qué parte de Revolut venga
// el CSV (cuenta normal / Invest / Crypto), así que en vez de asumir un
// esquema fijo, detectamos columnas por alias de cabecera (fecha, importe,
// descripción/tipo, saldo) de forma tolerante, y dejamos que quien importa
// revise una vista previa antes de guardar nada — si el parser se equivoca
// con algún valor, se ve y se corrige ahí antes de confirmar.

export type ParsedCsvRow = {
  index: number
  raw: Record<string, string>
  date: string | null // yyyy-mm-dd
  dateRaw: string
  description: string
  amount: number | null
  amountRaw: string
  balance: number | null
}

export type ParsedCsv = {
  headers: string[]
  rows: ParsedCsvRow[]
  detected: {
    dateCol: string | null
    amountCol: string | null
    descriptionCol: string | null
    typeCol: string | null
    balanceCol: string | null
  }
}

const DATE_ALIASES = [
  "date",
  "fecha",
  "started date",
  "completed date",
  "transaction date",
  "date (utc)",
  "time",
  "created at",
]
const AMOUNT_ALIASES = [
  "amount",
  "importe",
  "total",
  "total amount",
  "value",
  "cantidad",
  "fiat amount",
  "net amount",
  "price",
]
const DESCRIPTION_ALIASES = ["description", "descripción", "product", "merchant", "note", "memo"]
const TYPE_ALIASES = ["type", "tipo", "symbol", "ticker", "currency pair", "asset"]
const BALANCE_ALIASES = ["balance", "saldo", "closing balance", "final balance", "balance (fiat)"]

const SELL_KEYWORDS = ["sell", "venta", "withdraw", "retirada", "retiro", "outgoing"]
const BUY_KEYWORDS = ["buy", "compra", "deposit", "top up", "topup", "aportación", "aportacion", "incoming"]

function norm(s: string): string {
  return s.trim().toLowerCase()
}

function findColumn(headers: string[], aliases: string[]): string | null {
  const normalizedHeaders = headers.map(norm)
  for (const alias of aliases) {
    const idx = normalizedHeaders.indexOf(alias)
    if (idx !== -1) return headers[idx]
  }
  // Coincidencia parcial como último recurso (p.ej. "Started Date (UTC)")
  for (const alias of aliases) {
    const idx = normalizedHeaders.findIndex((h) => h.includes(alias))
    if (idx !== -1) return headers[idx]
  }
  return null
}

// Parser CSV mínimo (RFC4180): soporta campos entre comillas con comas,
// saltos de línea y comillas escapadas (""), y detecta si el separador es
// coma o punto y coma (algunos exports europeos usan ;).
export function parseCsvText(text: string): string[][] {
  const delimiter = text.slice(0, 2000).split("\n")[0]?.includes(";") ? ";" : ","
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  const pushField = () => {
    row.push(field)
    field = ""
  }
  const pushRow = () => {
    pushField()
    rows.push(row)
    row = []
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
      continue
    }
    if (c === '"') {
      inQuotes = true
    } else if (c === delimiter) {
      pushField()
    } else if (c === "\r") {
      // ignorado, \n lo gestiona la siguiente rama
    } else if (c === "\n") {
      pushRow()
    } else {
      field += c
    }
  }
  if (field.length > 0 || row.length > 0) pushRow()
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""))
}

function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/[€$£]/g, "").trim()
  if (s === "") return null
  const negative = /^\(.*\)$/.test(s)
  if (negative) s = s.slice(1, -1)
  if (s.includes(",") && s.includes(".")) {
    // Si la coma va antes del punto, es separador de miles (1,234.56).
    // Si va después, es decimal europeo (1.234,56).
    if (s.lastIndexOf(",") < s.lastIndexOf(".")) {
      s = s.replace(/,/g, "")
    } else {
      s = s.replace(/\./g, "").replace(",", ".")
    }
  } else if (s.includes(",")) {
    s = s.replace(",", ".")
  }
  const n = Number(s)
  if (Number.isNaN(n)) return null
  return negative ? -Math.abs(n) : n
}

function parseDate(raw: string): string | null {
  const s = raw.trim()
  if (s === "") return null
  // ISO: "2024-01-15" o "2024-01-15 10:23:11"
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  // DD/MM/YYYY (formato europeo, el habitual en exports de Revolut UK/EU)
  const eu = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (eu) {
    const day = eu[1].padStart(2, "0")
    const month = eu[2].padStart(2, "0")
    return `${eu[3]}-${month}-${day}`
  }
  const parsed = Date.parse(s)
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10)
  return null
}

export function parseInvestmentCsv(text: string): ParsedCsv {
  const table = parseCsvText(text)
  if (table.length === 0) {
    return { headers: [], rows: [], detected: { dateCol: null, amountCol: null, descriptionCol: null, typeCol: null, balanceCol: null } }
  }
  const headers = table[0].map((h) => h.trim())
  const dateCol = findColumn(headers, DATE_ALIASES)
  const amountCol = findColumn(headers, AMOUNT_ALIASES)
  const descriptionCol = findColumn(headers, DESCRIPTION_ALIASES)
  const typeCol = findColumn(headers, TYPE_ALIASES)
  const balanceCol = findColumn(headers, BALANCE_ALIASES)

  const rows: ParsedCsvRow[] = table.slice(1).map((cells, i) => {
    const raw: Record<string, string> = {}
    headers.forEach((h, idx) => {
      raw[h] = cells[idx] ?? ""
    })
    const dateRaw = dateCol ? raw[dateCol] ?? "" : ""
    const amountRaw = amountCol ? raw[amountCol] ?? "" : ""
    let amount = amountCol ? parseAmount(amountRaw) : null
    const typeRaw = typeCol ? norm(raw[typeCol] ?? "") : ""
    if (amount !== null && typeRaw) {
      if (SELL_KEYWORDS.some((k) => typeRaw.includes(k))) amount = -Math.abs(amount)
      else if (BUY_KEYWORDS.some((k) => typeRaw.includes(k))) amount = Math.abs(amount)
    }
    const description = [typeCol ? raw[typeCol] : "", descriptionCol ? raw[descriptionCol] : ""]
      .filter(Boolean)
      .join(" · ")
    return {
      index: i,
      raw,
      date: parseDate(dateRaw),
      dateRaw,
      description,
      amount,
      amountRaw,
      balance: balanceCol ? parseAmount(raw[balanceCol] ?? "") : null,
    }
  })

  return { headers, rows, detected: { dateCol, amountCol, descriptionCol, typeCol, balanceCol } }
}
