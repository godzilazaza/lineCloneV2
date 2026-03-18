import React, { useState, useEffect, useRef, Component } from 'react';
import { toPng } from 'html-to-image';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  setDoc, 
  doc, 
  getDoc, 
  updateDoc, 
  serverTimestamp, 
  orderBy, 
  limit, 
  getDocs,
  Timestamp,
  deleteDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { 
  MessageSquare, 
  Users, 
  User as UserIcon, 
  Search, 
  Send, 
  MoreVertical, 
  ArrowLeft, 
  Plus,
  LogOut,
  Settings,
  Image as ImageIcon,
  Smile,
  Phone,
  Video,
  ChevronLeft,
  Menu,
  Camera,
  Mic,
  ShieldCheck,
  Navigation,
  Wifi,
  Shield,
  Star,
  History,
  List,
  Check,
  Trash2,
  Upload,
  Forward
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { UserProfile, Chat, Message, OperationType, FirestoreErrorInfo } from './types';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Utility to resize image
const resizeImage = (input: File | string, maxWidth: number = 1024, maxHeight: number = 1024): Promise<string> => {
  return new Promise((resolve, reject) => {
    const processImage = (src: string) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        // Compress to JPEG with 0.6 quality to ensure it fits in Firestore 1MB limit
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = reject;
    };

    if (typeof input === 'string') {
      processImage(input);
    } else {
      const reader = new FileReader();
      reader.readAsDataURL(input);
      reader.onload = (event) => processImage(event.target?.result as string);
      reader.onerror = reject;
    }
  });
};

// Error Handling
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Error Boundary
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  override render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = `Firebase Error: ${parsed.error}`;
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="flex flex-col items-center justify-center h-screen p-4 bg-red-50 text-red-900">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="text-center mb-6">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Utilities ---

// --- Components ---

const VerifiedBadge = ({ className }: { className?: string }) => (
  <div className={cn("relative flex items-center justify-center w-4 h-4", className)}>
    <ShieldCheck className="w-full h-full fill-[#06C755] text-[#06C755]" />
    <Star className="w-[45%] h-[45%] fill-white text-white absolute" />
  </div>
);

const MOCK_USERS: UserProfile[] = [
  { uid: 'user-1', displayName: 'LINE Official', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=line', statusMessage: 'Welcome to LINE!', isOfficial: true },
  { uid: 'user-2', displayName: 'User B', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user2', statusMessage: 'Hello, I am User B' },
  { uid: 'user-3', displayName: 'Support Team', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=support', statusMessage: 'How can we help?', isOfficial: true },
  { uid: 'user-4', displayName: 'User D', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user4', statusMessage: 'Hello, I am User D' },
];

const StatusBar = ({ dark }: { dark?: boolean }) => {
  const [time, setTime] = useState(new Date());
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [manualTime, setManualTime] = useState<string | null>(null);
  const [batteryLevel, setBatteryLevel] = useState('80');
  const [isEditingBattery, setIsEditingBattery] = useState(false);

  useEffect(() => {
    if (manualTime) return;
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [manualTime]);

  const displayTime = manualTime || format(time, 'HH:mm');

  return (
    <div className={cn(
      "h-11 px-6 flex justify-between items-center text-[15px] font-semibold select-none transition-colors duration-300 z-[60]",
      dark ? "bg-[#191919] text-white" : "bg-white text-black"
    )}>
      <div className="flex items-center gap-1">
        <div onClick={() => setIsEditingTime(true)} className="cursor-pointer min-w-[40px]">
          {isEditingTime ? (
            <input
              type="text"
              value={displayTime}
              onChange={(e) => setManualTime(e.target.value)}
              onBlur={() => setIsEditingTime(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingTime(false)}
              autoFocus
              className="bg-transparent border-none p-0 w-12 focus:outline-none text-[15px] font-semibold"
            />
          ) : (
            <span>{displayTime}</span>
          )}
        </div>
        <Navigation className={cn("w-3.5 h-3.5 fill-current rotate-[15deg]", dark ? "text-white" : "text-black")} />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5 h-2.5 items-end">
          <div className={cn("w-[3px] h-[40%] rounded-full", dark ? "bg-white" : "bg-black")}></div>
          <div className={cn("w-[3px] h-[60%] rounded-full", dark ? "bg-white" : "bg-black")}></div>
          <div className={cn("w-[3px] h-[80%] rounded-full", dark ? "bg-white" : "bg-black")}></div>
          <div className={cn("w-[3px] h-[100%] rounded-full opacity-30", dark ? "bg-white" : "bg-black")}></div>
        </div>
        <Wifi className="w-4 h-4" />
        <div 
          onClick={() => setIsEditingBattery(true)}
          className={cn(
            "w-[26px] h-[13px] border rounded-[4px] relative flex items-center justify-start px-[1px] cursor-pointer",
            dark ? "border-white/30" : "border-black/30"
          )}
        >
          <div 
            className={cn("h-[9px] rounded-[2px]", dark ? "bg-white" : "bg-black")}
            style={{ width: `${Math.min(100, Math.max(0, parseInt(batteryLevel) || 0))}%` }}
          ></div>
          <div className={cn(
            "absolute inset-0 flex items-center justify-center text-[8px] font-black tracking-tighter",
            dark ? "text-black" : "text-white"
          )}>
            {isEditingBattery ? (
              <input
                type="text"
                value={batteryLevel}
                onChange={(e) => setBatteryLevel(e.target.value)}
                onBlur={() => setIsEditingBattery(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingBattery(false)}
                autoFocus
                className="bg-transparent border-none p-0 w-full text-center focus:outline-none text-[8px] font-black"
              />
            ) : (
              <span>{batteryLevel}</span>
            )}
          </div>
          <div className={cn("absolute -right-[3.5px] top-1/2 -translate-y-1/2 w-[1.5px] h-[4px] rounded-r-full", dark ? "bg-white/30" : "bg-black/30")}></div>
        </div>
      </div>
    </div>
  );
};

const HomeIndicator = ({ dark }: { dark?: boolean }) => (
  <div className={cn("w-full flex justify-center pb-2 z-50 transition-colors duration-300", dark ? "bg-[#191919]" : "bg-white")}>
    <div className={cn("w-32 h-1.5 rounded-full", dark ? "bg-white/20" : "bg-black/20")}></div>
  </div>
);

const Login = ({ onLogin, users }: { onLogin: (user: UserProfile) => void, users: UserProfile[] }) => {
  const displayUsers = users.length > 0 ? users.filter(u => u.uid.startsWith('user-')) : MOCK_USERS;
  
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#06C755]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-[40px] shadow-2xl flex flex-col items-center max-w-sm w-full mx-4"
      >
        <div className="w-24 h-24 bg-[#06C755] rounded-[32px] flex items-center justify-center mb-8 shadow-inner">
          <MessageSquare className="text-white w-14 h-14" />
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tighter">LINE</h1>
        <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-10">Clone</p>
        
        <div className="w-full space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 text-center">Select your account</p>
          <div className="grid grid-cols-2 gap-4 w-full">
            {displayUsers.map((u) => (
              <button 
                key={u.uid}
                onClick={() => onLogin(u)}
                className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-3xl hover:bg-gray-100 transition-all hover:scale-105 active:scale-95 border border-transparent hover:border-gray-200"
              >
                <img src={u.photoURL} className="w-16 h-16 rounded-2xl object-cover shadow-sm bg-white" alt={u.displayName} referrerPolicy="no-referrer" />
                <span className="font-bold text-sm text-gray-800 truncate w-full text-center">{u.displayName}</span>
              </button>
            ))}
          </div>
        </div>
        
        <p className="mt-10 text-[10px] text-gray-300 font-medium uppercase tracking-widest">© 2026 LINE CLONE</p>
      </motion.div>
    </div>
  );
};

const ChatItem = ({ chat, currentUser, onClick, onDelete }: { chat: Chat, currentUser: User, onClick: () => void, onDelete: (e: React.MouseEvent) => void }) => {
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDelete, setShowDelete] = useState(false);
  const isGroup = chat.type === 'group';
  const otherUserId = !isGroup ? chat.participants.find(id => id !== currentUser.uid) : null;

  useEffect(() => {
    if (isGroup || !otherUserId) return;
    const unsub = onSnapshot(doc(db, 'users', otherUserId), (doc) => {
      if (doc.exists()) {
        setOtherUser(doc.data() as UserProfile);
      }
    });
    return unsub;
  }, [otherUserId, isGroup]);

  useEffect(() => {
    const q = query(
      collection(db, 'chats', chat.id, 'messages'),
      where('senderId', '!=', currentUser.uid),
      where('read', '==', false)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });
    return unsub;
  }, [chat.id, currentUser.uid]);

  const chatName = isGroup ? chat.name : (otherUser?.displayName || 'Loading...');
  const memberCount = isGroup ? chat.participants.length : null;
  const photoURL = isGroup 
    ? (chat.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${chat.name}`)
    : (otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUserId}`);

  return (
    <div 
      className="relative group"
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      <button 
        onClick={onClick}
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100 text-left"
      >
        <div className="relative">
          <img 
            src={photoURL} 
            className="w-14 h-14 rounded-2xl object-cover bg-gray-100"
            alt="Avatar"
            referrerPolicy="no-referrer"
          />
          {!isGroup && <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-[#06C755] border-2 border-white rounded-full"></div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-baseline mb-0.5">
            <div className="flex items-center gap-1 min-w-0">
              <h3 className="font-bold text-gray-900 truncate text-[15px] flex-shrink min-w-0">{chatName}</h3>
              {memberCount !== null && <span className="font-bold text-gray-900 text-[15px] flex-shrink-0">({memberCount})</span>}
              {!isGroup && otherUser?.isOfficial && <VerifiedBadge />}
            </div>
            <span className="text-[10px] text-gray-400 font-medium">
              {chat.lastMessage?.customTime ?? (chat.lastMessage?.createdAt ? format(chat.lastMessage.createdAt.toDate(), 'HH:mm') : '')}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-[13px] text-gray-500 truncate flex-1 leading-snug">
              {chat.lastMessage?.text || 'No messages yet'}
            </p>
            {unreadCount > 0 && (
              <div className="bg-[#06C755] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ml-2">
                {unreadCount}
              </div>
            )}
          </div>
        </div>
      </button>
      
      {showDelete && (
        <button 
          onClick={onDelete}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition-colors shadow-sm z-10"
          title="Delete chat"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

const MessageItem = ({ msg, isMe, isGroup, showAvatar, showTail, currentUser, chatId, chat, onShare }: { msg: Message, isMe: boolean, isGroup: boolean, showAvatar: boolean, showTail: boolean, currentUser: User, chatId: string, chat: Chat, onShare?: (msg: Message) => void }) => {
  const [sender, setSender] = useState<UserProfile | null>(null);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editedTime, setEditedTime] = useState('');
  const [participants, setParticipants] = useState<UserProfile[]>([]);

  useEffect(() => {
    const fetchParticipants = async () => {
      const users: UserProfile[] = [];
      for (const uid of chat.participants) {
        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          users.push(docSnap.data() as UserProfile);
        }
      }
      setParticipants(users);
    };
    fetchParticipants();
  }, [chat.participants]);

  useEffect(() => {
    if (isMe) return;
    const fetchSender = async () => {
      const docRef = doc(db, 'users', msg.senderId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSender(docSnap.data() as UserProfile);
      }
    };
    fetchSender();
  }, [msg.senderId, isMe]);

  const msgDate = msg.createdAt?.toDate();

  useEffect(() => {
    if (isEditingTime) return;

    if (msg.customTime !== undefined && msg.customTime !== null) {
      setEditedTime(msg.customTime);
    } else if (msgDate) {
      setEditedTime(format(msgDate, 'HH:mm'));
    } else {
      setEditedTime('');
    }
  }, [msg.customTime, msgDate, isEditingTime]);

  const handleTimeUpdate = async () => {
    const currentTime = msg.customTime !== undefined && msg.customTime !== null 
      ? msg.customTime 
      : (msgDate ? format(msgDate, 'HH:mm') : '');

    if (editedTime === currentTime) {
      setIsEditingTime(false);
      return;
    }
    
    try {
      await updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), {
        customTime: editedTime
      });

      if (chat.lastMessage?.createdAt?.toMillis() === msg.createdAt?.toMillis() && 
          chat.lastMessage?.senderId === msg.senderId && 
          chat.lastMessage?.text === msg.text) {
        await updateDoc(doc(db, 'chats', chatId), {
          'lastMessage.customTime': editedTime
        });
      }
      
      setIsEditingTime(false);
    } catch (error) {
      console.error("Error updating time:", error);
    }
  };

  const renderTextWithMentions = (text: string, mentions?: string[]) => {
    if (!mentions || mentions.length === 0) return text;

    // Create a list of mention tags to look for
    const mentionTags = participants
      .filter(u => mentions.includes(u.uid))
      .map(u => `@${u.displayName.replace(/\s/g, '')}`);

    if (mentionTags.length === 0) return text;

    // Escape tags for regex and join with |
    const escapedTags = mentionTags.map(tag => tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedTags.join('|')})`, 'g');

    const parts = text.split(regex);
    return parts.map((part, i) => {
      if (mentionTags.includes(part)) {
        return (
          <span key={i} className="text-[#4D6AFF] font-bold cursor-pointer hover:underline">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className={cn("flex items-start gap-2", isMe ? "flex-row-reverse" : "flex-row", showTail ? "mt-3" : "mt-0.5")}>
      {!isMe && (
        <div className="w-10 h-10 flex-shrink-0">
          {showAvatar && (
            <img 
              src={sender?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderId}`} 
              className="w-10 h-10 rounded-[14px] object-cover bg-gray-800"
              alt="Avatar"
              referrerPolicy="no-referrer"
            />
          )}
        </div>
      )}
      <div className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
        {!isMe && isGroup && showAvatar && (
          <div className="flex items-center gap-1 mb-1 ml-1">
            <span className="text-[10px] text-gray-400 font-medium">{sender?.displayName || 'User'}</span>
            {sender?.isOfficial && <VerifiedBadge className="w-2.5 h-2.5" />}
          </div>
        )}
        <div className={cn("flex items-end gap-1.5", isMe ? "flex-row-reverse" : "flex-row")}>
          <div className={cn(
            "max-w-[260px] p-2.5 rounded-[18px] text-[14px] relative leading-tight",
            isMe ? "bg-[#06C755] text-black" : "bg-[#2C2C2E] text-white",
            isMe && showTail && "rounded-tr-none",
            !isMe && showTail && "rounded-tl-none",
            (msg.type === 'image' || msg.type === 'sticker') && "bg-transparent shadow-none p-0"
          )}>
            {/* Tail for Me */}
            {isMe && showTail && msg.type === 'text' && (
              <div className="absolute top-0 -right-1.5 w-3 h-3 bg-[#06C755]" style={{ clipPath: 'polygon(0 0, 0 100%, 100% 0)' }}></div>
            )}
            {/* Tail for Other */}
            {!isMe && showTail && msg.type === 'text' && (
              <div className="absolute top-0 -left-1.5 w-3 h-3 bg-[#2C2C2E]" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 0)' }}></div>
            )}

            {msg.type === 'image' ? (
              <div className="relative">
                <img src={msg.imageUrl} alt="Chat" className="max-w-full rounded-xl" referrerPolicy="no-referrer" />
              </div>
            ) : msg.type === 'sticker' ? (
              <img src={msg.stickerId} alt="Sticker" className="w-32 h-32" referrerPolicy="no-referrer" />
            ) : (
              <span className="whitespace-pre-wrap break-words">
                {renderTextWithMentions(msg.text, msg.mentions)}
              </span>
            )}
          </div>
          
          {/* Share Icon - Only for images and stickers */}
          {(msg.type === 'image' || msg.type === 'sticker') && (
            <button 
              onClick={() => onShare?.(msg)}
              className="flex items-center justify-center transition-all active:scale-95 w-10 h-10 rounded-full bg-black/60 text-white hover:bg-black/80 self-center"
              title="Share"
            >
              <Upload className="w-5 h-5" strokeWidth={2.5} />
            </button>
          )}

          <div className={cn("flex flex-col mb-0.5 min-w-[40px]", isMe ? "items-end" : "items-start")}>
            {isMe && msg.read && <span className="text-[9px] text-gray-400 font-medium leading-none mb-0.5">อ่านแล้ว</span>}
            
            {isEditingTime ? (
              <div className="flex flex-col items-center">
                <input 
                  type="text" 
                  value={editedTime}
                  onChange={(e) => setEditedTime(e.target.value)}
                  onBlur={handleTimeUpdate}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleTimeUpdate();
                    } else if (e.key === 'Escape') {
                      setIsEditingTime(false);
                      setEditedTime(msg.customTime ?? (msgDate ? format(msgDate, 'HH:mm') : ''));
                    }
                  }}
                  autoFocus
                  placeholder="Time..."
                  className="text-[10px] bg-white/10 text-gray-300 border border-gray-600 rounded px-1 w-14 focus:outline-none text-center"
                />
              </div>
            ) : (
              <button 
                type="button"
                className="text-[9px] text-gray-500 font-medium cursor-pointer hover:text-gray-300 hover:bg-white/5 rounded px-1 py-0.5 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingTime(true);
                }}
                title="Click to edit time"
              >
                {msg.customTime ?? (msgDate ? format(msgDate, 'HH:mm') : '...')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const STICKERS = [
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=happy',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=love',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=wow',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=cool',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=sad',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=angry',
];

const ForwardModal = ({ isOpen, onClose, chats, currentUser, onForward }: { isOpen: boolean, onClose: () => void, chats: Chat[], currentUser: User, onForward: (chatId: string) => void }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [chatDetails, setChatDetails] = useState<{ [key: string]: UserProfile }>({});

  useEffect(() => {
    const fetchOtherUsers = async () => {
      const details: { [key: string]: UserProfile } = {};
      for (const chat of chats) {
        if (chat.type === 'direct') {
          const otherId = chat.participants.find(id => id !== currentUser.uid);
          if (otherId) {
            const docSnap = await getDoc(doc(db, 'users', otherId));
            if (docSnap.exists()) {
              details[chat.id] = docSnap.data() as UserProfile;
            }
          }
        }
      }
      setChatDetails(details);
    };
    if (isOpen) fetchOtherUsers();
  }, [isOpen, chats, currentUser.uid]);

  const filteredChats = chats.filter(chat => {
    const name = chat.type === 'group' ? chat.name : chatDetails[chat.id]?.displayName;
    return name?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="bg-white w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Share to...</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search chats"
              className="w-full bg-gray-100 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          {filteredChats.map(chat => {
            const isGroup = chat.type === 'group';
            const name = isGroup ? chat.name : chatDetails[chat.id]?.displayName || 'Loading...';
            const photo = isGroup 
              ? (chat.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${chat.name}`)
              : (chatDetails[chat.id]?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.id}`);

            return (
              <button 
                key={chat.id}
                onClick={() => onForward(chat.id)}
                className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
              >
                <img src={photo} className="w-12 h-12 rounded-2xl object-cover bg-gray-100" alt="" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-900 truncate">{name}</h4>
                  <p className="text-xs text-gray-500">{isGroup ? 'Group Chat' : 'Direct Chat'}</p>
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

const ChatRoom = ({ chat, currentUser, onBack, allChats }: { chat: Chat, currentUser: User, onBack: () => void, allChats: Chat[] }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [showStickers, setShowStickers] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<UserProfile[]>([]);
  const [participants, setParticipants] = useState<UserProfile[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchParticipants = async () => {
      const users: UserProfile[] = [];
      for (const uid of chat.participants) {
        if (uid === currentUser.uid) continue;
        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          users.push(docSnap.data() as UserProfile);
        }
      }
      setParticipants(users);
    };
    fetchParticipants();
  }, [chat.participants, currentUser.uid]);

  useEffect(() => {
    if (inputText.includes('@')) {
      const lastAtPos = inputText.lastIndexOf('@');
      const query = inputText.substring(lastAtPos + 1).toLowerCase();
      if (query.includes(' ')) {
        setMentionSuggestions([]);
      } else {
        const filtered = participants.filter(u => 
          u.displayName.toLowerCase().includes(query)
        );
        setMentionSuggestions(filtered);
      }
    } else {
      setMentionSuggestions([]);
    }
  }, [inputText, participants]);

  const handleMentionSelect = (user: UserProfile) => {
    const lastAtPos = inputText.lastIndexOf('@');
    const beforeAt = inputText.substring(0, lastAtPos);
    const afterAt = inputText.substring(lastAtPos + 1);
    const spacePos = afterAt.indexOf(' ');
    const remaining = spacePos !== -1 ? afterAt.substring(spacePos) : '';
    
    setInputText(`${beforeAt}@${user.displayName.replace(/\s/g, '')} ${remaining}`);
    setMentionSuggestions([]);
    textareaRef.current?.focus();
  };

  const handleForward = async (targetChatId: string) => {
    if (!forwardMsg) return;

    try {
      const messageData = {
        senderId: currentUser.uid,
        text: forwardMsg.text || '',
        createdAt: serverTimestamp(),
        type: forwardMsg.type,
        read: false,
        imageUrl: forwardMsg.imageUrl || null,
        stickerId: forwardMsg.stickerId || null,
        mentions: []
      };

      await addDoc(collection(db, 'chats', targetChatId, 'messages'), messageData);
      await updateDoc(doc(db, 'chats', targetChatId), {
        lastMessage: {
          text: forwardMsg.type === 'image' ? '📷 Photo' : forwardMsg.type === 'sticker' ? '🎨 Sticker' : forwardMsg.text,
          createdAt: serverTimestamp(),
          senderId: currentUser.uid
        }
      });
      setForwardMsg(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${targetChatId}/messages`);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputText]);
  const isGroup = chat.type === 'group';
  const otherUserId = !isGroup ? chat.participants.find(id => id !== currentUser.uid) : null;

  const handleCapture = async () => {
    if (!chatContainerRef.current) return;
    
    setIsCapturing(true);
    setShowFlash(true);
    
    // Brief delay for flash effect
    setTimeout(() => setShowFlash(false), 200);

    try {
      const dataUrl = await toPng(chatContainerRef.current, {
        cacheBust: true,
        backgroundColor: '#191919',
        style: {
          borderRadius: '0'
        }
      });
      
      const link = document.createElement('a');
      link.download = `line-chat-${chatName}-${format(new Date(), 'yyyyMMdd-HHmmss')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('oops, something went wrong!', err);
    } finally {
      setIsCapturing(false);
    }
  };

  useEffect(() => {
    if (isGroup || !otherUserId) return;
    const unsub = onSnapshot(doc(db, 'users', otherUserId), (doc) => {
      if (doc.exists()) {
        setOtherUser(doc.data() as UserProfile);
      }
    });
    return unsub;
  }, [otherUserId, isGroup]);

  useEffect(() => {
    const q = query(
      collection(db, 'chats', chat.id, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
      
      // Mark messages as read
      msgs.forEach(async (msg) => {
        if (msg.senderId !== currentUser.uid && !msg.read) {
          await updateDoc(doc(db, 'chats', chat.id, 'messages', msg.id), { read: true });
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${chat.id}/messages`);
    });
    return unsub;
  }, [chat.id, currentUser.uid]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent, type: 'text' | 'image' | 'sticker' = 'text', payload?: string) => {
    e?.preventDefault();
    if (type === 'text' && !inputText.trim()) return;

    let finalPayload = payload;
    if (type === 'image' && payload) {
      // Resize image to fit Firestore 1MB limit
      finalPayload = await resizeImage(payload);
    }

    const mentions: string[] = [];
    if (type === 'text') {
      participants.forEach(u => {
        const mentionTag = `@${u.displayName.replace(/\s/g, '')}`;
        if (inputText.includes(mentionTag)) {
          mentions.push(u.uid);
        }
      });
    }

    const messageData = {
      senderId: currentUser.uid,
      text: type === 'text' ? inputText : '',
      createdAt: serverTimestamp(),
      type,
      read: false,
      ...(type === 'image' && { imageUrl: finalPayload }),
      ...(type === 'sticker' && { stickerId: payload }),
      mentions
    };

    try {
      await addDoc(collection(db, 'chats', chat.id, 'messages'), messageData);
      await updateDoc(doc(db, 'chats', chat.id), {
        lastMessage: {
          text: type === 'image' ? '📷 Photo' : type === 'sticker' ? '🎨 Sticker' : inputText,
          createdAt: serverTimestamp(),
          senderId: currentUser.uid
        }
      });
      setInputText('');
      setShowStickers(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${chat.id}/messages`);
    }
  };

  const handleChatFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const resizedDataUrl = await resizeImage(file);
      handleSendMessage(undefined, 'image', resizedDataUrl);
    } catch (error) {
      console.error("Error resizing image:", error);
      const reader = new FileReader();
      reader.onloadend = () => {
        handleSendMessage(undefined, 'image', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const chatName = isGroup ? chat.name : (otherUser?.displayName || 'Chat');
  const memberCount = isGroup ? chat.participants.length : null;
  const photoURL = isGroup 
    ? (chat.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${chat.name}`)
    : (otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUserId}`);

  const renderDateSeparator = (date: Date) => (
    <div className="flex justify-center my-4">
      <div className="bg-black/20 text-white text-[10px] px-3 py-1 rounded-full font-medium">
        {format(date, 'eee. d/M', { locale: th })}
      </div>
    </div>
  );

  return (
    <div ref={chatContainerRef} className="flex flex-col h-full bg-[#191919] relative overflow-hidden">
      {/* Flash Effect */}
      <AnimatePresence>
        {showFlash && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white z-[100] pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-[#191919] p-3 flex items-center gap-1 sticky top-0 z-10">
        <button onClick={onBack} className="p-1 hover:bg-white/5 rounded-full text-white flex items-center">
          <ChevronLeft className="w-8 h-8" strokeWidth={1.5} />
          <span className="text-[15px] font-bold -ml-1.5">99+</span>
        </button>
        <div className="flex-1 flex flex-col ml-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {!isGroup && otherUser?.isOfficial && <VerifiedBadge className="w-5 h-5 flex-shrink-0" />}
            <h3 className="font-bold text-white leading-tight truncate text-[16px] flex-shrink min-w-0">{chatName}</h3>
            {memberCount !== null && <span className="font-bold text-white text-[16px] flex-shrink-0">({memberCount})</span>}
          </div>
          {!isGroup && otherUser?.isOfficial && (
            <span className="text-[10px] text-[#4D6AFF] font-bold leading-tight mt-0.5">ผู้รับผิดชอบเป็นผู้ตอบกลับ</span>
          )}
        </div>
        <div className="flex gap-0.5">
          {otherUser?.isOfficial ? (
            <>
              <button 
                onClick={handleCapture}
                className="p-2 hover:bg-white/5 rounded-full text-white"
                title="Capture Screenshot"
              >
                <Camera className="w-6 h-6" strokeWidth={1.5} />
              </button>
              <button className="p-2 hover:bg-white/5 rounded-full text-white">
                <History className="w-6 h-6" strokeWidth={1.5} />
              </button>
              <button className="p-2 hover:bg-white/5 rounded-full text-white">
                <List className="w-6 h-6" strokeWidth={1.5} />
              </button>
              <button className="p-2 hover:bg-white/5 rounded-full text-white">
                <Menu className="w-6 h-6" strokeWidth={1.5} />
              </button>
            </>
          ) : (
            <>
              <button className="p-2 hover:bg-white/5 rounded-full text-white">
                <Search className="w-6 h-6" strokeWidth={1.5} />
              </button>
              <button className="p-2 hover:bg-white/5 rounded-full text-white">
                <Phone className="w-6 h-6" strokeWidth={1.5} />
              </button>
              <button className="p-2 hover:bg-white/5 rounded-full text-white">
                <Menu className="w-6 h-6" strokeWidth={1.5} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {messages.map((msg, index) => {
          const isMe = msg.senderId === currentUser.uid;
          const isFirstInBlock = index === 0 || messages[index - 1].senderId !== msg.senderId;
          const showAvatar = !isMe && isFirstInBlock;
          const showTail = isFirstInBlock;
          
          const msgDate = msg.createdAt?.toDate();
          const prevMsgDate = index > 0 ? messages[index - 1].createdAt?.toDate() : null;
          const showDate = !prevMsgDate || (msgDate && format(msgDate, 'yyyy-MM-dd') !== format(prevMsgDate, 'yyyy-MM-dd'));

          return (
            <React.Fragment key={msg.id}>
              {showDate && msgDate && renderDateSeparator(msgDate)}
              <MessageItem 
                msg={msg} 
                isMe={isMe} 
                isGroup={isGroup} 
                showAvatar={showAvatar} 
                showTail={showTail}
                currentUser={currentUser} 
                chatId={chat.id}
                chat={chat}
                onShare={(m) => setForwardMsg(m)}
              />
            </React.Fragment>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="bg-[#191919] border-t border-white/5 p-2 pb-8">
        <div className="flex items-center gap-1 px-1">
          <button type="button" className="p-2 text-gray-400 hover:text-gray-200">
            <Plus className="w-6 h-6" />
          </button>
          <button 
            type="button" 
            onClick={() => chatFileInputRef.current?.click()}
            className="p-2 text-gray-400 hover:text-gray-200"
          >
            <Camera className="w-6 h-6" />
          </button>
          <button 
            type="button" 
            onClick={() => chatFileInputRef.current?.click()}
            className="p-2 text-gray-400 hover:text-gray-200"
          >
            <ImageIcon className="w-6 h-6" />
          </button>
          
          <form onSubmit={(e) => handleSendMessage(e)} className="flex-1 flex items-end bg-[#2C2C2E] rounded-[20px] px-3 py-1.5 mx-1 relative">
            {mentionSuggestions.length > 0 && (
              <div className="absolute bottom-full left-0 w-full bg-[#2C2C2E] border border-white/10 rounded-t-xl overflow-hidden shadow-2xl mb-1">
                <div className="p-2 border-b border-white/5 bg-black/20">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mention friends</span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {mentionSuggestions.map(u => (
                    <button
                      key={u.uid}
                      type="button"
                      onClick={() => handleMentionSelect(u)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left"
                    >
                      <img src={u.photoURL} className="w-8 h-8 rounded-lg object-cover" alt="" />
                      <div className="flex-1 min-w-0">
                        <span className="text-white font-bold text-sm block truncate">{u.displayName}</span>
                        <span className="text-gray-500 text-[10px] block truncate">@{u.displayName.replace(/\s/g, '')}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <textarea 
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Aa"
              rows={1}
              className="flex-1 bg-transparent text-white text-[15px] focus:outline-none placeholder-gray-500 resize-none py-1 max-h-[120px] overflow-y-auto"
            />
            <button 
              type="button" 
              onClick={() => setShowStickers(!showStickers)} 
              className="text-gray-400 hover:text-gray-200 ml-1 mb-1"
            >
              <Smile className="w-5 h-5" />
            </button>
            <input 
              type="file" 
              ref={chatFileInputRef} 
              onChange={handleChatFileChange} 
              accept="image/*" 
              className="hidden" 
            />
          </form>
          
          <div className="w-10 h-10 flex items-center justify-center">
            {inputText.trim() ? (
              <button 
                onClick={(e) => handleSendMessage(e as any)}
                className="w-8 h-8 bg-[#06C755] rounded-full flex items-center justify-center text-white shadow-sm hover:bg-[#05b54d] transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button className="text-gray-400 hover:text-gray-200">
                <Mic className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stickers Panel */}
      <AnimatePresence>
        {showStickers && (
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="bg-[#191919] border-t border-white/5 overflow-hidden"
          >
            <div className="grid grid-cols-4 gap-4 p-4">
              {STICKERS.map((s, i) => (
                <button 
                  key={i} 
                  onClick={() => handleSendMessage(undefined, 'sticker', s)}
                  className="hover:scale-110 transition-transform"
                >
                  <img src={s} className="w-full aspect-square" alt="Sticker" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Forward Modal */}
      <ForwardModal 
        isOpen={!!forwardMsg}
        onClose={() => setForwardMsg(null)}
        chats={allChats}
        currentUser={currentUser}
        onForward={handleForward}
      />
    </div>
  );
};

const CreateChat = ({ currentUser, onChatStart, onBack }: { currentUser: UserProfile, onChatStart: (chat: Chat) => void, onBack: () => void }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([]);
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    const fetchAllUsers = async () => {
      try {
        const q = query(collection(db, 'users'), limit(50));
        const snapshot = await getDocs(q);
        setAllUsers(snapshot.docs
          .map(doc => doc.data() as UserProfile)
          .filter(u => u.uid !== currentUser.uid)
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    };
    fetchAllUsers();
  }, [currentUser.uid]);

  const filteredUsers = allUsers.filter(user => 
    user.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleUser = (user: UserProfile) => {
    setSelectedUsers(prev => 
      prev.find(u => u.uid === user.uid)
        ? prev.filter(u => u.uid !== user.uid)
        : [...prev, user]
    );
  };

  const startChat = async () => {
    if (selectedUsers.length === 0) return;

    try {
      if (selectedUsers.length === 1) {
        // Direct Chat
        const targetUser = selectedUsers[0];
        const q = query(
          collection(db, 'chats'),
          where('participants', 'array-contains', currentUser.uid),
          where('type', '==', 'direct')
        );
        const snapshot = await getDocs(q);
        const existingChat = snapshot.docs.find(doc => {
          const data = doc.data() as Chat;
          return data.participants.includes(targetUser.uid);
        });

        if (existingChat) {
          onChatStart({ id: existingChat.id, ...existingChat.data() } as Chat);
        } else {
          const newChat = {
            participants: [currentUser.uid, targetUser.uid],
            type: 'direct',
            createdAt: serverTimestamp()
          };
          const docRef = await addDoc(collection(db, 'chats'), newChat);
          onChatStart({ id: docRef.id, ...newChat } as Chat);
        }
      } else {
        // Group Chat
        const name = groupName.trim() || selectedUsers.map(u => u.displayName).join(', ').substring(0, 30);
        const newChat = {
          participants: [currentUser.uid, ...selectedUsers.map(u => u.uid)],
          type: 'group',
          name,
          createdAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, 'chats'), newChat);
        onChatStart({ id: docRef.id, ...newChat } as Chat);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'chats');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={onBack} className="p-1 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <h3 className="font-bold text-gray-900 flex-1">Create Chat</h3>
        <button 
          onClick={startChat}
          disabled={selectedUsers.length === 0}
          className="text-[#06C755] font-bold disabled:opacity-50"
        >
          Create
        </button>
      </div>

      <div className="p-4 space-y-4">
        {selectedUsers.length > 1 && (
          <div className="bg-gray-50 p-4 rounded-2xl">
            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Group Name (Optional)</p>
            <input 
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name..."
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755]"
            />
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search friends..."
            className="w-full bg-gray-100 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755]"
          />
        </div>

        {selectedUsers.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {selectedUsers.map(u => (
              <div key={u.uid} className="flex flex-col items-center gap-1 min-w-[60px]">
                <div className="relative">
                  <img src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} className="w-12 h-12 rounded-xl object-cover" alt="" />
                  <button 
                    onClick={() => toggleUser(u)}
                    className="absolute -top-1 -right-1 bg-gray-500 text-white rounded-full p-0.5"
                  >
                    <Plus className="w-3 h-3 rotate-45" />
                  </button>
                </div>
                <span className="text-[10px] text-gray-500 truncate w-full text-center">{u.displayName}</span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {filteredUsers.map(user => {
            const isSelected = selectedUsers.find(u => u.uid === user.uid);
            return (
              <button 
                key={user.uid}
                onClick={() => toggleUser(user)}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors text-left"
              >
                <div className="relative">
                  <img 
                    src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                    className="w-12 h-12 rounded-xl object-cover"
                    alt="Avatar"
                  />
                  {user.isOfficial && (
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                      <VerifiedBadge className="w-3 h-3" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <h4 className="font-bold text-gray-900 truncate">{user.displayName}</h4>
                    {user.isOfficial && <VerifiedBadge />}
                  </div>
                  <p className="text-xs text-gray-500">{user.statusMessage || 'Hello!'}</p>
                </div>
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                  isSelected ? "bg-[#06C755] border-[#06C755]" : "border-gray-200"
                )}>
                  {isSelected && <Plus className="w-4 h-4 text-white rotate-45" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Profile = ({ userProfile, onLogout }: { userProfile: UserProfile, onLogout: () => void }) => {
  const [displayName, setDisplayName] = useState(userProfile.displayName || '');
  const [status, setStatus] = useState(userProfile.statusMessage || '');
  const [photoURL, setPhotoURL] = useState(userProfile.photoURL || '');
  const [isOfficial, setIsOfficial] = useState(userProfile.isOfficial || false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateProfile = async (newPhotoURL?: string, newIsOfficial?: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userProfile.uid), {
        displayName: displayName,
        statusMessage: status,
        photoURL: newPhotoURL || photoURL,
        isOfficial: newIsOfficial !== undefined ? newIsOfficial : isOfficial
      });
      setIsEditingName(false);
      setIsEditingStatus(false);
      setIsEditingPhoto(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userProfile.uid}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Increase limit to 5MB, resizing will handle the Firestore limit
    if (file.size > 5000000) {
      alert("Image is too large. Please select an image smaller than 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      const resizedString = await resizeImage(base64String);
      setPhotoURL(resizedString);
      handleUpdateProfile(resizedString);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-6 flex flex-col items-center">
      <div className="relative mb-6 group">
        <img 
          src={userProfile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.uid}`} 
          className="w-32 h-32 rounded-[40px] object-cover shadow-lg border-4 border-white bg-gray-100"
          alt="Profile"
          referrerPolicy="no-referrer"
        />
        {userProfile.isOfficial && (
          <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1.5 shadow-md">
            <VerifiedBadge className="w-6 h-6" />
          </div>
        )}
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="absolute bottom-0 right-0 bg-[#06C755] text-white p-2 rounded-full shadow-lg hover:bg-[#05b04a] transition-colors"
        >
          <ImageIcon className="w-4 h-4" />
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          className="hidden" 
        />
      </div>

      <button 
        onClick={() => setIsEditingPhoto(!isEditingPhoto)}
        className="text-xs text-gray-400 mb-4 hover:text-gray-600"
      >
        {isEditingPhoto ? 'Hide URL Input' : 'Or enter image URL instead'}
      </button>

      {isEditingPhoto && (
        <div className="w-full mb-6 bg-gray-50 p-4 rounded-2xl">
          <p className="text-xs font-bold text-gray-400 uppercase mb-2">Profile Picture URL</p>
          <div className="flex gap-2">
            <input 
              type="text"
              value={photoURL}
              onChange={(e) => setPhotoURL(e.target.value)}
              className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755]"
              placeholder="Enter image URL..."
            />
            <button 
              onClick={() => handleUpdateProfile()}
              className="px-4 py-2 bg-[#06C755] text-white rounded-lg text-sm font-bold"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className="w-full mb-8 text-center">
        {isEditingName ? (
          <div className="flex flex-col items-center gap-2">
            <input 
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="text-2xl font-bold text-gray-900 text-center bg-white border border-gray-200 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-[#06C755]"
              autoFocus
            />
            <button 
              onClick={() => handleUpdateProfile()}
              className="text-sm text-[#06C755] font-bold"
            >
              Save Name
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5">
            <h2 className="text-2xl font-bold text-gray-900">{userProfile.displayName}</h2>
            {userProfile.isOfficial && <VerifiedBadge className="w-5 h-5" />}
            <button onClick={() => setIsEditingName(true)} className="text-gray-400 hover:text-[#06C755] ml-0.5">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        )}
        <p className="text-sm text-gray-400 mt-1">ID: {userProfile.uid}</p>
      </div>

      <div className="w-full space-y-6">
        <div className="bg-gray-50 p-4 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status Message</span>
            <button 
              onClick={() => isEditingStatus ? handleUpdateProfile() : setIsEditingStatus(true)}
              className="text-sm text-[#06C755] font-bold"
            >
              {isEditingStatus ? 'Save' : 'Edit'}
            </button>
          </div>
          {isEditingStatus ? (
            <input 
              type="text"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755]"
              autoFocus
            />
          ) : (
            <p className="text-gray-700">{userProfile.statusMessage || 'No status message'}</p>
          )}
        </div>

        <div className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-gray-400" />
            <div>
              <p className="text-sm font-bold text-gray-900">Official Account</p>
              <p className="text-[10px] text-gray-400 font-medium tracking-tight">Show official verification badge</p>
            </div>
          </div>
          <button 
            onClick={() => {
              const next = !isOfficial;
              setIsOfficial(next);
              handleUpdateProfile(undefined, next);
            }}
            className={cn(
              "w-12 h-6 rounded-full relative transition-colors duration-200",
              isOfficial ? "bg-[#06C755]" : "bg-gray-300"
            )}
          >
            <div className={cn(
              "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200",
              isOfficial ? "left-7" : "left-1"
            )} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={onLogout}
            className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors"
          >
            <Users className="w-6 h-6 text-gray-600" />
            <span className="text-xs font-medium text-gray-600">Switch User</span>
          </button>
          <button 
            onClick={onLogout}
            className="flex flex-col items-center gap-2 p-4 bg-red-50 rounded-2xl hover:bg-red-100 transition-colors"
          >
            <LogOut className="w-6 h-6 text-red-600" />
            <span className="text-xs font-medium text-red-600">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('line_clone_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chats' | 'friends' | 'profile'>('chats');
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [showCreateChat, setShowCreateChat] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  const handleLogin = async (u: UserProfile) => {
    setUser(u);
    localStorage.setItem('line_clone_user', JSON.stringify(u));
    
    // Create/Update user in Firestore
    const userRef = doc(db, 'users', u.uid);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      await setDoc(userRef, {
        ...u,
        lastSeen: serverTimestamp()
      });
    } else {
      await updateDoc(userRef, { lastSeen: serverTimestamp() });
    }
  };

  const handleLogout = () => {
    setUser(null);
    setUserProfile(null);
    localStorage.removeItem('line_clone_user');
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!window.confirm('ลบห้องแชตนี้? ข้อความทั้งหมดจะถูกลบอย่างถาวร')) {
      return;
    }

    try {
      // 1. Delete all messages in the subcollection
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      const deletePromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // 2. Delete the chat document
      await deleteDoc(doc(db, 'chats', chatId));
      
      if (selectedChat?.id === chatId) {
        setSelectedChat(null);
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
      alert("ไม่สามารถลบห้องแชตได้ กรุณาลองใหม่อีกครั้ง");
    }
  };

  useEffect(() => {
    const initMockUsers = async () => {
      try {
        for (const u of MOCK_USERS) {
          const userRef = doc(db, 'users', u.uid);
          const userDoc = await getDoc(userRef);
          if (!userDoc.exists()) {
            await setDoc(userRef, {
              ...u,
              lastSeen: serverTimestamp()
            });
          }
        }
      } catch (error) {
        console.error("Error initializing mock users:", error);
      }
    };
    initMockUsers();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('uid'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setAllUsers(usersData);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      
      // Listen to profile changes
      const unsubProfile = onSnapshot(userRef, (doc) => {
        if (doc.exists()) setUserProfile(doc.data() as UserProfile);
      });

      // Listen to chats
      const q = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', user.uid),
        orderBy('lastMessage.createdAt', 'desc')
      );
      const unsubChats = onSnapshot(q, (snapshot) => {
        setChats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat)));
      }, (error) => {
        console.error('Chat list error:', error);
      });

      setLoading(false);
      return () => {
        unsubProfile();
        unsubChats();
      };
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#06C755]">
        <motion.div 
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <MessageSquare className="text-white w-16 h-16" />
        </motion.div>
      </div>
    );
  }

  if (!user) return <Login onLogin={handleLogin} users={allUsers} />;

  return (
    <ErrorBoundary>
      <div className="max-w-[428px] mx-auto h-screen bg-white shadow-2xl flex flex-col overflow-hidden relative border-x border-gray-100">
        <StatusBar dark={!!selectedChat} />
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {selectedChat ? (
              <motion.div 
                key="chat-room"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute inset-0 z-50 bg-white flex flex-col"
              >
                <ChatRoom 
                  chat={selectedChat} 
                  currentUser={{ uid: user.uid } as any} 
                  onBack={() => setSelectedChat(null)} 
                  allChats={chats}
                />
              </motion.div>
            ) : (
              <motion.div 
                key="main-tabs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col h-full"
              >
                {/* Header */}
                <div className="p-4 flex justify-between items-center bg-white">
                  <h1 className="text-[22px] font-black text-gray-900 tracking-tight">
                    {activeTab === 'chats' ? 'Chats' : activeTab === 'friends' ? 'Friends' : 'Profile'}
                  </h1>
                  <div className="flex gap-1">
                    <button className="p-2 hover:bg-gray-100 rounded-full">
                      <Search className="w-6 h-6 text-gray-800" />
                    </button>
                    <button 
                      onClick={() => setShowCreateChat(true)}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <Plus className="w-6 h-6 text-gray-800" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-full">
                      <Settings className="w-6 h-6 text-gray-800" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto relative">
                  <AnimatePresence>
                    {showCreateChat && (
                      <motion.div 
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        className="absolute inset-0 z-40"
                      >
                        <CreateChat 
                          currentUser={userProfile!} 
                          onBack={() => setShowCreateChat(false)}
                          onChatStart={(chat) => {
                            setSelectedChat(chat);
                            setShowCreateChat(false);
                          }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {activeTab === 'chats' && (
                    <div className="divide-y divide-gray-50">
                      {chats.length > 0 ? (
                        chats.map(chat => (
                          <ChatItem 
                            key={chat.id} 
                            chat={chat} 
                            currentUser={{ uid: user.uid } as any} 
                            onClick={() => setSelectedChat(chat)} 
                            onDelete={(e) => {
                              e.stopPropagation();
                              handleDeleteChat(chat.id);
                            }}
                          />
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400 p-8 text-center">
                          <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                          <p>No chats yet. Start a conversation with your friends!</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'friends' && userProfile && (
                    <div className="flex flex-col h-full bg-white">
                      {/* Search */}
                      <div className="px-4 pb-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <input 
                            type="text"
                            placeholder="Search"
                            className="w-full bg-gray-100 rounded-lg pl-9 pr-4 py-1.5 text-sm focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* My Profile */}
                      <div className="p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors cursor-pointer">
                        <img 
                          src={userProfile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.uid}`} 
                          className="w-12 h-12 rounded-2xl object-cover bg-gray-100"
                          alt="My Profile"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900">{userProfile.displayName}</h4>
                          <p className="text-xs text-gray-400 truncate">{userProfile.statusMessage || 'Set a status message'}</p>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="h-2 bg-gray-50"></div>

                      {/* Friends List */}
                      <div className="flex-1 overflow-y-auto">
                        <div className="p-4 py-2">
                          <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Friends</h5>
                          <CreateChat 
                            currentUser={userProfile} 
                            onBack={() => setActiveTab('chats')}
                            onChatStart={(chat) => {
                              setSelectedChat(chat);
                              setActiveTab('chats');
                            }} 
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'profile' && userProfile && (
                    <Profile userProfile={userProfile} onLogout={handleLogout} />
                  )}
                </div>

                {/* Bottom Nav */}
                <div className="bg-[#F9F9F9] border-t border-gray-200 flex justify-around p-1 pb-2">
                  <button 
                    onClick={() => setActiveTab('friends')}
                    className={cn("flex flex-col items-center p-2 gap-0.5 transition-colors flex-1", activeTab === 'friends' ? "text-black" : "text-gray-400")}
                  >
                    <Users className={cn("w-7 h-7", activeTab === 'friends' && "fill-current")} />
                    <span className="text-[10px] font-bold">Friends</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('chats')}
                    className={cn("flex flex-col items-center p-2 gap-0.5 transition-colors flex-1", activeTab === 'chats' ? "text-black" : "text-gray-400")}
                  >
                    <div className="relative">
                      <MessageSquare className={cn("w-7 h-7", activeTab === 'chats' && "fill-current")} />
                      {chats.length > 0 && (
                        <div className="absolute -top-1 -right-1.5 bg-[#06C755] text-white text-[9px] flex items-center justify-center rounded-full font-bold px-1 min-w-[16px] h-4 border border-white">
                          {chats.length}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-bold">Chats</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('profile')}
                    className={cn("flex flex-col items-center p-2 gap-0.5 transition-colors flex-1", activeTab === 'profile' ? "text-black" : "text-gray-400")}
                  >
                    <UserIcon className={cn("w-7 h-7", activeTab === 'profile' && "fill-current")} />
                    <span className="text-[10px] font-bold">Profile</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <HomeIndicator dark={!!selectedChat} />
      </div>
    </ErrorBoundary>
  );
}
