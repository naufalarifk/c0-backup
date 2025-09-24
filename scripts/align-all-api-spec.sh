#!/bin/bash

set -euo pipefail

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPTS_DIR=$(dirname "$SCRIPT_PATH")
WORKING_DIR=$(dirname "$SCRIPTS_DIR")

cd $WORKING_DIR

mkdir -p docs/api-alignment-reports

for audit_report_path in docs/api-audit-reports/*.md
do
  api_audit_report_filename=$(basename $audit_report_path .md)
  api_alignment_report_path=docs/api-alignment-reports/$api_audit_report_filename-alignment.md
  if [ -f "$api_alignment_report_path" ]
  then
    echo "alignment report for $api_audit_report_filename already exists, skipping..."
    continue
  fi
  echo "align API spec to $api_audit_report_filename..."
  bash $WORKING_DIR/scripts/align-api-spec.sh $api_audit_report_filename
  echo "alignment report has been written to $api_alignment_report_path"
done
