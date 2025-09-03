import { useState, useEffect, useCallback } from "react";
import { Modal, Button, Form, Alert, Spinner } from "react-bootstrap";
import type { Order } from "../utils/Types";

type Props = {
  show: boolean;
  onHide: () => void;
  apiUrl: string;
  orderNumber?: number;
  fieldKey: string;
  label: string;
  initialValue: any;
  onSaved: (updatedOrder: Order) => void;
};

export default function EditOrderFieldModal({ show, onHide, apiUrl, orderNumber, fieldKey, label, initialValue, onSaved }: Props) {
  const [value, setValue] = useState<string>(initialValue ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens or initialValue changes
  useEffect(() => {
    if (show) {
      setValue(initialValue === null || initialValue === undefined ? "" : String(initialValue));
      setError(null);
      setLoading(false);
    }
  }, [show, initialValue]);

  // Convert payload based on field type
  const convertPayload = useCallback((): any => {
    if (!value || value.trim() === "") {
      throw new Error(`${label} não pode ser vazio.`);
    }

    if (["order_number", "material_number", "num_pieces"].includes(fieldKey)) {
      const numericValue = Number(value);
      if (Number.isNaN(numericValue)) throw new Error("Valor numérico inválido.");
      return { [fieldKey]: numericValue };
    }

    if (fieldKey === "start_date" || fieldKey === "end_date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Formato de data inválido (YYYY-MM-DD).");
      return { [fieldKey]: value };
    }

    return { [fieldKey]: value };
  }, [fieldKey, value, label]);

  // Handle save action
  const handleSave = useCallback(async () => {
    setError(null);
    let payload;

    try {
      payload = convertPayload();
    } catch (err: any) {
      setError(err.message || "Valor inválido");
      return;
    }

    if (!window.confirm(`Confirmar alteração de "${label}"?`)) return;

    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/orders/${orderNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Erro ${response.status} ao atualizar ordem`);
      }

      const updated: Order = await response.json();
      onSaved(updated);
      onHide();
    } catch (err: any) {
      setError(err.message || "Erro desconhecido ao salvar.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, orderNumber, fieldKey, label, convertPayload, onSaved, onHide]);

  // Get input type based on field key
  const getInputType = useCallback(() => {
    if (fieldKey === "start_date" || fieldKey === "end_date") return "date";
    if (["order_number", "material_number", "num_pieces"].includes(fieldKey)) return "number";
    return "text";
  }, [fieldKey]);

  // Get placeholder based on field key
  const getPlaceholder = useCallback(() => {
    if (fieldKey === "order_number") return "Ex: 12345";
    if (fieldKey === "material_number") return "Ex: 67890";
    if (fieldKey === "num_pieces") return "Ex: 100";
    if (fieldKey === "start_date" || fieldKey === "end_date") return "YYYY-MM-DD";
    return `Digite ${label.toLowerCase()}`;
  }, [fieldKey, label]);

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value);
      if (error) setError(null);
    },
    [error]
  );

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static" keyboard={!loading}>
      <Modal.Header closeButton={!loading}>
        <Modal.Title>Editar — {label}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && (
          <Alert variant="danger" onClose={() => setError(null)} dismissible>
            {error}
          </Alert>
        )}

        <Form.Group>
          <Form.Label>{label}</Form.Label>
          <Form.Control
            type={getInputType()}
            value={value}
            onChange={handleInputChange}
            disabled={loading}
            placeholder={getPlaceholder()}
            className="white-placeholder"
            min={fieldKey === "order_number" || fieldKey === "material_number" || fieldKey === "num_pieces" ? "1" : undefined}
            step={fieldKey === "num_pieces" ? "1" : undefined}
          />
        </Form.Group>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={loading} className="create-button">
          {loading ? <Spinner animation="border" size="sm" /> : "Salvar"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
