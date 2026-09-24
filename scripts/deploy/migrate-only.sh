#!/bin/bash

# Script to run database migrations ONLY (no seeding)
# This ensures all tables exist but does NOT populate data
# Use this for production databases

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     DATABASE MIGRATION ONLY (NO SEEDING)                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

APP_NAME="startupvarsity-portal"
AWS_REGION=${AWS_REGION:-us-west-2}

# Step 1: Get DATABASE_URL from AWS Secrets Manager
echo "📋 Step 1: Getting DATABASE_URL from AWS Secrets Manager..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL not set. Attempting to get from AWS Secrets Manager..."
    
    SECRET_ARN=$(aws secretsmanager list-secrets \
        --region $AWS_REGION \
        --query "SecretList[?contains(Name, '$APP_NAME/DATABASE_URL')].ARN" \
        --output text | head -n1)
    
    if [ ! -z "$SECRET_ARN" ]; then
        echo "✅ Found secret: $SECRET_ARN"
        DB_URL=$(aws secretsmanager get-secret-value \
            --secret-id $SECRET_ARN \
            --region $AWS_REGION \
            --query SecretString \
            --output text)
        
        # Handle RDS SSL - drizzle-kit needs sslmode=require in URL
        if [[ "$DB_URL" == *"rds.amazonaws.com"* ]]; then
            # Remove existing sslmode if present
            DB_URL=$(echo "$DB_URL" | sed 's/[?&]sslmode=[^&]*//g')
            # Add sslmode=require for drizzle-kit
            if [[ "$DB_URL" == *"?"* ]]; then
                export DATABASE_URL="${DB_URL}&sslmode=require"
            else
                export DATABASE_URL="${DB_URL}?sslmode=require"
            fi
        else
            export DATABASE_URL="$DB_URL"
        fi
        echo "✅ DATABASE_URL retrieved from Secrets Manager"
    else
        echo "❌ Could not find DATABASE_URL secret in Secrets Manager"
        echo "   Please set DATABASE_URL environment variable"
        exit 1
    fi
else
    echo "✅ DATABASE_URL already set"
fi

echo ""

# Step 2: Run Migrations ONLY
echo "📋 Step 2: Running Database Migrations (Schema Only)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  NOTE: This will ONLY create/update tables, NOT seed data"
echo ""

# Handle RDS SSL certificates - drizzle-kit needs special handling
if [[ "$DATABASE_URL" == *"rds.amazonaws.com"* ]]; then
    echo "⚠️  RDS detected - configuring SSL for migrations..."
    # Temporarily allow self-signed certificates for migration
    export NODE_TLS_REJECT_UNAUTHORIZED=0
fi

# Run drizzle-kit push to create/update tables
echo "📋 Pushing schema to database..."
npx drizzle-kit push

# Reset SSL verification
unset NODE_TLS_REJECT_UNAUTHORIZED

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migrations completed successfully!"
    echo "   All tables are now up to date."
    echo "   ⚠️  No data was seeded - database is empty."
    echo ""
    echo "📝 To seed data (for testing/development only), run:"
    echo "   npm run db:seed"
    echo "   OR"
    echo "   scripts/deploy/migrate-and-seed.sh"
else
    echo "❌ Migrations failed"
    exit 1
fi

