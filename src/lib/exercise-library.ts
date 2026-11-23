/**
 * The built-in exercise library: our own list of ~400 common gym exercises,
 * each with the muscle group it trains, the equipment, and the nicknames
 * people actually say ("RDL", "skull crushers", "pec deck").
 *
 * Written for this project (no outside data). The database gets the same
 * list from migration 0019 (made by scripts/exercise-seed.ts), and the mic
 * uses the nicknames to understand what you said.
 *
 * Format of each line: "Name|nickname|nickname".
 */

export type Muscle = "chest" | "back" | "legs" | "glutes" | "shoulders" | "biceps" | "triceps" | "forearms" | "core" | "cardio" | "full body";
export type Equipment = "barbell" | "dumbbell" | "cable" | "machine" | "bodyweight" | "kettlebell" | "band" | "smith machine" | "ez bar" | "other";

export type LibraryExercise = { name: string; muscle: Muscle; equipment: Equipment; bodyweight: boolean; aliases: string[] };

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: "Chest",
  back: "Back",
  legs: "Legs",
  glutes: "Glutes",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  core: "Abs & core",
  cardio: "Cardio",
  "full body": "Full body",
};

const list: LibraryExercise[] = [];
function add(muscle: Muscle, equipment: Equipment, ...lines: string[]) {
  for (const line of lines) {
    const [name, ...aliases] = line.split("|").map((s) => s.trim());
    // Bodyweight moves don't ask for a weight (but "Weighted pull-ups" do: that's the added weight).
    list.push({ name, muscle, equipment, bodyweight: equipment === "bodyweight" && !/^weighted\b/i.test(name), aliases });
  }
}

// ── Chest ────────────────────────────────────────────────────────────────────
add("chest", "barbell",
  "Bench press|bench|flat bench|barbell bench|barbell bench press|flat bench press",
  "Incline bench press|incline barbell press|incline barbell bench|incline bench",
  "Decline bench press|decline bench|decline barbell press",
  "Close-grip bench press|close grip bench|cgbp",
  "Paused bench press|pause bench|paused bench",
  "Floor press|barbell floor press",
  "Wide-grip bench press|wide grip bench",
  "Spoto press",
  "Larsen press",
  "Pin press",
  "Board press",
  "Reverse-grip bench press|reverse grip bench",
  "Guillotine press|neck press",
);
add("chest", "dumbbell",
  "Dumbbell bench press|db bench|dumbbell bench|flat dumbbell press|dumbbell press",
  "Incline dumbbell press|incline|incline db|incline dumbbell|incline db press|incline dumbbell bench",
  "Decline dumbbell press|decline db press",
  "Dumbbell fly|dumbbell flye|db fly|flat fly|dumbbell flies",
  "Incline dumbbell fly|incline fly|incline flye",
  "Decline dumbbell fly",
  "Dumbbell pullover|pullover|pullovers",
  "Squeeze press|crush press|hex press",
  "Neutral-grip dumbbell press|neutral grip press",
  "Single-arm dumbbell bench press|one arm dumbbell press|single arm bench press",
  "Dumbbell floor press",
  "Low-incline dumbbell press|low incline press",
);
add("chest", "cable",
  "Cable crossover|crossover|crossovers|cable cross|cable crossovers",
  "Cable fly|cable flye|cable flies|standing cable fly",
  "Low-to-high cable fly|low to high fly|low cable fly|upper chest fly",
  "High-to-low cable fly|high to low fly|high cable fly",
  "Single-arm cable fly|one arm cable fly",
  "Cable chest press|standing cable press",
  "Incline cable fly",
);
add("chest", "machine",
  "Chest fly|pec fly|fly|flye|flys|flies|machine fly",
  "Pec deck|pec dec|pec deck fly|butterfly",
  "Machine chest press|chest press|chest press machine|seated chest press",
  "Incline machine press|incline chest press|incline machine",
  "Decline machine press|decline chest press",
  "Hammer Strength chest press|hammer strength press|plate loaded chest press",
  "Hammer Strength incline press|hammer strength incline",
  "Smith machine bench press|smith bench|smith machine bench",
);
add("chest", "smith machine",
  "Smith machine incline press|smith incline|smith incline press",
  "Smith machine decline press|smith decline",
);
add("chest", "bodyweight",
  "Push-ups|pushup|pushups|push up|push ups|press up|press ups",
  "Incline push-ups|incline pushup|incline push up",
  "Decline push-ups|decline pushup|decline push up|feet elevated push up",
  "Diamond push-ups|diamond pushup|diamond push up|close grip push up",
  "Wide push-ups|wide pushup|wide grip push up",
  "Archer push-ups|archer pushup",
  "Clap push-ups|clap pushup|plyo push up|plyometric push up",
  "Knee push-ups|knee pushup|girl push ups",
  "Chest dips|chest dip|weighted chest dips",
  "Deficit push-ups|deficit pushup",
  "Pseudo planche push-ups|planche push up",
  "Ring push-ups|ring pushup",
);
add("chest", "band", "Band chest press", "Band fly");

// ── Back ─────────────────────────────────────────────────────────────────────
add("back", "barbell",
  "Deadlift|deadlifts|dead lift|conventional deadlift|barbell deadlift",
  "Barbell row|row|rows|bent over row|bent-over row|barbell bent over row|bb row",
  "Pendlay row|pendlay",
  "Yates row|underhand row|reverse grip row",
  "T-bar row|t bar row|t-bar|tbar row|landmine row",
  "Meadows row|meadows",
  "Rack pull|rack pulls|block pull",
  "Seal row|chest supported barbell row",
  "Deficit deadlift",
  "Snatch-grip deadlift|snatch grip deadlift",
  "Barbell shrug|shrug|shrugs|barbell shrugs|shoulder shrug|shoulder shrugs",
  "Good morning|good mornings",
  "Barbell pullover",
);
add("back", "dumbbell",
  "Dumbbell row|db row|one arm row|single arm row|one arm dumbbell row|single arm dumbbell row|dumbbell rows",
  "Chest-supported dumbbell row|chest supported row|incline dumbbell row|incline row",
  "Kroc row|kroc rows",
  "Dumbbell shrug|dumbbell shrugs|db shrugs",
  "Renegade row|renegade rows",
  "Dumbbell deadlift|db deadlift",
  "Bent-over dumbbell row|two arm dumbbell row|bent over dumbbell row",
  "Dumbbell seal row",
);
add("back", "cable",
  "Lat pulldown|pulldown|pull down|lat pull|lat pull down|lat pulldowns|lats|lat",
  "Close-grip lat pulldown|close grip pulldown|v bar pulldown|close grip lat pulldown",
  "Wide-grip lat pulldown|wide grip pulldown|wide pulldown",
  "Reverse-grip lat pulldown|underhand pulldown|reverse grip pulldown",
  "Single-arm lat pulldown|one arm pulldown|single arm pulldown",
  "Seated cable row|cable row|seated row|cable rows|seated rows|low row",
  "Wide-grip cable row|wide grip row|wide grip seated row",
  "Single-arm cable row|one arm cable row",
  "Straight-arm pulldown|straight arm pulldown|straight arm pushdown|lat pushdown",
  "Cable pullover|rope pullover",
  "Face pull|face pulls|facepull|facepulls|rope face pull",
  "Cable shrug|cable shrugs",
  "High cable row|high row",
  "Kneeling cable pulldown|kneeling pulldown",
);
add("back", "machine",
  "Machine row|row machine|seated machine row|chest supported machine row",
  "Hammer Strength row|hammer strength high row|iso lateral row|iso row",
  "Hammer Strength low row|low row machine",
  "Assisted pull-ups|assisted pull up|assisted pullup|assisted pullups|pull up machine",
  "Assisted chin-ups|assisted chin up",
  "Machine pulldown|pulldown machine|iso lateral pulldown",
  "Back extension|back extensions|hyperextension|hyperextensions|hypers|45 degree back extension",
  "Reverse hyperextension|reverse hyper|reverse hypers",
  "Smith machine row|smith row",
  "Machine shrug|shrug machine",
);
add("back", "bodyweight",
  "Pull-ups|pullup|pullups|pull up|pull ups|wide grip pull up",
  "Chin-ups|chinup|chinups|chin up|chin ups",
  "Neutral-grip pull-ups|neutral grip pull up|hammer grip pull up",
  "Weighted pull-ups|weighted pull up|weighted pullup",
  "Weighted chin-ups|weighted chin up",
  "Inverted row|inverted rows|bodyweight row|australian pull up",
  "Muscle-ups|muscle up|muscle ups",
  "Superman|supermans|superman hold",
  "Scapular pull-ups|scap pull ups|scap pulls",
  "Dead hang|hang|dead hangs",
);
add("back", "kettlebell", "Kettlebell row|kb row", "Kettlebell deadlift|kb deadlift");
add("back", "band", "Band pull-apart|band pull apart|pull aparts|band pull aparts", "Band lat pulldown", "Band row");

// ── Legs (quads, hamstrings, calves) ─────────────────────────────────────────
add("legs", "barbell",
  "Squat|squats|back squat|back squats|barbell squat|high bar squat",
  "Low-bar squat|low bar squat|low bar",
  "Front squat|front squats",
  "Pause squat|paused squat|pause squats",
  "Box squat|box squats",
  "Zercher squat|zercher",
  "Romanian deadlift|rdl|rdls|romanian dead lift|romanian deadlifts|barbell rdl",
  "Stiff-leg deadlift|stiff leg deadlift|stiff legged deadlift|sldl|stiff leg",
  "Sumo deadlift|sumo|sumo deadlifts",
  "Barbell lunge|barbell lunges",
  "Barbell split squat|barbell bulgarian split squat",
  "Barbell step-up|barbell step up",
  "Barbell calf raise|standing barbell calf raise",
  "Safety bar squat|ssb squat|safety squat bar",
  "Anderson squat|pin squat",
  "Overhead squat|overhead squats",
);
add("legs", "dumbbell",
  "Goblet squat|goblet squats|dumbbell goblet squat",
  "Bulgarian split squat|bulgarian|bulgarians|bss|bulgarian split squats|rear foot elevated split squat",
  "Lunges|lunge|dumbbell lunge|dumbbell lunges",
  "Walking lunges|walking lunge|walking lunges with dumbbells",
  "Reverse lunges|reverse lunge|dumbbell reverse lunge",
  "Lateral lunges|lateral lunge|side lunge|side lunges",
  "Dumbbell step-ups|step ups|step up|step-ups|dumbbell step up",
  "Dumbbell Romanian deadlift|dumbbell rdl|db rdl|dumbbell rdls",
  "Dumbbell squat|db squat",
  "Single-leg Romanian deadlift|single leg rdl|single leg deadlift|one leg rdl",
  "Dumbbell calf raise|dumbbell calf raises",
  "Dumbbell split squat|split squat|split squats",
  "Curtsy lunges|curtsy lunge",
  "Dumbbell sumo squat|sumo squat|plie squat",
);
add("legs", "machine",
  "Leg press|leg presses|leg press machine|sled press",
  "Single-leg leg press|single leg press|one leg press",
  "Hack squat|hack squats|machine hack squat",
  "Reverse hack squat",
  "Pendulum squat|pendulum",
  "Belt squat|belt squats",
  "V-squat|v squat",
  "Leg extension|leg extensions|quad extension|quad extensions|leg ext",
  "Single-leg extension|single leg extension",
  "Leg curl|leg curls|hamstring curl|hamstring curls|ham curls",
  "Lying leg curl|lying leg curls|lying hamstring curl",
  "Seated leg curl|seated leg curls|seated hamstring curl",
  "Standing leg curl|standing hamstring curl|single leg curl",
  "Calf raise|calf raises|calve raise|calves|calf|standing calf raise|calf raise machine",
  "Seated calf raise|seated calf raises|seated calves",
  "Leg press calf raise|calf press|leg press calves",
  "Smith machine squat|smith squat|smith machine squats",
  "Smith machine split squat|smith split squat",
  "Smith machine calf raise|smith calf raise",
  "Donkey calf raise|donkey calves",
  "Tibialis raise|tib raise|tib raises",
);
add("legs", "bodyweight",
  "Bodyweight squat|air squat|air squats|bodyweight squats",
  "Jump squats|jump squat|squat jumps",
  "Pistol squat|pistol squats|pistols",
  "Sissy squat|sissy squats",
  "Nordic curl|nordic curls|nordics|nordic hamstring curl",
  "Wall sit|wall sits",
  "Jumping lunges|jump lunges|lunge jumps",
  "Box jumps|box jump",
  "Broad jumps|broad jump",
  "Single-leg calf raise|single leg calf raise|one leg calf raise",
  "Cossack squat|cossack squats",
  "Step-downs|step down|step downs",
);
add("legs", "kettlebell", "Kettlebell goblet squat|kb goblet squat", "Kettlebell front squat|kb front squat");
add("legs", "cable", "Cable pull-through|pull through|pull throughs|cable pull through");

// ── Glutes ───────────────────────────────────────────────────────────────────
add("glutes", "barbell",
  "Hip thrust|hip thrusts|barbell hip thrust|hip thruster",
  "Glute bridge|glute bridges|barbell glute bridge",
  "Single-leg hip thrust|single leg hip thrust",
);
add("glutes", "machine",
  "Hip thrust machine|machine hip thrust|glute drive",
  "Hip abduction|abduction|abductor|abductors|hip abductor|outer thigh machine",
  "Hip adduction|adduction|adductor|adductors|hip adductor|inner thigh machine",
  "Glute kickback machine|kickback machine|glute machine",
  "Smith machine hip thrust|smith hip thrust",
);
add("glutes", "cable",
  "Cable kickback|cable kickbacks|glute kickback|glute kickbacks|cable glute kickback",
  "Cable hip abduction|cable abduction",
);
add("glutes", "bodyweight",
  "Bodyweight glute bridge|bodyweight bridge|bridges",
  "Single-leg glute bridge|single leg bridge",
  "Donkey kicks|donkey kick",
  "Fire hydrants|fire hydrant",
  "Frog pumps|frog pump",
  "Clamshells|clamshell|clams",
);
add("glutes", "dumbbell", "Dumbbell hip thrust|db hip thrust");
add("glutes", "kettlebell", "Kettlebell swing|kettlebell swings|kb swing|kb swings|swings");
add("glutes", "band", "Banded lateral walk|monster walks|lateral band walk|band walks", "Band hip abduction|banded abduction");

// ── Shoulders ────────────────────────────────────────────────────────────────
add("shoulders", "barbell",
  "Overhead press|ohp|military press|standing press|barbell overhead press|shoulder press barbell|strict press",
  "Seated barbell press|seated overhead press|seated military press",
  "Push press|push presses",
  "Behind-the-neck press|behind the neck press",
  "Barbell upright row|upright row|upright rows",
  "Barbell front raise",
  "Z press",
  "Landmine press|landmine shoulder press",
);
add("shoulders", "dumbbell",
  "Dumbbell shoulder press|shoulder press|db shoulder press|dumbbell press overhead|seated dumbbell press|seated shoulder press",
  "Standing dumbbell press|standing shoulder press",
  "Arnold press|arnold presses|arnolds",
  "Lateral raise|lateral raises|side raise|side raises|lat raise|lat raises|lateral|laterals|side lateral|side laterals|dumbbell lateral raise",
  "Seated lateral raise|seated lateral raises",
  "Leaning lateral raise|lean away lateral",
  "Front raise|front raises|dumbbell front raise",
  "Rear delt fly|rear delt|rear delts|reverse fly|reverse flye|rear fly|bent over reverse fly|rear delt flys",
  "Chest-supported rear delt fly|incline rear delt fly",
  "Dumbbell upright row",
  "Y raise|y raises|incline y raise",
  "Lu raise|lu raises",
  "Cuban press",
  "Single-arm dumbbell press|one arm shoulder press",
);
add("shoulders", "cable",
  "Cable lateral raise|cable lateral|cable laterals|cable side raise",
  "Cable front raise",
  "Cable rear delt fly|cable reverse fly|reverse cable fly",
  "Cable upright row",
  "Cable Y raise",
  "Cable external rotation|external rotation|external rotations",
  "Cable internal rotation|internal rotation",
);
add("shoulders", "machine",
  "Machine shoulder press|shoulder press machine|machine overhead press",
  "Machine lateral raise|lateral raise machine",
  "Reverse pec deck|reverse pec dec|rear delt machine|reverse machine fly",
  "Smith machine shoulder press|smith shoulder press|smith overhead press",
  "Hammer Strength shoulder press",
);
add("shoulders", "bodyweight",
  "Pike push-ups|pike pushup|pike push up",
  "Handstand push-ups|handstand pushup|hspu",
  "Handstand hold|handstand",
  "Wall walks|wall walk",
);
add("shoulders", "band", "Band face pull", "Band lateral raise", "Band external rotation");
add("shoulders", "kettlebell", "Kettlebell press|kb press", "Kettlebell halo|halos|halo");
add("shoulders", "other", "Plate front raise|plate raise|plate raises");

// ── Biceps ───────────────────────────────────────────────────────────────────
add("biceps", "barbell",
  "Barbell curl|barbell curls|bb curl|straight bar curl",
  "Drag curl|drag curls",
  "Reverse barbell curl|reverse curl|reverse curls",
  "Barbell preacher curl",
);
add("biceps", "ez bar",
  "EZ-bar curl|ez bar curl|ez curl|ez bar curls",
  "EZ-bar preacher curl|preacher curl|preacher curls|preachers",
  "Reverse EZ-bar curl|reverse ez curl",
);
add("biceps", "dumbbell",
  "Bicep curl|bicep curls|biceps curl|curl|curls|curled|dumbbell curl|dumbbell curls|db curl",
  "Hammer curl|hammer curls|hammer|hammers|dumbbell hammer curl",
  "Incline dumbbell curl|incline curl|incline curls",
  "Concentration curl|concentration curls",
  "Dumbbell preacher curl|db preacher curl|single arm preacher curl",
  "Spider curl|spider curls",
  "Zottman curl|zottman curls",
  "Alternating dumbbell curl|alternating curls|alternating curl",
  "Cross-body hammer curl|cross body hammer curl|cross body curl",
  "Seated dumbbell curl|seated curl",
);
add("biceps", "cable",
  "Cable curl|cable curls|cable bicep curl",
  "Rope hammer curl|rope curl|rope curls|cable hammer curl",
  "Bayesian curl|bayesian curls|behind the body cable curl",
  "High cable curl|overhead cable curl|double bicep cable curl",
  "Single-arm cable curl|one arm cable curl",
  "Cable preacher curl",
);
add("biceps", "machine", "Machine bicep curl|bicep curl machine|machine curl|machine preacher curl");
add("biceps", "bodyweight", "Chin-up hold|chin up hold");
add("biceps", "band", "Band curl|band curls");

// ── Triceps ──────────────────────────────────────────────────────────────────
add("triceps", "cable",
  "Tricep pushdown|tricep pushdowns|pushdown|pushdowns|push down|push downs|tricep push down|tricep pushdown bar|cable pushdown|straight bar pushdown|v bar pushdown",
  "Rope pushdown|rope pushdowns|rope tricep pushdown|tricep rope pushdown|rope push down",
  "Overhead cable extension|overhead tricep extension cable|cable overhead extension|overhead rope extension|rope overhead extension",
  "Single-arm pushdown|one arm pushdown|single arm tricep pushdown",
  "Reverse-grip pushdown|reverse grip pushdown|underhand pushdown",
  "Cable kickback (triceps)|tricep kickback cable|cable tricep kickback",
  "Cross-body cable extension|cross body extension|katana extension",
);
add("triceps", "ez bar",
  "Skull crushers|skull crusher|skullcrusher|skullcrushers|lying tricep extension|ez bar skull crusher",
  "EZ-bar overhead extension|ez bar overhead extension",
);
add("triceps", "barbell",
  "JM press|jm presses",
  "Barbell skull crushers|barbell skull crusher",
);
add("triceps", "dumbbell",
  "Overhead dumbbell extension|overhead tricep extension|tricep extension|tricep extensions|french press|overhead extension|seated overhead extension",
  "Single-arm overhead extension|one arm overhead extension",
  "Dumbbell kickback|tricep kickback|tricep kickbacks|kickbacks|kickback",
  "Dumbbell skull crushers|dumbbell skull crusher|db skull crushers",
  "Tate press",
  "Close-grip dumbbell press|close grip dumbbell press",
);
add("triceps", "machine",
  "Tricep dip machine|dip machine|seated dip machine|machine dips",
  "Machine tricep extension|tricep extension machine",
  "Assisted dips|assisted dip|assisted dip machine",
);
add("triceps", "bodyweight",
  "Dips|dip|tricep dips|parallel bar dips|weighted dips",
  "Bench dips|bench dip|chair dips",
  "Close-grip push-ups|close grip pushups|tricep push ups",
  "Bodyweight tricep extension|bodyweight skull crusher",
);
add("triceps", "band", "Band pushdown|band tricep pushdown");

// ── Forearms ─────────────────────────────────────────────────────────────────
add("forearms", "barbell", "Wrist curl|wrist curls|barbell wrist curl", "Reverse wrist curl|reverse wrist curls", "Behind-the-back wrist curl");
add("forearms", "dumbbell", "Farmer's walk|farmers walk|farmer walk|farmers carry|farmer's carry", "Dumbbell wrist curl", "Suitcase carry|suitcase carries");
add("forearms", "other", "Plate pinch|plate pinches", "Wrist roller|wrist rollers", "Grip trainer|grippers|grip squeeze", "Towel hang|towel pull ups");

// ── Abs & core ───────────────────────────────────────────────────────────────
add("core", "bodyweight",
  "Plank (seconds)|plank|planks|front plank",
  "Side plank (seconds)|side plank|side planks",
  "Crunches|crunch|sit ups|situp|situps|sit-ups",
  "Bicycle crunches|bicycle crunch|bicycles|bicycle",
  "Reverse crunches|reverse crunch",
  "Hanging leg raise|hanging leg raises|leg raise|leg raises",
  "Hanging knee raise|hanging knee raises|knee raises|knee raise",
  "Captain's chair leg raise|captains chair|captain's chair",
  "Lying leg raise|lying leg raises|floor leg raise",
  "Toes to bar|toes-to-bar|t2b",
  "Mountain climbers|mountain climber",
  "Dead bug|dead bugs|deadbug",
  "Bird dog|bird dogs",
  "Hollow hold|hollow body hold|hollow",
  "V-ups|v up|v ups",
  "Flutter kicks|flutter kick",
  "Russian twists|russian twist",
  "L-sit|l sit|l-sits",
  "Dragon flag|dragon flags",
  "Heel taps|heel touches|heel tap",
  "Toe touches|toe touch",
  "Scissor kicks|scissors",
  "Plank shoulder taps|shoulder taps",
  "Windshield wipers|windshield wiper",
  "Ab wheel rollout|ab wheel|ab rollout|ab roller|rollouts",
  "Stir the pot",
);
add("core", "cable",
  "Cable crunch|cable crunches|kneeling cable crunch|rope crunch",
  "Woodchopper|wood chop|woodchops|cable woodchop|wood chopper",
  "Pallof press|pallof|paloff press",
);
add("core", "machine", "Ab crunch machine|ab machine|crunch machine", "Decline sit-ups|decline situps|decline crunch", "Roman chair side bend");
add("core", "dumbbell", "Dumbbell side bend|side bends|side bend", "Weighted Russian twist|weighted russian twists", "Weighted crunches|weighted crunch");
add("core", "other", "Medicine ball slams|ball slams|med ball slams|slam ball", "Landmine rotation|landmine twist");

// ── Full body / Olympic / conditioning ──────────────────────────────────────
add("full body", "barbell",
  "Power clean|power cleans|clean",
  "Hang clean|hang cleans",
  "Clean and jerk|clean & jerk|clean and jerks",
  "Snatch|snatches|power snatch",
  "Hang snatch",
  "Clean and press|clean & press",
  "Thrusters|thruster|barbell thruster",
);
add("full body", "dumbbell", "Dumbbell thrusters|db thrusters", "Dumbbell snatch|db snatch", "Man makers|man maker", "Devil press");
add("full body", "kettlebell", "Turkish get-up|turkish getup|tgu|get ups", "Kettlebell clean|kb clean", "Kettlebell snatch|kb snatch", "Goblet carry");
add("full body", "bodyweight", "Burpees|burpee", "Bear crawl|bear crawls", "Inchworms|inchworm", "Jumping jacks|jumping jack");
add("full body", "other",
  "Sled push|sled pushes|prowler push|prowler",
  "Sled pull|sled drag",
  "Battle ropes|battle rope|ropes",
  "Tire flips|tire flip",
  "Sandbag carry|sandbag",
  "Yoke carry|yoke",
  "Wall balls|wall ball",
);

// ── Cardio ───────────────────────────────────────────────────────────────────
add("cardio", "machine",
  "Treadmill run|treadmill|treadmill running",
  "Incline treadmill walk|incline walk|12 3 30|treadmill incline walk",
  "Stairmaster|stair master|stair climber|stairs|stair machine",
  "Elliptical|elliptical machine",
  "Stationary bike|bike|exercise bike|spin bike|cycling machine",
  "Assault bike|air bike|airdyne|echo bike",
  "Rowing machine|rower|rowing|erg|row erg",
  "SkiErg|ski erg",
);
add("cardio", "bodyweight",
  "Outdoor run|run|running|jog|jogging",
  "Sprints|sprint|sprinting",
  "Walk|walking|outdoor walk",
  "Hike|hiking",
  "High knees|high knee",
  "Butt kicks",
);
add("cardio", "other",
  "Jump rope|skipping rope|jumping rope",
  "Swimming|swim|laps",
  "Outdoor bike ride|bike ride|biking|cycling",
  "Basketball",
  "Pickleball",
  "Soccer",
);

// ── More (Nov 23): the gaps, so almost anything you do is in the list ────────
add("chest", "other", "Svend press|plate squeeze press|plate press", "Landmine chest press|landmine squeeze press");
add("chest", "machine", "Hammer Strength decline press|decline hammer press");
add("back", "barbell", "Gorilla row|gorilla rows", "Helms row|helms rows", "Jefferson curl|jefferson curls");
add("back", "machine",
  "Chest-supported T-bar row|chest supported t bar row|t bar machine",
  "Single-arm machine row|one arm machine row",
  "Pullover machine|nautilus pullover|machine pullover",
  "Neck curl machine|neck machine|4 way neck",
);
add("back", "cable", "Cable lat pullover|lat prayer|lat prayers", "Single-arm cable pulldown|one arm cable pulldown");
add("back", "bodyweight", "Rack chin-ups|rack chins", "Australian pull-ups|australian pullups", "Neck bridge|neck bridges");
add("back", "other", "Neck curl|neck curls|neck flexion", "Neck extension|neck extensions|neck harness");
add("legs", "smith machine", "Smith machine lunge|smith lunges", "Smith machine Romanian deadlift|smith rdl");
add("legs", "machine", "Leg press (narrow stance)|narrow leg press", "Hip sled calf raise", "Glute-ham raise|ghr|glute ham raise");
add("legs", "dumbbell", "Dumbbell lateral lunge", "Heel-elevated goblet squat|heel elevated squat|cyclist squat");
add("legs", "bodyweight", "Spanish squat|spanish squats", "Skater squat|skater squats", "Shrimp squat|shrimp squats", "Copenhagen plank|copenhagen|copenhagen adductor");
add("glutes", "barbell", "B-stance hip thrust|b stance hip thrust|kickstand hip thrust");
add("glutes", "cable", "Cable glute pull-through|glute pull through", "Cable hip adduction");
add("shoulders", "dumbbell", "Rear delt row|rear delt rows|dumbbell rear delt row", "Bradford press", "Six-way raise|6 way raise|6 way raises");
add("shoulders", "cable", "Cable rear delt row");
add("shoulders", "other", "Landmine lateral raise|landmine raise");
add("biceps", "dumbbell", "Waiter curl|waiter curls|goblet curl", "Incline hammer curl|incline hammer curls", "Preacher hammer curl|hammer preacher curl", "21s|twenty ones|21 curls");
add("biceps", "cable", "Lying cable curl|lying cable curls");
add("triceps", "barbell", "Smith machine close-grip press|smith close grip bench");
add("triceps", "dumbbell", "Rolling dumbbell extension|rolling extension", "Dumbbell floor skull crushers|floor skull crushers");
add("forearms", "cable", "Cable wrist curl|cable wrist curls", "Cable reverse wrist curl");
add("forearms", "other",
  "Finger curls|finger curl",
  "Plate wrist curl",
  "Fat grip hold|fat gripz|fat grips",
  "Radial deviation|wrist side raise",
  "Ulnar deviation",
  "Bottoms-up kettlebell carry|bottoms up carry|bottoms up kettlebell",
  "Hand gripper|hand grippers|gripper",
  "Rice bucket|rice bucket training",
);
add("core", "bodyweight", "Hollow rocks|hollow rock", "Hanging windshield wipers", "Side plank hip dips|hip dips", "Ab rollout (knees)|kneeling rollout");
add("core", "cable", "Cable oblique crunch|oblique crunch", "Cable side bend");
add("full body", "other", "Medicine ball throws|med ball throws|ball throws", "Heavy bag|punching bag|bag work", "Farmer's walk (trap bar)|trap bar carry", "Trap bar deadlift|hex bar deadlift|trap bar|hex bar");
add("cardio", "other",
  "Spin class|spin|cycling class",
  "Stair climb|stairs climb|stadium stairs",
  "Tennis",
  "Volleyball",
  "Football",
  "Baseball",
  "Softball",
  "Hockey",
  "Ice skating|skating",
  "Skiing",
  "Snowboarding",
  "Rock climbing|climbing|bouldering",
  "Yoga",
  "Pilates",
  "Stretching|stretch session|mobility",
  "Boxing|boxing class",
  "Kickboxing",
  "Martial arts|jiu jitsu|bjj|karate|taekwondo|mma",
  "Wrestling",
  "Dance|dancing|zumba",
  "Golf",
  "Frisbee|ultimate frisbee",
  "Kayaking|paddle boarding|paddleboarding",
  "Rucking|ruck",
  "Surfing",
  "Racquetball",
  "Badminton",
  "Track practice",
  "Cross country",
);

// ── Dumbbell versions (Nov 23): a dumbbell option for every lift that has one ──
add("chest", "dumbbell", "Dumbbell squeeze press (incline)|incline squeeze press", "Dumbbell close-grip floor press");
add("back", "dumbbell", "Dumbbell good morning|db good morning", "Dumbbell Pendlay row|db pendlay row", "Dumbbell Yates row", "Dumbbell high pull|db high pull", "Dumbbell straight-arm pullover");
add("legs", "dumbbell",
  "Dumbbell front squat|db front squat",
  "Dumbbell stiff-leg deadlift|db stiff leg deadlift|db sldl",
  "Dumbbell sumo deadlift|db sumo deadlift",
  "Dumbbell box squat",
  "Dumbbell overhead squat",
  "Dumbbell single-leg calf raise|db single leg calf raise",
  "Dumbbell seated calf raise",
  "Dumbbell leg curl|db leg curl|lying dumbbell leg curl",
  "Dumbbell Cossack squat",
  "Dumbbell step-downs",
  "Dumbbell Bulgarian split squat (front foot elevated)|front foot elevated split squat",
);
add("glutes", "dumbbell", "Dumbbell glute bridge|db glute bridge", "Dumbbell single-leg hip thrust", "Dumbbell kickback (glutes)|dumbbell glute kickback");
add("shoulders", "dumbbell", "Dumbbell Z press|db z press", "Dumbbell push press|db push press", "Dumbbell external rotation|db external rotation");
add("biceps", "dumbbell", "Dumbbell drag curl|db drag curl", "Reverse dumbbell curl|reverse db curl|dumbbell reverse curl");
add("triceps", "dumbbell", "Dumbbell JM press|db jm press", "Dumbbell tricep extension (lying)|lying dumbbell extension|lying db extension");
add("forearms", "dumbbell", "Dumbbell reverse wrist curl|db reverse wrist curl", "Dumbbell behind-the-back wrist curl", "Dumbbell wrist rotation|pronation supination|db wrist rotations", "Dumbbell pinch hold|db pinch hold");
add("core", "dumbbell", "Dumbbell windmill|db windmill", "Dumbbell woodchopper|db woodchop", "Dumbbell V-ups|weighted v ups", "Dumbbell dead bug", "Plank dumbbell drag|plank pull through");

/** The whole library, in a stable order (chest, back, legs… cardio). */
export const EXERCISE_LIBRARY: readonly LibraryExercise[] = list;

/** Lowercase, no punctuation: "Close-grip bench press" → "close grip bench press". */
export const plain = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const byName = new Map(list.map((e) => [plain(e.name), e]));

/** The library entry with this name (any capitals/punctuation), if there is one. */
export function libraryEntry(name: string): LibraryExercise | undefined {
  return byName.get(plain(name));
}

/**
 * Search score for the exercise picker: 0 = no match. Every typed word must
 * appear in the name or a nickname; names that start with what you typed win.
 */
export function searchScore(query: string, name: string, aliases: readonly string[] = []): number {
  const q = plain(query);
  if (!q) return 0;
  const words = q.split(" ");
  let best = 0;
  for (const [i, text] of [plain(name), ...aliases.map(plain)].entries()) {
    if (!words.every((w) => text.split(" ").some((t) => t.startsWith(w)) || text.includes(w))) continue;
    let score = 10;
    if (text === q) score = 100;
    else if (text.startsWith(q)) score = 60;
    else if (text.split(" ").some((t) => t.startsWith(words[0]))) score = 30;
    if (i > 0) score -= 5; // a nickname match ranks just below a name match
    best = Math.max(best, score - text.length / 100);
  }
  return best;
}

/**
 * Muscles as a tree, so the picker stays clean: tap a group, then its parts.
 * Ethan's layout (Nov 23):
 *   Arms → Biceps, Triceps, Forearms
 *   Shoulders → Front, Lateral and Rear delts
 *   Legs → Quads, Hamstrings, Calves (glute and hip moves count with hamstrings)
 *   Chest → one group
 *   Core → Upper abs, Lower abs, Obliques
 * plus Back, Full body and Cardio & sports so every exercise has a home.
 */
export type Detail =
  | "biceps" | "triceps" | "forearms"
  | "front delts" | "lateral delts" | "rear delts"
  | "quads" | "hamstrings" | "calves"
  | "chest"
  | "upper abs" | "lower abs" | "obliques"
  | "lats" | "upper back" | "traps" | "lower back"
  | "full body" | "cardio";

export type MuscleGroup = { key: string; label: string; parts: Detail[] };

export const MUSCLE_TREE: readonly MuscleGroup[] = [
  { key: "arms", label: "Arms", parts: ["biceps", "triceps", "forearms"] },
  { key: "shoulders", label: "Shoulders", parts: ["front delts", "lateral delts", "rear delts"] },
  { key: "legs", label: "Legs", parts: ["quads", "hamstrings", "calves"] },
  { key: "chest", label: "Chest", parts: ["chest"] },
  { key: "core", label: "Core", parts: ["upper abs", "lower abs", "obliques"] },
  { key: "back", label: "Back", parts: ["lats", "upper back", "traps", "lower back"] },
  { key: "full body", label: "Full body", parts: ["full body"] },
  { key: "cardio", label: "Cardio & sports", parts: ["cardio"] },
];

export const DETAIL_LABELS: Record<Detail, string> = {
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  "front delts": "Front delts",
  "lateral delts": "Lateral delts",
  "rear delts": "Rear delts",
  quads: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
  chest: "Chest",
  "upper abs": "Upper abs",
  "lower abs": "Lower abs",
  obliques: "Obliques",
  lats: "Lats",
  "upper back": "Upper back",
  traps: "Traps",
  "lower back": "Lower back",
  "full body": "Full body",
  cardio: "Cardio & sports",
};

/**
 * The exact muscle an exercise trains most, from its group and name:
 * "Seated leg curl" → hamstrings, "Lateral raise" → lateral delts.
 * Exercises you made yourself only know their group, so they get its main part.
 */
export function detailOf(name: string, muscle: string): Detail {
  const n = plain(name);
  const has = (re: RegExp) => re.test(n);
  switch (muscle) {
    case "chest":
      return "chest";
    case "back":
      if (has(/\b(shrugs?|neck)\b/)) return "traps";
      if (has(/\b(deadlift|good morning|back extension|hyperextension|hyper|superman|jefferson|rack pull)\b/)) return "lower back";
      if (has(/\b(pulldown|pull ?ups?|chin ?ups?|chins|pullover|lat|muscle ups|dead hang|straight arm)\b/)) return "lats";
      return "upper back";
    case "shoulders":
      if (has(/\b(rear|reverse pec deck|reverse cable|face pull|external rotation|internal rotation|cuban)\b/)) return "rear delts";
      if (has(/\b(lateral|upright|y raise|lu raise|six way|halo)\b/)) return "lateral delts";
      return "front delts";
    case "biceps":
      return "biceps";
    case "triceps":
      return "triceps";
    case "forearms":
      return "forearms";
    case "glutes":
      // Inner thigh (adduction) works with the quads; hip thrusts, bridges,
      // kickbacks and abduction are back-of-the-leg work.
      return n.includes("adduction") ? "quads" : "hamstrings";
    case "legs":
      if (has(/\b(calf|tibialis)\b/)) return "calves";
      if (has(/\b(leg curl|nordic|romanian|rdl|stiff leg|glute ham|pull through|sumo deadlift|good morning)\b/)) return "hamstrings";
      if (has(/\bcurl\b/) && !has(/\bextension\b/)) return "hamstrings";
      return "quads";
    case "core":
      if (has(/\b(oblique|side|twists?|woodchop(per)?|wood chop|windshield|wipers|rotation|pallof|hip dips|stir the pot|bicycle|heel taps)\b/)) return "obliques";
      if (has(/\b(leg raises?|knee raises?|reverse crunch(es)?|toes to bar|flutter|scissor|v ups|dragon flag|l sit|mountain climbers?|hollow|dead bug|captain s chair)\b/)) return "lower abs";
      return "upper abs";
    case "cardio":
      return "cardio";
    default:
      return "full body";
  }
}

/** Which group (Arms, Legs…) a part belongs to. */
export function groupOf(detail: Detail): MuscleGroup {
  return MUSCLE_TREE.find((g) => g.parts.includes(detail)) ?? MUSCLE_TREE[MUSCLE_TREE.length - 2];
}
