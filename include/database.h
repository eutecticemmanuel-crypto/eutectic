#ifndef DATABASE_H
#define DATABASE_H

#include <mongocxx/client.hpp>
#include <mongocxx/database.hpp>
#include <mongocxx/collection.hpp>
#include <bsoncxx/document/value.hpp>
#include <bsoncxx/document/view.hpp>
#include <string>
#include <vector>
#include <optional>

namespace abious {

class Database {
public:
    static Database& getInstance();
    
    // Connection methods
    bool connect(const std::string& uri = "mongodb://127.0.0.1:27017");
    bool isConnected() const { return m_connected; }
    
    // Collections
    mongocxx::collection getUsersCollection();
    mongocxx::collection getSessionsCollection();
    mongocxx::collection getPostsCollection();
    mongocxx::collection getChatCollection();
    mongocxx::collection getContentCollection();
    mongocxx::collection getVerificationCodesCollection();
    
    // User operations
    std::optional<bsoncxx::document::value> findUserByEmail(const std::string& email);
    std::vector<bsoncxx::document::value> getAllUsers();
    bool insertUser(const bsoncxx::document::view& user);
    bool updateUser(const std::string& email, const bsoncxx::document::view& updates);
    
    // Session operations
    std::optional<bsoncxx::document::value> findSession(const std::string& token);
    bool upsertSession(const std::string& token, const bsoncxx::document::view& session);
    bool deleteSession(const std::string& token);
    
    // Post operations
    std::vector<bsoncxx::document::value> getAllPosts();
    bool insertPost(const bsoncxx::document::view& post);
    bool updatePost(const std::string& postId, const bsoncxx::document::view& updates);
    
    // Chat operations
    std::vector<bsoncxx::document::value> getChatMessages();
    bool insertChatMessage(const bsoncxx::document::view& message);
    bool clearChat();
    
    // Content operations
    std::optional<bsoncxx::document::value> getContent(const std::string& key);
    bool setContent(const std::string& key, const bsoncxx::document::view& content);
    
    // Verification codes
    std::optional<bsoncxx::document::value> findVerificationCode(const std::string& email, const std::string& code);
    bool insertVerificationCode(const bsoncxx::document::view& code);
    bool clearVerificationCodes();
    
private:
    Database() = default;
    ~Database() = default;
    Database(const Database&) = delete;
    Database& operator=(const Database&) = delete;
    
    mongocxx::client m_client;
    mongocxx::database m_database;
    bool m_connected = false;
};

} // namespace abious

#endif // DATABASE_H
