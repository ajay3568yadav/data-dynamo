import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const [userId, setUserId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Load user_id from localStorage on mount
  useEffect(() => {
    const storedUserId = localStorage.getItem("user_id");
    setUserId(storedUserId);
  }, []);

  // Fetch projects for the logged-in user when userId changes
  useEffect(() => {
    if (userId) {
      fetch(`http://localhost:8000/projects?user_id=${userId}`)
        .then((response) => response.json())
        .then((data) => {
          if (data.projects) {
            setProjects(data.projects);
          }
        })
        .catch((err) => console.error("Error fetching projects:", err));
    }
  }, [userId]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setError("");
    if (!projectName) {
      setError("Project name is required");
      return;
    }
    if (!userId) {
      setError("User is not logged in.");
      return;
    }

    try {
      const response = await fetch("http://localhost:8000/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_name: projectName, user_id: userId }),
      });
      const data = await response.json();
      if (response.ok) {
        // Optionally update the projects list
        setProjects([...projects, data]);
        // Navigate to the project's page
        navigate(`/project/${data.project_id}`);
      } else {
        const errMsg =
          typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
        setError(errMsg || "Failed to create project");
      }
    } catch (err) {
      setError("Error: " + err.message);
    }
  };

  return (
    <div style={{ margin: "50px" }}>
      <h2>Dashboard</h2>
      <p>Welcome, user {userId}!</p>

      {/* Display list of projects */}
      <div style={{ marginTop: "20px" }}>
        <h3>Your Projects</h3>
        {projects.length > 0 ? (
          <ul>
            {projects.map((proj) => (
              <li key={proj.project_id}>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "blue",
                    textDecoration: "underline",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: "1em",
                  }}
                  onClick={() => navigate(`/project/${proj.project_id}`)}
                >
                  {proj.project_name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No projects found.</p>
        )}
      </div>

      <button onClick={() => setShowModal(true)} style={{ marginTop: "20px" }}>
        Create New Project
      </button>

      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "5px",
              width: "300px",
            }}
          >
            <h3>Create New Project</h3>
            <form onSubmit={handleCreateProject}>
              <div>
                <label>Project Name:</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  required
                />
              </div>
              {error && <p style={{ color: "red" }}>{error}</p>}
              <div style={{ marginTop: "10px" }}>
                <button type="submit">Submit</button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ marginLeft: "10px" }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
