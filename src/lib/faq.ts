/**
 * The FAQ, in one place.
 *
 * It is read twice: once by the page and once by `faqStructuredData` for the
 * JSON-LD. Keeping one array is what stops the marked-up answer drifting from
 * the visible one — which Google treats as a policy violation, not a typo.
 *
 * Every answer is written to stand alone. Answer engines quote one item without
 * its neighbours, so "as above" or "see the previous answer" would be quoted
 * into nonsense.
 */
export const FAQ: { q: string; a: string }[] = [
  {
    q: "Does giving blood hurt?",
    a: "There is one sharp scratch when the needle goes in, about the same as a routine blood test. After that you feel nothing for the ten minutes it takes. Most first-time donors say the anticipation was worse than the thing itself.",
  },
  {
    q: "How long does the whole thing take?",
    a: "About 40 minutes at a BlooDoc camp. Roughly five minutes to check in, ten for screening, ten for the donation itself and fifteen sitting with a drink afterwards. The donation is the shortest part of it.",
  },
  {
    q: "Who can donate blood in India?",
    a: "Generally anyone aged 18 to 65 who weighs at least 45kg, is in good health on the day, and has not given whole blood in the last three months. A medical officer screens you at the camp and their decision is the one that counts.",
  },
  {
    q: "How often can I donate blood?",
    a: "Once every three months for whole blood — 56 days is the medical minimum and 90 days is the usual interval in India. Your body replaces the plasma within a day or two and the red cells within a few weeks.",
  },
  {
    q: "Can I donate if I am on medication?",
    a: "Usually yes. Routine medication such as thyroxine, a statin, or something for blood pressure does not stop you. Antibiotics mean waiting until two weeks after the course finishes, and blood thinners or insulin need a conversation with the medical officer first. Bring the names of anything you take.",
  },
  {
    q: "Can I donate if I have a tattoo or a piercing?",
    a: "Yes, if it is more than six months old and was done with sterile equipment. Inside six months you are asked to wait, which is a deferral rather than a refusal — come to the next camp.",
  },
  {
    q: "Can women donate blood during their period?",
    a: "Yes, provided you feel well and your haemoglobin is at the required level, which is checked at the camp. Heavy periods can lower haemoglobin, which is the only reason anyone is turned away for this.",
  },
  {
    q: "Is it safe? Can I catch anything?",
    a: "No. A fresh, sterile, single-use needle, tube and bag are opened in front of you for every donor and discarded afterwards. Nothing that touches your blood has touched anyone else's.",
  },
  {
    q: "Will it make me weak?",
    a: "You give about 350 to 450ml, which is roughly 8% of your blood volume, and your body starts replacing it immediately. Eat properly beforehand, drink more water than usual for the rest of the day, and skip the gym until the evening. Most people carry on with their day straight after.",
  },
  {
    q: "What do I need to bring?",
    a: "A photo ID. That is all. If you have registered online, your details are already on the desk's screen.",
  },
  {
    q: "Do I have to register in advance?",
    a: "No — you can walk in. Registering online takes two minutes, means far less queueing, and saves your details so you never fill the form again.",
  },
  {
    q: "I do not know my blood group. Can I still come?",
    a: "Yes. Your group is tested free as part of the screening, and it is added to your BlooDoc record afterwards so you know it for good.",
  },
  {
    q: "What happens to my blood after I give it?",
    a: "It is separated into red cells, plasma and platelets, each of which goes to a different patient — which is why one donation is usually described as helping up to three people. Red cells keep for about six weeks, platelets for five days.",
  },
  {
    q: "Who can see the details on my form?",
    a: "The organisers of the camp you registered for, and nobody else. Your medical answers are visible only to the people running the screening; other donors never see any part of your record.",
  },
];
