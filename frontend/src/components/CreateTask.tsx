import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Modal, Button, Form, Row, Col, Alert, Spinner, InputGroup } from "react-bootstrap";
import type { Task, TaskCreate } from "../utils/Types";

const VALID_PROCESS_TYPES = ["PREPARATION", "QUALITY_CONTROL", "PROCESSING"] as const;
type ProcessTypeStr = (typeof VALID_PROCESS_TYPES)[number];

type CreateTaskProps = {
  operationId: number;
  show: boolean;
  onClose: () => void;
  onCreateSuccess: (newTask: Task) => void;
};

type TaskForm = {
  process_type: string;
  operator_user_id?: number | null;
  start_at_date?: string;
  start_at_time?: string;
  end_at_date?: string;
  end_at_time?: string;
  good_pieces?: number | "";
  bad_pieces?: number | "";
  num_benches?: number | "";
  num_machines?: number | "";
  notes?: string;
};

type UserOption = { id: number; name: string; bitzer_id?: number | null };

export default function CreateTask({ operationId, show, onClose, onCreateSuccess }: CreateTaskProps) {
  const todayDate = new Date().toISOString().slice(0, 10);
  const API_URL = import.meta.env.VITE_FASTAPI_URL;

  const [task, setTask] = useState<TaskForm>({
    process_type: "",
    operator_user_id: undefined,
    start_at_date: todayDate,
    start_at_time: "",
    end_at_date: todayDate,
    end_at_time: "",
    good_pieces: "",
    bad_pieces: "",
    num_benches: "",
    num_machines: "",
    notes: "",
  });

  const [showOptionals, setShowOptionals] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // users + combobox states
  const [users, setUsers] = useState<UserOption[] | null>(null);
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [selectedUserId, setSelectedUserId] = useState<number | null | undefined>(undefined);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (show) {
      setTask({
        process_type: "",
        operator_user_id: undefined,
        start_at_date: todayDate,
        start_at_time: "",
        end_at_date: todayDate,
        end_at_time: "",
        good_pieces: "",
        bad_pieces: "",
        num_benches: "",
        num_machines: "",
        notes: "",
      });
      setShowOptionals(false);
      setError(null);
      setLoading(false);
      setSearchText("");
      setOpen(false);
      setHighlightIndex(-1);
      setSelectedUserId(undefined);
    }
  }, [show, todayDate]);

  // Load active users when modal opens
  useEffect(() => {
    if (!show) return;

    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API_URL}/users?active=true`);
        if (!res.ok) throw new Error("Falha ao carregar utilizadores");
        const json = await res.json();
        setUsers((json ?? []).map((u: any) => ({ id: u.id, name: u.name, bitzer_id: u.bitzer_id ?? null })));
      } catch {
        setUsers([]);
      }
    };

    fetchUsers();
  }, [API_URL, show]);

  // Label for each user
  const labelFor = useCallback((u: UserOption) => `${u.bitzer_id ? `${u.bitzer_id} — ` : ""}${u.name}`, []);

  // Filtered users from searchText
  const filteredUsers = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return users ?? [];
    if (!users) return [];
    return users.filter((u) => {
      const name = (u.name ?? "").toLowerCase();
      const bid = String(u.bitzer_id ?? "").toLowerCase();
      return name.includes(q) || bid.includes(q);
    });
  }, [searchText, users]);

  // When user types, clear selection
  const onInputChange = useCallback(
    (value: string) => {
      setSearchText(value);
      if (selectedUserId !== undefined && selectedUserId !== null) setSelectedUserId(undefined);
      setOpen(true);
      setHighlightIndex(0);
    },
    [selectedUserId]
  );

  // Keyboard navigation
  const totalListCount = (filteredUsers?.length ?? 0) + 1; // +1 for Nenhuma
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
            setSelectedUserId(null);
            setSearchText("Nenhuma");
          } else {
            const chosen = filteredUsers[highlightIndex - 1];
            setSelectedUserId(Number(chosen.id));
            setSearchText(labelFor(chosen));
          }
          setOpen(false);
        }
        e.preventDefault();
      } else if (e.key === "Escape") {
        setOpen(false);
        // restore selected or clear
        if (selectedUserId) {
          const sel = users?.find((u) => Number(u.id) === Number(selectedUserId));
          if (sel) setSearchText(labelFor(sel));
        } else {
          setSearchText("");
        }
        setHighlightIndex(-1);
      }
    },
    [open, totalListCount, highlightIndex, filteredUsers, labelFor, selectedUserId, users]
  );

  // Click outside: accept exact match or clear
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
        if (!users) {
          setSearchText("");
          setSelectedUserId(undefined);
          setHighlightIndex(-1);
          return;
        }
        const sel = users.find((u) => String(u.id) === String(selectedUserId));
        if (!sel) {
          const exact = users.find((u) => labelFor(u).trim() === searchText.trim());
          if (exact) {
            setSelectedUserId(Number(exact.id));
            setSearchText(labelFor(exact));
          } else {
            if (searchText.trim() === "Nenhuma") {
              setSelectedUserId(null);
            } else {
              setSearchText("");
              setSelectedUserId(undefined);
            }
          }
        } else {
          if (searchText.trim() !== labelFor(sel).trim()) {
            setSelectedUserId(undefined);
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
  }, [users, searchText, selectedUserId, labelFor]);

  const onSelectNone = useCallback(() => {
    setSelectedUserId(null);
    setSearchText("Nenhuma");
    setOpen(false);
    setHighlightIndex(-1);
  }, []);

  const onSelectUser = useCallback(
    (u: UserOption) => {
      setSelectedUserId(Number(u.id));
      setSearchText(labelFor(u));
      setOpen(false);
      setHighlightIndex(-1);
    },
    [labelFor]
  );

  const localPartsToIso = useCallback((date: string, time: string) => {
    if (!date || !time) return null;
    return new Date(`${date}T${time}`).toISOString();
  }, []);

  const buildPayload = useCallback((): TaskCreate => {
    if (!VALID_PROCESS_TYPES.includes(task.process_type as ProcessTypeStr)) {
      throw new Error("Tipo de processo inválido.");
    }

    const payload: any = { process_type: task.process_type as ProcessTypeStr };

    if (selectedUserId !== undefined && selectedUserId !== null) {
      payload.operator_user_id = selectedUserId;
      const sel = users?.find((u) => Number(u.id) === Number(selectedUserId));
      payload.operator_bitzer_id = sel?.bitzer_id ?? null;
    } else if (selectedUserId === null) {
      // explicitly clearing operator
      payload.operator_user_id = null;
      payload.operator_bitzer_id = null;
    }

    const startIso = task.start_at_date && task.start_at_time ? localPartsToIso(task.start_at_date, task.start_at_time) : null;
    const endIso = task.end_at_date && task.end_at_time ? localPartsToIso(task.end_at_date, task.end_at_time) : null;
    if (startIso) payload.start_at = startIso;
    if (endIso) payload.end_at = endIso;

    if (task.good_pieces !== "" && task.good_pieces !== undefined) payload.good_pieces = Number(task.good_pieces);
    if (task.bad_pieces !== "" && task.bad_pieces !== undefined) payload.bad_pieces = Number(task.bad_pieces);
    if (task.num_benches !== "" && task.num_benches !== undefined) payload.num_benches = Number(task.num_benches);
    if (task.num_machines !== "" && task.num_machines !== undefined) payload.num_machines = Number(task.num_machines);

    if (task.notes && task.notes.trim() !== "") payload.notes = task.notes.trim();

    return payload as TaskCreate;
  }, [task, selectedUserId, users, localPartsToIso]);

  const handleCreate = useCallback(async () => {
    setError(null);
    if (!task.process_type) {
      setError("O campo 'Tipo de Processo' é obrigatório.");
      return;
    }
    setLoading(true);
    try {
      const payload = buildPayload();
      const res = await fetch(`${API_URL}/operations/${operationId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let msg = "Erro ao criar tarefa.";
        try {
          const data = await res.json();
          msg = data?.detail ? (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail)) : JSON.stringify(data);
        } catch {
          msg = (await res.text()) || msg;
        }
        throw new Error(msg);
      }
      const createdTask: Task = await res.json();
      onCreateSuccess(createdTask);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Erro inesperado ao criar tarefa.");
    } finally {
      setLoading(false);
    }
  }, [task.process_type, buildPayload, API_URL, operationId, onCreateSuccess, onClose]);

  const toggleOptionals = useCallback(() => {
    setShowOptionals((s) => !s);
  }, []);

  const handleTaskChange = useCallback((field: keyof TaskForm, value: any) => {
    setTask((prev) => ({ ...prev, [field]: value }));
  }, []);

  const incrementValue = useCallback((field: "good_pieces" | "bad_pieces" | "num_benches" | "num_machines", amount: number) => {
    setTask((prev) => {
      const currentValue = prev[field] === "" ? 0 : Number(prev[field]);
      return { ...prev, [field]: Math.max(0, currentValue + amount) };
    });
  }, []);

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Nova Tarefa</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Tipo de Processo</Form.Label>
            <div className="select-wrapper">
              <Form.Select value={task.process_type} onChange={(e) => handleTaskChange("process_type", e.target.value)} className="dark-select">
                <option value="">Selecione um tipo de processo</option>
                <option value="PREPARATION">Preparação de Máquina</option>
                <option value="QUALITY_CONTROL">Controlo de Qualidade</option>
                <option value="PROCESSING">Processamento</option>
              </Form.Select>
            </div>
          </Form.Group>

          {/* Operator combobox (search + select) */}
          <Form.Group className="mb-3">
            <Form.Label>Operador</Form.Label>
            {users === null ? (
              <div>Carregando utilizadores...</div>
            ) : (
              <div ref={wrapperRef} className="position-relative">
                <InputGroup>
                  <Form.Control
                    ref={inputRef}
                    placeholder="Pesquisar por nome ou id..."
                    value={searchText}
                    onChange={(e) => onInputChange(e.target.value)}
                    onFocus={() => {
                      setOpen(true);
                      setHighlightIndex(0);
                    }}
                    onKeyDown={onInputKeyDown}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    className="white-placeholder"
                  />
                  <Button
                    variant="outline-secondary"
                    onClick={() => {
                      setOpen((v) => !v);
                      if (!open && selectedUserId !== undefined && selectedUserId !== null) {
                        const sel = users?.find((u) => String(u.id) === String(selectedUserId));
                        if (sel) setSearchText(labelFor(sel));
                      }
                      setHighlightIndex(0);
                    }}
                  >
                    {open ? "▴" : "▾"}
                  </Button>
                </InputGroup>

                {open && (
                  <ul role="listbox" className="list-group position-absolute w-100" style={{ zIndex: 1200, maxHeight: 260, overflowY: "auto" }}>
                    <li
                      key="none"
                      role="option"
                      aria-selected={selectedUserId === null && searchText === "Nenhuma"}
                      className={"list-group-item list-group-item-action" + (highlightIndex === 0 ? " active" : "")}
                      onMouseEnter={() => setHighlightIndex(0)}
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        onSelectNone();
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      Nenhuma
                    </li>

                    {filteredUsers.length === 0 ? (
                      <li className="list-group-item text-muted">Nenhum utilizador corresponde à pesquisa.</li>
                    ) : (
                      filteredUsers.map((u, idx) => {
                        const listIndex = idx + 1;
                        const isHighlighted = listIndex === highlightIndex;
                        const isSelected = String(u.id) === String(selectedUserId);
                        return (
                          <li
                            key={u.id}
                            role="option"
                            aria-selected={isSelected}
                            className={"list-group-item list-group-item-action" + (isHighlighted ? " active" : "")}
                            onMouseEnter={() => setHighlightIndex(listIndex)}
                            onMouseDown={(ev) => {
                              ev.preventDefault();
                              onSelectUser(u);
                            }}
                            style={{ cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                          >
                            {labelFor(u)}
                          </li>
                        );
                      })
                    )}
                  </ul>
                )}
              </div>
            )}
          </Form.Group>

          <div className="mb-2 d-flex justify-content-center">
            <Button variant="outline-info" size="sm" onClick={toggleOptionals}>
              {showOptionals ? "Ocultar opcionais" : "Mostrar opcionais"}
            </Button>
          </div>

          {showOptionals && (
            <>
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Label>Início (data)</Form.Label>
                  <Form.Control type="date" value={task.start_at_date ?? todayDate} onChange={(e) => handleTaskChange("start_at_date", e.target.value)} />
                </Col>
                <Col md={6}>
                  <Form.Label>Início (hora)</Form.Label>
                  <Form.Control type="time" value={task.start_at_time ?? ""} onChange={(e) => handleTaskChange("start_at_time", e.target.value)} />
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={6}>
                  <Form.Label>Fim (data)</Form.Label>
                  <Form.Control type="date" value={task.end_at_date ?? todayDate} onChange={(e) => handleTaskChange("end_at_date", e.target.value)} />
                </Col>
                <Col md={6}>
                  <Form.Label>Fim (hora)</Form.Label>
                  <Form.Control type="time" value={task.end_at_time ?? ""} onChange={(e) => handleTaskChange("end_at_time", e.target.value)} />
                </Col>
              </Row>

              <Row className="mb-2">
                <Col md={6}>
                  <Form.Label>Peças Boas</Form.Label>
                  <InputGroup>
                    <Button variant="outline-secondary" onClick={() => incrementValue("good_pieces", -1)}>
                      −
                    </Button>
                    <Form.Control
                      type="number"
                      min={0}
                      value={task.good_pieces === "" ? "" : String(task.good_pieces)}
                      onChange={(e) => handleTaskChange("good_pieces", e.target.value === "" ? "" : Number(e.target.value))}
                      className="no-spinners"
                    />
                    <Button variant="outline-secondary" onClick={() => incrementValue("good_pieces", 1)}>
                      +
                    </Button>
                  </InputGroup>
                </Col>

                <Col md={6}>
                  <Form.Label>Peças Defeituosas</Form.Label>
                  <InputGroup>
                    <Button variant="outline-secondary" onClick={() => incrementValue("bad_pieces", -1)}>
                      −
                    </Button>
                    <Form.Control
                      type="number"
                      min={0}
                      value={task.bad_pieces === "" ? "" : String(task.bad_pieces)}
                      onChange={(e) => handleTaskChange("bad_pieces", e.target.value === "" ? "" : Number(e.target.value))}
                      className="no-spinners"
                    />
                    <Button variant="outline-secondary" onClick={() => incrementValue("bad_pieces", 1)}>
                      +
                    </Button>
                  </InputGroup>
                </Col>
              </Row>

              <Row className="mb-2">
                <Col md={6}>
                  <Form.Label>Bancadas</Form.Label>
                  <InputGroup>
                    <Button variant="outline-secondary" onClick={() => incrementValue("num_benches", -1)}>
                      −
                    </Button>
                    <Form.Control
                      type="number"
                      min={0}
                      value={task.num_benches === "" ? "" : String(task.num_benches)}
                      onChange={(e) => handleTaskChange("num_benches", e.target.value === "" ? "" : Number(e.target.value))}
                      className="no-spinners"
                    />
                    <Button variant="outline-secondary" onClick={() => incrementValue("num_benches", 1)}>
                      +
                    </Button>
                  </InputGroup>
                </Col>

                <Col md={6}>
                  <Form.Label>Máquinas</Form.Label>
                  <InputGroup>
                    <Button variant="outline-secondary" onClick={() => incrementValue("num_machines", -1)}>
                      −
                    </Button>
                    <Form.Control
                      type="number"
                      min={0}
                      value={task.num_machines === "" ? "" : String(task.num_machines)}
                      onChange={(e) => handleTaskChange("num_machines", e.target.value === "" ? "" : Number(e.target.value))}
                      className="no-spinners"
                    />
                    <Button variant="outline-secondary" onClick={() => incrementValue("num_machines", 1)}>
                      +
                    </Button>
                  </InputGroup>
                </Col>
              </Row>

              <Row>
                <Col>
                  <Form.Label>Observações</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    maxLength={1000}
                    value={task.notes ?? ""}
                    onChange={(e) => handleTaskChange("notes", e.target.value)}
                    placeholder="Notas do operador (máx. 1000 caracteres)"
                    className="white-placeholder"
                  />
                </Col>
              </Row>
            </>
          )}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleCreate} disabled={loading} className="create-button">
          {loading ? <Spinner size="sm" animation="border" /> : "Criar"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
