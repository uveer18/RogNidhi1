#!/usr/bin/env bash
# exit on error
set -o errexit

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Run migrations
python backend/manage.py migrate

# Collect static files
python backend/manage.py collectstatic --no-input
