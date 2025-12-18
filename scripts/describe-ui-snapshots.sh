#!/bin/bash

set -euo pipefail

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPTS_DIR=$(dirname "$SCRIPT_PATH")
WORKING_DIR=$(dirname "$SCRIPTS_DIR")

cd $WORKING_DIR

ui_set_dir=$1

if [ -z "$ui_set_dir" ]; then
  echo "Usage: $0 <ui_set_directory>"
  exit 1
fi

mkdir -p .local/docs/ui-descriptions
ui_description_path=docs/ui-descriptions/$ui_set_dir.md
if [ -f "$ui_description_path" ]; then
  mv $ui_description_path .local/docs/ui-descriptions/$ui_set_dir-$(date +%Y%m%d%H%M%S).md
fi
touch $ui_description_path

translation_prompt="Read all images in directory @docs/ui-snapshots/$ui_set_dir

Each image represent a UI page.
For each page, write a detailed textual description.
For each page, identify every element and its exact content (e.g., text on buttons, labels, placeholder text).
Describe each element's component type (e.g., card, alert, button, input field, dropdown) and its function or role.
Describe how a user is expected to interact with each element on each page.
Pages are provided in random order, rearrange the pages based on its semantic logical order.

The goal of UI textual description is to serve as a reference to replicate the page's content and core concepts.
Focus on the content and functionality rather than the visual design details.

Write down UI textual description in @$ui_description_path
"

claude --dangerously-skip-permissions --model claude-sonnet-4-5-20250929 --print "$translation_prompt"
