import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, onSnapshot, query, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { ethers } from 'ethers';

// --- Icon Components (using lucide-react SVGs for self-containment) ---
const BookOpen = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
  </svg>
);
const Award = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 17 17 23 15.79 13.88"></polyline>
  </svg>
);
const Users = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);
const MessageSquare = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
);
const CheckCircle = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);
const XCircle = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>
  </svg>
);
const ChevronRight = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);
const Loader2 = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
);

// --- CONTEXT for Auth, DB, and Web3 ---
const AppContext = createContext();

// --- Main App Component ---
export default function App() {
  // --- STATE MANAGEMENT ---
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(0);

  const [courses, setCourses] = useState([]);
  const [userData, setUserData] = useState(null);
  
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  
  const [isLoading, setIsLoading] = useState(true);

  // --- MOCK DATA & CONFIG ---
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'learn-to-earn-default';
  
  // IMPORTANT: Replace with your actual deployed BEP20 Token Contract Address
  const TOKEN_CONTRACT_ADDRESS = "0x...YourTokenContractAddressHere"; 
  // A simple ABI for getting balance and transfering (for simulation)
  const TOKEN_ABI = [
      "function balanceOf(address owner) view returns (uint256)",
      "function transfer(address to, uint256 amount) returns (bool)",
  ];

  const MOCK_COURSES = [
    {
      id: "bsc101",
      title: "Introduction to Blockchain & BSC",
      description: "Understand the fundamentals of blockchain technology and the Binance Smart Chain ecosystem.",
      tier: "free",
      modules: [
        { id: "mod1", title: "What is a Blockchain?", content: "Long-form text content explaining blockchain concepts...", quiz: [{ q: "What is a distributed ledger?", a: ["A shared database", "A private company", "A type of cryptocurrency"], c: 0 }] },
        { id: "mod2", title: "Understanding Smart Contracts", content: "Exploring the power of self-executing contracts...", quiz: [{ q: "Smart contracts are...", a: ["Self-executing", "Legal documents", "Physical contracts"], c: 0 }] },
      ]
    },
    {
      id: "solidity201",
      title: "Advanced Solidity Programming",
      description: "Dive deep into smart contract development with advanced patterns and security best practices.",
      tier: "premium",
      requiredHoldings: 1000,
      modules: [
        { id: "mod1", title: "Advanced Design Patterns", content: "...", quiz: [{ q: "What is the factory pattern?", a: ["...", "...", "..."], c: 0 }] },
        { id: "mod2", title: "Security and Auditing", content: "...", quiz: [{ q: "What is a re-entrancy attack?", a: ["...", "...", "..."], c: 0 }] },
      ]
    },
    {
        id: "dao101",
        title: "Mastering Decentralized Governance",
        description: "Learn how to participate in and build Decentralized Autonomous Organizations.",
        tier: "free",
        modules: [
            { id: "mod1", title: "What is a DAO?", content: "Exploring the concept of DAOs...", quiz: [{ q: "What does DAO stand for?", a: ["Decentralized Autonomous Organization", "Digital Asset Organization", "Data Access Object"], c: 0 }] },
        ]
    }
  ];

  // --- HELPER FUNCTIONS ---
  const showNotification = (message, type = 'success', duration = 3000) => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), duration);
  };
  
  // --- FIREBASE INITIALIZATION AND AUTH ---
  useEffect(() => {
    try {
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        const app = initializeApp(firebaseConfig);
        const firestoreDb = getFirestore(app);
        const firestoreAuth = getAuth(app);
        
        setDb(firestoreDb);
        setAuth(firestoreAuth);

        onAuthStateChanged(firestoreAuth, async (user) => {
          if (user) {
            setUserId(user.uid);
          } else {
             // If no token, sign in anonymously for basic access. 
             // Real app might redirect to a login page.
            if (typeof __initial_auth_token !== 'undefined') {
                await signInWithCustomToken(firestoreAuth, __initial_auth_token);
            } else {
                await signInAnonymously(firestoreAuth);
            }
          }
          setIsAuthReady(true);
        });

    } catch (e) {
        console.error("Firebase initialization failed:", e);
        setIsAuthReady(true); // Still proceed to unblock UI
    }
  }, []);
  
  // --- DATA SEEDING AND FETCHING ---
  useEffect(() => {
    if (!isAuthReady || !db) return;

    const seedData = async () => {
        const coursesCollectionRef = collection(db, `artifacts/${appId}/public/data/courses`);
        const snapshot = await getDocs(coursesCollectionRef);
        if (snapshot.empty) {
            console.log("Seeding course data...");
            for (const course of MOCK_COURSES) {
                const courseDocRef = doc(db, `artifacts/${appId}/public/data/courses`, course.id);
                await setDoc(courseDocRef, { 
                    title: course.title, 
                    description: course.description,
                    tier: course.tier,
                    requiredHoldings: course.requiredHoldings || 0,
                    modules: course.modules
                });
            }
        }
    };
    
    const fetchCourses = async () => {
        const coursesCollectionRef = collection(db, `artifacts/${appId}/public/data/courses`);
        const coursesSnapshot = await getDocs(coursesCollectionRef);
        const coursesList = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCourses(coursesList);
        setIsLoading(false);
    };

    seedData();
    fetchCourses();
  }, [isAuthReady, db]);

  // --- USER DATA LISTENER ---
  useEffect(() => {
    if (!isAuthReady || !db || !userId) return;
    const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);
    
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        setUserData(doc.data());
      } else {
        // Create a new user profile if it doesn't exist
        setDoc(userDocRef, { enrolledCourses: {}, completedModules: {}, certificates: [] });
      }
    });

    return () => unsubscribe();
  }, [isAuthReady, db, userId]);
  

  // --- WEB3 FUNCTIONS ---
  const connectWallet = useCallback(async () => {
    if (window.ethereum) {
      try {
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        await web3Provider.send("eth_requestAccounts", []);
        const web3Signer = await web3Provider.getSigner();
        const address = await web3Signer.getAddress();

        setProvider(web3Provider);
        setSigner(web3Signer);
        setWalletAddress(address);
        showNotification(`Wallet connected: ${address.substring(0,6)}...${address.substring(38)}`);
      } catch (error) {
        console.error("Wallet connection failed:", error);
        showNotification("Wallet connection failed.", 'error');
      }
    } else {
      showNotification("Please install MetaMask!", 'error');
    }
  }, []);

  // Update token balance when wallet is connected
  useEffect(() => {
    if (!signer || !TOKEN_CONTRACT_ADDRESS.startsWith('0x')) return;

    const getTokenBalance = async () => {
        // This is a simulation. In a real app, you would use the actual token contract.
        // For now, let's just mock a balance.
        setTokenBalance(Math.floor(Math.random() * 5000));
        /*
        // REAL IMPLEMENTATION
        const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_ABI, signer);
        try {
            const balance = await tokenContract.balanceOf(walletAddress);
            setTokenBalance(ethers.formatUnits(balance, 18)); // Assuming 18 decimals
        } catch (error) {
            console.error("Failed to fetch token balance:", error);
            setTokenBalance(0);
        }
        */
    };
    getTokenBalance();
  }, [signer, walletAddress]);

  const contextValue = {
    // State
    db, auth, userId, isAuthReady, appId,
    provider, signer, walletAddress, tokenBalance, setTokenBalance,
    courses, userData,
    currentPage, setCurrentPage,
    selectedCourseId, setSelectedCourseId,
    // Functions
    showNotification, connectWallet,
  };

  if (!isAuthReady) {
    return <LoadingScreen message="Initializing Platform..." />;
  }

  return (
    <AppContext.Provider value={contextValue}>
      <div className="bg-slate-50 min-h-screen font-sans text-slate-800">
        <Notification />
        <Navbar />
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            {!walletAddress ? <ConnectWalletPrompt /> : <PageContent />}
        </main>
      </div>
    </AppContext.Provider>
  );
}

// --- SUB-COMPONENTS ---
const PageContent = () => {
    const { currentPage, isLoading } = useContext(AppContext);

    if (isLoading) {
        return <LoadingScreen message="Loading Courses..." />;
    }

    switch(currentPage) {
        case 'dashboard': return <Dashboard />;
        case 'course': return <CoursePage />;
        case 'dao': return <DAOPage />;
        case 'forum': return <ForumPage />;
        case 'profile': return <ProfilePage />;
        default: return <Dashboard />;
    }
}

const LoadingScreen = ({ message }) => (
    <div className="flex flex-col items-center justify-center min-h-screen -mt-20">
        <Loader2 className="animate-spin text-indigo-500 h-12 w-12" />
        <p className="mt-4 text-lg text-slate-600">{message}</p>
    </div>
);

const Navbar = () => {
  const { walletAddress, tokenBalance, setCurrentPage, connectWallet } = useContext(AppContext);

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <BookOpen className="h-8 w-8 text-indigo-600" />
            <span className="text-2xl font-bold text-slate-800">LearnChain</span>
            <div className="hidden md:flex items-center space-x-2 pl-4">
                <button onClick={() => setCurrentPage('dashboard')} className="px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100">Dashboard</button>
                <button onClick={() => setCurrentPage('dao')} className="px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100">DAO</button>
                <button onClick={() => setCurrentPage('forum')} className="px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100">Forum</button>
                <button onClick={() => setCurrentPage('profile')} className="px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100">Profile</button>
            </div>
          </div>
          <div className="flex items-center">
            {walletAddress ? (
              <div className="flex items-center space-x-4">
                <div className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full text-sm font-semibold flex items-center">
                    <Award className="w-4 h-4 mr-2" />
                    {Number(tokenBalance).toLocaleString()} LRN
                </div>
                <div className="bg-slate-100 px-3 py-1.5 rounded-full text-sm font-medium">
                  {walletAddress.substring(0, 6)}...{walletAddress.substring(38)}
                </div>
              </div>
            ) : (
              <button onClick={connectWallet} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
};

const Notification = () => {
  const { show, message, type } = useContext(AppContext).notification;
  if (!show) return null;

  const baseStyle = "fixed top-5 right-5 z-50 p-4 rounded-lg shadow-lg text-white text-sm font-semibold flex items-center";
  const typeStyle = type === 'success' ? 'bg-green-500' : 'bg-red-500';
  const Icon = type === 'success' ? CheckCircle : XCircle;

  return (
    <div className={`${baseStyle} ${typeStyle}`}>
        <Icon className="w-5 h-5 mr-2" />
        {message}
    </div>
  );
};

const ConnectWalletPrompt = () => {
    const { connectWallet } = useContext(AppContext);
    return (
        <div className="text-center bg-white p-12 rounded-xl shadow-md mt-10">
            <h2 className="text-2xl font-bold mb-2">Welcome to LearnChain!</h2>
            <p className="text-slate-600 mb-6">Connect your wallet to begin your learning journey and start earning rewards.</p>
            <button onClick={connectWallet} className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors">
                Connect Wallet
            </button>
        </div>
    );
}

const Dashboard = () => {
    const { courses, setCurrentPage, setSelectedCourseId, userData, tokenBalance } = useContext(AppContext);

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Course Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.map(course => {
                    const isEnrolled = userData?.enrolledCourses?.[course.id];
                    const isPremium = course.tier === 'premium';
                    const hasAccess = !isPremium || (isPremium && tokenBalance >= course.requiredHoldings);
                    const completedModules = userData?.completedModules?.[course.id] ? Object.keys(userData.completedModules[course.id]).length : 0;
                    const totalModules = course.modules.length;
                    const progress = totalModules > 0 ? (completedModules / totalModules) * 100 : 0;

                    return (
                        <div key={course.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col">
                            <div className="p-6 flex-grow">
                                {isPremium && <span className="text-xs font-bold uppercase text-indigo-500 bg-indigo-100 px-2 py-1 rounded-full mb-2 inline-block">Premium</span>}
                                <h2 className="text-xl font-bold mb-2">{course.title}</h2>
                                <p className="text-slate-600 text-sm mb-4 flex-grow">{course.description}</p>
                            </div>
                            <div className="p-6 bg-slate-50">
                                {isEnrolled && (
                                    <div className="mb-4">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-medium text-slate-700">Progress</span>
                                            <span className="text-sm font-bold text-indigo-600">{completedModules}/{totalModules} Modules</span>
                                        </div>
                                        <div className="w-full bg-slate-200 rounded-full h-2.5">
                                            <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={() => { setSelectedCourseId(course.id); setCurrentPage('course'); }}
                                    className={`w-full py-2 px-4 rounded-lg font-semibold text-center transition-colors ${!hasAccess ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                    disabled={!hasAccess}
                                >
                                    {isEnrolled ? "Continue Learning" : (isPremium && !hasAccess ? `Requires ${course.requiredHoldings} LRN` : "View Course")}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const CoursePage = () => {
    const { courses, selectedCourseId, userData, db, userId, appId, showNotification, setTokenBalance } = useContext(AppContext);
    const [isEnrolling, setIsEnrolling] = useState(false);
    const [isCompleting, setIsCompleting] = useState(null); // moduleId

    const course = courses.find(c => c.id === selectedCourseId);

    if (!course) return <div>Course not found.</div>;

    const isEnrolled = userData?.enrolledCourses?.[course.id];

    const handleEnroll = async () => {
        setIsEnrolling(true);
        showNotification('Enrolling in course...', 'success');
        // --- SIMULATED BLOCKCHAIN TRANSACTION ---
        // In a real app, this would call a smart contract function:
        // `platformContract.enroll(courseId)` which might require a small fee.
        await new Promise(res => setTimeout(res, 1500));

        const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);
        await setDoc(userDocRef, { 
            enrolledCourses: { ...userData.enrolledCourses, [course.id]: true } 
        }, { merge: true });

        setIsEnrolling(false);
        showNotification('Successfully enrolled!', 'success');
    };

    const handleCompleteModule = async (moduleId) => {
        setIsCompleting(moduleId);
        // --- SIMULATED QUIZ & REWARD ---
        showNotification('Completing quiz...', 'success');
        await new Promise(res => setTimeout(res, 2000));
        
        // Mark module as complete in Firestore
        const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);
        const newCompleted = userData.completedModules || {};
        if (!newCompleted[course.id]) {
            newCompleted[course.id] = {};
        }
        newCompleted[course.id][moduleId] = true;
        
        await setDoc(userDocRef, { completedModules: newCompleted }, { merge: true });

        // --- SIMULATED TOKEN REWARD ---
        // This would be triggered by a smart contract event after on-chain verification
        const rewardAmount = 10; // e.g. 10 LRN tokens per module
        setTokenBalance(prev => prev + rewardAmount);

        setIsCompleting(null);
        showNotification(`Module complete! +${rewardAmount} LRN tokens earned.`, 'success');
    };
    
    return (
        <div>
            <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
            <p className="text-slate-600 mb-6">{course.description}</p>
            
            {!isEnrolled && (
                <button onClick={handleEnroll} disabled={isEnrolling} className="bg-green-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-600 flex items-center">
                    {isEnrolling && <Loader2 className="animate-spin mr-2"/>}
                    Enroll Now
                </button>
            )}

            {isEnrolled && (
                <div className="mt-8 space-y-4">
                    <h2 className="text-2xl font-bold">Modules</h2>
                    {course.modules.map((module, index) => {
                        const isCompleted = userData?.completedModules?.[course.id]?.[module.id];
                        return (
                        <div key={module.id} className="bg-white p-4 rounded-lg shadow-sm flex justify-between items-center">
                            <div className="flex items-center">
                                {isCompleted ? (
                                    <CheckCircle className="w-8 h-8 text-green-500 mr-4"/>
                                ) : (
                                    <div className="w-8 h-8 flex items-center justify-center bg-slate-200 text-slate-600 font-bold rounded-full mr-4">{index + 1}</div>
                                )}
                                <div>
                                    <h3 className="font-semibold">{module.title}</h3>
                                    <p className="text-sm text-slate-500">{module.content.substring(0, 50)}...</p>
                                </div>
                            </div>
                            {!isCompleted ? (
                                <button onClick={() => handleCompleteModule(module.id)} disabled={isCompleting === module.id} className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 flex items-center">
                                    {isCompleting === module.id && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                                    Take Quiz
                                </button>
                            ) : (
                                <span className="text-sm font-semibold text-green-600">Completed</span>
                            )}
                        </div>
                    )})}
                </div>
            )}
        </div>
    );
};

const ProfilePage = () => {
    const { userData, showNotification } = useContext(AppContext);
    const [isMinting, setIsMinting] = useState(null);

    const handleMintCertificate = async (courseId) => {
        setIsMinting(courseId);
        showNotification(`Minting certificate for ${courseId}...`, 'success');
        // --- SIMULATED NFT MINTING ---
        // Real app calls: `nftContract.mint(userAddress, courseId, tokenURI)`
        await new Promise(res => setTimeout(res, 2500));
        
        // This would be done in a backend after listening to a contract event
        const userDocRef = doc(AppContext.db, `artifacts/${AppContext.appId}/users/${AppContext.userId}/profile/data`);
        const updatedCerts = [...(userData.certificates || []), { courseId: courseId, date: new Date().toISOString() }];
        await setDoc(userDocRef, { certificates: updatedCerts }, { merge: true });

        setIsMinting(null);
        showNotification('Certificate NFT successfully minted!', 'success');
    }

    const completedCourses = Object.keys(userData?.completedModules || {}).filter(courseId => {
        const course = AppContext.courses.find(c => c.id === courseId);
        if (!course) return false;
        const completedCount = Object.keys(userData.completedModules[courseId]).length;
        return completedCount === course.modules.length;
    });
    
    const mintedCertificates = userData?.certificates?.map(c => c.courseId) || [];

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">My Profile</h1>
            <div className="bg-white p-6 rounded-xl shadow-md">
                <h2 className="text-2xl font-bold mb-4">Achievements & Certificates</h2>
                {completedCourses.length === 0 && <p className="text-slate-500">Complete a course to earn a certificate!</p>}
                <div className="space-y-4">
                {completedCourses.map(courseId => {
                    const course = AppContext.courses.find(c => c.id === courseId);
                    const isMinted = mintedCertificates.includes(courseId);
                    return (
                        <div key={courseId} className="border p-4 rounded-lg flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-lg">{course?.title}</h3>
                                <p className="text-sm text-slate-600">Course Completed!</p>
                            </div>
                            {isMinted ? (
                                <span className="flex items-center text-green-600 font-semibold bg-green-100 px-3 py-1 rounded-full">
                                    <CheckCircle className="w-4 h-4 mr-2"/>
                                    NFT Minted
                                </span>
                            ) : (
                                <button onClick={() => handleMintCertificate(courseId)} disabled={isMinting === courseId} className="bg-purple-600 text-white text-sm px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 flex items-center">
                                    {isMinting === courseId && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                                    Mint Certificate NFT
                                </button>
                            )}
                        </div>
                    );
                })}
                </div>
            </div>
        </div>
    );
};

const DAOPage = () => {
    // Mock data for DAO proposals
    const [proposals] = useState([
        { id: 1, title: "Increase module rewards to 15 LRN", status: "active", votesFor: 12500, votesAgainst: 3400 },
        { id: 2, title: "Fund a new 'Advanced AI' course development", status: "active", votesFor: 8800, votesAgainst: 5200 },
        { id: 3, title: "Partner with Example University", status: "passed", votesFor: 25000, votesAgainst: 1200 },
        { id: 4, title: "Decrease staking requirement for premium courses", status: "failed", votesFor: 4000, votesAgainst: 15000 },
    ]);
    const { showNotification, tokenBalance } = useContext(AppContext);
    const [votedOn, setVotedOn] = useState({});
    const [isVoting, setIsVoting] = useState(null);

    const handleVote = async (proposalId) => {
        setIsVoting(proposalId);
        showNotification(`Casting your vote for proposal #${proposalId}...`, 'success');
        // --- SIMULATED DAO VOTE ---
        // Real app calls: `daoContract.vote(proposalId, voteType, votingPower)`
        // Your voting power would be your tokenBalance
        await new Promise(res => setTimeout(res, 1500));

        setVotedOn(prev => ({...prev, [proposalId]: true}));
        setIsVoting(null);
        showNotification(`Successfully voted with ${tokenBalance.toLocaleString()} power!`, 'success');
    }

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">DAO Governance</h1>
            <p className="text-slate-600 mb-4">Use your LRN token balance to vote on proposals and shape the future of the platform. Your voting power is equal to your token balance.</p>
            <div className="bg-white p-6 rounded-xl shadow-md mb-8">
                <h3 className="text-xl font-bold">Your Voting Power</h3>
                <p className="text-3xl font-bold text-indigo-600">{tokenBalance.toLocaleString()} LRN</p>
            </div>
            <div className="space-y-4">
                {proposals.map(p => {
                    const totalVotes = p.votesFor + p.votesAgainst;
                    const forPercentage = totalVotes > 0 ? (p.votesFor / totalVotes) * 100 : 0;
                    const againstPercentage = totalVotes > 0 ? (p.votesAgainst / totalVotes) * 100 : 0;
                    return (
                        <div key={p.id} className="bg-white p-5 rounded-lg shadow-sm">
                            <div className="flex justify-between items-center mb-3">
                                <h2 className="text-lg font-bold">{p.title}</h2>
                                <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full ${p.status === 'active' ? 'bg-blue-100 text-blue-800' : p.status === 'passed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{p.status}</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-4 flex overflow-hidden mb-2">
                                <div className="bg-green-500 h-4 text-xs text-white flex items-center justify-center" style={{ width: `${forPercentage}%` }}></div>
                                <div className="bg-red-500 h-4 text-xs text-white flex items-center justify-center" style={{ width: `${againstPercentage}%` }}></div>
                            </div>
                             <div className="flex justify-between text-sm text-slate-600 mb-4">
                                <span>For: {p.votesFor.toLocaleString()}</span>
                                <span>Against: {p.votesAgainst.toLocaleString()}</span>
                            </div>
                            {p.status === 'active' && !votedOn[p.id] && (
                                <div className="flex space-x-2">
                                    <button onClick={() => handleVote(p.id)} disabled={isVoting === p.id} className="bg-green-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-600 text-sm w-full flex items-center justify-center">
                                        {isVoting === p.id && <Loader2 className="animate-spin mr-2 h-4 w-4" />} Vote FOR
                                    </button>
                                    <button onClick={() => handleVote(p.id)} disabled={isVoting === p.id} className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 text-sm w-full flex items-center justify-center">
                                         {isVoting === p.id && <Loader2 className="animate-spin mr-2 h-4 w-4" />} Vote AGAINST
                                    </button>
                                </div>
                            )}
                            {votedOn[p.id] && <p className="text-center font-semibold text-indigo-600">You have voted on this proposal.</p>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const ForumPage = () => {
    const { db, appId, userId, showNotification } = useContext(AppContext);
    const [posts, setPosts] = useState([]);
    const [newPost, setNewPost] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isPosting, setIsPosting] = useState(false);

    const postsCollectionRef = collection(db, `artifacts/${appId}/public/data/forumPosts`);

    useEffect(() => {
        const q = query(postsCollectionRef); // In a real app add orderBy('timestamp', 'desc') and ensure you have the index in Firestore
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const postsData = [];
            querySnapshot.forEach((doc) => {
                postsData.push({ id: doc.id, ...doc.data() });
            });
            // Manual sort because firestore orderBy needs an index
            postsData.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds);
            setPosts(postsData);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handlePostSubmit = async (e) => {
        e.preventDefault();
        if (newPost.trim() === "") return;

        setIsPosting(true);
        try {
            await addDoc(postsCollectionRef, {
                text: newPost,
                author: userId, // In a real app, you might store wallet address or a username
                timestamp: serverTimestamp()
            });
            setNewPost("");
            showNotification("Post submitted! +1 LRN for contributing.", 'success');
             // --- SIMULATED TOKEN REWARD FOR CONTRIBUTING ---
            AppContext.setTokenBalance(prev => prev + 1);
        } catch (error) {
            console.error("Error adding document: ", error);
            showNotification("Failed to submit post.", 'error');
        }
        setIsPosting(false);
    };

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Community Forum</h1>
            <p className="text-slate-600 mb-6">Ask questions, help others, and create study guides. Earn LRN tokens for valuable contributions!</p>
            <div className="bg-white p-6 rounded-xl shadow-md mb-8">
                <form onSubmit={handlePostSubmit}>
                    <textarea 
                        value={newPost}
                        onChange={(e) => setNewPost(e.target.value)}
                        placeholder="Share your thoughts or ask a question..."
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                        rows="3"
                    ></textarea>
                    <button type="submit" disabled={isPosting} className="mt-3 bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-700 flex items-center">
                        {isPosting && <Loader2 className="animate-spin mr-2"/>}
                        Submit Post
                    </button>
                </form>
            </div>

            <div className="space-y-4">
                {isLoading ? <p>Loading posts...</p> : posts.map(post => (
                    <div key={post.id} className="bg-white p-5 rounded-lg shadow-sm">
                        <p className="text-slate-800">{post.text}</p>
                        <div className="text-xs text-slate-400 mt-3 flex justify-between">
                            <span>By: User...{post.author.slice(-6)}</span>
                            <span>{post.timestamp ? new Date(post.timestamp.seconds * 1000).toLocaleString() : 'Just now'}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}


