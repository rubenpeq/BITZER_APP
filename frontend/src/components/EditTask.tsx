import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Modal, Button, Form, Alert, Row, Col, InputGroup, Spinner } from "react-bootstrap";
import type { Task } from "../utils/Types";

type Props = {
  show: boolean;
  onHide: () => void;
  apiUrl: string;
  taskId: number;
  fieldKey: string; // e.g. "operator" | "start_at" | "end_at" | "process_type" | "good_pieces" ...
  label: string;
  initialValue: any;
  onSaved: (updatedTask: Task) => void;
};

const VALID_PROCESS_TYPES = ["PREPARATION", "QUALITY_CONTROL", "PROCESSING"] as const;
type ProcessTypeStr = (typeof VALID_PROCESS_TYPES)[number];
type UserOption = { id: number; name: string; bitzer_id?: number | null };

const isoToLocalParts = (iso?: string | null) => {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: "", time: "" };
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
};

const localPartsToIso = (localDate: string, localTime: string) => {
  if (!localDate || !localTime) return null;
  const d = new Date(`${localDate}T${localTime}`);
  return d.toISOString();
};

export default function EditTask({ show, onHide, apiUrl, taskId, fieldKey, label, initialValue, onSaved }: Props) {
  const [value, setValue] = useState<string | number | null>(initialValue ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [startAtDate, setStartAtDate] = useState<string>("");
  const [startAtTime, setStartAtTime] = useState<string>("");
  const [endAtDate, setEndAtDate] = useState<string>("");
  const [endAtTime, setEndAtTime] = useState<string>("");

  // user combobox states (for operator editing)
  const [users, setUsers] = useState<UserOption[] | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [selectedUserId, setSelectedUserId] = useState<number | null | undefined>(undefined);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setError(null);
    setValue(initialValue ?? "");
    setSelectedUserId(undefined);
    setSearchText("");
    setOpen(false);
    setHighlightIndex(-1);

    // load task time fields when editing start/end
    if ((fieldKey === "start_at" || fieldKey === "end_at") && show) {
      fetch(`${apiUrl}/task/${taskId}`)
        .then((r) => (r.ok ? r.json() : Promise.reject("Falha ao carregar tarefa")))
        .then((task: Task) => {
          const start = isoToLocalParts(task.start_at ?? null);
          const end = isoToLocalParts(task.end_at ?? null);
          setStartAtDate(start.date);
          setStartAtTime(start.time);
          setEndAtDate(end.date);
          setEndAtTime(end.time);
        })
        .catch((e) => console.warn("Erro ao carregar task:", e));
    }

    // load users if editing operator
    if (fieldKey === "operator" && show) {
      (async () => {
        setLoadingUsers(true);
        try {
          const res = await fetch(`${apiUrl}/users?active=true`);
          if (!res.ok) {
            setUsers([]);
            return;
          }
          const json = await res.json();
          setUsers((json ?? []).map((u: any) => ({ id: u.id, name: u.name, bitzer_id: u.bitzer_id ?? null })));
          // if initialValue is a user object try to set selection
          if (initialValue && typeof initialValue === "object" && (initialValue as any).id) {
            setSelectedUserId((initialValue as any).id);
            const iv = initialValue as any;
            setSearchText(iv.bitzer_id ? `${iv.bitzer_id} — ${iv.name}` : iv.name);
          }
        } catch {
          setUsers([]);
        } finally {
          setLoadingUsers(false);
        }
      })();
    }

    // set value for numeric/notes fields
    if (["good_pieces", "bad_pieces", "num_benches", "num_machines", "notes"].includes(fieldKey) && show) {
      setValue(initialValue ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue, show, fieldKey, apiUrl, taskId]);

  // label: user label formatting (similar to EditOperation labelFor)
  const labelFor = useCallback((u: UserOption) => {
    const id = (u.bitzer_id ?? "").toString();
    const name = (u.name ?? "").toString();
    return `${id} — ${name}`;
  }, []);

  // sync visible input when selection changes (matches EditOperation)
  useEffect(() => {
    if (!users) return;
    if (selectedUserId === null) {
      setSearchText("");
      setHighlightIndex(-1);
      return;
    }
    const sel = users.find((m) => String(m.id) === String(selectedUserId));
    if (sel) setSearchText(labelFor(sel));
    else setSearchText("");
    setHighlightIndex(-1);
  }, [users, selectedUserId, labelFor]);

  // filtered by name and bitzer_id (matches EditOperation filtering)
  const filteredUsers = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return users ?? [];
    if (!users) return [];
    return users.filter((u) => {
      const name = (u.name ?? "").toLowerCase();
      const bid = String(u.bitzer_id ?? "").toLowerCase();
      return name.includes(q) || bid.includes(q);
    });
  }, [users, searchText]);

  // when user types, clear previous selection (matches EditOperation)
  const onInputChange = useCallback(
    (value: string) => {
      setSearchText(value);
      if (selectedUserId !== null) setSelectedUserId(null);
      setOpen(true);
      setHighlightIndex(0);
    },
    [selectedUserId]
  );

  // keyboard navigation & selection including top "Nenhuma" item (copied from EditOperation)
  const totalListCount = (filteredUsers?.length ?? 0) + 1;

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
        const sel = users?.find((m) => String(m.id) === String(selectedUserId));
        if (sel) setSearchText(labelFor(sel));
        else setSearchText("");
        setHighlightIndex(-1);
      }
    },
    [open, totalListCount, highlightIndex, filteredUsers, labelFor, selectedUserId, users]
  );

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

  // click outside handler (same logic as EditOperation)
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

        const sel = users.find((m) => String(m.id) === String(selectedUserId));
        if (!sel) {
          const exact = users.find((mm) => labelFor(mm).trim() === searchText.trim());
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
  }, [wrapperRef, selectedUserId, users, searchText, labelFor]);

  const convertPayload = (): Record<string, any> => {
    if (fieldKey === "process_type") {
      if (!VALID_PROCESS_TYPES.includes(String(value) as ProcessTypeStr)) throw new Error("Tipo de processo inválido");
      return { process_type: String(value) as ProcessTypeStr };
    }

    if (fieldKey === "operator") {
      if (selectedUserId === undefined) {
        // leave unchanged
        return {};
      }
      if (selectedUserId === null) {
        return { operator_user_id: null, operator_bitzer_id: null };
      }
      const sel = users?.find((u) => Number(u.id) === Number(selectedUserId));
      return { operator_user_id: selectedUserId, operator_bitzer_id: sel?.bitzer_id ?? null };
    }

    if (fieldKey === "start_at" || fieldKey === "end_at") {
      const payload: any = {};
      payload.start_at = startAtDate && startAtTime ? localPartsToIso(startAtDate, startAtTime) : null;
      payload.end_at = endAtDate && endAtTime ? localPartsToIso(endAtDate, endAtTime) : null;
      return payload;
    }

    if (["good_pieces", "bad_pieces", "num_benches", "num_machines"].includes(fieldKey)) {
      const num = value === "" || value === null ? null : Number(value);
      return { [fieldKey]: Number.isNaN(num) ? null : num };
    }

    if (fieldKey === "notes") {
      const txt = typeof value === "string" ? value.trim() : null;
      return { notes: txt === "" ? null : txt };
    }

    return { [fieldKey]: value ?? null };
  };

  const handleSave = async () => {
    setError(null);
    let payload;
    try {
      payload = convertPayload();
    } catch (e: any) {
      setError(e.message || "Valor inválido");
      return;
    }

    if (!window.confirm(`Confirmar alteração de "${label}"?`)) return;

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Status ${res.status}`);
      }
      const updated: Task = await res.json();
      onSaved(updated);
      onHide();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // Clear both start and end (only used for start_at/end_at editors)
  const clearDates = () => {
    setStartAtDate("");
    setStartAtTime("");
    setEndAtDate("");
    setEndAtTime("");
  };

  const renderInput = () => {
    if (fieldKey === "process_type") {
      return (
        <div className="select-wrapper">
          <Form.Select value={String(value ?? "")} onChange={(e) => setValue(e.target.value)} className="dark-select">
            <option value="">Selecione tipo</option>
            <option value="PREPARATION">Preparação de Máquina</option>
            <option value="QUALITY_CONTROL">Controlo de Qualidade</option>
            <option value="PROCESSING">Processamento</option>
          </Form.Select>
        </div>
      );
    }

    if (fieldKey === "operator") {
      return (
        <Form.Group as={Row} className="mb-3" controlId="operatorSelect">
          <Form.Label column sm={4}>
            Operador
          </Form.Label>
          <Col sm={8}>
            {loadingUsers ? (
              <div className="text-muted">Carregando utilizadores...</div>
            ) : users ? (
              <div ref={wrapperRef} className="position-relative">
                <InputGroup>
                  <Form.Control
                    ref={inputRef}
                    placeholder="Pesquisar operador (nome ou bitzer_id)"
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
                      if (!open && selectedUserId !== null && selectedUserId !== undefined) {
                        const sel = users.find((u) => String(u.id) === String(selectedUserId));
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

                    {filteredUsers.length === 0 ? (
                      <div className="list-group-item text-muted">Nenhum utilizador corresponde à pesquisa.</div>
                    ) : (
                      filteredUsers.map((u, idx) => {
                        const listIndex = idx + 1;
                        return (
                          <div
                            key={u.id}
                            className={`list-group-item list-group-item-action ${listIndex === highlightIndex ? "active" : ""}`}
                            onMouseEnter={() => setHighlightIndex(listIndex)}
                            onClick={() => onSelectUser(u)}
                            style={{
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {labelFor(u)}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted">Erro ao carregar utilizadores.</div>
            )}
          </Col>
        </Form.Group>
      );
    }

    if (["good_pieces", "bad_pieces", "num_benches", "num_machines"].includes(fieldKey)) {
      return (
        <InputGroup>
          <Button variant="outline-secondary" onClick={() => setValue((v) => (v === "" || v === null ? 0 : Math.max(0, Number(v) - 1)))}>
            −
          </Button>
          <Form.Control type="number" min={0} value={value ?? ""} onChange={(e) => setValue(e.target.value === "" ? "" : Number(e.target.value))} />
          <Button variant="outline-secondary" onClick={() => setValue((v) => (v === "" || v === null ? 1 : Number(v) + 1))}>
            +
          </Button>
        </InputGroup>
      );
    }

    if (fieldKey === "notes") {
      return <Form.Control as="textarea" rows={4} maxLength={1000} value={value ?? ""} onChange={(e) => setValue(e.target.value)} />;
    }

    return <Form.Control value={String(value ?? "")} onChange={(e) => setValue(e.target.value)} />;
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Editar — {label}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <Form.Group>{renderInput()}</Form.Group>
      </Modal.Body>
      <Modal.Footer>
        {/* left side: show clear button only when editing start/end */}
        {fieldKey === "start_at" || fieldKey === "end_at" ? (
          <div className="me-auto">
            <Button
              variant="outline-danger"
              onClick={() => {
                setError(null);
                clearDates();
              }}
            >
              Limpar datas
            </Button>
          </div>
        ) : (
          <div className="me-auto" />
        )}

        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={loading}>
          {loading ? <Spinner animation="border" size="sm" /> : "Salvar"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
