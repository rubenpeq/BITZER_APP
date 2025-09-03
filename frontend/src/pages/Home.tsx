import { useState, useEffect, useMemo, useCallback } from "react";
import { Table, Form, Spinner, Alert, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import CreateNewOrder from "../components/CreateOrder";
import { formatDateTime, type Order } from "../utils/Types";

export default function Home() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Order; direction: "asc" | "desc" } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_FASTAPI_URL;

  // --- Load Orders ---
  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/orders/recent`);
        if (!response.ok) throw new Error("Failed to fetch orders");
        const data: Order[] = await response.json();
        setOrders(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
        setError(errorMessage);
        console.error("Error fetching orders:", err);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [API_URL]);

  // --- Handle Sorting ---
  const handleSort = useCallback((key: keyof Order) => {
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

  // --- Filter Orders (debounced 300ms) ---
  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return orders;

    return orders.filter((order) => String(order.order_number).toLowerCase().includes(term) || String(order.material_number).toLowerCase().includes(term));
  }, [searchTerm, orders]);

  // --- Sort FilteredOrders ---
  const sortedOrders = useMemo(() => {
    if (!sortConfig) return filteredOrders;
    const { key, direction } = sortConfig;

    return [...filteredOrders].sort((a, b) => {
      let aVal: any = a[key];
      let bVal: any = b[key];

      if (aVal === undefined || aVal === null) aVal = "";
      if (bVal === undefined || bVal === null) bVal = "";

      // dates
      if (key === "start_date" || key === "end_date") {
        const aDate = Date.parse(aVal as string);
        const bDate = Date.parse(bVal as string);
        if (isNaN(aDate) && isNaN(bDate)) return 0;
        if (isNaN(aDate)) return direction === "asc" ? -1 : 1;
        if (isNaN(bDate)) return direction === "asc" ? 1 : -1;
        return direction === "asc" ? aDate - bDate : bDate - aDate;
      }

      // numeric comparison for num_pieces
      if (key === "num_pieces") {
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        return direction === "asc" ? aNum - bNum : bNum - aNum;
      }

      // fallback string comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return direction === "asc" ? -1 : 1;
      if (aStr > bStr) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredOrders, sortConfig]);

  // Double click to order details
  const handleRowDoubleClick = useCallback(
    (orderNumber?: number) => {
      if (orderNumber) {
        navigate(`/order/${orderNumber}`);
      }
    },
    [navigate]
  );

  const handleCreateSuccess = useCallback((createdOrder: Order) => {
    setOrders((prev) => [...prev, createdOrder]);
    setShowModal(false);
  }, []);

  // Table Headers
  const orderHeaders: { key: keyof Order; label: string }[] = [
    { key: "order_number", label: "Nº Ordem" },
    { key: "material_number", label: "Nº Material" },
    { key: "start_date", label: "Data Início" },
    { key: "end_date", label: "Data Fim" },
    { key: "num_pieces", label: "Nº Peças" },
  ];

  return (
    <div className="home-container">
      <Form.Control type="search" placeholder="Pesquisar Ordem ... (nº Ordem ou nº Material)" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="mb-3" />

      {loading ? (
        <div className="loading-container">
          <Spinner animation="border" role="status" />
        </div>
      ) : error ? (
        <Alert variant="danger">Erro ao carregar pedidos: {error}</Alert>
      ) : sortedOrders.length === 0 ? (
        <Alert variant="warning">Nenhum pedido encontrado.</Alert>
      ) : (
        <div className="table-container">
          <Table striped bordered hover className="sticky-table" style={{maxHeight: "65vh"}}>
            <thead>
              <tr>
                {orderHeaders.map(({ key, label }) => (
                  <th key={key} className="table-header" onClick={() => handleSort(key)}>
                    {label} {sortConfig?.key === key ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedOrders.map((order, index) => (
                <tr key={order.id ?? index} className="table-row" onDoubleClick={() => handleRowDoubleClick(order.order_number)}>
                  <td>{order.order_number}</td>
                  <td>{order.material_number}</td>
                  <td>{order.start_date ? formatDateTime(order.start_date, "date") : "-"}</td>
                  <td>{order.end_date ? formatDateTime(order.end_date, "date") : "-"}</td>
                  <td>{order.num_pieces}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <Button variant="success" size="lg" className="fab-button" onClick={() => setShowModal(true)}>
        + Nova Ordem
      </Button>

      <CreateNewOrder show={showModal} onClose={() => setShowModal(false)} onCreateSuccess={handleCreateSuccess} />
    </div>
  );
}
