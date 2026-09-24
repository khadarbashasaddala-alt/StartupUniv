#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VENV_DIR="$SCRIPT_DIR/.venv"

echo "🤖 StartUpVarsity Bot — startup"
echo "================================"

# Create virtual environment if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
  echo "📦 Creating virtual environment..."
  python3 -m venv "$VENV_DIR"
  echo "✅ Virtual environment created at $VENV_DIR"
else
  echo "✅ Virtual environment already exists"
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Install / update dependencies
echo "📥 Installing dependencies..."
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
echo "✅ Dependencies installed"

# Check for .env file
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo "⚠️  Warning: .env file not found. Copy .env.example and fill in your values."
  echo "   cp bot/.env.example bot/.env"
  exit 1
fi

# Check that OPENAI_API_KEY is set
if grep -q "sk-your-openai-api-key-here" "$SCRIPT_DIR/.env"; then
  echo "⚠️  Warning: OPENAI_API_KEY is still the placeholder value in .env"
  echo "   Please set a real OpenAI API key before starting."
  exit 1
fi

echo ""
echo "🚀 Starting FastAPI bot server on port 4001..."
echo "   Docs: http://localhost:4001/docs"
echo "   Health: http://localhost:4001/health"
echo "================================"

uvicorn main:app --host 0.0.0.0 --port 4001 --reload
