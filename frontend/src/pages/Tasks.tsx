import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { Button, Spinner, Alert, Row, Col, Card, Form, InputGroup, OverlayTrigger, Tooltip } from "react-bootstrap";
import { ArrowLeft, Plus, X } from "react-bootstrap-icons";
import { type Task, formatDateTime, processTypeLabels } from "../utils/Types";
import EditTask from "../components/EditTask";

// Compute duration in seconds between start_at and end_at (or now if ongoing)
const computeDurationSeconds = (task: Task) => {
  if (!task.start_at) return 0;
  const start = new Date(task.start_at).getTime();
  const end = task.end_at ? new Date(task.end_at).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / 1000));
};

const formatDuration = (seconds: number) => {
  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = seconds % 60;
  return [hh, mm, ss].map((v) => String(v).padStart(2, "0")).join(":");
};

export default function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_FASTAPI_URL;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [showObservations, setShowObservations] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // counters / inputs always visible (moved below button)
  const [goodPieces, setGoodPieces] = useState<number | "">("");
  const [badPieces, setBadPieces] = useState<number | "">("");
  const [numBenches, setNumBenches] = useState<number | "">("");
  const [numMachines, setNumMachines] = useState<number | "">("");
  const [notes, setNotes] = useState<string>("");

  // timer
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editFieldKey, setEditFieldKey] = useState<string>("");
  const [editLabel, setEditLabel] = useState<string>("");
  const [editInitial, setEditInitial] = useState<any>(null);

  // Fetch task data
  useEffect(() => {
    if (!taskId) {
      setError("Task ID inválido");
      setLoading(false);
      return;
    }

    const fetchTask = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/task/${taskId}`);
        if (!response.ok) throw new Error(`Erro ao buscar tarefa: ${response.status}`);
        const data: Task = await response.json();
        setTask(data);

        // populate local editable fields
        setGoodPieces(data.good_pieces ?? "");
        setBadPieces(data.bad_pieces ?? "");
        setNumBenches(data.num_benches ?? "");
        setNumMachines(data.num_machines ?? "");
        setNotes(data.notes ?? "");

        // Show observations if there are existing notes
        if (data.notes) {
          setShowObservations(true);
        }

        setTimerSeconds(computeDurationSeconds(data));
      } catch (err: any) {
        setError(err.message || "Erro inesperado");
      } finally {
        setLoading(false);
      }
    };

    fetchTask();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [taskId, API_URL]);

  // Timer interval
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (task?.start_at && !task?.end_at) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [task?.start_at, task?.end_at]);

  const checkForChanges = useCallback(() => {
    if (!task) return false;

    return (
      goodPieces !== (task.good_pieces ?? "") ||
      badPieces !== (task.bad_pieces ?? "") ||
      numBenches !== (task.num_benches ?? "") ||
      numMachines !== (task.num_machines ?? "") ||
      notes !== (task.notes ?? "")
    );
  }, [task, goodPieces, badPieces, numBenches, numMachines, notes]);

  useEffect(() => {
    setHasUnsavedChanges(checkForChanges());
  }, [goodPieces, badPieces, numBenches, numMachines, notes, checkForChanges]);

  const updateTaskOnServer = useCallback(
    async (payload: Partial<Task>) => {
      if (!task) throw new Error("Tarefa não carregada");
      const response = await fetch(`${API_URL}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`(${response.status}) ${text}`);
      }
      return (await response.json()) as Task;
    },
    [task, API_URL]
  );

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleStartStop = useCallback(async () => {
    if (!task) return;
    setError(null);
    const nowIso = new Date().toISOString();

    try {
      setLoading(true);
      let updated: Task;
      if (!task.start_at) {
        updated = await updateTaskOnServer({ start_at: nowIso });
        setTimerSeconds(0);
      } else if (!task.end_at) {
        updated = await updateTaskOnServer({ end_at: nowIso });
        setTimerSeconds(computeDurationSeconds(updated));
      } else return;
      setTask(updated);
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar tarefa");
    } finally {
      setLoading(false);
    }
  }, [task, updateTaskOnServer]);

  const handleSaveAll = useCallback(async () => {
    if (!task) return;
    try {
      setLoading(true);
      const payload: Partial<Task> = {
        good_pieces: typeof goodPieces === "number" ? goodPieces : null,
        bad_pieces: typeof badPieces === "number" ? badPieces : null,
        num_benches: typeof numBenches === "number" ? numBenches : null,
        num_machines: typeof numMachines === "number" ? numMachines : null,
        notes: notes === "" ? null : notes,
      };
      const updated = await updateTaskOnServer(payload);
      setTask(updated);
      // sync local fields
      setGoodPieces(updated.good_pieces ?? "");
      setBadPieces(updated.bad_pieces ?? "");
      setNumBenches(updated.num_benches ?? "");
      setNumMachines(updated.num_machines ?? "");
      setNotes(updated.notes ?? "");
      setHasUnsavedChanges(false); // Reset unsaved changes flag
    } catch (err: any) {
      setError(err.message || "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }, [task, updateTaskOnServer, goodPieces, badPieces, numBenches, numMachines, notes]);

  const handleBackClick = useCallback(async () => {
    if (!hasUnsavedChanges) {
      navigate(-1);
      return;
    }

    const confirmLeave = window.confirm("Existem alterações não salvas. Deseja salvar antes de sair?");

    if (confirmLeave) {
      try {
        setLoading(true);
        await handleSaveAll();
        navigate(-1);
      } catch (err: any) {
        setError(err.message || "Erro ao salvar");
      } finally {
        setLoading(false);
      }
    } else {
      navigate(-1);
    }
  }, [hasUnsavedChanges, handleSaveAll, navigate]);

  const openEditModal = useCallback((fieldKey: string, label: string, initial: any) => {
    setEditFieldKey(fieldKey);
    setEditLabel(label);
    setEditInitial(initial);
    setShowEdit(true);
  }, []);

  const handleTaskSaved = useCallback((updated: Task) => {
    setTask(updated);
    setGoodPieces(updated.good_pieces ?? "");
    setBadPieces(updated.bad_pieces ?? "");
    setNumBenches(updated.num_benches ?? "");
    setNumMachines(updated.num_machines ?? "");
    setNotes(updated.notes ?? "");
    setTimerSeconds(computeDurationSeconds(updated));

    // Show observations if there are notes
    if (updated.notes) {
      setShowObservations(true);
    }
  }, []);

  // Helper functions for increment/decrement
  const increment = useCallback((setter: React.Dispatch<React.SetStateAction<number | "">>, step = 1) => {
    setter((prev) => (prev === "" ? step : Math.max(0, Number(prev) + step)));
  }, []);

  const decrement = useCallback((setter: React.Dispatch<React.SetStateAction<number | "">>, step = 1) => {
    setter((prev) => (prev === "" ? 0 : Math.max(0, Number(prev) - step)));
  }, []);

  const toggleObservations = useCallback(() => {
    if (showObservations && notes === "") {
      setShowObservations(false);
    } else if (!showObservations) {
      setShowObservations(true);
    }
  }, [showObservations, notes]);

  if (loading) {
    return (
      <div className="loading-container">
        <Spinner animation="border" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" dismissible onClose={() => setError(null)}>
        {error}
      </Alert>
    );
  }

  if (!task) {
    return <Alert variant="danger">Tarefa não encontrada</Alert>;
  }

  const processedLabel = processTypeLabels[task.process_type] ?? task.process_type ?? "-";

  let btnVariant: "success" | "danger" | "secondary" = "success";
  let btnLabel = "Iniciar";
  if (!task.start_at) {
    btnVariant = "success";
    btnLabel = "Iniciar";
  } else if (task.start_at && !task.end_at) {
    btnVariant = "danger";
    btnLabel = "Parar";
  } else {
    btnVariant = "secondary";
    btnLabel = "Concluído";
  }

  return (
    <div className="order-container">
      <Button variant="light" className="mb-3 d-flex align-items-center" onClick={handleBackClick}>
        <ArrowLeft className="me-2" /> Voltar
      </Button>

      <Row className="mb-4 text-center justify-content-center gx-3">
        {[
          { key: "process_type", label: "Tipo de Processo", value: processedLabel },
          { key: "start_at", label: "Início", value: formatDateTime(task.start_at) },
          { key: "end_at", label: "Fim", value: formatDateTime(task.end_at) },
          { key: "operator", label: "Operador", value: task.operator_user?.name ?? "Sem Operador" },
        ].map(({ key, label, value }, idx) => (
          <Col key={idx} xs={12} sm={4} md={2}>
            <Card className="order-card p-3" onClick={() => openEditModal(String(key), label === "Fim" || label === "Início" ? "Data/Tempo" : label, value === "" ? "" : value)}>
              <Card.Title className="order-card-title">{label}</Card.Title>
              <Card.Text className="order-card-value">{value}</Card.Text>
            </Card>
          </Col>
        ))}
      </Row>

      <EditTask show={showEdit} onHide={() => setShowEdit(false)} apiUrl={API_URL} taskId={task.id} fieldKey={editFieldKey} label={editLabel} initialValue={editInitial} onSaved={handleTaskSaved} />

      <div className="text-center task-action-button-container">
        <Button variant={btnVariant} size="lg" className="task-action-button" onClick={handleStartStop} disabled={loading || (Boolean(task.start_at) && Boolean(task.end_at))}>
          {btnLabel}
          <br />
          {formatDuration(timerSeconds)}
        </Button>
      </div>

      <Form
        onSubmit={(e) => {
          e.preventDefault();
          handleSaveAll();
        }}
      >
        <Row className="align-items-start justify-content-center">
          {/* Left Column - Number Inputs */}
          <Col md={showObservations ? 7 : 10} className={showObservations ? "border-end pe-4" : ""}>
            <Row className="justify-content-center mb-4">
              <Col md={5} className="text-center">
                <Form.Label className="d-block mb-2">Peças Boas</Form.Label>
                <InputGroup className="justify-content-center">
                  <Button variant="outline-secondary" onClick={() => decrement(setGoodPieces)}>
                    -
                  </Button>
                  <Form.Control
                    type="number"
                    min={0}
                    value={goodPieces}
                    onChange={(e) => setGoodPieces(e.target.value === "" ? "" : Number(e.target.value))}
                    className="no-spinners text-center"
                    style={{ maxWidth: "80px" }}
                  />
                  <Button variant="outline-secondary" onClick={() => increment(setGoodPieces)}>
                    +
                  </Button>
                </InputGroup>
              </Col>

              <Col md={5} className="text-center">
                <Form.Label className="d-block mb-2">Bancadas</Form.Label>
                <InputGroup className="justify-content-center">
                  <Button variant="outline-secondary" onClick={() => decrement(setNumBenches)}>
                    -
                  </Button>
                  <Form.Control
                    type="number"
                    min={0}
                    value={numBenches}
                    onChange={(e) => setNumBenches(e.target.value === "" ? "" : Number(e.target.value))}
                    className="no-spinners text-center"
                    style={{ maxWidth: "80px" }}
                  />
                  <Button variant="outline-secondary" onClick={() => increment(setNumBenches)}>
                    +
                  </Button>
                </InputGroup>
              </Col>
            </Row>

            <Row className="justify-content-center mb-4">
              <Col md={5} className="text-center">
                <Form.Label className="d-block mb-2">Peças Defeituosas</Form.Label>
                <InputGroup className="justify-content-center">
                  <Button variant="outline-secondary" onClick={() => decrement(setBadPieces)}>
                    -
                  </Button>
                  <Form.Control
                    type="number"
                    min={0}
                    value={badPieces}
                    onChange={(e) => setBadPieces(e.target.value === "" ? "" : Number(e.target.value))}
                    className="no-spinners text-center"
                    style={{ maxWidth: "80px" }}
                  />
                  <Button variant="outline-secondary" onClick={() => increment(setBadPieces)}>
                    +
                  </Button>
                </InputGroup>
              </Col>

              <Col md={5} className="text-center">
                <Form.Label className="d-block mb-2">Máquinas</Form.Label>
                <InputGroup className="justify-content-center">
                  <Button variant="outline-secondary" onClick={() => decrement(setNumMachines)}>
                    -
                  </Button>
                  <Form.Control
                    type="number"
                    min={0}
                    value={numMachines}
                    onChange={(e) => setNumMachines(e.target.value === "" ? "" : Number(e.target.value))}
                    className="no-spinners text-center"
                    style={{ maxWidth: "80px" }}
                  />
                  <Button variant="outline-secondary" onClick={() => increment(setNumMachines)}>
                    +
                  </Button>
                </InputGroup>
              </Col>
            </Row>

            {/* Add Observations Button */}
            {!showObservations && (
              <Row className="justify-content-center mb-4">
                <Col className="text-center">
                  <Button variant="outline-info" onClick={toggleObservations} className="d-flex align-items-center justify-content-center mx-auto" style={{ width: "auto" }}>
                    <Plus className="me-2" /> Adicionar Observações
                  </Button>
                </Col>
              </Row>
            )}
          </Col>

          {/* Right Column - Observations */}
          {showObservations && (
            <Col md={4} className="ps-4 position-relative">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <Form.Label className="mb-0">Observações</Form.Label>
                <OverlayTrigger placement="top" overlay={<Tooltip>{notes !== "" ? "Remova as observações para fechar" : "Fechar"}</Tooltip>}>
                  <span className="d-inline-block">
                    <Button variant="outline-secondary" size="sm" onClick={toggleObservations} disabled={notes !== ""} className="py-0 px-1" style={notes !== "" ? { pointerEvents: "none" } : {}}>
                      <X size={16} />
                    </Button>
                  </span>
                </OverlayTrigger>
              </div>

              <Form.Control
                as="textarea"
                rows={5}
                maxLength={1000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas do operador (máx. 1000 caracteres)"
                className="white-placeholder"
              />
            </Col>
          )}
        </Row>

        {/* Save Button - Centered below the form */}
        <Row className="mt-2">
          <Col className="text-center">
            <Button type="submit" variant="success" size="lg" disabled={loading} className="create-button px-5">
              {loading ? <Spinner animation="border" size="sm" /> : "Salvar Alterações"}
            </Button>
          </Col>
        </Row>
      </Form>
    </div>
  );
}
