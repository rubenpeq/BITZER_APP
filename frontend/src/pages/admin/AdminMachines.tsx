import { useEffect, useMemo, useState } from "react";
import {
  Container,
  Row,
  Col,
  Table,
  Button,
  Form,
  InputGroup,
  Spinner,
  Alert,
} from "react-bootstrap";
import { Pencil, Save, XCircle, Plus } from "react-bootstrap-icons";
import CreateMachine from "../../components/CreateMachine";
import type { Machine } from "../../utils/Types";

const API_URL = (import.meta as any).env?.VITE_FASTAPI_URL ?? "";

export default function AdminMachines() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);

  // filters
  const [query, setQuery] = useState("");
  const [hideInactive, setHideInactive] = useState(false);

  // editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<Machine>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchMachines = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`${API_URL}/machines`, window.location.origin);
      if (hideInactive) url.searchParams.set("active", "true");
      const res = await fetch(url.toString());
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Failed to fetch: ${res.status}`);
      }
      const data = (await res.json()) as Machine[];
      setMachines(data);
    } catch (err: any) {
      setError(err?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMachines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideInactive]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return machines;
    return machines.filter((m) => {
      const loc = (m.machine_location || "").toLowerCase();
      const mid = (m.machine_id || "").toLowerCase();
      const mdesc = (m.description || "").toLowerCase();
      return loc.includes(q) || mid.includes(q) || mdesc.includes(q);
    });
  }, [machines, query]);

  const handleEdit = (m: Machine) => {
    setEditingId(m.id);
    setEditValues({
      machine_location: m.machine_location,
      machine_id: m.machine_id,
      description: m.description ?? "",
      machine_type: m.machine_type,
      active: m.active ?? false,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleChangeEdit = (field: keyof Machine, value: any) => {
    setEditValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (id: number) => {
    setSavingId(id);
    setError(null);

    const original = machines.find((m) => m.id === id);
    if (!original) {
      setError("Original machine not found");
      setSavingId(null);
      return;
    }

    const payload: any = {};
    if ("machine_location" in editValues && editValues.machine_location !== original.machine_location) payload.machine_location = editValues.machine_location;
    if ("machine_id" in editValues && editValues.machine_id !== original.machine_id) payload.machine_id = editValues.machine_id;
    if ("description" in editValues && editValues.description !== original.description) payload.description = editValues.description;
    if ("machine_type" in editValues && editValues.machine_type !== original.machine_type) payload.machine_type = editValues.machine_type;
    if ("active" in editValues && editValues.active !== original.active) payload.active = editValues.active;

    if (Object.keys(payload).length === 0) {
      setEditingId(null);
      setSavingId(null);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/machines/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Failed to save: ${res.status}`);
      }

      const updated = (await res.json()) as Machine;
      setMachines((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setEditingId(null);
      setEditValues({});
    } catch (err: any) {
      setError(err?.message ?? "Network error");
    } finally {
      setSavingId(null);
    }
  };

  const handleCreated = (m: Machine) => {
    if (hideInactive && !m.active) {
      fetchMachines();
      return;
    }
    setMachines((prev) => [m, ...prev]);
  };

  return (
    <Container fluid className="py-4">
      <Row className="mb-3 align-items-center">
        <Col>
          <h2 style={{ fontWeight: 700 }}>Máquinas</h2>
          <div style={{ color: "#9fb2c8" }}>Gerir máquinas — pesquisar, filtrar e editar.</div>
        </Col>
        <Col xs="auto">
          <Button variant="outline-light" onClick={() => setShowCreate(true)}>
            <Plus className="me-1" /> Nova Máquina
          </Button>
        </Col>
      </Row>

      <Row className="mb-3 align-items-center">
        <Col md={6}>
          <InputGroup>
            <Form.Control
              placeholder="Pesquisar por localização, ID de máquina ou descrição"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button variant="outline-secondary" onClick={() => setQuery("")}>
              Limpar
            </Button>
          </InputGroup>
        </Col>

        <Col md="auto" className="d-flex align-items-center">
          <Form.Check
            type="switch"
            id="hide-inactive-machines"
            label="Ocultar inativos"
            checked={hideInactive}
            onChange={(e) => setHideInactive(e.target.checked)}
          />
        </Col>

        <Col className="text-end">
          <Button variant="secondary" onClick={fetchMachines} disabled={loading}>
            {loading ? <><Spinner animation="border" size="sm" /> Atualizar</> : "Atualizar"}
          </Button>
        </Col>
      </Row>

      {error && (
        <Row className="mb-3">
          <Col>
            <Alert variant="danger">{error}</Alert>
          </Col>
        </Row>
      )}

      <Row>
        <Col>
          <div style={{ maxHeight: "56vh", overflow: "auto" }}>
            <Table bordered hover responsive className="align-middle">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>ID</th>
                  <th>Localização</th>
                  <th>ID de máquina</th>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th style={{ width: 110 }}>Ativo</th>
                  <th style={{ width: 160 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-muted text-center">Sem máquinas para mostrar</td>
                  </tr>
                )}

                {filtered.map((m) => {
                  const isEditing = editingId === m.id;
                  return (
                    <tr key={m.id}>
                      <td>{m.id}</td>

                      <td style={{ minWidth: 220 }}>
                        {isEditing ? (
                          <Form.Control
                            value={editValues.machine_location ?? m.machine_location}
                            onChange={(e) => handleChangeEdit("machine_location", e.target.value)}
                          />
                        ) : (
                          m.machine_location
                        )}
                      </td>

                      <td style={{ width: 170 }}>
                        {isEditing ? (
                          <Form.Control
                            value={editValues.machine_id ?? m.machine_id}
                            onChange={(e) => handleChangeEdit("machine_id", e.target.value)}
                          />
                        ) : (
                          m.machine_id
                        )}
                      </td>

                      <td style={{ width: 160 }}>
                        {isEditing ? (
                          <Form.Select
                            value={editValues.machine_type ?? m.machine_type}
                            onChange={(e) => handleChangeEdit("machine_type", e.target.value)}
                          >
                            <option value="CNC">CNC</option>
                            <option value="CONVENTIONAL">Convencional</option>
                          </Form.Select>
                        ) : (
                          m.machine_type
                        )}
                      </td>

                      <td>
                        {isEditing ? (
                          <Form.Control
                            value={editValues.description ?? (m.description ?? "")}
                            onChange={(e) => handleChangeEdit("description", e.target.value)}
                          />
                        ) : (
                          m.description ?? "—"
                        )}
                      </td>

                      <td>
                        {isEditing ? (
                          <Form.Check
                            type="checkbox"
                            checked={Boolean(editValues.active ?? m.active)}
                            onChange={(e) => handleChangeEdit("active", e.target.checked)}
                            label={undefined}
                          />
                        ) : (
                          m.active ? "Sim" : "Não"
                        )}
                      </td>

                      <td>
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              variant="success"
                              className="me-2"
                              onClick={() => handleSave(m.id)}
                              disabled={savingId === m.id}
                            >
                              {savingId === m.id ? <Spinner animation="border" size="sm" /> : <Save className="me-1" />} Guardar
                            </Button>
                            <Button size="sm" variant="outline-secondary" onClick={handleCancelEdit}>
                              <XCircle className="me-1" /> Cancelar
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline-primary" className="me-2" onClick={() => handleEdit(m)}>
                            <Pencil className="me-1" /> Editar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Col>
      </Row>

      <CreateMachine
        show={showCreate}
        onHide={() => setShowCreate(false)}
        onCreated={(m) => handleCreated(m)}
      />
    </Container>
  );
}
