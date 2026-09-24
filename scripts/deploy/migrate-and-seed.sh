#!/bin/bash

# Script to run database migrations and seed data
# ⚠️  WARNING: This script SEEDS DATA into the database
# Use this ONLY for testing/development databases
# For production, use: scripts/deploy/migrate-only.sh (tables only, no data)

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     DATABASE MIGRATION AND SEED SCRIPT                        ║"
echo "║     ⚠️  WARNING: This will SEED DATA (testing/dev only)      ║"
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

# Step 2: Run Migrations
echo "📋 Step 2: Running Database Migrations..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

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
    echo "✅ Migrations completed successfully!"
    echo "   All tables are up to date."
else
    echo "❌ Migrations failed"
    exit 1
fi

echo ""

# Step 3: Seed Database
echo "📋 Step 3: Seeding Database with Initial Data..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# For seed script, we need the DATABASE_URL without sslmode=require
# (the seed script handles SSL internally)
if [[ "$DATABASE_URL" == *"rds.amazonaws.com"* ]]; then
    # Remove sslmode=require for seed script
    SEED_DB_URL=$(echo "$DATABASE_URL" | sed 's/[?&]sslmode=[^&]*//g')
    export DATABASE_URL="$SEED_DB_URL"
fi

# Run seed script
npm run db:seed

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database seeded successfully!"
    echo ""
    echo "📊 Summary:"
    echo "  • 1 Admin user (admin@startupvarsity.com / admin123)"
    echo "  • 3 Mentor users"
    echo "  • 1 University organization + user"
    echo "  • 1 Corporate organization + user"
    echo "  • 1 Cohort (16 weeks)"
    echo "  • 2 Teams (10 learners each)"
    echo "  • 20 Learner users (learner1@demo.com - learner20@demo.com / admin123)"
    echo "  • 12 Problem statements (2 per track)"
    echo "  • Stipend rules configured"
    echo "  • Cap table entries"
    echo "  • Sample sprints, tasks, and evidence"
    echo ""
    echo "✅ Migration and seeding complete!"
else
    echo "❌ Seeding failed"
    exit 1
fi

