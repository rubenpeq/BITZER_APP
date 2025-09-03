import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Card, Container, Form, Alert } from "react-bootstrap";
import { useAuth } from "../auth/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const from = (loc.state as any)?.from?.pathname ?? "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "admin" && password === "admin123") {
      login({ id: 1, name: "Admin", bitzer_id: 1001, is_admin: true });
      navigate(from, { replace: true });
    } else if (username === "user" && password === "user") {
      login({ id: 1, name: "User", bitzer_id: 1002, is_admin: false });
      navigate(from, { replace: true });
    } else {
      setError("Credenciais inválidas. Tente novamente.");
    }
  };

  return (
    <Container
      className="d-flex justify-content-center align-items-center"
      style={{ minHeight: "100vh" }}
    >
      <Card style={{ width: "100%", maxWidth: "400px" }} className="shadow">
        <Card.Body>
          <Card.Title className="mb-4 text-center">Login</Card.Title>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="username">
              <Form.Label>Utilizador</Form.Label>
              <Form.Control
                type="text"
                placeholder="Insira o nome de utilizador"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="password">
              <Form.Label>Palavra-passe</Form.Label>
              <Form.Control
                type="password"
                placeholder="Insira a palavra-passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Form.Group>

            <Button type="submit" variant="primary" className="w-100">
              Entrar
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}
