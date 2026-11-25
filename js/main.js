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
  },
  bn:{navHome:"হোম",navFeatures:"বৈশিষ্ট্য",navAbout:"আমাদের সম্পর্কে",languageLabel:"ভাষা",eyebrow:"উন্নত গ্রামীণ পরিবহন",heroTitle:"প্রতিটি গ্রামের জন্য",heroTitleAccent:"আরও ভালো বাস পরিষেবা।",heroDescription:"রুট খুঁজুন, যাতায়াতের প্রয়োজন জানান এবং চাহিদাভিত্তিক সুপারিশের মাধ্যমে গ্রামীণ পরিবহন উন্নত করুন।",explore:"বৈশিষ্ট্য দেখুন",panelTitle:"পরিবহন পরিকল্পনা",startingPoint:"শুরুর স্থান",village:"গ্রাম",destination:"গন্তব্য",nearbyTown:"নিকটবর্তী শহর",panelNote:"যাত্রীদের চাহিদা প্রশাসকদের উন্নত পরিষেবা পরিকল্পনা করতে সাহায্য করে।",featuresEyebrow:"ওয়েবসাইটের সুবিধা",featuresTitle:"সহজ সরঞ্জাম, উন্নত পরিকল্পনা",featuresDescription:"যাত্রীরা পরিষেবার অনুরোধ করতে এবং প্রশাসকরা পরিবহনের চাহিদা পর্যালোচনা করতে পারেন একই জায়গায়।",routeFinder:"রুট খুঁজুন",routeDescription:"শুরুর স্থান থেকে গন্তব্য পর্যন্ত উপলব্ধ রুট খুঁজুন।",passengerRequests:"যাত্রীর অনুরোধ",requestDescription:"রুট বা বাসের সময় আপনার প্রয়োজনের সঙ্গে না মিললে অনুরোধ জমা দিন।",aiAgent:"AI এজেন্ট",agentDescription:"পরিষেবার উন্নতির পরামর্শ দিতে অনুরোধ ও যাত্রীদের চাহিদা বিশ্লেষণ করে।",adminPlanning:"প্রশাসনিক পরিকল্পনা",adminDescription:"অনুরোধ পর্যালোচনা করুন, AI পরামর্শ দেখুন এবং প্রস্তাবিত সময়সূচি পরিচালনা করুন।",purposeEyebrow:"আমাদের লক্ষ্য",purposeTitle:"তথ্যভিত্তিক পরিবহন পরিকল্পনার মাধ্যমে গ্রামীণ সম্প্রদায়কে সংযুক্ত করা।",openApp:"SmartRoute AI খুলুন"},
  mr:{navHome:"मुख्यपृष्ठ",navFeatures:"वैशिष्ट्ये",navAbout:"आमच्याबद्दल",languageLabel:"भाषा",eyebrow:"अधिक चांगली ग्रामीण वाहतूक",heroTitle:"प्रत्येक गावासाठी",heroTitleAccent:"अधिक चांगली बससेवा.",heroDescription:"मार्ग शोधा, प्रवासाच्या गरजा सांगा आणि मागणीवर आधारित सूचनांनी ग्रामीण वाहतूक सुधारा.",explore:"वैशिष्ट्ये पाहा",panelTitle:"वाहतूक नियोजन",startingPoint:"प्रारंभ ठिकाण",village:"गाव",destination:"गंतव्यस्थान",nearbyTown:"जवळचे शहर",panelNote:"प्रवाशांची मागणी प्रशासकांना अधिक चांगल्या सेवांचे नियोजन करण्यास मदत करते.",featuresEyebrow:"वेबसाइटची वैशिष्ट्ये",featuresTitle:"सोपी साधने, अधिक चांगले नियोजन",featuresDescription:"प्रवासी सेवा मागू शकतात आणि प्रशासक वाहतुकीच्या गरजांचा आढावा घेऊ शकतात असे एकच व्यासपीठ.",routeFinder:"मार्ग शोधा",routeDescription:"प्रारंभ ठिकाणापासून गंतव्यस्थानापर्यंत उपलब्ध मार्ग शोधा.",passengerRequests:"प्रवाशांच्या विनंत्या",requestDescription:"मार्ग किंवा बसची वेळ तुमच्या गरजेनुसार नसल्यास विनंती पाठवा.",aiAgent:"AI एजंट",agentDescription:"सेवा सुधारणा सुचवण्यासाठी विनंत्या आणि प्रवाशांची मागणी तपासतो.",adminPlanning:"प्रशासकीय नियोजन",adminDescription:"विनंत्यांचा आढावा घ्या, AI सूचना तपासा आणि प्रस्तावित वेळापत्रक व्यवस्थापित करा.",purposeEyebrow:"आमचा उद्देश",purposeTitle:"माहिती-आधारित वाहतूक नियोजनातून ग्रामीण समुदायांना जोडणे.",openApp:"SmartRoute AI उघडा"},
  gu:{navHome:"હોમ",navFeatures:"સુવિધાઓ",navAbout:"અમારા વિશે",languageLabel:"ભાષા",eyebrow:"વધુ સારી ગ્રામ્ય પરિવહન વ્યવસ્થા",heroTitle:"દરેક ગામ માટે",heroTitleAccent:"વધુ સારી બસ સેવા.",heroDescription:"માર્ગો શોધો, મુસાફરીની જરૂરિયાતો જણાવો અને માંગ આધારિત સૂચનો દ્વારા ગ્રામ્ય પરિવહન સુધારો.",explore:"સુવિધાઓ જુઓ",panelTitle:"પરિવહન આયોજન",startingPoint:"શરૂઆતનું સ્થળ",village:"ગામ",destination:"ગંતવ્ય",nearbyTown:"નજીકનું શહેર",panelNote:"પ્રવાસીઓની માંગ સંચાલકોને વધુ સારી સેવાઓનું આયોજન કરવામાં મદદ કરે છે.",featuresEyebrow:"વેબસાઇટની સુવિધાઓ",featuresTitle:"સરળ સાધનો, વધુ સારું આયોજન",featuresDescription:"પ્રવાસીઓ સેવા માટે વિનંતી કરી શકે અને સંચાલકો પરિવહનની જરૂરિયાતોની સમીક્ષા કરી શકે એવું એક જ સ્થળ.",routeFinder:"માર્ગ શોધો",routeDescription:"શરૂઆતના સ્થળથી ગંતવ્ય સુધીના ઉપલબ્ધ માર્ગો શોધો.",passengerRequests:"પ્રવાસીઓની વિનંતીઓ",requestDescription:"માર્ગ અથવા બસનો સમય તમારી જરૂરિયાત મુજબ ન હોય તો વિનંતી મોકલો.",aiAgent:"AI એજન્ટ",agentDescription:"સેવામાં સુધારા સૂચવવા માટે વિનંતીઓ અને પ્રવાસીઓની માંગનું વિશ્લેષણ કરે છે.",adminPlanning:"એડમિન આયોજન",adminDescription:"વિનંતીઓની સમીક્ષા કરો, AI સૂચનો તપાસો અને સૂચિત સમયપત્રક સંચાલિત કરો.",purposeEyebrow:"અમારો હેતુ",purposeTitle:"માહિતી આધારિત પરિવહન આયોજન દ્વારા ગ્રામ્ય સમુદાયોને જોડવા.",openApp:"SmartRoute AI ખોલો"},
  kn:{navHome:"ಮುಖಪುಟ",navFeatures:"ವೈಶಿಷ್ಟ್ಯಗಳು",navAbout:"ನಮ್ಮ ಬಗ್ಗೆ",languageLabel:"ಭಾಷೆ",eyebrow:"ಉತ್ತಮ ಗ್ರಾಮೀಣ ಸಾರಿಗೆ",heroTitle:"ಪ್ರತಿ ಗ್ರಾಮಕ್ಕೂ",heroTitleAccent:"ಉತ್ತಮ ಬಸ್ ಸೇವೆಗಳು.",heroDescription:"ಮಾರ್ಗಗಳನ್ನು ಹುಡುಕಿ, ಪ್ರಯಾಣದ ಅಗತ್ಯಗಳನ್ನು ಹಂಚಿಕೊಳ್ಳಿ ಮತ್ತು ಬೇಡಿಕೆ ಆಧಾರಿತ ಸಲಹೆಗಳಿಂದ ಗ್ರಾಮೀಣ ಸಾರಿಗೆಯನ್ನು ಸುಧಾರಿಸಿ.",explore:"ವೈಶಿಷ್ಟ್ಯಗಳನ್ನು ನೋಡಿ",panelTitle:"ಸಾರಿಗೆ ಯೋಜನೆ",startingPoint:"ಪ್ರಾರಂಭ ಸ್ಥಳ",village:"ಗ್ರಾಮ",destination:"ಗಮ್ಯಸ್ಥಾನ",nearbyTown:"ಹತ್ತಿರದ ಪಟ್ಟಣ",panelNote:"ಪ್ರಯಾಣಿಕರ ಬೇಡಿಕೆ ಉತ್ತಮ ಸೇವೆಗಳನ್ನು ಯೋಜಿಸಲು ನಿರ್ವಾಹಕರಿಗೆ ಸಹಾಯ ಮಾಡುತ್ತದೆ.",featuresEyebrow:"ವೆಬ್‌ಸೈಟ್‌ನ ಸೌಲಭ್ಯಗಳು",featuresTitle:"ಸರಳ ಸಾಧನಗಳು, ಉತ್ತಮ ಯೋಜನೆ",featuresDescription:"ಪ್ರಯಾಣಿಕರು ಸೇವೆಗಳನ್ನು ಕೋರಲು ಮತ್ತು ನಿರ್ವಾಹಕರು ಸಾರಿಗೆ ಅಗತ್ಯಗಳನ್ನು ಪರಿಶೀಲಿಸಲು ಒಂದೇ ವೇದಿಕೆ.",routeFinder:"ಮಾರ್ಗ ಹುಡುಕಾಟ",routeDescription:"ಪ್ರಾರಂಭ ಸ್ಥಳದಿಂದ ಗಮ್ಯಸ್ಥಾನದವರೆಗೆ ಲಭ್ಯವಿರುವ ಮಾರ್ಗಗಳನ್ನು ಹುಡುಕಿ.",passengerRequests:"ಪ್ರಯಾಣಿಕರ ವಿನಂತಿಗಳು",requestDescription:"ಮಾರ್ಗ ಅಥವಾ ಬಸ್ ಸಮಯ ನಿಮ್ಮ ಅಗತ್ಯಕ್ಕೆ ಸರಿಹೊಂದದಿದ್ದರೆ ವಿನಂತಿಯನ್ನು ಸಲ್ಲಿಸಿ.",aiAgent:"AI ಏಜೆಂಟ್",agentDescription:"ಸೇವಾ ಸುಧಾರಣೆಗಳನ್ನು ಸೂಚಿಸಲು ವಿನಂತಿಗಳು ಮತ್ತು ಪ್ರಯಾಣಿಕರ ಬೇಡಿಕೆಯನ್ನು ವಿಶ್ಲೇಷಿಸುತ್ತದೆ.",adminPlanning:"ನಿರ್ವಾಹಕ ಯೋಜನೆ",adminDescription:"ವಿನಂತಿಗಳನ್ನು ಪರಿಶೀಲಿಸಿ, AI ಸಲಹೆಗಳನ್ನು ನೋಡಿ ಮತ್ತು ಪ್ರಸ್ತಾವಿತ ವೇಳಾಪಟ್ಟಿಗಳನ್ನು ನಿರ್ವಹಿಸಿ.",purposeEyebrow:"ನಮ್ಮ ಉದ್ದೇಶ",purposeTitle:"ಮಾಹಿತಿ ಆಧಾರಿತ ಸಾರಿಗೆ ಯೋಜನೆಯ ಮೂಲಕ ಗ್ರಾಮೀಣ ಸಮುದಾಯಗಳನ್ನು ಸಂಪರ್ಕಿಸುವುದು.",openApp:"SmartRoute AI ತೆರೆಯಿರಿ"},
  ml:{navHome:"ഹോം",navFeatures:"സവിശേഷതകൾ",navAbout:"ഞങ്ങളെക്കുറിച്ച്",languageLabel:"ഭാഷ",eyebrow:"മെച്ചപ്പെട്ട ഗ്രാമീണ ഗതാഗതം",heroTitle:"ഓരോ ഗ്രാമത്തിനും",heroTitleAccent:"മെച്ചപ്പെട്ട ബസ് സേവനം.",heroDescription:"റൂട്ടുകൾ കണ്ടെത്തുക, യാത്രാ ആവശ്യങ്ങൾ പങ്കിടുക, ആവശ്യകതയെ അടിസ്ഥാനമാക്കിയുള്ള നിർദേശങ്ങളിലൂടെ ഗ്രാമീണ ഗതാഗതം മെച്ചപ്പെടുത്തുക.",explore:"സവിശേഷതകൾ കാണുക",panelTitle:"ഗതാഗത ആസൂത്രണം",startingPoint:"തുടക്കസ്ഥലം",village:"ഗ്രാമം",destination:"ലക്ഷ്യസ്ഥാനം",nearbyTown:"സമീപ പട്ടണം",panelNote:"യാത്രക്കാരുടെ ആവശ്യം മെച്ചപ്പെട്ട സേവനങ്ങൾ ആസൂത്രണം ചെയ്യാൻ അധികൃതരെ സഹായിക്കുന്നു.",featuresEyebrow:"വെബ്സൈറ്റിന്റെ സവിശേഷതകൾ",featuresTitle:"ലളിതമായ ഉപകരണങ്ങൾ, മികച്ച ആസൂത്രണം",featuresDescription:"യാത്രക്കാർക്ക് സേവനങ്ങൾ അഭ്യർത്ഥിക്കാനും അധികൃതർ ഗതാഗത ആവശ്യങ്ങൾ പരിശോധിക്കാനും ഒരിടം.",routeFinder:"റൂട്ട് കണ്ടെത്തൽ",routeDescription:"തുടക്കസ്ഥലത്തുനിന്ന് ലക്ഷ്യസ്ഥാനത്തേക്കുള്ള ലഭ്യമായ റൂട്ടുകൾ കണ്ടെത്തുക.",passengerRequests:"യാത്രക്കാരുടെ അഭ്യർത്ഥനകൾ",requestDescription:"റൂട്ടോ ബസ് സമയമോ നിങ്ങളുടെ ആവശ്യത്തിന് അനുയോജ്യമല്ലെങ്കിൽ അഭ്യർത്ഥന സമർപ്പിക്കുക.",aiAgent:"AI ഏജന്റ്",agentDescription:"സേവന മെച്ചപ്പെടുത്തലുകൾ നിർദേശിക്കാൻ അഭ്യർത്ഥനകളും യാത്രക്കാരുടെ ആവശ്യവും വിശകലനം ചെയ്യുന്നു.",adminPlanning:"അഡ്മിൻ ആസൂത്രണം",adminDescription:"അഭ്യർത്ഥനകൾ പരിശോധിക്കുക, AI നിർദേശങ്ങൾ വിലയിരുത്തുക, നിർദേശിച്ച സമയക്രമങ്ങൾ നിയന്ത്രിക്കുക.",purposeEyebrow:"ഞങ്ങളുടെ ലക്ഷ്യം",purposeTitle:"ഡാറ്റ അടിസ്ഥാനമാക്കിയുള്ള ഗതാഗത ആസൂത്രണത്തിലൂടെ ഗ്രാമീണ സമൂഹങ്ങളെ ബന്ധിപ്പിക്കുക.",openApp:"SmartRoute AI തുറക്കുക"},
  pa:{navHome:"ਮੁੱਖ ਪੰਨਾ",navFeatures:"ਖਾਸੀਅਤਾਂ",navAbout:"ਸਾਡੇ ਬਾਰੇ",languageLabel:"ਭਾਸ਼ਾ",eyebrow:"ਬਿਹਤਰ ਪੇਂਡੂ ਆਵਾਜਾਈ",heroTitle:"ਹਰ ਪਿੰਡ ਲਈ",heroTitleAccent:"ਬਿਹਤਰ ਬੱਸ ਸੇਵਾਵਾਂ।",heroDescription:"ਰਸਤੇ ਲੱਭੋ, ਯਾਤਰਾ ਦੀਆਂ ਲੋੜਾਂ ਸਾਂਝੀਆਂ ਕਰੋ ਅਤੇ ਮੰਗ ਅਧਾਰਿਤ ਸੁਝਾਵਾਂ ਨਾਲ ਪੇਂਡੂ ਆਵਾਜਾਈ ਸੁਧਾਰੋ।",explore:"ਖਾਸੀਅਤਾਂ ਵੇਖੋ",panelTitle:"ਆਵਾਜਾਈ ਯੋਜਨਾ",startingPoint:"ਸ਼ੁਰੂਆਤੀ ਥਾਂ",village:"ਪਿੰਡ",destination:"ਮੰਜ਼ਿਲ",nearbyTown:"ਨੇੜਲਾ ਸ਼ਹਿਰ",panelNote:"ਯਾਤਰੀਆਂ ਦੀ ਮੰਗ ਪ੍ਰਬੰਧਕਾਂ ਨੂੰ ਬਿਹਤਰ ਸੇਵਾਵਾਂ ਦੀ ਯੋਜਨਾ ਬਣਾਉਣ ਵਿੱਚ ਮਦਦ ਕਰਦੀ ਹੈ।",featuresEyebrow:"ਵੈੱਬਸਾਈਟ ਦੀਆਂ ਸਹੂਲਤਾਂ",featuresTitle:"ਸੌਖੇ ਸਾਧਨ, ਬਿਹਤਰ ਯੋਜਨਾ",featuresDescription:"ਯਾਤਰੀ ਸੇਵਾਵਾਂ ਲਈ ਬੇਨਤੀ ਕਰ ਸਕਦੇ ਹਨ ਅਤੇ ਪ੍ਰਬੰਧਕ ਆਵਾਜਾਈ ਦੀਆਂ ਲੋੜਾਂ ਦੀ ਸਮੀਖਿਆ ਕਰ ਸਕਦੇ ਹਨ।",routeFinder:"ਰਸਤਾ ਲੱਭੋ",routeDescription:"ਸ਼ੁਰੂਆਤੀ ਥਾਂ ਤੋਂ ਮੰਜ਼ਿਲ ਤੱਕ ਉਪਲਬਧ ਰਸਤੇ ਲੱਭੋ।",passengerRequests:"ਯਾਤਰੀ ਬੇਨਤੀਆਂ",requestDescription:"ਜੇ ਰਸਤਾ ਜਾਂ ਬੱਸ ਦਾ ਸਮਾਂ ਤੁਹਾਡੀ ਲੋੜ ਮੁਤਾਬਕ ਨਹੀਂ ਹੈ ਤਾਂ ਬੇਨਤੀ ਭੇਜੋ।",aiAgent:"AI ਏਜੰਟ",agentDescription:"ਸੇਵਾ ਵਿੱਚ ਸੁਧਾਰ ਦੇ ਸੁਝਾਅ ਦੇਣ ਲਈ ਬੇਨਤੀਆਂ ਅਤੇ ਯਾਤਰੀਆਂ ਦੀ ਮੰਗ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ ਕਰਦਾ ਹੈ।",adminPlanning:"ਪ੍ਰਬੰਧਕੀ ਯੋਜਨਾ",adminDescription:"ਬੇਨਤੀਆਂ ਦੀ ਸਮੀਖਿਆ ਕਰੋ, AI ਸੁਝਾਅ ਵੇਖੋ ਅਤੇ ਪ੍ਰਸਤਾਵਿਤ ਸਮਾਂ-ਸਾਰਣੀ ਸੰਭਾਲੋ।",purposeEyebrow:"ਸਾਡਾ ਉਦੇਸ਼",purposeTitle:"ਡਾਟਾ ਅਧਾਰਿਤ ਆਵਾਜਾਈ ਯੋਜਨਾ ਰਾਹੀਂ ਪੇਂਡੂ ਭਾਈਚਾਰਿਆਂ ਨੂੰ ਜੋੜਨਾ।",openApp:"SmartRoute AI ਖੋਲ੍ਹੋ"},
  or:{navHome:"ମୂଳପୃଷ୍ଠା",navFeatures:"ବୈଶିଷ୍ଟ୍ୟ",navAbout:"ଆମ ବିଷୟରେ",languageLabel:"ଭାଷା",eyebrow:"ଉନ୍ନତ ଗ୍ରାମୀଣ ପରିବହନ",heroTitle:"ପ୍ରତ୍ୟେକ ଗାଁ ପାଇଁ",heroTitleAccent:"ଉନ୍ନତ ବସ୍ ସେବା।",heroDescription:"ମାର୍ଗ ଖୋଜନ୍ତୁ, ଯାତ୍ରା ଆବଶ୍ୟକତା ଜଣାନ୍ତୁ ଏବଂ ଚାହିଦା ଆଧାରିତ ପରାମର୍ଶରେ ଗ୍ରାମୀଣ ପରିବହନ ଉନ୍ନତ କରନ୍ତୁ।",explore:"ବୈଶିଷ୍ଟ୍ୟ ଦେଖନ୍ତୁ",panelTitle:"ପରିବହନ ଯୋଜନା",startingPoint:"ଆରମ୍ଭ ସ୍ଥାନ",village:"ଗାଁ",destination:"ଗନ୍ତବ୍ୟ ସ୍ଥାନ",nearbyTown:"ନିକଟସ୍ଥ ସହର",panelNote:"ଯାତ୍ରୀଙ୍କ ଚାହିଦା ପ୍ରଶାସକମାନଙ୍କୁ ଉନ୍ନତ ସେବା ଯୋଜନା କରିବାରେ ସାହାଯ୍ୟ କରେ।",featuresEyebrow:"ୱେବସାଇଟର ସୁବିଧା",featuresTitle:"ସରଳ ଉପକରଣ, ଉନ୍ନତ ଯୋଜନା",featuresDescription:"ଯାତ୍ରୀମାନେ ସେବା ଅନୁରୋଧ କରିପାରିବେ ଏବଂ ପ୍ରଶାସକମାନେ ପରିବହନ ଆବଶ୍ୟକତା ସମୀକ୍ଷା କରିପାରିବେ।",routeFinder:"ମାର୍ଗ ଖୋଜନ୍ତୁ",routeDescription:"ଆରମ୍ଭ ସ୍ଥାନରୁ ଗନ୍ତବ୍ୟ ସ୍ଥାନ ପର୍ଯ୍ୟନ୍ତ ଉପଲବ୍ଧ ମାର୍ଗ ଖୋଜନ୍ତୁ।",passengerRequests:"ଯାତ୍ରୀ ଅନୁରୋଧ",requestDescription:"ମାର୍ଗ କିମ୍ବା ବସ୍ ସମୟ ଆପଣଙ୍କ ଆବଶ୍ୟକତା ପୂରଣ ନକଲେ ଅନୁରୋଧ ପଠାନ୍ତୁ।",aiAgent:"AI ଏଜେଣ୍ଟ",agentDescription:"ସେବା ଉନ୍ନତି ପାଇଁ ଅନୁରୋଧ ଏବଂ ଯାତ୍ରୀ ଚାହିଦା ବିଶ୍ଳେଷଣ କରେ।",adminPlanning:"ପ୍ରଶାସନିକ ଯୋଜନା",adminDescription:"ଅନୁରୋଧ ସମୀକ୍ଷା କରନ୍ତୁ, AI ପରାମର୍ଶ ଯାଞ୍ଚ କରନ୍ତୁ ଏବଂ ପ୍ରସ୍ତାବିତ ସମୟସୂଚୀ ପରିଚାଳନା କରନ୍ତୁ।",purposeEyebrow:"ଆମର ଲକ୍ଷ୍ୟ",purposeTitle:"ତଥ୍ୟ ଆଧାରିତ ପରିବହନ ଯୋଜନା ମାଧ୍ୟମରେ ଗ୍ରାମୀଣ ସମୁଦାୟକୁ ଯୋଡ଼ିବା।",openApp:"SmartRoute AI ଖୋଲନ୍ତୁ"},
  as:{navHome:"মুখ্য পৃষ্ঠা",navFeatures:"বৈশিষ্ট্যসমূহ",navAbout:"আমাৰ বিষয়ে",languageLabel:"ভাষা",eyebrow:"উন্নত গ্ৰাম্য পৰিবহণ",heroTitle:"প্ৰতিখন গাঁৱৰ বাবে",heroTitleAccent:"উন্নত বাছ সেৱা।",heroDescription:"পথ বিচাৰক, যাত্ৰাৰ প্ৰয়োজনীয়তা জনাওক আৰু চাহিদাভিত্তিক পৰামৰ্শৰে গ্ৰাম্য পৰিবহণ উন্নত কৰক।",explore:"বৈশিষ্ট্য চাওক",panelTitle:"পৰিবহণ পৰিকল্পনা",startingPoint:"আৰম্ভণিৰ স্থান",village:"গাঁও",destination:"গন্তব্যস্থান",nearbyTown:"ওচৰৰ চহৰ",panelNote:"যাত্ৰীৰ চাহিদাই প্ৰশাসকসকলক উন্নত সেৱাৰ পৰিকল্পনা কৰাত সহায় কৰে।",featuresEyebrow:"ৱেবছাইটৰ সুবিধাসমূহ",featuresTitle:"সহজ সঁজুলি, উন্নত পৰিকল্পনা",featuresDescription:"যাত্ৰীসকলে সেৱাৰ অনুৰোধ কৰিব পাৰে আৰু প্ৰশাসকসকলে পৰিবহণৰ প্ৰয়োজনীয়তা পৰ্যালোচনা কৰিব পাৰে।",routeFinder:"পথ বিচাৰক",routeDescription:"আৰম্ভণিৰ স্থানৰ পৰা গন্তব্যস্থানলৈ উপলব্ধ পথ বিচাৰক।",passengerRequests:"যাত্ৰীৰ অনুৰোধ",requestDescription:"পথ বা বাছৰ সময় আপোনাৰ প্ৰয়োজন অনুসৰি নহ'লে অনুৰোধ জমা দিয়ক।",aiAgent:"AI এজেণ্ট",agentDescription:"সেৱাৰ উন্নতিৰ পৰামৰ্শ দিবলৈ অনুৰোধ আৰু যাত্ৰীৰ চাহিদা বিশ্লেষণ কৰে।",adminPlanning:"প্ৰশাসনিক পৰিকল্পনা",adminDescription:"অনুৰোধ পৰ্যালোচনা কৰক, AI পৰামৰ্শ চাওক আৰু প্ৰস্তাৱিত সময়সূচী পৰিচালনা কৰক।",purposeEyebrow:"আমাৰ উদ্দেশ্য",purposeTitle:"তথ্যভিত্তিক পৰিবহণ পৰিকল্পনাৰে গ্ৰাম্য সমাজসমূহক সংযোগ কৰা।",openApp:"SmartRoute AI খোলক"},
  ur:{navHome:"صفحۂ اول",navFeatures:"خصوصیات",navAbout:"ہمارے بارے میں",languageLabel:"زبان",eyebrow:"بہتر دیہی آمدورفت",heroTitle:"ہر گاؤں کے لیے",heroTitleAccent:"بہتر بس سروس۔",heroDescription:"راستے تلاش کریں، سفر کی ضروریات بتائیں اور طلب پر مبنی تجاویز سے دیہی آمدورفت بہتر بنائیں۔",explore:"خصوصیات دیکھیں",panelTitle:"آمدورفت کی منصوبہ بندی",startingPoint:"آغاز کا مقام",village:"گاؤں",destination:"منزل",nearbyTown:"قریبی شہر",panelNote:"مسافروں کی طلب منتظمین کو بہتر خدمات کی منصوبہ بندی میں مدد دیتی ہے۔",featuresEyebrow:"ویب سائٹ کی سہولیات",featuresTitle:"آسان ٹولز، بہتر منصوبہ بندی",featuresDescription:"مسافر خدمات کی درخواست دے سکتے ہیں اور منتظمین آمدورفت کی ضروریات کا جائزہ لے سکتے ہیں۔",routeFinder:"راستہ تلاش کریں",routeDescription:"آغاز کے مقام سے منزل تک دستیاب راستے تلاش کریں۔",passengerRequests:"مسافروں کی درخواستیں",requestDescription:"اگر راستہ یا بس کا وقت آپ کی ضرورت کے مطابق نہ ہو تو درخواست جمع کریں۔",aiAgent:"AI ایجنٹ",agentDescription:"خدمات بہتر بنانے کی تجاویز کے لیے درخواستوں اور مسافروں کی طلب کا تجزیہ کرتا ہے۔",adminPlanning:"انتظامی منصوبہ بندی",adminDescription:"درخواستوں کا جائزہ لیں، AI تجاویز دیکھیں اور مجوزہ اوقات کا انتظام کریں۔",purposeEyebrow:"ہمارا مقصد",purposeTitle:"ڈیٹا پر مبنی آمدورفت کی منصوبہ بندی سے دیہی برادریوں کو جوڑنا۔",openApp:"SmartRoute AI کھولیں"}
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
    document.documentElement.dir = selected === "ur" ? "rtl" : "ltr";
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
