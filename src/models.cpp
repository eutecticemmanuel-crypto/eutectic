#include "models.h"
#include <bsoncxx/builder/stream/document.hpp>
#include <bsoncxx/json.hpp>
#include <optional>

using bsoncxx::builder::stream::document;
using bsoncxx::builder::stream::finalize;

namespace abious {

// User implementation
User User::fromDocument(bsoncxx::document::view doc) {
    User user;
    user.id = doc["id"].get_string().value.data();
    user.fullName = doc["fullName"].get_string().value.data();
    user.email = doc["email"].get_string().value.data();
    user.passwordHash = doc["passwordHash"].get_string().value.data();
    user.role = doc["role"].get_string().value.data();
    user.phone = doc["phone"].get_string().value.data();
    user.age = doc["age"].get_int32().value();
    user.interests = doc["interests"].get_string().value.data();
    user.createdAt = doc["createdAt"].get_string().value.data();
    user.lastLoginAt = doc["lastLoginAt"].get_string().value.data();
    user.verified = doc["verified"].get_bool().value();
    return user;
}

bsoncxx::document::value User::toDocument() const {
    return document{}
        << "id" << id
        << "fullName" << fullName
        << "email" << email
        << "passwordHash" << passwordHash
        << "role" << role
        << "phone" << phone
        << "age" << age
        << "interests" << interests
        << "createdAt" << createdAt
        << "lastLoginAt" << lastLoginAt
        << "verified" << verified
        << finalize;
}

// Session implementation
Session Session::fromDocument(bsoncxx::document::view doc) {
    Session session;
    session.token = doc["token"].get_string().value.data();
    session.userId = doc["userId"].get_string().value.data();
    session.createdAt = doc["createdAt"].get_string().value.data();
    return session;
}

bsoncxx::document::value Session::toDocument() const {
    return document{}
        << "token" << token
        << "userId" << userId
        << "createdAt" << createdAt
        << finalize;
}

// Post implementation
Post Post::fromDocument(bsoncxx::document::view doc) {
    Post post;
    post.id = doc["id"].get_string().value.data();
    post.authorName = doc["authorName"].get_string().value.data();
    post.authorEmail = doc["authorEmail"].get_string().value.data();
    post.text = doc["text"].get_string().value.data();
    
    if (doc["attachment"]) {
        auto att = doc["attachment"].get_document().view();
        if (att["name"]) post.attachmentName = att["name"].get_string().value.data();
        if (att["type"]) post.attachmentType = att["type"].get_string().value.data();
        if (att["dataUrl"]) post.attachmentDataUrl = att["dataUrl"].get_string().value.data();
        if (att["size"]) post.attachmentSize = att["size"].get_int32().value();
    }
    
    post.createdAt = doc["createdAt"].get_string().value.data();
    
    if (doc["comments"]) {
        for (auto&& c : doc["comments"].get_array().value) {
            post.comments.push_back(Comment::fromDocument(c.get_document().view()));
        }
    }
    
    return post;
}

bsoncxx::document::value Post::toDocument() const {
    auto builder = document{};
    builder << "id" << id
            << "authorName" << authorName
            << "authorEmail" << authorEmail
            << "text" << text
            << "createdAt" << createdAt;
    
    if (attachmentName) {
        builder << "attachment" << open_document
                << "name" << *attachmentName
                << "type" << *attachmentType
                << "dataUrl" << *attachmentDataUrl
                << "size" << attachmentSize
                << close_document;
    }
    
    return builder << finalize;
}

// Comment implementation
Comment Comment::fromDocument(bsoncxx::document::view doc) {
    Comment comment;
    comment.id = doc["id"].get_string().value.data();
    comment.authorName = doc["authorName"].get_string().value.data();
    comment.text = doc["text"].get_string().value.data();
    comment.createdAt = doc["createdAt"].get_string().value.data();
    return comment;
}

bsoncxx::document::value Comment::toDocument() const {
    return document{}
        << "id" << id
        << "authorName" << authorName
        << "text" << text
        << "createdAt" << createdAt
        << finalize;
}

// ChatMessage implementation
ChatMessage ChatMessage::fromDocument(bsoncxx::document::view doc) {
    ChatMessage msg;
    msg.id = doc["id"].get_string().value.data();
    msg.authorName = doc["authorName"].get_string().value.data();
    msg.text = doc["text"].get_string().value.data();
    msg.createdAt = doc["createdAt"].get_string().value.data();
    return msg;
}

bsoncxx::document::value ChatMessage::toDocument() const {
    return document{}
        << "id" << id
        << "authorName" << authorName
        << "text" << text
        << "createdAt" << createdAt
        << finalize;
}

// VerificationCode implementation
VerificationCode VerificationCode::fromDocument(bsoncxx::document::view doc) {
    VerificationCode vc;
    vc.email = doc["email"].get_string().value.data();
    vc.code = doc["code"].get_string().value.data();
    vc.expires = doc["expires"].get_int64().value();
    vc.createdAt = doc["createdAt"].get_string().value.data();
    return vc;
}

bsoncxx::document::value VerificationCode::toDocument() const {
    return document{}
        << "email" << email
        << "code" << code
        << "expires" << expires
        << "createdAt" << createdAt
        << finalize;
}

// SiteContent implementation
SiteContent SiteContent::fromDocument(bsoncxx::document::view doc) {
    SiteContent content;
    content.key = doc["key"].get_string().value.data();
    
    if (doc["address"]) content.address = doc["address"].get_string().value.data();
    if (doc["phone"]) content.phone = doc["phone"].get_string().value.data();
    if (doc["whatsapp"]) content.whatsapp = doc["whatsapp"].get_string().value.data();
    if (doc["email"]) content.email = doc["email"].get_string().value.data();
    if (doc["tiktok"]) content.tiktok = doc["tiktok"].get_string().value.data();
    if (doc["aboutText"]) content.aboutText = doc["aboutText"].get_string().value.data();
    
    return content;
}

bsoncxx::document::value SiteContent::toDocument() const {
    return document{}
        << "key" << key
        << "address" << address
        << "phone" << phone
        << "whatsapp" << whatsapp
        << "email" << email
        << "tiktok" << tiktok
        << "aboutText" << aboutText
        << finalize;
}

std::string documentToJson(bsoncxx::document::view doc) {
    return bsoncxx::json::to_json(doc);
}

} // namespace abious
