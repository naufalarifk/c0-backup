// Mock for uuid package to handle ES modules in Jest
const { v4: uuidv4 } = require('uuid');

// Generate a mock v7 function that creates valid UUIDs
// v7 includes timestamp info, but for testing we'll use v4
function v7() {
  return uuidv4();
}

// Mock v4 as well for completeness
function v4() {
  return uuidv4();
}

module.exports = {
  v4,
  v7,
  // Add other uuid functions if needed
  default: {
    v4,
    v7,
  }
};