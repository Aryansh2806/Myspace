// Synthetic brands, deliberately NOT the real client profiles: this repo is
// public. They mirror the shape of the real portfolio — B2B industrial, a
// non-profit, a fashion label — so the eval measures the distribution of work
// the tool actually gets used for.

export const BRANDS = [
  {
    key: "industrial",
    name: "Vidarbha Crane Hire",
    voice:
      "Plain and practical. Talks like a yard supervisor, not a brochure. " +
      "Confident about the machines, never salesy.",
    audience:
      "Site engineers and project managers running mid-sized construction sites across " +
      "central Maharashtra, who need a crane for six weeks, not six years.",
    pillars: [
      "Equipment reliability",
      "Same-day dispatch",
      "Rent versus buy economics",
      "Site progress stories",
    ],
    tone_do: ["Name the machine and its capacity", "Talk in project timelines"],
    tone_dont: ["Never say 'solutions provider'", "No stock-photo language", "Never use 'synergy'"],
    notes:
      "Started 2004 by Sunil Pathak with one hired crane. Fleet is 11 machines, mostly " +
      "Escorts and ACE pick-and-carry. Sunil's line to every client: 'machine kal subah " +
      "site pe hogi.' They famously kept a Nagpur flyover job running through the 2019 " +
      "monsoon when two competitors pulled out.",
    language: "hinglish",
  },
  {
    key: "nonprofit",
    name: "Aasra Foundation",
    voice: "Warm and specific. Talks about named people, never about 'beneficiaries'.",
    audience:
      "Small domestic donors in Indian metros who give ₹1,000-₹5,000 and want to see " +
      "exactly where it went.",
    pillars: ["Scholarship stories", "Where the money went", "Volunteer voices", "Health camps"],
    tone_do: ["Name the person", "Give the actual number"],
    tone_dont: ["Never use pity imagery", "Never say 'underprivileged'", "No vague impact claims"],
    notes:
      "Runs 3 after-school centres in Pune. 214 children enrolled. Founded by a retired " +
      "school principal, Meera Joshi, in 2011. Their annual report is published openly, " +
      "which most peers do not do.",
    language: "english",
  },
  {
    key: "fashion",
    name: "Kora Label",
    voice: "Spare and editorial. Lets the garment speak. Short lines, no exclamation marks.",
    audience:
      "Women 28-40 in Indian metros buying fewer, better pieces; they read the fabric " +
      "composition before the price.",
    pillars: ["Fabric and craft", "Collection reveals", "Styling one piece many ways", "Studio process"],
    tone_do: ["Name the fabric and the weaver", "Show the garment moving"],
    tone_dont: ["Never use 'slay' or 'obsessed'", "No trend-chasing captions", "Never discount-lead"],
    notes:
      "Handloom cotton and khadi silk from weavers in Chanderi. Founded by two ex-textile " +
      "students, Nikita and Ayesha, 2021. Every piece carries the weaver's name on the label. " +
      "They have never run a sale.",
    language: "english",
  },
];

export const OBJECTIVES = {
  industrial: "Get enquiries from site engineers starting projects in the next quarter.",
  nonprofit: "Convert one-time donors into monthly givers before the financial year ends.",
  fashion: "Build anticipation for the new Chanderi collection launching in three weeks.",
};
