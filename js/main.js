// Home page interactions and language selection for SmartRoute AI.
const translations = {
  en: {
    navHome:"Home",navFeatures:"Features",navAbout:"About",languageLabel:"Language",
    eyebrow:"SMARTER RURAL MOBILITY",heroTitle:"Better bus services for",heroTitleAccent:"every village.",
    heroDescription:"Find routes, share travel requirements and use demand-based recommendations to improve rural transportation.",
    explore:"Explore Features",panelTitle:"TRANSPORT PLANNING",startingPoint:"STARTING POINT",village:"Village",
    destination:"DESTINATION",nearbyTown:"Nearby Town",panelNote:"Passenger demand helps administrators plan better services.",
    featuresEyebrow:"WHAT THE WEBSITE OFFERS",featuresTitle:"Simple tools, smarter planning",
    featuresDescription:"One place for passengers to request services and administrators to review transport needs.",
    routeFinder:"Route Finder",routeDescription:"Search for available routes between a starting point and destination.",
    passengerRequests:"Passenger Requests",requestDescription:"Submit a request when a route or bus timing does not meet your needs.",
    aiAgent:"AI Agent",agentDescription:"Analyze requests and passenger demand to suggest possible service improvements.",
    adminPlanning:"Admin Planning",adminDescription:"Review requests, check AI suggestions and manage proposed schedules.",
    purposeEyebrow:"OUR PURPOSE",purposeTitle:"Connecting rural communities through data-driven transport planning.",openApp:"Open SmartRoute AI"
  },
  ta: {
    navHome:"முகப்பு",navFeatures:"அம்சங்கள்",navAbout:"எங்களைப் பற்றி",languageLabel:"மொழி",
    eyebrow:"சிறந்த கிராமப்புற போக்குவரத்து",heroTitle:"ஒவ்வொரு கிராமத்திற்கும்",heroTitleAccent:"சிறந்த பேருந்து சேவை.",
    heroDescription:"வழித்தடங்களைத் தேடுங்கள், பயணத் தேவைகளைப் பகிருங்கள், தரவு அடிப்படையிலான பரிந்துரைகள் மூலம் கிராமப்புற போக்குவரத்தை மேம்படுத்துங்கள்.",
    explore:"அம்சங்களைப் பார்க்க",panelTitle:"போக்குவரத்து திட்டமிடல்",startingPoint:"தொடக்க இடம்",village:"கிராமம்",
    destination:"சேருமிடம்",nearbyTown:"அருகிலுள்ள நகரம்",panelNote:"பயணிகளின் தேவை சிறந்த சேவைகளைத் திட்டமிட நிர்வாகிகளுக்கு உதவுகிறது.",
    featuresEyebrow:"இணையதளத்தின் அம்சங்கள்",featuresTitle:"எளிய கருவிகள், சிறந்த திட்டமிடல்",
    featuresDescription:"பயணிகள் சேவைகளைக் கோரவும் நிர்வாகிகள் போக்குவரத்துத் தேவைகளை மதிப்பாய்வு செய்யவும் ஒரே தளம்.",
    routeFinder:"வழித்தடத் தேடல்",routeDescription:"தொடக்க இடத்திலிருந்து சேருமிடம் வரை உள்ள வழித்தடங்களைத் தேடுங்கள்.",
    passengerRequests:"பயணிகள் கோரிக்கைகள்",requestDescription:"வழித்தடம் அல்லது பேருந்து நேரம் பொருந்தவில்லை என்றால் கோரிக்கையைச் சமர்ப்பிக்கவும்.",
    aiAgent:"AI முகவர்",agentDescription:"சேவை மேம்பாடுகளைப் பரிந்துரைக்க கோரிக்கைகள் மற்றும் பயணிகள் தேவையைப் பகுப்பாய்வு செய்கிறது.",
    adminPlanning:"நிர்வாகத் திட்டமிடல்",adminDescription:"கோரிக்கைகளை மதிப்பாய்வு செய்து AI பரிந்துரைகளைச் சரிபார்த்து அட்டவணைகளை நிர்வகிக்கவும்.",
    purposeEyebrow:"எங்கள் நோக்கம்",purposeTitle:"தரவு அடிப்படையிலான போக்குவரத்துத் திட்டமிடல் மூலம் கிராமப்புற சமூகங்களை இணைத்தல்.",openApp:"SmartRoute AI-ஐ திறக்கவும்"
  },
  te: {
    navHome:"హోమ్",navFeatures:"ఫీచర్లు",navAbout:"మా గురించి",languageLabel:"భాష",
    eyebrow:"మెరుగైన గ్రామీణ రవాణా",heroTitle:"ప్రతి గ్రామానికి",heroTitleAccent:"మెరుగైన బస్సు సేవలు.",
    heroDescription:"మార్గాలను వెతకండి, ప్రయాణ అవసరాలను పంచుకోండి, డిమాండ్ ఆధారిత సూచనలతో గ్రామీణ రవాణాను మెరుగుపరచండి.",
    explore:"ఫీచర్లను చూడండి",panelTitle:"రవాణా ప్రణాళిక",startingPoint:"ప్రారంభ స్థానం",village:"గ్రామం",
    destination:"గమ్యస్థానం",nearbyTown:"సమీప పట్టణం",panelNote:"ప్రయాణికుల డిమాండ్ మెరుగైన సేవలను ప్రణాళిక చేయడానికి నిర్వాహకులకు సహాయపడుతుంది.",
    featuresEyebrow:"వెబ్‌సైట్ అందించే అంశాలు",featuresTitle:"సులభమైన సాధనాలు, మెరుగైన ప్రణాళిక",
    featuresDescription:"ప్రయాణికులు సేవలను అభ్యర్థించడానికి, నిర్వాహకులు రవాణా అవసరాలను సమీక్షించడానికి ఒకే వేదిక.",
    routeFinder:"మార్గ అన్వేషణ",routeDescription:"ప్రారంభ స్థానం నుండి గమ్యస్థానం వరకు అందుబాటులో ఉన్న మార్గాలను వెతకండి.",
    passengerRequests:"ప్రయాణికుల అభ్యర్థనలు",requestDescription:"మార్గం లేదా బస్సు సమయం సరిపోకపోతే అభ్యర్థనను సమర్పించండి.",
    aiAgent:"AI ఏజెంట్",agentDescription:"సేవల మెరుగుదలలను సూచించడానికి అభ్యర్థనలు మరియు ప్రయాణికుల డిమాండ్‌ను విశ్లేషిస్తుంది.",
    adminPlanning:"అడ్మిన్ ప్రణాళిక",adminDescription:"అభ్యర్థనలను సమీక్షించండి, AI సూచనలను పరిశీలించండి, షెడ్యూళ్లను నిర్వహించండి.",
    purposeEyebrow:"మా లక్ష్యం",purposeTitle:"డేటా ఆధారిత రవాణా ప్రణాళికతో గ్రామీణ సమాజాలను అనుసంధానించడం.",openApp:"SmartRoute AI తెరవండి"
  },
  hi: {
    navHome:"होम",navFeatures:"विशेषताएँ",navAbout:"हमारे बारे में",languageLabel:"भाषा",
    eyebrow:"बेहतर ग्रामीण परिवहन",heroTitle:"हर गाँव के लिए",heroTitleAccent:"बेहतर बस सेवाएँ।",
    heroDescription:"रूट खोजें, यात्रा की ज़रूरतें साझा करें और माँग-आधारित सुझावों से ग्रामीण परिवहन बेहतर बनाएँ।",
    explore:"विशेषताएँ देखें",panelTitle:"परिवहन योजना",startingPoint:"शुरुआती स्थान",village:"गाँव",
    destination:"गंतव्य",nearbyTown:"नज़दीकी शहर",panelNote:"यात्रियों की माँग प्रशासकों को बेहतर सेवाओं की योजना बनाने में मदद करती है।",
    featuresEyebrow:"वेबसाइट की सुविधाएँ",featuresTitle:"सरल उपकरण, बेहतर योजना",
    featuresDescription:"यात्रियों के अनुरोध और प्रशासकों द्वारा परिवहन ज़रूरतों की समीक्षा के लिए एक ही स्थान।",
    routeFinder:"रूट खोजें",routeDescription:"शुरुआती स्थान से गंतव्य तक उपलब्ध मार्ग खोजें।",
    passengerRequests:"यात्री अनुरोध",requestDescription:"यदि मार्ग या बस का समय आपकी ज़रूरत के अनुसार नहीं है, तो अनुरोध भेजें।",
    aiAgent:"AI एजेंट",agentDescription:"सेवा सुधार के सुझाव देने के लिए अनुरोधों और यात्री माँग का विश्लेषण करता है।",
    adminPlanning:"प्रशासनिक योजना",adminDescription:"अनुरोधों की समीक्षा करें, AI सुझाव देखें और प्रस्तावित समय-सारणी प्रबंधित करें।",
    purposeEyebrow:"हमारा उद्देश्य",purposeTitle:"डेटा-आधारित परिवहन योजना से ग्रामीण समुदायों को जोड़ना।",openApp:"SmartRoute AI खोलें"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const year = new Date().getFullYear();
  const footer = document.querySelector(".site-footer");
  if (footer) {
    const yearLabel = document.createElement("span");
    yearLabel.textContent = String(year);
    footer.appendChild(yearLabel);
  }

  const languageSelect = document.getElementById("language-select");
  if (!languageSelect) return;

  const applyLanguage = (language) => {
    const selected = translations[language] ? language : "en";
    document.documentElement.lang = selected;
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.dataset.i18n;
      if (translations[selected][key]) element.textContent = translations[selected][key];
    });
    languageSelect.value = selected;
    try { localStorage.setItem("smartrouteLanguage", selected); } catch (error) {}
  };

  let savedLanguage = "en";
  try { savedLanguage = localStorage.getItem("smartrouteLanguage") || "en"; } catch (error) {}
  languageSelect.addEventListener("change", () => applyLanguage(languageSelect.value));
  applyLanguage(savedLanguage);
});
