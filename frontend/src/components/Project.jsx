import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ReactFlow, {
  ReactFlowProvider,
  Controls,
  MiniMap,
  Background,
  applyNodeChanges,
} from 'reactflow';
import 'reactflow/dist/style.css';

function Project() {
  const { projectId } = useParams();

  const [showDatasetModal, setShowDatasetModal] = useState(false);
  const [showPipelineModal, setShowPipelineModal] = useState(false);
  const [datasetName, setDatasetName] = useState("");
  const [datasetFile, setDatasetFile] = useState(null);
  const [pipelinePrompt, setPipelinePrompt] = useState("");
  const [error, setError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");

  const [dataProfiles, setDataProfiles] = useState([]);

  const [reactNodes, setReactNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  useEffect(() => {
    fetch(`http://localhost:8000/data_profiles/${projectId}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.data_profiles && Array.isArray(data.data_profiles)) {
          setDataProfiles(data.data_profiles);
        } else {
          console.error("Unexpected data profiles response:", data);
          setDataProfiles([]);
        }
      })
      .catch((err) => console.error("Error fetching data profiles:", err));
  }, [projectId]);

  useEffect(() => {
    fetch(`http://localhost:8000/nodes/${projectId}`)
      .then((response) => response.json())
      .then((data) => {
        let nodes = [];

        data.data_nodes.forEach((node) => {
          nodes.push({
            id: node.id,
            type: 'default',
            position: { x: node.x, y: node.y },
            data: { label: `${node.id} (data)`, nodeType: 'data' },
          });
        });
        // Process PipelineNodes
        data.pipeline_nodes.forEach((node) => {
          nodes.push({
            id: node.id,
            type: 'default',
            position: { x: node.x, y: node.y },
            data: { label: `${node.id} (pipeline)`, nodeType: 'pipeline' },
          });
        });
        setReactNodes(nodes);

        // Compute edges from connection lists
        let computedEdges = [];
        data.data_nodes.forEach((node) => {
          if (node.connected_nodes && node.connected_nodes.length > 0) {
            node.connected_nodes.forEach((targetId) => {
              computedEdges.push({
                id: `edge-${node.id}-${targetId}`,
                source: node.id,
                target: targetId,
                animated: true,
              });
            });
          }
        });
        data.pipeline_nodes.forEach((node) => {
          if (node.output_nodes && node.output_nodes.length > 0) {
            node.output_nodes.forEach((targetId) => {
              computedEdges.push({
                id: `edge-${node.id}-${targetId}`,
                source: node.id,
                target: targetId,
                animated: true,
              });
            });
          }
        });
        setEdges(computedEdges);
      })
      .catch((err) => console.error("Error fetching graph nodes:", err));
  }, [projectId]);

  // Update node positions in real time as they are dragged
  const onNodesChange = (changes) => {
    setReactNodes((nds) => applyNodeChanges(changes, nds));
  };

  // When node dragging stops, send the new position to the backend
  const onNodeDragStop = (event, node) => {
    const payload = { x: node.position.x, y: node.position.y };
    let endpoint = "";
    if (node.data.nodeType === "data") {
      endpoint = `http://localhost:8000/update_data_node/${node.id}`;
    } else if (node.data.nodeType === "pipeline") {
      endpoint = `http://localhost:8000/update_pipeline_node/${node.id}`;
    }
    fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("Node updated", data);
      })
      .catch((error) => console.error("Error updating node", error));
  };

  // onConnect callback fires when a connection is attempted between nodes
  const onConnect = (params) => {
    // Get the source and target node objects from the current reactNodes state
    const sourceNode = reactNodes.find((n) => n.id === params.source);
    const targetNode = reactNodes.find((n) => n.id === params.target);

    // Check if both nodes are DataNodes; if so, immediately reject the connection
    if (
      sourceNode &&
      targetNode &&
      sourceNode.data.nodeType === "data" &&
      targetNode.data.nodeType === "data"
    ) {
      console.error("Invalid connection: cannot connect two DataNodes");
      return; // Do not proceed with the connection
    }

    // Otherwise, proceed to create the connection in the backend
    fetch(`http://localhost:8000/connect_nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_id: params.source,
        target_id: params.target,
        project_id: projectId,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("Nodes connected", data);
        // Update local edges state to reflect the new connection
        setEdges((eds) => [
          ...eds,
          {
            id: `edge-${params.source}-${params.target}`,
            source: params.source,
            target: params.target,
            animated: true,
          },
        ]);
      })
      .catch((error) => console.error("Error connecting nodes", error));
  };

  // Callback to delete nodes from the canvas and backend
  const onNodesDelete = (deletedNodes) => {
    deletedNodes.forEach((node) => {
      fetch(`http://localhost:8000/delete_node/${node.id}?project_id=${projectId}`, {
        method: "DELETE",
      })
        .then((response) => response.json())
        .then((data) => console.log("Node deleted", data))
        .catch((error) => console.error("Error deleting node", error));
    });
    setReactNodes((prev) => prev.filter((n) => !deletedNodes.find((d) => d.id === n.id)));
  };

  // Callback to delete edges from the canvas and backend
  const onEdgesDelete = (deletedEdges) => {
    deletedEdges.forEach((edge) => {
      const payload = { source_id: edge.source, target_id: edge.target, project_id: projectId };
      fetch(`http://localhost:8000/delete_edge`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((response) => response.json())
        .then((data) => console.log("Edge deleted", data))
        .catch((error) => console.error("Error deleting edge", error));
    });
    setEdges((prev) => prev.filter((e) => !deletedEdges.find((d) => d.id === e.id)));
  };

  // Handle dataset upload (creates a DataProfile and corresponding DataNode)
  const handleCreateDataset = async (e) => {
    e.preventDefault();
    setError("");
    setUploadStatus("");

    if (!datasetFile || !datasetName) {
      setError("Please provide a dataset name and select a file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", datasetFile);
    formData.append("profile_name", datasetName);

    try {
      const response = await fetch(`http://localhost:8000/upload_dataset/${projectId}`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (response.ok) {
        setUploadStatus(`Upload successful! File URL: ${data.file_url}`);
        setShowDatasetModal(false);
        setDatasetName("");
        setDatasetFile(null);
        // Immediately add the new DataNode to the reactNodes state
        const newNode = {
          id: data.dataset_id,
          type: 'default',
          position: { x: 100, y: 100 }, // Default starting position; adjust as needed
          data: { label: `${data.dataset_id} (data)`, nodeType: 'data' },
        };
        setReactNodes((prevNodes) => [...prevNodes, newNode]);
      } else {
        setError(`Upload failed: ${data.detail}`);
      }
    } catch (err) {
      setError("Error: " + err.message);
    }
  };

  // Handle pipeline creation (creates a PipelineStage and corresponding PipelineNode)
  const handleCreatePipeline = async (e) => {
    e.preventDefault();
    if (!pipelinePrompt.trim()) {
      setError("Please provide a pipeline prompt");
      return;
    }
    
    try {
      const response = await fetch(`http://localhost:8000/pipeline_stage/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_name: "New Stage", user_prompt: pipelinePrompt }),
      });
      const data = await response.json();

      if (response.ok) {
        setUploadStatus("Pipeline stage created successfully");
        setShowPipelineModal(false);
        setPipelinePrompt("");
        const newNode = {
          id: data.stage_id,
          type: 'default',
          position: { x: 200, y: 200 },
          data: { label: `${data.stage_id} (pipeline)`, nodeType: 'pipeline' },
        };
        setReactNodes((prevNodes) => [...prevNodes, newNode]);
      } else {
        setError(`Pipeline stage creation failed: ${data.detail}`);
      }
    } catch (err) {
      setError("Error: " + err.message);
    }
  };

  return (
    <div style={{ margin: "50px" }}>
      <h2>Project: {projectId}</h2>
      <button onClick={() => setShowDatasetModal(true)}>Upload Dataset</button>
      <button onClick={() => setShowPipelineModal(true)} style={{ marginLeft: "10px" }}>
        Create Pipeline Stage
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {uploadStatus && <p style={{ color: "green" }}>{uploadStatus}</p>}

      {/* Data Profiles Section */}
      <h3>Data Profiles</h3>
      {dataProfiles.length === 0 ? (
        <p>No Data Profiles found for this project.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #ddd", padding: "8px" }}>ID</th>
              <th style={{ border: "1px solid #ddd", padding: "8px" }}>Profile Name</th>
              <th style={{ border: "1px solid #ddd", padding: "8px" }}>Dataset Name</th>
              <th style={{ border: "1px solid #ddd", padding: "8px" }}>Type</th>
              <th style={{ border: "1px solid #ddd", padding: "8px" }}>S3 Bucket Link</th>
            </tr>
          </thead>
          <tbody>
            {dataProfiles.map((profile) => (
              <tr key={profile.profile_id}>
                <td style={{ border: "1px solid #ddd", padding: "8px" }}>{profile.profile_id}</td>
                <td style={{ border: "1px solid #ddd", padding: "8px" }}>{profile.profile_name}</td>
                <td style={{ border: "1px solid #ddd", padding: "8px" }}>{profile.dataset_name}</td>
                <td style={{ border: "1px solid #ddd", padding: "8px" }}>{profile.dataset_type}</td>
                <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                  <a href={profile.file_path} target="_blank" rel="noopener noreferrer">
                    View File
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* React Flow Canvas */}
      <div style={{ width: "100%", height: "600px", border: "1px solid #ddd", marginTop: "30px" }}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={reactNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            nodesDraggable={true}
            panOnDrag={false}
          >
            <Controls />
            <MiniMap />
            <Background />
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      {/* Dataset Upload Modal */}
      {showDatasetModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Upload Dataset</h3>
            <form onSubmit={handleCreateDataset}>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px" }}>Dataset Name:</label>
                <input
                  type="text"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  style={{ width: "100%", padding: "5px" }}
                  required
                />
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px" }}>Select File:</label>
                <input
                  type="file"
                  onChange={(e) => setDatasetFile(e.target.files[0])}
                  required
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" onClick={() => setShowDatasetModal(false)}>
                  Cancel
                </button>
                <button type="submit">Upload</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pipeline Creation Modal */}
      {showPipelineModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Create Pipeline Stage</h3>
            <form onSubmit={handleCreatePipeline}>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px" }}>Pipeline Prompt:</label>
                <textarea
                  value={pipelinePrompt}
                  onChange={(e) => setPipelinePrompt(e.target.value)}
                  style={{ width: "100%", padding: "5px", minHeight: "100px" }}
                  required
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" onClick={() => setShowPipelineModal(false)}>
                  Cancel
                </button>
                <button type="submit">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Styles */}
      <style jsx>{`
        .modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        .modal-content {
          background-color: white;
          padding: 20px;
          border-radius: 8px;
          width: 90%;
          max-width: 500px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        button {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          background-color: #007bff;
          color: white;
        }
        button:hover {
          background-color: #0056b3;
        }
        button[type="button"] {
          background-color: #6c757d;
        }
        button[type="button"]:hover {
          background-color: #545b62;
        }
        input,
        textarea {
          border: 1px solid #ced4da;
          border-radius: 4px;
        }
        input:focus,
        textarea:focus {
          outline: none;
          border-color: #80bdff;
          box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
        }
      `}</style>
    </div>
  );
}

export default Project;
