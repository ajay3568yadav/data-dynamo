# execution/Dockerfile
FROM python:3.10-slim

WORKDIR /app

# (Optional) Copy and install dependencies if your scripts require them.
# If no extra dependencies are needed, you can omit these lines.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the script runner
COPY run_script.py /app/

# Default command: run the script passed as an argument
CMD ["python", "run_script.py"]
