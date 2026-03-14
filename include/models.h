#ifndef MODELS_H
#define MODELS_H

#include <string>
#include <vector>
#include <optional>
#include <bsoncxx/document/view.hpp>

namespace abious {

// User model
struct User {
    std::string id;
    std::string fullName;
    std::string email;
    std::string passwordHash;
    std::string role;
    std::string phone;
    int age;
    std::string interests;
    std::string createdAt;
    std::string lastLoginAt;
    bool verified;
    
    static User fromDocument(bsoncxx::document::view doc);
    bsoncxx::document::value toDocument() const;
};

// Session model
struct Session {
    std::string token;
    std::string userId;
    std::string createdAt;
    
    static Session fromDocument(bsoncxx::document::view doc);
    bsoncxx::document::value toDocument() const;
};

// Post model
struct Post {
    std::string id;
    std::string authorName;
    std::string authorEmail;
    std::string text;
    std::optional<std::string> attachmentName;
    std::optional<std::string> attachmentType;
    std::optional<std::string> attachmentDataUrl;
    int attachmentSize;
    std::string createdAt;
    std::vector<Comment> comments;
    
    static Post fromDocument(bsoncxx::document::view doc);
    bsoncxx::document::value toDocument() const;
};

// Comment model
struct Comment {
    std::string id;
    std::string authorName;
    std::string text;
    std::string createdAt;
    
    static Comment fromDocument(bsoncxx::document::view doc);
    bsoncxx::document::value toDocument() const;
};

// Chat message model
struct ChatMessage {
    std::string id;
    std::string authorName;
    std::string text;
    std::string createdAt;
    
    static ChatMessage fromDocument(bsoncxx::document::view doc);
    bsoncxx::document::value toDocument() const;
};

// Verification code model
struct VerificationCode {
    std::string email;
    std::string code;
    int64_t expires;
    std::string createdAt;
    
    static VerificationCode fromDocument(bsoncxx::document::view doc);
    bsoncxx::document::value toDocument() const;
};

// Site content model
struct SiteContent {
    std::string key;
    std::string address;
    std::string phone;
    std::string whatsapp;
    std::string email;
    std::string tiktok;
    std::string aboutText;
    std::vector<std::string> gallery;
    
    static SiteContent fromDocument(bsoncxx::document::view doc);
    bsoncxx::document::value toDocument() const;
};

// Helper to convert document to JSON string
std::string documentToJson(bsoncxx::document::view doc);

} // namespace abious

#endif // MODELS_H
