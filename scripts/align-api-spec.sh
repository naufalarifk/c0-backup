#!/bin/bash

set -euo pipefail

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPTS_DIR=$(dirname "$SCRIPT_PATH")
WORKING_DIR=$(dirname "$SCRIPTS_DIR")

cd $WORKING_DIR

api_audit_report_filename=$1

if [ -z "$api_audit_report_filename" ]; then
  echo "Usage: $0 <api_audit_report_filename>"
  exit 1
fi

mkdir -p docs/api-alignment-reports
mkdir -p .local/docs/api-alignment-reports

api_alignment_report_path=docs/api-alignment-reports/$api_audit_report_filename-alignment.md
if [ -f $api_alignment_report_path ]
then
  mv $api_alignment_report_path .local/docs/api-alignment-reports/$api_audit_report_filename-alignment-$(date +%Y%m%d%H%M%S).md
fi
touch $api_alignment_report_path
echo "TODO: Write alignment report" > $api_alignment_report_path

api_spec_paths=$(find docs/api-plan -type f -name "*.yaml" | sed 's/^/@/;s/$/ /' | tr -d '\n')
api_schema_paths=$(find src/shared/repositories/postgres -type f -name "*.sql" | sort | tr -d '\n')

alignment_prompt="Your task is to align the API Documentation to the UI textual description based on the audit report provided.
—
Use the audit recommendations as a guide to make adjustments to the API documentation files.
—
Here is the audit report that outlines the discrepancies and suggested fixes:
@docs/api-audit-reports/$api_audit_report_filename.md
—
Here are the API documentations require adjustments: @docs/api-plan
—
Additionally, refer to the database schema files to ensure that any changes in the API documentation are consistent with the underlying data structures: @src/shared/repositories/postgres
—
Write the alignment report, the report should include list of modification and maybe changes requires to the database schema in @$api_alignment_report_path
"

opencode \
  --model github-copilot/grok-code-fast-1 \
  --agent api-spec-maintainer \
  run \
  "$alignment_prompt"

# claude \
#   --dangerously-skip-permissions \
#   --model claude-sonnet-4-20250514 \
#   --append-system-prompt "Claude shall act Backend Lead Developer, maintaining the API specification to ensure it aligns perfectly with the UI textual descriptions." \
#   --print \
#   "$alignment_prompt"
