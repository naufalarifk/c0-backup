#!/bin/bash

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPTS_DIR=$(dirname "$SCRIPT_PATH")
WORKING_DIR=$(dirname "$SCRIPTS_DIR")

report_dir="$WORKING_DIR/.local/test-reports-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$report_dir"

env -C $WORKING_DIR pnpm install
env -C $WORKING_DIR pnpm build

for test_rel_path in ./test/*.test.ts
do
  test_filename=$(basename "$test_rel_path")
  echo "Running backend e2e test: $test_filename"
  timeout 60 env -C $WORKING_DIR node --import tsx --test test/$test_filename > $report_dir/backend-e2e-$test_filename.log 2>&1
  echo "Finished backend e2e test: $test_filename"
done

# for test_rel_path in ./src/shared/repositories/*.test.ts
# do
#   test_filename=$(basename "$test_rel_path")
#   echo "Running backend repository test: $test_filename"
#   timeout 120 env -C $WORKING_DIR node --import tsx --test src/shared/repositories/$test_filename > "$report_dir/backend-repo-$test_filename.log" 2>&1
#   echo "Finished backend repository test: $test_filename"
# done

{ grep -rl '✘' $report_dir; grep -rl 'fail [1-9][0-9]*' $report_dir; } | sort | uniq
