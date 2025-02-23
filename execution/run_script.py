# execution/run_script.py
import os
import sys
import subprocess

# Expect the script path as the first argument; default if none is provided
script_path = sys.argv[1] if len(sys.argv) > 1 else "generated_script.py"

if not os.path.exists(script_path):
    print(f"Error: {script_path} does not exist")
    sys.exit(1)

# Execute the script and print its output and errors
result = subprocess.run(["python", script_path], capture_output=True, text=True)
print("Output:\n", result.stdout)
print("Errors:\n", result.stderr)
