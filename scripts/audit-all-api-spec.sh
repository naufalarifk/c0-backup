#!/bin/bash

set -euo pipefail

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPTS_DIR=$(dirname "$SCRIPT_PATH")
WORKING_DIR=$(dirname "$SCRIPTS_DIR")

cd $WORKING_DIR

for ui_description_path in docs/ui-descriptions/*
do
  ui_description_filename=$(basename -- "$ui_description_path")
  ui_description_filename_without_ext="${ui_description_filename%.*}"
  audi_report_path=docs/api-audit-reports/$ui_description_filename_without_ext-audit-report.md
  if [ -f "$audi_report_path" ]; then
    echo "Audit report for $ui_description_filename_without_ext already exists, skipping..."
    continue
  fi
  echo "Auditing API spec against UI description: $ui_description_filename_without_ext..."
  bash $WORKING_DIR/scripts/audit-api-spec.sh $ui_description_filename_without_ext
  echo "Audit report has been written to $audi_report_path"
done