import { useEffect, useMemo, useState } from "react";
import { Card, Table, Spinner, Alert } from "react-bootstrap";
import type { Task, Operation, Order } from "../utils/Types";
import { processTypeLabels } from "../utils/Types";

const API_URL = (import.meta as any).env?.VITE_FASTAPI_URL ?? "";

type Props = {
  operation: Operation | null;
  order?: Order | null;
};

/**
 * Helpers
 */
function parseISO(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function minutesBetween(a: Date, b: Date) {
  return Math.max(0, (b.getTime() - a.getTime()) / 60000);
}

function minsToHHMM(mins: number) {
  const m = Math.round(mins);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Pause definitions (daily, local times) */
const PAUSE_DEFS: Array<{ startH: number; startM: number; endH: number; endM: number }> = [
  { startH: 10, startM: 0, endH: 10, endM: 10 }, // 10:00 - 10:10
  { startH: 12, startM: 30, endH: 13, endM: 20 }, // 12:30 - 13:20
  { startH: 15, startM: 30, endH: 15, endM: 40 }, // 15:30 - 15:40
];

/** compute overlap minutes between [aStart,aEnd] and [bStart,bEnd] */
function overlapMinutes(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  const s = Math.max(aStart.getTime(), bStart.getTime());
  const e = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, (e - s) / 60000);
}

/**
 * Sum how many minutes between `start` and `end` fall into the daily pause windows.
 * Handles multi-day spans by iterating each calendar day.
 */
function sumPauseOverlapBetween(start: Date, end: Date) {
  if (end <= start) return 0;
  let total = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);

  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);

  while (cur <= endDay) {
    for (const pd of PAUSE_DEFS) {
      const pStart = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), pd.startH, pd.startM, 0, 0);
      const pEnd = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), pd.endH, pd.endM, 0, 0);
      total += overlapMinutes(start, end, pStart, pEnd);
    }
    cur.setDate(cur.getDate() + 1);
  }

  return total;
}

/** detect machine type string on operation (robust) */
function getOperationMachineType(operation: Operation | null) {
  if (!operation) return null;
  const possible: any[] = [
    // add any fields you expect may hold the machine type
    (operation as any).machine_type,
    (operation as any).machine?.type,
    (operation as any).type,
    (operation as any).operation_type,
  ];
  for (const v of possible) {
    if (!v) continue;
    const s = String(v).trim().toUpperCase();
    if (s) return s;
  }
  return null;
}

export default function OperationData({ operation, order }: Props) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!operation) {
      setTasks(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`${API_URL}/operations/${operation.id}/tasks`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || `Falha ao obter tarefas: ${res.status}`);
        }
        const data = (await res.json()) as Task[];
        if (!cancelled) setTasks(data);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Erro de rede");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [operation]);

  // compute metrics from tasks
  const metrics = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      return {
        totalTasks: 0,
        tMdoMinutes: 0, // operator time minutes (adjusted per pauses & machine type)
        tMaqMinutes: 0, // machine time minutes (adjusted per pauses & machine type)
        pauseMinutes: 0, // SUM of pauses for each task (per your requirement)
        prepVerifyMinutes: 0,
        earliestStart: null as Date | null,
        latestEnd: null as Date | null,
        perPieceMdo: null as number | null,
        perPieceMaq: null as number | null,
      };
    }

    // compute durations per task (in minutes), ignore tasks missing start or end
    const taskDurations = tasks.map((t) => {
      const s = parseISO(t.start_at ?? null);
      const e = parseISO(t.end_at ?? null);
      if (!s || !e) return { task: t, start: s, end: e, duration: null as number | null };
      const d = minutesBetween(s, e);
      return { task: t, start: s, end: e, duration: d };
    });

    // Determine if this operation's machine type requires pause subtraction
    const machineType = getOperationMachineType(operation);
    const subtractPausesForConventional = machineType === "CONVENTIONAL";

    // Aggregates
    let tMdo = 0; // Operator Time (minutes) - using adjustedDuration / machines / operators
    let tMaq = 0; // Machine Time (minutes)  - using adjustedDuration / operators
    let totalRawActiveMinutes = 0; // sum of raw durations (minutes)
    let prepVerify = 0;

    let earliest: Date | null = null;
    let latest: Date | null = null;

    // Sum of pause overlap counted per task (the change you requested)
    let totalPauseOverlapFromTasks = 0;

    for (const td of taskDurations) {
      if (td.duration != null && td.start && td.end) {
        const durationMinutes = td.duration; // already in minutes

        // compute pause overlap for this task
        const pauseOverlap = sumPauseOverlapBetween(td.start, td.end) / (td.task.num_benches ?? 1) / (td.task.num_machines ?? 1); // minutes
        totalPauseOverlapFromTasks += pauseOverlap;

        // Determine adjusted duration according to machine type
        const adjustedDuration = Math.max(0, durationMinutes - (subtractPausesForConventional ? pauseOverlap : 0));

        // defensive defaults: treat missing/zero as 1 to avoid division by zero
        const numMachines = Math.max(1, td.task.num_machines ?? 1);
        const numOperators = Math.max(1, td.task.num_benches ?? 1);

        // Apply formulas (duration is in minutes):
        // Operator Time (min) = adjustedDuration / numMachines / numOperators
        // Machine Time  (min) = adjustedDuration / numOperators
        const operatorTime = adjustedDuration / numMachines / numOperators;
        const machineTime = adjustedDuration / numOperators;

        tMdo += operatorTime;
        tMaq += machineTime;

        // track raw active time (sum of durations) for diagnostics if needed
        totalRawActiveMinutes += durationMinutes;

        // determine prep/quality control minutes (use raw duration)
        if (td.task.process_type === "PREPARATION" || td.task.process_type === "QUALITY_CONTROL") {
          prepVerify += durationMinutes;
        }

        if (!earliest || (td.start && td.start < earliest)) earliest = td.start ?? earliest;
        if (!latest || (td.end && td.end > latest)) latest = td.end ?? latest;
      }
    }

    // Now: pauseMinutes is the SUM of per-task overlaps, as you requested
    const pauseMinutes = totalPauseOverlapFromTasks;
    tMdo = tMdo - pauseMinutes;

    // per piece metrics: divide using order.num_pieces if available
    let perPieceMdo: number | null = null;
    let perPieceMaq: number | null = null;
    const numPieces = order?.num_pieces ?? null;
    if (numPieces && numPieces > 0) {
      perPieceMdo = tMdo / numPieces;
      perPieceMaq = tMaq / numPieces;
    }

    return {
      totalTasks: tasks.length,
      tMdoMinutes: tMdo,
      tMaqMinutes: tMaq,
      pauseMinutes,
      prepVerifyMinutes: prepVerify,
      earliestStart: earliest,
      latestEnd: latest,
      perPieceMdo,
      perPieceMaq,
    };
  }, [tasks, order, operation]);

  if (!operation) {
    return (
      <Card>
        <Card.Body>
          <Card.Title>Operação — selecione uma operação</Card.Title>
          <div className="text-muted">Clique numa operação no painel da esquerda para ver os detalhes.</div>
        </Card.Body>
      </Card>
    );
  }

  return (
    <div>
      <Card className="mb-3">
        <Card.Body>
          <Card.Title>Operação: {operation.operation_code}</Card.Title>
          <div className="mb-2 text-muted">ID interno: {operation.id}</div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <div>
              <strong>Tempo MdO</strong>
              <div>
                {Math.round(metrics.tMdoMinutes)} min ({minsToHHMM(metrics.tMdoMinutes)})
              </div>
            </div>

            <div>
              <strong>Tempo Máquina</strong>
              <div>
                {Math.round(metrics.tMaqMinutes)} min ({minsToHHMM(metrics.tMaqMinutes)})
              </div>
            </div>

            <div>
              <strong>Tempo de Pausa (soma por tarefa)</strong>
              <div>
                {Math.round(metrics.pauseMinutes)} min ({minsToHHMM(metrics.pauseMinutes)})
              </div>
            </div>

            <div>
              <strong>Preparação + Verificação</strong>
              <div>
                {Math.round(metrics.prepVerifyMinutes)} min ({minsToHHMM(metrics.prepVerifyMinutes)})
              </div>
            </div>

            <div>
              <strong>MdO / peça</strong>
              <div>{metrics.perPieceMdo == null ? "—" : `${metrics.perPieceMdo.toFixed(2)} min`}</div>
            </div>

            <div>
              <strong>Maq / peça</strong>
              <div>{metrics.perPieceMaq == null ? "—" : `${metrics.perPieceMaq.toFixed(2)} min`}</div>
            </div>

            <div>
              <strong>Tarefas</strong>
              <div>{metrics.totalTasks}</div>
            </div>
          </div>
        </Card.Body>
      </Card>
      <Card>
        <Card.Body>
          <Card.Title>Tarefas</Card.Title>

          {loading && (
            <div>
              <Spinner animation="border" size="sm" /> A carregar tarefas...
            </div>
          )}
          {error && <Alert variant="danger">{error}</Alert>}
          {!loading && tasks && tasks.length === 0 && <div className="text-muted">Sem tarefas para esta operação</div>}

          {!loading && tasks && tasks.length > 0 && (
            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
              <Table bordered hover responsive size="sm" className="mt-2 h-50">
                <thead style={{ position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 1 }}>
                  <tr>
                    <th>ID</th>
                    <th>Processo</th>
                    <th>Duração</th>
                    <th>Máquinas</th>
                    <th>Bancadas</th>
                    <th>Peças (Boas)</th>
                    <th>Peças (Más)</th>
                    <th>Operador</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => {
                    const s = parseISO(t.start_at ?? null);
                    const e = parseISO(t.end_at ?? null);
                    const dur = s && e ? minutesBetween(s, e) : null;
                    const procLabel = processTypeLabels[t.process_type as keyof typeof processTypeLabels] ?? t.process_type ?? "—";
                    const operatorLabel = t.operator_user?.name ? `${t.operator_user.name}${t.operator_bitzer_id ? ` (${t.operator_bitzer_id})` : ""}` : t.operator_bitzer_id ?? "—";
                    return (
                      <tr key={t.id}>
                        <td>{t.id}</td>
                        <td>{procLabel}</td>
                        <td>{dur == null ? "—" : `${Math.round(dur)} min (${minsToHHMM(dur)})`}</td>
                        <td>{t.num_machines ?? 1}</td>
                        <td>{t.num_benches ?? "—"}</td>
                        <td>{t.good_pieces ?? "—"}</td>
                        <td>{t.bad_pieces ?? "—"}</td>
                        <td>{operatorLabel}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
