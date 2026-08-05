const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
require('dotenv').config();

// Credentials are loaded from .env — never hardcode them here
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket }
});

const learningContent = {
  "Chain of Responsibility": {
    intro: "Safety is shared. You are responsible for your own actions, but schedulers, loaders, managers, and customers also play a part.",
    bullets: [
      "Do not accept a job that requires speeding, skipping rest, or driving an unsafe vehicle.",
      "Tell your supervisor straight away if instructions put safety or compliance at risk.",
      "Check that load details, delivery times, and paperwork match the job you were given.",
      "If something feels wrong, stop and ask before continuing."
    ],
    scenario: "Example: A delivery time looks impossible without speeding. The safe response is to raise it early and ask for a lawful plan.",
    videoUrl: "https://www.youtube.com/embed/Jt-R2-YjCQA",
    videoDurationSeconds: 120
  },
  "Fatigue Management": {
    intro: "Fatigue can slow your reactions and judgement even if you think you feel fine.",
    bullets: [
      "Start each shift fit for duty and speak up if you are too tired to drive safely.",
      "Take planned rest breaks and use them properly instead of pushing through.",
      "Watch for warning signs like heavy eyes, missing road signs, or drifting in the lane.",
      "Never rely on caffeine, loud music, or open windows as a safety plan."
    ],
    scenario: "Example: You slept poorly and still have a long run ahead. The safe choice is to report it and manage the task before it becomes dangerous.",
    videoUrl: "https://www.youtube.com/embed/kYmXWj8Yt00",
    videoDurationSeconds: 180
  },
  "Load Restraint Basics": {
    intro: "A safe load stays stable from departure to delivery. If it can move, it can become a serious hazard.",
    bullets: [
      "Check the load is balanced, secured, and suitable for the vehicle before leaving.",
      "Look for damaged straps, loose chains, weak anchor points, or shifting freight.",
      "Recheck the load after the trip starts and any time road or weather conditions change.",
      "Do not move the vehicle until you are satisfied the load is restrained correctly."
    ],
    scenario: "Example: A strap has slack after the first stop. Tighten and recheck before driving on.",
    videoUrl: "https://www.youtube.com/embed/H7Zl9v9vU6U",
    videoDurationSeconds: 150
  },
  "Speed & Compliance": {
    intro: "Delivery pressure never overrides road rules, company rules, or safe driving behaviour.",
    bullets: [
      "Follow posted speed limits and any lower limit that suits weather, traffic, or load conditions.",
      "Keep work and rest records accurate and up to date when required.",
      "Report any instruction that pushes you to break the law or ignore a safety control.",
      "Remember that one unsafe shortcut can affect your licence, employment, and public safety."
    ],
    scenario: "Example: You are running late because of traffic. The right choice is to update the schedule, not make up time on the road.",
    videoUrl: "https://www.youtube.com/embed/4T1M-x7z-0I",
    videoDurationSeconds: 90
  },
  "Vehicle Checks & Defect Reporting": {
    intro: "A safe trip starts before the vehicle moves. Pre-start checks help you find hazards early and report them before they become incidents.",
    bullets: [
      "Complete your pre-start checks before leaving the yard and do not rush them.",
      "Check tyres, lights, mirrors, brakes, couplings, fluid leaks, and safety equipment.",
      "Report defects straight away using the company process, even if someone else used the vehicle before you.",
      "Do not take a vehicle on the road if a defect makes it unsafe or non-compliant."
    ],
    scenario: "Example: You notice a damaged light and an air leak during your check. The safe response is to report it and wait for direction before leaving.",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    videoDurationSeconds: 105
  },
  "Site Safety & Loading Zones": {
    intro: "Many serious incidents happen at depots and customer sites, not on the road. Slow down, follow site rules, and stay alert around people and plant.",
    bullets: [
      "Follow site instructions, speed limits, PPE requirements, and exclusion zones every time.",
      "Watch for forklifts, pedestrians, reversing vehicles, and blind spots before moving.",
      "Use a spotter when required and stop if the area is not clear.",
      "Stay clear of loading equipment until the site team says it is safe to approach."
    ],
    scenario: "Example: A loading area is busy and a forklift is crossing behind your vehicle. The right response is to wait, confirm the area is clear, and then move only when safe.",
    videoUrl: "https://www.youtube.com/embed/jNQXAC9IVRw",
    videoDurationSeconds: 110
  },
  "Incident Reporting & Emergency Response": {
    intro: "If something goes wrong, quick and accurate reporting helps protect people, preserve evidence, and prevent the same issue happening again.",
    bullets: [
      "Report crashes, near misses, injuries, spills, and unsafe conditions as soon as possible.",
      "Call emergency services first if anyone is injured or there is immediate danger.",
      "Use the company reporting process and give clear facts, times, and locations.",
      "Do not guess, hide damage, or leave an incident undocumented."
    ],
    scenario: "Example: A load shifts during unloading but no one is hurt. You still need to stop, make the area safe, and report the incident and hazard.",
    videoUrl: "https://www.youtube.com/embed/tgbNymZ7vqY",
    videoDurationSeconds: 130
  }
};

const quizQuestions = [
  {
    question: "Under Chain of Responsibility, who is responsible for ensuring a driver does not speed to meet a delivery deadline?",
    options: ["Only the driver", "The driver and anyone who influences the schedule", "Only the scheduler", "The local police"],
    correct_answer: 1,
    explanation: "Under CoR, everyone in the supply chain shares the responsibility for safety."
  },
  {
    question: "If you feel fatigued while driving, what is the safest action to take?",
    options: ["Drink coffee and turn up the radio", "Open the windows to get fresh air", "Pull over at a safe location, rest, and notify your supervisor", "Drive faster to finish the trip sooner"],
    correct_answer: 2,
    explanation: "Caffeine and loud music are not substitutes for proper rest. You must stop if fatigued."
  },
  {
    question: "When should you check the restraint of your load?",
    options: ["Only when leaving the depot", "Before leaving, after the first stop, and when conditions change", "At the final destination", "Only if the load is heavy"],
    correct_answer: 1,
    explanation: "Loads can shift during transit. Rechecking is critical to ensure stability."
  },
  {
    question: "What should you do if you notice a vehicle defect during your pre-start check?",
    options: ["Ignore it if it's a short trip", "Fix it yourself with tape", "Report it immediately using the company process", "Tell the next driver about it later"],
    correct_answer: 2,
    explanation: "All defects must be documented and assessed before the vehicle is driven."
  },
  {
    question: "If you are involved in a near-miss incident at a customer site with no injuries, do you still need to report it?",
    options: ["No, because no one was hurt", "Yes, to prevent it from happening again", "Only if the customer complains", "Yes, but only at the end of the week"],
    correct_answer: 1,
    explanation: "Near-miss reporting is vital for identifying hazards before they cause injuries."
  }
];

async function seed() {
  console.log("Cleaning old curriculum...");
  await supabase.from('quiz_questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('learning_sections').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log("Inserting learning modules...");
  const sectionKeys = Object.keys(learningContent);
  for (let i = 0; i < sectionKeys.length; i++) {
    const title = sectionKeys[i];
    const content = learningContent[title];
    const { error } = await supabase.from('learning_sections').insert({
      title,
      format: "video",
      summary: JSON.stringify(content),
      sort_order: i + 1,
      version: '1.0',
      video_url: content.videoUrl,
      video_duration_seconds: content.videoDurationSeconds,
      require_full_watch: true
    });
    if (error) console.error("Error inserting", title, error.message);
  }

  console.log("Inserting quiz questions...");
  for (let i = 0; i < quizQuestions.length; i++) {
    const q = quizQuestions[i];
    const { error } = await supabase.from('quiz_questions').insert({
      question: q.question,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      sort_order: i + 1
    });
    if (error) console.error("Error inserting question", q.question, error.message);
  }
  console.log("Curriculum seeded successfully.");
}

seed().catch(console.error);
