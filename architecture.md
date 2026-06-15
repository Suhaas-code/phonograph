# architecture.md

# Audiophile Library Management Platform (V1)

## Brief Description

A self-hosted metadata-first platform for managing personal music collections across multiple libraries and devices without storing audio files.

Users scan local music folders through a web interface. The browser extracts metadata and uploads only metadata to the server. The platform maintains a centralized catalog of tracks, variants, collections, and streaming service links.

The platform does not stream, transfer, or store audio files.

Primary goals:

* Track music collections across devices.
* Detect missing tracks and variants between libraries.
* Organize tracks into collections.
* Preserve links to streaming platforms.
* Provide audiophile-focused metadata and quality comparison.
* Support sharing collections between approved users.

---

# Tech Stack

## Frontend

* React
* TypeScript
* Vite
* TanStack Query
* TailwindCSS

## Backend

* FastAPI
* Python 3.12+
* Pydantic
* SQLAlchemy

## Database

* PostgreSQL

## Authentication

* OAuth2
* Username / Password
* Admin approval workflow

## Infrastructure

* Nginx
* Cloudflare
* Ubuntu VPS
* Systemd deployment

---

# Architecture

## High Level Flow

```text
User
  │
  ▼
Web Portal
  │
  ▼
Folder Selection
  │
  ▼
Browser Metadata Scanner
  │
  ▼
Metadata Upload API
  │
  ▼
PostgreSQL
  │
  ▼
Library Analysis Engine
  │
  ├── Track Grouping
  ├── Variant Detection
  ├── Missing Track Detection
  ├── Collection Management
  └── Sharing
```

---

## Core Concepts

### User

Represents an approved account.

Properties:

* id
* username
* email
* role
* approval_status

---

### Library

Represents a scanned music collection.

Examples:

```text
Laptop FLAC Archive
Android Music
External SSD
NAS Backup
```

Properties:

* id
* owner_id
* name
* description
* last_scan
* track_count

---

### Track

Logical song identity.

Grouping Key:

```text
normalized_artist + normalized_title
```

Examples:

```text
Hotel California - Eagles
Bohemian Rhapsody - Queen
```

Properties:

* id
* artist
* title
* normalized_artist
* normalized_title

---

### Variant

Represents a specific file version of a track.

Examples:

```text
FLAC 24-bit 96kHz
FLAC 16-bit 44.1kHz
Opus 320kbps
MP3 320kbps
```

Properties:

* id
* track_id
* library_id
* codec
* container
* bitrate
* bit_depth
* sample_rate
* channels
* duration
* file_size
* album
* year
* genre

Variants should always be ordered by quality.

Recommended ordering:

```text
Higher Bit Depth
Higher Sample Rate
Lossless Before Lossy
Higher Bitrate
```

---

### Collection

Unified grouping system.

Collection Types:

* User Collection
* Album Collection
* Tag Collection
* Shared Collection

Examples:

```text
Gym
Driving
Favorites
Hotel California
Jazz
```

Properties:

* id
* owner_id
* name
* type

---

### Streaming Link

Optional mapping attached to a Track.

Supported Services:

* Spotify
* Tidal
* Qobuz
* Deezer
* Amazon Music
* YouTube Music

Properties:

* id
* track_id
* service
* url

---

# Metadata Extraction Requirements

The browser scanner must attempt to extract:

Required:

* title
* artist

Extended:

* album
* year
* genre
* track_number
* disc_number
* duration
* codec
* container
* bitrate
* bit_depth
* sample_rate
* channels
* file_size

Optional:

* composer
* publisher
* replay_gain
* comments

The system must gracefully handle:

* missing tags
* malformed tags
* inconsistent capitalization
* duplicate metadata

Raw metadata must be preserved.

Normalized metadata must be generated separately.

---

# V1 Tasks

## Phase 1 - Authentication

* User registration
* Login
* OAuth login
* Admin approval workflow
* Session management

---

## Phase 2 - Database

Create schema for:

* users
* libraries
* tracks
* variants
* collections
* collection_items
* streaming_links
* shares

---

## Phase 3 - Browser Scanner

* Folder selection
* Recursive file discovery
* Metadata extraction
* Metadata normalization
* Upload metadata to backend

Supported formats:

* FLAC
* MP3
* Opus
* OGG
* AAC
* M4A
* WAV

---

## Phase 4 - Track Grouping Engine

* Normalize artist names
* Normalize titles
* Create grouping rules
* Merge matching tracks
* Allow manual split/merge overrides

---

## Phase 5 - Library Management

* Create library
* Scan library
* Rescan library
* View library contents
* View library statistics

---

## Phase 6 - Variant Management

* Detect variants
* Quality ranking
* Variant comparison
* Display available formats

Example:

```text
Hotel California - Eagles

FLAC 24-bit 96kHz
FLAC 16-bit 44.1kHz
Opus 320kbps
MP3 320kbps
```

---

## Phase 7 - Collections

* Create collection
* Edit collection
* Delete collection
* Add tracks
* Remove tracks

System-generated collections:

* Albums
* Tags

---

## Phase 8 - Sharing

* Share collection
* Share link generation
* Permission validation
* View shared collection

Only approved users may access shared content.

---

## Phase 9 - Search & Analytics

Search:

* Artist
* Track
* Album
* Genre
* Codec

Analytics:

* Missing tracks
* Missing variants
* Duplicate variants
* Library comparison
* Quality distribution

---

## Phase 10 - Streaming Links

* Attach links manually
* Suggest existing links from database
* Display service mappings

---

# V1 Non-Goals

The following are explicitly out of scope:

* Audio storage
* Audio streaming
* Audio playback
* Audio uploads
* Automatic folder monitoring
* Automatic syncing
* Playlist import/export
* Peer-to-peer transfer
* Apple ecosystem support
* Mobile applications
* Desktop applications

---

# V2 Ideas

Potential future enhancements:

* Dedicated Windows scanner
* Dedicated Android scanner
* Background folder monitoring
* Acoustic fingerprinting
* Playlist import/export
* Spotify integration
* Tidal integration
* Qobuz integration
* Cover art caching
* Smart recommendations
* Collection statistics dashboard
* Peer-to-peer library sync
* Public self-hosted deployment mode
* Multi-server federation
* Audiophile release comparison tools
