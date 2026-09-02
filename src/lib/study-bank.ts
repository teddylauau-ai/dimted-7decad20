/**
 * Dimted Revision — non-AI study content aligned to the Australian Curriculum
 * Year 9 (v9.0). Everything here is a fixed, offline question bank: no model
 * call, no network, works even if the AI gateway is down or blocked.
 */

export type Question = {
  q: string;
  options: string[];
  /** Index into options. */
  answer: number;
  /** Shown after answering — this is the teaching bit. */
  why: string;
};

export type Deck = {
  id: string;
  subject: "Maths" | "Science" | "English" | "History" | "Geography";
  name: string;
  blurb: string;
  /** Curriculum-style code shown as a chip. */
  strand: string;
  questions: Question[];
};

export const DECKS: Deck[] = [
  // ---------------------------------------------------------------- MATHS
  {
    id: "maths-indices",
    subject: "Maths",
    name: "Index Laws & Scientific Notation",
    blurb: "Multiply, divide and power up indices, then shift into standard form.",
    strand: "Number · AC9M9N01",
    questions: [
      {
        q: "Simplify 3⁴ × 3⁵",
        options: ["3⁹", "3²⁰", "9⁹", "6⁹"],
        answer: 0,
        why: "Same base multiplied → add the indices: 4 + 5 = 9, so 3⁹.",
      },
      {
        q: "Simplify (2x³)⁴",
        options: ["2x¹²", "8x⁷", "16x¹²", "16x⁷"],
        answer: 2,
        why: "Raise every factor: 2⁴ = 16 and (x³)⁴ = x¹². So 16x¹².",
      },
      {
        q: "What is 5⁰ + 7⁰?",
        options: ["0", "1", "2", "12"],
        answer: 2,
        why: "Anything (non-zero) to the power 0 equals 1, so 1 + 1 = 2.",
      },
      {
        q: "Write 0.00042 in scientific notation",
        options: ["4.2 × 10⁻⁴", "42 × 10⁻⁵", "4.2 × 10⁴", "0.42 × 10⁻³"],
        answer: 0,
        why: "Move the point 4 places right to get 4.2, so the power is −4.",
      },
      {
        q: "Simplify x⁸ ÷ x³",
        options: ["x⁵", "x¹¹", "x²⁴", "1/x⁵"],
        answer: 0,
        why: "Dividing same bases subtracts indices: 8 − 3 = 5.",
      },
      {
        q: "Express 2⁻³ as a fraction",
        options: ["−8", "1/6", "1/8", "−1/8"],
        answer: 2,
        why: "A negative index means reciprocal: 2⁻³ = 1/2³ = 1/8.",
      },
    ],
  },
  {
    id: "maths-linear",
    subject: "Maths",
    name: "Linear Relationships",
    blurb: "Gradient, intercepts, y = mx + c and solving straight-line problems.",
    strand: "Algebra · AC9M9A02",
    questions: [
      {
        q: "What is the gradient of the line through (1, 2) and (5, 10)?",
        options: ["2", "4", "1/2", "8"],
        answer: 0,
        why: "m = rise/run = (10 − 2)/(5 − 1) = 8/4 = 2.",
      },
      {
        q: "In y = −3x + 7, what is the y-intercept?",
        options: ["−3", "3", "7", "−7"],
        answer: 2,
        why: "In y = mx + c, c is the y-intercept, so 7.",
      },
      {
        q: "Solve 4(x − 3) = 20",
        options: ["x = 2", "x = 5", "x = 8", "x = 23"],
        answer: 2,
        why: "Divide by 4: x − 3 = 5, so x = 8.",
      },
      {
        q: "Which line is parallel to y = 2x − 1?",
        options: ["y = −2x − 1", "y = 2x + 6", "y = x/2 − 1", "y = −x/2 + 1"],
        answer: 1,
        why: "Parallel lines share the same gradient (m = 2).",
      },
      {
        q: "Where does 2x + 3y = 12 cross the x-axis?",
        options: ["(0, 4)", "(6, 0)", "(4, 0)", "(0, 6)"],
        answer: 1,
        why: "Set y = 0: 2x = 12, so x = 6 → point (6, 0).",
      },
      {
        q: "A taxi charges $4 flagfall plus $2/km. Which rule fits?",
        options: ["C = 2 + 4d", "C = 4 + 2d", "C = 8d", "C = 4d + 2d"],
        answer: 1,
        why: "Flagfall is the constant (c = 4); the rate per km is the gradient (m = 2).",
      },
    ],
  },
  {
    id: "maths-pythagoras",
    subject: "Maths",
    name: "Pythagoras & Trigonometry",
    blurb: "Right-angled triangles: find sides with a² + b² = c², angles with SOH CAH TOA.",
    strand: "Measurement · AC9M9M03",
    questions: [
      {
        q: "A right triangle has legs 6 cm and 8 cm. Hypotenuse?",
        options: ["10 cm", "12 cm", "14 cm", "√14 cm"],
        answer: 0,
        why: "6² + 8² = 36 + 64 = 100, and √100 = 10 cm.",
      },
      {
        q: "Which ratio uses the opposite side and the hypotenuse?",
        options: ["cos", "tan", "sin", "cot"],
        answer: 2,
        why: "SOH: sin θ = opposite ÷ hypotenuse.",
      },
      {
        q: "Hypotenuse 13 m, one leg 5 m. Other leg?",
        options: ["8 m", "12 m", "18 m", "√194 m"],
        answer: 1,
        why: "13² − 5² = 169 − 25 = 144, √144 = 12 m.",
      },
      {
        q: "To find an angle when you know opposite and adjacent, use…",
        options: ["sin⁻¹", "cos⁻¹", "tan⁻¹", "Pythagoras"],
        answer: 2,
        why: "TOA: tan θ = opp/adj, so θ = tan⁻¹(opp/adj).",
      },
      {
        q: "A 5 m ladder leans with its base 3 m from a wall. Height reached?",
        options: ["4 m", "5.8 m", "2 m", "3.5 m"],
        answer: 0,
        why: "5² − 3² = 25 − 9 = 16, √16 = 4 m.",
      },
    ],
  },
  {
    id: "maths-stats",
    subject: "Maths",
    name: "Statistics & Probability",
    blurb: "Mean, median, spread, and two-step probability.",
    strand: "Statistics · AC9M9ST01",
    questions: [
      {
        q: "Median of 3, 7, 9, 12, 15, 21?",
        options: ["9", "10.5", "11", "12"],
        answer: 1,
        why: "Six values → average the middle two: (9 + 12)/2 = 10.5.",
      },
      {
        q: "Which measure is most affected by one extreme outlier?",
        options: ["Median", "Mode", "Mean", "Range of the middle 50%"],
        answer: 2,
        why: "The mean uses every value, so one huge number drags it.",
      },
      {
        q: "Two fair coins are tossed. P(exactly one head)?",
        options: ["1/4", "1/2", "1/3", "3/4"],
        answer: 1,
        why: "Outcomes HH, HT, TH, TT — two of four have exactly one head = 1/2.",
      },
      {
        q: "Interquartile range measures…",
        options: [
          "the highest minus lowest value",
          "the spread of the middle 50% of data",
          "the most common value",
          "the average distance from the mean",
        ],
        answer: 1,
        why: "IQR = Q3 − Q1, so it describes the middle half and ignores outliers.",
      },
      {
        q: "A bag has 4 red, 6 blue. Drawing 2 without replacement, P(both red)?",
        options: ["4/25", "2/15", "1/5", "6/45"],
        answer: 1,
        why: "4/10 × 3/9 = 12/90 = 2/15 (the second draw has one fewer red and one fewer ball).",
      },
    ],
  },

  // -------------------------------------------------------------- SCIENCE
  {
    id: "sci-reactions",
    subject: "Science",
    name: "Chemical Reactions",
    blurb: "Reaction types, conservation of mass and balancing equations.",
    strand: "Chemical sciences · AC9S9U06",
    questions: [
      {
        q: "In a balanced equation, what is always conserved?",
        options: ["Volume", "Number of molecules", "Mass and atoms of each element", "Temperature"],
        answer: 2,
        why: "Atoms are rearranged, never created or destroyed — so mass is conserved.",
      },
      {
        q: "Mg + O₂ → MgO. Correct balance?",
        options: ["2Mg + O₂ → 2MgO", "Mg + 2O₂ → MgO", "Mg + O₂ → MgO₂", "2Mg + 2O₂ → 2MgO"],
        answer: 0,
        why: "O₂ supplies two oxygens, so you need two Mg and two MgO.",
      },
      {
        q: "Acid + metal carbonate produces…",
        options: [
          "salt + water only",
          "salt + water + carbon dioxide",
          "hydrogen only",
          "a metal oxide",
        ],
        answer: 1,
        why: "That's why limestone fizzes in acid — CO₂ gas is released.",
      },
      {
        q: "A reaction that releases heat is called…",
        options: ["Endothermic", "Exothermic", "Catalytic", "Neutral"],
        answer: 1,
        why: "Exo = out. Combustion and respiration both release energy.",
      },
      {
        q: "Which will speed up a reaction rate?",
        options: [
          "Cooling the mixture",
          "Using larger lumps of solid",
          "Increasing surface area of a solid",
          "Diluting the acid",
        ],
        answer: 2,
        why: "More surface area = more successful collisions per second.",
      },
      {
        q: "What does a catalyst do?",
        options: [
          "Gets used up producing product",
          "Lowers activation energy without being consumed",
          "Raises the temperature permanently",
          "Changes the products formed",
        ],
        answer: 1,
        why: "It offers an easier pathway and is recovered unchanged.",
      },
    ],
  },
  {
    id: "sci-plate-tectonics",
    subject: "Science",
    name: "Plate Tectonics & Earth Systems",
    blurb: "Plate boundaries, evidence for drift, and Australia's geology.",
    strand: "Earth & space · AC9S9U03",
    questions: [
      {
        q: "Which boundary forms mid-ocean ridges?",
        options: ["Convergent", "Divergent", "Transform", "Subduction"],
        answer: 1,
        why: "Plates pull apart and magma rises to create new sea floor.",
      },
      {
        q: "What drives plate movement?",
        options: [
          "Earth's rotation",
          "Convection in the mantle",
          "Tidal pull of the Moon",
          "Ocean currents",
        ],
        answer: 1,
        why: "Hot mantle rock rises, cools and sinks, dragging plates along.",
      },
      {
        q: "Why does Australia have very few earthquakes and volcanoes?",
        options: [
          "It sits near the middle of the Indo-Australian plate",
          "It has no mantle beneath it",
          "It is too flat",
          "It is surrounded by transform faults",
        ],
        answer: 0,
        why: "Most seismic activity happens at plate edges, not plate interiors.",
      },
      {
        q: "Matching fossils on separate continents is evidence for…",
        options: ["Sea-floor magnetism", "Continental drift", "Glaciation only", "Erosion rates"],
        answer: 1,
        why: "Identical species split by ocean means the landmasses were once joined.",
      },
      {
        q: "A deep ocean trench forms where…",
        options: [
          "two plates slide past each other",
          "one plate subducts beneath another",
          "plates move apart",
          "a hotspot erupts",
        ],
        answer: 1,
        why: "The denser plate dives down, carving a trench and feeding volcanoes.",
      },
    ],
  },
  {
    id: "sci-body-systems",
    subject: "Science",
    name: "Body Systems & Homeostasis",
    blurb: "How systems interact to keep internal conditions stable.",
    strand: "Biological sciences · AC9S9U01",
    questions: [
      {
        q: "Homeostasis means…",
        options: [
          "growth of new cells",
          "maintaining a stable internal environment",
          "breaking down food",
          "producing offspring",
        ],
        answer: 1,
        why: "Feedback loops hold temperature, glucose and water within safe ranges.",
      },
      {
        q: "Which hormone lowers blood glucose?",
        options: ["Glucagon", "Adrenaline", "Insulin", "Thyroxine"],
        answer: 2,
        why: "Insulin from the pancreas moves glucose into cells for storage.",
      },
      {
        q: "Sweating cools you because…",
        options: [
          "sweat is cold when produced",
          "evaporation removes heat energy from skin",
          "it reduces blood volume",
          "it blocks heat entering pores",
        ],
        answer: 1,
        why: "Changing liquid to vapour absorbs latent heat from your body.",
      },
      {
        q: "Negative feedback works by…",
        options: [
          "amplifying the original change",
          "reversing a change to return to set point",
          "ignoring the stimulus",
          "shutting down the system",
        ],
        answer: 1,
        why: "Detector → control centre → effector pushes the value back toward normal.",
      },
      {
        q: "Which pair of systems delivers oxygen to working muscle?",
        options: [
          "Digestive and excretory",
          "Respiratory and circulatory",
          "Nervous and skeletal",
          "Endocrine and lymphatic",
        ],
        answer: 1,
        why: "Lungs load oxygen onto blood; the heart pumps it to the muscle.",
      },
    ],
  },
  {
    id: "sci-energy",
    subject: "Science",
    name: "Energy Transfer & Conservation",
    blurb: "Energy forms, efficiency and heat transfer.",
    strand: "Physical sciences · AC9S9U05",
    questions: [
      {
        q: "The law of conservation of energy says energy is…",
        options: ["created by engines", "destroyed by friction", "transferred or transformed, never lost", "only stored as heat"],
        answer: 2,
        why: "Total energy stays constant; 'wasted' energy usually becomes heat and sound.",
      },
      {
        q: "Heat moving through a metal spoon is…",
        options: ["Convection", "Conduction", "Radiation", "Evaporation"],
        answer: 1,
        why: "Vibrating particles pass energy along by direct contact.",
      },
      {
        q: "A globe uses 100 J and gives 15 J of light. Efficiency?",
        options: ["15%", "85%", "1.5%", "115%"],
        answer: 0,
        why: "Efficiency = useful ÷ total × 100 = 15/100 = 15%.",
      },
      {
        q: "Energy from the Sun reaches Earth by…",
        options: ["Conduction", "Convection", "Radiation", "Compression"],
        answer: 2,
        why: "Space is a vacuum, so only electromagnetic radiation can cross it.",
      },
      {
        q: "A stretched rubber band stores…",
        options: ["Kinetic energy", "Elastic potential energy", "Nuclear energy", "Thermal energy only"],
        answer: 1,
        why: "Work done stretching it is stored as elastic potential energy.",
      },
    ],
  },

  // -------------------------------------------------------------- ENGLISH
  {
    id: "eng-persuasive",
    subject: "English",
    name: "Persuasive Techniques",
    blurb: "Name the device, explain the effect — the core of Year 9 analysis.",
    strand: "Language · AC9E9LA03",
    questions: [
      {
        q: "\"Our streets are drowning in rubbish.\" Which technique?",
        options: ["Simile", "Hyperbole", "Alliteration", "Rhetorical question"],
        answer: 1,
        why: "Deliberate exaggeration to make the problem feel urgent.",
      },
      {
        q: "\"Every parent knows a child deserves better.\" This mainly appeals to…",
        options: ["Logic (logos)", "Emotion and family values (pathos)", "Statistics", "Authority"],
        answer: 1,
        why: "It targets the reader's feelings and shared values, not evidence.",
      },
      {
        q: "Inclusive language ('we', 'our') works because it…",
        options: [
          "sounds more formal",
          "positions the reader as part of the writer's group",
          "provides evidence",
          "avoids bias",
        ],
        answer: 1,
        why: "Shared pronouns make disagreeing feel like leaving the group.",
      },
      {
        q: "Best example of an expert-authority appeal?",
        options: [
          "\"Surely nobody wants that.\"",
          "\"Doctors at the RCH report a 30% rise in cases.\"",
          "\"It's a disaster.\"",
          "\"Imagine the silence.\"",
        ],
        answer: 1,
        why: "A credible institution plus data borrows their credibility.",
      },
      {
        q: "In analysis, the strongest sentence structure is…",
        options: [
          "technique → example → effect on reader",
          "opinion → summary → opinion",
          "retell the text in order",
          "list every device used",
        ],
        answer: 0,
        why: "Markers reward the effect: what the choice makes the audience think or feel.",
      },
    ],
  },
  {
    id: "eng-language",
    subject: "English",
    name: "Grammar, Punctuation & Sentence Craft",
    blurb: "Clauses, apostrophes, semicolons and controlling tone.",
    strand: "Language · AC9E9LA05",
    questions: [
      {
        q: "Which sentence is punctuated correctly?",
        options: [
          "The dogs bowl was empty.",
          "The dog's bowl was empty.",
          "The dogs' bowl were empty.",
          "The dogs bowl's was empty.",
        ],
        answer: 1,
        why: "One dog owning the bowl → apostrophe before the s.",
      },
      {
        q: "\"Although it rained, the match continued.\" The first clause is…",
        options: ["Main clause", "Subordinate clause", "Noun phrase", "Fragment"],
        answer: 1,
        why: "'Although' is a subordinating conjunction — the clause can't stand alone.",
      },
      {
        q: "A semicolon is best used to…",
        options: [
          "introduce a list only",
          "join two closely related independent clauses",
          "replace every comma",
          "end a question",
        ],
        answer: 1,
        why: "e.g. 'The plan failed; nobody was surprised.'",
      },
      {
        q: "Which rewrite is in active voice? (\"The report was written by Mia.\")",
        options: [
          "Mia wrote the report.",
          "The report, written by Mia, was long.",
          "It was Mia by whom the report was written.",
          "The writing of the report was Mia's.",
        ],
        answer: 0,
        why: "Active voice puts the doer first: subject → verb → object.",
      },
      {
        q: "Modality refers to…",
        options: [
          "how strongly a word expresses certainty or obligation",
          "the length of a sentence",
          "the tense of a verb",
          "how many adjectives are used",
        ],
        answer: 0,
        why: "'Must' is high modality; 'might' is low — it shifts persuasive force.",
      },
    ],
  },

  // -------------------------------------------------------------- HISTORY
  {
    id: "hist-ww1",
    subject: "History",
    name: "World War I & Australia",
    blurb: "Causes, Gallipoli, the home front and the Anzac legend.",
    strand: "Depth study · AC9HH9K06",
    questions: [
      {
        q: "The Anzac landing at Gallipoli took place on…",
        options: ["25 April 1915", "11 November 1918", "4 August 1914", "1 July 1916"],
        answer: 0,
        why: "That date is now commemorated as Anzac Day.",
      },
      {
        q: "Which set of long-term causes of WWI is usually memorised as MAIN?",
        options: [
          "Money, Army, Industry, Nations",
          "Militarism, Alliances, Imperialism, Nationalism",
          "Monarchy, Anzac, Italy, Navy",
          "Mobilisation, Assassination, Invasion, Neutrality",
        ],
        answer: 1,
        why: "The assassination of Franz Ferdinand was the short-term trigger on top of MAIN.",
      },
      {
        q: "Why did Australia enter the war in 1914?",
        options: [
          "It was invaded",
          "As part of the British Empire, it followed Britain's declaration",
          "It was attacked at Gallipoli",
          "The League of Nations required it",
        ],
        answer: 1,
        why: "PM Andrew Fisher pledged support 'to the last man and the last shilling'.",
      },
      {
        q: "The 1916 and 1917 conscription referendums (plebiscites) resulted in…",
        options: [
          "Both passed easily",
          "Both were narrowly defeated",
          "The first passed, the second failed",
          "They were cancelled",
        ],
        answer: 1,
        why: "Australia relied on volunteers; the debate bitterly split the country and Labor Party.",
      },
      {
        q: "Which best describes the Western Front for Australian troops?",
        options: [
          "Fast-moving cavalry warfare",
          "Trench stalemate with huge casualties at places like Pozières and Passchendaele",
          "Naval blockade duty",
          "Mostly training, little combat",
        ],
        answer: 1,
        why: "More Australians died on the Western Front than at Gallipoli.",
      },
      {
        q: "The 'Anzac legend' emphasises qualities such as…",
        options: [
          "obedience and formality",
          "mateship, endurance, larrikin humour",
          "technological superiority",
          "imperial ambition",
        ],
        answer: 1,
        why: "Historians debate how much this was shaped by journalists like C.E.W. Bean.",
      },
    ],
  },
  {
    id: "hist-industrial",
    subject: "History",
    name: "Industrial Revolution & Movement of Peoples",
    blurb: "Industrialisation, convicts, the gold rush and migration to Australia.",
    strand: "Overview · AC9HH9K01",
    questions: [
      {
        q: "Gold was discovered near Bathurst NSW in…",
        options: ["1788", "1851", "1901", "1788 and 1815"],
        answer: 1,
        why: "Edward Hargraves' 1851 find set off the rushes in NSW and Victoria.",
      },
      {
        q: "The Eureka Stockade (1854) was mainly a protest about…",
        options: [
          "convict transportation",
          "expensive miners' licences and lack of political rights",
          "wool prices",
          "railway construction",
        ],
        answer: 1,
        why: "It became a symbol in the push toward male suffrage in the colonies.",
      },
      {
        q: "A key push factor for British emigration in the 1800s was…",
        options: [
          "cheap land in Britain",
          "poverty, unemployment and famine, including the Irish Famine",
          "compulsory military service in Australia",
          "the Gold Standard",
        ],
        answer: 1,
        why: "Push factors drive people out; pull factors (gold, land, work) draw them in.",
      },
      {
        q: "Industrialisation changed work mainly by…",
        options: [
          "shifting production from home crafts to factories and machines",
          "ending all child labour immediately",
          "reducing city populations",
          "abolishing wage labour",
        ],
        answer: 0,
        why: "Steam power plus the factory system concentrated workers in fast-growing cities.",
      },
      {
        q: "Impacts of the gold rushes on First Nations peoples included…",
        options: [
          "greater access to Country",
          "dispossession, destruction of land and waterways, and violence",
          "no significant change",
          "formal treaties",
        ],
        answer: 1,
        why: "Mining tore up Country and accelerated frontier conflict and displacement.",
      },
    ],
  },

  // ------------------------------------------------------------ GEOGRAPHY
  {
    id: "geo-biomes",
    subject: "Geography",
    name: "Biomes & Food Security",
    blurb: "How biomes are altered to feed people, and what limits production.",
    strand: "Biomes and food security · AC9HG9K01",
    questions: [
      {
        q: "A biome is best defined as…",
        options: [
          "a country's farming zone",
          "a large area with similar climate, soil, plants and animals",
          "any area used for agriculture",
          "a city and its surrounds",
        ],
        answer: 1,
        why: "Examples: tropical rainforest, grassland, desert, tundra.",
      },
      {
        q: "Which is a major challenge to Australian food production?",
        options: [
          "Too much arable land",
          "Drought, salinity and soil degradation",
          "No export markets",
          "Excess rainfall nationwide",
        ],
        answer: 1,
        why: "Australia is largely arid with old, nutrient-poor soils, so water is the key limit.",
      },
      {
        q: "'Food security' means…",
        options: [
          "growing only local food",
          "reliable access to enough safe, nutritious food",
          "storing food in warehouses",
          "banning food imports",
        ],
        answer: 1,
        why: "It covers availability, access, use and stability over time.",
      },
      {
        q: "Land clearing for agriculture typically causes…",
        options: [
          "increased biodiversity",
          "habitat loss, erosion and reduced carbon storage",
          "cooler global temperatures",
          "richer soils permanently",
        ],
        answer: 1,
        why: "Removing native vegetation exposes soil and fragments habitat.",
      },
      {
        q: "One sustainable intensification strategy is…",
        options: [
          "clearing more forest",
          "drip irrigation and crop rotation to lift yield per hectare",
          "using more water per crop",
          "monoculture with no fallow",
        ],
        answer: 1,
        why: "The aim is more food from existing land with less water and soil damage.",
      },
    ],
  },
  {
    id: "geo-interconnections",
    subject: "Geography",
    name: "Geographies of Interconnection",
    blurb: "Trade, transport, tourism and the shrinking world.",
    strand: "Interconnections · AC9HG9K04",
    questions: [
      {
        q: "'Time-space convergence' describes how…",
        options: [
          "places get physically closer",
          "improved transport and ICT make places feel closer in time and cost",
          "time zones disappear",
          "trade slows down",
        ],
        answer: 1,
        why: "A flight or a video call collapses the effective distance between places.",
      },
      {
        q: "Buying imported goods online links you to distant places by…",
        options: [
          "cultural links only",
          "flows of trade, transport, money and information",
          "migration only",
          "no real connection",
        ],
        answer: 1,
        why: "Each purchase triggers production, shipping, payment and data flows.",
      },
      {
        q: "A negative impact of mass tourism on a destination can be…",
        options: [
          "more employment",
          "pressure on water, waste and housing, plus damage to fragile sites",
          "improved airports",
          "higher tax revenue",
        ],
        answer: 1,
        why: "Great Barrier Reef and Uluru management plans exist to limit these impacts.",
      },
      {
        q: "Australia's largest two-way trading partner is…",
        options: ["United Kingdom", "China", "New Zealand", "France"],
        answer: 1,
        why: "Iron ore, coal and education/tourism services dominate that relationship.",
      },
      {
        q: "'Food miles' refers to…",
        options: [
          "how far food travels from producer to consumer",
          "the calories in food",
          "farm size",
          "the cost of fertiliser",
        ],
        answer: 0,
        why: "It's used to discuss transport emissions, though total footprint matters more.",
      },
    ],
  },
];

export const SUBJECT_LIST = ["Maths", "Science", "English", "History", "Geography"] as const;

export function deckById(id: string): Deck | undefined {
  return DECKS.find((d) => d.id === id);
}

/** Fisher–Yates on a copy — used to shuffle questions per attempt. */
export function shuffled<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
