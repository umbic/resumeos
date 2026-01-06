#!/bin/bash
# ResumeOS V2.1 E2E Test Script
# Tests the complete pipeline flow from start to finish

BASE_URL="${1:-http://localhost:3000}"
echo "Testing V2.1 Pipeline at: $BASE_URL"
echo "================================================"

# Sample job description
JD=$(cat <<'EOF'
Senior Product Marketing Manager - B2B SaaS

About the Role:
We're looking for a Senior Product Marketing Manager to lead go-to-market strategy for our enterprise platform. You'll work cross-functionally with product, sales, and customer success teams.

Requirements:
- 7+ years of product marketing experience in B2B SaaS
- Experience with enterprise sales cycles and complex buying committees
- Strong analytical skills with ability to derive insights from data
- Excellent written and verbal communication skills
- Experience launching products from 0-1
- MBA preferred

Responsibilities:
- Develop and execute go-to-market strategies for new product launches
- Create compelling positioning and messaging frameworks
- Build sales enablement materials and competitive intelligence
- Analyze market trends and customer insights
- Collaborate with product team on roadmap prioritization
EOF
)

echo ""
echo "Step 1: Starting Analysis Phase..."
echo "-----------------------------------"

RESPONSE=$(curl -s -X POST "$BASE_URL/api/v2.1/pipeline/start" \
  -H "Content-Type: application/json" \
  -d "{\"jobDescription\": $(echo "$JD" | jq -Rs .)}")

echo "$RESPONSE" | jq .

SESSION_ID=$(echo "$RESPONSE" | jq -r '.sessionId')
STATUS=$(echo "$RESPONSE" | jq -r '.status')

if [ "$SESSION_ID" == "null" ] || [ -z "$SESSION_ID" ]; then
  echo "❌ Failed to start pipeline"
  exit 1
fi

echo ""
echo "✅ Session created: $SESSION_ID"
echo "   Status: $STATUS"

echo ""
echo "Step 2: Checking Status..."
echo "--------------------------"

STATUS_RESPONSE=$(curl -s "$BASE_URL/api/v2.1/pipeline/status?sessionId=$SESSION_ID")
echo "$STATUS_RESPONSE" | jq .

echo ""
echo "Step 3: Approving Session..."
echo "----------------------------"

APPROVE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v2/approve" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"additionalContext\": \"Focus on B2B SaaS experience and GTM expertise.\"}")

echo "$APPROVE_RESPONSE" | jq .

APPROVE_STATUS=$(echo "$APPROVE_RESPONSE" | jq -r '.status')

if [ "$APPROVE_STATUS" != "approved" ]; then
  echo "❌ Failed to approve session"
  exit 1
fi

echo ""
echo "✅ Session approved"

echo ""
echo "Step 4: Running Generation Phase..."
echo "------------------------------------"

GEN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v2.1/pipeline/generate" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\"}")

echo "$GEN_RESPONSE" | jq .

FINAL_STATUS=$(echo "$GEN_RESPONSE" | jq -r '.status')

echo ""
echo "================================================"
if [ "$FINAL_STATUS" == "complete" ]; then
  echo "✅ V2.1 Pipeline Test PASSED"
  echo "   Session: $SESSION_ID"
  echo "   Final Status: $FINAL_STATUS"

  # Show resume preview
  echo ""
  echo "Resume Preview (first 500 chars):"
  echo "----------------------------------"
  echo "$GEN_RESPONSE" | jq -r '.resumeMarkdown' | head -c 500
  echo "..."
else
  echo "❌ V2.1 Pipeline Test FAILED"
  echo "   Session: $SESSION_ID"
  echo "   Final Status: $FINAL_STATUS"
  exit 1
fi
