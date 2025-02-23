from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
import os
import uuid
import boto3
import logging
from passlib.hash import bcrypt

from models import (
    User, Project, DataProfile, TextProfile, ImageProfile, AudioProfile, 
    VideoProfile, CSVProfile, DataNode, PipelineStage, PipelineNode, init_db
)
from database import SessionLocal


# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# AWS S3 Configuration
AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
S3_BUCKET_NAME = "data-dynamo-datasets"
S3_REGION = "us-east-2"

# Initialize S3 client
s3_client = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY,
    aws_secret_access_key=AWS_SECRET_KEY,
    region_name=S3_REGION,
)

# Allow requests from your frontend
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.on_event("startup")
def on_startup():
    init_db()

# User Management
class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

@app.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.username == user.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already taken.")
    hashed_pw = bcrypt.hash(user.password)
    new_user = User(username=user.username, password=hashed_pw)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully", "user_id": new_user.id}

@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if not db_user or not bcrypt.verify(user.password, db_user.password):
        raise HTTPException(status_code=400, detail="Invalid username or password")
    return {"message": "Login successful", "user_id": db_user.id}

# Project Management
class ProjectCreate(BaseModel):
    project_name: str
    user_id: str

@app.post("/projects")
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    new_project = Project(project_name=project.project_name, user_id=project.user_id)
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return {"project_id": new_project.project_id, "project_name": new_project.project_name}

@app.get("/projects")
def get_projects(user_id: str, db: Session = Depends(get_db)):
    projects = db.query(Project).filter(Project.user_id == user_id).all()
    return {"projects": [
        {"project_id": proj.project_id, "project_name": proj.project_name, "user_id": proj.user_id, "created_at": proj.created_at}
        for proj in projects
    ]}

# Dataset Upload and Profiling
def detect_data_type(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    extension_map = {
        ".csv": "CSV",
        ".txt": "text",
        ".pdf": "pdf",
        ".doc": "document",
        ".docx": "document",
        ".mp3": "audio",
        ".wav": "audio",
        ".mp4": "video",
        ".jpg": "image",
        ".jpeg": "image",
        ".png": "image",
        ".zip": "folder",
    }
    return extension_map.get(ext, "Unknown")

@app.post("/upload_dataset/{project_id}")
async def upload_dataset(
    project_id: str,
    file: UploadFile = File(...),
    profile_name: str = Form(...),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    dataset_id = str(uuid.uuid4())
    s3_path = f"projects/{project_id}/dataset/{dataset_id}/{file.filename}"

    try:
        file.file.seek(0, os.SEEK_END)
        file_size = file.file.tell()
        file.file.seek(0)

        s3_client.upload_fileobj(file.file, S3_BUCKET_NAME, s3_path)
        file_url = f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com/{s3_path}"

        data_type_str = detect_data_type(file.filename)
        # Create DataProfile
        new_profile = DataProfile(
            dataset_name=file.filename,
            profile_name=profile_name,
            dataset_type=data_type_str,
            file_path=file_url,
            file_size=file_size,
            record_count="0",
            project_id=project_id,
        )
        db.add(new_profile)
        db.commit()
        db.refresh(new_profile)

        # Create corresponding DataNode with default x,y values
        new_data_node = DataNode(
            x=100.0,
            y=100.0,
            project_id=project_id,
            data_profile_id=new_profile.profile_id,
            connected_nodes=[]
        )
        db.add(new_data_node)
        db.commit()

        return {
            "message": "File uploaded and profiled successfully",
            "dataset_id": new_profile.profile_id,
            "file_url": file_url,
            "detected_data_type": data_type_str
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

# Pipeline Stage Creation
class PipelineStageCreate(BaseModel):
    stage_name: str
    user_prompt: str

@app.post("/pipeline_stage/{project_id}")
async def create_pipeline_stage(
    project_id: str,
    pipeline: PipelineStageCreate,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:

        new_stage = PipelineStage(
            project_id=project_id,
            stage_name=pipeline.stage_name,
            stage_type="user_defined",
            user_prompt=pipeline.user_prompt,
            script="# Generated script will go here",
            script_language="python",
            docker_image="default-executor"
        )
        db.add(new_stage)
        db.commit()
        db.refresh(new_stage)  

        # Create the PipelineNode that references the pipeline stage
        new_pipeline_node = PipelineNode(
            x=200.0,
            y=200.0,
            project_id=project_id,
            pipeline_stage_id=new_stage.id,  # Link to the "PIP" ID
            input_nodes=[],
            output_nodes=[]
        )
        db.add(new_pipeline_node)
        db.commit()
        db.refresh(new_pipeline_node)

        return {
            "message": "Pipeline stage created successfully",
            # Return the new_stage.id, which is "PIP0001" style
            "stage_id": new_stage.id,
            "stage_name": new_stage.stage_name
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create pipeline stage: {str(e)}")


# New Endpoint: Get Graph Nodes for a Project
@app.get("/nodes/{project_id}")
def get_nodes(project_id: str, db: Session = Depends(get_db)):
    data_nodes = db.query(DataNode).filter(DataNode.project_id == project_id).all()
    pipeline_nodes = db.query(PipelineNode).filter(PipelineNode.project_id == project_id).all()
    return {
        "data_nodes": [{
            "id": dn.id,
            "x": dn.x,
            "y": dn.y,
            "data_profile_id": dn.data_profile_id,
            "connected_nodes": dn.connected_nodes,
        } for dn in data_nodes],
        "pipeline_nodes": [{
            "id": pn.id,
            "x": pn.x,
            "y": pn.y,
            "pipeline_stage_id": str(pn.pipeline_stage_id),
            "input_nodes": pn.input_nodes,
            "output_nodes": pn.output_nodes,
        } for pn in pipeline_nodes]
    }

class NodePositionUpdate(BaseModel):
    x: float
    y: float

@app.put("/update_data_node/{node_id}")
def update_data_node(node_id: str, update: NodePositionUpdate, db: Session = Depends(get_db)):
    node = db.query(DataNode).filter(DataNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Data node not found")
    node.x = update.x
    node.y = update.y
    db.commit()
    db.refresh(node)
    return {"message": "Data node updated", "node": {"id": node.id, "x": node.x, "y": node.y}}

@app.put("/update_pipeline_node/{node_id}")
def update_pipeline_node(node_id: str, update: NodePositionUpdate, db: Session = Depends(get_db)):
    node = db.query(PipelineNode).filter(PipelineNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Pipeline node not found")
    node.x = update.x
    node.y = update.y
    db.commit()
    db.refresh(node)
    return {"message": "Pipeline node updated", "node": {"id": node.id, "x": node.x, "y": node.y}}

class ConnectNodes(BaseModel):
    source_id: str
    target_id: str
    project_id: str

@app.post("/connect_nodes")
def connect_nodes(connection: ConnectNodes, db: Session = Depends(get_db)):
    source_id = connection.source_id
    target_id = connection.target_id
    project_id = connection.project_id

    # Determine source node type by ID prefix:
    if source_id.startswith("DAT"):
        source_node = db.query(DataNode).filter(DataNode.id == source_id, DataNode.project_id == project_id).first()
        if not source_node:
            raise HTTPException(status_code=404, detail="Source DataNode not found")
        # DataNode only has outgoing edges, stored in 'connected_nodes'
        connected = source_node.connected_nodes or []
        if target_id not in connected:
            connected.append(target_id)
            source_node.connected_nodes = connected
    elif source_id.startswith("PIP"):
        source_node = db.query(PipelineNode).filter(PipelineNode.id == source_id, PipelineNode.project_id == project_id).first()
        if not source_node:
            raise HTTPException(status_code=404, detail="Source PipelineNode not found")
        # PipelineNode stores its outgoing connections in 'output_nodes'
        output_nodes = source_node.output_nodes or []
        if target_id not in output_nodes:
            output_nodes.append(target_id)
            source_node.output_nodes = output_nodes
    else:
        raise HTTPException(status_code=400, detail="Invalid source node id")

    # The target is expected to be a PipelineNode.
    target_node = db.query(PipelineNode).filter(PipelineNode.id == target_id, PipelineNode.project_id == project_id).first()
    if not target_node:
        raise HTTPException(status_code=404, detail="Target PipelineNode not found")
    # Update the target's incoming edges in 'input_nodes'
    input_nodes = target_node.input_nodes or []
    if source_id not in input_nodes:
        input_nodes.append(source_id)
        target_node.input_nodes = input_nodes

    db.commit()
    return {"message": "Nodes connected successfully", "source": source_id, "target": target_id}

# DELETE endpoint to remove an edge (connection) between nodes
class DeleteEdgeRequest(BaseModel):
    source_id: str
    target_id: str
    project_id: str

@app.delete("/delete_edge")
def delete_edge(request: DeleteEdgeRequest, db: Session = Depends(get_db)):
    source_id = request.source_id
    target_id = request.target_id
    project_id = request.project_id

    # Remove from source node's outgoing connections
    if source_id.startswith("DAT"):
        source_node = db.query(DataNode).filter(
            DataNode.id == source_id, DataNode.project_id == project_id
        ).first()
        if not source_node:
            raise HTTPException(status_code=404, detail="Source DataNode not found")
        connected = source_node.connected_nodes or []
        if target_id in connected:
            connected.remove(target_id)
            source_node.connected_nodes = connected
    elif source_id.startswith("PIP"):
        source_node = db.query(PipelineNode).filter(
            PipelineNode.id == source_id, PipelineNode.project_id == project_id
        ).first()
        if not source_node:
            raise HTTPException(status_code=404, detail="Source PipelineNode not found")
        output_nodes = source_node.output_nodes or []
        if target_id in output_nodes:
            output_nodes.remove(target_id)
            source_node.output_nodes = output_nodes
    else:
        raise HTTPException(status_code=400, detail="Invalid source node id")

    # Remove from target node's incoming connections (target is expected to be a PipelineNode)
    target_node = db.query(PipelineNode).filter(
        PipelineNode.id == target_id, PipelineNode.project_id == project_id
    ).first()
    if not target_node:
        raise HTTPException(status_code=404, detail="Target PipelineNode not found")
    input_nodes = target_node.input_nodes or []
    if source_id in input_nodes:
        input_nodes.remove(source_id)
        target_node.input_nodes = input_nodes

    db.commit()
    return {"message": "Edge deleted successfully"}

# DELETE endpoint to remove a node (DataNode or PipelineNode)
@app.delete("/delete_node/{node_id}")
def delete_node(node_id: str, project_id: str, db: Session = Depends(get_db)):
    if node_id.startswith("DAT"):
        node = db.query(DataNode).filter(
            DataNode.id == node_id, DataNode.project_id == project_id
        ).first()
    elif node_id.startswith("PIP"):
        node = db.query(PipelineNode).filter(
            PipelineNode.id == node_id, PipelineNode.project_id == project_id
        ).first()
    else:
        raise HTTPException(status_code=400, detail="Invalid node id")
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    

    db.delete(node)
    db.commit()
    return {"message": "Node deleted successfully"}
