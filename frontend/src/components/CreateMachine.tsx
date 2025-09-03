import { useState } from "react";
import { Modal, Button, Form, Alert } from "react-bootstrap";
import type { Machine, MachineType } from "../utils/Types";

const API_URL = (import.meta as any).env?.VITE_FASTAPI_URL ?? "";

type Props = {
  show: boolean;
  onHide: () => void;
  onCreated: (m: Machine) => void;
};

export default function CreateMachine({ show, onHide, onCreated }: Props) {
  const [machineLocation, setMachineLocation] = useState("");
  const [machineId, setMachineId] = useState("");
  const [description, setDescription] = useState("");
  const [machineType, setMachineType] = useState<MachineType>("CNC");
  const [active, setActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setMachineLocation("");
    setMachineId("");
    setDescription("");
    setMachineType("CNC");
    setActive(true);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onHide();
  };

  const handleCreate = async () => {
    setError(null);
    if (!machineLocation.trim()) {
      setError("O campo 'Localização da máquina' é obrigatório.");
      return;
    }
    if (!machineId.trim()) {
      setError("O campo 'Machine ID' é obrigatório.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        machine_location: machineLocation.trim(),
        machine_id: machineId.trim(),
        description: description.trim() || undefined,
        machine_type: machineType,
        active: active,
      };

      const res = await fetch(`${API_URL}/machines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed: ${res.status}`);
      }

      const created = (await res.json()) as Machine;
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
        <Modal.Title>Nova Máquina</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}

        <Form>
          <Form.Group className="mb-3" controlId="machineLocation">
            <Form.Label>Localização da Máquina</Form.Label>
            <Form.Control
              type="text"
              placeholder="Ex.: 12705"
              value={machineLocation}
              onChange={(e) => setMachineLocation(e.target.value)}
              autoFocus
              className="white-placeholder"
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="machineId">
            <Form.Label>Machine ID</Form.Label>
            <Form.Control
              type="text"
              placeholder="Ex.: 13818"
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="white-placeholder"
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="machineType">
            <Form.Label>Tipo</Form.Label>
            <Form.Select value={machineType} onChange={(e) => setMachineType(e.target.value as MachineType)} className="dark-select">
              <option value="CNC">CNC</option>
              <option value="CONVENTIONAL">Convencional</option>
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3" controlId="description">
            <Form.Label>Descrição (opcional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              placeholder="Descrição da máquina"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="white-placeholder"
            />
          </Form.Group>

          <Form.Group className="mb-0" controlId="active">
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
          {loading ? "Criando..." : "Criar Máquina"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
