from sqlalchemy import (
    Column,
    String,
    Enum,
    Integer,
    BigInteger,
    Float,
    Text,
    DateTime,
    ForeignKey,
    event,
    text
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from pydantic import BaseModel
from datetime import datetime
import enum
import uuid
from database import engine, SessionLocal, Base



def attach_id_generator(model, id_field_name, prefix):
    @event.listens_for(model, 'before_insert')
    def receive_before_insert(mapper, connection, target):
        if getattr(target, id_field_name):
            return

        table_name = model.__tablename__
        sql = text(
            f"SELECT COALESCE(MAX(CAST(SUBSTRING({id_field_name} from {len(prefix)+1} for 4) AS INTEGER)), 0) "
            f"FROM {table_name} WHERE {id_field_name} LIKE :prefix"
        )
        result = connection.execute(sql, {"prefix": f"{prefix}%"})
        max_num = result.scalar() or 0
        new_num = max_num + 1
        new_id = f"{prefix}{new_num:04d}"
        setattr(target, id_field_name, new_id)

class DatasetType(enum.Enum):
    text = "text"
    image = "image"
    audio = "audio"
    video = "video"
    CSV = "CSV"
    Unknown = "Unknown"

class User(Base):
    __tablename__ = "users"
    id = Column(String(255), primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)

class Project(Base):
    __tablename__ = "projects"
    project_id = Column(String(255), primary_key=True, index=True)
    project_name = Column(String(255), nullable=False)
    user_id = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    data_profiles = relationship("DataProfile", back_populates="project")
    pipeline_stages = relationship("PipelineStage", back_populates="project")
    results = relationship("ProjectResult", back_populates="project")
    data_nodes = relationship("DataNode", back_populates="project")
    pipeline_nodes = relationship("PipelineNode", back_populates="project")

class DataProfile(Base):
    __tablename__ = "data_profiles"
    profile_id = Column(String(255), primary_key=True, index=True)
    profile_name = Column(String(255), nullable=False)
    dataset_name = Column(String(255), nullable=False)
    dataset_type = Column(Enum(DatasetType), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    record_count = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    project_id = Column(String(255), ForeignKey("projects.project_id"), nullable=False)

    # Relationships
    project = relationship("Project", back_populates="data_profiles")
    text_profile = relationship("TextProfile", uselist=False, back_populates="data_profile")
    image_profile = relationship("ImageProfile", uselist=False, back_populates="data_profile")
    audio_profile = relationship("AudioProfile", uselist=False, back_populates="data_profile")
    video_profile = relationship("VideoProfile", uselist=False, back_populates="data_profile")
    csv_profile = relationship("CSVProfile", uselist=False, back_populates="data_profile")
    mixed_profile = relationship("MixedProfile", uselist=False, back_populates="data_profile")
    # Relationship to graph node (one-to-one)
    data_node = relationship("DataNode", back_populates="data_profile", uselist=False)

class TextProfile(Base):
    __tablename__ = "text_profiles"
    profile_id = Column(String(255), ForeignKey("data_profiles.profile_id"), primary_key=True)
    total_words = Column(Integer)
    unique_words = Column(Integer)
    average_word_length = Column(Float)
    average_sentence_length = Column(Float)
    most_common_word = Column(String(255))
    missing_values = Column(Integer)
    language_detected = Column(String(100))
    data_profile = relationship("DataProfile", back_populates="text_profile")

class ImageProfile(Base):
    __tablename__ = "image_profiles"
    profile_id = Column(String(255), ForeignKey("data_profiles.profile_id"), primary_key=True)
    total_images = Column(Integer)
    average_resolution = Column(String(50))
    dominant_color = Column(String(50))
    average_file_size = Column(Float)
    image_formats = Column(String(255))
    data_profile = relationship("DataProfile", back_populates="image_profile")

class AudioProfile(Base):
    __tablename__ = "audio_profiles"
    profile_id = Column(String(255), ForeignKey("data_profiles.profile_id"), primary_key=True)
    total_audio_files = Column(Integer)
    average_duration = Column(Float)
    sample_rates = Column(String(100))
    average_bitrate = Column(Integer)
    file_formats = Column(String(255))
    data_profile = relationship("DataProfile", back_populates="audio_profile")

class VideoProfile(Base):
    __tablename__ = "video_profiles"
    profile_id = Column(String(255), ForeignKey("data_profiles.profile_id"), primary_key=True)
    total_videos = Column(Integer)
    average_duration = Column(Float)
    resolution_distribution = Column(String(255))
    frame_rates = Column(String(255))
    file_formats = Column(String(255))
    average_bitrate = Column(Integer)
    data_profile = relationship("DataProfile", back_populates="video_profile")

class CSVProfile(Base):
    __tablename__ = "csv_profiles"
    profile_id = Column(String(255), ForeignKey("data_profiles.profile_id"), primary_key=True)
    total_columns = Column(Integer)
    total_rows = Column(Integer)
    column_types = Column(Text)
    missing_values = Column(Integer)
    most_common_value = Column(Text)
    duplicate_rows = Column(Integer)
    data_profile = relationship("DataProfile", back_populates="csv_profile")

class MixedProfile(Base):
    __tablename__ = "mixed_profiles"
    profile_id = Column(String(255), ForeignKey("data_profiles.profile_id"), primary_key=True)
    detected_types = Column(String(255), nullable=False)
    data_profile = relationship("DataProfile", back_populates="mixed_profile")

class PipelineStage(Base):
    __tablename__ = "pipeline_stage"
    id = Column(String(255), primary_key=True, index=True)
    project_id = Column(String(255), ForeignKey("projects.project_id"), nullable=False)
    stage_name = Column(String(255), nullable=False)
    stage_type = Column(String(50), nullable=False)
    user_prompt = Column(Text, nullable=True)
    script = Column(Text, nullable=False)
    script_language = Column(String(50), nullable=False)
    docker_image = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Add this relationship so that the back_populates matches Project.pipeline_stages:
    project = relationship("Project", back_populates="pipeline_stages")
    
    pipeline_node = relationship("PipelineNode", back_populates="pipeline_stage", uselist=False)



class PipelineExecution(Base):
    __tablename__ = "pipeline_execution"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(String(255), ForeignKey("projects.project_id"), nullable=False)
    dataset_id = Column(String(255), ForeignKey("data_profiles.profile_id"), nullable=False)
    status = Column(String(50), nullable=False)  # pending, running, completed, failed
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

class ProjectResult(Base):
    __tablename__ = "results"
    result_id = Column(String(255), primary_key=True, index=True)
    project_id = Column(String(255), ForeignKey("projects.project_id"), nullable=False)
    result_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    project = relationship("Project", back_populates="results")

class DataNode(Base):
    __tablename__ = "data_nodes"
    id = Column(String(255), primary_key=True, index=True)  # e.g., DAT0001
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    project_id = Column(String(255), ForeignKey("projects.project_id"), nullable=False)
    data_profile_id = Column(String(255), ForeignKey("data_profiles.profile_id"), nullable=False)
    connected_nodes = Column(JSONB, default=[])  # Outgoing connections

    project = relationship("Project", back_populates="data_nodes")
    data_profile = relationship("DataProfile", back_populates="data_node", uselist=False)

class PipelineNode(Base):
    __tablename__ = "pipeline_nodes"
    id = Column(String(255), primary_key=True, index=True)  # e.g., PIP0001
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    project_id = Column(String(255), ForeignKey("projects.project_id"), nullable=False)
    pipeline_stage_id = Column(String(255), ForeignKey("pipeline_stage.id"), nullable=False)
    input_nodes = Column(JSONB, default=[])    # Incoming connections
    output_nodes = Column(JSONB, default=[])   # Outgoing connections

    project = relationship("Project", back_populates="pipeline_nodes")
    pipeline_stage = relationship("PipelineStage", back_populates="pipeline_node", uselist=False)


# Attach ID generators to models
attach_id_generator(User, "id", "USR")
attach_id_generator(Project, "project_id", "PRJ")
attach_id_generator(DataProfile, "profile_id", "DTP")
attach_id_generator(TextProfile, "profile_id", "TXP")
attach_id_generator(ImageProfile, "profile_id", "IMP")
attach_id_generator(AudioProfile, "profile_id", "APF")
attach_id_generator(VideoProfile, "profile_id", "VPF")
attach_id_generator(CSVProfile, "profile_id", "CSV")
attach_id_generator(MixedProfile, "profile_id", "MXP")
attach_id_generator(ProjectResult, "result_id", "RES")
attach_id_generator(DataNode, "id", "DAT")
attach_id_generator(PipelineNode, "id", "PIP")
attach_id_generator(PipelineStage, "id", "PS")

def init_db():
    Base.metadata.create_all(bind=engine)



