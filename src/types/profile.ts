// ============================================================
// Profile Data Types
// These are pulled from DB, never AI-generated
// ============================================================

export interface ProfileData {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  defaultTitle: string;

  positions: PositionData[];
  education: EducationData;

  linkedIn?: string;
  website?: string;
}

export interface PositionData {
  order: number;          // 1, 2, 3, 4, 5, 6
  company: string;        // "Deloitte Digital"
  title: string;          // "SVP Brand Strategy / Head of Brand Strategy Practice"
  location: string;       // "New York, NY"
  startDate: string;      // "May 2021"
  endDate: string;        // "Present"
  overview: string;       // Static overview for P3-P6 (empty for P1/P2 - AI writes those)
}

export interface EducationData {
  school: string;
  degree: string;
  field: string;
}
