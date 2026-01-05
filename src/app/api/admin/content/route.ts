import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const CONTENT_DB_PATH = path.join(DATA_DIR, 'content-database.json');
const VARIANTS_PATH = path.join(DATA_DIR, 'variants.json');
const POSITION_VARIANTS_PATH = path.join(process.cwd(), 'position-bullet-variants.json');

// GET - Read all content
export async function GET() {
  try {
    const contentDb = JSON.parse(fs.readFileSync(CONTENT_DB_PATH, 'utf8'));
    const variants = JSON.parse(fs.readFileSync(VARIANTS_PATH, 'utf8'));

    let positionBulletVariants = { positionBulletVariants: {} };
    try {
      positionBulletVariants = JSON.parse(fs.readFileSync(POSITION_VARIANTS_PATH, 'utf8'));
    } catch {
      // File may not exist
    }

    return NextResponse.json({
      contentDatabase: contentDb,
      variants: variants,
      positionBulletVariants: positionBulletVariants,
      paths: {
        contentDatabase: CONTENT_DB_PATH,
        variants: VARIANTS_PATH,
        positionBulletVariants: POSITION_VARIANTS_PATH,
      }
    });
  } catch (error) {
    console.error('Error reading content:', error);
    return NextResponse.json({ error: 'Failed to read content' }, { status: 500 });
  }
}

// POST - Save content changes
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { file, data } = body;

    let filePath: string;
    switch (file) {
      case 'contentDatabase':
        filePath = CONTENT_DB_PATH;
        break;
      case 'variants':
        filePath = VARIANTS_PATH;
        break;
      case 'positionBulletVariants':
        filePath = POSITION_VARIANTS_PATH;
        break;
      default:
        return NextResponse.json({ error: 'Unknown file' }, { status: 400 });
    }

    // Create backup before saving
    const backupPath = filePath + '.backup';
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, backupPath);
    }

    // Write the updated content
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    return NextResponse.json({
      success: true,
      message: `Saved ${file}`,
      backupCreated: backupPath
    });
  } catch (error) {
    console.error('Error saving content:', error);
    return NextResponse.json({ error: 'Failed to save content' }, { status: 500 });
  }
}
