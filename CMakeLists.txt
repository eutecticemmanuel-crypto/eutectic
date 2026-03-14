cmake_minimum_required(VERSION 3.15)
project(abious_backend)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find required packages
find_package(Threads REQUIRED)

# MongoDB Driver - use FetchContent for automatic download
include(FetchContent)

# Set MongoDB driver version
set(MONGOCXX_VERSION "3.8.0" CACHE STRING "MongoDB C++ Driver version")

# Find or download MongoDB C++ driver
find_package(PkgConfig QUIET)
pkg_check_modules(LIBMONGOCXX QUIET libmongocxx)
pkg_check_modules(LIBBSONCXX QUIET libbsoncxx)

if(NOT LIBMONGOCXX_FOUND)
    # Use system MongoDB if available, otherwise CMake will use system paths
    find_path(MONGOCXX_INCLUDE_DIR mongocxx/client.hpp
        HINTS ENV MONGOCXX_INCLUDEDIR
        PATHS /usr/include /usr/local/include "C:/Program Files/MongoDB/include"
    )
    
    find_path(BSONCXX_INCLUDE_DIR bsoncxx/document/view.hpp
        HINTS ENV BSONCXX_INCLUDEDIR
        PATHS /usr/include /usr/local/include "C:/Program Files/MongoDB/include"
    )
    
    find_library(MONGOCXX_LIBRARY NAMES mongocxx
        HINTS ENV MONGOCXX_LIBDIR
        PATHS /usr/lib /usr/local/lib "C:/Program Files/MongoDB/lib"
    )
    
    find_library(BSONCXX_LIBRARY NAMES bsoncxx
        HINTS ENV BSONCXX_LIBDIR
        PATHS /usr/lib /usr/local/lib "C:/Program Files/MongoDB/lib"
    )
endif()

# Crow web framework (header-only)
# Try to find system Crow first, otherwise use FetchContent
find_path(CROW_INCLUDE_DIR NAMES crow.h
    HINTS /usr/include /usr/local/include
)

if(NOT CROW_INCLUDE_DIR)
    message(STATUS "Downloading Crow framework...")
    FetchContent_Declare(
        crow
        GIT_REPOSITORY https://github.com/CrowCpp/Crow.git
        GIT_TAG v1.0+5
    )
    FetchContent_MakeAvailable(crow)
    set(CROW_INCLUDE_DIR "${crow_SOURCE_DIR}/include")
endif()

# Find OpenSSL for password hashing
find_package(OpenSSL REQUIRED)

# Include directories
include_directories(${CMAKE_SOURCE_DIR}/include)
if(CROW_INCLUDE_DIR)
    include_directories(${CROW_INCLUDE_DIR})
endif()
if(MONGOCXX_INCLUDE_DIR)
    include_directories(${MONGOCXX_INCLUDE_DIR})
endif()
if(BSONCXX_INCLUDE_DIR)
    include_directories(${BSONCXX_INCLUDE_DIR})
endif()

# Add executable
add_executable(server 
    src/main.cpp
    src/server.cpp
    src/database.cpp
    src/models.cpp
    src/routes.cpp
    src/utils.cpp
)

# Link libraries
target_link_libraries(server PRIVATE 
    Threads::Threads
    OpenSSL::SSL
    OpenSSL::Crypto
)

# Add MongoDB libraries if found
if(MONGOCXX_LIBRARY AND BSONCXX_LIBRARY)
    target_link_libraries(server PRIVATE ${MONGOCXX_LIBRARY} ${BSONCXX_LIBRARY})
    message(STATUS "MongoDB libraries found and linked")
else()
    message(WARNING "MongoDB libraries not found - server will run without MongoDB support")
endif()

# Message about dependencies
message(STATUS "========================================")
message(STATUS "Abious C++ Backend Configuration")
message(STATUS "========================================")
message(STATUS "CMAKE version: ${CMAKE_VERSION}")
message(STATUS "C++ compiler: ${CMAKE_CXX_COMPILER_ID} ${CMAKE_CXX_COMPILER_VERSION}")
message(STATUS "OpenSSL found: ${OPENSSL_FOUND}")
message(STATUS "Crow include: ${CROW_INCLUDE_DIR}")
message(STATUS "MongoDB include: ${MONGOCXX_INCLUDE_DIR}")
message(STATUS "MongoDB library: ${MONGOCXX_LIBRARY}")
message(STATUS "========================================")

# Post-build: Copy static files
# The executable expects the static files to be in the working directory
