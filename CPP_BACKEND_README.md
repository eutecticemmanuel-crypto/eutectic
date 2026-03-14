# Abious Rehabilitation Backend - C++ Implementation

A high-performance C++ backend server with MongoDB integration for the Abious Rehabilitation Initiative website.

## Features

- **MongoDB Integration**: Full database support for users, sessions, posts, chat, and content management
- **RESTful API**: Complete API endpoints for authentication, member management, posts, and chat
- **Static File Serving**: Serves all HTML pages from the website
- **User Authentication**: Register, login, session management with JWT-like tokens
- **Admin Panel**: Content management API for site administrators
- **Real-time Chat**: Chat messaging system

## Prerequisites

### Required Software

1. **CMake 3.15+**: [Download](https://cmake.org/download/)
2. **C++ Compiler**: 
   - Windows: Visual Studio 2019+ or MinGW-w64
   - Requires C++17 support
3. **MongoDB**: [Download](https://www.mongodb.com/try/download/community)
4. **MongoDB C++ Driver**: Installed via CMake FetchContent

### Installing Dependencies

#### Windows

1. Install Visual Studio 2019 or later with C++ workload
2. Install CMake
3. Install MongoDB Community Server
4. Start MongoDB:
   ```
   mongod --dbpath "C:\data\db"
   ```

#### Linux (Ubuntu/Debian)

```bash
# Install build tools
sudo apt-get install build-essential cmake

# Install MongoDB
wget https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2204-7.0.5.tgz
tar -zxvf mongodb-linux-x86_64-ubuntu2204-7.0.5.tgz
sudo cp -r mongodb-linux-x86_64-ubuntu2204-7.0.5/bin/* /usr/local/bin/
```

## Building

### Quick Start

```bash
# Run the build script (Windows)
build_cpp_backend.cmd
```

### Manual Build

```bash
# Create build directory
mkdir build
cd build

# Configure
cmake .. -DCMAKE_BUILD_TYPE=Release

# Build
cmake --build . --config Release
```

## Running the Server

### Basic Usage

```bash
# Run from the Website directory
cd build
server.exe ..
```

### With MongoDB URI

```bash
# Using MongoDB Atlas cloud
set MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/abious_rehab
server.exe ..

# Using local MongoDB
set MONGODB_URI=mongodb://localhost:27017/abious_rehab
server.exe ..
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| HOST | 0.0.0.0 | Server host |
| MONGODB_URI | mongodb://127.0.0.1:27017 | MongoDB connection string |

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register` | Register new user |
| POST | `/api/login` | Login user |
| GET | `/api/me` | Get current user |

### Members

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/members` | Get all members (requires auth) |

### Posts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/posts` | Get all posts (requires auth) |
| POST | `/api/posts` | Create post (requires auth) |

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat` | Get chat messages (requires auth) |
| POST | `/api/chat` | Send message (requires auth) |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/content` | Get site content (requires admin) |
| POST | `/api/admin/content/contact` | Update contact info (requires admin) |
| POST | `/api/admin/members` | Create member (requires admin) |

### Verification

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/verification/generate` | Generate verification code |
| POST | `/api/verification/verify` | Verify email code |

## HTML Pages Served

The server automatically serves all HTML files in the static directory:

- `trial.html` - Main entry point
- `admin.html` - Admin dashboard
- `programs_run.html` - Programs page
- `abious_rehabilitation_center2.html` - Rehabilitation center page
- `abious_rehabilitation_ceter.html` - Another center page
- And all other HTML files in the directory

## Default Admin Credentials

- Email: `admin@abious.org`
- Password: `admin123`

**Note**: Change the password in production!

## Project Structure

```
Website/
├── CMakeLists.txt           # Build configuration
├── include/                 # Header files
│   ├── database.h
│   ├── models.h
│   ├── routes.h
│   └── utils.h
├── src/                     # Source files
│   ├── main.cpp
│   ├── server.cpp
│   ├── database.cpp
│   ├── models.cpp
│   ├── routes.cpp
│   └── utils.cpp
├── build/                   # Build output
├── build_cpp_backend.cmd   # Windows build script
└── *.html                  # All website HTML files
```

## Troubleshooting

### MongoDB Connection Issues

If you see "MongoDB connection failed", check:
1. MongoDB is running (`mongod`)
2. The correct port (27017) is accessible
3. Firewall settings allow connections

### Build Errors

If CMake cannot find MongoDB driver:
1. Ensure you have internet access (FetchContent downloads dependencies)
2. Try clearing the CMake cache and rebuilding

### Port Already in Use

If port 3000 is in use:
```bash
# Windows
set PORT=3001
server.exe ..

# Linux
PORT=3001 ./server ..
```

## Performance

The C++ implementation provides:
- Faster request processing than Node.js
- Lower memory footprint
- Better performance under high load

## Credits

Built with:
- [Crow](https://github.com/CrowCpp/Crow) - C++ web framework
- [MongoDB C++ Driver](https://github.com/mongodb/mongo-cxx-driver) - MongoDB connectivity
