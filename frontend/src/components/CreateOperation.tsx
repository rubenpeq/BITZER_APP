import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Modal, Button, Form, Row, Col, Alert, Spinner, InputGroup } from "react-bootstrap";
import { type Operation, type Machine } from "../utils/Types";

type CreateNewOperationProps = {
  orderId?: number;
  orderNumber?: number;
  show: boolean;
  onClose: () => void;
  onCreateSuccess: (newOperation: Operation) => void;
};

export default function CreateNewOperation({ orderId, orderNumber, show, onClose, onCreateSuccess }: CreateNewOperationProps) {
  const [operationCode, setOperationCode] = useState<string>("");
  const [selectedMachineIdStr, setSelectedMachineIdStr] = useState<string>("");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const API_URL = import.meta.env.VITE_FASTAPI_URL;

  // Combo box state
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState<string>("");
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset form on open
  useEffect(() => {
    if (!show) return;

    setOperationCode("");
    setSelectedMachineIdStr("");
    setSearchText("");
    setOpen(false);
    setHighlightIndex(-1);
    setSubmitAttempted(false);
    setError(null);

    // Fetch machines
    const fetchMachines = async () => {
      try {
        const response = await fetch(`${API_URL}/machines`);
        if (!response.ok) throw new Error("Falha ao carregar máquinas");
        const data: Machine[] = await response.json();
        setMachines(data);
      } catch (err) {
        console.warn("Could not fetch machines:", err);
        setMachines([]);
      }
    };

    fetchMachines();
  }, [show, API_URL]);

  const reset = useCallback(() => {
    setOperationCode("");
    setSelectedMachineIdStr("");
    setSearchText("");
    setOpen(false);
    setHighlightIndex(-1);
    setSubmitAttempted(false);
    setError(null);
  }, []);

  const resolveOrderId = useCallback(async (): Promise<number> => {
    if (orderId && Number.isInteger(orderId)) return orderId;
    if (orderNumber) {
      const response = await fetch(`${API_URL}/orders/${orderNumber}`);
      if (!response.ok) {
        const txt = await response.text().catch(() => "");
        throw new Error(txt || `Ordem ${orderNumber} não encontrada`);
      }
      const order = await response.json();
      if (!order?.id) throw new Error("Ordem encontrada mas sem identificador interno (id).");
      return order.id;
    }
    throw new Error("Nenhum identificador de ordem fornecido (orderId ou orderNumber).");
  }, [orderId, orderNumber, API_URL]);

  const handleCreate = useCallback(async () => {
    setSubmitAttempted(true);
    setError(null);

    if (!operationCode.trim()) {
      setError("Código da operação é obrigatório.");
      return;
    }

    if (selectedMachineIdStr === "") {
      setError("Selecionar uma máquina é obrigatório (ou escolha 'Nenhuma').");
      return;
    }

    setLoading(true);
    try {
      const resolvedId = await resolveOrderId();

      const payload: any = {
        order_id: Number(resolvedId),
        operation_code: operationCode.trim(),
      };

      if (selectedMachineIdStr === "NONE") {
        payload.machine_id = null;
      } else {
        payload.machine_id = Number(selectedMachineIdStr);
      }

      const response = await fetch(`${API_URL}/operations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let msg = `Erro ao criar operação (status ${response.status}).`;
        try {
          const data = await response.json();
          msg = data.detail || JSON.stringify(data) || msg;
        } catch {
          const txt = await response.text();
          msg = txt || msg;
        }
        throw new Error(msg);
      }

      const createdOperation: Operation = await response.json();
      onCreateSuccess(createdOperation);
      reset();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }, [operationCode, selectedMachineIdStr, resolveOrderId, API_URL, onCreateSuccess, reset, onClose]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // Generate label for machine
  const labelFor = useCallback((m: Machine) => {
    const loc = (m.machine_location ?? "").toString();
    const desc = (m.description ?? "").toString();
    return `${loc} — ${desc}`;
  }, []);

  // Sync search text with selection
  useEffect(() => {
    if (selectedMachineIdStr === "") {
      setSearchText("");
      setHighlightIndex(-1);
      return;
    }
    if (selectedMachineIdStr === "NONE") {
      setSearchText("Nenhuma");
      setHighlightIndex(-1);
      return;
    }
    const selectedMachine = machines.find((m) => String(m.id) === String(selectedMachineIdStr));
    if (selectedMachine) setSearchText(labelFor(selectedMachine));
    else setSearchText("");
    setHighlightIndex(-1);
  }, [selectedMachineIdStr, machines, labelFor]);

  // Handle input change
  const onInputChange = useCallback(
    (value: string) => {
      setSearchText(value);
      if (selectedMachineIdStr) setSelectedMachineIdStr("");
      setOpen(true);
      setHighlightIndex(0);
    },
    [selectedMachineIdStr]
  );

  // Filter machines based on search text
  const filteredMachines = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return machines;
    return machines.filter((m) => {
      const loc = String(m.machine_location ?? "").toLowerCase();
      const desc = String(m.description ?? "").toLowerCase();
      return loc.includes(query) || desc.includes(query);
    });
  }, [machines, searchText]);

  // Handle keyboard navigation
  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const totalListCount = filteredMachines.length + 1; // +1 for "Nenhuma"

      if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        setOpen(true);
        setHighlightIndex(0);
        e.preventDefault();
        return;
      }
      if (!open) return;

      if (e.key === "ArrowDown") {
        setHighlightIndex((i) => Math.min(totalListCount - 1, Math.max(0, i + 1)));
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        setHighlightIndex((i) => Math.max(0, i - 1));
        e.preventDefault();
      } else if (e.key === "Enter") {
        if (highlightIndex >= 0 && highlightIndex < totalListCount) {
          if (highlightIndex === 0) {
            // "Nenhuma" selected
            setSelectedMachineIdStr("NONE");
            setSearchText("Nenhuma");
          } else {
            const chosen = filteredMachines[highlightIndex - 1];
            setSelectedMachineIdStr(String(chosen.id));
            setSearchText(labelFor(chosen));
          }
          setOpen(false);
        }
        e.preventDefault();
      } else if (e.key === "Escape") {
        setOpen(false);
        // Restore selection label or clear
        if (selectedMachineIdStr === "NONE") setSearchText("Nenhuma");
        else {
          const selectedMachine = machines.find((m) => String(m.id) === String(selectedMachineIdStr));
          if (selectedMachine) setSearchText(labelFor(selectedMachine));
          else setSearchText("");
        }
        setHighlightIndex(-1);
      }
    },
    [open, filteredMachines, highlightIndex, selectedMachineIdStr, machines, labelFor]
  );

  // Handle selection
  const onSelectNone = useCallback(() => {
    setSelectedMachineIdStr("NONE");
    setSearchText("Nenhuma");
    setOpen(false);
    setHighlightIndex(-1);
  }, []);

  const onSelectMachine = useCallback(
    (m: Machine) => {
      setSelectedMachineIdStr(String(m.id));
      setSearchText(labelFor(m));
      setOpen(false);
      setHighlightIndex(-1);
    },
    [labelFor]
  );

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
        const selectedMachine = machines.find((m) => String(m.id) === String(selectedMachineIdStr));
        if (!selectedMachine && selectedMachineIdStr !== "NONE") {
          // Allow exact-match auto-select, otherwise clear visible text
          const exactMatch = machines.find((m) => labelFor(m).trim() === searchText.trim());
          if (exactMatch) {
            setSelectedMachineIdStr(String(exactMatch.id));
            setSearchText(labelFor(exactMatch));
          } else {
            setSearchText("");
            setSelectedMachineIdStr("");
          }
        } else {
          // If selection is NONE, keep "Nenhuma" label; if selection is a machine, ensure label matches
          if (selectedMachineIdStr === "NONE") {
            setSearchText("Nenhuma");
          } else if (selectedMachine) {
            if (searchText.trim() !== labelFor(selectedMachine).trim()) {
              setSelectedMachineIdStr("");
              setSearchText("");
            } else {
              setSearchText(labelFor(selectedMachine));
            }
          }
        }
        setHighlightIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, selectedMachineIdStr, machines, searchText, labelFor]);

  // Validation states
  const machineInvalid = submitAttempted && selectedMachineIdStr === "";
  const codeInvalid = submitAttempted && !operationCode.trim();
  const createDisabled = loading || !operationCode.trim() || selectedMachineIdStr === "";

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Nova Operação</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}

        <Form>
          <Form.Group as={Row} className="mb-3" controlId="operationCode">
            <Form.Label column sm={4}>
              Código <span className="text-danger">*</span>
            </Form.Label>
            <Col sm={8}>
              <Form.Control
                type="text"
                value={operationCode}
                onChange={(e) => setOperationCode(e.target.value)}
                isInvalid={codeInvalid}
                disabled={loading}
                placeholder="Código de operação..."
                className="white-placeholder"
              />
              <Form.Control.Feedback type="invalid">Código é obrigatório.</Form.Control.Feedback>
            </Col>
          </Form.Group>

          <Form.Group as={Row} className="mb-3" controlId="machineSelect">
            <Form.Label column sm={4}>
              Cen. Trabalho <span className="text-danger">*</span>
            </Form.Label>
            <Col sm={8}>
              {machines.length > 0 ? (
                <div ref={wrapperRef} className="position-relative">
                  <InputGroup>
                    <Form.Control
                      ref={inputRef}
                      isInvalid={machineInvalid}
                      value={searchText}
                      onChange={(e) => onInputChange(e.target.value)}
                      onFocus={() => {
                        setOpen(true);
                        setHighlightIndex(0);
                      }}
                      onKeyDown={onInputKeyDown}
                      disabled={loading}
                      placeholder="Pesquisar por localização ou descrição..."
                      className="white-placeholder"
                    />
                    <Button
                      variant="outline-secondary"
                      onClick={() => {
                        setOpen((v) => !v);
                        if (!open && selectedMachineIdStr) {
                          if (selectedMachineIdStr === "NONE") setSearchText("Nenhuma");
                          else {
                            const selectedMachine = machines.find((m) => String(m.id) === String(selectedMachineIdStr));
                            if (selectedMachine) setSearchText(labelFor(selectedMachine));
                          }
                        }
                        setHighlightIndex(0);
                      }}
                    >
                      {open ? "▴" : "▾"}
                    </Button>
                  </InputGroup>

                  {machineInvalid && <Form.Control.Feedback type="invalid">É obrigatório selecionar uma máquina.</Form.Control.Feedback>}

                  {open && (
                    <div className="list-group position-absolute w-100" style={{ zIndex: 1000, maxHeight: 240, overflowY: "auto" }}>
                      {/* "Nenhuma" option */}
                      <div
                        className={`list-group-item list-group-item-action ${highlightIndex === 0 ? "active" : ""}`}
                        onMouseEnter={() => setHighlightIndex(0)}
                        onClick={onSelectNone}
                        style={{ cursor: "pointer" }}
                      >
                        Nenhuma
                      </div>

                      {/* Machine options */}
                      {filteredMachines.map((machine, index) => {
                        const listIndex = index + 1;
                        return (
                          <div
                            key={machine.id}
                            className={`list-group-item list-group-item-action ${listIndex === highlightIndex ? "active" : ""}`}
                            onMouseEnter={() => setHighlightIndex(listIndex)}
                            onClick={() => onSelectMachine(machine)}
                            style={{ cursor: "pointer" }}
                          >
                            {labelFor(machine)}
                          </div>
                        );
                      })}

                      {filteredMachines.length === 0 && <div className="list-group-item text-muted">Nenhuma máquina corresponde à pesquisa.</div>}
                    </div>
                  )}
                </div>
              ) : (
                <Form.Text className="text-muted">Nenhuma máquina disponível. Crie máquinas no sistema antes de criar operações.</Form.Text>
              )}
            </Col>
          </Form.Group>
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleCreate} disabled={createDisabled} className="create-button">
          {loading ? <Spinner animation="border" size="sm" /> : "Criar"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
