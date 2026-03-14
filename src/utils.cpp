#include "utils.h"
#include "database.h"
#include <iostream>
#include <sstream>
#include <iomanip>
#include <chrono>
#include <filesystem>
#include <fstream>
#include <openssl/sha.h>
#include <openssl/ripemd.h>
#include <openssl/hmac.h>
#include <openssl/evp.h>
#include <crow/json.h>

namespace abious {

// Simple SHA256 hash for passwords
std::string hashPassword(const std::string& password) {
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256(reinterpret_cast<const unsigned char*>(password.c_str()), password.length(), hash);
    
    std::stringstream ss;
    for (int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
        ss << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(hash[i]);
    }
    return ss.str();
}

// Generate random token
std::string createToken() {
    std::stringstream ss;
    auto now = std::chrono::system_clock::now();
    auto duration = now.time_since_epoch();
    auto millis = std::chrono::duration_cast<std::chrono::milliseconds>(duration).count();
    
    ss << std::hex << millis;
    
    // Add random bytes
    for (int i = 0; i < 16; i++) {
        ss << std::hex << std::setw(2) << std::setfill('0') << (rand() % 256);
    }
    
    return ss.str();
}

// Get current ISO timestamp
std::string nowIso() {
    auto now = std::chrono::system_clock::now();
    auto time = std::chrono::system_clock::to_time_t(now);
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()
    ) % 1000;
    
    std::tm tm = *std::gmtime(&time);
    std::stringstream ss;
    ss << std::put_time(&tm, "%Y-%m-%dT%H:%M:%S");
    ss << '.' << std::setfill('0') << std::setw(3) << ms.count() << 'Z';
    return ss.str();
}

int64_t currentTimeMillis() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();
}

// Get MIME type based on file extension
std::string getMimeType(const std::string& path) {
    std::string ext = path.substr(path.find_last_of('.') + 1);
    
    if (ext == "html" || ext == "htm") return "text/html; charset=utf-8";
    if (ext == "css") return "text/css; charset=utf-8";
    if (ext == "js") return "application/javascript; charset=utf-8";
    if (ext == "json") return "application/json; charset=utf-8";
    if (ext == "png") return "image/png";
    if (ext == "jpg" || ext == "jpeg") return "image/jpeg";
    if (ext == "gif") return "image/gif";
    if (ext == "svg") return "image/svg+xml";
    if (ext == "ico") return "image/x-icon";
    if (ext == "txt") return "text/plain; charset=utf-8";
    
    return "application/octet-stream";
}

// Check if file exists
bool fileExists(const std::string& path) {
    return std::filesystem::exists(path);
}

// Parse JSON string
crow::json::wvalue parseJson(const std::string& jsonString) {
    return crow::json::load(jsonString);
}

// Convert to JSON string
std::string toJson(const crow::json::rvalue& value) {
    return value.dump();
}

// Get token from request header
std::optional<std::string> getTokenFromRequest(const crow::request& req) {
    auto authHeader = req.get_header_value("Authorization");
    if (authHeader.empty()) {
        return std::nullopt;
    }
    
    // Check for Bearer token
    if (authHeader.substr(0, 7) == "Bearer ") {
        return authHeader.substr(7);
    }
    
    return std::nullopt;
}

// Get current user ID from token
std::optional<std::string> getCurrentUserId(const crow::request& req) {
    auto tokenOpt = getTokenFromRequest(req);
    if (!tokenOpt) {
        return std::nullopt;
    }
    
    auto& db = Database::getInstance();
    auto sessionOpt = db.findSession(*tokenOpt);
    if (!sessionOpt) {
        return std::nullopt;
    }
    
    auto sessionView = sessionOpt->view();
    return std::string(sessionView["userId"].get_string().value.data());
}

} // namespace abious
