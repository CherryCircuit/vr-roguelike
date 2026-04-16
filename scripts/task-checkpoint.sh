#!/bin/bash

# Task checkpoint system for vr-roguelike code review
# Usage: bash scripts/task-checkpoint.sh <command> [flow_name] [-- steps...]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CHECKPOINTS_DIR="$PROJECT_DIR/checkpoints"

# Create checkpoints directory if it doesn't exist
mkdir -p "$CHECKPOINTS_DIR"

# Helper function to get timestamp
get_timestamp() {
    date +"%Y-%m-%d %H:%M:%S"
}

# Helper function to create checkpoint file
create_checkpoint() {
    local flow_name="$1"
    local step_name="$2"
    local status="${3:-pending}"
    local file="$CHECKPOINTS_DIR/${flow_name}.json"
    
    # Initialize flow if it doesn't exist
    if [ ! -f "$file" ]; then
        echo "[]" > "$file"
    fi
    
    # Create checkpoint entry
    local checkpoint='{"step": "'"$step_name"'", "status": "'"$status"'", "timestamp": "'$(get_timestamp)'"}'
    
    # Add to flow file
    if [ "$status" == "init" ]; then
        echo "[$checkpoint]" > "$file"
    else
        # Parse existing JSON and add new checkpoint
        python3 -c "
import json
import sys
file = '$file'
try:
    with open(file, 'r') as f:
        data = json.load(f)
except:
    data = []

checkpoint = {'step': '$step_name', 'status': '$status', 'timestamp': '$(get_timestamp)'}
data.append(checkpoint)

with open(file, 'w') as f:
    json.dump(data, f, indent=2)
"
    fi
}

# List existing flows
list_flows() {
    echo "Existing checkpoint flows:"
    for file in "$CHECKPOINTS_DIR"/*.json; do
        if [ -f "$file" ]; then
            flow_name=$(basename "$file" .json)
            echo "  $flow_name"
        fi
    done
}

# Check if flow exists
check_flow() {
    local flow_name="$1"
    local file="$CHECKPOINTS_DIR/${flow_name}.json"
    [ -f "$file" ]
}

# Initialize flow
init_flow() {
    local flow_name="$1"
    shift
    local steps=("$@")
    
    if check_flow "$flow_name"; then
        echo "Flow '$flow_name' already exists. Choose a different name."
        return 1
    fi
    
    create_checkpoint "$flow_name" "init" "init"
    
    # Initialize the flow with steps
    python3 -c "
import json
file = '$CHECKPOINTS_DIR/${flow_name}.json'
with open(file, 'r') as f:
    data = json.load(f)

# Add steps
for i, step in enumerate($(printf "'%s' " "${steps[@]}")):
    data.append({
        'step': step,
        'status': 'pending',
        'timestamp': '$(get_timestamp)'
    })

with open(file, 'w') as f:
    json.dump(data, f, indent=2)
"
    
    echo "Flow '$flow_name' initialized with steps:"
    for step in "${steps[@]}"; do
        echo "  - $step"
    done
}

# Get next pending step
get_next_step() {
    local flow_name="$1"
    local file="$CHECKPOINTS_DIR/${flow_name}.json"
    
    if [ ! -f "$file" ]; then
        echo "Flow '$flow_name' not found."
        return 1
    fi
    
    python3 -c "
import json
file = '$CHECKPOINTS_DIR/${flow_name}.json'
with open(file, 'r') as f:
    data = json.load(f)

# Find first pending step
for entry in data:
    if entry['status'] == 'pending':
        print(entry['step'])
        break
else:
    print('All steps completed')
"
}

# Mark step as done
mark_done() {
    local flow_name="$1"
    local step_name="$2"
    local file="$CHECKPOINTS_DIR/${flow_name}.json"
    
    python3 -c "
import json
file = '$CHECKPOINTS_DIR/${flow_name}.json'
with open(file, 'r') as f:
    data = json.load(f)

# Update step status
for entry in data:
    if entry['step'] == '$step_name':
        entry['status'] = 'done'
        entry['timestamp'] = '$(get_timestamp)'
        break

with open(file, 'w') as f:
    json.dump(data, f, indent=2)
"
    
    echo "Step '$step_name' marked as done."
}

# Show flow status
show_status() {
    local flow_name="$1"
    local file="$CHECKPOINTS_DIR/${flow_name}.json"
    
    if [ ! -f "$file" ]; then
        echo "Flow '$flow_name' not found."
        return 1
    fi
    
    echo "Flow status for '$flow_name':"
    python3 -c "
import json
file = '$CHECKPOINTS_DIR/${flow_name}.json'
with open(file, 'r') as f:
    data = json.load(f)

for i, entry in enumerate(data):
    status_emoji = {'init': '🟢', 'pending': '⚪', 'done': '🟡', 'error': '🔴'}.get(entry['status'], '❓')
    print(f\"  {i}. {entry['step']} - {status_emoji} {entry['status']} ({entry['timestamp']})\")
"
}

# Main command handler
case "${1:-}" in
    "list")
        list_flows
        ;;
    "init")
        shift
        if [ $# -lt 2 ]; then
            echo "Usage: $0 init <flow_name> -- <step1> <step2> ..."
            exit 1
        fi
        
        local flow_name="$1"
        shift
        if [ "$1" != "--" ]; then
            echo "Error: Expected '--' after flow name"
            exit 1
        fi
        shift
        
        init_flow "$flow_name" "$@"
        ;;
    "next")
        shift
        if [ $# -eq 0 ]; then
            echo "Usage: $0 next <flow_name>"
            exit 1
        fi
        
        get_next_step "$1"
        ;;
    "done")
        shift
        if [ $# -lt 2 ]; then
            echo "Usage: $0 done <flow_name> <step_name>"
            exit 1
        fi
        
        mark_done "$1" "$2"
        ;;
    "status")
        shift
        if [ $# -eq 0 ]; then
            echo "Usage: $0 status <flow_name>"
            exit 1
        fi
        
        show_status "$1"
        ;;
    *)
        echo "Usage: $0 <command> [args...]"
        echo ""
        echo "Commands:"
        echo "  list                    - List all existing flows"
        echo "  init <flow_name> -- steps... - Initialize a new flow with steps"
        echo "  next <flow_name>         - Get next pending step for a flow"
        echo "  done <flow_name> <step>  - Mark a step as done"
        echo "  status <flow_name>       - Show flow status"
        exit 1
        ;;
esac