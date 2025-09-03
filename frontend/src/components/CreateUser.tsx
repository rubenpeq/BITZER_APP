import { useState } from "react";
import { Modal, Button, Form, Alert } from "react-bootstrap";
import type { User } from "../utils/Types";

// Use Vite env variable if present, otherwise empty (same origin)
const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? "";

type Props = {
  show: boolean;
  onHide: () => void;
  onCreated: (u: User) => void;
};

export default function CreateUser({ show, onHide, onCreated }: Props) {
  const [name, setName] = useState("");
  const [bitzerId, setBitzerId] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [active, setActive] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setName("");
    setBitzerId("");
    setIsAdmin(false);
    setPassword("");
    setActive(true);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onHide();
  };

  const handleCreate = async () => {
    setError(null);
    if (!name.trim()) {
      setError("O nome é obrigatório.");
      return;
    }
    if (!bitzerId.trim()) {
      setError("O Bitzer ID é obrigatório.");
      return;
    }
    setLoading(true);

    const payload: any = {
      name: name.trim(),
      active: active,
      is_admin: isAdmin,
    };

    // include bitzer_id only if provided
    if (bitzerId.trim() !== "") {
      const parsed = Number(bitzerId);
      if (Number.isNaN(parsed)) {
        setError("Bitzer ID must be a number.");
        setLoading(false);
        return;
      }
      payload.bitzer_id = parsed;
    }

    // include password only if given (backend currently stores password_hash on create)
    if (password.trim() !== "") payload.password = password;

    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.detail || `Request failed: ${res.status}`);
        setLoading(false);
        return;
      }

      const created = (await res.json()) as User;
      onCreated(created);
      reset();
      onHide();
    } catch (err: any) {
      setError(err?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Novo Utilizador</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}

        <Form>
          <Form.Group className="mb-3" controlId="userName">
            <Form.Label>Nome</Form.Label>
            <Form.Control
              type="text"
              placeholder="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="white-placeholder"
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="userBitzerId">
            <Form.Label>Bitzer ID </Form.Label>
            <Form.Control
              type="text"
              placeholder="Ex.: 12345"
              value={bitzerId}
              onChange={(e) => setBitzerId(e.target.value)}
              className="white-placeholder"
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="userPassword">
            <Form.Label>Senha (opcional)</Form.Label>
            <Form.Control
              type="password"
              placeholder="Senha inicial (opcional)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="white-placeholder"
            />
            <Form.Text style={{color: "whitesmoke"}} >Ainda não implementado.</Form.Text>
          </Form.Group>

          <Form.Group className="mb-3" controlId="userIsAdmin">
            <Form.Check
              type="checkbox"
              label="Administrador"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
            />
          </Form.Group>

          <Form.Group className="mb-0" controlId="userActive">
            <Form.Check
              type="checkbox"
              label="Ativo"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleCreate} disabled={loading}>
          {loading ? "Criando..." : "Criar Utilizador"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
