const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const { URL } = require("url");

// ============================================
// DATABASE CONFIGURATION
// Priority: Firebase > MongoDB > JSON File
// ============================================

// Firebase Configuration
let useFirebase = false;
let firestore = null;
let firebaseInitialized = false;

// Try to load Firebase configuration
function initFirebase() {
    try {
        const serviceAccount = require("./firebase-service-account.json");
        const { initializeApp, cert } = require('firebase-admin/app');
        const { getFirestore } = require('firebase-admin/firestore');
        
        initializeApp({
            credential: cert(serviceAccount)
        });
        
        firestore = getFirestore();
        firebaseInitialized = true;
        useFirebase = true;
        console.log('✓ Firebase Admin SDK initialized');
        return true;
    } catch (e) {
        // Firebase not configured
        return false;
    }
}

// MongoDB Configuration - Using environment variable or local MongoDB
// Set MONGODB_URI environment variable for cloud MongoDB (e.g., MongoDB Atlas)
// Example: mongodb+srv://<username>:<password>@cluster0.mongodb.net/abious_rehab?retryWrites=true&w=majority
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/abious_rehab";
let mongoClient = null;
let db = null;
let useMongoDB = false;

// Display database connection info on startup
console.log('=== Database Configuration ===');
if (initFirebase()) {
    console.log('Using: Firebase Firestore (Cloud)');
} else if (process.env.MONGODB_URI) {
    console.log('Using: MongoDB Atlas from MONGODB_URI');
} else {
    console.log('Using: Local JSON file storage');
    console.log('To use cloud database:');
    console.log('  - Set MONGODB_URI for MongoDB Atlas');
    console.log('  - Or add firebase-service-account.json for Firebase');
}
console.log('=============================');

// Connect to MongoDB with better error handling
async function connectMongoDB() {
    try {
        const { MongoClient } = require('mongodb');
        
        mongoClient = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });
        
        await mongoClient.connect();
        db = mongoClient.db();
        
        // Test connection
        await db.command({ ping: 1 });
        
        console.log('✓ Connected to MongoDB successfully');
        
        // Create indexes
        await db.collection('users').createIndex({ email: 1 }, { unique: true });
        await db.collection('verificationCodes').createIndex({ email: 1 });
        await db.collection('content').createIndex({ key: 1 });
        
        useMongoDB = true;
        return true;
    } catch (error) {
        console.log('✗ MongoDB not available, using JSON file storage');
        console.log('  To use MongoDB, set MONGODB_URI environment variable or install MongoDB locally');
        useMongoDB = false;
        return false;
    }
}

// Firebase helper functions
async function firebaseGetDoc(collection, docId) {
    if (!useFirebase || !firestore) return null;
    try {
        const doc = await firestore.collection(collection).doc(docId).get();
        return doc.exists ? doc.data() : null;
    } catch (e) {
        console.error('Firebase get error:', e.message);
        return null;
    }
}

async function firebaseSetDoc(collection, docId, data) {
    if (!useFirebase || !firestore) return;
    try {
        await firestore.collection(collection).doc(docId).set(data);
    } catch (e) {
        console.error('Firebase set error:', e.message);
    }
}

async function firebaseGetAll(collection) {
    if (!useFirebase || !firestore) return [];
    try {
        const snapshot = await firestore.collection(collection).get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error('Firebase get all error:', e.message);
        return [];
    }
}

async function firebaseAddDoc(collection, data) {
    if (!useFirebase || !firestore) return null;
    try {
        const docRef = await firestore.collection(collection).add(data);
        return { id: docRef.id, ...data };
    } catch (e) {
        console.error('Firebase add error:', e.message);
        return null;
    }
}

async function firebaseUpdateDoc(collection, docId, data) {
    if (!useFirebase || !firestore) return;
    try {
        await firestore.collection(collection).doc(docId).update(data);
    } catch (e) {
        console.error('Firebase update error:', e.message);
    }
}

async function firebaseDeleteDoc(collection, docId) {
    if (!useFirebase || !firestore) return;
    try {
        await firestore.collection(collection).doc(docId).delete();
    } catch (e) {
        console.error('Firebase delete error:', e.message);
    }
}

// Hybrid storage functions - work with Firebase, MongoDB and JSON
async function getUsers() {
    if (useFirebase && firestore) {
        return await firebaseGetAll('users');
    }
    if (useMongoDB && db) {
        return await db.collection('users').find({}).toArray();
    }
    return readStore().users;
}

async function saveUsers(users) {
    if (useFirebase && firestore) {
        // Delete all and re-add for Firebase
        const existing = await firebaseGetAll('users');
        for (const u of existing) {
            await firebaseDeleteDoc('users', u.id);
        }
        for (const u of users) {
            await firebaseAddDoc('users', u);
        }
        return;
    }
    if (useMongoDB && db) {
        // Clear and insert new users
        await db.collection('users').deleteMany({});
        if (users.length > 0) {
            await db.collection('users').insertMany(users);
        }
        return;
    }
    const store = readStore();
    store.users = users;
    writeStore(store);
}

async function getUserByEmail(email) {
    if (useFirebase && firestore) {
        const users = await firebaseGetAll('users');
        return users.find(u => u.email === email);
    }
    if (useMongoDB && db) {
        return await db.collection('users').findOne({ email: email });
    }
    const store = readStore();
    return store.users.find(u => u.email === email);
}

async function addUser(user) {
    if (useFirebase && firestore) {
        await firebaseAddDoc('users', user);
        return;
    }
    if (useMongoDB && db) {
        await db.collection('users').insertOne(user);
        return;
    }
    const store = readStore();
    store.users.push(user);
    writeStore(store);
}

async function updateUser(email, updates) {
    if (useFirebase && firestore) {
        const users = await firebaseGetAll('users');
        const user = users.find(u => u.email === email);
        if (user) {
            await firebaseUpdateDoc('users', user.id, updates);
        }
        return;
    }
    if (useMongoDB && db) {
        await db.collection('users').updateOne({ email }, { $set: updates });
        return;
    }
    const store = readStore();
    const idx = store.users.findIndex(u => u.email === email);
    if (idx !== -1) {
        store.users[idx] = { ...store.users[idx], ...updates };
        writeStore(store);
    }
}

async function getSessions() {
    if (useFirebase && firestore) {
        const sessions = await firebaseGetAll('sessions');
        const sessionMap = {};
        sessions.forEach(s => sessionMap[s.token] = s);
        return sessionMap;
    }
    if (useMongoDB && db) {
        const sessions = await db.collection('sessions').find({}).toArray();
        const sessionMap = {};
        sessions.forEach(s => sessionMap[s.token] = s);
        return sessionMap;
    }
    return readStore().sessions;
}

async function saveSession(token, session) {
    if (useFirebase && firestore) {
        await firebaseSetDoc('sessions', token, session);
        return;
    }
    if (useMongoDB && db) {
        await db.collection('sessions').updateOne(
            { token },
            { $set: { ...session, token } },
            { upsert: true }
        );
        return;
    }
    const store = readStore();
    store.sessions[token] = session;
    writeStore(store);
}

async function getPosts() {
    if (useFirebase && firestore) {
        return await firebaseGetAll('posts');
    }
    if (useMongoDB && db) {
        return await db.collection('posts').find({}).toArray();
    }
    return readStore().posts;
}

async function savePosts(posts) {
    if (useFirebase && firestore) {
        const existing = await firebaseGetAll('posts');
        for (const p of existing) {
            await firebaseDeleteDoc('posts', p.id);
        }
        for (const p of posts) {
            await firebaseAddDoc('posts', p);
        }
        return;
    }
    if (useMongoDB && db) {
        await db.collection('posts').deleteMany({});
        if (posts.length > 0) {
            await db.collection('posts').insertMany(posts);
        }
        return;
    }
    const store = readStore();
    store.posts = posts;
    writeStore(store);
}

async function getChat() {
    if (useFirebase && firestore) {
        return await firebaseGetAll('chat');
    }
    if (useMongoDB && db) {
        return await db.collection('chat').find({}).toArray();
    }
    return readStore().chat;
}

async function saveChat(chat) {
    if (useFirebase && firestore) {
        const existing = await firebaseGetAll('chat');
        for (const c of existing) {
            await firebaseDeleteDoc('chat', c.id);
        }
        for (const c of chat) {
            await firebaseAddDoc('chat', c);
        }
        return;
    }
    if (useMongoDB && db) {
        await db.collection('chat').deleteMany({});
        if (chat.length > 0) {
            await db.collection('chat').insertMany(chat);
        }
        return;
    }
    const store = readStore();
    store.chat = chat;
    writeStore(store);
}

async function getVerificationCodes() {
    if (useFirebase && firestore) {
        return await firebaseGetAll('verificationCodes');
    }
    if (useMongoDB && db) {
        return await db.collection('verificationCodes').find({}).toArray();
    }
    const store = readStore();
    return store.verificationCodes || [];
}

async function saveVerificationCodes(codes) {
    if (useFirebase && firestore) {
        const existing = await firebaseGetAll('verificationCodes');
        for (const c of existing) {
            await firebaseDeleteDoc('verificationCodes', c.id);
        }
        for (const c of codes) {
            await firebaseAddDoc('verificationCodes', c);
        }
        return;
    }
    if (useMongoDB && db) {
        await db.collection('verificationCodes').deleteMany({});
        if (codes.length > 0) {
            await db.collection('verificationCodes').insertMany(codes);
        }
        return;
    }
    const store = readStore();
    store.verificationCodes = codes;
    writeStore(store);
}

// Get current store (hybrid - reads from Firebase, MongoDB or JSON)
async function getStore() {
    if (useFirebase && firestore) {
        const users = await getUsers();
        const sessions = await getSessions();
        const posts = await getPosts();
        const chat = await getChat();
        const verificationCodes = await getVerificationCodes();
        return { users, sessions, posts, chat, verificationCodes };
    }
    if (useMongoDB && db) {
        const users = await getUsers();
        const sessions = await getSessions();
        const posts = await getPosts();
        const chat = await getChat();
        const verificationCodes = await getVerificationCodes();
        return { users, sessions, posts, chat, verificationCodes };
    }
    return readStore();
}

// Save entire store
async function saveStore(store) {
    if (useFirebase && firestore) {
        await saveUsers(store.users);
        await savePosts(store.posts);
        await saveChat(store.chat);
        if (store.verificationCodes) {
            await saveVerificationCodes(store.verificationCodes);
        }
        return;
    }
    if (useMongoDB && db) {
        await saveUsers(store.users);
        await savePosts(store.posts);
        await saveChat(store.chat);
        if (store.verificationCodes) {
            await saveVerificationCodes(store.verificationCodes);
        }
        return;
    }
    writeStore(store);
}

// News/Events functions
async function getNews() {
    if (useFirebase && firestore) {
        return await firebaseGetAll('news');
    }
    if (useMongoDB && db) {
        return await db.collection('news').find({}).toArray();
    }
    const store = readStore();
    return store.news || [];
}

async function saveNews(news) {
    if (useFirebase && firestore) {
        const existing = await firebaseGetAll('news');
        for (const n of existing) {
            await firebaseDeleteDoc('news', n.id);
        }
        for (const n of news) {
            await firebaseAddDoc('news', n);
        }
        return;
    }
    if (useMongoDB && db) {
        await db.collection('news').deleteMany({});
        if (news.length > 0) {
            await db.collection('news').insertMany(news);
        }
        return;
    }
    const store = readStore();
    store.news = news;
    writeStore(store);
}

// Resources functions
async function getResources() {
    if (useFirebase && firestore) {
        return await firebaseGetAll('resources');
    }
    if (useMongoDB && db) {
        return await db.collection('resources').find({}).toArray();
    }
    const store = readStore();
    return store.resources || [];
}

async function saveResources(resources) {
    if (useFirebase && firestore) {
        const existing = await firebaseGetAll('resources');
        for (const r of existing) {
            await firebaseDeleteDoc('resources', r.id);
        }
        for (const r of resources) {
            await firebaseAddDoc('resources', r);
        }
        return;
    }
    if (useMongoDB && db) {
        await db.collection('resources').deleteMany({});
        if (resources.length > 0) {
            await db.collection('resources').insertMany(resources);
        }
        return;
    }
    const store = readStore();
    store.resources = resources;
    writeStore(store);
}

// Site content functions
async function getSiteContent() {
    if (useFirebase && firestore) {
        return await firebaseGetDoc('content', 'site');
    }
    if (useMongoDB && db) {
        return await db.collection('content').findOne({ key: 'site' });
    }
    return siteContent;
}

async function saveSiteContent(content) {
    siteContent = content;
    if (useFirebase && firestore) {
        await firebaseSetDoc('content', 'site', content);
        return;
    }
    if (useMongoDB && db) {
        await db.collection('content').updateOne(
            { key: 'site' },
            { $set: { value: content } },
            { upsert: true }
        );
        return;
    }
}

// Admin credentials (hashed)
const ADMIN_CREDENTIALS = {
    email: "admin@abious.org",
    passwordHash: hashPassword("admin123"),
    role: "Admin",
    phone: "+256745490032"
};

// Site content storage (for admin CMS)
let siteContent = {
    contact: {
        address: "Zzaana Bunamwaya By-pass Road, Ssabagabo, Uganda",
        phone: "+256 745490032",
        whatsapp: "+256 745490032",
        email: "eutecticemmanuel@gmail.com",
        tiktok: "https://www.tiktok.com/@abious_rehabilitation_initiative"
    },
    about: {
        text: "Abious Rehabilitation Initiative is a youth-focused organization dedicated to helping young people overcome challenges and reach their full potential."
    },
    gallery: []
};

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
};

function hashPassword(password) {
    return crypto.createHash("sha256").update(password).digest("hex");
}

function createToken() {
    return crypto.randomBytes(24).toString("hex");
}

function nowIso() {
    return new Date().toISOString();
}

function ensureStore() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DATA_FILE)) {
        const initial = {
            users: [
                {
                    id: "u_demo",
                    fullName: "Demo Member",
                    email: "demo@abious.org",
                    passwordHash: hashPassword("demo123"),
                    role: "Member",
                    phone: "",
                    age: null,
                    interests: "",
                    createdAt: nowIso(),
                    lastLoginAt: null
                }
            ],
            sessions: {},
            posts: [
                {
                    id: "p_welcome",
                    authorName: "Community Coordinator",
                    authorEmail: "coordinator@abious.org",
                    text: "Tomorrow we host our career guidance workshop at 10:00 AM. Bring a notebook and any CV drafts for review.",
                    attachment: null,
                    createdAt: nowIso(),
                    comments: [
                        {
                            id: "c_welcome_1",
                            authorName: "Joel",
                            text: "I will attend with two new members.",
                            createdAt: nowIso()
                        }
                    ]
                }
            ],
            chat: [
                { id: "m_1", authorName: "Sarah", text: "Welcome to the member portal everyone.", createdAt: nowIso() },
                { id: "m_2", authorName: "Daniel", text: "Let us post updates after outreach visits.", createdAt: nowIso() }
            ]
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
    }
}

function readStore() {
    ensureStore();
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeStore(store) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    res.end(JSON.stringify(payload));
}

function getRequestBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        req.on("data", (chunk) => {
            total += chunk.length;
            if (total > 6 * 1024 * 1024) {
                reject(new Error("Request body too large"));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => {
            if (!chunks.length) {
                resolve({});
                return;
            }
            try {
                const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
                resolve(parsed);
            } catch {
                reject(new Error("Invalid JSON body"));
            }
        });
        req.on("error", reject);
    });
}

function parseAuthToken(req) {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) return null;
    return auth.slice(7).trim();
}

function requireUser(req, store) {
    const token = parseAuthToken(req);
    if (!token) return null;
    const session = store.sessions[token];
    if (!session) return null;
    
    // Check if it's admin session
    if (session.userId === 'admin') {
        return {
            id: 'admin',
            email: ADMIN_CREDENTIALS.email,
            role: 'Admin',
            fullName: 'Administrator'
        };
    }
    
    const user = store.users.find((u) => u.id === session.userId);
    if (!user) return null;
    return user;
}

function toPublicUser(user) {
    return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role || "Member",
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt || null
    };
}

async function handleApi(req, res, urlObj) {
    try {
        const store = readStore();
        const method = req.method || "GET";
        const pathname = urlObj.pathname;

        if (method === "OPTIONS") {
            res.writeHead(204, {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
            });
            res.end();
            return true;
        }

        if (method === "GET" && pathname === "/api/health") {
            sendJson(res, 200, { ok: true, now: nowIso(), mongodb: useMongoDB });
            return true;
        }

        // Admin login
        if (method === "POST" && pathname === "/api/admin/login") {
            const body = await getRequestBody(req);
            const email = String(body.email || "").trim().toLowerCase();
            const password = String(body.password || "");
            
            // Check admin credentials
            if (email === ADMIN_CREDENTIALS.email && hashPassword(password) === ADMIN_CREDENTIALS.passwordHash) {
                const token = createToken();
                const adminUser = {
                    email: ADMIN_CREDENTIALS.email,
                    role: ADMIN_CREDENTIALS.role,
                    phone: ADMIN_CREDENTIALS.phone
                };
                store.sessions[token] = { userId: "admin", createdAt: nowIso() };
                writeStore(store);
                sendJson(res, 200, { success: true, token, user: adminUser });
                return true;
            }
            sendJson(res, 401, { success: false, message: "Invalid admin credentials" });
            return true;
        }

        // Admin: Get all members
        if (method === "GET" && pathname === "/api/admin/members") {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            const members = store.users.map(u => ({
                id: u.id,
                fullName: u.fullName,
                email: u.email,
                phone: u.phone,
                role: u.role,
                verified: u.verified === true,
                photo: u.photo || null,
                biodata: u.biodata || "",
                createdAt: u.createdAt
            }));
            sendJson(res, 200, { members });
            return true;
        }

        // Admin: Delete member
        if (method === "DELETE" && pathname.startsWith("/api/admin/members/")) {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            const memberId = pathname.split("/").pop();
            store.users = store.users.filter(u => u.id !== memberId);
            writeStore(store);
            sendJson(res, 200, { success: true });
            return true;
        }

        // Admin: Get verification codes
        if (method === "GET" && pathname === "/api/admin/verification-codes") {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            // Clean up expired codes
            const now = Date.now();
            const validCodes = (store.verificationCodes || []).filter(v => v.expires > now);
            if (validCodes.length !== (store.verificationCodes || []).length) {
                store.verificationCodes = validCodes;
                writeStore(store);
            }
            sendJson(res, 200, { codes: validCodes });
            return true;
        }

        // Admin: Add new member (with photo support)
        if (method === "POST" && pathname === "/api/admin/members") {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            
            const body = await getRequestBody(req);
            const name = String(body.name || "").trim();
            const email = String(body.email || "").trim().toLowerCase();
            const phone = String(body.phone || "").trim();
            const password = String(body.password || "");
            const photo = body.photo || null; // Base64 encoded photo
            const biodata = body.biodata || "";
            
            if (!name || !email || !password) {
                sendJson(res, 400, { error: "Name, email, and password are required" });
                return true;
            }
            
            // Check if email already exists
            if (store.users.some(u => u.email === email)) {
                sendJson(res, 409, { error: "Email already registered" });
                return true;
            }
            
            const newMember = {
                id: "u_" + Date.now(),
                fullName: name,
                email,
                passwordHash: hashPassword(password),
                role: "Member",
                phone,
                age: null,
                interests: "",
                photo: photo, // Store base64 photo
                biodata: biodata,
                createdAt: nowIso(),
                lastLoginAt: null,
                verified: true // Admin-created members are automatically verified
            };
            
            store.users.push(newMember);
            writeStore(store);
            
            sendJson(res, 201, { success: true, member: toPublicUser(newMember) });
            return true;
        }

        // Upload member photo (admin)
        if (method === "POST" && pathname.startsWith("/api/admin/members/")) {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            
            const memberId = pathname.split("/")[4];
            const body = await getRequestBody(req);
            const photo = body.photo || null;
            
            const memberIndex = store.users.findIndex(u => u.id === memberId);
            if (memberIndex === -1) {
                sendJson(res, 404, { error: "Member not found" });
                return true;
            }
            
            store.users[memberIndex].photo = photo;
            writeStore(store);
            
            sendJson(res, 200, { success: true, photo: photo });
            return true;
        }

        // Update member profile (photo and biodata)
        if (method === "PUT" && pathname === "/api/members/profile") {
            const user = requireUser(req, store);
            if (!user) {
                sendJson(res, 401, { error: "Unauthorized" });
                return true;
            }
            
            const body = await getRequestBody(req);
            const memberIndex = store.users.findIndex(u => u.id === user.id);
            
            if (memberIndex === -1) {
                sendJson(res, 404, { error: "User not found" });
                return true;
            }
            
            // Update allowed fields
            if (body.photo !== undefined) store.users[memberIndex].photo = body.photo;
            if (body.biodata !== undefined) store.users[memberIndex].biodata = body.biodata;
            if (body.phone !== undefined) store.users[memberIndex].phone = body.phone;
            if (body.age !== undefined) store.users[memberIndex].age = body.age;
            if (body.interests !== undefined) store.users[memberIndex].interests = body.interests;
            if (body.fullName !== undefined) store.users[memberIndex].fullName = body.fullName;
            
            writeStore(store);
            
            sendJson(res, 200, { success: true, user: toPublicUser(store.users[memberIndex]) });
            return true;
        }

        // Get public members (for display page - shows photo and biodata)
        if (method === "GET" && pathname === "/api/public/members") {
            const publicMembers = store.users.map(u => ({
                id: u.id,
                fullName: u.fullName,
                photo: u.photo || null,
                biodata: u.biodata || "",
                role: u.role,
                createdAt: u.createdAt
            }));
            sendJson(res, 200, { members: publicMembers });
            return true;
        }

        // Admin: Get content
        if (method === "GET" && pathname === "/api/admin/content") {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            sendJson(res, 200, siteContent);
            return true;
        }

        // Admin: Get all news/events
        if (method === "GET" && pathname === "/api/admin/news") {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            const news = await getNews();
            sendJson(res, 200, { news });
            return true;
        }

        // Admin: Add news/event
        if (method === "POST" && pathname === "/api/admin/news") {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            
            const body = await getRequestBody(req);
            const title = String(body.title || "").trim();
            const content = String(body.content || "").trim();
            const type = String(body.type || "news").trim(); // news or event
            const eventDate = body.eventDate || null;
            
            if (!title || !content) {
                sendJson(res, 400, { error: "Title and content are required" });
                return true;
            }
            
            const newItem = {
                id: "n_" + Date.now(),
                title,
                content,
                type,
                eventDate,
                createdAt: nowIso(),
                author: user.fullName
            };
            
            const news = await getNews();
            news.push(newItem);
            await saveNews(news);
            
            sendJson(res, 201, { success: true, news: newItem });
            return true;
        }

        // Admin: Delete news/event
        if (method === "DELETE" && pathname.startsWith("/api/admin/news/")) {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            
            const newsId = pathname.split("/").pop();
            
            if (useFirebase && firestore) {
                await firebaseDeleteDoc('news', newsId);
            } else {
                const news = await getNews();
                const filtered = news.filter(n => n.id !== newsId);
                await saveNews(filtered);
            }
            
            sendJson(res, 200, { success: true });
            return true;
        }

        // Public: Get news/events
        if (method === "GET" && pathname === "/api/news") {
            const news = await getNews();
            const sorted = news.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            sendJson(res, 200, { news: sorted });
            return true;
        }

        // Admin: Get all resources
        if (method === "GET" && pathname === "/api/admin/resources") {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            const resources = await getResources();
            sendJson(res, 200, { resources });
            return true;
        }

        // Admin: Add resource
        if (method === "POST" && pathname === "/api/admin/resources") {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            
            const body = await getRequestBody(req);
            const title = String(body.title || "").trim();
            const description = String(body.description || "").trim();
            const link = body.link || null;
            const category = String(body.category || "general").trim();
            
            if (!title) {
                sendJson(res, 400, { error: "Title is required" });
                return true;
            }
            
            const newResource = {
                id: "r_" + Date.now(),
                title,
                description,
                link,
                category,
                createdAt: nowIso()
            };
            
            const resources = await getResources();
            resources.push(newResource);
            await saveResources(resources);
            
            sendJson(res, 201, { success: true, resource: newResource });
            return true;
        }

        // Admin: Delete resource
        if (method === "DELETE" && pathname.startsWith("/api/admin/resources/")) {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            
            const resourceId = pathname.split("/").pop();
            
            if (useFirebase && firestore) {
                await firebaseDeleteDoc('resources', resourceId);
            } else {
                const resources = await getResources();
                const filtered = resources.filter(r => r.id !== resourceId);
                await saveResources(filtered);
            }
            
            sendJson(res, 200, { success: true });
            return true;
        }

        // Public: Get resources
        if (method === "GET" && pathname === "/api/resources") {
            const resources = await getResources();
            const sorted = resources.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            sendJson(res, 200, { resources: sorted });
            return true;
        }

        // Admin: Update contact info
        if (method === "POST" && pathname === "/api/admin/content/contact") {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            const body = await getRequestBody(req);
            siteContent.contact = { ...siteContent.contact, ...body };
            
            // Save to cloud database if available
            await saveSiteContent(siteContent);
            
            sendJson(res, 200, { success: true });
            return true;
        }

        // Email verification: Generate code (admin or public)
        if (method === "POST" && pathname === "/api/verification/generate") {
            // Allow both authenticated admin and public access
            const authUser = requireUser(req, store);
            const body = await getRequestBody(req);
            const email = String(body.email || "").trim().toLowerCase();
            
            if (!email) {
                sendJson(res, 400, { error: "Email required" });
                return true;
            }
            
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const verificationData = {
                email,
                code,
                expires: Date.now() + 3600000, // 1 hour
                createdAt: nowIso()
            };
            
            // Initialize verificationCodes array if it doesn't exist
            if (!store.verificationCodes) {
                store.verificationCodes = [];
            }
            store.verificationCodes.push(verificationData);
            writeStore(store);
            
            // In production, send email here
            console.log(`Verification code for ${email}: ${code}`);
            
            sendJson(res, 200, { success: true, message: "Verification code sent", code: code });
            return true;
        }

        // Email verification: Verify code
        if (method === "POST" && pathname === "/api/verification/verify") {
            const body = await getRequestBody(req);
            const email = String(body.email || "").trim().toLowerCase();
            const code = String(body.code || "");
            
            if (!store.verificationCodes || store.verificationCodes.length === 0) {
                sendJson(res, 400, { error: "No verification code found" });
                return true;
            }
            
            const now = Date.now();
            const verificationIndex = store.verificationCodes.findIndex(
                v => v.email === email && v.code === code && v.expires > now
            );
            
            if (verificationIndex !== -1) {
                // Mark user as verified
                const user = store.users.find(u => u.email === email);
                if (user) {
                    user.verified = true;
                }
                // Remove used verification code
                store.verificationCodes.splice(verificationIndex, 1);
                writeStore(store);
                sendJson(res, 200, { success: true, verified: true });
                return true;
            }
            
            sendJson(res, 400, { error: "Invalid or expired verification code" });
            return true;
        }

        if (method === "POST" && pathname === "/api/register") {
            const body = await getRequestBody(req);
            const fullName = String(body.fullName || "").trim();
            const email = String(body.email || "").trim().toLowerCase();
            const password = String(body.password || "");

            if (!fullName || !email || !password) {
                sendJson(res, 400, { ok: false, error: "Full name, email, and password are required." });
                return true;
            }

            if (store.users.some((u) => u.email === email)) {
                sendJson(res, 409, { ok: false, error: "Email already registered." });
                return true;
            }

            const user = {
                id: "u_" + Date.now(),
                fullName,
                email,
                passwordHash: hashPassword(password),
                role: "Member",
                phone: String(body.phone || "").trim(),
                age: body.age ? Number(body.age) : null,
                interests: String(body.interests || "").trim(),
                biodata: String(body.biodata || "").trim(),
                photo: body.photo || null,
                createdAt: nowIso(),
                lastLoginAt: nowIso()
            };
            store.users.push(user);

            const token = createToken();
            store.sessions[token] = { userId: user.id, createdAt: nowIso() };
            writeStore(store);

            sendJson(res, 201, { ok: true, token, user: toPublicUser(user) });
            return true;
        }

        if (method === "POST" && pathname === "/api/login") {
            const body = await getRequestBody(req);
            const email = String(body.email || "").trim().toLowerCase();
            const password = String(body.password || "");
            const user = store.users.find((u) => u.email === email);

            if (!user || user.passwordHash !== hashPassword(password)) {
                sendJson(res, 401, { ok: false, error: "Invalid email or password." });
                return true;
            }

            user.lastLoginAt = nowIso();
            const token = createToken();
            store.sessions[token] = { userId: user.id, createdAt: nowIso() };
            writeStore(store);

            sendJson(res, 200, { ok: true, token, user: toPublicUser(user) });
            return true;
        }

        if (method === "GET" && pathname === "/api/me") {
            const user = requireUser(req, store);
            if (!user) {
                sendJson(res, 401, { ok: false, error: "Unauthorized." });
                return true;
            }
            sendJson(res, 200, { ok: true, user: toPublicUser(user) });
            return true;
        }

        if (method === "GET" && pathname === "/api/members") {
            const user = requireUser(req, store);
            if (!user) {
                sendJson(res, 401, { ok: false, error: "Unauthorized." });
                return true;
            }
            sendJson(res, 200, { ok: true, members: store.users.map(toPublicUser) });
            return true;
        }

        if (method === "GET" && pathname === "/api/posts") {
            const user = requireUser(req, store);
            if (!user) {
                sendJson(res, 401, { ok: false, error: "Unauthorized." });
                return true;
            }
            const posts = [...store.posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            sendJson(res, 200, { ok: true, posts });
            return true;
        }

        if (method === "POST" && pathname === "/api/posts") {
            const user = requireUser(req, store);
            if (!user) {
                sendJson(res, 401, { ok: false, error: "Unauthorized." });
                return true;
            }

            const body = await getRequestBody(req);
            const text = String(body.text || "").trim();
            const attachment = body.attachment || null;

            if (!text && !attachment) {
                sendJson(res, 400, { ok: false, error: "Post text or attachment is required." });
                return true;
            }

            if (attachment && attachment.dataUrl && String(attachment.dataUrl).length > 5 * 1024 * 1024) {
                sendJson(res, 413, { ok: false, error: "Attachment is too large." });
                return true;
            }

            const post = {
                id: "p_" + Date.now(),
                authorName: user.fullName,
                authorEmail: user.email,
                text,
                attachment: attachment
                    ? {
                        name: String(attachment.name || "attachment"),
                        type: String(attachment.type || "application/octet-stream"),
                        dataUrl: String(attachment.dataUrl || ""),
                        size: Number(attachment.size || 0)
                    }
                    : null,
                createdAt: nowIso(),
                comments: []
            };

            store.posts.push(post);
            writeStore(store);
            sendJson(res, 201, { ok: true, post });
            return true;
        }

        if (method === "POST" && pathname.startsWith("/api/posts/") && pathname.endsWith("/comments")) {
            const user = requireUser(req, store);
            if (!user) {
                sendJson(res, 401, { ok: false, error: "Unauthorized." });
                return true;
            }

            const postId = pathname.split("/")[3];
            const post = store.posts.find((p) => p.id === postId);
            if (!post) {
                sendJson(res, 404, { ok: false, error: "Post not found." });
                return true;
            }

            const body = await getRequestBody(req);
            const text = String(body.text || "").trim();
            if (!text) {
                sendJson(res, 400, { ok: false, error: "Comment is required." });
                return true;
            }

            const comment = {
                id: "c_" + Date.now(),
                authorName: user.fullName,
                text,
                createdAt: nowIso()
            };
            post.comments.push(comment);
            writeStore(store);
            sendJson(res, 201, { ok: true, comment });
            return true;
        }

        if (method === "GET" && pathname === "/api/chat") {
            const user = requireUser(req, store);
            if (!user) {
                sendJson(res, 401, { ok: false, error: "Unauthorized." });
                return true;
            }
            sendJson(res, 200, { ok: true, messages: store.chat });
            return true;
        }

        if (method === "POST" && pathname === "/api/chat") {
            const user = requireUser(req, store);
            if (!user) {
                sendJson(res, 401, { ok: false, error: "Unauthorized." });
                return true;
            }
            const body = await getRequestBody(req);
            const text = String(body.text || "").trim();
            if (!text) {
                sendJson(res, 400, { ok: false, error: "Message is required." });
                return true;
            }
            const message = {
                id: "m_" + Date.now(),
                authorName: user.fullName,
                text,
                createdAt: nowIso()
            };
            store.chat.push(message);
            if (store.chat.length > 120) {
                store.chat = store.chat.slice(store.chat.length - 120);
            }
            writeStore(store);
            sendJson(res, 201, { ok: true, message });
            return true;
        }

        sendJson(res, 404, { ok: false, error: "API route not found." });
        return true;
    } catch (error) {
        sendJson(res, 500, { ok: false, error: error.message || "Server error." });
        return true;
    }
}

function serveStatic(req, res, urlObj) {
    let filePath = decodeURIComponent(urlObj.pathname);
    if (filePath === "/") filePath = "/trial.html";
    const normalized = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");
    const absolute = path.join(ROOT_DIR, normalized);

    if (!absolute.startsWith(ROOT_DIR)) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Forbidden");
        return;
    }

    fs.stat(absolute, (statErr, stats) => {
        if (statErr || !stats.isFile()) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Not found");
            return;
        }

        const ext = path.extname(absolute).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": contentType });
        fs.createReadStream(absolute).pipe(res);
    });
}

const server = http.createServer(async (req, res) => {
    const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (urlObj.pathname.startsWith("/api/")) {
        await handleApi(req, res, urlObj);
        return;
    }
    serveStatic(req, res, urlObj);
});

function getLanAddresses() {
    const interfaces = os.networkInterfaces();
    const addresses = [];

    Object.values(interfaces).forEach((entries) => {
        (entries || []).forEach((entry) => {
            if (entry && entry.family === "IPv4" && !entry.internal) {
                addresses.push(entry.address);
            }
        });
    });

    return Array.from(new Set(addresses));
}

server.listen(PORT, HOST, async () => {
    ensureStore();
    
    // Try to connect to MongoDB
    await connectMongoDB();
    
    console.log(`Abious backend running at http://localhost:${PORT}`);
    getLanAddresses().forEach((ip) => {
        console.log(`LAN access: http://${ip}:${PORT}`);
    });
});
