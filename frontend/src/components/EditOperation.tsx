import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Modal, Button, Form, Spinner, Alert, Row, Col, InputGroup } from "react-bootstrap";
import type { Operation, Machine } from "../utils/Types";

type Props = {
  show: boolean;
  onHide: () => void;
  apiUrl: string;
  operation: Operation | null;
  fieldKey: "operation_code" | "machine_location";
  initialValue: any;
  onSaved: (updated: Operation) => void;
};

export default function EditOperationModal({ show, onHide, apiUrl, operation, fieldKey, initialValue, onSaved }: Props) {
  const [operationCode, setOperationCode] = useState<string>("");
  const [machines, setMachines] = useState<Machine[] | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMachines, setLoadingMachines] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // combo states for machine edit
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState<string>("");
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // initialize local values based on field
  useEffect(() => {
    if (fieldKey === "operation_code") {
      setOperationCode(initialValue ?? operation?.operation_code ?? "");
    } else if (fieldKey === "machine_location") {
      setSelectedMachineId(operation?.machine?.id ?? null);
    }
    setError(null);
    setSearchText("");
    setOpen(false);
    setHighlightIndex(-1);
  }, [fieldKey, initialValue, operation, show]);

  // load machines
  useEffect(() => {
    if (!show || fieldKey !== "machine_location") return;

    const fetchMachines = async () => {
      setLoadingMachines(true);
      try {
        const response = await fetch(`${apiUrl}/machines`);
        if (!response.ok) throw new Error("Failed to load machines");
        const data: Machine[] = await response.json();
        setMachines(data);
      } catch {
        setMachines(null);
      } finally {
        setLoadingMachines(false);
      }
    };

    fetchMachines();
  }, [show, fieldKey, apiUrl]);

  // label: only machine_location and description
  const labelFor = useCallback((m: Machine) => {
    const loc = (m.machine_location ?? "").toString();
    const desc = (m.description ?? "").toString();
    return `${loc} — ${desc}`;
  }, []);

  // sync visible input when selection changes
  useEffect(() => {
    if (!machines) return;
    if (selectedMachineId === null) {
      setSearchText("");
      setHighlightIndex(-1);
      return;
    }
    const sel = machines.find((m) => String(m.id) === String(selectedMachineId));
    if (sel) setSearchText(labelFor(sel));
    else setSearchText("");
    setHighlightIndex(-1);
  }, [machines, selectedMachineId, labelFor]);

  // when user types, clear previous selection
  const onInputChange = useCallback(
    (value: string) => {
      setSearchText(value);
      if (selectedMachineId !== null) setSelectedMachineId(null);
      setOpen(true);
      setHighlightIndex(0);
    },
    [selectedMachineId]
  );

  // filtered by only machine_location and description
  const filteredMachines = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return machines ?? [];
    if (!machines) return [];
    return machines.filter((m) => {
      const loc = String(m.machine_location ?? "").toLowerCase();
      const desc = String(m.description ?? "").toLowerCase();
      return loc.includes(q) || desc.includes(q);
    });
  }, [machines, searchText]);

  // keyboard navigation & selection including top "Nenhuma" item
  const totalListCount = (filteredMachines?.length ?? 0) + 1;

  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
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
            // Nenhuma
            setSelectedMachineId(null);
            setSearchText("Nenhuma");
          } else {
            const chosen = filteredMachines[highlightIndex - 1];
            setSelectedMachineId(Number(chosen.id));
            setSearchText(labelFor(chosen));
          }
          setOpen(false);
        }
        e.preventDefault();
      } else if (e.key === "Escape") {
        setOpen(false);
        const sel = machines?.find((m) => String(m.id) === String(selectedMachineId));
        if (sel) setSearchText(labelFor(sel));
        else setSearchText("");
        setHighlightIndex(-1);
      }
    },
    [open, totalListCount, highlightIndex, filteredMachines, labelFor, selectedMachineId, machines]
  );

  const onSelectNone = useCallback(() => {
    setSelectedMachineId(null);
    setSearchText("Nenhuma");
    setOpen(false);
    setHighlightIndex(-1);
  }, []);

  const onSelectMachine = useCallback(
    (m: Machine) => {
      setSelectedMachineId(Number(m.id));
      setSearchText(labelFor(m));
      setOpen(false);
      setHighlightIndex(-1);
    },
    [labelFor]
  );

  // click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
        if (!machines) {
          setSearchText("");
          setSelectedMachineId(null);
          setHighlightIndex(-1);
          return;
        }

        const sel = machines.find((m) => String(m.id) === String(selectedMachineId));
        if (!sel) {
          const exact = machines.find((mm) => labelFor(mm).trim() === searchText.trim());
          if (exact) {
            setSelectedMachineId(Number(exact.id));
            setSearchText(labelFor(exact));
          } else {
            if (searchText.trim() === "Nenhuma") {
              setSelectedMachineId(null);
            } else {
              setSearchText("");
              setSelectedMachineId(null);
            }
          }
        } else {
          if (searchText.trim() !== labelFor(sel).trim()) {
            setSelectedMachineId(null);
            setSearchText("");
          } else {
            setSearchText(labelFor(sel));
          }
        }
        setHighlightIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, selectedMachineId, machines, searchText, labelFor]);

  const handleSubmit = useCallback(async () => {
    setError(null);

    if (!operation) {
      setError("Operação inválida.");
      return;
    }

    let payload: any = {};

    if (fieldKey === "operation_code") {
      if (!operationCode || String(operationCode).trim() === "") {
        setError("Código da operação obrigatório.");
        return;
      }
      payload = { operation_code: String(operationCode) };
    } else if (fieldKey === "machine_location") {
      payload = { machine_id: selectedMachineId === null ? null : Number(selectedMachineId) };
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/operations/${operation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let msg = "Erro ao atualizar operação.";
        try {
          const data = await response.json();
          msg = data.detail || JSON.stringify(data) || msg;
        } catch {
          const txt = await response.text();
          msg = txt || msg;
        }
        throw new Error(msg);
      }

      const updated: Operation = await response.json();
      onSaved(updated);
      onHide();
    } catch (err: any) {
      setError(err.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [operation, fieldKey, operationCode, selectedMachineId, apiUrl, onSaved, onHide]);

  const handleOperationCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setOperationCode(e.target.value);
      if (error) setError(null);
    },
    [error]
  );

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static" keyboard={!loading}>
      <Modal.Header closeButton={!loading} className="center-align">
        <Modal.Title>{fieldKey === "operation_code" ? "Editar — Código de Operação" : "Editar — Cen. Trabalho"}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {fieldKey === "operation_code" ? (
          <Form.Group as={Row} className="mb-3" controlId="operationCode">
            <Form.Label column sm={4}>
              Código
            </Form.Label>
            <Col sm={8}>
              <Form.Control type="text" value={operationCode} onChange={handleOperationCodeChange} disabled={loading} placeholder="Digite o código da operação" className="white-placeholder" />
            </Col>
          </Form.Group>
        ) : (
          <Form.Group as={Row} className="mb-3" controlId="machineSelect">
            <Form.Label column sm={4}>
              Cen. Trabalho
            </Form.Label>
            <Col sm={8}>
              {loadingMachines ? (
                <div className="text-muted">Carregando máquinas...</div>
              ) : machines ? (
                <div ref={wrapperRef} className="position-relative">
                  <InputGroup>
                    <Form.Control
                      ref={inputRef}
                      placeholder="Pesquisar por localização ou descrição..."
                      value={searchText}
                      onChange={(e) => onInputChange(e.target.value)}
                      onFocus={() => {
                        setOpen(true);
                        setHighlightIndex(0);
                      }}
                      onKeyDown={onInputKeyDown}
                      disabled={loading}
                      aria-haspopup="listbox"
                      aria-expanded={open}
                      className="white-placeholder"
                    />
                    <Button
                      variant="outline-secondary"
                      onClick={() => {
                        setOpen((v) => !v);
                        if (!open && selectedMachineId !== null) {
                          const sel = machines.find((m) => String(m.id) === String(selectedMachineId));
                          if (sel) setSearchText(labelFor(sel));
                        }
                        setHighlightIndex(0);
                      }}
                    >
                      {open ? "▴" : "▾"}
                    </Button>
                  </InputGroup>

                  {open && (
                    <div className="list-group position-absolute w-100" style={{ zIndex: 1000, maxHeight: 240, overflowY: "auto" }}>
                      {/* Nenhuma at top */}
                      <div
                        key="none"
                        className={`list-group-item list-group-item-action ${highlightIndex === 0 ? "active" : ""}`}
                        onMouseEnter={() => setHighlightIndex(0)}
                        onClick={onSelectNone}
                        style={{ cursor: "pointer" }}
                      >
                        Nenhuma
                      </div>

                      {filteredMachines.length === 0 ? (
                        <div className="list-group-item text-muted">Nenhuma máquina corresponde à pesquisa.</div>
                      ) : (
                        filteredMachines.map((m, idx) => {
                          const listIndex = idx + 1;
                          return (
                            <div
                              key={m.id}
                              className={`list-group-item list-group-item-action ${listIndex === highlightIndex ? "active" : ""}`}
                              onMouseEnter={() => setHighlightIndex(listIndex)}
                              onClick={() => onSelectMachine(m)}
                              style={{ cursor: "pointer" }}
                            >
                              {labelFor(m)}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-muted">Erro ao carregar máquinas.</div>
              )}
            </Col>
          </Form.Group>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={loading} className="create-button">
          {loading ? <Spinner animation="border" size="sm" /> : "Salvar"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
