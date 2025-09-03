import { Container, Row, Col, Card, Button, ListGroup } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import SystemStatus from "../../components/SystemStatus";

export default function Admin() {
  const navigate = useNavigate();

  return (
    <Container fluid className="py-4">
      <Row className="mb-3 align-items-center">
        <Col>
          <h2 className="admin-title">Painel de Administração</h2>
          <div className="admin-subtitle">Visão geral e acesso rápido às ferramentas administrativas</div>
        </Col>
        <Col xs="auto" className="admin-top-buttons">
          <Button variant="outline-light" className="me-2" onClick={() => navigate("/admin/users/new")}>
            Novo Utilizador
          </Button>
          <Button variant="light" onClick={() => navigate("/admin/machines/new")}>
            Nova Máquina
          </Button>
        </Col>
      </Row>

      <Row className="g-3">
        {/* Left column (hidden on small screens) */}
        <Col lg={3} className="d-none d-lg-block">
          <Card className="mb-3 admin-card" bg="dark" text="light">
            <Card.Body>
              <Card.Title className="admin-card-title">Estatísticas Rápidas</Card.Title>
              <ListGroup variant="flush" className="mt-2">
                <ListGroup.Item className="admin-list-item admin-note-text">
                  <div className="d-flex justify-content-between align-items-center">
                    <small>Máquinas</small>
                    <strong>—</strong>
                  </div>
                </ListGroup.Item>
                <ListGroup.Item className="admin-list-item admin-note-text">
                  <div className="d-flex justify-content-between align-items-center">
                    <small>Utilizadores Ativos</small>
                    <strong>—</strong>
                  </div>
                </ListGroup.Item>
                <ListGroup.Item className="admin-list-item admin-note-text">
                  <div className="d-flex justify-content-between align-items-center">
                    <small>Ordens Abertas</small>
                    <strong>—</strong>
                  </div>
                </ListGroup.Item>
              </ListGroup>
            </Card.Body>
          </Card>

          <Card className="admin-card" bg="dark" text="light">
            <Card.Body>
              <Card.Title className="admin-card-title">Ações Rápidas</Card.Title>
              <div className="d-grid gap-2 mt-2">
                <Button variant="outline-light" onClick={() => navigate("/admin/orders")}>
                  Ordens e Operações
                </Button>
                <Button variant="outline-light" onClick={() => navigate("/admin/machines")}>
                  Gerir Máquinas
                </Button>
                <Button variant="outline-light" onClick={() => navigate("/admin/users")}>
                  Gerir Utilizadores
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Main column */}
        <Col lg={6}>
          <Card className="admin-card admin-main-card" bg="dark" text="light">
            <Card.Body>
              <Card.Title className="admin-card-title">Gráficos Principais</Card.Title>

              <div className="mt-3 admin-graph-placeholder">
                <div className="admin-graph-content">
                  <div className="admin-graph-title">Análises</div>
                  <div className="admin-graph-desc">Espaço reservado para gráficos (produção vs defeitos, utilizadores ativos, throughput).</div>
                </div>
              </div>
            </Card.Body>
          </Card>

          <Card className="mt-3 admin-card" bg="dark" text="light">
            <Card.Body>
              <Row>
                <Col>
                  <Card.Title className="admin-card-title">Ordens Recentes</Card.Title>
                  <div className="mt-2 admin-placeholder-text">Sem ordens recentes para mostrar (espaço reservado).</div>
                </Col>
                <Col xs="auto" className="align-self-center">
                  <Button variant="outline-light" onClick={() => navigate("/admin/orders")}>
                    Ir para Ordens
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>

        {/* Right column */}
        <Col lg={3} className="d-none d-lg-block">
          <Card className="admin-card" bg="dark" text="light">
            <Card.Body>
              <Card.Title className="admin-card-title">Espaço Vazio</Card.Title>
              <ListGroup variant="flush" className="mt-2">
                <ListGroup.Item className="admin-list-item admin-note-text">
                  <div>
                    <strong>2025-09-01</strong> — Dado 1
                  </div>
                </ListGroup.Item>
                <ListGroup.Item className="admin-list-item admin-note-text">
                  <div>
                    <strong>2025-09-03</strong> — Dado 2
                  </div>
                </ListGroup.Item>
              </ListGroup>
            </Card.Body>
          </Card>

          <SystemStatus />
        </Col>
      </Row>

      <Row className="mt-4">
        <Col>
          <Card className="admin-card" bg="dark" text="light">
            <Card.Body>
              <Card.Title className="admin-card-title">Notas</Card.Title>
              <div className="mt-2 admin-note-text">Use esta área para notas administrativas ou links para páginas operacionais.</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
