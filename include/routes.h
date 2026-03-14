#ifndef ROUTES_H
#define ROUTES_H

#include <crow.h>

namespace abious {

// Initialize all routes
void setupRoutes(Crow& app);

// API Routes
void setupApiRoutes(Crow& app);

// Static file serving
void setupStaticRoutes(Crow& app, const std::string& staticDir);

} // namespace abious

#endif // ROUTES_H
