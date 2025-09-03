import { useEffect, useMemo, useState } from "react";
import { Container, Row, Col, ListGroup, Card, Spinner, Form, InputGroup, Button } from "react-bootstrap";
import OperationDetails from "../../components/OperationData";
import type { Order, Operation } from "../../utils/Types";

const API_URL = (import.meta as any).env?.VITE_FASTAPI_URL ?? "";

function yearOf(dateStr?: string | null) {
  if (!dateStr) return "Unknown";
  const parts = dateStr.split("-");
  return parts.length >= 1 ? parts[0] : "Unknown";
}
function monthOf(dateStr?: string | null) {
  if (!dateStr) return "Unknown";
  const parts = dateStr.split("-");
  return parts.length >= 2 ? parts[1] : "Unknown";
}
function monthLabel(year: string, month: string) {
  const m = parseInt(month, 10);
  if (isNaN(m)) return month;
  return `${String(m).padStart(2, "0")} — ${new Date(year + "-" + month + "-01").toLocaleString("pt-PT", { month: "long" })}`;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // drill-down selections
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [operations, setOperations] = useState<Operation[] | null>(null);
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);

  // search states
  const [orderSearch, setOrderSearch] = useState("");
  const [opSearch, setOpSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`${API_URL}/orders`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || `Failed to fetch orders: ${res.status}`);
        }
        const data = (await res.json()) as Order[];
        if (!cancelled) setOrders(data);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // derived groupings: years -> months -> orders
  const years = useMemo(() => {
    const s = new Set<string>();
    for (const o of orders) s.add(yearOf(o.start_date));
    const arr = Array.from(s).sort((a, b) => {
      if (a === "Unknown") return 1;
      if (b === "Unknown") return -1;
      return parseInt(b) - parseInt(a);
    });
    return arr;
  }, [orders]);

  const monthsForYear = useMemo(() => {
    if (!selectedYear) return [];
    const s = new Set<string>();
    for (const o of orders) {
      if (yearOf(o.start_date) === selectedYear) s.add(monthOf(o.start_date));
    }
    const arr = Array.from(s).sort((a, b) => {
      if (a === "Unknown") return 1;
      if (b === "Unknown") return -1;
      return parseInt(a) - parseInt(b);
    });
    return arr;
  }, [orders, selectedYear]);

  const ordersForMonth = useMemo(() => {
    if (!selectedYear || !selectedMonth) return [];
    return orders.filter((o) => yearOf(o.start_date) === selectedYear && monthOf(o.start_date) === selectedMonth).sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""));
  }, [orders, selectedYear, selectedMonth]);

  // filtered lists based on search inputs
  const filteredOrdersForMonth = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return ordersForMonth;
    return ordersForMonth.filter((o) => {
      // allow searching numeric order_number or material_number or partial matches
      const orderNum = String(o.order_number ?? "").toLowerCase();
      const matNum = String(o.material_number ?? "").toLowerCase();
      return orderNum.includes(q) || matNum.includes(q);
    });
  }, [ordersForMonth, orderSearch]);

  const filteredOperations = useMemo(() => {
    const q = opSearch.trim().toLowerCase();
    if (!q || !operations) return operations ?? [];
    return operations.filter((op) => (op.operation_code ?? "").toLowerCase().includes(q));
  }, [operations, opSearch]);

  // when order selected -> fetch operations
  useEffect(() => {
    if (!selectedOrder) {
      setOperations(null);
      setSelectedOperation(null);
      return;
    }
    setOpsLoading(true);
    setOperations(null);
    setSelectedOperation(null);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/orders/${selectedOrder.order_number}/operations`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || `Failed to fetch operations: ${res.status}`);
        }
        const data = (await res.json()) as Operation[];
        if (!cancelled) setOperations(data);
      } catch (err: any) {
        if (!cancelled) setOperations([]);
      } finally {
        if (!cancelled) setOpsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedOrder]);

  // reset downstream selections when parent selection changes
  useEffect(() => {
    setSelectedMonth(null);
    setSelectedOrder(null);
    setOperations(null);
    setSelectedOperation(null);
    setOrderSearch("");
    setOpSearch("");
  }, [selectedYear]);

  useEffect(() => {
    setSelectedOrder(null);
    setOperations(null);
    setSelectedOperation(null);
    setOrderSearch("");
    setOpSearch("");
  }, [selectedMonth]);

  // if filtering hides the selected order/operation, clear them
  useEffect(() => {
    if (selectedOrder && !filteredOrdersForMonth.find((o) => o.id === selectedOrder.id)) {
      setSelectedOrder(null);
      setOperations(null);
      setSelectedOperation(null);
    }
  }, [filteredOrdersForMonth, selectedOrder]);

  useEffect(() => {
    if (selectedOperation && !filteredOperations.find((op) => op.id === selectedOperation.id)) {
      setSelectedOperation(null);
    }
  }, [filteredOperations, selectedOperation]);

  return (
    <Container fluid className="py-4">
      <Row className="mb-3 align-items-center">
        <Col>
          <h2 style={{ fontWeight: 700 }}>Ordens</h2>
          <div style={{ color: "#9fb2c8" }}>Navegue por ano → mês → ordem → operação. Selecione uma operação para ver métricas calculadas.</div>
        </Col>
      </Row>

      {loading && (
        <div>
          <Spinner animation="border" /> A carregar ordens...
        </div>
      )}
      {error && <div className="text-danger mb-3">{error}</div>}

      <Row>
        {/* Years */}
        <Col md={2}>
          <Card>
            <Card.Body style={{ padding: 8 }}>
              <div className="mb-2">
                <strong>Anos</strong>
              </div>
              <ListGroup variant="flush">
                {years.map((y) => (
                  <ListGroup.Item key={y} action active={y === selectedYear} onClick={() => setSelectedYear(y === selectedYear ? null : y)} style={{ cursor: "pointer" }}>
                    {y}
                  </ListGroup.Item>
                ))}
                {years.length === 0 && <div className="text-muted p-2">Sem ordens</div>}
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>

        {/* Months */}
        <Col md={2}>
          <Card>
            <Card.Body style={{ padding: 8 }}>
              <div className="mb-2">
                <strong>Meses</strong>
              </div>
              <ListGroup variant="flush">
                {monthsForYear.map((m) => (
                  <ListGroup.Item key={m} action active={m === selectedMonth} onClick={() => setSelectedMonth(m === selectedMonth ? null : m)} style={{ cursor: "pointer" }}>
                    {selectedYear === "Unknown" ? m : monthLabel(selectedYear ?? "", m)}
                  </ListGroup.Item>
                ))}
                {monthsForYear.length === 0 && <div className="text-muted p-2">—</div>}
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>

        {/* Orders with search */}
        <Col md={2}>
          <Card>
            <Card.Body style={{ padding: 8 }}>
              <div className="mb-2 d-flex justify-content-between align-items-center">
                <strong>Ordens</strong>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => {
                    setOrderSearch("");
                  }}
                >
                  Limpar
                </Button>
              </div>

              <Form.Group className="mb-2">
                <InputGroup>
                  <Form.Control placeholder="Pesquisar por número de ordem ou material" value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} />
                </InputGroup>
              </Form.Group>

              <ListGroup variant="flush" style={{ maxHeight: 420, overflow: "auto" }}>
                {filteredOrdersForMonth.map((o) => (
                  <ListGroup.Item key={o.id} action active={selectedOrder?.id === o.id} onClick={() => setSelectedOrder(selectedOrder?.id === o.id ? null : o)} style={{ cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{o.order_number}</div>
                        <div className="text-muted" style={{ fontSize: 12 }}>
                          {o.material_number} • {o.start_date ?? "—"}
                        </div>
                      </div>
                      <div style={{ alignSelf: "center" }}>{o.num_pieces} pcs</div>
                    </div>
                  </ListGroup.Item>
                ))}
                {filteredOrdersForMonth.length === 0 && <div className="text-muted p-2">Sem ordens</div>}
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>

        {/* Operations with search */}
        <Col md={2}>
          <Card>
            <Card.Body style={{ padding: 8 }}>
              <div className="mb-2 d-flex justify-content-between align-items-center">
                <strong>Operações</strong>
                <Button size="sm" variant="outline-secondary" onClick={() => setOpSearch("")}>
                  Limpar
                </Button>
              </div>

              <Form.Group className="mb-2">
                <InputGroup>
                  <Form.Control placeholder="Pesquisar por código de operação" value={opSearch} onChange={(e) => setOpSearch(e.target.value)} disabled={!operations || operations.length === 0} />
                </InputGroup>
              </Form.Group>

              {opsLoading && (
                <div>
                  <Spinner animation="border" size="sm" /> A carregar operações...
                </div>
              )}
              <ListGroup variant="flush" style={{ maxHeight: 420, overflow: "auto" }}>
                {!opsLoading && operations && operations.length === 0 && <div className="text-muted p-2">Sem operações</div>}
                {filteredOperations &&
                  filteredOperations.map((op) => (
                    <ListGroup.Item
                      key={op.id}
                      action
                      active={selectedOperation?.id === op.id}
                      onClick={() => setSelectedOperation(selectedOperation?.id === op.id ? null : op)}
                      style={{ cursor: "pointer" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div style={{ fontWeight: 700 }}>{op.operation_code}</div>
                        <div className="text-muted" style={{ fontSize: 12 }}>
                          #{op.id}
                        </div>
                      </div>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        {op.machine?.machine_location ?? ""} • {op.machine?.machine_id ?? "—"}
                      </div>
                    </ListGroup.Item>
                  ))}
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>

        {/* Operation details */}
        <Col md={4}>
          <OperationDetails operation={selectedOperation} order={selectedOrder} />
        </Col>
      </Row>
    </Container>
  );
}
