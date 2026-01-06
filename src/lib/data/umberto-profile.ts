import { ProfileData } from '@/types/profile';

export const UMBERTO_PROFILE: ProfileData = {
  id: 'umberto-castaldo',
  name: 'Umberto Castaldo',
  email: 'Umberto.Castaldo@gmail.com',
  phone: '917 435 2003',
  location: 'New York, NY',
  defaultTitle: 'SVP Brand Strategy / Head of Brand Strategy Practice',

  positions: [
    {
      order: 1,
      company: 'Deloitte Digital',
      title: 'SVP Brand Strategy / Head of Brand Strategy Practice',
      location: 'New York, NY',
      startDate: 'May 2021',
      endDate: 'Present',
      overview: '' // AI will write P1 overview
    },
    {
      order: 2,
      company: 'Deloitte Digital',
      title: 'Sr. Director of Brand Strategy',
      location: 'New York, NY',
      startDate: 'Apr 2018',
      endDate: 'May 2021',
      overview: '' // AI will write P2 overview
    },
    {
      order: 3,
      company: 'Omnicom Media Group',
      title: 'VP of Innovation',
      location: 'New York, NY',
      startDate: 'May 2016',
      endDate: 'Apr 2018',
      overview: 'Promoted to lead innovation across brand, technology, and customer experience, helping clients navigate shift from traditional media to integrated, data-driven marketing approaches and performance measurement systems.'
    },
    {
      order: 4,
      company: 'OMD Worldwide',
      title: 'Head of Media Innovation',
      location: 'New York, NY',
      startDate: 'Apr 2015',
      endDate: 'May 2016',
      overview: "Recruited to lead GE's global brand storytelling and innovation strategy, with mandate to position company as leader in emerging media and branded entertainment through integrated campaign development."
    },
    {
      order: 5,
      company: 'Straightline International',
      title: 'Senior Brand Strategist',
      location: 'New York, NY',
      startDate: 'Jul 2014',
      endDate: 'Apr 2015',
      overview: 'Developed foundational brand strategy systems for B2B and industrial clients undergoing transformation, including post-merger integration and portfolio rationalization through comprehensive positioning and value proposition work.'
    },
    {
      order: 6,
      company: 'Berlin Cameron, WPP Cultural Agency',
      title: 'Brand Strategist',
      location: 'New York, NY',
      startDate: 'Jun 2011',
      endDate: 'Jul 2014',
      overview: 'Supported brand positioning and integrated campaign development across consumer, tech, and financial services clients as part of cross-functional creative teams focused on strategic storytelling and performance outcomes.'
    }
  ],

  education: {
    school: 'Marist College',
    degree: 'Bachelor of Business Administration',
    field: 'Business Management & Marketing Communications'
  }
};

/**
 * Get profile by ID
 * For now returns hardcoded profile, later can query DB
 */
export function getProfile(profileId: string): ProfileData {
  if (profileId === 'umberto-castaldo' || profileId === 'default') {
    return UMBERTO_PROFILE;
  }
  throw new Error(`Profile not found: ${profileId}`);
}
