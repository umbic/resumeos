# V1 Upgrade Session Prompts

Drop these files in your ResumeOS project folder. Run one per Claude Code session.

## Order

| Session | File | What It Does | Time |
|---------|------|--------------|------|
| 1 | `SESSION_1_VERB_INFRA.md` | Database + types for verb tracking | 30 min |
| 2 | `SESSION_2_VERB_PROMPTS.md` | Update prompts to accept verb constraints | 45 min |
| 3 | `SESSION_3_WIRE_API.md` | Connect verb tracking through API routes | 30 min |
| 4 | `SESSION_4_REWRITE_PROMPTS.md` | Rewrite all prompts for quality | 60 min |
| 5 | `SESSION_5_CONVERSATION.md` | Add conversation history to all sections | 45 min |

## How to Use

1. Copy all files to your ResumeOS project root
2. Start a fresh Claude Code session
3. Say: `Read SESSION_1_VERB_INFRA.md and execute`
4. Let Claude Code work, commit when done
5. Update HANDOFF.md
6. Start new session for next file

## Tips

- Use `/clear` between sessions
- If context gets long, use `/compact`
- Commit after each working piece (don't wait until end)
- Test locally before pushing

## After All Sessions

Run full end-to-end test:
1. Create new session
2. Generate full resume
3. Check: no verb repetition, natural keywords, good readability
4. Export DOCX and review
