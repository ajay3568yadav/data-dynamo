import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import Project from "./components/Project";

function App() {
  return (
    <Router>
      <div style={{ margin: "20px" }}>
        <nav>
          <Link to="/login">Login</Link> | <Link to="/register">Register</Link>
        </nav>

        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/project/:projectId" element={<Project />} />
          <Route path="/" element={<h2>Home Page</h2>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
