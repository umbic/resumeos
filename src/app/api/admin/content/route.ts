import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MASTER_CONTENT_PATH = path.join(process.cwd(), 'src/data/master-content.json');

// GET - Read all content from master-content.json
export async function GET() {
  try {
    const masterContent = JSON.parse(fs.readFileSync(MASTER_CONTENT_PATH, 'utf8'));

    return NextResponse.json({
      masterContent,
      path: MASTER_CONTENT_PATH
    });
  } catch (error) {
    console.error('Error reading content:', error);
    return NextResponse.json({ error: 'Failed to read content' }, { status: 500 });
  }
}

// POST - Save content changes to master-content.json
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data } = body;

    // Create backup before saving
    const backupPath = MASTER_CONTENT_PATH + '.backup';
    if (fs.existsSync(MASTER_CONTENT_PATH)) {
      fs.copyFileSync(MASTER_CONTENT_PATH, backupPath);
    }

    // Write the updated content
    fs.writeFileSync(MASTER_CONTENT_PATH, JSON.stringify(data, null, 2));

    return NextResponse.json({
      success: true,
      message: 'Saved master-content.json',
      backupCreated: backupPath
    });
  } catch (error) {
    console.error('Error saving content:', error);
    return NextResponse.json({ error: 'Failed to save content' }, { status: 500 });
  }
}
