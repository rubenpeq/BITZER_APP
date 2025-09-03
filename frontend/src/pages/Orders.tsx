import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Table, Spinner, Alert, Button, Row, Col, Form, Card } from "react-bootstrap";
import { ArrowLeft } from "react-bootstrap-icons";
import CreateNewOperation from "../components/CreateOperation";
import EditOrderFieldModal from "../components/EditOrder";
import { type Order, type Operation, processTypeLabels } from "../utils/Types";

export default function OrderDetail() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_FASTAPI_URL;

  const [order, setOrder] = useState<Order | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateOp, setShowCreateOp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Edit Modal ---
  const [showEdit, setShowEdit] = useState(false);
  const [editKey, setEditKey] = useState<string>("");
  const [editLabel, setEditLabel] = useState<string>("");
  const [editInitial, setEditInitial] = useState<any>(null);

  // Fetch order and operations
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [orderResponse, operationsResponse] = await Promise.all([fetch(`${API_URL}/orders/${orderNumber}`), fetch(`${API_URL}/orders/${orderNumber}/operations`)]);

        if (!orderResponse.ok) throw new Error("Erro ao buscar ordem");
        if (!operationsResponse.ok) throw new Error("Erro ao buscar operações");

        const [orderData, operationsData] = await Promise.all([orderResponse.json(), operationsResponse.json()]);

        setOrder(orderData);
        setOperations(operationsData);
      } catch (err) {
        setError((err as Error).message || String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orderNumber, API_URL]);

  // Visible columns: operation_code, machine_type (nested), machine_location (nested)
  const operationHeaders: { key: string; label: string }[] = [
    { key: "operation_code", label: "Código Operação" },
    { key: "machine_type", label: "Tipo de Máquina" },
    { key: "machine_location", label: "Cen. Trabalho" },
  ];

  // Open edit modal from card click
  const openEditModal = useCallback((key: string, label: string, initial: any) => {
    setEditKey(key);
    setEditLabel(label);
    setEditInitial(initial);
    setShowEdit(true);
  }, []);

  const onSavedOrder = useCallback(
    (updated: Order) => {
      // update local order
      const prevOrderNumber = order?.order_number;
      setOrder(updated);
      // if order_number changed, navigate to new route
      if (editKey === "order_number" && updated.order_number && prevOrderNumber !== updated.order_number) {
        navigate(`/order/${updated.order_number}`, { replace: true });
      }
    },
    [order, editKey, navigate]
  );

  // Filter operations
  const filteredOperations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return operations;

    const contains = (v: any) => v !== undefined && v !== null && String(v).toLowerCase().includes(term);
    return operations.filter((op) => contains(op.operation_code) || contains(op.machine?.machine_type) || contains(op.machine?.machine_location));
  }, [searchTerm, operations]);

  // Sort operations
  const sortedOperations = useMemo(() => {
    if (!sortConfig) return filteredOperations;
    const { key, direction } = sortConfig;

    const getValue = (op: Operation) => {
      if (key === "operation_code") return String(op.operation_code ?? "");
      if (key === "machine_type") return String(op.machine?.machine_type ?? "");
      if (key === "machine_location") return String(op.machine?.machine_location ?? "");
      return String((op as any)[key] ?? "");
    };

    return [...filteredOperations].sort((a, b) => {
      const A = getValue(a).toLowerCase();
      const B = getValue(b).toLowerCase();
      if (A < B) return direction === "asc" ? -1 : 1;
      if (A > B) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredOperations, sortConfig]);

  // Handle row double click
  const handleRowDoubleClick = useCallback(
    async (order_number: number, op_code: string) => {
      try {
        const res = await fetch(`${API_URL}/operations/get_id?order_number=${order_number}&operation_code=${encodeURIComponent(op_code)}`);
        if (!res.ok) throw new Error("Failed to fetch operation ID");
        const id = await res.json();
        navigate(`/operation/${id}`);
      } catch (e) {
        setError("Erro ao abrir operação.");
      }
    },
    [API_URL, navigate]
  );

  const handleSort = useCallback((key: string) => {
    setSortConfig((prevConfig) => {
      if (prevConfig?.key === key) {
        return {
          key,
          direction: prevConfig.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <Spinner animation="border" />
      </div>
    );
  }

  if (!order) {
    return <Alert variant="danger">Ordem não encontrada</Alert>;
  }

  return (
    <div className="order-container">
      <Button variant="light" className="mb-3 d-flex align-items-center" onClick={() => navigate(-1)}>
        <ArrowLeft className="me-2" /> Voltar
      </Button>

      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}

      {/* Summary cards (click to edit) */}
      <Row className="mb-4 gx-3 justify-content-center text-center">
        {(
          [
            { key: "order_number", label: "Nº Ordem", value: order.order_number },
            { key: "material_number", label: "Nº Material", value: order.material_number },
            { key: "start_date", label: "Data Início", value: order.start_date ?? "" },
            { key: "end_date", label: "Data Fim", value: order.end_date ?? "" },
            { key: "num_pieces", label: "Nº Peças", value: order.num_pieces },
          ] as const
        ).map(({ key, label, value }) => (
          <Col key={String(key)} xs={12} sm={6} md={2} className="mb-3">
            <Card className="order-card p-3" onClick={() => openEditModal(String(key), label, value)}>
              <Card.Title className="order-card-title">{label}</Card.Title>
              <Card.Text className="order-card-value">{value === "" || value === null || value === undefined ? "-" : String(value)}</Card.Text>
            </Card>
          </Col>
        ))}
      </Row>

      <EditOrderFieldModal
        show={showEdit}
        onHide={() => setShowEdit(false)}
        apiUrl={API_URL}
        orderNumber={Number(orderNumber)}
        fieldKey={editKey}
        label={editLabel}
        initialValue={editInitial}
        onSaved={onSavedOrder}
      />

      <Form.Control
        type="search"
        placeholder="Pesquisar operações... (código de operação, tipo de máquina ou id de máquina)"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-3"
      />

      {sortedOperations.length === 0 ? (
        <Alert variant="warning">Nenhuma operação encontrada.</Alert>
      ) : (
        <div className="table-container">
          <Table striped bordered hover className="sticky-table">
            <thead>
              <tr>
                {operationHeaders.map(({ key, label }) => (
                  <th key={key} className="table-header" onClick={() => handleSort(key)}>
                    {label}
                    {sortConfig?.key === key ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedOperations.map((op) => (
                <tr key={op.id} className="table-row" onDoubleClick={() => handleRowDoubleClick(Number(orderNumber), op.operation_code)}>
                  <td className="text-center">{op.operation_code}</td>
                  <td className="text-center">{op.machine?.machine_type ? processTypeLabels[op.machine.machine_type] : "—"}</td>
                  <td className="text-center">{op.machine?.machine_location ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <Button variant="success" size="lg" className="fab-button" onClick={() => setShowCreateOp(true)}>
        + Nova Operação
      </Button>

      <CreateNewOperation
        orderNumber={Number(orderNumber)}
        show={showCreateOp}
        onClose={() => setShowCreateOp(false)}
        onCreateSuccess={(op) => {
          setOperations((prev) => [...prev, op]);
        }}
      />
    </div>
  );
}
