import { useEffect, useState, useMemo } from "react";
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
import CreateUser from "../../components/CreateUser";
import type { User } from "../../utils/Types";

const API_URL = (import.meta as any).env?.VITE_FASTAPI_URL ?? "";

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);

  // filters
  const [query, setQuery] = useState("");
  const [hideInactive, setHideInactive] = useState(false);

  // editing state: id currently being edited, and form values
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<User>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  // fetch users (if hideInactive is true we call API with active=true to reduce payload)
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`${API_URL}/users`, window.location.origin);
      if (hideInactive) url.searchParams.set("active", "true");
      const res = await fetch(url.toString());
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Failed to fetch: ${res.status}`);
      }
      const data = (await res.json()) as User[];
      setUsers(data);
    } catch (err: any) {
      setError(err?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideInactive]);

  // derived filtered list
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = (u.name || "").toLowerCase();
      const bitzer = u.bitzer_id != null ? String(u.bitzer_id) : "";
      return name.includes(q) || bitzer.includes(q);
    });
  }, [users, query]);

  // start editing a row
  const handleEdit = (u: User) => {
    setEditingId(u.id);
    setEditValues({
      name: u.name,
      bitzer_id: u.bitzer_id ?? undefined,
      active: u.active ?? false,
      is_admin: u.is_admin ?? false,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleChangeEdit = (field: keyof User, value: any) => {
    setEditValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (id: number) => {
    setSavingId(id);
    setError(null);

    // prepare payload only with changed fields compared to current users state
    const original = users.find((u) => u.id === id);
    if (!original) {
      setError("Original user not found");
      setSavingId(null);
      return;
    }

    const payload: any = {};
    if ("name" in editValues && editValues.name !== original.name) payload.name = editValues.name;
    if ("bitzer_id" in editValues) {
      // convert empty -> null
      const val = (editValues.bitzer_id as any);
      payload.bitzer_id = val === "" || val == null ? null : Number(val);
      if (payload.bitzer_id !== original.bitzer_id) {
        // keep payload.bitzer_id as is (null allowed)
      } else {
        delete payload.bitzer_id;
      }
    }
    if ("active" in editValues && editValues.active !== original.active) payload.active = editValues.active;
    if ("is_admin" in editValues && editValues.is_admin !== original.is_admin) payload.is_admin = editValues.is_admin;

    // nothing changed
    if (Object.keys(payload).length === 0) {
      setEditingId(null);
      setSavingId(null);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Failed to save: ${res.status}`);
      }

      const updated = (await res.json()) as User;
      setUsers((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setEditingId(null);
      setEditValues({});
    } catch (err: any) {
      setError(err?.message ?? "Network error");
    } finally {
      setSavingId(null);
    }
  };

  const handleCreated = (u: User) => {
    // if hideInactive is true and created user is inactive, don't add it to list
    if (hideInactive && !u.active) {
      // refetch to ensure backend-state consistent
      fetchUsers();
      return;
    }
    setUsers((prev) => [u, ...prev]);
  };

  return (
    <Container fluid className="py-4">
      <Row className="mb-3 align-items-center">
        <Col>
          <h2 style={{ fontWeight: 700 }}>Utilizadores</h2>
          <div style={{ color: "#9fb2c8" }}>Gerir contas — pesquisar, filtrar e editar utilizadores.</div>
        </Col>
        <Col xs="auto">
          <Button variant="outline-light" className="me-2" onClick={() => setShowCreate(true)}>
            <Plus className="me-1" /> Novo Utilizador
          </Button>
        </Col>
      </Row>

      <Row className="mb-3 align-items-center">
        <Col md={6}>
          <InputGroup>
            <Form.Control
              placeholder="Pesquisar por nome ou Bitzer ID"
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
            id="hide-inactive-switch"
            label="Ocultar inativos"
            checked={hideInactive}
            onChange={(e) => setHideInactive(e.target.checked)}
          />
        </Col>
        <Col className="text-end">
          <Button variant="secondary" onClick={fetchUsers} disabled={loading}>
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
                  <th>Bitzer ID</th>
                  <th>Nome</th>
                  <th>Ativo</th>
                  <th>Admin</th>
                  <th style={{ width: 160 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-muted text-center">Sem utilizadores para mostrar</td>
                  </tr>
                )}

                {filtered.map((u) => {
                  const isEditing = editingId === u.id;
                  return (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td style={{ width: 140 }}>
                        {isEditing ? (
                          <Form.Control
                            value={editValues.bitzer_id ?? (u.bitzer_id ?? "")}
                            onChange={(e) => handleChangeEdit("bitzer_id", e.target.value)}
                            placeholder="Bitzer ID"
                          />
                        ) : (
                          u.bitzer_id ?? "—"
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <Form.Control
                            value={editValues.name ?? u.name}
                            onChange={(e) => handleChangeEdit("name", e.target.value)}
                          />
                        ) : (
                          u.name
                        )}
                      </td>
                      <td style={{ width: 110 }}>
                        {isEditing ? (
                          <Form.Check
                            type="checkbox"
                            checked={Boolean(editValues.active ?? u.active)}
                            onChange={(e) => handleChangeEdit("active", e.target.checked)}
                            label={undefined}
                          />
                        ) : (
                          u.active ? "Sim" : "Não"
                        )}
                      </td>
                      <td style={{ width: 110 }}>
                        {isEditing ? (
                          <Form.Check
                            type="checkbox"
                            checked={Boolean(editValues.is_admin ?? u.is_admin)}
                            onChange={(e) => handleChangeEdit("is_admin", e.target.checked)}
                            label={undefined}
                          />
                        ) : (
                          u.is_admin ? "Sim" : "Não"
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              variant="success"
                              className="me-2"
                              onClick={() => handleSave(u.id)}
                              disabled={savingId === u.id}
                            >
                              {savingId === u.id ? <Spinner animation="border" size="sm" /> : <Save className="me-1" />} Guardar
                            </Button>
                            <Button size="sm" variant="outline-secondary" onClick={handleCancelEdit}>
                              <XCircle className="me-1" /> Cancelar
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline-primary" className="me-2" onClick={() => handleEdit(u)}>
                              <Pencil className="me-1" /> Editar
                            </Button>
                          </>
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

      <CreateUser
        show={showCreate}
        onHide={() => setShowCreate(false)}
        onCreated={(u) => handleCreated(u)}
      />
    </Container>
  );
}
