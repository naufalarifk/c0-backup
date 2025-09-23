#!/bin/bash

set -euo pipefail

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPTS_DIR=$(dirname "$SCRIPT_PATH")
WORKING_DIR=$(dirname "$SCRIPTS_DIR")

cd $WORKING_DIR

for dir in docs/ui-snapshots/*/
do
  dir=${dir%*/}
  ui_set_dir=${dir##*/}
  ui_description_path=docs/ui-descriptions/$ui_set_dir.md
  if [ -f "$ui_description_path" ]; then
    echo "Description for $ui_set_dir already exists, skipping..."
    continue
  fi
  echo "Describing UI snapshots in $ui_set_dir..."

  bash $WORKING_DIR/scripts/describe-ui-snapshots.sh $ui_set_dir

  echo "UI Description has been written to $ui_description_path"
done