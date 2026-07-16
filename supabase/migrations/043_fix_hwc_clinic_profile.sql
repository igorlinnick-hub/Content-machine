-- Fix Hawaii Wellness Clinic (Dr. Shawn) content profile.
-- Previous data had only 2 pillars (Recovery Science, Clinic Myths).
-- Correct pillars match the MANYCHAT_CTA_CATEGORIES in lib/seeds/cta-keywords.ts.

UPDATE clinics
SET
  content_pillars = ARRAY[
    'Mental Health',
    'Pain & Joint',
    'Wellness & Vitality',
    'Weight Loss'
  ],
  deep_dive_topics = ARRAY[
    'TMS for treatment-resistant depression',
    'Ketamine infusion for depression and suicidal ideation',
    'SGB (Stellate Ganglion Block) for PTSD and anxiety',
    'Spravato (esketamine) nasal spray — FDA-approved for TRD',
    'PRP joint injection for arthritis and cartilage repair',
    'A2M injection for cartilage protection',
    'Shockwave therapy for chronic musculoskeletal pain',
    'NAD+ IV infusion for cellular energy and longevity',
    'Peptide therapy (BPC-157, TB-500, CJC/Ipamorelin)',
    'Testosterone and hormone optimization for men and women over 40',
    'IV vitamin infusion and hydration drips',
    'Semaglutide and GLP-1 for medical weight loss',
    'Tirzepatide (Mounjaro) for weight and metabolic health',
    'Retatrutide — next-generation GLP-1/GIP/glucagon agonist'
  ],
  services = ARRAY[
    'TMS Therapy',
    'Ketamine Infusion',
    'Spravato (Esketamine)',
    'Stellate Ganglion Block (SGB)',
    'PRP Joint Injection',
    'A2M Injection',
    'Biologic Joint Therapy',
    'Shockwave Therapy',
    'NAD+ IV Infusion',
    'Peptide Therapy',
    'Hormone Replacement Therapy',
    'Testosterone Replacement Therapy',
    'IV Vitamin Infusion',
    'Semaglutide Weight Loss Program',
    'Tirzepatide Weight Loss Program',
    'Medical Weight Loss'
  ]
WHERE id = '5065c6ee-7c4b-451b-8dee-3498eb3af674';
