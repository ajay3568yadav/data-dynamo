import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("http://localhost:8000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (response.ok) {
        // Optionally store the user_id
        localStorage.setItem("user_id", data.user_id);
        // Automatically navigate to /dashboard on successful registration
        navigate("/dashboard");
      } else {
        setMessage(data.detail || "Registration failed");
      }
    } catch (error) {
      setMessage("Error: " + error.message);
    }
  };

  return (
    <div style={{ margin: "50px" }}>
      <h2>Register</h2>
      <form onSubmit={handleRegister}>
        <div>
          <label>Username: </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div style={{ marginTop: "10px" }}>
          <label>Password: </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" style={{ marginTop: "10px" }}>
          Register
        </button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}

export default Register;
