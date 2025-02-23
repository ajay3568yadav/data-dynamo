import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ReactFlow, {
  ReactFlowProvider,
  Controls,
  MiniMap,
  Background,
} from 'reactflow';
import 'reactflow/dist/style.css';

function Project() {
  const { projectId } = useParams();

  // Modal & Form States
  const [showDatasetModal, setShowDatasetModal] = useState(false);
  const [showPipelineModal, setShowPipelineModal] = useState(false);
  const [datasetName, setDatasetName] = useState("");
  const [datasetFile, setDatasetFile] = useState(null);
  const [pipelinePrompt, setPipelinePrompt] = useState("");
  const [error, setError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");

  // State for Data Profiles
  const [dataProfiles, setDataProfiles] = useState([]);

  // Fetch DataProfile objects for the given project using the new API endpoint
  useEffect(() => {
    fetch(`http://localhost:8000/data_profiles/${projectId}`)
      .then((response) => response.json())
      .then((data) => {
        // Check if the API response includes the data_profiles key
        if (data.data_profiles && Array.isArray(data.data_profiles)) {
          setDataProfiles(data.data_profiles);
        } else {
          console.error("Unexpected response format:", data);
          setDataProfiles([]);
        }
      })
      .catch((err) => {
        console.error("Error fetching data profiles:", err);
      });
  }, [projectId]);

  // Handle dataset upload
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
      } else {
        setError(`Upload failed: ${data.detail}`);
      }
    } catch (err) {
      setError("Error: " + err.message);
    }
  };

  // Handle pipeline creation
  const handleCreatePipeline = async (e) => {
    e.preventDefault();
    if (!pipelinePrompt.trim()) {
      setError("Please provide a pipeline prompt");
      return;
    }
    
    setPipelinePrompt("");
    setShowPipelineModal(false);
  };

  return (
    <div style={{ margin: "50px" }}>
      <h2>Project: {projectId}</h2>

      <button onClick={() => setShowDatasetModal(true)}>Upload Dataset</button>

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
                  <a href={profile.file_path} target="_blank" rel="noopener noreferrer">View File</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Dataset Upload Modal */}
      {showDatasetModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Upload Dataset</h3>
            <form onSubmit={handleCreateDataset}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Dataset Name:</label>
                <input
                  type="text"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  style={{ width: '100%', padding: '5px' }}
                  required
                />
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Select File:</label>
                <input
                  type="file"
                  onChange={(e) => setDatasetFile(e.target.files[0])}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowDatasetModal(false)}>Cancel</button>
                <button type="submit">Upload</button>
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
        input, textarea {
          border: 1px solid #ced4da;
          border-radius: 4px;
        }
        input:focus, textarea:focus {
          outline: none;
          border-color: #80bdff;
          box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
        }
      `}</style>
    </div>
  );
}

export default Project;
