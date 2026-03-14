#include <iostream>
#include <string>
#include <cstdlib>
#include "database.h"
#include "routes.h"
#include <crow.h>

int main(int argc, char* argv[]) {
    std::cout << "========================================" << std::endl;
    std::cout << "  Abious Rehabilitation Backend (C++)" << std::endl;
    std::cout << "========================================" << std::endl;
    
    // Get port from environment or use default
    int port = 3000;
    const char* portEnv = std::getenv("PORT");
    if (portEnv) {
        port = std::stoi(portEnv);
    }
    
    const char* hostEnv = std::getenv("HOST");
    std::string host = hostEnv ? hostEnv : "0.0.0.0";
    
    // Get MongoDB URI
    std::string mongoUri = "mongodb://127.0.0.1:27017";
    const char* mongoEnv = std::getenv("MONGODB_URI");
    if (mongoEnv) {
        mongoUri = mongoEnv;
    }
    
    // Connect to MongoDB
    auto& db = Database::getInstance();
    if (!db.connect(mongoUri)) {
        std::cout << "Warning: Running without MongoDB (will use memory only)" << std::endl;
    }
    
    // Get static files directory
    std::string staticDir = ".";
    if (argc > 1) {
        staticDir = argv[1];
    }
    
    std::cout << "Serving static files from: " << staticDir << std::endl;
    std::cout << "Server will run on: " << host << ":" << port << std::endl;
    
    // Create Crow app
    Crow app(port);
    
    // Enable CORS
    app.set_global_header("Access-Control-Allow-Origin", "*");
    app.set_global_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    app.set_global_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    // Setup routes
    setupRoutes(app, staticDir);
    
    // Handle CORS preflight
    CROW_ROUTE(app, "/<path>").methods(crow::Method::OPTIONS)([](const crow::request& req) {
        return crow::response(200);
    });
    
    CROW_ROUTE(app, "/api/<path>").methods(crow::Method::OPTIONS)([](const crow::request& req) {
        return crow::response(200);
    });
    
    std::cout << "========================================" << std::endl;
    std::cout << "Server started successfully!" << std::endl;
    std::cout << "Access at: http://localhost:" << port << std::endl;
    std::cout << "========================================" << std::endl;
    
    // Run the server
    app.run();
    
    return 0;
}
