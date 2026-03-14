#ifndef UTILS_H
#define UTILS_H

#include <string>
#include <functional>
#include <optional>
#include <crow.h>

namespace abious {

// Utility functions
std::string hashPassword(const std::string& password);
std::string createToken();
std::string nowIso();
int64_t currentTimeMillis();

// HTTP helper functions
std::string getMimeType(const std::string& path);
bool fileExists(const std::string& path);

// JSON helpers
crow::json::wvalue parseJson(const std::string& jsonString);
std::string toJson(const crow::json::rvalue& value);

// Authentication helpers
std::optional<std::string> getTokenFromRequest(const crow::request& req);
std::optional<std::string> getCurrentUserId(const crow::request& req);

} // namespace abious

#endif // UTILS_H
