const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const { URL } = require("url");
const nodemailer = require("nodemailer");

function loadEnvFile() {
    const envPath = path.join(__dirname, ".env");
    if (!fs.existsSync(envPath)) {
        return;
    }

    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const separator = trimmed.indexOf("=");
        if (separator === -1) continue;
        const key = trimmed.slice(0, separator).trim();
        const value = trimmed.slice(separator + 1).trim();
        if (key && !process.env[key]) {
            process.env[key] = value;
        }
    }
}

loadEnvFile();

const VERIFICATION_SENDER_EMAIL = process.env.VERIFICATION_SENDER_EMAIL || "isaacnewton0767304563@gmail.com";
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = String(process.env.SMTP_SECURE || "true") !== "false";
const SMTP_FAMILY = Number(process.env.SMTP_FAMILY || 4);
const SMTP_USER = process.env.SMTP_USER || VERIFICATION_SENDER_EMAIL;
const SMTP_PASS = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || "";
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "admin@abious.org").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin@123";
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000);
const VERIFICATION_APPROVAL_TTL_MS = Number(process.env.VERIFICATION_APPROVAL_TTL_MS || 30 * 60 * 1000);
const PASSWORD_HASH_ITERATIONS = Number(process.env.PASSWORD_HASH_ITERATIONS || 120000);
const VERIFICATION_TOKEN_SECRET = process.env.VERIFICATION_TOKEN_SECRET || crypto.randomBytes(32).toString("hex");
const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || "").trim();

if (ADMIN_PASSWORD === "admin@123") {
    console.warn("⚠️ SECURITY WARNING: Using default admin password 'admin@123'. Set ADMIN_PASSWORD in environment variables before production deployment.");
}

function sanitizeInput(input) {
    if (typeof input !== "string") return "";
    return input.replace(/[<>"'`;(){}]/g, "").trim();
}

function sanitizeUserData(user) {
    if (!user || typeof user !== "object") return user;
    return {
        ...user,
        fullName: sanitizeInput(user.fullName || ""),
        email: sanitizeInput((user.email || "").toLowerCase()),
        phone: sanitizeInput(user.phone || ""),
        biodata: sanitizeInput(user.biodata || ""),
        interests: sanitizeInput(user.interests || ""),
        role: sanitizeInput(user.role || "Member"),
        photo: typeof user.photo === "string" ? sanitizeInput(user.photo) : null,
        age: Number(user.age) || null,
        id: sanitizeInput(user.id || ""),
    };
}

function getAllowedOrigin() {
    if (PUBLIC_BASE_URL) {
        return PUBLIC_BASE_URL;
    }
    return "*";
}
let mailTransporter = null;
const rateLimitBuckets = new Map();

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
console.log(`Verification sender: ${VERIFICATION_SENDER_EMAIL}`);
console.log(`SMTP ready: ${canSendVerificationEmails() ? 'yes' : 'no (set SMTP_PASS or GMAIL_APP_PASSWORD)'}`);
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

async function saveSessions(sessionMap) {
    if (useFirebase && firestore) {
        const existing = await firebaseGetAll("sessions");
        for (const session of existing) {
            await firebaseDeleteDoc("sessions", session.id);
        }
        for (const [token, session] of Object.entries(sessionMap || {})) {
            await firebaseSetDoc("sessions", token, { ...session, token });
        }
        return;
    }
    if (useMongoDB && db) {
        await db.collection("sessions").deleteMany({});
        const documents = Object.entries(sessionMap || {}).map(([token, session]) => ({ ...session, token }));
        if (documents.length > 0) {
            await db.collection("sessions").insertMany(documents);
        }
        return;
    }
    const store = readStore();
    store.sessions = sessionMap || {};
    writeStore(store);
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
        await saveSessions(store.sessions);
        await savePosts(store.posts);
        await saveChat(store.chat);
        if (store.verificationCodes) {
            await saveVerificationCodes(store.verificationCodes);
        }
        return;
    }
    if (useMongoDB && db) {
        await saveUsers(store.users);
        await saveSessions(store.sessions);
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

const DEFAULT_SITE_CONTENT = {
    contact: {
        address: "Zzaana Bunamwaya By-pass Road, Ssabagabo, Uganda",
        phone: "+256 745490032",
        whatsapp: "+256 745490032",
        email: "eutecticemmanuel@gmail.com",
        tiktok: "https://www.tiktok.com/search?q=abious%20rehabilitation%20initiative&t=1774816862008"
    },
    links: {
        website: "",
        facebook: "",
        instagram: "",
        x: "",
        youtube: "",
        tiktok: "https://www.tiktok.com/search?q=abious%20rehabilitation%20initiative&t=1774816862008",
        whatsapp: "https://wa.me/256745490032"
    },
    about: {
        text: "Abious Rehabilitation Initiative is a youth-focused organization dedicated to helping young people overcome challenges and reach their full potential."
    },
    gallery: [],
    imageAssets: {},
    privacy: {
        content: "",
        lastUpdated: null,
        updatedBy: null
    },
    security: {
        content: "",
        lastUpdated: null,
        updatedBy: null
    },
    bankAccount: {
        bankName: "",
        accountNumber: "",
        accountName: "",
        branch: "",
        swiftCode: "",
        instructions: ""
    }
};

function normalizeSiteContent(content) {
    return {
        ...DEFAULT_SITE_CONTENT,
        ...(content || {}),
        contact: {
            ...DEFAULT_SITE_CONTENT.contact,
            ...((content && content.contact) || {})
        },
        links: {
            ...DEFAULT_SITE_CONTENT.links,
            ...((content && content.links) || {})
        },
        about: {
            ...DEFAULT_SITE_CONTENT.about,
            ...((content && content.about) || {})
        },
        gallery: Array.isArray(content && content.gallery) ? content.gallery : DEFAULT_SITE_CONTENT.gallery,
        imageAssets: content && content.imageAssets && typeof content.imageAssets === "object" && !Array.isArray(content.imageAssets)
            ? content.imageAssets
            : DEFAULT_SITE_CONTENT.imageAssets,
        privacy: {
            ...DEFAULT_SITE_CONTENT.privacy,
            ...((content && content.privacy) || {})
        },
        security: {
            ...DEFAULT_SITE_CONTENT.security,
            ...((content && content.security) || {})
        },
        bankAccount: {
            ...DEFAULT_SITE_CONTENT.bankAccount,
            ...((content && content.bankAccount) || {})
        }
    };
}

// Site content functions
async function getSiteContent() {
    if (useFirebase && firestore) {
        return normalizeSiteContent(await firebaseGetDoc('content', 'site'));
    }
    if (useMongoDB && db) {
        const doc = await db.collection('content').findOne({ key: 'site' });
        return normalizeSiteContent(doc ? (doc.value || doc) : null);
    }
    const store = readStore();
    return normalizeSiteContent(store.siteContent);
}

async function saveSiteContent(content) {
    siteContent = normalizeSiteContent(content);
    if (useFirebase && firestore) {
        await firebaseSetDoc('content', 'site', siteContent);
        return;
    }
    if (useMongoDB && db) {
        await db.collection('content').updateOne(
            { key: 'site' },
            { $set: { value: siteContent } },
            { upsert: true }
        );
        return;
    }
    const store = readStore();
    store.siteContent = siteContent;
    writeStore(store);
}

// Admin credentials (hashed)
const ADMIN_CREDENTIALS = {
    email: ADMIN_EMAIL,
    passwordHash: hashPassword(ADMIN_PASSWORD),
    role: "Admin",
    phone: "+256745490032"
};

// Site content storage (for admin CMS)
let siteContent = normalizeSiteContent(DEFAULT_SITE_CONTENT);

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

function hashLegacyPassword(password) {
    return crypto.createHash("sha256").update(password).digest("hex");
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const derived = crypto.pbkdf2Sync(password, salt, PASSWORD_HASH_ITERATIONS, 64, "sha512").toString("hex");
    return `pbkdf2$${PASSWORD_HASH_ITERATIONS}$${salt}$${derived}`;
}

function verifyPassword(password, storedHash) {
    if (!storedHash) return false;
    if (!storedHash.startsWith("pbkdf2$")) {
        return hashLegacyPassword(password) === storedHash;
    }

    const [, rawIterations, salt, expected] = storedHash.split("$");
    const iterations = Number(rawIterations);
    if (!iterations || !salt || !expected) return false;

    const actual = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
    return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function needsPasswordRehash(storedHash) {
    return !storedHash || !storedHash.startsWith("pbkdf2$");
}

function createToken() {
    return crypto.randomBytes(24).toString("hex");
}

function createSignedToken(payload) {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto.createHmac("sha256", VERIFICATION_TOKEN_SECRET).update(encodedPayload).digest("base64url");
    return `${encodedPayload}.${signature}`;
}

function readSignedToken(token) {
    if (!token || typeof token !== "string" || !token.includes(".")) return null;
    const [encodedPayload, signature] = token.split(".");
    const expectedSignature = crypto.createHmac("sha256", VERIFICATION_TOKEN_SECRET).update(encodedPayload).digest("base64url");
    if (signature !== expectedSignature) return null;
    try {
        return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    } catch {
        return null;
    }
}

function createVerificationApproval(email) {
    return createSignedToken({
        type: "verification-approval",
        email,
        expiresAt: Date.now() + VERIFICATION_APPROVAL_TTL_MS
    });
}

function verifyVerificationApproval(email, token) {
    const payload = readSignedToken(token);
    return Boolean(
        payload &&
        payload.type === "verification-approval" &&
        typeof payload.email === "string" &&
        payload.email === email &&
        typeof payload.expiresAt === "number" &&
        payload.expiresAt > Date.now()
    );
}

function nowIso() {
    return new Date().toISOString();
}

function getClientIp(req) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
        return forwarded.split(",")[0].trim();
    }
    return req.socket?.remoteAddress || "unknown";
}

function isRateLimited(req, key, limit, windowMs) {
    const bucketKey = `${key}:${getClientIp(req)}`;
    const now = Date.now();
    const bucket = rateLimitBuckets.get(bucketKey);
    if (!bucket || bucket.expiresAt <= now) {
        rateLimitBuckets.set(bucketKey, { count: 1, expiresAt: now + windowMs });
        return false;
    }
    if (bucket.count >= limit) {
        return true;
    }
    bucket.count += 1;
    return false;
}

function cleanupExpiredSessions(store) {
    if (!store || !store.sessions || typeof store.sessions !== "object") return false;
    const now = Date.now();
    let changed = false;
    Object.entries(store.sessions).forEach(([token, session]) => {
        const createdAt = session && session.createdAt ? new Date(session.createdAt).getTime() : 0;
        if (!createdAt || now - createdAt > SESSION_TTL_MS) {
            delete store.sessions[token];
            changed = true;
        }
    });
    return changed;
}

function securityHeaders() {
    return {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Content-Security-Policy": "default-src 'self'; img-src 'self' data: https:; media-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
    };
}

function canSendVerificationEmails() {
    return Boolean(SMTP_USER && SMTP_PASS);
}

function getMailTransporter() {
    if (!canSendVerificationEmails()) {
        return null;
    }

    if (!mailTransporter) {
        mailTransporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_SECURE,
            family: SMTP_FAMILY,
            name: process.env.SMTP_CLIENT_NAME || "abious-rehabilitation-center",
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS
            }
        });
    }

    return mailTransporter;
}

async function sendVerificationEmail(recipientEmail, code) {
    const transporter = getMailTransporter();
    if (!transporter) {
        return {
            delivered: false,
            reason: "smtp_not_configured"
        };
    }

    await transporter.sendMail({
        from: `"Abious Rehabilitation Initiative" <${VERIFICATION_SENDER_EMAIL}>`,
        to: recipientEmail,
        subject: "Your Abious verification code",
        text: `Your verification code is ${code}. It expires in 1 hour.`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #15302b;">
                <h2 style="margin-bottom: 8px;">Abious Rehabilitation Initiative</h2>
                <p>Your verification code is:</p>
                <div style="display: inline-block; padding: 12px 18px; background: #0d6e5e; color: #fff; border-radius: 10px; font-size: 24px; font-weight: 700; letter-spacing: 6px;">
                    ${code}
                </div>
                <p style="margin-top: 18px;">This code expires in 1 hour.</p>
            </div>
        `
    });

    return {
        delivered: true
    };
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
            ],
            news: [],
            resources: [],
            verificationCodes: [],
            siteContent: normalizeSiteContent(DEFAULT_SITE_CONTENT)
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
        return;
    }

    const currentStore = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    let changed = false;

    if (!Array.isArray(currentStore.news)) {
        currentStore.news = [];
        changed = true;
    }
    if (!Array.isArray(currentStore.resources)) {
        currentStore.resources = [];
        changed = true;
    }
    if (!Array.isArray(currentStore.verificationCodes)) {
        currentStore.verificationCodes = [];
        changed = true;
    }
    if (!currentStore.sessions || typeof currentStore.sessions !== "object") {
        currentStore.sessions = {};
        changed = true;
    }
    if (cleanupExpiredSessions(currentStore)) {
        changed = true;
    }
    if (Array.isArray(currentStore.users)) {
        currentStore.users = currentStore.users.map((user) => {
            const nextUser = { ...user };
            if (nextUser.verified === undefined) {
                nextUser.verified = true;
                changed = true;
            }
            return nextUser;
        });
    }

    const normalizedContent = normalizeSiteContent(currentStore.siteContent);
    if (JSON.stringify(currentStore.siteContent || {}) !== JSON.stringify(normalizedContent)) {
        currentStore.siteContent = normalizedContent;
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(currentStore, null, 2), "utf8");
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
    const corsOrigin = getAllowedOrigin();
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        ...securityHeaders()
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
    cleanupExpiredSessions(store);
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
        phone: user.phone || "",
        role: user.role || "Member",
        verified: user.verified === true,
        biodata: user.biodata || "",
        photo: user.photo || null,
        age: user.age ?? null,
        interests: user.interests || "",
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt || null
    };
}

async function handleApi(req, res, urlObj) {
    try {
        const store = await getStore();
        cleanupExpiredSessions(store);
        const method = req.method || "GET";
        const pathname = urlObj.pathname;

        if (useFirebase || useMongoDB) {
            siteContent = await getSiteContent();
        } else {
            siteContent = normalizeSiteContent(store.siteContent);
        }

        if (method === "OPTIONS") {
            const corsOrigin = getAllowedOrigin();
            res.writeHead(204, {
                "Access-Control-Allow-Origin": corsOrigin,
                "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Allow-Credentials": "true",
                ...securityHeaders()
            });
            res.end();
            return true;
        }

        if (method === "GET" && pathname === "/api/health") {
            sendJson(res, 200, {
                ok: true,
                now: nowIso(),
                mongodb: useMongoDB,
                firebase: useFirebase,
                storage: useFirebase ? "firebase" : useMongoDB ? "mongodb" : "json",
                verificationSender: VERIFICATION_SENDER_EMAIL,
                publicBaseUrl: process.env.PUBLIC_BASE_URL || ""
            });
            return true;
        }

        if (method === "GET" && pathname === "/api/public/config") {
            sendJson(res, 200, {
                ok: true,
                registrationOpen: true,
                verificationRequired: true,
                sender: VERIFICATION_SENDER_EMAIL,
                contactEmail: siteContent.contact?.email || ""
            });
            return true;
        }

        if (method === "GET" && pathname === "/api/site-content") {
            sendJson(res, 200, await getSiteContent());
            return true;
        }

        if (method === "GET" && pathname === "/api/privacy-policy") {
            const content = await getSiteContent();
            sendJson(res, 200, content.privacy);
            return true;
        }

        if (method === "GET" && pathname === "/api/security-policy") {
            const content = await getSiteContent();
            sendJson(res, 200, content.security);
            return true;
        }

        if (method === "GET" && pathname === "/api/bank-account") {
            const content = await getSiteContent();
            sendJson(res, 200, content.bankAccount || {});
            return true;
        }

        // Admin login
        if (method === "POST" && pathname === "/api/admin/login") {
            if (isRateLimited(req, "admin-login", 10, 10 * 60 * 1000)) {
                sendJson(res, 429, { success: false, message: "Too many login attempts. Please try again later." });
                return true;
            }
            const body = await getRequestBody(req);
            const email = String(body.email || "").trim().toLowerCase();
            const password = String(body.password || "");
            
            // Check admin credentials
            if (email === ADMIN_CREDENTIALS.email && verifyPassword(password, ADMIN_CREDENTIALS.passwordHash)) {
                const token = createToken();
                const adminUser = {
                    email: ADMIN_CREDENTIALS.email,
                    role: ADMIN_CREDENTIALS.role,
                    phone: ADMIN_CREDENTIALS.phone
                };
                store.sessions[token] = { userId: "admin", createdAt: nowIso() };
                await saveStore(store);
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
            await saveStore(store);
            sendJson(res, 200, { success: true });
            return true;
        }

        // Admin: Update member
        if (method === "PATCH" && pathname.startsWith("/api/admin/members/")) {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }

            const memberId = pathname.split("/").pop();
            const body = await getRequestBody(req);
            const memberIndex = store.users.findIndex((u) => u.id === memberId);

            if (memberIndex === -1) {
                sendJson(res, 404, { error: "Member not found" });
                return true;
            }

            const member = store.users[memberIndex];
            const nextEmail = body.email ? sanitizeInput(String(body.email).toLowerCase()) : member.email;

            if (store.users.some((u) => u.id !== memberId && u.email === nextEmail)) {
                sendJson(res, 409, { error: "Email already registered" });
                return true;
            }

            member.fullName = sanitizeInput(String(body.fullName ?? body.name ?? member.fullName));
            member.email = nextEmail;
            member.phone = sanitizeInput(String(body.phone ?? member.phone ?? ""));
            member.role = sanitizeInput(String(body.role ?? member.role ?? "Member"));
            member.biodata = sanitizeInput(String(body.biodata ?? member.biodata ?? ""));

            if (body.photo !== undefined) {
                member.photo = body.photo ? sanitizeInput(String(body.photo)) : null;
            }
            if (body.verified !== undefined) {
                member.verified = Boolean(body.verified);
            }
            if (body.password) {
                member.passwordHash = hashPassword(String(body.password));
            }

            await saveStore(store);
            sendJson(res, 200, { success: true, member: toPublicUser(member) });
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
                await saveStore(store);
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
            const name = sanitizeInput(String(body.name || ""));
            const email = sanitizeInput(String(body.email || "").toLowerCase());
            const phone = sanitizeInput(String(body.phone || ""));
            const password = String(body.password || "");
            const photo = body.photo ? sanitizeInput(String(body.photo)) : null; // Base64 encoded photo (sanitized)
            const biodata = sanitizeInput(String(body.biodata || ""));
            
            if (!name || !email || !password) {
                sendJson(res, 400, { error: "Name, email, and password are required" });
                return true;
            }
            
            // Check if email already exists
            if (store.users.some(u => u.email === email)) {
                sendJson(res, 409, { error: "Email already registered" });
                return true;
            }
            
            const newMember = sanitizeUserData({
                id: "u_" + Date.now(),
                fullName: name,
                email,
                passwordHash: hashPassword(password),
                role: "Member",
                phone,
                age: null,
                interests: "",
                photo: photo,
                biodata: biodata,
                createdAt: nowIso(),
                lastLoginAt: null,
                verified: true // Admin-created members are automatically verified
            });
            
            store.users.push(newMember);
            await saveStore(store);
            
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
            await saveStore(store);
            
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
            
            // Update allowed fields (sanitize to prevent injection/XSS)
            if (body.photo !== undefined) store.users[memberIndex].photo = body.photo ? sanitizeInput(String(body.photo)) : null;
            if (body.biodata !== undefined) store.users[memberIndex].biodata = sanitizeInput(String(body.biodata));
            if (body.phone !== undefined) store.users[memberIndex].phone = sanitizeInput(String(body.phone));
            if (body.age !== undefined) store.users[memberIndex].age = Number(body.age) || null;
            if (body.interests !== undefined) store.users[memberIndex].interests = sanitizeInput(String(body.interests));
            if (body.fullName !== undefined) store.users[memberIndex].fullName = sanitizeInput(String(body.fullName));
            
            await saveStore(store);
            
            sendJson(res, 200, { success: true, user: toPublicUser(store.users[memberIndex]) });
            return true;
        }

        // Get public members (for display page - shows photo and biodata)
        if (method === "GET" && pathname === "/api/public/members") {
            const publicMembers = store.users.filter((u) => u.verified !== false).map(u => ({
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
            sendJson(res, 200, await getSiteContent());
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
            if (body.tiktok) {
                siteContent.links.tiktok = String(body.tiktok).trim();
            }
            if (body.whatsapp) {
                siteContent.links.whatsapp = String(body.whatsapp).trim();
            }
            
            // Save to cloud database if available
            await saveSiteContent(siteContent);
            
            sendJson(res, 200, { success: true });
            return true;
        }

        if (method === "POST" && pathname === "/api/admin/content/links") {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            const body = await getRequestBody(req);
            siteContent.links = {
                ...siteContent.links,
                website: String(body.website ?? siteContent.links.website ?? "").trim(),
                facebook: String(body.facebook ?? siteContent.links.facebook ?? "").trim(),
                instagram: String(body.instagram ?? siteContent.links.instagram ?? "").trim(),
                x: String(body.x ?? siteContent.links.x ?? "").trim(),
                youtube: String(body.youtube ?? siteContent.links.youtube ?? "").trim(),
                tiktok: String(body.tiktok ?? siteContent.links.tiktok ?? "").trim(),
                whatsapp: String(body.whatsapp ?? siteContent.links.whatsapp ?? "").trim()
            };
            await saveSiteContent(siteContent);
            sendJson(res, 200, { success: true, links: siteContent.links });
            return true;
        }

        if (method === "POST" && pathname === "/api/admin/content/about") {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            const body = await getRequestBody(req);
            siteContent.about = {
                ...siteContent.about,
                text: String(body.text || "").trim()
            };
            await saveSiteContent(siteContent);
            sendJson(res, 200, { success: true, about: siteContent.about });
            return true;
        }

        if (method === "POST" && pathname === "/api/admin/content/gallery") {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            const body = await getRequestBody(req);
            siteContent.gallery = Array.isArray(body.gallery) ? body.gallery.filter(Boolean) : [];
            await saveSiteContent(siteContent);
            sendJson(res, 200, { success: true, gallery: siteContent.gallery });
            return true;
        }

        if (method === "POST" && pathname === "/api/admin/content/images") {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            const body = await getRequestBody(req);
            const nextImages = {};
            const rawImages = body && body.imageAssets && typeof body.imageAssets === "object" ? body.imageAssets : {};
            Object.entries(rawImages).forEach(([key, value]) => {
                const safeKey = String(key || "").trim();
                const safeValue = String(value || "").trim();
                if (safeKey) nextImages[safeKey] = safeValue;
            });
            siteContent.imageAssets = nextImages;
            await saveSiteContent(siteContent);
            sendJson(res, 200, { success: true, imageAssets: siteContent.imageAssets });
            return true;
        }

        if ((method === "PUT" || method === "POST") && pathname === "/api/admin/content/site") {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            const body = await getRequestBody(req);
            await saveSiteContent({
                ...siteContent,
                ...body,
                contact: {
                    ...siteContent.contact,
                    ...((body && body.contact) || {})
                },
                links: {
                    ...siteContent.links,
                    ...((body && body.links) || {})
                },
                about: {
                    ...siteContent.about,
                    ...((body && body.about) || {})
                },
                gallery: Array.isArray(body.gallery) ? body.gallery.filter(Boolean) : siteContent.gallery,
                imageAssets: body && body.imageAssets && typeof body.imageAssets === "object" && !Array.isArray(body.imageAssets)
                    ? body.imageAssets
                    : siteContent.imageAssets,
                privacy: {
                    ...siteContent.privacy,
                    ...((body && body.privacy) || {})
                },
                security: {
                    ...siteContent.security,
                    ...((body && body.security) || {})
                },
                bankAccount: {
                    ...siteContent.bankAccount,
                    ...((body && body.bankAccount) || {})
                }
            });
            sendJson(res, 200, { success: true, content: siteContent });
            return true;
        }

        // Admin: Get privacy policy
        if (method === "GET" && pathname === "/api/admin/privacy") {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            
            const privacyContent = siteContent.privacy || {
                content: "Privacy Policy for Abious Rehabilitation Initiative\n\nLast Updated: " + new Date().toLocaleDateString() + "\n\n1. Introduction\nThis Privacy Policy explains how Abious Rehabilitation Initiative collects, uses, discloses, and safeguards your information.",
                lastUpdated: null,
                updatedBy: null
            };
            
            sendJson(res, 200, privacyContent);
            return true;
        }

        // Admin: Update privacy policy
        if (method === "POST" && pathname === "/api/admin/privacy") {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            
            const body = await getRequestBody(req);
            siteContent.privacy = {
                content: body.content,
                lastUpdated: nowIso(),
                updatedBy: user.email
            };
            
            // Save to cloud database if available
            await saveSiteContent(siteContent);
            
            sendJson(res, 200, { success: true });
            return true;
        }

        // Admin: Get security policy
        if (method === "GET" && pathname === "/api/admin/security") {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            
            const securityContent = siteContent.security || {
                content: "Security Policy for Abious Rehabilitation Initiative\n\nLast Updated: " + new Date().toLocaleDateString() + "\n\n1. Introduction\nThis Security Policy outlines the security measures implemented to protect your information.",
                lastUpdated: null,
                updatedBy: null
            };
            
            sendJson(res, 200, securityContent);
            return true;
        }

        // Admin: Update security policy
        if (method === "POST" && pathname === "/api/admin/security") {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            
            const body = await getRequestBody(req);
            siteContent.security = {
                content: body.content,
                lastUpdated: nowIso(),
                updatedBy: user.email
            };
            
            // Save to cloud database if available
            await saveSiteContent(siteContent);
            
            sendJson(res, 200, { success: true });
            return true;
        }

        // Admin: Update bank account
        if (method === "POST" && pathname === "/api/admin/content/bank-account") {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }
            
            const body = await getRequestBody(req);
            siteContent.bankAccount = {
                bankName: String(body.bankName || "").trim(),
                accountNumber: String(body.accountNumber || "").trim(),
                accountName: String(body.accountName || "").trim(),
                branch: String(body.branch || "").trim(),
                swiftCode: String(body.swiftCode || "").trim(),
                instructions: String(body.instructions || "").trim()
            };
            
            // Save to cloud database if available
            await saveSiteContent(siteContent);
            
            sendJson(res, 200, { success: true, bankAccount: siteContent.bankAccount });
            return true;
        }

        // Email verification: Generate code (admin or public)
        if (method === "POST" && pathname === "/api/verification/generate") {
            if (isRateLimited(req, "verification-generate", 8, 10 * 60 * 1000)) {
                sendJson(res, 429, { error: "Too many verification requests. Please wait a few minutes and try again." });
                return true;
            }
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
            store.verificationCodes = store.verificationCodes.filter((item) => item.email !== email && item.expires > Date.now());
            store.verificationCodes.push(verificationData);
            await saveStore(store);
            
            let delivery = { delivered: false, reason: "smtp_not_configured" };
            try {
                delivery = await sendVerificationEmail(email, code);
            } catch (mailError) {
                console.error(`Verification email delivery failed for ${email}:`, mailError.message);
                delivery = { delivered: false, reason: mailError.message };
            }

            // Avoid logging verification codes in production logs for security.
            // console.log(`Verification code for ${email} from ${VERIFICATION_SENDER_EMAIL}: ${code}`);
            
            sendJson(res, 200, {
                success: true,
                message: delivery.delivered
                    ? `Verification code sent from ${VERIFICATION_SENDER_EMAIL}`
                    : `Verification code created. Email sender is configured as ${VERIFICATION_SENDER_EMAIL}`,
                sender: VERIFICATION_SENDER_EMAIL,
                delivery
            });
            return true;
        }

        // Email verification: Verify code
        if (method === "POST" && pathname === "/api/verification/verify") {
            if (isRateLimited(req, "verification-verify", 12, 10 * 60 * 1000)) {
                sendJson(res, 429, { error: "Too many verification attempts. Please wait a few minutes and try again." });
                return true;
            }
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
                await saveStore(store);
                sendJson(res, 200, {
                    success: true,
                    verified: true,
                    verificationToken: createVerificationApproval(email)
                });
                return true;
            }
            
            sendJson(res, 400, { error: "Invalid or expired verification code" });
            return true;
        }

        if (method === "POST" && pathname === "/api/register") {
            if (isRateLimited(req, "register", 10, 10 * 60 * 1000)) {
                sendJson(res, 429, { ok: false, error: "Too many registration attempts. Please try again later." });
                return true;
            }
            const body = await getRequestBody(req);
            const fullName = sanitizeInput(String(body.fullName || ""));
            const email = sanitizeInput(String(body.email || "").toLowerCase());
            const password = String(body.password || "");
            const verificationToken = String(body.verificationToken || "");

            if (!fullName || !email || !password) {
                sendJson(res, 400, { ok: false, error: "Full name, email, and password are required." });
                return true;
            }
            if (!verifyVerificationApproval(email, verificationToken)) {
                sendJson(res, 400, { ok: false, error: "Email verification expired or missing. Please verify your email again." });
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
                lastLoginAt: nowIso(),
                verified: true,
                plan: String(body.plan || "free").trim() || "free"
            };
            store.users.push(user);

            const token = createToken();
            store.sessions[token] = { userId: user.id, createdAt: nowIso() };
            await saveStore(store);

            sendJson(res, 201, { ok: true, token, user: toPublicUser(user) });
            return true;
        }

        if (method === "POST" && pathname === "/api/login") {
            if (isRateLimited(req, "member-login", 15, 10 * 60 * 1000)) {
                sendJson(res, 429, { ok: false, error: "Too many login attempts. Please try again later." });
                return true;
            }
            const body = await getRequestBody(req);
            const email = String(body.email || "").trim().toLowerCase();
            const password = String(body.password || "");
            const user = store.users.find((u) => u.email === email);

            if (!user || !verifyPassword(password, user.passwordHash)) {
                sendJson(res, 401, { ok: false, error: "Invalid email or password." });
                return true;
            }
            if (user.verified === false) {
                sendJson(res, 403, { ok: false, error: "Please verify your email before logging in." });
                return true;
            }
            if (needsPasswordRehash(user.passwordHash)) {
                user.passwordHash = hashPassword(password);
            }

            user.lastLoginAt = nowIso();
            const token = createToken();
            store.sessions[token] = { userId: user.id, createdAt: nowIso() };
            await saveStore(store);

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

        if (method === "GET" && pathname === "/api/admin/posts") {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
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
            await saveStore(store);
            sendJson(res, 201, { ok: true, post });
            return true;
        }

        if (method === "DELETE" && pathname.startsWith("/api/admin/posts/") && pathname.endsWith("/attachment")) {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }

            const postId = pathname.split("/")[4];
            const post = store.posts.find((item) => item.id === postId);
            if (!post) {
                sendJson(res, 404, { error: "Post not found." });
                return true;
            }

            post.attachment = null;
            await saveStore(store);
            sendJson(res, 200, { ok: true, post });
            return true;
        }

        if (method === "DELETE" && pathname.startsWith("/api/admin/posts/")) {
            const user = requireUser(req, store);
            if (!user || user.role !== "Admin") {
                sendJson(res, 403, { error: "Admin access required" });
                return true;
            }

            const postId = pathname.split("/")[4];
            const postIndex = store.posts.findIndex((item) => item.id === postId);
            if (postIndex === -1) {
                sendJson(res, 404, { error: "Post not found." });
                return true;
            }

            store.posts.splice(postIndex, 1);
            await saveStore(store);
            sendJson(res, 200, { ok: true });
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
            await saveStore(store);
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
            await saveStore(store);
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
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...securityHeaders() });
            res.end("Not found");
            return;
        }

        const ext = path.extname(absolute).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": contentType, ...securityHeaders() });
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
    siteContent = await getSiteContent();
    
    console.log(`Abious backend running at http://localhost:${PORT}`);
    getLanAddresses().forEach((ip) => {
        console.log(`LAN access: http://${ip}:${PORT}`);
    });
});
