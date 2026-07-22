-- Reassign question headings by question index.
-- Clears every existing heading, then assigns the new section headings to the
-- listed indices. Indices not listed remain with a null heading.
-- Run in: Supabase Dashboard → SQL Editor → New query → Run

begin;

-- Step 1: clear all existing headings.
update public.questions set heading = null;

-- Step 2: assign new headings per index group.

-- 1. Advent of the Europeans
update public.questions set heading = 'Advent of the Europeans'
where "index" in (237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,254,347);

-- 2. India on the Eve of the British Conquest
update public.questions set heading = 'India on the Eve of the British Conquest'
where "index" in (233,234,235,236,290,296,332);

-- 3. Expansion and Consolidation of British Power in India
update public.questions set heading = 'Expansion and Consolidation of British Power in India'
where "index" in (252,253,255,256,257,258,259,260,261,262,263,264,265,266,267,268,269,270,271,272,276,277,278,279,280,281,282,283,284,285,286,287,288,289,291,292,293,294,295,297,298,299,300,301,302,303,304,314,315,316,317,318,319,320,321,322,323,324,325,326,327,328,329,330,331,333,334,335,336,337,338,339,345,346,348,349,350,351,352,353,354,355,356,357,358,359,360,361,362,363,364,365,366,367,368,369,370,371,372,373,374,375,376,378,379,380,381,383,401,418,428,429,430,433,450,451,452,453,454,455,456,457,458,462,478,479,480,481,482);

-- 4. People's Resistance against the British before 1857
update public.questions set heading = 'People''s Resistance against the British before 1857'
where "index" in (273,274,275,341,343,344);

-- 5. The Revolt of 1857
update public.questions set heading = 'The Revolt of 1857'
where "index" in (305,306,307,308,309,310,311,312,313,340,342);

-- 6. Socio-Religious Movements (no questions assigned)

-- 7. Reform Movement and their Leaders (no questions assigned)

-- 8. Beginning of Modern Nationalism
update public.questions set heading = 'Beginning of Modern Nationalism'
where "index" in (377,382,384,385,460);

-- 9. Indian National Congress - Foundation and the Moderate Phase
update public.questions set heading = 'Indian National Congress - Foundation and the Moderate Phase'
where "index" in (432,444,473,475);

-- 10. Era of Militant Nationalism
update public.questions set heading = 'Era of Militant Nationalism'
where "index" in (461);

-- 11. First Phase of Revolutionary Activities (1907-1917)
update public.questions set heading = 'First Phase of Revolutionary Activities (1907-1917)'
where "index" in (390,411,448,449,469,474);

-- 12. First World War & Nationalist Response
update public.questions set heading = 'First World War & Nationalist Response'
where "index" in (422,441);

-- 13. Emergence of Gandhi
update public.questions set heading = 'Emergence of Gandhi'
where "index" in (395,402,459);

-- 14. Non-Cooperation Movement & Khilafat Andolan
update public.questions set heading = 'Non-Cooperation Movement & Khilafat Andolan'
where "index" in (410,412,442,443,445,468);

-- 15. Emergence of Swarajists, Socialist Ideas, Revolutionary Activities & Other New Forces
update public.questions set heading = 'Emergence of Swarajists, Socialist Ideas, Revolutionary Activities & Other New Forces'
where "index" in (389,393,405,408,431,434,436,446,463,465,471,476,477);

-- 16. Simon Commission & the Nehru Report
update public.questions set heading = 'Simon Commission & the Nehru Report'
where "index" in (406,414,435);

-- 17. Civil Disobedience Movement & Round Table Conference
update public.questions set heading = 'Civil Disobedience Movement & Round Table Conference'
where "index" in (386,394,403,416,419,420,425,464,466);

-- 18. Debates on the Future Strategy after Civil Disobedience Movement
update public.questions set heading = 'Debates on the Future Strategy after Civil Disobedience Movement'
where "index" in (409,437,438);

-- 19. Nationalist Response in the Wake of World War II
update public.questions set heading = 'Nationalist Response in the Wake of World War II'
where "index" in (407,413,417,421,423,424,472);

-- 20. Quit India Movement, Demand for Pakistan & the INA
update public.questions set heading = 'Quit India Movement, Demand for Pakistan & the INA'
where "index" in (387,388,391,396,397,398,400,415,440,467,470);

-- 21. Independence with Partition
update public.questions set heading = 'Independence with Partition'
where "index" in (392,399,404,426,427,439,447);

commit;
