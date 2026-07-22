-- Assign question headings by question index for the 483-end batch.
-- Additive: does NOT clear existing headings, so earlier assignments
-- (see update_headings.sql, indices 233-482) are preserved.
-- Run in: Supabase Dashboard → SQL Editor → New query → Run

begin;

-- 1. Advent of the Europeans
update public.questions set heading = 'Advent of the Europeans'
where "index" in (730);

-- 2. India on the Eve of the British Conquest
update public.questions set heading = 'India on the Eve of the British Conquest'
where "index" in (727,728,733);

-- 3. Expansion and Consolidation of British Power in India
update public.questions set heading = 'Expansion and Consolidation of British Power in India'
where "index" in (606,622,623,627,633,634,635,637,644,656,722,723,724,726,732,734,754,777,813,817,819,824,839,863,900,901,928);

-- 4. People's Resistance against the British before 1857
update public.questions set heading = 'People''s Resistance against the British before 1857'
where "index" in (491,505,507,511,519,528,539,544,549,564,598,650,773,842,848,853,864,889,929);

-- 5. The Revolt of 1857
update public.questions set heading = 'The Revolt of 1857'
where "index" in (509,510,516,523,527,531,545,552,565,570,715,737,739,757,759,760,768,769,770,775,825,826,832,834,915,916);

-- 6. Socio-Religious Movements
update public.questions set heading = 'Socio-Religious Movements'
where "index" in (524,556,596,597,599,600,601,602,603,604,605,608,609,610,611,614,615,616,617,619,621,632,642,645,653,654,658,662,667,725,731,756,781,818,835,840,913,914);

-- 7. Reform Movement and their Leaders
update public.questions set heading = 'Reform Movement and their Leaders'
where "index" in (576,607,612,618,624,631,638,643,646,651,652,655,659,660,661,666,668,729,735,742,747,748,788,814,827,881,883,902,917);

-- 8. Beginning of Modern Nationalism
update public.questions set heading = 'Beginning of Modern Nationalism'
where "index" in (522,592,629,636,649,741,743,772,776,798,811,829);

-- 9. Indian National Congress - Foundation and the Moderate Phase
update public.questions set heading = 'Indian National Congress - Foundation and the Moderate Phase'
where "index" in (561,630,657,663,665,669,671,673,674,676,677,681,682,683,686,687,698,699,717,738,746,750,761,771,774,791,801,808,812,820,841,854,855,859,912,920,922,927,931);

-- 10. Era of Militant Nationalism
update public.questions set heading = 'Era of Militant Nationalism'
where "index" in (494,550,554,584,628,675,678,680,685,700,740,745,751,752,762,765,767,778,803,837,838,844,847,850,865,874,905,907,909,932);

-- 11. First Phase of Revolutionary Activities (1907-1917)
update public.questions set heading = 'First Phase of Revolutionary Activities (1907-1917)'
where "index" in (504,580,626,736,744,749,755,758,763,764,766,780,821,858);

-- 12. First World War & Nationalist Response
update public.questions set heading = 'First World War & Nationalist Response'
where "index" in (640,679,688,753,785,796,806,816);

-- 13. Emergence of Gandhi
update public.questions set heading = 'Emergence of Gandhi'
where "index" in (492,506,512,513,526,529,534,535,560,583,588,594,706,786,804,805,815,836,845,880,886,887,892,910,921,926,930);

-- 14. Non-Cooperation Movement & Khilafat Andolan
update public.questions set heading = 'Non-Cooperation Movement & Khilafat Andolan'
where "index" in (489,495,496,498,517,532,533,546,562,582,591,593,620,670,672,689,691,702,793,831,861,918,923);

-- 15. Emergence of Swarajists, Socialist Ideas, Revolutionary Activities & Other New Forces
update public.questions set heading = 'Emergence of Swarajists, Socialist Ideas, Revolutionary Activities & Other New Forces'
where "index" in (508,515,518,520,521,530,537,540,541,548,558,559,563,569,585,586,587,589,590,613,625,639,641,704,709,779,783,784,787,789,792,799,802,807,833,843,849,851,856,860,867,869,876,891,911);

-- 16. Simon Commission & the Nehru Report
update public.questions set heading = 'Simon Commission & the Nehru Report'
where "index" in (567,692,707,710,713,716,719);

-- 17. Civil Disobedience Movement & Round Table Conference
update public.questions set heading = 'Civil Disobedience Movement & Round Table Conference'
where "index" in (483,487,497,499,500,503,514,536,543,547,551,555,566,571,572,574,575,581,684,690,694,703,708,714,718,721,790,862,868,908,919);

-- 18. Debates on the Future Strategy after Civil Disobedience Movement
update public.questions set heading = 'Debates on the Future Strategy after Civil Disobedience Movement'
where "index" in (693,695,696,697,705,782,810,830,852,870,936);

-- 19. Nationalist Response in the Wake of World War II
update public.questions set heading = 'Nationalist Response in the Wake of World War II'
where "index" in (568,578,895);

-- 20. Quit India Movement, Demand for Pakistan & the INA
update public.questions set heading = 'Quit India Movement, Demand for Pakistan & the INA'
where "index" in (484,485,486,488,490,493,501,502,525,542,553,557,573,577,579,595,664,701,711,720,800,857,866,878,879,904,924);

-- 21. Independence with Partition
update public.questions set heading = 'Independence with Partition'
where "index" in (712,794,795,797,809,828,846,871,875,877,890,906,925,934,935,937);

commit;
