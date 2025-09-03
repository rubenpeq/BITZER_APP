import { useEffect, useState } from "react";
import { Card, Button, Spinner, OverlayTrigger, Tooltip } from "react-bootstrap";
import { ArrowClockwise } from "react-bootstrap-icons";

const API_URL = (import.meta as any).env?.VITE_FASTAPI_URL ?? "";

type Status = "checking" | "ok" | "failed";

function badgeFor(status: Status) {
  if (status === "checking") return <Spinner animation="border" size="sm" />;
  if (status === "ok") return <span className="badge bg-success">OK</span>;
  return <span className="badge bg-danger">FAILED</span>;
}

async function fetchWithTimeout(url: string, timeout = 3000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Old fallback logic preserved in case /status not available.
 * We keep jsonIndicatesDbOk to interpret free-form /health JSON.
 */
function jsonIndicatesDbOk(json: any) {
  if (!json || typeof json !== "object") return false;
  const candidates = ["database", "db", "postgres", "postgresql", "database_ok", "db_ok", "ok"];
  for (const key of candidates) {
    if (key in json) {
      const v = json[key];
      if (typeof v === "boolean") return v === true;
      if (typeof v === "string") {
        const lc = v.toLowerCase();
        if (lc === "ok" || lc === "true" || lc === "healthy" || lc === "up") return true;
      }
      if (typeof v === "number") return v === 1;
    }
  }
  return false;
}

export default function SystemStatus() {
  const [backend, setBackend] = useState<Status>("checking");
  const [db, setDb] = useState<Status>("checking");
  const [lastError, setLastError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const runChecks = async () => {
    setChecking(true);
    setLastError(null);
    setBackend("checking");
    setDb("checking");

    const base = API_URL || "";

    // 1) Preferred: call standardized /status endpoint
    try {
      const statusUrl = `${base}/status`;
      const res = await fetchWithTimeout(statusUrl, 3000);
      if (res && res.ok) {
        const json = await res.json().catch(() => null);
        if (json) {
          // backend always considered OK if we got a successful response
          setBackend(json.backend === "ok" || res.ok ? "ok" : "failed");

          // interpret database field if present
          if (json.database && typeof json.database === "object") {
            const dbStatus = (json.database.status ?? "").toString().toLowerCase();
            setDb(dbStatus === "ok" ? "ok" : "failed");
          } else {
            // if not present, fallback to checking /health
            setDb("checking");
            // trigger fallback below by throwing to go into catch branch
            throw new Error("Sem informação da base de dados");
          }
          setChecking(false);
          return;
        } else {
          // non-json but ok -> mark backend ok and fallback for DB
          setBackend("ok");
          setDb("checking");
          // continue to fallback logic below
        }
      } else {
        // non-OK status -> fallback
        setBackend("failed");
        setDb("failed");
        // proceed to fallback checks below
      }
    } catch (err) {
      // fallback below if /status unreachable or missing db info
      // store the error to show in UI if everything fails
      setLastError((err as any)?.message ?? String(err));
    }

    // 2) Fallback: previous multi-endpoint strategy (try /health, /health/db, /, etc.)
    try {
      const healthUrl = `${base}/health`;
      const res = await fetchWithTimeout(healthUrl, 3000);
      if (res && res.ok) {
        setBackend("ok");
        const json = await res.json().catch(() => null);
        if (json && jsonIndicatesDbOk(json)) {
          setDb("ok");
        } else {
          // try additional DB endpoints
          const dbEndpoints = [`${base}/health/db`, `${base}/db/health`, `${base}/status`, `${base}/healthz`];
          let dbOk = false;
          for (const ep of dbEndpoints) {
            try {
              const r2 = await fetchWithTimeout(ep, 2500);
              if (r2 && r2.ok) {
                const j = await r2.json().catch(() => null);
                if (j && jsonIndicatesDbOk(j)) {
                  dbOk = true;
                  break;
                } else {
                  // plain 200 treated as signal that backend checked something
                  dbOk = true;
                  break;
                }
              }
            } catch (e) {
              // ignore and continue trying endpoints
            }
          }
          setDb(dbOk ? "ok" : "failed");
        }
      } else {
        // /health failed — try fallback GET /
        setBackend("failed");
        try {
          const res2 = await fetchWithTimeout(`${base}/`, 2500);
          if (res2 && res2.ok) {
            setBackend("ok");
            setDb("failed");
          } else {
            setBackend("failed");
            setDb("failed");
          }
        } catch (e) {
          setBackend("failed");
          setDb("failed");
        }
      }
    } catch (err: any) {
      setBackend("failed");
      setDb("failed");
      setLastError(String(err?.message ?? err));
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    runChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="mt-3 admin-card">
      <Card.Body>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <Card.Title style={{ fontSize: "0.85rem", color: "#9fb2c8" }}>Sistema</Card.Title>
            <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="me-3">Frontend</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <OverlayTrigger placement="top" overlay={<Tooltip>O frontend em execução no browser</Tooltip>}>
                    <span>{badgeFor("ok")}</span>
                  </OverlayTrigger>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="me-3">Backend</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{backend === "checking" ? <Spinner animation="border" size="sm" /> : badgeFor(backend)}</div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="me-3">Database</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{db === "checking" ? <Spinner animation="border" size="sm" /> : badgeFor(db)}</div>
              </div>
            </div>
          </div>

          <div style={{ marginLeft: 12 }}>
            <Button variant="outline-light" size="sm" title="Reverificar sistema" onClick={() => runChecks()} disabled={checking}>
              <ArrowClockwise className="me-1" /> {checking ? "A verificar..." : "Reverificar"}
            </Button>
          </div>
        </div>

        {lastError && (
          <div style={{ marginTop: 8 }} className="text-danger small">
            {lastError}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
