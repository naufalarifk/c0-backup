#!/bin/bash

set -euo pipefail

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPTS_DIR=$(dirname "$SCRIPT_PATH")
WORKING_DIR=$(dirname "$SCRIPTS_DIR")

cd $WORKING_DIR

ui_description_filename=$1

if [ -z "$ui_description_filename" ]; then
  echo "Usage: $0 <ui_description_filenameectory>"
  exit 1
fi

spec_discrepency_report_path=docs/api-audit-reports/$ui_description_filename-audit-report.md
mkdir -p .local/docs/api-audit-reports
if [ -f "$spec_discrepency_report_path" ]; then
  mv $spec_discrepency_report_path .local/docs/api-audit-reports/$ui_description_filename-$(date +%Y%m%d%H%M%S)-audit-report.md
fi
touch $spec_discrepency_report_path

translation_prompt="Your task is to write a report describing discrepencies and suggesting a fix between the UI textual description and the API Documentation. Use the UI textual description as the source of truth.

Here are the API documentation files that require auditing:
@docs/api-plan/better-auth.yaml
@docs/api-plan/user-openapi.yaml
@docs/api-plan/loan-market-openapi.yaml
@docs/api-plan/loan-agreement-openapi.yaml

Here is the UI textual description as source of truth, your scope is limited to this file (The UI textual description shall be subset of the API documentation):
@docs/ui-descriptions/$ui_description_filename.md

Content of the Audit Report consists of:
- Coded list of discrepancies found between the UI textual description and the API documentation.
- For each discrepancy, explain in detail what data is required by the UI textual description but is missing or misrepresented in the API documentation.
- For each discrepancy, describe using data example scenario use cases.
- Do not exagerate features that are not explicitly mentioned in the UI textual description.

Write the audit report in @$spec_discrepency_report_path
"

claude \
  --dangerously-skip-permissions \
  --model claude-sonnet-4-5-20250929 \
  --append-system-prompt "Claude shall act as a project manager and backend lead developer, ensuring the API specification aligns perfectly with the UI textual descriptions." \
  --print \
  "$translation_prompt"
