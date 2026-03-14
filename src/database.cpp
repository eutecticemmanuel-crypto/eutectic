#include "database.h"
#include <iostream>
#include <bsoncxx/builder/stream/document.hpp>
#include <bsoncxx/json.hpp>

using bsoncxx::builder::stream::document;
using bsoncxx::builder::stream::open_document;
using bsoncxx::builder::stream::close_document;
using bsoncxx::builder::stream::open_array;
using bsoncxx::builder::stream::close_array;
using bsoncxx::builder::stream::finalize;

namespace abious {

Database& Database::getInstance() {
    static Database instance;
    return instance;
}

bool Database::connect(const std::string& uri) {
    try {
        m_client = mongocxx::client{mongocxx::uri{uri}};
        m_database = m_client["abious_rehab"];
        
        // Test connection
        m_database.run_command(document{} << "ping" << 1 << finalize);
        
        m_connected = true;
        std::cout << "✓ Connected to MongoDB successfully" << std::endl;
        
        // Create indexes
        getUsersCollection().create_index(
            document{} << "email" << 1 << finalize,
            document{} << "unique" << true << finalize
        );
        
        return true;
    } catch (const std::exception& e) {
        std::cout << "✗ MongoDB connection failed: " << e.what() << std::endl;
        m_connected = false;
        return false;
    }
}

mongocxx::collection Database::getUsersCollection() {
    return m_database["users"];
}

mongocxx::collection Database::getSessionsCollection() {
    return m_database["sessions"];
}

mongocxx::collection Database::getPostsCollection() {
    return m_database["posts"];
}

mongocxx::collection Database::getChatCollection() {
    return m_database["chat"];
}

mongocxx::collection Database::getContentCollection() {
    return m_database["content"];
}

mongocxx::collection Database::getVerificationCodesCollection() {
    return m_database["verificationCodes"];
}

// User operations
std::optional<bsoncxx::document::value> Database::findUserByEmail(const std::string& email) {
    auto coll = getUsersCollection();
    auto doc = coll.find_one(document{} << "email" << email << finalize);
    if (doc) {
        return std::make_optional(doc->view().copy());
    }
    return std::nullopt;
}

std::vector<bsoncxx::document::value> Database::getAllUsers() {
    std::vector<bsoncxx::document::value> users;
    auto coll = getUsersCollection();
    for (auto&& doc : coll.find({})) {
        users.push_back(doc.copy());
    }
    return users;
}

bool Database::insertUser(const bsoncxx::document::view& user) {
    try {
        getUsersCollection().insert_one(user);
        return true;
    } catch (const std::exception& e) {
        std::cerr << "Error inserting user: " << e.what() << std::endl;
        return false;
    }
}

bool Database::updateUser(const std::string& email, const bsoncxx::document::view& updates) {
    try {
        auto result = getUsersCollection().update_one(
            document{} << "email" << email << finalize,
            document{} << "$set" << updates << finalize
        );
        return result && result->modified_count() > 0;
    } catch (const std::exception& e) {
        std::cerr << "Error updating user: " << e.what() << std::endl;
        return false;
    }
}

// Session operations
std::optional<bsoncxx::document::value> Database::findSession(const std::string& token) {
    auto coll = getSessionsCollection();
    auto doc = coll.find_one(document{} << "token" << token << finalize);
    if (doc) {
        return std::make_optional(doc->view().copy());
    }
    return std::nullopt;
}

bool Database::upsertSession(const std::string& token, const bsoncxx::document::view& session) {
    try {
        getSessionsCollection().update_one(
            document{} << "token" << token << finalize,
            document{} << "$set" << session << finalize,
            mongocxx::options::update{}.upsert(true)
        );
        return true;
    } catch (const std::exception& e) {
        std::cerr << "Error upserting session: " << e.what() << std::endl;
        return false;
    }
}

bool Database::deleteSession(const std::string& token) {
    try {
        auto result = getSessionsCollection().delete_one(
            document{} << "token" << token << finalize
        );
        return result && result->deleted_count() > 0;
    } catch (const std::exception& e) {
        std::cerr << "Error deleting session: " << e.what() << std::endl;
        return false;
    }
}

// Post operations
std::vector<bsoncxx::document::value> Database::getAllPosts() {
    std::vector<bsoncxx::document::value> posts;
    auto coll = getPostsCollection();
    for (auto&& doc : coll.find({})) {
        posts.push_back(doc.copy());
    }
    return posts;
}

bool Database::insertPost(const bsoncxx::document::view& post) {
    try {
        getPostsCollection().insert_one(post);
        return true;
    } catch (const std::exception& e) {
        std::cerr << "Error inserting post: " << e.what() << std::endl;
        return false;
    }
}

bool Database::updatePost(const std::string& postId, const bsoncxx::document::view& updates) {
    try {
        auto result = getPostsCollection().update_one(
            document{} << "id" << postId << finalize,
            document{} << "$set" << updates << finalize
        );
        return result && result->modified_count() > 0;
    } catch (const std::exception& e) {
        std::cerr << "Error updating post: " << e.what() << std::endl;
        return false;
    }
}

// Chat operations
std::vector<bsoncxx::document::value> Database::getChatMessages() {
    std::vector<bsoncxx::document::value> messages;
    auto coll = getChatCollection();
    for (auto&& doc : coll.find({})) {
        messages.push_back(doc.copy());
    }
    return messages;
}

bool Database::insertChatMessage(const bsoncxx::document::view& message) {
    try {
        getChatCollection().insert_one(message);
        return true;
    } catch (const std::exception& e) {
        std::cerr << "Error inserting chat message: " << e.what() << std::endl;
        return false;
    }
}

bool Database::clearChat() {
    try {
        getChatCollection().delete_many({});
        return true;
    } catch (const std::exception& e) {
        std::cerr << "Error clearing chat: " << e.what() << std::endl;
        return false;
    }
}

// Content operations
std::optional<bsoncxx::document::value> Database::getContent(const std::string& key) {
    auto coll = getContentCollection();
    auto doc = coll.find_one(document{} << "key" << key << finalize);
    if (doc) {
        return std::make_optional(doc->view().copy());
    }
    return std::nullopt;
}

bool Database::setContent(const std::string& key, const bsoncxx::document::view& content) {
    try {
        getContentCollection().update_one(
            document{} << "key" << key << finalize,
            document{} << "$set" << content << finalize,
            mongocxx::options::update{}.upsert(true)
        );
        return true;
    } catch (const std::exception& e) {
        std::cerr << "Error setting content: " << e.what() << std::endl;
        return false;
    }
}

// Verification codes
std::optional<bsoncxx::document::value> Database::findVerificationCode(const std::string& email, const std::string& code) {
    auto coll = getVerificationCodesCollection();
    auto doc = coll.find_one(
        document{} << "email" << email << "code" << code << finalize
    );
    if (doc) {
        return std::make_optional(doc->view().copy());
    }
    return std::nullopt;
}

bool Database::insertVerificationCode(const bsoncxx::document::view& code) {
    try {
        getVerificationCodesCollection().insert_one(code);
        return true;
    } catch (const std::exception& e) {
        std::cerr << "Error inserting verification code: " << e.what() << std::endl;
        return false;
    }
}

bool Database::clearVerificationCodes() {
    try {
        getVerificationCodesCollection().delete_many({});
        return true;
    } catch (const std::exception& e) {
        std::cerr << "Error clearing verification codes: " << e.what() << std::endl;
        return false;
    }
}

} // namespace abious
