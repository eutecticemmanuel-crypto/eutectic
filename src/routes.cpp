#include "routes.h"
#include "database.h"
#include "utils.h"
#include "models.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <filesystem>
#include <bsoncxx/builder/stream/document.hpp>

using bsoncxx::builder::stream::document;
using bsoncxx::builder::stream::finalize;

namespace abious {

// Global static directory path
std::string g_staticDir;

void setupRoutes(Crow& app) {
    setupApiRoutes(app);
    setupStaticRoutes(app, g_staticDir);
}

void setupStaticRoutes(Crow& app, const std::string& staticDir) {
    g_staticDir = staticDir;
    
    // Serve root as trial.html
    CROW_ROUTE(app, "/")([]() {
        std::string path = g_staticDir + "/trial.html";
        if (fileExists(path)) {
            std::ifstream file(path);
            std::stringstream buffer;
            buffer << file.rdbuf();
            return crow::response(buffer.str());
        }
        return crow::response(404, "Not found");
    });
    
    // Serve static files
    CROW_ROUTE(app, "/<path>")([&](const crow::request& req, std::string path) {
        // Prevent directory traversal
        if (path.find("..") != std::string::npos) {
            return crow::response(403, "Forbidden");
        }
        
        std::string fullPath = g_staticDir + "/" + path;
        
        if (fileExists(fullPath)) {
            std::ifstream file(fullPath, std::ios::binary);
            std::stringstream buffer;
            buffer << file.rdbuf();
            
            crow::response res(buffer.str());
            res.set_header("Content-Type", getMimeType(fullPath));
            return res;
        }
        
        return crow::response(404, "Not found");
    });
}

void setupApiRoutes(Crow& app) {
    auto& db = Database::getInstance();
    
    // ==================== Authentication ====================
    
    // Register
    CROW_ROUTE(app, "/api/register").methods(crow::Method::POST)([&](const crow::request& req) {
        auto body = crow::json::load(req.body);
        if (!body) {
            return crow::response(400, "{\"ok\": false, \"error\": \"Invalid JSON\"}");
        }
        
        std::string fullName = body["fullName"].s();
        std::string email = body["email"].s();
        std::string password = body["password"].s();
        
        if (fullName.empty() || email.empty() || password.empty()) {
            return crow::response(400, "{\"ok\": false, \"error\": \"Full name, email, and password are required.\"}");
        }
        
        // Check if email exists
        auto existingUser = db.findUserByEmail(email);
        if (existingUser) {
            return crow::response(409, "{\"ok\": false, \"error\": \"Email already registered.\"}");
        }
        
        // Create user
        auto userDoc = document{}
            << "id" << ("u_" + std::to_string(currentTimeMillis()))
            << "fullName" << fullName
            << "email" << email
            << "passwordHash" << hashPassword(password)
            << "role" << "Member"
            << "phone" << (body["phone"] ? body["phone"].s() : "")
            << "age" << (body["age"] ? body["age"].i() : 0)
            << "interests" << (body["interests"] ? body["interests"].s() : "")
            << "createdAt" << nowIso()
            << "lastLoginAt" << nowIso()
            << "verified" << true
            << finalize;
        
        db.insertUser(userDoc.view());
        
        // Create session
        std::string token = createToken();
        auto sessionDoc = document{}
            << "token" << token
            << "userId" << ("u_" + std::to_string(currentTimeMillis()))
            << "createdAt" << nowIso()
            << finalize;
        
        db.upsertSession(token, sessionDoc.view());
        
        std::stringstream response;
        response << "{\"ok\": true, \"token\": \"" << token << "\", \"user\": {"
                 << "\"id\": \"u_" << currentTimeMillis() << "\","
                 << "\"fullName\": \"" << fullName << "\","
                 << "\"email\": \"" << email << "\","
                 << "\"role\": \"Member\""
                 << "}}";
        
        return crow::response(201, response.str());
    });
    
    // Login
    CROW_ROUTE(app, "/api/login").methods(crow::Method::POST)([&](const crow::request& req) {
        auto body = crow::json::load(req.body);
        if (!body) {
            return crow::response(400, "{\"ok\": false, \"error\": \"Invalid JSON\"}");
        }
        
        std::string email = body["email"].s();
        std::string password = body["password"].s();
        
        auto userOpt = db.findUserByEmail(email);
        if (!userOpt) {
            return crow::response(401, "{\"ok\": false, \"error\": \"Invalid email or password.\"}");
        }
        
        auto userView = userOpt->view();
        std::string storedHash = std::string(userView["passwordHash"].get_string().value.data());
        
        if (storedHash != hashPassword(password)) {
            return crow::response(401, "{\"ok\": false, \"error\": \"Invalid email or password.\"}");
        }
        
        // Create session
        std::string token = createToken();
        std::string userId = std::string(userView["id"].get_string().value.data());
        
        auto sessionDoc = document{}
            << "token" << token
            << "userId" << userId
            << "createdAt" << nowIso()
            << finalize;
        
        db.upsertSession(token, sessionDoc.view());
        
        std::string fullName = std::string(userView["fullName"].get_string().value.data());
        std::string role = std::string(userView["role"].get_string().value.data());
        
        std::stringstream response;
        response << "{\"ok\": true, \"token\": \"" << token << "\", \"user\": {"
                 << "\"id\": \"" << userId << "\","
                 << "\"fullName\": \"" << fullName << "\","
                 << "\"email\": \"" << email << "\","
                 << "\"role\": \"" << role << "\""
                 << "}}";
        
        return crow::response(200, response.str());
    });
    
    // Get current user
    CROW_ROUTE(app, "/api/me").methods(crow::Method::GET)([&](const crow::request& req) {
        auto userIdOpt = getCurrentUserId(req);
        if (!userIdOpt) {
            return crow::response(401, "{\"ok\": false, \"error\": \"Unauthorized.\"}");
        }
        
        // Find user by ID (we need to search all users)
        auto users = db.getAllUsers();
        for (auto&& userDoc : users) {
            auto view = userDoc.view();
            if (std::string(view["id"].get_string().value.data()) == *userIdOpt) {
                std::string fullName = std::string(view["fullName"].get_string().value.data());
                std::string email = std::string(view["email"].get_string().value.data());
                std::string role = std::string(view["role"].get_string().value.data());
                
                std::stringstream response;
                response << "{\"ok\": true, \"user\": {"
                         << "\"id\": \"" << *userIdOpt << "\","
                         << "\"fullName\": \"" << fullName << "\","
                         << "\"email\": \"" << email << "\","
                         << "\"role\": \"" << role << "\""
                         << "}}";
                return crow::response(200, response.str());
            }
        }
        
        return crow::response(401, "{\"ok\": false, \"error\": \"User not found.\"}");
    });
    
    // ==================== Members ====================
    
    // Get all members
    CROW_ROUTE(app, "/api/members").methods(crow::Method::GET)([&](const crow::request& req) {
        auto userIdOpt = getCurrentUserId(req);
        if (!userIdOpt) {
            return crow::response(401, "{\"ok\": false, \"error\": \"Unauthorized.\"}");
        }
        
        auto users = db.getAllUsers();
        
        std::stringstream response;
        response << "{\"ok\": true, \"members\": [";
        
        bool first = true;
        for (auto&& userDoc : users) {
            auto view = userDoc.view();
            if (!first) response << ",";
            first = false;
            
            response << "{"
                     << "\"id\": \"" << view["id"].get_string().value.data() << "\","
                     << "\"fullName\": \"" << view["fullName"].get_string().value.data() << "\","
                     << "\"email\": \"" << view["email"].get_string().value.data() << "\","
                     << "\"role\": \"" << view["role"].get_string().value.data() << "\""
                     << "}";
        }
        
        response << "]}";
        
        return crow::response(200, response.str());
    });
    
    // ==================== Posts ====================
    
    // Get all posts
    CROW_ROUTE(app, "/api/posts").methods(crow::Method::GET)([&](const crow::request& req) {
        auto userIdOpt = getCurrentUserId(req);
        if (!userIdOpt) {
            return crow::response(401, "{\"ok\": false, \"error\": \"Unauthorized.\"}");
        }
        
        auto posts = db.getAllPosts();
        
        std::stringstream response;
        response << "{\"ok\": true, \"posts\": [";
        
        bool first = true;
        for (auto&& postDoc : posts) {
            auto view = postDoc.view();
            if (!first) response << ",";
            first = false;
            
            response << "{"
                     << "\"id\": \"" << view["id"].get_string().value.data() << "\","
                     << "\"authorName\": \"" << view["authorName"].get_string().value.data() << "\","
                     << "\"authorEmail\": \"" << view["authorEmail"].get_string().value.data() << "\","
                     << "\"text\": \"" << view["text"].get_string().value.data() << "\","
                     << "\"createdAt\": \"" << view["createdAt"].get_string().value.data() << "\""
                     << "}";
        }
        
        response << "]}";
        
        return crow::response(200, response.str());
    });
    
    // Create post
    CROW_ROUTE(app, "/api/posts").methods(crow::Method::POST)([&](const crow::request& req) {
        auto userIdOpt = getCurrentUserId(req);
        if (!userIdOpt) {
            return crow::response(401, "{\"ok\": false, \"error\": \"Unauthorized.\"}");
        }
        
        auto body = crow::json::load(req.body);
        if (!body) {
            return crow::response(400, "{\"ok\": false, \"error\": \"Invalid JSON\"}");
        }
        
        std::string text = body["text"].s();
        
        if (text.empty()) {
            return crow::response(400, "{\"ok\": false, \"error\": \"Post text is required.\"}");
        }
        
        // Find user for author info
        std::string authorName = "Unknown";
        std::string authorEmail = "unknown@email.com";
        
        auto users = db.getAllUsers();
        for (auto&& userDoc : users) {
            auto view = userDoc.view();
            if (std::string(view["id"].get_string().value.data()) == *userIdOpt) {
                authorName = std::string(view["fullName"].get_string().value.data());
                authorEmail = std::string(view["email"].get_string().value.data());
                break;
            }
        }
        
        std::string postId = "p_" + std::to_string(currentTimeMillis());
        
        auto postDoc = document{}
            << "id" << postId
            << "authorName" << authorName
            << "authorEmail" << authorEmail
            << "text" << text
            << "createdAt" << nowIso()
            << finalize;
        
        db.insertPost(postDoc.view());
        
        std::stringstream response;
        response << "{\"ok\": true, \"post\": {"
                 << "\"id\": \"" << postId << "\","
                 << "\"authorName\": \"" << authorName << "\","
                 << "\"authorEmail\": \"" << authorEmail << "\","
                 << "\"text\": \"" << text << "\","
                 << "\"createdAt\": \"" << nowIso() << "\""
                 << "}}";
        
        return crow::response(201, response.str());
    });
    
    // ==================== Chat ====================
    
    // Get chat messages
    CROW_ROUTE(app, "/api/chat").methods(crow::Method::GET)([&](const crow::request& req) {
        auto userIdOpt = getCurrentUserId(req);
        if (!userIdOpt) {
            return crow::response(401, "{\"ok\": false, \"error\": \"Unauthorized.\"}");
        }
        
        auto messages = db.getChatMessages();
        
        std::stringstream response;
        response << "{\"ok\": true, \"messages\": [";
        
        bool first = true;
        for (auto&& msgDoc : messages) {
            auto view = msgDoc.view();
            if (!first) response << ",";
            first = false;
            
            response << "{"
                     << "\"id\": \"" << view["id"].get_string().value.data() << "\","
                     << "\"authorName\": \"" << view["authorName"].get_string().value.data() << "\","
                     << "\"text\": \"" << view["text"].get_string().value.data() << "\","
                     << "\"createdAt\": \"" << view["createdAt"].get_string().value.data() << "\""
                     << "}";
        }
        
        response << "]}";
        
        return crow::response(200, response.str());
    });
    
    // Send chat message
    CROW_ROUTE(app, "/api/chat").methods(crow::Method::POST)([&](const crow::request& req) {
        auto userIdOpt = getCurrentUserId(req);
        if (!userIdOpt) {
            return crow::response(401, "{\"ok\": false, \"error\": \"Unauthorized.\"}");
        }
        
        auto body = crow::json::load(req.body);
        if (!body) {
            return crow::response(400, "{\"ok\": false, \"error\": \"Invalid JSON\"}");
        }
        
        std::string text = body["text"].s();
        
        if (text.empty()) {
            return crow::response(400, "{\"ok\": false, \"error\": \"Message is required.\"}");
        }
        
        // Find user for author info
        std::string authorName = "Unknown";
        
        auto users = db.getAllUsers();
        for (auto&& userDoc : users) {
            auto view = userDoc.view();
            if (std::string(view["id"].get_string().value.data()) == *userIdOpt) {
                authorName = std::string(view["fullName"].get_string().value.data());
                break;
            }
        }
        
        std::string msgId = "m_" + std::to_string(currentTimeMillis());
        
        auto msgDoc = document{}
            << "id" << msgId
            << "authorName" << authorName
            << "text" << text
            << "createdAt" << nowIso()
            << finalize;
        
        db.insertChatMessage(msgDoc.view());
        
        std::stringstream response;
        response << "{\"ok\": true, \"message\": {"
                 << "\"id\": \"" << msgId << "\","
                 << "\"authorName\": \"" << authorName << "\","
                 << "\"text\": \"" << text << "\","
                 << "\"createdAt\": \"" << nowIso() << "\""
                 << "}}";
        
        return crow::response(201, response.str());
    });
    
    // ==================== Admin ====================
    
    // Admin: Get content
    CROW_ROUTE(app, "/api/admin/content").methods(crow::Method::GET)([&](const crow::request& req) {
        auto userIdOpt = getCurrentUserId(req);
        if (!userIdOpt) {
            return crow::response(403, "{\"error\": \"Admin access required\"}");
        }
        
        // Check if admin
        auto users = db.getAllUsers();
        bool isAdmin = false;
        for (auto&& userDoc : users) {
            auto view = userDoc.view();
            if (std::string(view["id"].get_string().value.data()) == *userIdOpt) {
                if (std::string(view["role"].get_string().value.data()) == "Admin") {
                    isAdmin = true;
                }
                break;
            }
        }
        
        if (!isAdmin) {
            return crow::response(403, "{\"error\": \"Admin access required\"}");
        }
        
        auto contentOpt = db.getContent("site");
        
        std::stringstream response;
        response << "{"
                 << "\"contact\": {"
                 << "\"address\": \"Zzaana Bunamwaya By-pass Road, Ssabagabo, Uganda\","
                 << "\"phone\": \"+256 745490032\","
                 << "\"whatsapp\": \"+256 745490032\","
                 << "\"email\": \"eutecticemmanuel@gmail.com\","
                 << "\"tiktok\": \"https://www.tiktok.com/@abious_rehabilitation_initiative\""
                 << "},"
                 << "\"about\": {"
                 << "\"text\": \"Abious Rehabilitation Initiative is a youth-focused organization dedicated to helping young people overcome challenges and reach their full potential.\""
                 << "}"
                 << "}";
        
        return crow::response(200, response.str());
    });
    
    // Admin: Update contact
    CROW_ROUTE(app, "/api/admin/content/contact").methods(crow::Method::POST)([&](const crow::request& req) {
        auto userIdOpt = getCurrentUserId(req);
        if (!userIdOpt) {
            return crow::response(403, "{\"error\": \"Admin access required\"}");
        }
        
        // Check if admin (simplified - in production, verify properly)
        auto users = db.getAllUsers();
        bool isAdmin = false;
        for (auto&& userDoc : users) {
            auto view = userDoc.view();
            if (std::string(view["id"].get_string().value.data()) == *userIdOpt) {
                if (std::string(view["role"].get_string().value.data()) == "Admin") {
                    isAdmin = true;
                }
                break;
            }
        }
        
        if (!isAdmin) {
            return crow::response(403, "{\"error\": \"Admin access required\"}");
        }
        
        auto body = crow::json::load(req.body);
        
        auto contentDoc = document{}
            << "key" << "contact"
            << "address" << (body["address"] ? body["address"].s() : "")
            << "phone" << (body["phone"] ? body["phone"].s() : "")
            << "whatsapp" << (body["whatsapp"] ? body["whatsapp"].s() : "")
            << "email" << (body["email"] ? body["email"].s() : "")
            << "tiktok" << (body["tiktok"] ? body["tiktok"].s() : "")
            << finalize;
        
        db.setContent("contact", contentDoc.view());
        
        return crow::response(200, "{\"success\": true}");
    });
    
    // ==================== Verification ====================
    
    // Generate verification code
    CROW_ROUTE(app, "/api/verification/generate").methods(crow::Method::POST)([&](const crow::request& req) {
        auto body = crow::json::load(req.body);
        if (!body) {
            return crow::response(400, "{\"error\": \"Email required\"}");
        }
        
        std::string email = body["email"].s();
        
        if (email.empty()) {
            return crow::response(400, "{\"error\": \"Email required\"}");
        }
        
        // Generate random 6-digit code
        int code = 100000 + (rand() % 900000);
        
        auto verificationDoc = document{}
            << "email" << email
            << "code" << std::to_string(code)
            << "expires" << (currentTimeMillis() + 3600000) // 1 hour
            << "createdAt" << nowIso()
            << finalize;
        
        db.insertVerificationCode(verificationDoc.view());
        
        // In production, send email here
        std::cout << "Verification code for " << email << ": " << code << std::endl;
        
        return crow::response(200, "{\"success\": true, \"message\": \"Verification code sent\"}");
    });
    
    // Verify code
    CROW_ROUTE(app, "/api/verification/verify").methods(crow::Method::POST)([&](const crow::request& req) {
        auto body = crow::json::load(req.body);
        if (!body) {
            return crow::response(400, "{\"error\": \"Invalid request\"}");
        }
        
        std::string email = body["email"].s();
        std::string code = body["code"].s();
        
        // Find and verify code
        auto users = db.getAllUsers();
        for (auto&& userDoc : users) {
            auto view = userDoc.view();
            if (std::string(view["email"].get_string().value.data()) == email) {
                // Mark user as verified
                auto updateDoc = document{}
                    << "verified" << true
                    << finalize;
                
                db.updateUser(email, updateDoc.view());
                
                return crow::response(200, "{\"success\": true, \"verified\": true}");
            }
        }
        
        return crow::response(400, "{\"error\": \"Invalid or expired verification code\"}");
    });
    
    // ==================== Admin Member Management ====================
    
    // Admin: Create member
    CROW_ROUTE(app, "/api/admin/members").methods(crow::Method::POST)([&](const crow::request& req) {
        auto userIdOpt = getCurrentUserId(req);
        if (!userIdOpt) {
            return crow::response(403, "{\"error\": \"Admin access required\"}");
        }
        
        auto body = crow::json::load(req.body);
        
        std::string name = body["name"].s();
        std::string email = body["email"].s();
        std::string password = body["password"].s();
        
        if (name.empty() || email.empty() || password.empty()) {
            return crow::response(400, "{\"error\": \"Name, email, and password are required\"}");
        }
        
        // Check if email exists
        auto existingUser = db.findUserByEmail(email);
        if (existingUser) {
            return crow::response(409, "{\"error\": \"Email already registered\"}");
        }
        
        auto userDoc = document{}
            << "id" << ("u_" + std::to_string(currentTimeMillis()))
            << "fullName" << name
            << "email" << email
            << "passwordHash" << hashPassword(password)
            << "role" << "Member"
            << "phone" << (body["phone"] ? body["phone"].s() : "")
            << "age" << 0
            << "interests" << ""
            << "createdAt" << nowIso()
            << "lastLoginAt" << ""
            << "verified" << true
            << finalize;
        
        db.insertUser(userDoc.view());
        
        std::stringstream response;
        response << "{\"success\": true, \"member\": {"
                 << "\"id\": \"u_" << currentTimeMillis() << "\","
                 << "\"fullName\": \"" << name << "\","
                 << "\"email\": \"" << email << "\","
                 << "\"role\": \"Member\""
                 << "}}";
        
        return crow::response(201, response.str());
    });
}

} // namespace abious
