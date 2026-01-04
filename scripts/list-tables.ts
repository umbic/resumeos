import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function listTables() {
  const result = await sql`
    SELECT table_name, 
           (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
    FROM information_schema.tables t
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
  
  console.log('Tables in current database:\n');
  console.log('| Table | Columns | Project |');
  console.log('|-------|---------|---------|');
  
  const resumeosTables = ['sessions', 'content_items', 'conflict_rules', 'learned_content'];
  
  for (const row of result.rows) {
    const project = resumeosTables.includes(row.table_name) ? 'ResumeOS' : '❌ OTHER';
    console.log(`| ${row.table_name} | ${row.column_count} | ${project} |`);
  }
  
  process.exit(0);
}

listTables();
