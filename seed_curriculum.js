const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket }
});

const learningContent = {
  "Chain of Responsibility & HVNL Primary Duty": {
    intro: "Under Heavy Vehicle National Law (HVNL) Section 26C, safety is a shared primary duty across the entire transport supply chain.",
    bullets: [
      "HVNL Primary Duty (s26C) mandates that operators, schedulers, loaders, and drivers must eliminate or minimize safety risks so far as is reasonably practicable.",
      "Drivers have a legal right and obligation to decline instructions that require speeding, skipping rest breaks, or driving an overloaded or unroadworthy vehicle.",
      "Schedulers and consignors share legal liability if delivery windows force drivers to exceed legal work hours or speed limits.",
      "Document and report any pressure to compromise safety immediately to your company compliance officer or the NHVR Confidential Reporting Line."
    ],
    scenario: "Example: A dispatcher asks you to complete a 700km trip in 7 hours without rest. Under HVNL CoR, you must refuse the schedule, report the breach, and request a compliant trip plan.",
    videoUrl: "https://www.youtube.com/embed/9VnOQLO8KLQ",
    videoDurationSeconds: 150
  },
  "Fatigue Management & Work Diary Rules": {
    intro: "Fatigue is one of the leading causes of heavy vehicle incidents. Compliance with HVNL work and rest limits is strictly enforced.",
    bullets: [
      "Standard Fatigue Management rules cap solo driving to a maximum of 12 hours work in any 24-hour period, with a mandatory 15-minute rest break every 5.25 hours.",
      "Fatigue hours must match the operator's approved fatigue arrangement. From 1 August 2026, new arrangements are managed through Heavy Vehicle Accreditation (HVA); legacy BFM/AFM arrangements may continue only under their transitional conditions.",
      "Work Diaries (Written or Electronic Work Diaries - EWD) must be filled in accurately before commencing or completing work and carried in the heavy vehicle cabin.",
      "Never rely on caffeine, energy drinks, or open windows as a fatigue strategy. If you experience heavy eyelids, slow reaction times, or lane drifting, pull over safely and rest."
    ],
    scenario: "Example: You feel drowsy after 4 hours of night driving. Under NHVR rules, pull into a safe rest area immediately, log the break in your EWD, and sleep before continuing.",
    videoUrl: "https://www.youtube.com/embed/7jZtJMxJR9k",
    videoDurationSeconds: 180
  },
  "Load Restraint Guide 2018 Performance Standards": {
    intro: "All heavy vehicle loads must comply with the NHVR Load Restraint Guide 2018 engineering performance standards to prevent freight shifting or shedding.",
    bullets: [
      "Forward Restraint: Must withstand 0.8g (80% of the load weight) forward deceleration during emergency braking.",
      "Rearward & Sideways (Lateral) Restraint: Must withstand 0.5g (50% of the load weight) acceleration during turns and acceleration.",
      "Upward Restraint: Must withstand 0.2g (20% of the load weight) vertical acceleration over bumps and rough roads.",
      "Inspect straps, chains, turnbuckles, dunnage, and lashings for wear, cuts, or strain. Recheck load security after the first 50km and following any emergency maneuver."
    ],
    scenario: "Example: Securing a 10-tonne steel coil requires tie-down or direct lashings rated to withstand at least 8 tonnes of forward force (0.8g) and 5 tonnes of lateral force (0.5g).",
    videoUrl: "https://www.youtube.com/embed/rMjHN7SBqvU",
    videoDurationSeconds: 160
  },
  "Mass, Dimension & Height Limits": {
    intro: "Operating within legal mass, axle loading, and dimensional boundaries protects road infrastructure and heavy vehicle rollover thresholds.",
    bullets: [
      "General Mass Limits (GML) define standard legal gross and axle mass limits. Concessional Mass Limits (CML) and Higher Mass Limits (HML) require NHVAS accreditation.",
      "Standard legal vehicle height limit is 4.3 metres (or 4.6 metres for high-cube trailers under specific NHVR notices or route permits).",
      "Drivers must confirm bridge height clearances and route permits before departing with high or over-dimensional loads.",
      "Axle weight distribution is as critical as gross weight. Uneven lateral loading severely reduces vehicle rollover thresholds."
    ],
    scenario: "Example: Approaching an overpass marked at 4.2m with a 4.3m trailer. Stop prior to the bridge, verify clearance, and use designated heavy vehicle bypass routes.",
    videoUrl: "https://www.youtube.com/embed/P8dJKrJSPNY",
    videoDurationSeconds: 140
  },
  "Vehicle Checks & Defect Reporting (Major vs Minor)": {
    intro: "A mandatory visual daily pre-start check must be completed before any heavy vehicle enters a public road.",
    bullets: [
      "Inspect tyres (tread depth, inflation, damage), brakes (air pressure build-up, leak rate), steering play, couplings, lights, mirrors, and emergency gear.",
      "Major Defects: Critical safety hazards (e.g. brake air leaks, cracked rims, steering play, fluid leaks). Imposes immediate Tag-Out & Grounding — vehicle MUST NOT be driven.",
      "Minor Defects: Non-critical items (e.g. secondary mirror glass crack, minor cosmetic body damage). Must be logged in defect book and scheduled for prompt repair.",
      "Always verify that the previous shift's defect reports have been signed off by a qualified mechanic prior to departure."
    ],
    scenario: "Example: You hear an audible air leak near the trailer brake booster during your pre-start check. This is a Major Defect: tag out the vehicle key, notify maintenance, and do not drive.",
    videoUrl: "https://www.youtube.com/embed/rg1t87nZdL8",
    videoDurationSeconds: 150
  },
  "Speed Limiters & Heavy Vehicle Road Rules": {
    intro: "Heavy vehicle speed compliance is legally mandated to protect all road users.",
    bullets: [
      "Under Australian Heavy Vehicle Standards, all heavy vehicles with a GVM over 12 tonnes must be fitted with a speed limiter set to a maximum of 100 km/h.",
      "Tampering with speed limiters is a severe criminal offense under HVNL resulting in massive penalties and accreditation cancellation.",
      "Adhere to posted heavy vehicle speed limits, truck lane restrictions, and steep descent gear selection requirements (e.g., Use Low Gear signs).",
      "Schedule pressure is never a legal defense for speeding. Traffic delays must be managed through control room notification."
    ],
    scenario: "Example: Descending a steep grade marked with 'Trucks Must Use Low Gear'. Select low gear before starting downhill to utilize engine braking and prevent brake fade.",
    videoUrl: "https://www.youtube.com/embed/pquJFjTSaGI",
    videoDurationSeconds: 120
  },
  "Site Safety, Exclusion Zones & PPE": {
    intro: "Depots and loading docks present high-risk interaction zones between heavy machinery, forklifts, freight, and personnel.",
    bullets: [
      "Mandatory PPE: High-visibility clothing (Class D/N), steel-cap safety boots, safety glasses, and hard hats in designated site areas.",
      "Maintain strict exclusion zones (minimum 3 metres) around operating forklifts, gantry cranes, and loading equipment.",
      "Maintain Three Points of Contact (two hands one foot, or two feet one hand) whenever mounting or dismounting the cab, trailer ladder, or catwalk.",
      "Always perform a 360-degree walk-around or use a spotter before reversing heavy vehicle combinations in loading yards."
    ],
    scenario: "Example: Dismounting your truck cab. Face the vehicle and keep three points of contact on handrails and steps. Never jump out of the cabin.",
    videoUrl: "https://www.youtube.com/embed/yqY7jGFaLsY",
    videoDurationSeconds: 130
  },
  "Incident Reporting & Safety Management System (SMS)": {
    intro: "The NHVR SMS framework ensures operators and drivers continuously identify hazards, report incidents, and implement safety controls.",
    bullets: [
      "Report all crashes, rollover events, load shedding, near-misses, injuries, and environmental spills immediately to your company safety officer.",
      "In the event of a highway crash: stop safely, secure the scene with warning triangles placed 50-150m behind, call 000 emergency services, and render assistance if safe.",
      "Near-miss reporting is vital for proactive hazard elimination before an injury or fatal incident occurs.",
      "Keep a copy of the company Safety Policy and NHVR Driver Induction Confirmation in your vehicle cabin at all times."
    ],
    scenario: "Example: A strap snaps on a highway and freight shifts slightly without falling. Stop in a safe breakdown bay, apply emergency hazard lights, deploy warning triangles, rectify the load, and submit a near-miss report.",
    videoUrl: "https://www.youtube.com/embed/V4fxfDDgBYw",
    videoDurationSeconds: 140
  }
};

const quizQuestions = [
  {
    question: "Under Heavy Vehicle National Law (HVNL) Section 26C Chain of Responsibility (CoR), who shares legal responsibility for ensuring heavy vehicle safety?",
    options: ["Only the driver", "The driver, scheduler, loader, operator, consignor, and consignee", "Only the transport operator management", "Only state police and transport inspectors"],
    correct_answer: 1,
    explanation: "Under HVNL CoR primary duty, everyone in the supply chain who influences transport activities shares legal responsibility for safety."
  },
  {
    question: "Under the NHVR Load Restraint Guide 2018, what forward deceleration force must a heavy vehicle load restraint system withstand?",
    options: ["0.2g (20% of load weight)", "0.5g (50% of load weight)", "0.8g (80% of load weight)", "1.0g (100% of load weight)"],
    correct_answer: 2,
    explanation: "Load restraint systems must withstand 0.8g (80% of weight) forward force, 0.5g sideways/rearward, and 0.2g upward force."
  },
  {
    question: "Under Standard Fatigue Management rules for a solo heavy vehicle driver, what is the maximum allowed driving/work time in a 24-hour period?",
    options: ["10 hours", "12 hours", "14 hours", "16 hours"],
    correct_answer: 1,
    explanation: "Under Standard Fatigue Management, a solo driver must not work or drive for more than 12 hours in any 24-hour period."
  },
  {
    question: "What action is mandatory if a driver discovers an active air brake leak (Major Defect) during a daily pre-start check?",
    options: ["Drive slowly to the nearest customer", "Tag out the vehicle key, record the defect, and do not drive until repaired", "Inflate the air tanks and start the trip", "Inform the receiver to inspect the brakes on arrival"],
    correct_answer: 1,
    explanation: "Major defects like brake air leaks compromise vehicle roadworthiness. The vehicle must be tagged out and grounded immediately."
  },
  {
    question: "Under Australian Heavy Vehicle Standards, all heavy vehicles with a GVM greater than 12 tonnes must be fitted with a speed limiter set to what maximum speed?",
    options: ["90 km/h", "100 km/h", "110 km/h", "115 km/h"],
    correct_answer: 1,
    explanation: "Heavy vehicles over 12t GVM must have an operational speed limiter set to a maximum speed of 100 km/h."
  },
  {
    question: "What is the standard legal height clearance limit for heavy vehicle combinations in Australia without a special high-cube permit or notice?",
    options: ["4.0 metres", "4.3 metres", "4.6 metres", "5.0 metres"],
    correct_answer: 1,
    explanation: "The standard legal heavy vehicle height limit is 4.3 metres unless operating under specific 4.6m high-cube permits or notices."
  },
  {
    question: "When mounting or dismounting a heavy vehicle cab or trailer catwalk, what safety rule must drivers strictly observe?",
    options: ["Jump clear of the bottom step", "Maintain Three Points of Contact at all times", "Carry tools in both hands while climbing", "Mount quickly without using handrails"],
    correct_answer: 1,
    explanation: "Three points of contact (two hands one foot or two feet one hand) prevents slip and fall injuries when entering or exiting heavy vehicles."
  },
  {
    question: "What document must drivers carry in the cabin when operating under a Heavy Vehicle Accreditation Scheme (NHVAS / HVA)?",
    options: ["A copy of the Operator Accreditation Certificate and Driver Induction Confirmation", "Personal passport only", "Vehicle sales invoice", "No documentation is required"],
    correct_answer: 0,
    explanation: "Accredited heavy vehicle operators must ensure drivers carry a copy of the accreditation certificate and proof of driver induction."
  },
  {
    question: "Why is near-miss reporting an essential component of a company's NHVR Safety Management System (SMS)?",
    options: ["To penalize workers", "To identify hazards and implement safety controls before an injury or incident occurs", "To increase paperwork for management", "Only for insurance premium discounts"],
    correct_answer: 1,
    explanation: "Near-miss reporting helps identify and eliminate hazards proactively before they lead to serious crashes or injuries."
  },
  {
    question: "If a dispatcher instructs a driver to exceed work hours to meet an urgent delivery, what does HVNL Chain of Responsibility require the driver to do?",
    options: ["Obey the dispatcher and drive faster", "Refuse the unlawful instruction, notify compliance, and request a legal schedule", "Complete the trip and keep it secret", "Resign immediately on the spot"],
    correct_answer: 1,
    explanation: "Under HVNL CoR, drivers must refuse instructions that breach safety or work hour laws and demand a compliant schedule."
  }
];

async function hasColumn(table, column) {
  // Detect if a column exists by trying a minimal select
  const { error } = await supabase.from(table).select(column).limit(1);
  return !error || !error.message.includes(`column ${table}.${column} does not exist`);
}

async function seed() {
    console.log('Seeding internal heavy-vehicle induction curriculum to Supabase...');

  try {
    await supabase.from('quiz_questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('learning_sections').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Detect which columns exist in the live DB
    const hasVideoDuration = await hasColumn('learning_sections', 'video_duration_seconds');
    const hasRequireFullWatch = await hasColumn('learning_sections', 'require_full_watch');
    const hasVersion = await hasColumn('learning_sections', 'version');

    if (!hasVideoDuration || !hasRequireFullWatch || !hasVersion) {
      console.warn('⚠️  Missing columns detected. Run the migration first:');
      console.warn('   node run_migration.cjs');
      console.warn('   or paste supabase/migrations/001_add_missing_columns.sql into Supabase SQL Editor\n');
    }

    console.log('Inserting 8 NHVR learning modules...');
    const sectionKeys = Object.keys(learningContent);
    for (let i = 0; i < sectionKeys.length; i++) {
      const title = sectionKeys[i];
      const content = learningContent[title];

      const row = {
        title,
        format: 'video',
        summary: JSON.stringify(content),
        sort_order: i + 1,
        video_url: content.videoUrl,
      };
      if (hasVersion)          row.version = '2.0-NHVR';
      if (hasVideoDuration)    row.video_duration_seconds = content.videoDurationSeconds;
      if (hasRequireFullWatch) row.require_full_watch = true;

      const { error } = await supabase.from('learning_sections').insert(row);
      if (error) console.error('Error inserting module:', title, error.message);
      else console.log(`  ✅ ${title}`);
    }

    console.log('\nInserting 10 NHVR quiz questions...');
    for (let i = 0; i < quizQuestions.length; i++) {
      const q = quizQuestions[i];
      const { error } = await supabase.from('quiz_questions').insert({
        question: q.question,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        sort_order: i + 1
      });
      if (error) console.error('Error inserting question:', q.question.slice(0, 60), error.message);
      else console.log(`  ✅ Q${i + 1}: ${q.question.slice(0, 60)}...`);
    }
    console.log('\n✅ Driver induction curriculum and quiz question bank seeded successfully.');
  } catch (err) {
    console.error('Seeding error:', err.message);
  }
}

seed().catch(console.error);
