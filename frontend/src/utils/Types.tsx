// Shared types and helpers for the frontend

// -------------------------------
// Enums
// -------------------------------
export type MachineType = "CNC" | "CONVENTIONAL";
export type ProcessType = "PREPARATION" | "QUALITY_CONTROL" | "PROCESSING";

// -------------------------------
// Machine type
// -------------------------------
export type Machine = {
  id: number;
  machine_location: string;
  description: string;
  machine_id: string;
  machine_type: MachineType;
  active?: boolean; // optional flag to filter selectable machines
};

// -------------------------------
// User type
// -------------------------------
export type User = {
  id: number;
  bitzer_id?: number | null;
  name: string;
  active?: boolean;
  is_admin?: boolean;
  // timezone-aware ISO datetime strings
  created_at?: string | null;
  updated_at?: string | null;
};

// -------------------------------
// Operation type
// -------------------------------
export type Operation = {
  id: number;
  operation_code: string;
  order_id: number; // references order by ID
  machine_id?: number | null; // references machine by ID (nullable)
  machine?: Machine; // optional expanded machine details
  tasks?: Task[]; // operations include tasks
};

// -------------------------------
// Operation update type (for PATCH payloads)
// -------------------------------
export type OperationUpdate = {
  operation_code?: string | null;
  machine_id?: number | null;
  machine_type?: MachineType | null;
};

// -------------------------------
// Task type
// -------------------------------
export type Task = {
  id: number;
  operation_id: number;
  process_type: ProcessType;

  // Operator references
  operator_user_id?: number | null; // references UserDB.id
  operator_bitzer_id?: number | null; // snapshot of Bitzer ID
  operator_user?: User | null; // optional expanded user object when returned by backend

  // Timezone-aware datetime strings (ISO8601 with offset)
  start_at?: string | null; // e.g. "2025-08-22T08:30:00+01:00"
  end_at?: string | null;

  num_benches?: number | null;
  num_machines?: number | null;
  good_pieces?: number | null;
  bad_pieces?: number | null;

  // Notes / operator observations (max 1000 chars)
  notes?: string | null;
};

// Task payload used when creating a task from the UI
export type TaskCreate = {
  process_type: ProcessType;
  operator_user_id?: number;
  operator_bitzer_id?: number;
  start_at?: string;
  end_at?: string;
  num_benches?: number;
  num_machines?: number;
  good_pieces?: number;
  bad_pieces?: number;
  notes?: string;
};

// -------------------------------
// Order type
// -------------------------------
export type Order = {
  id: number;
  order_number: number;
  material_number: number;
  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD
  num_pieces: number;
  operations?: Operation[];
};

export type OrderCreateStr = {
  order_number: string;
  material_number: string;
  start_date?: string;
  end_date?: string;
  num_pieces: string;
};

// -------------------------------
// Labels for Enums
// -------------------------------
export const processTypeLabels: Record<string, string> = {
  QUALITY_CONTROL: "Controlo de Qualidade",
  PROCESSING: "Processamento",
  PREPARATION: "Preparação de Máquina",
  CNC: "CNC",
  CONVENTIONAL: "Convencional",
};

// -------------------------------
// Helpers
// -------------------------------

/**
 * Format a date string based on the desired output type.
 * 
 * @param input - A date or datetime string (ISO8601 recommended)
 * @param mode - "date" | "datetime" | "time" | "time-seconds" (default: "datetime")
 * @returns Formatted date/time string
 */
export function formatDateTime(
  input: string | null | undefined,
  mode: "date" | "datetime" | "time" | "time-seconds" = "datetime"
): string {
  if (!input) return "----";

  const date = new Date(input);
  if (isNaN(date.getTime())) return String(input); // fallback if invalid date

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");

  switch (mode) {
    case "date":
      return `${yyyy}-${mm}-${dd}`;
    case "time":
      return `${hh}:${min}`;
    case "time-seconds":
      return `${hh}:${min}:${ss}`;
    case "datetime":
    default:
      const isMidnight = hh === "00" && min === "00" && ss === "00";
      return isMidnight ? `${yyyy}-${mm}-${dd}` : `${yyyy}-${mm}-${dd}, ${hh}:${min}`;
  }
}
